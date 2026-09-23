import type { APIRoute } from "astro";
import { db } from "../lib/supabase";
import { siteUrl } from "../lib/env";
import { LIMITS } from "../config";
import { nbPostPath } from "../lib/urls";

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 글 사이트맵 한 조각.
 *
 * id 오름차순으로 끊습니다. updated_at 순으로 끊으면 글이 갱신될 때마다
 * 조각 사이를 오가면서 특정 URL 이 어느 사이트맵에도 안 들어가는 구간이 생깁니다.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) return new Response("Not found", { status: 404 });

  const base = siteUrl(locals);
  const client = db(locals);

  const { data: verified } = await client
    .from("nb_blogs")
    .select("blog_id")
    .eq("status", "verified");
  const verifiedIds = (verified ?? []).map(blog => blog.blog_id);
  if (verifiedIds.length === 0) return emptySitemap();

  const from = (page - 1) * LIMITS.SITEMAP_PAGE_SIZE;
  const to = from + LIMITS.SITEMAP_PAGE_SIZE - 1;

  const { data: posts } = await client
    .from("nb_posts")
    .select("blog_id, log_no, updated_at")
    .in("blog_id", verifiedIds)
    .eq("status", "live")
    .order("id", { ascending: true })
    .range(from, to);

  if (!posts || posts.length === 0) return emptySitemap();

  const urls = posts
    .map(post => {
      const loc = escapeXml(`${base}${nbPostPath(post.blog_id, post.log_no)}`);
      const lastmod = new Date(post.updated_at).toISOString();
      return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq></url>`;
    })
    .join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
};

function emptySitemap(): Response {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
}
