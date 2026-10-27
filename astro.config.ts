import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/config";

// 완전 정적 빌드입니다. 글 데이터는 data/posts/*.json 에 커밋되어 있고,
// scripts/fetch.ts 가 갱신합니다. 서버 런타임이 없습니다.
export default defineConfig({
  site: SITE.url,
  trailingSlash: "never",
  // /nb/about 이 nb/about/index.html 이 되면 호스팅이 슬래시 리다이렉트를 물리므로
  // canonical(슬래시 없음)과 어긋납니다. 파일 형식으로 굽습니다.
  build: { format: "file" },
  vite: {
    plugins: [tailwindcss()],
  },
});
