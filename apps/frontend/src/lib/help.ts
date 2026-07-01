export type HelpTab = "user" | "operator";

export interface HelpManifestItem {
  menuCode: string;
  title: string;
  path?: string;
}

export interface HelpManifestCategory {
  key: string;
  title: string;
  items: HelpManifestItem[];
}

export interface HelpManifest {
  version: number;
  categories: HelpManifestCategory[];
}

/** 도움말 Markdown 파일 경로 (public 기준 절대경로). lang 미지정 시 ko 사용 */
export function helpDocPath(tab: HelpTab, menuCode: string, lang?: string): string {
  const l = lang ?? "ko";
  return `/help/${tab}/${l}/${menuCode}.md`;
}

/** 제목 부분일치(대소문자 무시)로 목차 필터. 빈 query면 원본 반환 */
export function filterManifest(manifest: HelpManifest, query: string): HelpManifestCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return manifest.categories;
  return manifest.categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) => it.title.toLowerCase().includes(q) || it.menuCode.toLowerCase().includes(q),
      ),
    }))
    .filter((cat) => cat.items.length > 0 || cat.title.toLowerCase().includes(q));
}

export interface HelpMeta {
  menuCode?: string;
  audience?: HelpTab;
  title?: string;
  summary?: string;
  tags?: string[];
  keywords?: string[];
  related?: string[];
}

/**
 * 경량 frontmatter 파서 — 최상단 `---\n...\n---\n` 블록을 분리.
 * 외부 의존성 없음. 스칼라 값과 `[a, b, c]` 인라인 배열만 지원.
 * frontmatter가 없으면 { meta: {}, body: raw } 반환.
 */
export function parseHelpDoc(raw: string): { meta: HelpMeta; body: string } {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const [, fm, body] = match;
  const meta: Record<string, unknown> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      meta[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      meta[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { meta: meta as HelpMeta, body: body ?? "" };
}

/**
 * rehype-slug(github-slugger)와 동일한 규칙으로 헤딩 텍스트를 id 슬러그로 변환한다.
 * 정확히 같은 헤딩이 여러 번 나오면 github-slugger는 `-1`,`-2`를 붙이지만
 * 이 함수는 순서 정보가 없어 base slug만 반환한다 — 매치 실패 시 그냥 문서 맨 위가 열리는 것으로 충분하다.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ -⁯⸀-⹿\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, "")
    .replace(/\s+/g, "-");
}
