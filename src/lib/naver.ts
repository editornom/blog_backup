import { FETCH_UA, LIMITS } from "../config";

export interface NaverRef {
  blogId: string;
  logNo: string;
}

export interface NaverPostMeta extends NaverRef {
  title: string;
  excerpt: string | null;
  thumbnail: string | null;
  category: string | null;
  tags: string[];
  /** ISO 문자열. 확정할 수 없으면 null 로 두고 저장 시점에 지어내지 않습니다. */
  publishedAt: string | null;
  sourceUrl: string;
  /** 어디서 긁었는지. RSS 가 항상 더 정확합니다. */
  source: "rss" | "postview";
}

/** 네이버 블로그 아이디로 받아들일 수 있는 형태. 경로 조각과 구분하는 데도 씁니다. */
const BLOG_ID_RE = /^[A-Za-z0-9_-]{2,40}$/;
const RESERVED_SEGMENTS = new Set([
  "postview.naver",
  "postview.nhn",
  "postlist.naver",
  "postlist.nhn",
  "prologue",
  "guestbook",
]);

function isBlogId(value: string | undefined | null): value is string {
  if (!value) return false;
  if (RESERVED_SEGMENTS.has(value.toLowerCase())) return false;
  return BLOG_ID_RE.test(value);
}

/**
 * 사용자가 붙여넣는 온갖 형태의 네이버 블로그 주소에서 blogId/logNo 를 뽑습니다.
 *
 * 지원: blog.naver.com/{id}/{logNo}, m.blog.naver.com/{id}/{logNo},
 *       PostView.naver?blogId=&logNo=, ?Redirect=Log&logNo=, {id}.blog.me/{logNo}
 * 단축주소(naver.me)는 리다이렉트를 먼저 풀어야 하므로 resolveNaverUrl 을 쓰세요.
 */
export function parseNaverBlogUrl(input: string): NaverRef | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const isNaverBlogHost =
    host === "blog.naver.com" || host === "m.blog.naver.com" || host.endsWith(".blog.me");
  if (!isNaverBlogHost) return null;

  // 쿼리 키는 blogId/blogid/BlogId 가 섞여 들어오므로 소문자로 다시 색인합니다.
  const query = new Map<string, string>();
  url.searchParams.forEach((value, key) => query.set(key.toLowerCase(), value));

  const segments = url.pathname.split("/").filter(Boolean);

  const blogId =
    query.get("blogid") ??
    (host.endsWith(".blog.me") ? host.replace(/\.blog\.me$/, "") : undefined) ??
    (isBlogId(segments[0]) ? segments[0] : undefined);

  const logNo =
    query.get("logno") ??
    segments.find((segment, index) => index > 0 && /^\d{6,}$/.test(segment)) ??
    (host.endsWith(".blog.me") && /^\d{6,}$/.test(segments[0] ?? "") ? segments[0] : undefined);

  if (!isBlogId(blogId) || !logNo || !/^\d{6,}$/.test(logNo)) return null;
  return { blogId, logNo };
}

/**
 * naver.me 단축주소를 실제 주소로 편 뒤 파싱합니다.
 * 홉 수를 제한해 리다이렉트 루프에 갇히지 않게 합니다.
 */
export async function resolveNaverUrl(input: string, maxHops = 3): Promise<NaverRef | null> {
  const direct = parseNaverBlogUrl(input);
  if (direct) return direct;

  let current = input.trim();
  if (!/^https?:\/\//i.test(current)) current = `https://${current}`;

  let host: string;
  try {
    host = new URL(current).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host !== "naver.me" && host !== "m.site.naver.com") return null;

  for (let hop = 0; hop < maxHops; hop++) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": FETCH_UA },
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get("location");
    if (!location) return null;
    current = new URL(location, current).toString();
    const parsed = parseNaverBlogUrl(current);
    if (parsed) return parsed;
  }
  return null;
}

/** 정규 원문 주소. 추적 파라미터를 뗀 형태로 통일합니다. */
export function canonicalSourceUrl({ blogId, logNo }: NaverRef): string {
  return `https://blog.naver.com/${blogId}/${logNo}`;
}

export function mobileSourceUrl({ blogId, logNo }: NaverRef): string {
  return `https://m.blog.naver.com/${blogId}/${logNo}`;
}

// ---------------------------------------------------------------- XML / HTML

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function unwrapCdata(value: string): string {
  const match = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1] : decodeEntities(value);
}

