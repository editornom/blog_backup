# 하이온넷 블로그 모음

하이온넷이 운영하는 네이버 블로그 7곳을 소개하고, 최근 글의 제목·요약·원문 링크를 모아 보여주는
정적 사이트입니다. 모든 페이지가 네이버 블로그 원문으로 링크를 겁니다.

본문은 복제하지 않습니다. 제목, 500자 이내 발췌, 대표 이미지, 발행일, 태그, 원문 링크만 게시합니다.

## 구조

| 경로                   | 역할                                         |
| ---------------------- | -------------------------------------------- |
| `/`                    | 블로그 7곳 소개 + 최근 글                    |
| `/nb/{blogId}`         | 블로그별 글 목록                             |
| `/nb/{blogId}/{logNo}` | 글 요약 페이지 (원문 링크 포함)              |
| `/nb/about`            | 운영 원칙 안내                               |
| `/sitemap.xml`         | 사이트맵                                     |
| `/{INDEXNOW_KEY}.txt`  | IndexNow 키 파일 (환경변수가 있을 때만 생성) |

서버 런타임·DB는 없습니다. 글 데이터는 `data/posts/{blogId}.json`에 커밋되고 빌드 때 읽힙니다.

## 블로그 추가·수정

[`src/config/blogs.ts`](src/config/blogs.ts)의 `BLOGS`를 고칩니다. 여기 있는 블로그만 수집·게시됩니다.
소개 문구는 사람이 읽는 문장으로 유지하세요.

## 명령

```bash
pnpm install
pnpm run fetch      # 네이버 RSS 수집 → data/posts/*.json (블로그당 최근 50개)
pnpm run dev
pnpm run build      # 타입 검사 + 정적 빌드
pnpm run test       # 파서 오프라인 검사
pnpm run indexnow   # 사이트 전체 URL을 IndexNow로 통보 (INDEXNOW_KEY 필요)
```

## 배포

`main`에 푸시하거나 매일 한 번 [`deploy.yml`](.github/workflows/deploy.yml)이 수집 → 빌드 →
Cloudflare Pages 배포 → IndexNow 통보를 실행합니다. 필요한 GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `INDEXNOW_KEY` (32자 이상 영숫자, 선택)

구글은 IndexNow를 받지 않습니다. Search Console에 `https://editornom.com/sitemap.xml`을 등록하세요.
