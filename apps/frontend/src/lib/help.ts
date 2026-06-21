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

/** 도움말 Markdown 파일 경로 (public 기준 절대경로) */
export function helpDocPath(tab: HelpTab, menuCode: string): string {
  return `/help/${tab}/${menuCode}.md`;
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
