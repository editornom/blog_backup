import { getEnv } from "./env";

type MaybeLocals = { runtime?: { env?: Record<string, unknown> } } | undefined;

/**
 * IndexNow 핑.
 *
 * 빙·얀덱스·시크는 이 프로토콜로 즉시 크롤을 예약합니다. 구글은 IndexNow 를
 * 쓰지 않으므로, 구글 쪽은 사이트맵(lastmod 갱신)과 내부 링크로만 유도합니다.
 * 구글 Indexing API 는 채용공고·라이브영상 전용이라 여기선 쓰지 않습니다.
 *
 * 실패해도 제출 자체는 성공으로 처리합니다. 색인 신호는 부가 기능이고,
 * 여기서 예외를 던지면 사용자가 글을 못 올리는 게 되기 때문입니다.
 */
export async function pingIndexNow(
  locals: MaybeLocals,
  host: string,
  urls: string[],
): Promise<{ ok: boolean; status: number | null; reason?: string }> {
  const key = getEnv(locals, "INDEXNOW_KEY");
  if (!key) return { ok: false, status: null, reason: "INDEXNOW_KEY 미설정" };
  if (urls.length === 0) return { ok: true, status: null };

  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        // 1회 최대 10,000건이 프로토콜 상한입니다.
        urlList: urls.slice(0, 10_000),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: null, reason: error instanceof Error ? error.message : "unknown" };
  }
}
