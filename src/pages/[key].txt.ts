import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";

/**
 * IndexNow 키 파일. https://<도메인>/<키>.txt 가 키 자체를 돌려줘야 검색엔진이
 * 핑을 신뢰합니다. 정적 빌드라 키가 있을 때만 그 경로를 굽습니다.
 */
export function getStaticPaths() {
  const key = getEnv("INDEXNOW_KEY");
  return key ? [{ params: { key } }] : [];
}

export const GET: APIRoute = ({ params }) =>
  new Response(params.key, { headers: { "content-type": "text/plain; charset=utf-8" } });
