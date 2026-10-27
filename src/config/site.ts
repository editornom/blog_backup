/**
 * 서비스 전역 상수. 이름/도메인만 바꾸면 그대로 다른 브랜드로 돌릴 수 있게
 * 문자열을 전부 여기 모아둡니다.
 */
export const SITE = {
  url: "https://editornom.com",
  name: "하이온넷 블로그 모음",
  tagline: "하이온넷 계열 네이버 블로그 모음",
  description:
    "하이온넷이 운영하는 네이버 블로그 7곳의 소개와 최근 글 요약, 원문 링크를 한곳에 모았습니다. 본문은 복제하지 않고 원문으로 연결합니다.",
  locale: "ko_KR",
  lang: "ko",
} as const;

/** 서비스가 만들어내는 페이지는 전부 이 경로 아래에 있습니다. */
export const NB_BASE = "/nb";

export const LIMITS = {
  /**
   * 페이지에 싣는 발췌 최대 길이(자).
   * 원문 전문 복제는 구글 스팸정책(scraped content)에 걸리므로 의도적으로 짧게 자릅니다.
   * 이 값을 키울 때는 저작권·중복콘텐츠 리스크를 같이 재검토하세요.
   */
  EXCERPT_MAX: 500,
  /** 네이버 RSS 가 한 번에 주는 최대 글 수. 네이버가 정한 값이라 늘릴 수 없습니다. */
  RSS_MAX_ITEMS: 50,
  /** 랜딩에 보여줄 최근 글 수 */
  HOME_RECENT: 30,
} as const;

/** 네이버 요청에 쓰는 UA. 크롤러임을 숨기지 않습니다. */
export const FETCH_UA = "Mozilla/5.0 (compatible; NBIndexBot/1.0; +https://editornom.com/nb/about)";
