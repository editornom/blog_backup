import type { APIRoute } from "astro";
import { BLOGS } from "../config";
import { allPosts, postsOf } from "../lib/store";
import { absolute, nbBlogPath, nbPostPath } from "../lib/urls";
import { siteUrl } from "../lib/env";

/**
 * 단일 사이트맵. 글이 수천 건이 되기 전에는 인덱스로 쪼갤 이유가 없습니다.
 * 구글은 IndexNow 를 받지 않으므로 lastmod 가 사실상 유일한 갱신 신호입니다.
 */
export const GET: APIRoute = () => {
  const base = siteUrl();
  const posts = allPosts();
  const newest = posts
    .map(post => post.updatedAt)
    .sort()
    .at(-1);

  const entry = (path: string, lastmod?: string | null) =>
    `<url><loc>${absolute(base, path)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`;

  const urls = [
    entry("/", newest),
    ...BLOGS.map(blog => entry(nbBlogPath(blog.blogId), postsOf(blog.blogId)[0]?.updatedAt)),
    ...posts.map(post => entry(nbPostPath(post.blogId, post.logNo), post.updatedAt)),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
