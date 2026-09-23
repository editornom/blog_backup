import type { APIRoute } from "astro";
import { siteUrl } from "../lib/env";

export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
  const base = siteUrl(locals);
  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
};
