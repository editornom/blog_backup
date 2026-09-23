import { NB_BASE } from "../config";

/** 서비스가 만들어내는 색인용 페이지 주소. 이 한 곳에서만 경로를 정합니다. */
export function nbPostPath(blogId: string, logNo: string): string {
  return `${NB_BASE}/${blogId}/${logNo}`;
}

export function nbBlogPath(blogId: string): string {
  return `${NB_BASE}/${blogId}`;
}

export function absolute(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path}`;
}

/** 사람이 읽는 날짜 표기(KST). 날짜를 모르면 빈 문자열입니다. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}
