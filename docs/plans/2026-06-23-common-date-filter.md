# 전사 공통 날짜 필터 Implementation Plan (1단계: 컴포넌트 + 파일럿)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조회기간 범위/단일 날짜 필터를 `components/shared/`의 공통 컴포넌트(`DateRangeFilter`, `DateFilter`)로 만들고, 대표 화면 1개(inspection/history)에 적용해 패턴을 검증한다.

**Architecture:** controlled 컴포넌트 2개를 `components/shared/`에 추가한다. 기본값/프리셋 계산은 순수 함수로 `utils/date.ts`에 모은다. 기존 화면의 `dateFrom/dateTo` 두 `useState`를 그대로 컴포넌트에 연결해 변경을 최소화한다.

**Tech Stack:** Next.js(App Router) + React + TypeScript, react-i18next, 기존 `components/ui`의 `Input`/`Button`. 테스트는 프로젝트 관행인 `node:test` 기반 정적 구조 테스트(`*.structure.test.mjs`).

## Global Constraints

- 패키지 매니저는 `pnpm`. `npm` 금지.
- 날짜 "오늘/기본값"은 반드시 `utils/date.ts`의 `getTodayLocal()` 기반. `toISOString().slice(0,10)`(UTC) 금지.
- i18n은 ko/en/zh/vi **4개 파일 동시** 수정. JSON에 **UTF-8 BOM 금지**.
- 공통 컴포넌트는 `components/shared/`에 두고 `shared/index.ts` 배럴에 export.
- `alert/confirm/prompt` 금지. `as any` 금지. `catch (error: unknown)` 유지.
- 검증은 dev 서버 가동 중이면 `pnpm build` 대신 `pnpm --filter @harness/frontend exec tsc --noEmit`.
- 구조 테스트 실행: `node --test <파일경로>` (cwd = 프로젝트 루트).
- 비목표: 폼 입력용 날짜 칸, DataGrid 셀 필터(`data-grid/DateFilterPopup`), 상태 변수명 리네이밍은 건드리지 않는다.

---

## File Structure

- `apps/frontend/src/utils/date.ts` — (수정) `DateRange` 타입 + `getDefaultRange`/`getRecentDaysRange`/`getThisMonthRange` 추가
- `apps/frontend/src/utils/date.range.structure.test.mjs` — (생성) 유틸 구조 테스트
- `apps/frontend/src/components/shared/DateRangeFilter.tsx` — (생성) 범위 필터
- `apps/frontend/src/components/shared/DateFilter.tsx` — (생성) 단일 필터
- `apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs` — (생성) 컴포넌트 구조 테스트
- `apps/frontend/src/components/shared/index.ts` — (수정) 두 컴포넌트 export
- `apps/frontend/src/locales/{ko,en,zh,vi}.json` — (수정) `common.dateFilter` 프리셋 라벨
- `apps/frontend/src/app/(authenticated)/inspection/history/page.tsx` — (수정) 파일럿 적용
- `apps/frontend/src/app/(authenticated)/inspection/history/inspection-history.structure.test.mjs` — (수정) 파일럿 테스트 갱신

---

## Task 1: 날짜 범위 유틸 함수

**Files:**
- Modify: `apps/frontend/src/utils/date.ts`
- Test: `apps/frontend/src/utils/date.range.structure.test.mjs`

**Interfaces:**
- Consumes: 기존 `getTodayLocal(date?: Date): string`
- Produces:
  - `interface DateRange { from: string; to: string }`
  - `getDefaultRange(): DateRange` — `{ from: 오늘, to: 오늘 }`
  - `getRecentDaysRange(days: number): DateRange` — `to`=오늘, `from`=오늘-(days-1)
  - `getThisMonthRange(): DateRange` — `from`=이번 달 1일, `to`=오늘

- [ ] **Step 1: 실패하는 구조 테스트 작성**

