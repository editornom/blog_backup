-- NB Index 스키마
-- Supabase SQL Editor 에 그대로 붙여넣어 실행합니다. 여러 번 실행해도 안전합니다.

-- 등록된 네이버 블로그. 화이트리스트가 곧 이 테이블입니다.
-- status='verified' 인 블로그의 글만 페이지로 노출됩니다.
create table if not exists public.nb_blogs (
  blog_id     text primary key,
  nickname    text,
  intro       text,
  status      text not null default 'pending'
                check (status in ('pending', 'verified', 'blocked')),
  -- 블로그 소개글이나 최근 글에 심어 소유권을 증명하는 코드입니다.
  verify_code text not null,
  verified_at timestamptz,
  -- RSS 자동 동기화 대상 여부
  rss_sync    boolean not null default true,
  owner_note  text,
  created_at  timestamptz not null default now()
);

-- 수집된 글. 본문은 저장하지 않습니다. 발췌(excerpt)만 둡니다.
create table if not exists public.nb_posts (
  id           bigint generated always as identity primary key,
  blog_id      text not null references public.nb_blogs(blog_id) on delete cascade,
  log_no       text not null,
  title        text not null,
  excerpt      text,
  thumbnail    text,
  category     text,
  tags         text[] not null default '{}',
  published_at timestamptz,
  source_url   text not null,
  status       text not null default 'live' check (status in ('live', 'removed')),
  crawled_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- IndexNow 로 마지막에 알린 시각. 중복 핑을 막는 데 씁니다.
  indexnow_at  timestamptz,
  unique (blog_id, log_no)
);

-- 사이트맵은 updated_at 역순으로 페이지를 끊어 읽습니다.
create index if not exists nb_posts_updated_idx
  on public.nb_posts (updated_at desc) where status = 'live';

-- 블로그별 목록 페이지용
create index if not exists nb_posts_blog_published_idx
  on public.nb_posts (blog_id, published_at desc nulls last) where status = 'live';

-- 제출 이력. 남용 추적과 rate limit 근거로 씁니다.
create table if not exists public.nb_submissions (
  id         bigint generated always as identity primary key,
  blog_id    text,
  log_no     text,
  kind       text not null check (kind in ('url', 'rss')),
  result     text not null check (result in ('created', 'updated', 'skipped', 'rejected')),
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists nb_submissions_recent_idx
  on public.nb_submissions (created_at desc);

-- RLS: 모든 접근은 service_role 키를 쓰는 서버 코드만 거칩니다.
-- 정책을 하나도 만들지 않으므로 anon/authenticated 는 아무것도 읽고 쓸 수 없습니다.
alter table public.nb_blogs      enable row level security;
alter table public.nb_posts      enable row level security;
alter table public.nb_submissions enable row level security;
