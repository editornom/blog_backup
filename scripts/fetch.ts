/**
 * 화이트리스트 블로그의 RSS 를 읽어 data/posts/{blogId}.json 을 갱신합니다.
 *
 *   pnpm fetch
 *
 * RSS 는 최근 50개만 주므로 기존 레코드는 지우지 않고 합칩니다. RSS 창에서
 * 빠진 글은 그대로 두고, 한 번 본 글이 다시 RSS 에 안 나온다고 removed 로
 * 바꾸지 않습니다(창 밖으로 밀렸을 뿐일 수 있기 때문).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOGS } from "../src/config";
import { fetchRssPosts, canonicalSourceUrl } from "../src/lib/naver";
import type { BlogFile, PostRecord } from "../src/lib/store";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "posts");
mkdirSync(dir, { recursive: true });

let failed = 0;

for (const blog of BLOGS) {
  const file = join(dir, `${blog.blogId}.json`);
  const previous: BlogFile | null = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  const byLogNo = new Map((previous?.posts ?? []).map(post => [post.logNo, post]));

  const fetched = await fetchRssPosts(blog.blogId);
  if (fetched.length === 0) {
    console.warn(`! ${blog.blogId}: RSS 가 비어 있음 (유지)`);
    if (!previous) failed++;
    continue;
  }

  const now = new Date().toISOString();
  let changed = 0;
  for (const item of fetched) {
    const old = byLogNo.get(item.logNo);
    const next: PostRecord = {
      blogId: blog.blogId,
      logNo: item.logNo,
      title: item.title,
      excerpt: item.excerpt,
      thumbnail: item.thumbnail,
      category: item.category,
      tags: item.tags,
      publishedAt: item.publishedAt,
      sourceUrl: canonicalSourceUrl(item),
      status: "live",
      firstSeenAt: old?.firstSeenAt ?? now,
      updatedAt: old?.updatedAt ?? now,
      removedAt: null,
    };
    const same =
      old &&
      JSON.stringify({ ...old, updatedAt: "", firstSeenAt: "" }) ===
        JSON.stringify({ ...next, updatedAt: "", firstSeenAt: "" });
    if (!same) {
      next.updatedAt = now;
      changed++;
    }
    byLogNo.set(item.logNo, next);
  }

  if (changed === 0 && previous) {
    console.log(`= ${blog.blogId}: 변경 없음`);
    continue;
  }
  const out: BlogFile = { blogId: blog.blogId, updatedAt: now, posts: [...byLogNo.values()] };
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`+ ${blog.blogId}: ${changed}건 갱신 (총 ${out.posts.length})`);
}

if (failed > 0) process.exit(1);
