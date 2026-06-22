# 도움말(Help) 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전역 Header 버튼으로 현재 화면 도움말을 슬라이드 패널에 띄우고, `/help` 라우트에서 전체 목차를 탐색하는 Markdown 기반 도움말 시스템의 "틀"을 구축한다.

**Architecture:** 도움말 콘텐츠는 `apps/frontend/public/help/`에 Markdown으로 두고 런타임 fetch한다. `react-markdown`으로 렌더하고, 페이지↔도움말은 `findMenuCodeByPath(pathname)`로 매핑한다. 패널 open/탭 상태는 zustand store로 Header 버튼과 패널/페이지가 공유한다.

**Tech Stack:** Next.js(App Router) + React + TypeScript, zustand 5, react-markdown + remark-gfm + rehype-raw, Tailwind, i18next.

## Global Constraints

- 패키지 매니저는 `pnpm`만 사용 (npm 금지).
- 프론트 타입체크: `pnpm --filter @harness/frontend exec tsc --noEmit` (dev 서버 떠 있으면 `pnpm build` 금지).
- 구조 테스트: `node --test <파일>` (node:test + node:assert/strict).
- UI 문자열은 `ko/en/zh/vi` 4개 i18n 파일 동시 수정. JSON에 UTF-8 BOM 금지.
- `alert/confirm/prompt` 금지 — 모달/패널 컴포넌트 사용.
- 도움말 콘텐츠 본문은 1차 ko 단일. 도움말 UI(버튼/탭/검색 라벨 등)는 4언어.
- 파일명 키는 메뉴코드(예: `QC_AQL`). 경로 매핑은 `findMenuCodeByPath(path: string): string | undefined`.
- 도움말 콘텐츠 위치: `apps/frontend/public/help/{user|operator}/{MENU_CODE}.md`, 이미지 `public/help/images/`, 목차 `public/help/manifest.json`.

---

## File Structure

생성:
- `apps/frontend/public/help/manifest.json` — 전체 목차 정의
- `apps/frontend/public/help/user/QC_AQL.md` — AQL 사용자 도움말(예시 콘텐츠)
- `apps/frontend/public/help/operator/QC_AQL.md` — AQL 운영자 도움말(예시 콘텐츠)
- `apps/frontend/public/help/_templates/user.md`, `operator.md` — 작성 템플릿(참조용)
- `apps/frontend/src/lib/help.ts` — 순수 유틸(경로 생성, manifest 필터, 타입)
- `apps/frontend/src/lib/help.structure.test.mjs` — help.ts 구조 테스트
- `apps/frontend/src/stores/helpStore.ts` — 패널 open/탭 zustand store
- `apps/frontend/src/hooks/useHelpDoc.ts` — .md fetch 훅
- `apps/frontend/src/hooks/useHelpManifest.ts` — manifest fetch 훅
- `apps/frontend/src/components/help/MarkdownRenderer.tsx` — react-markdown 래퍼
- `apps/frontend/src/components/help/HelpButton.tsx` — Header 버튼
- `apps/frontend/src/components/help/HelpPanel.tsx` — 우측 슬라이드 패널
- `apps/frontend/src/components/help/help.structure.test.mjs` — 컴포넌트 구조 테스트
- `apps/frontend/src/app/(authenticated)/help/page.tsx` — 전체 목차 페이지

수정:
- `apps/frontend/package.json` — react-markdown/remark-gfm/rehype-raw 의존성
- `apps/frontend/src/components/layout/Header.tsx` — HelpButton 삽입
- `apps/frontend/src/components/layout/MainLayout.tsx` — HelpPanel 마운트
- `apps/frontend/src/locales/{ko,en,zh,vi}.json` — `help.*` UI 문자열

---

