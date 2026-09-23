/**
 * 오프라인 검사. 네트워크를 타지 않고 tests/fixtures 에 저장해 둔
 * 실제 네이버 응답 샘플로만 돌기 때문에, CI 에서 매번 돌려도
 * 네이버 사정으로 빨간불이 뜨지 않습니다.
 *
 * 네이버가 구조를 바꿨는지 보려면 tests/naver.live.test.ts 를 쓰세요.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseNaverBlogUrl,
  parseRssXml,
  parsePostViewHtml,
  toExcerpt,
  canonicalSourceUrl,
  mobileSourceUrl,
  makeVerifyCode,
} from "../src/lib/naver";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const read = (name: string) => readFileSync(join(fixtures, name), "utf8");
const meta = JSON.parse(read("meta.json")) as {
  recentLogNo: string;
  oldLogNo: string;
  oldPublishedAt: string;
};

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(
      `  FAIL ${name}\n       기대 ${JSON.stringify(expected)}\n       실제 ${JSON.stringify(actual)}`,
    );
  }
}

console.log("\n[1] URL 파서");
const cases: [string, string, unknown][] = [
  [
    "데스크톱 정규형",
    "https://blog.naver.com/abc/223456789012",
    { blogId: "abc", logNo: "223456789012" },
  ],
  ["모바일", "https://m.blog.naver.com/abc/223456789012", { blogId: "abc", logNo: "223456789012" }],
  [
    "RSS 추적 파라미터",
    "https://blog.naver.com/abc/223456789012?fromRss=true&trackingCode=rss",
    { blogId: "abc", logNo: "223456789012" },
  ],
  [
    "PostView 쿼리",
    "https://blog.naver.com/PostView.naver?blogId=abc&logNo=223456789012",
    { blogId: "abc", logNo: "223456789012" },
  ],
  [
    "Redirect=Log 쿼리",
    "https://blog.naver.com/abc?Redirect=Log&logNo=223456789012",
    { blogId: "abc", logNo: "223456789012" },
  ],
  [
    "대문자 쿼리키",
    "https://blog.naver.com/PostView.naver?BlogId=abc&LogNo=223456789012",
    { blogId: "abc", logNo: "223456789012" },
  ],
  ["구 blog.me", "https://abc.blog.me/223456789012", { blogId: "abc", logNo: "223456789012" }],
  ["스킴 생략", "blog.naver.com/abc/223456789012", { blogId: "abc", logNo: "223456789012" }],
  ["블로그 홈은 거부", "https://blog.naver.com/abc", null],
  ["글번호가 짧으면 거부", "https://blog.naver.com/abc/123", null],
  ["타 도메인 거부", "https://tistory.com/abc/223456789012", null],
  ["빈 문자열 거부", "", null],
  ["쓰레기 입력 거부", "안녕하세요", null],
];
for (const [name, input, expected] of cases) check(name, parseNaverBlogUrl(input), expected);

console.log("\n[2] 발췌");
check("HTML 태그 제거", toExcerpt("<p>안녕<b>하세요</b></p>"), "안녕 하세요");
check("엔티티 해제", toExcerpt("A &amp; B"), "A & B");
check("네이버 말줄임 제거", toExcerpt("본문입니다......"), "본문입니다");
check("빈 입력", toExcerpt(null), null);
check("공백만 있으면 null", toExcerpt("   "), null);
const long = toExcerpt("가".repeat(900));
check("500자 상한", (long ?? "").length <= 501, true);
check("잘린 경우 말줄임표", (long ?? "").endsWith("…"), true);

console.log("\n[3] 원문 주소 조립");
check(
  "데스크톱",
  canonicalSourceUrl({ blogId: "abc", logNo: "1" }),
  "https://blog.naver.com/abc/1",
);
check("모바일", mobileSourceUrl({ blogId: "abc", logNo: "1" }), "https://m.blog.naver.com/abc/1");

console.log("\n[4] RSS 파싱 (저장된 샘플)");
const posts = parseRssXml(read("rss-naverofficial.xml"), "naverofficial");
check("3건 파싱", posts.length, 3);
const first = posts[0];
check("logNo 추출", first.logNo, meta.recentLogNo);
check("제목의 작은따옴표 보존", first.title.includes("'추석'"), true);
check("카테고리", typeof first.category === "string" && first.category.length > 0, true);
check("태그 배열", Array.isArray(first.tags) && first.tags.length > 0, true);
check("발행일시 ISO", /^\d{4}-\d{2}-\d{2}T/.test(first.publishedAt ?? ""), true);
check("썸네일 크기 승격", first.thumbnail?.includes("type=w966"), true);
check("발췌에 img 태그 안 남음", first.excerpt?.includes("<img"), false);
check("출처 표시", first.source, "rss");
check(
  "다른 블로그 id 로 파싱하면 전부 버림",
  parseRssXml(read("rss-naverofficial.xml"), "다른아이디").length,
  0,
);

console.log("\n[5] PostView 파싱 (저장된 샘플)");
const recent = parsePostViewHtml(read("postview-naverofficial.html"), {
  blogId: "naverofficial",
  logNo: meta.recentLogNo,
});
check("글을 읽음", recent !== null, true);
check(
  "작은따옴표 낀 제목이 안 잘림",
  recent?.title,
  "[스페셜로고] '추석' 로고 제작 이야기 - 전현주 작가",
);
check("상대표기 날짜는 null", recent?.publishedAt, null);
check("출처 표시", recent?.source, "postview");

const old = parsePostViewHtml(read("postview-old-post.html"), {
  blogId: "naverofficial",
  logNo: meta.oldLogNo,
});
check("절대표기 날짜를 KST→UTC 로 환산", old?.publishedAt, meta.oldPublishedAt);

const priv = parsePostViewHtml(read("postview-private.html"), {
  blogId: "naverofficial",
  logNo: "224420572819",
});
check("og:url 이 글이 아니면 null (비공개·삭제)", priv, null);
check("빈 HTML 은 null", parsePostViewHtml("", { blogId: "a", logNo: "1" }), null);

console.log("\n[6] 연동코드");
const code = makeVerifyCode();
check("접두사", code.startsWith("NBIDX-"), true);
check("길이", code.length, 14);
check("헷갈리는 글자 제외(0/O/1/I)", /[01OI]/.test(code.slice(6)), false);
check(
  "매번 다름",
  makeVerifyCode() !== makeVerifyCode() || makeVerifyCode() !== makeVerifyCode(),
  true,
);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail > 0) throw new Error(`오프라인 검사 ${fail}건 실패`);
