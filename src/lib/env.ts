/**
 * 환경변수 해석기.
 *
 * 정적 빌드라 런타임 환경변수는 없습니다. 빌드 시점의 `import.meta.env`(Astro/Vite)와
 * `process.env`(노드 스크립트) 두 곳만 봅니다.
 */
export function getEnv(key: string): string | undefined {
  const viteEnv = (import.meta as { env?: Record<string, unknown> }).env;
  const fromVite = viteEnv?.[key];
  if (typeof fromVite === "string" && fromVite.length > 0) return fromVite;

  const fromProcess = process.env?.[key];
  if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;

  return undefined;
}

/** 배포 도메인. 환경변수가 없으면 config 의 기본값을 씁니다. */
export function siteUrl(): string {
  return (getEnv("PUBLIC_SITE_URL") ?? "https://editornom.com").replace(/\/$/, "");
}