`apps/frontend/src/utils/date.range.structure.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./date.ts', import.meta.url), 'utf8');

test('date.ts exports DateRange type and range helpers', () => {
  assert.match(src, /export interface DateRange/);
  assert.match(src, /export function getDefaultRange\(\): DateRange/);
  assert.match(src, /export function getRecentDaysRange\(days: number\): DateRange/);
  assert.match(src, /export function getThisMonthRange\(\): DateRange/);
});

test('range helpers build values via getTodayLocal (no UTC slice)', () => {
  // 오늘 기본값은 getTodayLocal 기반이어야 한다
  assert.match(src, /getDefaultRange[\s\S]*?getTodayLocal\(\)/);
  // UTC 밀림 유발하는 toISOString 사용 금지
  assert.doesNotMatch(src, /toISOString\(\)\.slice/);
});

test('getThisMonthRange anchors from to day 1', () => {
  assert.match(src, /new Date\(now\.getFullYear\(\), now\.getMonth\(\), 1\)/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test apps/frontend/src/utils/date.range.structure.test.mjs`
Expected: FAIL (date.ts에 아직 해당 export 없음)

- [ ] **Step 3: 유틸 구현**

`apps/frontend/src/utils/date.ts` 끝(`getTodayLocal` 함수 뒤)에 추가:

```ts
/** 'YYYY-MM-DD' 시작/종료 범위 */
export interface DateRange {
  from: string;
  to: string;
}

/** 기본 조회 범위: 오늘 ~ 오늘 */
export function getDefaultRange(): DateRange {
  const today = getTodayLocal();
  return { from: today, to: today };
}

/** 최근 N일: (오늘 - (N-1)) ~ 오늘 */
export function getRecentDaysRange(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: getTodayLocal(from), to: getTodayLocal(to) };
}

/** 이번 달: 1일 ~ 오늘 */
export function getThisMonthRange(): DateRange {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: getTodayLocal(first), to: getTodayLocal(now) };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `node --test apps/frontend/src/utils/date.range.structure.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/utils/date.ts apps/frontend/src/utils/date.range.structure.test.mjs
git commit -F - <<'EOF'
feat(utils): 날짜 조회 범위 헬퍼 추가(getDefaultRange/RecentDays/ThisMonth)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 2: DateRangeFilter 컴포넌트

**Files:**
- Create: `apps/frontend/src/components/shared/DateRangeFilter.tsx`
- Modify: `apps/frontend/src/components/shared/index.ts`
- Test: `apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `getRecentDaysRange`, `getThisMonthRange`, 기존 `getTodayLocal`; `@/components/ui`의 `Input`, `Button`
- Produces:
  - `interface DateRangeFilterProps { from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void; presets?: boolean; className?: string }`
  - default export `DateRangeFilter`
  - i18n 키 사용: `common.dateFilter.today`, `common.dateFilter.recent7`, `common.dateFilter.thisMonth` (라벨은 Task 4에서 추가; fallback 텍스트 포함하므로 순서 무관)

- [ ] **Step 1: 실패하는 구조 테스트 작성**

`apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DateRangeFilter.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('DateRangeFilter has controlled from/to props', () => {
  assert.match(src, /from: string/);
  assert.match(src, /to: string/);
  assert.match(src, /onFromChange: \(v: string\) => void/);
  assert.match(src, /onToChange: \(v: string\) => void/);
});

test('DateRangeFilter renders two date inputs and a separator', () => {
  const dateInputs = src.match(/type="date"/g) || [];
  assert.equal(dateInputs.length, 2);
  assert.match(src, /~/);
});

test('DateRangeFilter wires presets to range helpers', () => {
  assert.match(src, /getRecentDaysRange\(7\)/);
  assert.match(src, /getThisMonthRange\(\)/);
  assert.match(src, /getTodayLocal\(\)/);
  assert.match(src, /common\.dateFilter\.today/);
  assert.match(src, /common\.dateFilter\.recent7/);
  assert.match(src, /common\.dateFilter\.thisMonth/);
});

test('DateRangeFilter clamps from>to (auto-correct)', () => {
  assert.match(src, /v > to/);
  assert.match(src, /v < from/);
});

