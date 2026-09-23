import type { APIRoute } from "astro";
import { db, type Db } from "../../lib/supabase";
import { siteUrl } from "../../lib/env";
import { json, fail, readBody } from "../../lib/http";
import { resolveNaverUrl, fetchPost, fetchRssPosts, parseNaverBlogUrl } from "../../lib/naver";
import { ingestPosts, markIndexNowSent } from "../../lib/ingest";
import { pingIndexNow } from "../../lib/indexnow";
import { nbPostPath, nbBlogPath, absolute } from "../../lib/urls";

export const prerender = false;

/** 하루 허용량. 키자드가 RSS 를 1일 1회로 묶는 것과 같은 취지입니다. */
const DAILY_LIMIT = { url: 60, rss: 3 } as const;

async function overDailyLimit(client: Db, blogId: string, kind: "url" | "rss"): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await client
    .from("nb_submissions")
    .select("id", { count: "exact", head: true })
    .eq("blog_id", blogId)
    .eq("kind", kind)
    .neq("result", "rejected")
    .gte("created_at", since);
  return (count ?? 0) >= DAILY_LIMIT[kind];
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readBody(request);
  const client = db(locals);
  const base = siteUrl(locals);

  // ── 무엇을 등록할지 확정합니다. URL 1건이거나, blogId 의 RSS 전체이거나.
  const rawUrl = (body.url ?? "").trim();
  const rawBlogId = (body.blogId ?? "").trim();
  const kind: "url" | "rss" = body.mode === "rss" || (!rawUrl && rawBlogId) ? "rss" : "url";

  let blogId = rawBlogId;
  let logNo: string | null = null;

  if (kind === "url") {
    if (!rawUrl) return fail("네이버 블로그 글 주소를 입력하세요.");
    // naver.me 단축주소는 리다이렉트를 풀어야 해서 네트워크를 한 번 탑니다.
    const ref = parseNaverBlogUrl(rawUrl) ?? (await resolveNaverUrl(rawUrl));
    if (!ref) {
      return fail(
        "네이버 블로그 글 주소로 보이지 않습니다. blog.naver.com/아이디/글번호 형태로 넣어주세요.",
      );
    }
    blogId = ref.blogId;
    logNo = ref.logNo;
  }

  if (!/^[A-Za-z0-9_-]{2,40}$/.test(blogId)) return fail("블로그 아이디가 올바르지 않습니다.");

  // ── 화이트리스트 검사. 등록·검증되지 않은 블로그는 여기서 끊깁니다.
  const { data: blog } = await client
    .from("nb_blogs")
    .select("blog_id, status, verify_code")
    .eq("blog_id", blogId)
    .maybeSingle();

  if (!blog) {
    return fail(`등록되지 않은 블로그입니다(${blogId}). 운영자에게 등록을 요청하세요.`, 403, {
      blogId,
    });
  }
  if (blog.status === "blocked") return fail("차단된 블로그입니다.", 403);
  if (blog.status !== "verified") {
    return fail(
      `소유권 확인이 끝나지 않았습니다. 블로그 소개글이나 최근 글에 연동코드 ${blog.verify_code} 를 넣은 뒤 /api/blogs 의 verify 를 호출하세요.`,
      403,
      { blogId, verifyCode: blog.verify_code },
    );
  }

  if (await overDailyLimit(client, blogId, kind)) {
    await client
      .from("nb_submissions")
      .insert({ blog_id: blogId, log_no: logNo, kind, result: "rejected", reason: "daily limit" });
    return fail(
      `하루 제출 한도를 넘었습니다(${kind} ${DAILY_LIMIT[kind]}회/일). 내일 다시 시도하세요.`,
      429,
    );
  }

  // ── 수집
  const metas =
    kind === "rss"
      ? await fetchRssPosts(blogId)
      : await (async () => {
          const one = await fetchPost({ blogId, logNo: logNo! });
          return one ? [one] : [];
        })();

  if (metas.length === 0) {
    await client.from("nb_submissions").insert({
      blog_id: blogId,
      log_no: logNo,
      kind,
      result: "rejected",
      reason: "not found",
    });
    return fail(
      kind === "rss"
        ? "RSS 에서 글을 읽지 못했습니다. 블로그 관리 > 기본 설정에서 RSS 공개 여부를 확인하세요."
        : "글을 읽지 못했습니다. 비공개·삭제된 글이거나 주소가 잘못됐을 수 있습니다.",
      404,
    );
  }

  const result = await ingestPosts(client, blogId, metas, base);

  // ── 색인 신호. 실패해도 제출은 성공으로 둡니다.
  let indexnow: { ok: boolean; status: number | null; reason?: string } = {
    ok: true,
    status: null,
  };
  if (result.changedUrls.length > 0) {
    const host = new URL(base).hostname;
    indexnow = await pingIndexNow(locals, host, result.changedUrls);
    if (indexnow.ok) {
      await markIndexNowSent(
        client,
        blogId,
        metas.map(meta => meta.logNo),
      );
    }
  }

  await client.from("nb_submissions").insert({
    blog_id: blogId,
    log_no: logNo,
    kind,
    result: result.created > 0 ? "created" : result.updated > 0 ? "updated" : "skipped",
    reason: null,
  });

  return json({
    ok: true,
    blogId,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    indexnow,
    pageUrl: logNo ? absolute(base, nbPostPath(blogId, logNo)) : absolute(base, nbBlogPath(blogId)),
  });
};

export const GET: APIRoute = () => fail("POST 로 요청하세요.", 405);
