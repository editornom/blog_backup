import type { APIRoute } from "astro";
import { siteUrl } from "../lib/env";

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Sitemap: ${siteUrl()}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