test('shared index exports DateRangeFilter', () => {
  assert.match(index, /export \{ default as DateRangeFilter \} from ".\/DateRangeFilter"/);
  assert.match(index, /export type \{ DateRangeFilterProps \}/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`
Expected: FAIL (파일 없음 / index export 없음)

- [ ] **Step 3: 컴포넌트 구현**

`apps/frontend/src/components/shared/DateRangeFilter.tsx`:

```tsx
"use client";

/**
 * @file components/shared/DateRangeFilter.tsx
 * @description 조회기간(시작일~종료일) 공통 범위 필터.
 *  - controlled: 기존 dateFrom/dateTo 두 state를 그대로 연결한다.
 *  - 프리셋(오늘/최근7일/이번달) 클릭 시 from·to를 함께 갱신.
 *  - 시작일 > 종료일 입력 시 자동 보정.
 */
import { useTranslation } from "react-i18next";
import { Input, Button } from "@/components/ui";
import {
  getTodayLocal,
  getRecentDaysRange,
  getThisMonthRange,
  type DateRange,
} from "@/utils/date";

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  presets?: boolean;
  className?: string;
}

export default function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  presets = true,
  className = "",
}: DateRangeFilterProps) {
  const { t } = useTranslation();

  const applyRange = (r: DateRange) => {
    onFromChange(r.from);
    onToChange(r.to);
  };

  const handleFrom = (v: string) => {
    onFromChange(v);
    if (to && v > to) onToChange(v);
  };
  const handleTo = (v: string) => {
    onToChange(v);
    if (from && v < from) onFromChange(v);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        type="date"
        value={from}
        onChange={(e) => handleFrom(e.target.value)}
        className="w-36"
      />
      <span className="text-text-muted">~</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => handleTo(e.target.value)}
        className="w-36"
      />
      {presets && (
        <div className="flex items-center gap-1 ml-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyRange({ from: getTodayLocal(), to: getTodayLocal() })}
          >
            {t("common.dateFilter.today", "오늘")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyRange(getRecentDaysRange(7))}>
            {t("common.dateFilter.recent7", "최근 7일")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyRange(getThisMonthRange())}>
            {t("common.dateFilter.thisMonth", "이번 달")}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: index.ts에 export 추가**

`apps/frontend/src/components/shared/index.ts` 끝에 추가:

```ts
export { default as DateRangeFilter } from "./DateRangeFilter";
export type { DateRangeFilterProps } from "./DateRangeFilter";
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `node --test apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 6: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 7: 커밋**

```bash
git add apps/frontend/src/components/shared/DateRangeFilter.tsx apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs apps/frontend/src/components/shared/index.ts
git commit -F - <<'EOF'
feat(shared): 조회기간 공통 DateRangeFilter 추가(프리셋·범위보정)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 3: DateFilter(단일) 컴포넌트

**Files:**
- Create: `apps/frontend/src/components/shared/DateFilter.tsx`
- Modify: `apps/frontend/src/components/shared/index.ts`
- Test: `apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs` (DateFilter 검증 추가)

**Interfaces:**
- Consumes: 기존 `getTodayLocal`; `@/components/ui`의 `Input`, `Button`
- Produces:
  - `interface DateFilterProps { value: string; onChange: (v: string) => void; todayButton?: boolean; className?: string }`
  - default export `DateFilter`

- [ ] **Step 1: 실패하는 구조 테스트 추가**

`DateRangeFilter.structure.test.mjs` 끝에 append:

```js
const dfSrc = readFileSync(new URL('./DateFilter.tsx', import.meta.url), 'utf8');

test('DateFilter is a controlled single-date filter with today button', () => {
  assert.match(dfSrc, /value: string/);
  assert.match(dfSrc, /onChange: \(v: string\) => void/);
  assert.match(dfSrc, /todayButton\?: boolean/);
  const inputs = dfSrc.match(/type="date"/g) || [];
  assert.equal(inputs.length, 1);
  assert.match(dfSrc, /getTodayLocal\(\)/);
  assert.match(dfSrc, /common\.dateFilter\.today/);
});

test('shared index exports DateFilter', () => {
  assert.match(index, /export \{ default as DateFilter \} from ".\/DateFilter"/);
  assert.match(index, /export type \{ DateFilterProps \}/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`
Expected: FAIL (DateFilter.tsx 없음 / export 없음)

- [ ] **Step 3: 컴포넌트 구현**

`apps/frontend/src/components/shared/DateFilter.tsx`:

```tsx
"use client";

/**
 * @file components/shared/DateFilter.tsx
 * @description 단일 날짜 공통 조회 필터. controlled value + '오늘' 버튼.
 */
import { useTranslation } from "react-i18next";
import { Input, Button } from "@/components/ui";
import { getTodayLocal } from "@/utils/date";

export interface DateFilterProps {
  value: string;
  onChange: (v: string) => void;
  todayButton?: boolean;
  className?: string;
}

export default function DateFilter({
  value,
  onChange,
  todayButton = true,
  className = "",
}: DateFilterProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36"
      />
      {todayButton && (
        <Button size="sm" variant="ghost" onClick={() => onChange(getTodayLocal())}>
          {t("common.dateFilter.today", "오늘")}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: index.ts에 export 추가**

`apps/frontend/src/components/shared/index.ts` 끝에 추가:

```ts
export { default as DateFilter } from "./DateFilter";
export type { DateFilterProps } from "./DateFilter";
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `node --test apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 6: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 7: 커밋**

```bash
git add apps/frontend/src/components/shared/DateFilter.tsx apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs apps/frontend/src/components/shared/index.ts
git commit -F - <<'EOF'
feat(shared): 단일 날짜 공통 DateFilter 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 4: i18n 프리셋 라벨 (4파일)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json`

**Interfaces:**
- Produces: `common.dateFilter.{today,recent7,thisMonth}` 4개 언어

- [ ] **Step 1: 실패하는 검증(현재 키 없음 확인)**

Run: `grep -c '"dateFilter"' apps/frontend/src/locales/ko.json`
Expected: `0` (아직 없음)

- [ ] **Step 2: ko.json 수정**

`apps/frontend/src/locales/ko.json`의 `"common": {`(라인 22 부근) 객체 내부, 첫 키 앞 또는 `"change"` 키 근처에 추가:

```json
    "dateFilter": { "today": "오늘", "recent7": "최근 7일", "thisMonth": "이번 달" },
```

- [ ] **Step 3: en.json 수정**

`"common"` 객체 내부에 추가:

```json
    "dateFilter": { "today": "Today", "recent7": "Last 7 Days", "thisMonth": "This Month" },
```

- [ ] **Step 4: zh.json 수정**

```json
    "dateFilter": { "today": "今天", "recent7": "最近7天", "thisMonth": "本月" },
```

- [ ] **Step 5: vi.json 수정**

```json
    "dateFilter": { "today": "Hôm nay", "recent7": "7 ngày gần đây", "thisMonth": "Tháng này" },
```

- [ ] **Step 6: 검증 — 4파일 키 존재 + JSON 유효 + BOM 없음**

Run:
```bash
for f in ko en zh vi; do p="apps/frontend/src/locales/$f.json"; node -e "const o=require('fs').readFileSync('$p','utf8'); JSON.parse(o); if(o.charCodeAt(0)===0xFEFF) throw new Error('BOM'); if(!/\"dateFilter\"/.test(o)) throw new Error('missing'); console.log('$f OK')"; done
```
Expected: `ko OK` / `en OK` / `zh OK` / `vi OK`

- [ ] **Step 7: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F - <<'EOF'
i18n(common): 날짜 필터 프리셋 라벨 추가(오늘/최근7일/이번달)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 5: 파일럿 적용 — inspection/history

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/inspection/history/page.tsx`
- Test: `apps/frontend/src/app/(authenticated)/inspection/history/inspection-history.structure.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `DateRangeFilter`(`from`/`to`/`onFromChange`/`onToChange`), 기존 `getTodayLocal`
- 기존 동작 유지: `dateFrom`/`dateTo` state 이름은 그대로, 기본값 오늘 유지

배경(현재 코드):
- 로컬 함수 `function formatLocalDate(date = new Date()) {...}` 정의 후 `useState(() => formatLocalDate())`로 오늘 초기화
- JSX: `<Input type="date" value={dateFrom} .../> ~ <Input type="date" value={dateTo} .../>` (className `w-36`)
- 기존 structure test가 `formatLocalDate` 존재와 `useState(() => formatLocalDate())`를 단언 → 갱신 필요

- [ ] **Step 1: structure test를 새 구조로 갱신(실패 유도)**

`inspection-history.structure.test.mjs`의 `'inspection history defaults date range filters to today'` 테스트를 아래로 교체:

```js
test('inspection history uses shared DateRangeFilter defaulting to today', () => {
  assert.match(pageSource, /import \{ getTodayLocal \} from "@\/utils\/date"/);
  assert.match(pageSource, /DateRangeFilter/);
  assert.match(pageSource, /const\s+\[dateFrom,\s*setDateFrom\]\s*=\s*useState\(\(\)\s*=>\s*getTodayLocal\(\)\)/);
  assert.match(pageSource, /const\s+\[dateTo,\s*setDateTo\]\s*=\s*useState\(\(\)\s*=>\s*getTodayLocal\(\)\)/);
  // 로컬 중복 함수 제거됨
  assert.doesNotMatch(pageSource, /function\s+formatLocalDate/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/inspection/history/inspection-history.structure.test.mjs"`
Expected: FAIL (아직 formatLocalDate 사용 중, DateRangeFilter 미사용)

- [ ] **Step 3: page.tsx 수정 — import 추가**

상단 import 블록에 추가(기존 `@/components/shared` import가 있으면 병합, 없으면 신규 라인):

```tsx
import { DateRangeFilter } from "@/components/shared";
import { getTodayLocal } from "@/utils/date";
```

- [ ] **Step 4: page.tsx 수정 — 로컬 함수 제거 + 기본값 교체**

`formatLocalDate` 함수 정의(6줄) 전체를 삭제하고, state 초기화를 교체:

```tsx
  const [dateFrom, setDateFrom] = useState(() => getTodayLocal());
  const [dateTo, setDateTo] = useState(() => getTodayLocal());
```

- [ ] **Step 5: page.tsx 수정 — 날짜 입력 JSX 교체**

기존 블록:

```tsx
                <div className="flex items-center gap-1">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                  <span className="text-text-muted">~</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
                </div>
```

를 아래로 교체:

```tsx
                <DateRangeFilter
                  from={dateFrom}
                  to={dateTo}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                />
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/inspection/history/inspection-history.structure.test.mjs"`
Expected: PASS (전체 테스트)

- [ ] **Step 7: 타입체크 + 전체 구조 테스트**

Run:
```bash
pnpm --filter @harness/frontend exec tsc --noEmit
node --test apps/frontend/src/components/shared/DateRangeFilter.structure.test.mjs apps/frontend/src/utils/date.range.structure.test.mjs
```
Expected: tsc 에러 0건, 구조 테스트 전부 PASS

- [ ] **Step 8: dev 화면 육안 확인(사용자)**

사용자에게: `http://localhost:3002/inspection/history`에서 (1) 진입 시 시작·종료일이 오늘, (2) `오늘`/`최근 7일`/`이번 달` 클릭 시 기간 변경, (3) 조회 정상 동작 확인 요청.

- [ ] **Step 9: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/inspection/history/page.tsx" "apps/frontend/src/app/(authenticated)/inspection/history/inspection-history.structure.test.mjs"
git commit -F - <<'EOF'
refactor(inspection): 검사이력 조회기간을 공통 DateRangeFilter로 전환

formatLocalDate 로컬 중복 제거, getTodayLocal 기반 오늘 기본값 유지

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## 1단계 완료 기준

- `DateRangeFilter`/`DateFilter` 컴포넌트 + 유틸 + i18n(4파일) 완성, 구조 테스트 전부 PASS
- 파일럿(inspection/history) 공통 컴포넌트 적용 + 기본값 오늘 유지 + 육안 동작 확인
- `tsc --noEmit` 0건

## 2단계 예고 (별도 계획)

1단계 패턴 검증 후, 나머지 조회 필터 화면을 모듈 단위(material/consumables/production/equipment/inspection …)로 나눠 일괄 치환한다. `fromDate/toDate`, `startDate/endDate` 등 기존 state 이름은 유지하고 JSX만 교체. 폼 입력 날짜 칸은 제외. 각 모듈 묶음마다 structure test 갱신 + tsc + 커밋.
