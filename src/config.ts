/**
 * 서비스 전역 상수. 이름/도메인만 바꾸면 그대로 다른 브랜드로 돌릴 수 있게
 * 문자열을 전부 여기 모아둡니다.
 */
export const SITE = {
  url: "https://editornom.com",
  name: "NB Index",
  tagline: "네이버 블로그를 구글이 찾을 수 있게",
  description:
    "네이버 블로그 글을 구글·빙이 수집할 수 있는 주소로 바꿔 색인을 돕습니다. 요약과 원문 링크만 게시하며 본문은 복제하지 않습니다.",
  locale: "ko_KR",
  lang: "ko",
} as const;

/** /nb 아래로만 서비스가 존재합니다. 기존/향후 다른 경로와 섞이지 않게 고정합니다. */
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
  /** 사이트맵 1개 파일당 URL 수. 구글 상한은 50,000 이지만 여유를 둡니다. */
  SITEMAP_PAGE_SIZE: 5000,
  /** 목록 페이지네이션 */
  LIST_PAGE_SIZE: 20,
  /** 같은 글을 다시 수집하기까지의 최소 간격(시간) */
  RECRAWL_HOURS: 12,
} as const;

/** 네이버 요청에 쓰는 UA. 크롤러임을 숨기지 않습니다. */
export const FETCH_UA = "Mozilla/5.0 (compatible; NBIndexBot/1.0; +https://editornom.com/nb/about)";