function xmlTag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? unwrapCdata(match[1]) : null;
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 발췌를 LIMITS.EXCERPT_MAX 자로 자릅니다.
 * 네이버 RSS 는 본문 끝에 "......" 를 붙여 보내므로 같이 정리합니다.
 */
export function toExcerpt(html: string | null): string | null {
  if (!html) return null;
  const text = stripHtml(html)
    .replace(/\.{3,}\s*$/, "")
    .trim();
  if (!text) return null;
  if (text.length <= LIMITS.EXCERPT_MAX) return text;

  const cut = text.slice(0, LIMITS.EXCERPT_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > LIMITS.EXCERPT_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trim()}…`;
}

/** 네이버 썸네일 크기는 ?type= 이 정합니다. RSS 기본값(s3)은 카드에 쓰기엔 너무 작습니다. */
function upscaleThumbnail(src: string | null): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.searchParams.has("type")) url.searchParams.set("type", "w966");
    return url.toString();
  } catch {
    return src;
  }
}

function firstImageSrc(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? decodeEntities(match[1]) : null;
}

function metaContent(html: string, property: string): string | null {
  // 값을 감싼 따옴표를 역참조로 되짚습니다. [^"']* 로 잡으면
  // 제목 안의 작은따옴표(예: '추석' 로고)에서 값이 잘려 나갑니다.
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*?content=(["'])([\\s\\S]*?)\\1`,
    "i",
  );
  const forwardMatch = html.match(forward);
  if (forwardMatch) return decodeEntities(forwardMatch[2]);

  // content 가 property 보다 앞에 오는 순서도 섞여 있습니다.
  const reversed = new RegExp(
    `<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]*?(?:property|name)=["']${property}["']`,
    "i",
  );
  const reversedMatch = html.match(reversed);
  return reversedMatch ? decodeEntities(reversedMatch[2]) : null;
}

// ------------------------------------------------------------------- 수집

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { "user-agent": FETCH_UA, accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return await response.text();
}

/**
 * 블로그 RSS(최근 50개)를 읽습니다. 제목·카테고리·태그·발행일시·발췌·썸네일이
 * 전부 들어있어 PostView 를 긁는 것보다 정확하고 가볍습니다.
 */
export async function fetchRssPosts(blogId: string): Promise<NaverPostMeta[]> {
  const xml = await fetchText(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`);
  if (!xml) return [];
  return parseRssXml(xml, blogId);
}

/**
 * RSS XML → 글 메타. 네트워크와 분리해 둔 순수 함수입니다.
 * 저장해 둔 샘플로 오프라인 검사를 돌릴 수 있게 하려는 목적입니다.
 */
export function parseRssXml(xml: string, blogId: string): NaverPostMeta[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const posts: NaverPostMeta[] = [];

  for (const item of items.slice(0, LIMITS.RSS_MAX_ITEMS)) {
    const link = xmlTag(item, "link") ?? xmlTag(item, "guid");
    if (!link) continue;

    const ref = parseNaverBlogUrl(link);
    if (!ref || ref.blogId !== blogId) continue;

    const title = xmlTag(item, "title");
    if (!title) continue;

    const description = xmlTag(item, "description");
    const pubDate = xmlTag(item, "pubDate");
    const parsedDate = pubDate ? new Date(pubDate) : null;
    const tagField = xmlTag(item, "tag");

    posts.push({
      ...ref,
      title: title.trim(),
      excerpt: toExcerpt(description),
      thumbnail: upscaleThumbnail(firstImageSrc(description)),
      category: xmlTag(item, "category")?.trim() || null,
      tags: tagField
        ? tagField
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        : [],
      publishedAt:
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      sourceUrl: canonicalSourceUrl(ref),
      source: "rss",
    });
  }
  return posts;
}

/**
 * RSS 창(최근 50개) 밖의 오래된 글용 폴백.
 *
 * 데스크톱 글 주소는 iframe 껍데기라 본문이 없습니다. iframe 안쪽인
 * PostView.naver 를 직접 부르면 og 메타가 들어있는 완전한 HTML 이 옵니다.
 * 다만 이 응답에는 절대 발행일시가 없을 때가 많아(최근 글은 "N분 전" 상대표기)
 * publishedAt 을 확정하지 못하면 null 로 남깁니다.
 */
export async function fetchPostView(ref: NaverRef): Promise<NaverPostMeta | null> {
  const url =
    `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(ref.blogId)}` +
    `&logNo=${encodeURIComponent(ref.logNo)}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
  const html = await fetchText(url);
  if (!html) return null;
  return parsePostViewHtml(html, ref);
}

