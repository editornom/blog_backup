import { BLOGS, findBlog } from "../config";

/**
 * 저장소에 커밋되는 글 레코드.
 *
 * 본문은 저장하지 않습니다. 발췌(excerpt)만 둡니다.
 * 파일 위치는 data/posts/{blogId}.json 이며, 수집은 scripts/fetch.ts 가,
 * 읽기는 빌드 시 이 모듈이 담당합니다.
 */
export interface PostRecord {
  blogId: string;
  logNo: string;
  title: string;
  excerpt: string | null;
  thumbnail: string | null;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
  sourceUrl: string;
  /**
   * removed 는 원문이 내려갔다는 뜻입니다. 페이지는 그대로 유지합니다.
   * 요약은 여전히 유효하고, 색인을 뺄 이유가 없기 때문입니다.
   */
  status: "live" | "removed";
  firstSeenAt: string;
  updatedAt: string;
  removedAt: string | null;
}

export interface BlogFile {
  blogId: string;
  updatedAt: string;
  posts: PostRecord[];
}

// 빌드 시점에 JSON 을 전부 읽어들입니다. 파일이 하나도 없어도(최초 수집 전)
// 빈 객체가 되어 빌드는 그대로 통과합니다.
const files = import.meta.glob<{ default: BlogFile }>("../../data/posts/*.json", {
  eager: true,
});

function loadAll(): PostRecord[] {
  const all: PostRecord[] = [];
  for (const module of Object.values(files)) {
    const file = module.default;
    if (!file?.posts) continue;
    // 화이트리스트에서 빠진 블로그의 JSON 이 남아 있어도 노출하지 않습니다.
    if (!findBlog(file.blogId)) continue;
    all.push(...file.posts);
  }
  return all;
}

const ALL_POSTS = loadAll();

/**
 * 목록 정렬 기준.
 * 원문이 내려간 글(removed)은 살아 있는 글 뒤로 밀고, 그 안에서 최신순입니다.
 */
function compare(a: PostRecord, b: PostRecord): number {
  if (a.status !== b.status) return a.status === "live" ? -1 : 1;
  const left = a.publishedAt ?? a.firstSeenAt;
  const right = b.publishedAt ?? b.firstSeenAt;
  return right.localeCompare(left);
}

export function allPosts(): PostRecord[] {
  return [...ALL_POSTS].sort(compare);
}

export function postsOf(blogId: string): PostRecord[] {
  return ALL_POSTS.filter(post => post.blogId === blogId).sort(compare);
}

export function findPost(blogId: string, logNo: string): PostRecord | undefined {
  return ALL_POSTS.find(post => post.blogId === blogId && post.logNo === logNo);
}

/** 사이트맵과 목록에 쓰는 통계. */
export function stats() {
  const live = ALL_POSTS.filter(post => post.status === "live").length;
  return {
    total: ALL_POSTS.length,
    live,
    removed: ALL_POSTS.length - live,
    blogs: BLOGS.length,
  };
}
