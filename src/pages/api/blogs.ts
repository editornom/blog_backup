import type { APIRoute } from "astro";
import { db } from "../../lib/supabase";
import { isAdmin } from "../../lib/env";
import { json, fail, readBody } from "../../lib/http";
import { makeVerifyCode, verifyOwnership, fetchBlogProfile } from "../../lib/naver";

export const prerender = false;

const BLOG_ID_RE = /^[A-Za-z0-9_-]{2,40}$/;

/**
 * 블로그 등록·검증·차단.
 *
 * register/block 은 운영자(ADMIN_TOKEN)만 할 수 있습니다. 화이트리스트 운영이라
 * 아무나 등록해서는 안 되기 때문입니다. verify 는 토큰 없이 열어둡니다.
 * 연동코드를 블로그에 심을 수 있는 사람은 블로그 주인뿐이라, 그 행위 자체가 인증입니다.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readBody(request);
  const action = (body.action ?? "").trim();
  const blogId = (body.blogId ?? "").trim();

  if (!BLOG_ID_RE.test(blogId)) return fail("blogId 가 올바르지 않습니다.");

  const client = db(locals);

  if (action === "register") {
    if (!isAdmin(request, locals)) return fail("권한이 없습니다.", 401);

    const { data: existing } = await client
      .from("nb_blogs")
      .select("blog_id, status, verify_code")
      .eq("blog_id", blogId)
      .maybeSingle();
    if (existing) return json({ ok: true, alreadyExists: true, ...existing });

    const profile = await fetchBlogProfile(blogId);
    if (!profile) return fail("네이버에서 해당 블로그를 찾지 못했습니다.", 404);

    const verifyCode = makeVerifyCode();
    const { error } = await client.from("nb_blogs").insert({
      blog_id: blogId,
      nickname: profile.nickname,
      intro: profile.intro,
      verify_code: verifyCode,
      status: "pending",
      owner_note: (body.note ?? "").trim() || null,
    });
    if (error) return fail(`등록 실패: ${error.message}`, 500);

    return json({
      ok: true,
      blogId,
      status: "pending",
      verifyCode,
      guide: `블로그 소개글이나 최근 글에 ${verifyCode} 를 넣은 뒤 action=verify 로 다시 호출하세요.`,
    });
  }

  if (action === "verify") {
    const { data: blog } = await client
      .from("nb_blogs")
      .select("blog_id, status, verify_code")
      .eq("blog_id", blogId)
      .maybeSingle();
    if (!blog) return fail("등록되지 않은 블로그입니다.", 404);
    if (blog.status === "blocked") return fail("차단된 블로그입니다.", 403);

    const check = await verifyOwnership(blogId, blog.verify_code);
    if (!check.ok) {
      return fail(
        `연동코드 ${blog.verify_code} 를 찾지 못했습니다. 블로그 소개글 또는 최근 글(RSS 50개 이내)에 넣었는지 확인하세요.`,
        409,
        { verifyCode: blog.verify_code },
      );
    }

    const { error } = await client
      .from("nb_blogs")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        nickname: check.profile?.nickname ?? null,
        intro: check.profile?.intro ?? null,
      })
      .eq("blog_id", blogId);
    if (error) return fail(`검증 저장 실패: ${error.message}`, 500);

    return json({ ok: true, blogId, status: "verified", via: check.via });
  }

  if (action === "block") {
    if (!isAdmin(request, locals)) return fail("권한이 없습니다.", 401);
    // 글도 같이 내립니다. 삭제 요청이 들어왔을 때 즉시 노출을 끊기 위해서입니다.
    await client.from("nb_posts").update({ status: "removed" }).eq("blog_id", blogId);
    const { error } = await client
      .from("nb_blogs")
      .update({ status: "blocked", rss_sync: false })
      .eq("blog_id", blogId);
    if (error) return fail(`차단 실패: ${error.message}`, 500);
    return json({ ok: true, blogId, status: "blocked" });
  }

  return fail("action 은 register / verify / block 중 하나여야 합니다.");
};

/** 운영자용 현황 조회. */
export const GET: APIRoute = async ({ request, locals }) => {
  if (!isAdmin(request, locals)) return fail("권한이 없습니다.", 401);
  const client = db(locals);
  const { data, error } = await client
    .from("nb_blogs")
    .select("blog_id, nickname, status, verify_code, verified_at, rss_sync, created_at")
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return json({ ok: true, blogs: data });
};