/**
 * PostView HTML → 글 메타. fetchRssPosts 와 마찬가지로 순수 함수로 떼어
 * 저장해 둔 샘플로 검사할 수 있게 합니다.
 */
export function parsePostViewHtml(html: string, ref: NaverRef): NaverPostMeta | null {
  const title = metaContent(html, "og:title");
  if (!title) return null;

  // 비공개·삭제된 글은 og:url 이 글 주소가 아니라 블로그 홈으로 옵니다.
  const ogUrl = metaContent(html, "og:url");
  if (ogUrl && !ogUrl.includes(ref.logNo)) return null;

  return {
    ...ref,
    title: title.trim(),
    excerpt: toExcerpt(metaContent(html, "og:description")),
    thumbnail: upscaleThumbnail(metaContent(html, "og:image")),
    category: null,
    tags: [],
    publishedAt: parsePublishDate(html),
    sourceUrl: canonicalSourceUrl(ref),
    source: "postview",
  };
}

/**
 * PostView 의 se_publishDate 는 "2026. 3. 12. 10:30" 같은 절대표기와
 * "24분 전" 같은 상대표기가 섞여 나옵니다. 절대표기만 신뢰하고,
 * 상대표기는 RSS 가 채워줄 때까지 null 로 둡니다.
 */
function parsePublishDate(html: string): string | null {
  const match = html.match(/class="se_publishDate[^"]*"[^>]*>([^<]+)</);
  const text = match?.[1]?.trim();
  if (!text) return null;

  const absolute = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{1,2}):(\d{2}))?/);
  if (!absolute) return null;

  const [, year, month, day, hour, minute] = absolute;
  // 네이버 표기는 KST 기준입니다. 시에서 9를 빼 UTC 로 환산합니다.
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? "0") - 9,
    Number(minute ?? "0"),
  );
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/** 글 1건을 가져옵니다. RSS 를 먼저 보고, 없으면 PostView 로 떨어집니다. */
export async function fetchPost(ref: NaverRef): Promise<NaverPostMeta | null> {
  const rssPosts = await fetchRssPosts(ref.blogId);
  const fromRss = rssPosts.find(post => post.logNo === ref.logNo);
  if (fromRss) return fromRss;
  return await fetchPostView(ref);
}

// --------------------------------------------------------------- 소유권 검증

export interface BlogProfile {
  blogId: string;
  nickname: string | null;
  intro: string | null;
}

/** m.blog 의 og 메타에 블로그명과 소개글이 실려 옵니다. 데스크톱 주소는 껍데기라 비어 있습니다. */
export async function fetchBlogProfile(blogId: string): Promise<BlogProfile | null> {
  const html = await fetchText(`https://m.blog.naver.com/${encodeURIComponent(blogId)}`);
  if (!html) return null;

  const title = metaContent(html, "og:title");
  if (!title) return null;

  return {
    blogId,
    // og:title 은 "블로그명 : 네이버 블로그" 형태로 옵니다.
    nickname: title.replace(/\s*:\s*네이버 블로그\s*$/, "").trim() || null,
    intro: metaContent(html, "og:description"),
  };
}

/**
 * 연동코드 소유권 검증.
 *
 * 남의 글이 멋대로 올라가는 걸 막는 유일한 장치라 통과 조건을 좁게 잡습니다.
 * 코드를 넣을 수 있는 곳은 블로그 주인만 고칠 수 있는 두 군데뿐입니다.
 *  1) 블로그 소개글(프로필 설명)
 *  2) 최근 글(RSS 50개)의 제목 또는 본문
 */
export async function verifyOwnership(
  blogId: string,
  code: string,
): Promise<{ ok: boolean; via: "intro" | "post" | null; profile: BlogProfile | null }> {
  const profile = await fetchBlogProfile(blogId);
  if (profile?.intro?.includes(code)) return { ok: true, via: "intro", profile };

  const posts = await fetchRssPosts(blogId);
  const hit = posts.some(post => post.title.includes(code) || (post.excerpt ?? "").includes(code));
  return { ok: hit, via: hit ? "post" : null, profile };
}

/** 블로그마다 고정으로 발급되는 연동코드. 사람이 옮겨 적을 수 있게 짧게 유지합니다. */
export function makeVerifyCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O, 1/I 는 헷갈려서 뺍니다
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `NBIDX-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")}`;
}