## Task 1: 의존성 설치 + Markdown 렌더러

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/src/components/help/MarkdownRenderer.tsx`

**Interfaces:**
- Produces: `MarkdownRenderer({ content }: { content: string }): JSX.Element` — Markdown 문자열을 스타일된 HTML로 렌더(GFM 표/코드/링크, `/help/images/...` 이미지, `<img width>` 등 제한적 raw HTML 허용).

- [ ] **Step 1: 의존성 설치**

Run:
```bash
pnpm --filter @harness/frontend add react-markdown remark-gfm rehype-raw
```
Expected: package.json에 세 패키지가 추가되고 설치 성공.

- [ ] **Step 2: MarkdownRenderer 작성**

Create `apps/frontend/src/components/help/MarkdownRenderer.tsx`:
```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
}

/** 도움말 Markdown 렌더러 — GFM(표/코드/링크) + 제한적 raw HTML(img width 등) */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="help-md max-w-none text-sm leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-1 text-lg font-bold text-text">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 border-b border-border pb-1 text-base font-semibold text-text">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold text-text">{children}</h3>,
          p: ({ children }) => <p className="my-2 text-text">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-text">{children}</li>,
          a: ({ href, children }) => <a href={href} className="text-primary underline hover:opacity-80">{children}</a>,
          code: ({ children }) => <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-primary">{children}</code>,
          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[12px] text-slate-100">{children}</pre>,
          table: ({ children }) => <table className="my-3 w-full border-collapse text-[13px]">{children}</table>,
          th: ({ children }) => <th className="border border-border bg-surface px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} {...props} className="my-2 max-w-full rounded-lg border border-border" />
          ),
          blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-primary/40 bg-surface/60 px-3 py-1.5 text-text-muted">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml apps/frontend/src/components/help/MarkdownRenderer.tsx
git commit -m "feat(help): add react-markdown deps and MarkdownRenderer"
```

---

## Task 2: 순수 유틸 + 구조 테스트 (TDD)

**Files:**
- Create: `apps/frontend/src/lib/help.ts`
- Test: `apps/frontend/src/lib/help.structure.test.mjs`

**Interfaces:**
- Produces:
  - `type HelpTab = "user" | "operator"`
  - `type HelpManifestItem = { menuCode: string; title: string; path?: string }`
  - `type HelpManifestCategory = { key: string; title: string; items: HelpManifestItem[] }`
  - `type HelpManifest = { version: number; categories: HelpManifestCategory[] }`
  - `type HelpMeta = { menuCode?: string; audience?: HelpTab; title?: string; summary?: string; tags?: string[]; keywords?: string[]; related?: string[] }`
  - `helpDocPath(tab: HelpTab, menuCode: string): string` → `/help/${tab}/${menuCode}.md`
  - `filterManifest(manifest: HelpManifest, query: string): HelpManifestCategory[]` → 제목 부분일치(대소문자 무시)로 카테고리/항목 필터, 빈 query면 원본 반환.
  - `parseHelpDoc(raw: string): { meta: HelpMeta; body: string }` → 자체 frontmatter 파서. 최상단 `---\n...\n---\n` 블록을 분리해 메타(스칼라 + `[a, b]` 인라인 배열)와 본문을 반환. frontmatter 없으면 `{ meta: {}, body: raw }`.

- [ ] **Step 1: 구조 테스트 작성 (실패할 테스트)**

Create `apps/frontend/src/lib/help.structure.test.mjs`:
```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "help.ts"), "utf8");

test("help.ts exposes HelpTab/HelpManifest types", () => {
  assert.match(source, /export type HelpTab = "user" \| "operator"/);
  assert.match(source, /export (?:type|interface) HelpManifest\b/);
});

test("helpDocPath builds /help/{tab}/{menuCode}.md", () => {
  assert.match(source, /export function helpDocPath\(tab: HelpTab, menuCode: string\): string/);
  assert.match(source, /`\/help\/\$\{tab\}\/\$\{menuCode\}\.md`/);
});

