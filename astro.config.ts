import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/config";

// 기본은 정적 빌드입니다. 제출과 동시에 살아나야 하는 /nb/* 라우트만
// 각 파일에서 `export const prerender = false` 로 온디맨드로 전환합니다.
// 랜딩/문서 페이지는 그대로 정적이라 엣지에서 즉시 응답합니다.
export default defineConfig({
  site: SITE.url,
  trailingSlash: "never",
  // 기본값(directory)으로 구우면 /nb/about 이 nb/about/index.html 이 되고,
  // Cloudflare Pages 가 /nb/about → /nb/about/ 로 308 을 물립니다.
  // canonical 은 슬래시 없는 주소라 서로 어긋나므로 파일 형식으로 굽습니다.
  build: { format: "file" },
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: "compile",
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
