/**
 * @file scripts/gen-page-registry.mjs
 * @description (authenticated) 영역의 모든 page.tsx를 스캔해 경로→lazy 동적 import 레지스트리를 생성한다.
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
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, "..");
const AUTH_ROOT = join(FRONTEND_ROOT, "src", "app", "(authenticated)");
const OUT_FILE = join(FRONTEND_ROOT, "src", "components", "layout", "pageRegistry.generated.ts");
const OUT_DIR = join(FRONTEND_ROOT, "src", "components", "layout", "page-registries");

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

function registryName(route) {
  const parts = route.split("/").filter(Boolean);
  return (parts.length ? parts : ["root"])
    .join("__")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const registryNames = new Map();
for (const page of pages) {
  const name = registryName(page.route);
  const previous = registryNames.get(name);
  if (previous) {
    throw new Error(`Registry name collision: ${previous} and ${page.route} -> ${name}`);
  }
  registryNames.set(name, page.route);

  const routeContent = `/**
 * @file src/components/layout/page-registries/${name}.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. \`node scripts/gen-page-registry.mjs\`로 재생성.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export function getPageComponent(): ComponentType {
  return dynamic(() => import("${page.spec}"), { ssr: false });
}
`;

  writeFileSync(join(OUT_DIR, `${name}.generated.ts`), routeContent, "utf8");
}

const routeCases = pages
  .map(
    (page) => `    case "${page.route}": {
      const mod = await import("./page-registries/${registryName(page.route)}.generated");
      component = mod.getPageComponent();
      break;
    }`,
  )
  .join("\n");

const content = `/**
 * @file src/components/layout/pageRegistry.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. \`node scripts/gen-page-registry.mjs\`로 재생성.
 *              (authenticated) 영역 경로 → 페이지별 lazy dynamic factory.
 *              현재 경로의 작은 registry만 필요 시 import해 dev 서버의 전체 page compile 폭주를 피한다.
 */
import type { ComponentType } from "react";

const pageComponentCache = new Map<string, ComponentType>();
const pageComponentPromiseCache = new Map<string, Promise<ComponentType | null>>();

export async function getPageComponent(path: string): Promise<ComponentType | null> {
  const cached = pageComponentCache.get(path);
  if (cached) return cached;

  const pending = pageComponentPromiseCache.get(path);
  if (pending) return pending;

  const promise = loadPageComponent(path);
  pageComponentPromiseCache.set(path, promise);
  const component = await promise;
  if (component) pageComponentCache.set(path, component);
  pageComponentPromiseCache.delete(path);
  return component;
}

async function loadPageComponent(path: string): Promise<ComponentType | null> {
  let component: ComponentType | null = null;
  switch (path) {
${routeCases}
    default:
      return null;
  }
  return component;
}
`;

writeFileSync(OUT_FILE, content, "utf8");
console.log(`Generated ${pages.length} route registries → ${relative(FRONTEND_ROOT, OUT_FILE)}`);
