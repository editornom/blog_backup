import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import type { Database } from "./types";

type MaybeLocals = { runtime?: { env?: Record<string, unknown> } } | undefined;

function createDbClient(url: string, serviceKey: string) {
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 클라이언트 타입은 반드시 추론된 것을 씁니다.
 * `SupabaseClient<Database>` 라고 직접 적으면 스키마 제네릭이 채워지지 않아
 * 모든 쿼리 결과가 never 로 풀립니다.
 */
export type Db = ReturnType<typeof createDbClient>;

/**
 * 서버 전용 Supabase 클라이언트.
 * service_role 키를 쓰므로 RLS 를 우회합니다. 절대 클라이언트 번들로
 * 넘어가면 안 되며, 이 모듈은 .astro 프론트매터와 API 라우트에서만 import 합니다.
 */
export function db(locals: MaybeLocals): Db {
  return createDbClient(
    requireEnv(locals, "SUPABASE_URL"),
    requireEnv(locals, "SUPABASE_SERVICE_ROLE_KEY"),
  );
}
