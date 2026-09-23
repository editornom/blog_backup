import type { APIRoute } from "astro";
import { db } from "../lib/supabase";
import { siteUrl } from "../lib/env";
import { LIMITS } from "../config";

export const prerender = false;

/**
 * 사이트맵 인덱스.
 *
 * 구글은 IndexNow 를 안 받으므로, 구글 쪽 색인 신호는 사실상 이 사이트맵의
 * lastmod 갱신이 전부입니다. Search Console 에 이 주소 하나만 등록하면
 * 하위 사이트맵은 알아서 따라 읽습니다.
 */
export const GET: APIRoute = async ({ locals }) => {
  const base = siteUrl(locals);
  const client = db(locals);

  const { data: verified } = await client
    .from("nb_blogs")
    .select("blog_id")
    .eq("status", "verified");
  const verifiedIds = (verified ?? []).map(blog => blog.blog_id);

  let count = 0;
  let lastmod = new Date().toISOString();

  if (verifiedIds.length > 0) {
    const { count: total } = await client
      .from("nb_posts")
      .select("id", { count: "exact", head: true })
      .in("blog_id", verifiedIds)
      .eq("status", "live");
    count = total ?? 0;

    const { data: newest } = await client
      .from("nb_posts")
      .select("updated_at")
      .in("blog_id", verifiedIds)
      .eq("status", "live")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newest?.updated_at) lastmod = new Date(newest.updated_at).toISOString();
  }

  const pageCount = Math.max(1, Math.ceil(count / LIMITS.SITEMAP_PAGE_SIZE));
  const entries = [
    `<sitemap><loc>${base}/sitemap-pages.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
    ...Array.from(
      { length: pageCount },
      (_, index) =>
        `<sitemap><loc>${base}/sitemap-nb-${index + 1}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
};
