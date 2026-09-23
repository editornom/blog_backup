import {
  parseNaverBlogUrl,
  fetchRssPosts,
  fetchPostView,
  fetchBlogProfile,
  fetchPost,
  toExcerpt,
} from "../src/lib/naver";

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(
      `  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`,
    );
  }
}

console.log("\n[1] URL 파서");
check("데스크톱 정규형", parseNaverBlogUrl("https://blog.naver.com/naverofficial/224420572819"), {
  blogId: "naverofficial",
  logNo: "224420572819",
});
check("모바일", parseNaverBlogUrl("https://m.blog.naver.com/naverofficial/224420572819"), {
  blogId: "naverofficial",
  logNo: "224420572819",
});
check(
  "공유용 쿼리 붙음",
  parseNaverBlogUrl(
    "https://blog.naver.com/naverofficial/224420572819?fromRss=true&trackingCode=rss",
  ),
  { blogId: "naverofficial", logNo: "224420572819" },
);
check(
  "PostView 형태",
  parseNaverBlogUrl(
    "https://blog.naver.com/PostView.naver?blogId=naverofficial&logNo=224420572819&redirect=Dlog",
  ),
  { blogId: "naverofficial", logNo: "224420572819" },
);
check(
  "Redirect=Log 형태",
  parseNaverBlogUrl("https://blog.naver.com/naverofficial?Redirect=Log&logNo=224420572819"),
  { blogId: "naverofficial", logNo: "224420572819" },
);
check("스킴 없음", parseNaverBlogUrl("blog.naver.com/naverofficial/224420572819"), {
  blogId: "naverofficial",
  logNo: "224420572819",
});
check("블로그 홈(글번호 없음)", parseNaverBlogUrl("https://blog.naver.com/naverofficial"), null);
check("타 도메인 거부", parseNaverBlogUrl("https://tistory.com/abc/123456"), null);
check("쓰레기 입력", parseNaverBlogUrl("hello world"), null);

console.log("\n[2] 발췌 자르기");
check("짧은 글 그대로", toExcerpt("<p>안녕하세요</p>"), "안녕하세요");
check("말줄임 제거", toExcerpt("본문입니다......"), "본문입니다");
check("빈 입력", toExcerpt(null), null);
const long = toExcerpt("가".repeat(900));
check("500자 상한", long !== null && long.length <= 501, true);

console.log("\n[3] RSS 수집 (실제 네트워크)");
const rss = await fetchRssPosts("naverofficial");
console.log(`  글 ${rss.length}건 수집`);
check("50개 이하", rss.length > 0 && rss.length <= 50, true);
if (rss[0]) {
  const p = rss[0];
  console.log(`  샘플: ${p.title}`);
  console.log(
    `        발행 ${p.publishedAt} / 카테고리 ${p.category} / 태그 ${JSON.stringify(p.tags)}`,
  );
  console.log(`        썸네일 ${p.thumbnail?.slice(0, 80)}`);
  console.log(`        발췌(${p.excerpt?.length}자) ${p.excerpt?.slice(0, 60)}…`);
  check("제목 있음", p.title.length > 0, true);
  check("발행일시 파싱됨", p.publishedAt !== null, true);
  check("원문 URL 정규형", p.sourceUrl, `https://blog.naver.com/naverofficial/${p.logNo}`);
  check("썸네일 크기 승격", p.thumbnail?.includes("type=w966"), true);
  check("발췌 상한 준수", (p.excerpt?.length ?? 0) <= 501, true);
}

console.log("\n[4] PostView 폴백 (실제 네트워크)");
if (rss[0]) {
  const pv = await fetchPostView({ blogId: "naverofficial", logNo: rss[0].logNo });
  console.log(`  제목: ${pv?.title}`);
  check("글을 읽어옴", pv !== null, true);
  check("RSS 와 제목 일치", pv?.title, rss[0].title);
}
const missing = await fetchPostView({ blogId: "naverofficial", logNo: "999999999999" });
check("없는 글은 null", missing, null);

console.log("\n[5] 블로그 프로필 (소유권 검증 기반)");
const profile = await fetchBlogProfile("naverofficial");
console.log(`  닉네임: ${profile?.nickname}`);
console.log(`  소개글: ${profile?.intro}`);
check("프로필 읽힘", profile !== null, true);
check(
  "닉네임에 '네이버 블로그' 꼬리표 제거",
  profile?.nickname?.includes(": 네이버 블로그"),
  false,
);
check("소개글 존재", (profile?.intro?.length ?? 0) > 0, true);

console.log("\n[6] fetchPost 통합 경로");
if (rss[0]) {
  const one = await fetchPost({ blogId: "naverofficial", logNo: rss[0].logNo });
  check("RSS 경로로 잡힘", one?.source, "rss");
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);

// process.exit 대신 예외로 끝냅니다. 워커 런타임에는 process 가 없어
// tsconfig 에 node 타입을 넣지 않았고, tsx 는 예외를 비정상 종료로 처리합니다.
if (fail > 0) throw new Error(`수집기 검사 ${fail}건 실패`);
