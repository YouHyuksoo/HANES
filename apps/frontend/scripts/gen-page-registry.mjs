/**
 * @file scripts/gen-page-registry.mjs
 * @description (authenticated) 영역의 모든 page.tsx를 스캔해 경로→동적 import 레지스트리를 생성한다.
 *
 * 왜 codegen인가:
 * - 레이아웃 레벨 keep-alive(TabKeepAlive)는 활성 라우트뿐 아니라 열린 탭 페이지들을
 *   레이아웃이 직접 렌더해야 한다. Next의 {children}은 활성 라우트만 주므로 경로→컴포넌트
 *   매핑이 필요하다.
 * - dev=Turbopack / build=webpack 환경에서 `import(`...${var}`)` 동적 표현식은 호환이 불확실하다.
 *   정적 import 목록을 생성하면 두 번들러 모두에서 안전하다.
 *
 * 사용: `node scripts/gen-page-registry.mjs` (페이지 추가/삭제 후 재실행)
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, "..");
const AUTH_ROOT = join(FRONTEND_ROOT, "src", "app", "(authenticated)");
const OUT_FILE = join(FRONTEND_ROOT, "src", "components", "layout", "pageRegistry.generated.ts");

/** page.tsx 파일을 재귀적으로 수집 */
function collectPages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectPages(full));
    } else if (name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/** 파일시스템 디렉터리(그룹 포함)를 URL 라우트 경로로 변환(그룹 `()` 세그먼트 제거) */
function toRoutePath(pageFile) {
  const relDir = relative(AUTH_ROOT, dirname(pageFile));
  const segments = relDir.split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + segments.join("/");
}

/** import 지정자(파일시스템 경로 그대로, @/ 별칭 사용) */
function toImportSpec(pageFile) {
  const relFromSrc = relative(join(FRONTEND_ROOT, "src"), pageFile)
    .replace(/\\/g, "/")
    .replace(/\.tsx$/, "");
  return "@/" + relFromSrc;
}

const pages = collectPages(AUTH_ROOT)
  .map((f) => ({ route: toRoutePath(f), spec: toImportSpec(f) }))
  .sort((a, b) => a.route.localeCompare(b.route));

const seen = new Map();
for (const p of pages) {
  if (seen.has(p.route)) {
    throw new Error(`중복 라우트 경로: ${p.route} (${p.spec} vs ${seen.get(p.route)})`);
  }
  seen.set(p.route, p.spec);
}

const entries = pages
  .map((p) => `  "${p.route}": dynamic(() => import("${p.spec}"), { ssr: false }),`)
  .join("\n");

const content = `/**
 * @file src/components/layout/pageRegistry.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. \`node scripts/gen-page-registry.mjs\`로 재생성.
 *              (authenticated) 영역 경로 → 페이지 컴포넌트(dynamic, ssr:false) 매핑.
 *              TabKeepAlive가 열린 탭 페이지들을 레이아웃에서 직접 마운트 유지하는 데 사용한다.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const pageRegistry: Record<string, ComponentType> = {
${entries}
};
`;

writeFileSync(OUT_FILE, content, "utf8");
console.log(`Generated ${pages.length} routes → ${relative(FRONTEND_ROOT, OUT_FILE)}`);
