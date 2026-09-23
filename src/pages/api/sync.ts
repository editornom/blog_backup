import type { APIRoute } from "astro";
import { db } from "../../lib/supabase";
import { isAdmin, siteUrl } from "../../lib/env";
import { json, fail } from "../../lib/http";
import { fetchRssPosts } from "../../lib/naver";
import { ingestPosts, markIndexNowSent } from "../../lib/ingest";
import { pingIndexNow } from "../../lib/indexnow";

export const prerender = false;

/**
 * 등록된 모든 블로그의 RSS 를 훑어 새 글을 수집합니다.
 * GitHub Actions 크론이 하루 몇 번 호출하는 용도라 운영자 토큰을 요구합니다.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAdmin(request, locals)) return fail("권한이 없습니다.", 401);

  const client = db(locals);
  const base = siteUrl(locals);
  const host = new URL(base).hostname;

  const { data: blogs, error } = await client
    .from("nb_blogs")
    .select("blog_id")
    .eq("status", "verified")
    .eq("rss_sync", true);
  if (error) return fail(error.message, 500);

  const report: Record<string, unknown>[] = [];
  const allChangedUrls: string[] = [];

  // 네이버에 몰아치지 않도록 순차로 돌립니다. 블로그 수가 수백이 되면
  // 여기를 큐로 바꾸고 한 번에 처리할 개수를 끊어야 합니다.
  for (const blog of blogs ?? []) {
    try {
      const metas = await fetchRssPosts(blog.blog_id);
      if (metas.length === 0) {
        report.push({ blogId: blog.blog_id, error: "RSS 없음" });
        continue;
      }
      const result = await ingestPosts(client, blog.blog_id, metas, base);
      allChangedUrls.push(...result.changedUrls);

      if (result.changedUrls.length > 0) {
        await markIndexNowSent(
          client,
          blog.blog_id,
          metas.map(meta => meta.logNo),
        );
      }
      report.push({
        blogId: blog.blog_id,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      });
    } catch (cause) {
      report.push({
        blogId: blog.blog_id,
        error: cause instanceof Error ? cause.message : "unknown",
      });
    }
  }

  // 핑은 마지막에 한 번만 모아 보냅니다. 블로그마다 쏘면 호출량만 늘어납니다.
  const indexnow =
    allChangedUrls.length > 0
      ? await pingIndexNow(locals, host, allChangedUrls)
      : { ok: true, status: null };

  return json({ ok: true, blogs: report, changed: allChangedUrls.length, indexnow });
};
