# NB Index

네이버 블로그 글을 구글·빙이 수집할 수 있는 주소로 바꿔 색인을 돕는 서비스입니다.
`editornom.com/nb` 아래에서 동작합니다.

## 왜 필요한가

흔히 "네이버가 구글 크롤링을 막아서"라고 하지만, 사실이 아닙니다.
`blog.naver.com/robots.txt`는 `Yeti`(네이버 자체 봇)와 AI 학습 봇만 막고 Googlebot은 막지 않습니다.
실제 원인은 셋입니다.

1. 데스크톱 글 주소(`blog.naver.com/{id}/{logNo}`)가 **iframe 껍데기**라, 크롤러가 받는 HTML에
   본문이 거의 없습니다. 본문은 `PostView.naver` 안에 있습니다.
2. 네이버 블로그는 **외부 백링크가 거의 없어** 구글이 글의 존재를 알거나 자주 방문할 이유가 없습니다.
3. `blog.naver.com`은 내 도메인이 아니라 **구글 서치콘솔에 등록할 수 없고**, 사이트맵 제출이나
   색인 요청 수단이 아예 없습니다.

이 서비스는 2번과 3번을 해결합니다. 색인 가능한 내 도메인에 요약 페이지를 만들어 원문으로
dofollow 링크를 걸고, 그 페이지를 사이트맵과 IndexNow로 검색엔진에 알립니다.

## 게시 정책

원문 **전문을 복제하지 않습니다.** 제목, 500자 이내 발췌, 대표 이미지, 발행일, 태그, 원문 링크만
게시합니다. 전문 미러링은 구글 스팸정책의 scraped content에 해당하고 저작권 문제도 그대로
발생하기 때문입니다. 발췌 길이는 [`src/config.ts`](src/config.ts)의 `LIMITS.EXCERPT_MAX`에서 바꿉니다.

등록은 **화이트리스트**로만 열립니다. 운영자가 블로그를 등록해 연동코드를 발급하고, 블로그 주인이
그 코드를 소개글이나 최근 글에 넣어야 소유권이 확인됩니다.

## 구조

| 경로                   | 역할                                             |
| ---------------------- | ------------------------------------------------ |
| `/`                    | 랜딩 + 글 제출 폼 (정적)                         |
| `/nb`                  | 전체 색인 목록 (SSR)                             |
| `/nb/{blogId}`         | 블로그별 글 목록 (SSR)                           |
| `/nb/{blogId}/{logNo}` | 글 요약 페이지 — 실제로 색인되는 대상 (SSR)      |
| `/nb/about`            | 운영 원칙·삭제 요청 안내 (정적)                  |
| `/api/submit`          | 글 1건 또는 RSS 50건 제출                        |
| `/api/blogs`           | 블로그 등록(운영자) / 소유권 검증 / 차단(운영자) |
| `/api/sync`            | 전체 RSS 재수집 (운영자, 크론용)                 |
| `/sitemap.xml`         | 사이트맵 인덱스                                  |
| `/{INDEXNOW_KEY}.txt`  | IndexNow 키 파일                                 |

핵심 로직은 [`src/lib/naver.ts`](src/lib/naver.ts)에 모여 있습니다. 수집은 **RSS 우선**입니다.
`rss.blog.naver.com/{blogId}.xml`이 최근 50개 글의 제목·카테고리·태그·발행일시·발췌·썸네일을
전부 주기 때문에 HTML 파싱보다 정확합니다. RSS 창 밖의 오래된 글만 `PostView.naver`로 떨어집니다.

## 최초 설정

### 1. Supabase

[`supabase/schema.sql`](supabase/schema.sql)을 Supabase SQL Editor에 붙여넣어 실행합니다.
RLS는 켜두고 정책을 만들지 않습니다 — 모든 접근은 service_role 키를 쓰는 서버 코드만 거칩니다.

### 2. 환경변수

Cloudflare Pages 프로젝트(`editornom`)의 **Settings → Environment variables**에 등록합니다.
로컬에서는 `.dev.vars`에 같은 값을 둡니다(`.env.example` 참고).

