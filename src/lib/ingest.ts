import type { Db } from "./supabase";
import type { Database, NbPost } from "./types";
import type { NaverPostMeta } from "./naver";
import { nbPostPath, absolute } from "./urls";

export interface IngestResult {
  created: number;
  updated: number;
  skipped: number;
  /** 새로 생겼거나 내용이 바뀐 페이지들. IndexNow 로 알릴 대상입니다. */
  changedUrls: string[];
}

/** 색인 신호를 다시 보낼 만큼 의미 있는 변화인지 판단합니다. */
function hasMeaningfulChange(existing: NbPost, incoming: NaverPostMeta): boolean {
  return (
    existing.title !== incoming.title ||
    existing.excerpt !== incoming.excerpt ||
    existing.thumbnail !== incoming.thumbnail ||
    existing.status !== "live"
  );
}

/**
 * 수집한 글 메타를 DB 에 반영합니다.
 *
 * upsert 한 방으로 끝내지 않고 기존 행을 먼저 읽는 이유는, 무엇이 실제로
 * 바뀌었는지 알아야 IndexNow 를 꼭 필요한 URL 에만 보낼 수 있기 때문입니다.
 * 바뀐 것 없이 매번 핑을 쏘면 검색엔진 쪽에서 신뢰도가 떨어집니다.
 */
export async function ingestPosts(
  client: Db,
  blogId: string,
  metas: NaverPostMeta[],
  siteBase: string,
): Promise<IngestResult> {
  const result: IngestResult = { created: 0, updated: 0, skipped: 0, changedUrls: [] };
  if (metas.length === 0) return result;

  const logNos = metas.map(meta => meta.logNo);
  const { data: existingRows, error } = await client
    .from("nb_posts")
    .select("*")
    .eq("blog_id", blogId)
    .in("log_no", logNos);
  if (error) throw new Error(`기존 글 조회 실패: ${error.message}`);

  const existingByLogNo = new Map((existingRows ?? []).map(row => [row.log_no, row]));
  const now = new Date().toISOString();

  const toInsert: Database["public"]["Tables"]["nb_posts"]["Insert"][] = [];
  const toUpdate: { logNo: string; patch: Partial<NbPost> }[] = [];

  for (const meta of metas) {
    const existing = existingByLogNo.get(meta.logNo);

    if (!existing) {
      toInsert.push({
        blog_id: meta.blogId,
        log_no: meta.logNo,
        title: meta.title,
        excerpt: meta.excerpt,
        thumbnail: meta.thumbnail,
        category: meta.category,
        tags: meta.tags,
        published_at: meta.publishedAt,
        source_url: meta.sourceUrl,
        status: "live",
      });
      continue;
    }

    if (!hasMeaningfulChange(existing, meta)) {
      result.skipped += 1;
      continue;
    }

    toUpdate.push({
      logNo: meta.logNo,
      patch: {
        title: meta.title,
        excerpt: meta.excerpt,
        thumbnail: meta.thumbnail,
        category: meta.category,
        tags: meta.tags,
        // PostView 폴백은 날짜를 못 읽을 때가 있습니다. 이미 아는 날짜를 null 로 덮지 않습니다.
        published_at: meta.publishedAt ?? existing.published_at,
        status: "live",
        crawled_at: now,
        updated_at: now,
      },
    });
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("nb_posts").insert(toInsert);
    if (insertError) throw new Error(`글 저장 실패: ${insertError.message}`);
    result.created = toInsert.length;
    result.changedUrls.push(
      ...toInsert.map(row => absolute(siteBase, nbPostPath(row.blog_id, row.log_no))),
    );
  }

  for (const { logNo, patch } of toUpdate) {
    const { error: updateError } = await client
      .from("nb_posts")
      .update(patch)
      .eq("blog_id", blogId)
      .eq("log_no", logNo);
    if (updateError) throw new Error(`글 갱신 실패(${logNo}): ${updateError.message}`);
    result.updated += 1;
    result.changedUrls.push(absolute(siteBase, nbPostPath(blogId, logNo)));
  }

  return result;
}

/** IndexNow 를 실제로 보낸 뒤 호출해, 언제 알렸는지 남깁니다. */
export async function markIndexNowSent(
  client: Db,
  blogId: string,
  logNos: string[],
): Promise<void> {
  if (logNos.length === 0) return;
  await client
    .from("nb_posts")
    .update({ indexnow_at: new Date().toISOString() })
    .eq("blog_id", blogId)
    .in("log_no", logNos);
}
