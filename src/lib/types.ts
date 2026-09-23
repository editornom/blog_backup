/**
 * Supabase 스키마와 1:1 로 맞춘 수동 타입. supabase/schema.sql 을 바꾸면 여기도 같이 고칩니다.
 *
 * 주의: 아래 타입들은 전부 `interface` 가 아니라 `type` 이어야 합니다.
 * supabase-js 는 각 테이블의 Row/Insert/Update 가 `Record<string, unknown>` 을
 * 만족하길 요구하는데, 인터페이스에는 암묵적 인덱스 시그니처가 생기지 않아
 * 제약을 통과하지 못합니다. 그러면 스키마가 never 로 풀려서 모든 쿼리 결과의
 * 필드 접근이 컴파일 에러가 됩니다. `interface` 로 바꾸지 마세요.
 */

export type BlogStatus = "pending" | "verified" | "blocked";
export type PostStatus = "live" | "removed";

export type NbBlog = {
  blog_id: string;
  nickname: string | null;
  intro: string | null;
  status: BlogStatus;
  verify_code: string;
  verified_at: string | null;
  rss_sync: boolean;
  owner_note: string | null;
  created_at: string;
};

export type NbPost = {
  id: number;
  blog_id: string;
  log_no: string;
  title: string;
  excerpt: string | null;
  thumbnail: string | null;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  source_url: string;
  status: PostStatus;
  crawled_at: string;
  updated_at: string;
  indexnow_at: string | null;
};

export type NbSubmission = {
  id: number;
  blog_id: string | null;
  log_no: string | null;
  kind: "url" | "rss";
  result: "created" | "updated" | "skipped" | "rejected";
  reason: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      nb_blogs: {
        Row: NbBlog;
        Insert: Partial<NbBlog> & { blog_id: string; verify_code: string };
        Update: Partial<NbBlog>;
        // 외래키 조인을 쓰지 않지만, 이 키가 없으면 GenericTable 제약을 못 맞춥니다.
        Relationships: [];
      };
      nb_posts: {
        Row: NbPost;
        Insert: Omit<NbPost, "id" | "crawled_at" | "updated_at" | "indexnow_at"> &
          Partial<Pick<NbPost, "crawled_at" | "updated_at" | "indexnow_at">>;
        Update: Partial<NbPost>;
        Relationships: [];
      };
      nb_submissions: {
        Row: NbSubmission;
        Insert: Omit<NbSubmission, "id" | "created_at">;
        Update: Partial<NbSubmission>;
        Relationships: [];
      };
    };
    // Record<string, never> 를 쓰면 안 됩니다. supabase-js 가 Tables 와 Views 를
    // 교차시키는데, 문자열 인덱스 시그니처가 끼면 모든 테이블이 never 가 됩니다.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