| 이름                        | 설명                                       |
| --------------------------- | ------------------------------------------ |
| `PUBLIC_SITE_URL`           | `https://editornom.com` (끝 슬래시 없이)   |
| `SUPABASE_URL`              | Supabase 프로젝트 URL                      |
| `SUPABASE_SERVICE_ROLE_KEY` | **비밀.** Settings → API → service_role    |
| `INDEXNOW_KEY`              | 32자 이상 영숫자. 아무렇게나 만들면 됩니다 |
| `ADMIN_TOKEN`               | **비밀.** 운영자 엔드포인트 인증용         |

`INDEXNOW_KEY`는 이렇게 만들 수 있습니다:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3. 검색엔진 등록

- 구글 서치콘솔에 `editornom.com`을 등록하고 사이트맵으로 `https://editornom.com/sitemap.xml`을 제출합니다.
- 빙 웹마스터도 같은 사이트맵을 제출합니다. IndexNow는 키 파일이 노출되면 자동으로 동작합니다.

### 4. 크론

GitHub 저장소 **Settings → Secrets → Actions**에 `ADMIN_TOKEN`을 넣으면
[`.github/workflows/sync.yml`](.github/workflows/sync.yml)이 6시간마다 RSS를 다시 훑습니다.
도메인이 다르면 저장소 변수 `SITE_URL`을 설정하세요.

## 운영

### 블로그 등록 (운영자)

```bash
curl -X POST https://editornom.com/api/blogs \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"action":"register","blogId":"내블로그아이디"}'
```

응답으로 `NBIDX-XXXXXXXX` 형태의 연동코드가 나옵니다.

### 소유권 검증 (블로그 주인)

연동코드를 블로그 **소개글**이나 **최근 글(RSS 50개 이내)**에 넣은 뒤:

```bash
curl -X POST https://editornom.com/api/blogs \
  -H "content-type: application/json" \
  -d '{"action":"verify","blogId":"내블로그아이디"}'
```

이 엔드포인트만 토큰 없이 열려 있습니다. 블로그에 코드를 심을 수 있는 사람은 주인뿐이라,
그 행위 자체가 인증이기 때문입니다.

### 글 제출

```bash
# 글 1건
curl -X POST https://editornom.com/api/submit \
  -H "content-type: application/json" \
  -d '{"url":"https://blog.naver.com/내아이디/223456789012"}'

# RSS 최근 50개 한 번에
curl -X POST https://editornom.com/api/submit \
  -H "content-type: application/json" \
  -d '{"mode":"rss","blogId":"내아이디"}'
```

하루 한도는 URL 60건, RSS 3회입니다([`src/pages/api/submit.ts`](src/pages/api/submit.ts)의 `DAILY_LIMIT`).

### 삭제 요청 처리 (운영자)

```bash
curl -X POST https://editornom.com/api/blogs \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"action":"block","blogId":"대상아이디"}'
```

블로그를 차단하고 해당 블로그 글을 모두 즉시 내립니다.

## 개발

```bash
pnpm install
pnpm dev              # astro dev
pnpm preview          # 빌드 후 Cloudflare Workers 런타임으로 로컬 구동
pnpm build            # astro check + build
pnpm run test:crawler # 실제 네이버를 상대로 수집기 검사
pnpm deploy           # Cloudflare Pages 배포
```

`test:crawler`는 네이버 공식블로그를 상대로 실제 요청을 보냅니다. 네이버가 RSS나 HTML 구조를
바꾸면 여기가 먼저 깨지므로, 수집이 이상할 때 가장 먼저 돌려볼 검사입니다.

## 알려진 한계

- **색인은 보장되지 않습니다.** 구글은 IndexNow를 받지 않아, 구글 쪽 신호는 사이트맵 lastmod와
  내부 링크뿐입니다. 색인 여부와 시점은 전적으로 구글이 정합니다.
- **RSS는 최근 50개만** 줍니다. 그보다 오래된 글은 `PostView.naver` 폴백으로 1건씩 넣어야 하고,
  이 경로는 발행일을 못 읽는 경우가 있습니다(상대표기 "N분 전").
- **비공개·삭제된 글**은 다음 동기화에서 자동으로 내려가지만, 그 사이에는 페이지가 남아 있습니다.
- 구글이 이 페이지들을 얇은 콘텐츠로 판단할 여지는 남아 있습니다. 발췌를 늘리는 방향으로 대응하면
  scraped content 쪽 위험이 커지므로, 늘리기 전에 두 리스크를 같이 재검토하세요.
