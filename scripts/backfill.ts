/**
 * RSS(최근 50개) 밖으로 밀려난 옛 글을 네이버 글 목록 API 로 찾아 채웁니다.
 *
 *   pnpm backfill                      # 2026-01-01 이후, 전체 블로그
 *   pnpm backfill --since 2026-03-01   # 기준일 지정
 *   pnpm backfill --blog haionnet486   # 블로그 하나만
 *
 * 이미 data/posts 에 있는 글은 건드리지 않고, 없는 글만 PostView 로 메타를
 * 채워 넣습니다. 한 번 돌려 두면 이후엔 scripts/fetch.ts(RSS)가 이어받습니다.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOGS, FETCH_UA } from "../src/config";
import { fetchPostView, canonicalSourceUrl } from "../src/lib/naver";
import type { BlogFile, PostRecord } from "../src/lib/store";

const PAGE_SIZE = 30;
const MAX_PAGES = 100;
const DELAY_MS = 400;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const since = new Date(`${arg("since") ?? "2026-01-01"}T00:00:00+09:00`);
if (Number.isNaN(since.getTime())) throw new Error("--since 는 YYYY-MM-DD 형식이어야 합니다");
const onlyBlog = arg("blog");

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "posts");
mkdirSync(dir, { recursive: true });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ListItem {
  logNo: string;
  title: string;
  /** 목록 API 의 날짜. "2026. 10. 28." 또는 "1시간 전" 같은 상대표기. */
  addDate: string;
}

async function fetchList(blogId: string, page: number): Promise<ListItem[]> {
  const url =
    `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
    `&viewdate=&currentPage=${page}&categoryNo=0&parentCategoryNo=&countPerPage=${PAGE_SIZE}`;
  const response = await fetch(url, {
    headers: { "user-agent": FETCH_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`글 목록 HTTP ${response.status}`);
  // 네이버 응답은 pagingHtml 안에 JSON 규격에 없는 \' 를 섞어 보내서 먼저 걷어냅니다.
  const text = (await response.text()).replace(/\\'/g, "'");
  const json = JSON.parse(text) as { postList?: ListItem[] };
  return json.postList ?? [];
}

/** 절대표기만 날짜로 바꿉니다. "1시간 전" 같은 상대표기는 최근 글이라는 뜻이라 null. */
function listDate(addDate: string): Date | null {
  const match = addDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00+09:00`);
}

for (const blog of BLOGS) {
  if (onlyBlog && blog.blogId !== onlyBlog) continue;

  const file = join(dir, `${blog.blogId}.json`);
  const previous: BlogFile | null = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  const byLogNo = new Map((previous?.posts ?? []).map(post => [post.logNo, post]));

  // 1) 기준일 이후 글 목록을 최신순으로 훑습니다.
  const wanted: ListItem[] = [];
  let reachedOlder = false;
  for (let page = 1; page <= MAX_PAGES && !reachedOlder; page++) {
    const items = await fetchList(blog.blogId, page);
    if (items.length === 0) break;
    for (const item of items) {
      const date = listDate(item.addDate);
      if (date && date < since) {
        reachedOlder = true;
        continue;
      }
      wanted.push(item);
    }
    await sleep(DELAY_MS);
  }

  const missing = wanted.filter(item => !byLogNo.has(item.logNo));
  console.log(`${blog.blogId}: 기준일 이후 ${wanted.length}편, 새로 채울 글 ${missing.length}편`);

  // 2) 없는 글만 PostView 로 메타를 채웁니다.
  const now = new Date().toISOString();
  let added = 0;
  for (const item of missing) {
    const meta = await fetchPostView({ blogId: blog.blogId, logNo: item.logNo });
    await sleep(DELAY_MS);
    if (!meta) {
      console.warn(`  ! ${item.logNo}: 비공개이거나 읽을 수 없음 (건너뜀)`);
      continue;
    }
    const date = meta.publishedAt ? new Date(meta.publishedAt) : listDate(item.addDate);
    if (date && date < since) continue;

    const record: PostRecord = {
      blogId: blog.blogId,
      logNo: item.logNo,
      title: meta.title,
      excerpt: meta.excerpt,
      thumbnail: meta.thumbnail,
      category: null,
      tags: [],
      publishedAt: meta.publishedAt ?? date?.toISOString() ?? null,
      sourceUrl: canonicalSourceUrl(meta),
      status: "live",
      firstSeenAt: now,
      updatedAt: now,
      removedAt: null,
    };
    byLogNo.set(item.logNo, record);
    added++;
  }

  if (added === 0) {
    console.log(`= ${blog.blogId}: 추가된 글 없음`);
    continue;
  }
  const out: BlogFile = { blogId: blog.blogId, updatedAt: now, posts: [...byLogNo.values()] };
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`+ ${blog.blogId}: ${added}편 추가 (총 ${out.posts.length})`);
}
