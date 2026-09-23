import type { APIRoute } from "astro";
import { db } from "../lib/supabase";
import { siteUrl } from "../lib/env";
import { nbBlogPath } from "../lib/urls";

export const prerender = false;

/** 고정 페이지와 블로그별 허브 페이지. 글 사이트맵과 분리해 갱신 주기를 다르게 둡니다. */
export const GET: APIRoute = async ({ locals }) => {
  const base = siteUrl(locals);
  const client = db(locals);

  const { data: blogs } = await client
    .from("nb_blogs")
    .select("blog_id")
    .eq("status", "verified")
    .order("created_at", { ascending: true });

  const paths = ["/", "/nb", "/nb/about", ...(blogs ?? []).map(blog => nbBlogPath(blog.blog_id))];

  // trailingSlash: "never" 설정이라 정규 주소에는 끝 슬래시를 붙이지 않습니다(루트만 예외).
  const urls = paths
    .map(path => `<url><loc>${path === "/" ? `${base}/` : `${base}${path}`}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=3600",
      },
    },
  );
};