test("filterManifest filters by title case-insensitively", () => {
  assert.match(source, /export function filterManifest\(/);
  assert.match(source, /toLowerCase\(\)/);
});

test("parseHelpDoc splits frontmatter and body", () => {
  assert.match(source, /export (?:type|interface) HelpMeta\b/);
  assert.match(source, /export function parseHelpDoc\(raw: string\)/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test apps/frontend/src/lib/help.structure.test.mjs`
Expected: FAIL (help.ts 없음 → ENOENT).

- [ ] **Step 3: help.ts 구현**

Create `apps/frontend/src/lib/help.ts`:
```ts
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
```

추가 구조 테스트(같은 파일에 이어서): 인라인 배열 파싱과 본문 분리를 동작으로 검증하려면 `node --test` 안에서 직접 import가 어려우므로(.ts), 동작 검증은 Task 5(useHelpDoc)와 통합 검증(Task 10)에서 확인한다. 구조 테스트는 위 시그니처 존재로 충분하다.

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `node --test apps/frontend/src/lib/help.structure.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: 타입체크 + Commit**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 에러 0건.
```bash
git add apps/frontend/src/lib/help.ts apps/frontend/src/lib/help.structure.test.mjs
git commit -m "feat(help): add help utils (paths, manifest filter) with structure tests"
```

---

## Task 3: 콘텐츠 골격 (manifest + 템플릿 + AQL 예시)

**Files:**
- Create: `apps/frontend/public/help/manifest.json`
- Create: `apps/frontend/public/help/_templates/user.md`
- Create: `apps/frontend/public/help/_templates/operator.md`
- Create: `apps/frontend/public/help/user/QC_AQL.md`
- Create: `apps/frontend/public/help/operator/QC_AQL.md`

**Interfaces:**
- Consumes: `HelpManifest` 스키마(Task 2).
- Produces: 런타임 fetch 대상 정적 파일. `/help/manifest.json`, `/help/{user|operator}/QC_AQL.md`.

- [ ] **Step 1: manifest.json 작성**

Create `apps/frontend/public/help/manifest.json`:
```json
{
  "version": 1,
  "categories": [
    {
      "key": "quality",
      "title": "품질관리",
      "items": [
        { "menuCode": "QC_AQL", "title": "AQL 기준관리", "path": "/quality/aql" }
      ]
    }
  ]
}
```

- [ ] **Step 2: 템플릿 2종 작성**

Create `apps/frontend/public/help/_templates/user.md`:
```markdown
---
menuCode:
audience: user
title:
summary:
tags: []
keywords: []
related: []
---

# {화면명}

## 화면 목적
이 화면이 무엇을 위한 것인지 한두 문장으로 설명합니다.

## 주요 기능
- 기능 1
- 기능 2

## 사용 순서
1. 첫 번째 단계
2. 두 번째 단계

## 입력 항목 설명
| 항목 | 설명 |
|------|------|
| 항목명 | 설명 |

## 자주 묻는 질문
- **Q.** 질문?
  **A.** 답변.

## 관련 화면
- [관련 화면명](/경로)
```

Create `apps/frontend/public/help/_templates/operator.md`:
```markdown
---
menuCode:
audience: operator
title:
summary:
tags: []
keywords: []
related: []
---

# {화면명} — 운영 가이드

## 시스템 목적·역할
이 기능이 전체 시스템에서 차지하는 역할.

## 사전 설정 (마스터·공통코드)
선행되어야 하는 마스터/공통코드/권한.

## 운영 절차
정상 운영 절차와 점검 포인트.

## 권한
이 화면을 사용/관리하는 권한 구분.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 증상 | 원인 | 조치 |

## 데이터·연계
관련 테이블, 연계 화면/배치/외부 연동.
```

- [ ] **Step 3: AQL 예시 콘텐츠 작성(시작점)**

Create `apps/frontend/public/help/user/QC_AQL.md`:
```markdown
---
menuCode: QC_AQL
audience: user
title: AQL 기준관리
summary: 수입검사(IQC)에서 LOT 합·불을 판정하는 AQL 정책·기준을 등록·관리하는 화면
tags: [품질, IQC, AQL, 수입검사]
keywords: [합격품질한계, Major, Minor, 검사수준, 샘플링, Ac, Re, LOT]
related: [MST_PART]
---

# AQL 기준관리

## 화면 목적
수입검사(IQC)에서 LOT 합·불을 판정하는 AQL(합격품질한계) 기준과 정책을 등록·관리하는 화면입니다.

## 주요 기능
- AQL 정책 등록/수정 (Major·Minor 조합)
- AQL 기준(LOT 수량별 판정기준) 등록/수정

## 사용 순서
1. 좌측에서 AQL 정책을 선택하거나 "정책 추가"로 새로 만듭니다.
2. 우측에서 AQL 기준과 LOT 수량별 판정기준(샘플수·Ac·Re)을 입력합니다.
3. 저장합니다.

## 입력 항목 설명
| 항목 | 설명 |
|------|------|
| Major AQL | 중결함 합격품질한계 |
| Minor AQL | 경결함 합격품질한계 |
| 검사수준 | 샘플 크기 결정 수준(보통 II) |

## 관련 화면
- [품목마스터](/master/part)
```

Create `apps/frontend/public/help/operator/QC_AQL.md`:
```markdown
---
menuCode: QC_AQL
audience: operator
title: AQL 기준관리 — 운영 가이드
summary: AQL 정책/기준 운영 절차와 품목 연계, 트러블슈팅
tags: [품질, IQC, AQL, 운영, 설정]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, 품목연계, 검사수준, 트러블슈팅]
related: [MST_PART]
---

# AQL 기준관리 — 운영 가이드

## 시스템 목적·역할
품목별 수입검사 판정의 기준이 되는 AQL 정책/기준을 정의합니다. 품목마스터의 AQL 정책 필드가 이 정책을 참조합니다.

## 사전 설정 (마스터·공통코드)
- 공통코드: `AQL_INSP_LEVEL`, `AQL_VALUE`
- 품목마스터에 AQL 정책 연결

## 운영 절차
1. AQL 정책(Major/Minor) 정의
2. 정책별 LOT 수량 구간 판정기준 등록
3. 품목마스터에서 품목에 정책 연결

## 권한
품질 관리자.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 검사에서 AQL 자동판정 안 됨 | 품목에 정책 미연결 | 품목마스터에서 AQL 정책 지정 |

## 데이터·연계
- 테이블: `IQC_AQL_POLICIES`, `AQL_STANDARDS`
- 연계: 품목마스터(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), IQC 검사
```

- [ ] **Step 4: JSON 유효성 검증**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('apps/frontend/public/help/manifest.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/public/help
git commit -m "feat(help): add manifest, templates, and AQL example content"
```

---

## Task 4: helpStore (zustand)

**Files:**
- Create: `apps/frontend/src/stores/helpStore.ts`

**Interfaces:**
- Produces: `useHelpStore` with state `{ isOpen: boolean; tab: HelpTab; openHelp(): void; closeHelp(): void; setTab(tab: HelpTab): void }`.

- [ ] **Step 1: helpStore 작성**

Create `apps/frontend/src/stores/helpStore.ts`:
```ts
import { create } from "zustand";
import type { HelpTab } from "@/lib/help";

interface HelpState {
  isOpen: boolean;
  tab: HelpTab;
  openHelp: () => void;
  closeHelp: () => void;
  setTab: (tab: HelpTab) => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  isOpen: false,
  tab: "user",
  openHelp: () => set({ isOpen: true }),
  closeHelp: () => set({ isOpen: false }),
  setTab: (tab) => set({ tab }),
}));
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 에러 0건.
```bash
git add apps/frontend/src/stores/helpStore.ts
git commit -m "feat(help): add helpStore for panel state"
```

---

## Task 5: fetch 훅 (useHelpDoc, useHelpManifest)

**Files:**
- Create: `apps/frontend/src/hooks/useHelpDoc.ts`
- Create: `apps/frontend/src/hooks/useHelpManifest.ts`

**Interfaces:**
- Consumes: `helpDocPath`, `parseHelpDoc`, `HelpMeta`, `HelpManifest`, `HelpTab` (Task 2).
- Produces:
  - `useHelpDoc(menuCode: string | undefined, tab: HelpTab): { meta: HelpMeta | null; content: string | null; loading: boolean; notFound: boolean }` — `content`는 frontmatter가 제거된 본문(body), `meta`는 파싱된 frontmatter.
  - `useHelpManifest(): { manifest: HelpManifest | null; loading: boolean }`

- [ ] **Step 1: useHelpDoc 작성**

Create `apps/frontend/src/hooks/useHelpDoc.ts`:
```ts
"use client";

import { useEffect, useState } from "react";
import { helpDocPath, parseHelpDoc, type HelpMeta, type HelpTab } from "@/lib/help";

/** 도움말 .md를 fetch + frontmatter 분리. menuCode 없거나 404면 notFound=true */
export function useHelpDoc(menuCode: string | undefined, tab: HelpTab) {
  const [content, setContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<HelpMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!menuCode) {
      setContent(null);
      setMeta(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(helpDocPath(tab, menuCode))
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        // public 404가 HTML로 200 반환될 수 있어 방어
        if (text.trimStart().startsWith("<")) throw new Error("not found");
        const { meta: m, body } = parseHelpDoc(text);
        setMeta(m);
        setContent(body);
      })
      .catch(() => {
        if (cancelled) return;
        setContent(null);
        setMeta(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [menuCode, tab]);

  return { meta, content, loading, notFound };
}
```

- [ ] **Step 2: useHelpManifest 작성**

Create `apps/frontend/src/hooks/useHelpManifest.ts`:
```ts
"use client";

import { useEffect, useState } from "react";
import type { HelpManifest } from "@/lib/help";

/** 도움말 목차(manifest.json) fetch */
export function useHelpManifest() {
  const [manifest, setManifest] = useState<HelpManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/help/manifest.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HelpManifest | null) => {
        if (!cancelled) setManifest(data);
      })
      .catch(() => {
        if (!cancelled) setManifest(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  }, []);

  return { manifest, loading };
}
```

- [ ] **Step 3: 타입체크 + Commit**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 에러 0건.
```bash
git add apps/frontend/src/hooks/useHelpDoc.ts apps/frontend/src/hooks/useHelpManifest.ts
git commit -m "feat(help): add useHelpDoc and useHelpManifest fetch hooks"
```

---

## Task 6: HelpPanel (슬라이드 패널)

**Files:**
- Create: `apps/frontend/src/components/help/HelpPanel.tsx`
- Create: `apps/frontend/src/components/help/help.structure.test.mjs`

**Interfaces:**
- Consumes: `useHelpStore`(Task 4), `useHelpDoc`(Task 5), `MarkdownRenderer`(Task 1), `findMenuCodeByPath`, `usePathname`, `useRouter`.
- Produces: `HelpPanel(): JSX.Element | null` — `isOpen`일 때 우측 슬라이드 패널 렌더. 탭(사용자/운영자), 현재 페이지 도움말, "전체 도움말 보기" 링크, fallback.

- [ ] **Step 1: 구조 테스트 작성(실패할 테스트)**

Create `apps/frontend/src/components/help/help.structure.test.mjs`:
```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(__dirname, "HelpPanel.tsx"), "utf8");

test("HelpPanel uses store, pathname mapping, and renders markdown", () => {
  assert.match(panel, /useHelpStore/);
  assert.match(panel, /findMenuCodeByPath/);
  assert.match(panel, /useHelpDoc/);
  assert.match(panel, /MarkdownRenderer/);
});

test("HelpPanel has user/operator tabs and full-help link", () => {
  assert.match(panel, /setTab\("user"\)/);
  assert.match(panel, /setTab\("operator"\)/);
  assert.match(panel, /\/help/);
});

test("HelpPanel shows fallback when notFound", () => {
  assert.match(panel, /notFound/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test apps/frontend/src/components/help/help.structure.test.mjs`
Expected: FAIL (HelpPanel.tsx 없음).

- [ ] **Step 3: HelpPanel 구현**

Create `apps/frontend/src/components/help/HelpPanel.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { X, BookOpen, ExternalLink } from "lucide-react";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useHelpStore } from "@/stores/helpStore";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import MarkdownRenderer from "./MarkdownRenderer";

export default function HelpPanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, tab, closeHelp, setTab } = useHelpStore();
  const menuCode = findMenuCodeByPath(pathname);
  const { content, loading, notFound } = useHelpDoc(isOpen ? menuCode : undefined, tab);

  // Escape로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeHelp]);

  if (!isOpen) return null;

  const tabs: { key: "user" | "operator"; label: string }[] = [
    { key: "user", label: t("help.tabUser", "사용자") },
    { key: "operator", label: t("help.tabOperator", "운영자") },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/40" onClick={closeHelp} aria-hidden />
      <aside className="fixed right-0 top-0 z-[9991] flex h-screen w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="flex-1 text-sm font-bold text-text">{t("help.title", "도움말")}</h2>
          <button onClick={closeHelp} className="rounded p-1 hover:bg-surface" aria-label={t("common.close", "닫기")}>
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                tab === tb.key ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notFound || !content ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-muted">
              <BookOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t("help.notReady", "이 화면의 도움말은 준비 중입니다.")}</p>
            </div>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => {
              closeHelp();
              router.push("/help");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            {t("help.viewAll", "전체 도움말 보기")}
          </button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `node --test apps/frontend/src/components/help/help.structure.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: 타입체크 + Commit**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 에러 0건.
```bash
git add apps/frontend/src/components/help/HelpPanel.tsx apps/frontend/src/components/help/help.structure.test.mjs
git commit -m "feat(help): add HelpPanel slide-over with tabs and fallback"
```

---

## Task 7: HelpButton + Header/MainLayout 통합

**Files:**
- Create: `apps/frontend/src/components/help/HelpButton.tsx`
- Modify: `apps/frontend/src/components/layout/Header.tsx`
- Modify: `apps/frontend/src/components/layout/MainLayout.tsx`

**Interfaces:**
- Consumes: `useHelpStore`(Task 4), `HelpPanel`(Task 6).
- Produces: `HelpButton(): JSX.Element` — 클릭 시 `openHelp()`. Header 우측 액션에 표시. `HelpPanel`은 `MainLayout`에 마운트.

- [ ] **Step 1: HelpButton 작성**

Create `apps/frontend/src/components/help/HelpButton.tsx`:
```tsx
"use client";

import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHelpStore } from "@/stores/helpStore";

export default function HelpButton() {
  const { t } = useTranslation();
  const openHelp = useHelpStore((s) => s.openHelp);
  return (
    <button
      onClick={openHelp}
      className="p-2 rounded-md hover:bg-background transition-colors"
      aria-label={t("help.title", "도움말")}
      title={t("help.title", "도움말")}
    >
      <HelpCircle className="w-5 h-5 text-text-muted" />
    </button>
  );
}
```

- [ ] **Step 2: Header에 HelpButton 삽입**

Modify `apps/frontend/src/components/layout/Header.tsx` — import 추가(파일 상단 import 구역):
```tsx
import HelpButton from "@/components/help/HelpButton";
```
그리고 언어 전환 다음(현재 `<LanguageSwitcher />` 줄 아래)에 삽입:
```tsx
        {/* 언어 전환 */}
        <LanguageSwitcher />

        {/* 도움말 */}
        <HelpButton />
```

- [ ] **Step 3: MainLayout에 HelpPanel 마운트**

Modify `apps/frontend/src/components/layout/MainLayout.tsx` — import 추가:
```tsx
import HelpPanel from "@/components/help/HelpPanel";
```
그리고 `<ImprovementFAB />` 바로 아래(닫는 `</div>` 직전)에 추가:
```tsx
      <ImprovementFAB />
      <HelpPanel />
```

- [ ] **Step 4: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/help/HelpButton.tsx apps/frontend/src/components/layout/Header.tsx apps/frontend/src/components/layout/MainLayout.tsx
git commit -m "feat(help): wire HelpButton into Header and HelpPanel into MainLayout"
```

---

## Task 8: /help 전체 목차 페이지

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/help/page.tsx`

**Interfaces:**
- Consumes: `useHelpManifest`(Task 5), `useHelpDoc`(Task 5), `filterManifest`/`HelpTab`(Task 2), `MarkdownRenderer`(Task 1).
- Produces: `/help` 라우트 — 좌측 목차(검색 가능) + 우측 본문 + 사용자/운영자 탭.

- [ ] **Step 1: help/page.tsx 작성**

Create `apps/frontend/src/app/(authenticated)/help/page.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, Input } from "@/components/ui";
import { useHelpManifest } from "@/hooks/useHelpManifest";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import { filterManifest, type HelpTab } from "@/lib/help";
import MarkdownRenderer from "@/components/help/MarkdownRenderer";

export default function HelpIndexPage() {
  const { t } = useTranslation();
  const { manifest, loading } = useHelpManifest();
  const [tab, setTab] = useState<HelpTab>("user");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const categories = useMemo(
    () => (manifest ? filterManifest(manifest, query) : []),
    [manifest, query],
  );

  const { content, loading: docLoading, notFound } = useHelpDoc(selected, tab);

  const tabs: { key: HelpTab; label: string }[] = [
    { key: "user", label: t("help.tabUser", "사용자") },
    { key: "operator", label: t("help.tabOperator", "운영자") },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-shrink-0">
        <BookOpen className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-text">{t("help.title", "도움말")}</h1>
          <p className="text-text-muted mt-0.5 text-sm">{t("help.indexSubtitle", "전체 화면 사용법과 운영 가이드")}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측 목차 */}
        <Card className="col-span-4 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3 overflow-hidden flex flex-col">
            <div className="flex border-b border-border mb-2">
              {tabs.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === tb.key ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("help.searchPlaceholder", "도움말 검색")}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
              className="mb-2"
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm text-text-muted">{t("common.loading", "로딩 중...")}</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.key} className="mb-3">
                    <p className="px-2 py-1 text-xs font-semibold text-text-muted">{cat.title}</p>
                    {cat.items.map((it) => (
                      <button
                        key={it.menuCode}
                        onClick={() => setSelected(it.menuCode)}
                        className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
                          selected === it.menuCode ? "bg-primary/10 text-primary font-medium" : "text-text hover:bg-surface"
                        }`}
                      >
                        {it.title}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 우측 본문 */}
        <Card className="col-span-8 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-5 overflow-y-auto">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
                <BookOpen className="h-12 w-12 opacity-20" />
                <p className="text-sm">{t("help.selectItem", "좌측에서 도움말 항목을 선택하세요.")}</p>
              </div>
            ) : docLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notFound || !content ? (
              <p className="text-sm text-text-muted">{t("help.notReady", "이 화면의 도움말은 준비 중입니다.")}</p>
            ) : (
              <MarkdownRenderer content={content} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/help/page.tsx"
git commit -m "feat(help): add /help full index page with toc, search, tabs"
```

---

## Task 9: i18n UI 문자열 (4언어)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

**Interfaces:**
- Consumes: 코드에서 사용한 키 — `help.title`, `help.tabUser`, `help.tabOperator`, `help.notReady`, `help.viewAll`, `help.indexSubtitle`, `help.searchPlaceholder`, `help.selectItem`, `common.close`.

- [ ] **Step 1: ko.json에 help 블록 추가**

각 locale 파일의 최상위 객체에 `help` 키를 추가한다(기존 최상위 키 옆, 예: `common` 블록 뒤). `common.close`/`common.loading`은 대개 이미 존재하므로 없을 때만 추가.

ko.json — 최상위에 추가:
```json
  "help": {
    "title": "도움말",
    "tabUser": "사용자",
    "tabOperator": "운영자",
    "notReady": "이 화면의 도움말은 준비 중입니다.",
    "viewAll": "전체 도움말 보기",
    "indexSubtitle": "전체 화면 사용법과 운영 가이드",
    "searchPlaceholder": "도움말 검색",
    "selectItem": "좌측에서 도움말 항목을 선택하세요."
  },
```

- [ ] **Step 2: en.json**
```json
  "help": {
    "title": "Help",
    "tabUser": "User",
    "tabOperator": "Operator",
    "notReady": "Help for this screen is not ready yet.",
    "viewAll": "View all help",
    "indexSubtitle": "All screen guides and operations manual",
    "searchPlaceholder": "Search help",
    "selectItem": "Select a help item on the left."
  },
```

- [ ] **Step 3: zh.json**
```json
  "help": {
    "title": "帮助",
    "tabUser": "用户",
    "tabOperator": "运营",
    "notReady": "该画面的帮助尚未准备。",
    "viewAll": "查看全部帮助",
    "indexSubtitle": "全部画面使用方法与运营指南",
    "searchPlaceholder": "搜索帮助",
    "selectItem": "请在左侧选择帮助项目。"
  },
```

- [ ] **Step 4: vi.json**
```json
  "help": {
    "title": "Trợ giúp",
    "tabUser": "Người dùng",
    "tabOperator": "Vận hành",
    "notReady": "Trợ giúp cho màn hình này chưa sẵn sàng.",
    "viewAll": "Xem toàn bộ trợ giúp",
    "indexSubtitle": "Hướng dẫn sử dụng và vận hành toàn bộ màn hình",
    "searchPlaceholder": "Tìm trợ giúp",
    "selectItem": "Hãy chọn mục trợ giúp ở bên trái."
  },
```

- [ ] **Step 5: 검증 (JSON 파싱 + 키 정합)**

Run:
```bash
node -e "for (const f of ['ko','en','zh','vi']) { const j=require('./apps/frontend/src/locales/'+f+'.json'); if(!j.help||!j.help.title) throw new Error(f+' missing help'); console.log(f,'ok'); }"
```
Expected: `ko ok / en ok / zh ok / vi ok`.

- [ ] **Step 6: 타입체크 + Commit**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 에러 0건.
```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "i18n(help): add help UI strings (ko/en/zh/vi)"
```

---

## Task 10: 통합 검증 (수동)

**Files:** 없음(검증만)

- [ ] **Step 1: dev 서버에서 확인**

사용자 dev 서버(`localhost:3002`)에서:
1. 상단 Header의 `?` 버튼 클릭 → 우측 패널 오픈.
2. `/quality/aql`에서 버튼 클릭 → AQL 사용자 도움말 표시, [운영자] 탭 전환 시 운영자 도움말 표시.
3. 도움말 콘텐츠 없는 화면(예: `/dashboard`)에서 → "준비 중" fallback 표시.
4. 패널 하단 "전체 도움말 보기" → `/help` 이동, 목차/검색/탭 동작, 항목 선택 시 본문 렌더.
5. `public/help/user/QC_AQL.md` 한 줄 수정 후 새로고침 → 변경 반영(빌드 없이).

- [ ] **Step 2: 최종 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

---

## Self-Review 결과

- **Spec coverage:** MD 런타임(T1,T3,T5) / 매핑(T2,T6) / 하이브리드 진입(T6 패널, T8 라우트) / 전역 Header 버튼(T7) / 사용자·운영자 탭(T6,T8) / fallback(T5,T6,T8) / 콘텐츠 템플릿(T3) / 1차 AQL 예시(T3) / i18n(T9) — 모두 task 존재.
- **Placeholder scan:** 코드 블록은 모두 실제 구현. 템플릿의 `{화면명}` 등은 의도된 콘텐츠 자리표시(도움말 작성용 템플릿 본문).
- **Type consistency:** `HelpTab`, `helpDocPath`, `filterManifest`, `useHelpStore`, `useHelpDoc`, `useHelpManifest`, `MarkdownRenderer({content})` 시그니처가 task 전반에서 일치.
