/**
 * 배포 직후 호출해 사이트의 모든 주소를 IndexNow 로 알립니다.
 * INDEXNOW_KEY 가 없으면 아무것도 하지 않습니다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { BLOGS, findBlog } from "../src/config";
import type { BlogFile, PostRecord } from "../src/lib/store";
import { pingIndexNow } from "../src/lib/indexnow";
import { absolute, nbBlogPath, nbPostPath } from "../src/lib/urls";
import { getEnv, siteUrl } from "../src/lib/env";

const key = getEnv("INDEXNOW_KEY");
if (!key) {
  console.log("INDEXNOW_KEY 없음 — 건너뜀");
  process.exit(0);
}

// store.ts 는 Vite 의 import.meta.glob 을 써서 tsx 로는 불러올 수 없으니 JSON 을 직접 읽습니다.
function readPosts(): PostRecord[] {
  const dir = new URL("../data/posts/", import.meta.url);
  const posts: PostRecord[] = [];
  for (const name of readdirSync(dir).filter(file => file.endsWith(".json"))) {
    const file = JSON.parse(readFileSync(new URL(name, dir), "utf8")) as BlogFile;
    if (file.posts && findBlog(file.blogId)) posts.push(...file.posts);
  }
  return posts;
}

const base = siteUrl();
const urls = [
  absolute(base, "/"),
  ...BLOGS.map(blog => absolute(base, nbBlogPath(blog.blogId))),
  ...readPosts().map(post => absolute(base, nbPostPath(post.blogId, post.logNo))),
];

const result = await pingIndexNow(key, new URL(base).host, urls);
console.log(`IndexNow ${urls.length}건:`, result);
if (!result.ok) process.exit(1);
