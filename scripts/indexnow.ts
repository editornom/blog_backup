/**
 * 배포 직후 호출해 사이트의 모든 주소를 IndexNow 로 알립니다.
 * INDEXNOW_KEY 가 없으면 아무것도 하지 않습니다.
 */
import { BLOGS } from "../src/config";
import { allPosts } from "../src/lib/store";
import { pingIndexNow } from "../src/lib/indexnow";
import { absolute, nbBlogPath, nbPostPath } from "../src/lib/urls";
import { getEnv, siteUrl } from "../src/lib/env";

const key = getEnv("INDEXNOW_KEY");
if (!key) {
  console.log("INDEXNOW_KEY 없음 — 건너뜀");
  process.exit(0);
}

const base = siteUrl();
const urls = [
  absolute(base, "/"),
  ...BLOGS.map(blog => absolute(base, nbBlogPath(blog.blogId))),
  ...allPosts().map(post => absolute(base, nbPostPath(post.blogId, post.logNo))),
];

const result = await pingIndexNow(key, new URL(base).host, urls);
console.log(`IndexNow ${urls.length}건:`, result);
if (!result.ok) process.exit(1);
