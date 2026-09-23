import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";

export const prerender = false;

/**
 * IndexNow 키 파일. https://<도메인>/<키>.txt 가 키 자체를 그대로 돌려줘야
 * 검색엔진이 핑을 신뢰합니다. 키가 아닌 경로로 들어오면 404 입니다.
 */
export const GET: APIRoute = ({ params, locals }) => {
  const key = getEnv(locals, "INDEXNOW_KEY");
  if (!key || params.key !== key) return new Response("Not found", { status: 404 });

  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
