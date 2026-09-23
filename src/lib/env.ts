/**
 * 환경변수 해석기.
 *
 * Cloudflare Pages 에서는 시크릿이 빌드타임 `import.meta.env` 가 아니라
 * 요청마다 주어지는 `locals.runtime.env` 로 들어옵니다. 반면 `astro dev` 나
 * 노드 스크립트에서는 `import.meta.env` / `process.env` 를 봐야 합니다.
 * 세 곳을 순서대로 훑어서 어디서 돌든 같은 코드가 동작하게 합니다.
 */
type MaybeLocals = { runtime?: { env?: Record<string, unknown> } } | undefined;

export function getEnv(locals: MaybeLocals, key: string): string | undefined {
  const fromRuntime = locals?.runtime?.env?.[key];
  if (typeof fromRuntime === "string" && fromRuntime.length > 0) return fromRuntime;

  const fromImport = (import.meta.env as Record<string, unknown>)[key];
  if (typeof fromImport === "string" && fromImport.length > 0) return fromImport;

  // Workers 런타임에는 process 가 없습니다. @types/node 를 끌어오지 않으려고
  // globalThis 를 통해 조심스럽게 들여다봅니다(노드 스크립트에서만 잡힙니다).
  const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const fromProcess = nodeProcess?.env?.[key];
  if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;

  return undefined;
}

export function requireEnv(locals: MaybeLocals, key: string): string {
  const value = getEnv(locals, key);
  if (!value) {
    throw new Error(
      `필수 환경변수 ${key} 가 없습니다. .dev.vars(로컬) 또는 Cloudflare Pages 시크릿을 확인하세요.`,
    );
  }
  return value;
}

/** 관리자 엔드포인트 인증. Authorization: Bearer <ADMIN_TOKEN> 을 기대합니다. */
export function isAdmin(request: Request, locals: MaybeLocals): boolean {
  const expected = getEnv(locals, "ADMIN_TOKEN");
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  // 길이가 다르면 즉시 false 라 타이밍 노출이 있지만, 토큰 길이는 비밀이 아닙니다.
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function siteUrl(locals: MaybeLocals): string {
  return (getEnv(locals, "PUBLIC_SITE_URL") ?? "https://editornom.com").replace(/\/$/, "");
}
