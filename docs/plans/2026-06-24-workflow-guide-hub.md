# 워크플로우 가이드 허브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/workflow`를 흐름도 한 장에서, 좌측 단계 목록 + 중앙 가이드 본문 + [가이드]/[흐름도] 탭을 가진 처음 사용자용 업무 가이드 허브로 전환한다.

**Architecture:** `page.tsx`는 탭/검색/선택 상태만 가진 셸로 두고, 흐름도 렌더는 `WorkflowFlow.tsx`로 분리한다. 가이드 탭은 `WorkflowSidebar`(레인 그룹 단계 목록) + `WorkflowGuide`(단계 본문) + `WorkflowHelpInline`(help md 인라인)으로 구성한다. 단계 데이터는 `config/workflowMap.ts`에 가이드 필드(why/when/cautions/order)와 헬퍼 함수를 추가해 공급한다.

**Tech Stack:** Next.js(App Router) + React 클라이언트 컴포넌트, `@xyflow/react`, `react-i18next`, 기존 `useHelpDoc`/`MarkdownRenderer`/`findMenuCodeByPath` 재사용. 테스트는 `node:test` 기반 `.structure.test.mjs` + `tsc --noEmit`.

## Global Constraints

- 패키지 매니저는 `pnpm`. 타입 체크는 `pnpm --filter @harness/frontend exec tsc --noEmit`.
- 개발 서버가 떠 있으면 `pnpm build` 금지 — 타입 체크는 `tsc --noEmit`만 사용.
- `alert()`/`confirm()`/`prompt()` 금지. 색상/상태 텍스트 하드코딩 지양.
- i18n는 UI 라벨만 `ko/en/zh/vi` 4파일 동시 수정. JSON에 UTF-8 BOM 절대 금지.
- 가이드 본문(why/when/cautions)은 한국어로 `workflowMap.ts`에 직접 작성(기존 노드 텍스트 패턴과 동일).
- `as any` 금지, `catch (error: unknown)` 유지.
- 커밋은 파일 단위 `git add`. 멀티라인 커밋 메시지는 임시파일 + `-F`. push는 하지 않는다.
- 프론트 개발 서버 포트는 `3002`.

---

### Task 1: 데이터 모델 확장 — 가이드 필드 + 헬퍼 함수

**Files:**
- Modify: `apps/frontend/src/config/workflowMap.ts`
- Test: `apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs`

**Interfaces:**
- Produces:
  - `WorkflowActivityNode`에 선택 필드 `why?: string; when?: string; cautions?: string[]; order?: number; helpRefs?: { menuCode: string; audience: "user" | "operator" }[]`
  - `getNodesByLane(): { lane: WorkflowLane; nodes: WorkflowActivityNode[] }[]` — 레인 순서대로, 각 레인 내 노드는 `order ?? x` 오름차순 정렬
  - `getVisibleNodeIds(query: string, activeLaneIds: Set<WorkflowLaneId>): Set<string>` — 레인 활성 + 검색어 매칭 노드 id 집합
  - `getPreviousNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[]`
  - `getNextNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[]`

- [ ] **Step 1: 인터페이스에 가이드 필드 추가**

`apps/frontend/src/config/workflowMap.ts`의 `WorkflowActivityNode` 인터페이스(현재 라인 22-33)에 필드를 추가한다. 기존 필드는 그대로 둔다.

```ts
export interface WorkflowActivityNode {
  id: string;
  lane: WorkflowLaneId;
  activity: string;
  summary: string;
  detail: string;
  x: number;
  dataObjects: string[];
  routes: WorkflowRoute[];
  inputs: string[];
  outputs: string[];
  /** 가이드: 이 업무를 왜 하는가 (1~2문장) */
  why?: string;
  /** 가이드: 선행조건 / 언제 수행하나 */
  when?: string;
  /** 가이드: 자주 하는 실수 · 주의점 */
  cautions?: string[];
  /** 좌측 목록 진행번호 (레인 내 순서). 미지정 시 x 좌표 순서 */
  order?: number;
  /** help md 연결 override. 미지정 시 routes에서 메뉴코드 자동 도출 */
  helpRefs?: { menuCode: string; audience: "user" | "operator" }[];
}
```

- [ ] **Step 2: 주 흐름 노드에 가이드 본문 작성**

아래 매핑대로 각 노드 객체에 `order`, `why`, `when`, `cautions`를 추가한다(해당 `id`의 객체 안, 기존 필드 뒤에 삽입). 추적·역처리 레인(`traceability`, `material-reversal`, `shipping-reversal`)은 v1에서 본문을 비워 둔다(필드 미추가 허용).

```
purchase-order: order 1
  why: "입하의 출처가 되는 구매 근거를 만들어 어떤 품목을 얼마나 받을지 사전에 확정한다."
  when: "거래처에 자재를 발주할 때. 입하 등록보다 먼저 수행한다."
  cautions: ["품목·수량·납기·거래처를 정확히 입력해야 입하 잔량 계산이 맞는다.", "발주 없이 입하하면 잔량 추적이 끊긴다."]
arrival-register: order 2
  why: "현장에 실제 도착한 자재를 시스템 재고 흐름으로 진입시키고 입하번호를 만든다."
  when: "공장에 자재가 물리적으로 도착했을 때."
  cautions: ["PO 잔량을 초과해 입하하지 않는다.", "제조사·창고를 잘못 고르면 이후 추적과 입고가 어긋난다."]
arrival-review: order 3
  why: "입하 건의 시리얼·제조사·후속 진행 여부를 확인하고 잘못된 입하를 취소할 근거를 본다."
  when: "입하 등록 직후 또는 IQC·입고 진행 상태를 점검할 때."
  cautions: ["뒤 공정(IQC·라벨·입고)이 시작된 입하는 취소할 수 없다."]
iqc-policy: order 1
  why: "품목이 어떤 항목·AQL 기준으로 검사될지 사전에 정해 IQC 판정의 기준을 만든다."
  when: "신규 품목 도입 시 또는 검사 기준 변경 시. IQC 판정보다 먼저."
  cautions: ["기준이 없으면 샘플수·Ac/Re를 계산할 수 없어 IQC가 막힌다."]
iqc-inspection: order 2
  why: "입하 자재가 생산에 투입 가능한 품질인지 PASS/FAIL로 확정한다."
  when: "입하 등록 후, 라벨 발행·입고 전."
  cautions: ["FAIL은 라벨·입고로 넘기지 말고 불용·재검토로 분기한다.", "입하번호·품목 단위로 판정해야 한다."]
material-label: order 3
  why: "외부 입하 정보를 현장에서 스캔 가능한 내부 시리얼(MAT UID)로 전환한다."
  when: "IQC PASS 직후."
  cautions: ["자동입고 설정이 있으면 라벨 발행이 입고까지 이어지니 중복 입고에 주의한다."]
material-receive: order 4
  why: "라벨 발행된 자재를 실제 사용 가능한 창고 재고로 확정한다."
  when: "라벨 발행 후, 출고·공정투입 전."
  cautions: ["입고해야 출고요청·공정투입·LOT 분할/병합이 가능하다."]
lot-control: order 5
  why: "입고 LOT을 조회하고 분할·병합·보류·폐기로 재고 단위를 재구성한다."
  when: "생산 투입 단위 조정이나 보류가 필요할 때."
  cautions: ["분할·병합은 원본 LOT을 폐기하고 새 LOT을 발행하는 재가공이다."]
material-request: order 6
  why: "생산에 필요한 자재를 창고에서 공정으로 요청한다."
  when: "작업지시 실행 전 자재가 필요할 때."
  cautions: ["요청 수량은 작업지시 소요량 기준으로 잡는다."]
material-issue: order 7
  why: "승인된 요청 또는 스캔으로 자재를 생산 공정에 실제 투입하고 재고를 차감한다."
  when: "출고요청 승인 후 또는 현장 스캔 시점."
  cautions: ["잘못된 품목 스캔은 출고 전에 차단되어야 한다."]
spec-setup: order 1
  why: "도면·Revision·회로별 제조 조건 등 제품 제조 기준을 정리한다."
  when: "신제품·설계 변경 시. 생산계획·키팅보다 먼저."
  cautions: ["Revision 관리를 놓치면 잘못된 도면으로 생산된다."]
production-plan: order 2
  why: "수요와 CAPA를 기준으로 생산 품목·수량·우선순위를 계획한다."
  when: "작업지시 발행 전."
  cautions: ["CAPA를 넘는 계획은 납기 지연으로 이어진다."]
job-order: order 3
  why: "현장에 실행할 생산 작업을 라우팅·BOM·설비·수량과 묶어 지시한다."
  when: "생산계획 확정 후."
  cautions: ["작업지시가 키오스크·실적의 기준이라 잘못 묶이면 현장이 멈춘다."]
input-kiosk-start: order 4
  why: "작업지시를 현장에서 스캔해 실제 생산 실행을 시작하는 진입점이다."
  when: "작업지시가 현장에 내려온 뒤 작업 시작 시."
  cautions: ["작업자·설비·바코드 스캔이 맞아야 실적이 올바르게 집계된다."]
subprocess-kitting: order 5
  why: "이전 공정 SG를 소비하고 회로별 새 SG를 발행해 SG 계보를 잇는다."
  when: "서브공정(키팅) 단계에서."
  cautions: ["단순 실적이 아니라 SG 계보를 잇는 흐름이라, 이전 SG 투입을 빠뜨리면 추적이 끊긴다."]
assembly-input: order 6
  why: "SG·자재를 투입해 완제품 또는 다음 공정 실적과 FG/SG 라벨을 남긴다."
  when: "키오스크 시작 이후 실제 조립 시점."
  cautions: ["자재 투입 이력이 빠지면 BOM 소요와 재고가 어긋난다."]
production-result: order 7
  why: "작업지시별 양품·불량·진행률을 집계해 완료·제품재고·출하 가능 여부의 기준을 만든다."
  when: "조립·실적 등록 후."
  cautions: ["작업지시 완료가 이 실적을 기준으로 판단된다."]
process-inspection: order 1
  why: "생산 중·후 품질 항목을 검사해 제품 통과 여부와 추적 근거를 만든다."
  when: "생산 실적 등록 후."
  cautions: ["FAIL은 불량·재작업으로, PASS는 제품 입고로 분기된다."]
defect-rework: order 2
  why: "불량을 등록하고 재작업·수리·재검사로 다시 합격 여부를 확인한다."
  when: "검사 FAIL 발생 시."
  cautions: ["불량코드·등급을 정확히 남겨야 품질 분석이 가능하다."]
oqc: order 3
  why: "출하 전 박스·제품 단위 최종 품질 게이트를 통과시킨다."
  when: "포장 마감 후, 팔레트·출하 전."
  cautions: ["PASS 박스만 팔레트·출하로 넘기는 정책을 둘 수 있다."]
product-receive: order 1
  why: "생산 완료·검사 통과 제품을 출하 가능한 제품재고로 확정한다."
  when: "생산 실적·공정검사 PASS 후."
  cautions: ["제품 입고가 돼야 포장·출하 대상이 된다."]
packing: order 2
  why: "검사 합격 FG 시리얼을 박스에 담아 출하 물류 단위를 만든다."
  when: "제품 입고 후."
  cautions: ["박스 마감 이후 OQC 요청과 팔레트 적재로 넘어간다."]
palletize: order 3
  why: "출하 가능한 박스를 팔레트로 묶어 출하 단위를 구성한다."
  when: "OQC PASS 후, 출하확정 전."
  cautions: ["출하지시와 연결된 팔레트만 실제 출하로 넘어간다."]
shipping-order: order 4
  why: "고객에게 출하할 품목·수량을 확정한다."
  when: "고객 주문 확정 시."
  cautions: ["확정 지시 기준으로 박스·팔레트 출하가 수행된다."]
shipping-confirm: order 5
  why: "박스·팔레트를 실제 출하 처리하고 제품재고를 차감한다."
  when: "출하지시 확정·출하 단위 준비 후."
  cautions: ["재고 차감·상태 전환·출하수량 갱신이 한 흐름으로 묶인다."]
shipping-history: order 6
  why: "출하지시와 출하 완료 결과를 조회하고 취소·추적으로 연결한다."
  when: "출하확정 후."
  cautions: ["취소·추적성 조회의 진입점이다."]
```

예시(`purchase-order` 노드에 적용한 모습):

```ts
  {
    id: "purchase-order",
    lane: "purchase-arrival",
    activity: "발주 등록",
    summary: "거래처에 요청한 품목과 수량을 PO로 확정합니다.",
    detail: "입하의 출처가 되는 구매오더를 만들고 라인별 품목, 수량, 납기, 거래처를 관리합니다.",
    x: 0,
    dataObjects: ["PURCHASE_ORDERS", "PURCHASE_ORDER_ITEMS"],
    routes: [
      { label: "발주관리", path: "/material/po" },
      { label: "발주현황", path: "/material/po-status" },
    ],
    inputs: ["거래처", "품목", "발주수량"],
    outputs: ["PO 라인", "입하 가능 잔량"],
    order: 1,
    why: "입하의 출처가 되는 구매 근거를 만들어 어떤 품목을 얼마나 받을지 사전에 확정한다.",
    when: "거래처에 자재를 발주할 때. 입하 등록보다 먼저 수행한다.",
    cautions: [
      "품목·수량·납기·거래처를 정확히 입력해야 입하 잔량 계산이 맞는다.",
      "발주 없이 입하하면 잔량 추적이 끊긴다.",
    ],
  },
```

- [ ] **Step 3: 헬퍼 함수 추가**

`workflowMap.ts` 파일 맨 끝(`workflowEdges` 정의 뒤)에 헬퍼를 추가한다.

```ts
const _laneOrder = new Map(workflowLanes.map((lane, i) => [lane.id, i]));
const _nodeById = new Map(workflowNodes.map((n) => [n.id, n]));

/** 레인 순서대로, 각 레인 내 노드는 order(없으면 x) 오름차순 */
export function getNodesByLane(): { lane: WorkflowLane; nodes: WorkflowActivityNode[] }[] {
  return workflowLanes.map((lane) => ({
    lane,
    nodes: workflowNodes
      .filter((n) => n.lane === lane.id)
      .sort((a, b) => (a.order ?? a.x) - (b.order ?? b.x)),
  }));
}

/** 레인 활성 + 검색어 매칭 노드 id 집합 */
export function getVisibleNodeIds(query: string, activeLaneIds: Set<WorkflowLaneId>): Set<string> {
  const q = query.trim().toLowerCase();
  return new Set(
    workflowNodes
      .filter((n) => activeLaneIds.has(n.lane))
      .filter((n) => {
        if (!q) return true;
        const hay = [
          n.activity, n.summary, n.detail, n.why ?? "", n.when ?? "",
          ...(n.cautions ?? []),
          ...n.dataObjects, ...n.inputs, ...n.outputs,
          ...n.routes.map((r) => r.label),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .map((n) => n.id),
  );
}

export function getPreviousNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[] {
  return workflowEdges
    .filter((e) => e.target === nodeId)
    .map((e) => ({ edge: e, node: _nodeById.get(e.source) }))
    .filter((x): x is { edge: WorkflowBusinessEdge; node: WorkflowActivityNode } => Boolean(x.node));
}

export function getNextNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[] {
  return workflowEdges
    .filter((e) => e.source === nodeId)
    .map((e) => ({ edge: e, node: _nodeById.get(e.target) }))
    .filter((x): x is { edge: WorkflowBusinessEdge; node: WorkflowActivityNode } => Boolean(x.node));
}

void _laneOrder;
```

(주: `_laneOrder`는 향후 정렬 확장용으로 둔다. 사용하지 않으면 이 줄과 `void _laneOrder;`를 함께 제거해도 된다.)

- [ ] **Step 4: 구조 테스트에 가이드 필드 검증 추가**

`workflow-business-map.structure.test.mjs` 끝에 테스트를 추가한다.

```js
test("/workflow map carries onboarding guide fields and helpers", () => {
  assert.match(mapSource, /why\?: string/);
  assert.match(mapSource, /cautions\?: string\[\]/);
  assert.match(mapSource, /export function getNodesByLane/);
  assert.match(mapSource, /export function getVisibleNodeIds/);
  assert.match(mapSource, /export function getPreviousNodes/);
  assert.match(mapSource, /export function getNextNodes/);
  // 주 흐름 노드 본문 작성 확인
  assert.match(mapSource, /입하의 출처가 되는 구매 근거/);
  assert.match(mapSource, /작업지시를 현장에서 스캔해 실제 생산 실행을 시작/);
});
```

- [ ] **Step 5: 테스트 실행 (초기 일부 실패 확인 후 통과)**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`
Expected: Step 1-3 적용 후 새 테스트 PASS. 기존 테스트는 아직 page.tsx 미변경이므로 전부 PASS.

- [ ] **Step 6: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 7: 커밋**

```bash
git add apps/frontend/src/config/workflowMap.ts "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"
git commit -F <임시파일>
# 메시지: "feat(workflow): 가이드 필드와 단계 헬퍼를 workflowMap에 추가"
```

---

### Task 2: `WorkflowHelpInline` — help md 인라인 아코디언

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowHelpInline.tsx`

**Interfaces:**
- Consumes: `useHelpDoc(menuCode, tab)` (`@/hooks/useHelpDoc`), `MarkdownRenderer` (`@/components/help/MarkdownRenderer`), `findMenuCodeByPath` (`@/config/menuConfig`), `WorkflowActivityNode` (`@/config/workflowMap`)
- Produces: `export default function WorkflowHelpInline({ node }: { node: WorkflowActivityNode })`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import MarkdownRenderer from "@/components/help/MarkdownRenderer";
import type { WorkflowActivityNode } from "@/config/workflowMap";

type HelpAudience = "user" | "operator";

interface HelpRef {
  key: string;
  label: string;
  menuCode: string;
  audience: HelpAudience;
}

/** node.helpRefs 우선, 없으면 routes에서 메뉴코드 자동 도출 */
function deriveHelpRefs(node: WorkflowActivityNode): HelpRef[] {
  if (node.helpRefs && node.helpRefs.length > 0) {
    return node.helpRefs.map((ref) => ({
      key: `${ref.menuCode}:${ref.audience}`,
      label: ref.menuCode,
      menuCode: ref.menuCode,
      audience: ref.audience,
    }));
  }
  const seen = new Set<string>();
  const refs: HelpRef[] = [];
  for (const route of node.routes) {
    const code = findMenuCodeByPath(route.path);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    refs.push({ key: code, label: route.label, menuCode: code, audience: "user" });
  }
  return refs;
}

function HelpItem({ refItem }: { refItem: HelpRef }) {
  const [open, setOpen] = useState(false);
  const { content, loading, notFound } = useHelpDoc(refItem.menuCode, refItem.audience);

  // 도움말이 없으면 항목 자체를 숨김
  if (notFound && !loading) return null;

  return (
    <div className="rounded border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-text hover:bg-muted"
      >
        {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="flex-1 truncate">{refItem.label}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          {loading ? (
            <div className="py-4 text-center text-xs text-text-muted">불러오는 중…</div>
          ) : content ? (
            <MarkdownRenderer content={content} />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function WorkflowHelpInline({ node }: { node: WorkflowActivityNode }) {
  const refs = deriveHelpRefs(node);
  if (refs.length === 0) return null;
  return (
    <div className="space-y-2">
      {refs.map((r) => (
        <HelpItem key={r.key} refItem={r} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowHelpInline.tsx"
git commit -F <임시파일>
# 메시지: "feat(workflow): help md 인라인 아코디언 컴포넌트 추가"
```

---

### Task 3: `WorkflowGuide` — 중앙 가이드 본문

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowGuide.tsx`

**Interfaces:**
- Consumes: `workflowLanes`, `getPreviousNodes`, `getNextNodes`, `WorkflowActivityNode` (`@/config/workflowMap`); `WorkflowHelpInline` (Task 2); `Button` (`@/components/ui`); `useRouter` (`next/navigation`)
- Produces: `export default function WorkflowGuide({ node, onSelect }: { node: WorkflowActivityNode; onSelect: (id: string) => void })`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock, Database, ExternalLink, HelpCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui";
import {
  workflowLanes,
  getPreviousNodes,
  getNextNodes,
  type WorkflowActivityNode,
} from "@/config/workflowMap";
import WorkflowHelpInline from "./WorkflowHelpInline";

const laneById = new Map(workflowLanes.map((l) => [l.id, l]));

export default function WorkflowGuide({
  node,
  onSelect,
}: {
  node: WorkflowActivityNode;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const lane = laneById.get(node.lane);
  const previous = getPreviousNodes(node.id);
  const next = getNextNodes(node.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      {/* 헤더 */}
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane?.color }} />
          {lane?.title}
          {typeof node.order === "number" && <span className="text-text-muted">· {node.order}단계</span>}
        </div>
        <h2 className="text-2xl font-semibold">{node.activity}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{node.detail}</p>
      </div>

      {/* 왜 / 언제 / 주의점 */}
      {node.why && (
        <GuideBlock icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title="왜 하는가">
          <p className="text-sm leading-6 text-text">{node.why}</p>
        </GuideBlock>
      )}
      {node.when && (
        <GuideBlock icon={<Clock className="h-4 w-4 text-sky-500" />} title="언제 하는가">
          <p className="text-sm leading-6 text-text">{node.when}</p>
        </GuideBlock>
      )}
      {node.cautions && node.cautions.length > 0 && (
        <GuideBlock icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} title="주의점">
          <ul className="space-y-1">
            {node.cautions.map((c) => (
              <li key={c} className="text-sm leading-6 text-text">- {c}</li>
            ))}
          </ul>
        </GuideBlock>
      )}

      {/* 입력 / 산출 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title="입력">
          <ul className="space-y-1">
            {node.inputs.map((i) => (
              <li key={i} className="text-xs text-text-muted">- {i}</li>
            ))}
          </ul>
        </GuideBlock>
        <GuideBlock title="산출">
          <ul className="space-y-1">
            {node.outputs.map((o) => (
              <li key={o} className="text-xs text-text-muted">- {o}</li>
            ))}
          </ul>
        </GuideBlock>
      </section>

      {/* 화면 바로가기 */}
      <GuideBlock title="화면 바로가기">
        <div className="space-y-2">
          {node.routes.map((route) => (
            <Button
              key={route.path}
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => router.push(route.path)}
            >
              <span>{route.label}</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </GuideBlock>

      {/* 관련 화면 도움말 (help md 인라인) */}
      <GuideBlock icon={<HelpCircle className="h-4 w-4 text-primary" />} title="관련 화면 도움말">
        <WorkflowHelpInline node={node} />
      </GuideBlock>

      {/* 생성/변경 데이터 */}
      <GuideBlock title="생성/변경 데이터">
        <div className="flex flex-wrap gap-1.5">
          {node.dataObjects.map((obj) => (
            <span key={obj} className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-muted">
              <Database className="mr-1 inline h-3 w-3" />
              {obj}
            </span>
          ))}
        </div>
      </GuideBlock>

      {/* 선행 / 후행 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title="선행 업무">
          {previous.length === 0 ? (
            <p className="text-xs text-text-muted">이 맵의 시작 업무입니다.</p>
          ) : (
            <div className="space-y-2">
              {previous.map(({ edge, node: p }) => (
                <RelationButton key={edge.id} label={p.activity} edgeLabel={edge.label} onClick={() => onSelect(p.id)} />
              ))}
            </div>
          )}
        </GuideBlock>
        <GuideBlock title="후행 업무">
          {next.length === 0 ? (
            <p className="text-xs text-text-muted">이 맵의 종료 또는 조회 업무입니다.</p>
          ) : (
            <div className="space-y-2">
              {next.map(({ edge, node: n }) => (
                <RelationButton key={edge.id} label={n.activity} edgeLabel={edge.label} onClick={() => onSelect(n.id)} />
              ))}
            </div>
          )}
        </GuideBlock>
      </section>
    </div>
  );
}

function GuideBlock({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function RelationButton({ label, edgeLabel, onClick }: { label: string; edgeLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary/60"
    >
      <span>
        <span className="font-semibold text-text">{label}</span>
        <span className="ml-2 text-text-muted">{edgeLabel}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
    </button>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건. (만약 `@/components/ui`에 `Button`이 없다면 기존 `page.tsx`의 import 경로와 동일하게 맞춘다 — 현재 page.tsx도 `import { Button } from "@/components/ui";` 사용 중이므로 그대로 유효.)

- [ ] **Step 3: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowGuide.tsx"
git commit -F <임시파일>
# 메시지: "feat(workflow): 단계 가이드 본문 컴포넌트 추가"
```

---

### Task 4: `WorkflowSidebar` — 레인 그룹 단계 목록

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowSidebar.tsx`

**Interfaces:**
- Consumes: `getNodesByLane`, `getVisibleNodeIds`, `workflowLanes`, `WorkflowLaneId` (`@/config/workflowMap`)
- Produces: `export default function WorkflowSidebar({ query, selectedNodeId, onSelect }: { query: string; selectedNodeId: string; onSelect: (id: string) => void })`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  getNodesByLane,
  getVisibleNodeIds,
  workflowLanes,
  type WorkflowLaneId,
} from "@/config/workflowMap";

const allLaneIds = new Set<WorkflowLaneId>(workflowLanes.map((l) => l.id));

export default function WorkflowSidebar({
  query,
  selectedNodeId,
  onSelect,
}: {
  query: string;
  selectedNodeId: string;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<WorkflowLaneId>>(() => new Set());
  const visibleIds = useMemo(() => getVisibleNodeIds(query, allLaneIds), [query]);
  const groups = useMemo(() => getNodesByLane(), []);

  const toggleLane = (id: WorkflowLaneId) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav className="h-full overflow-y-auto border-r border-border bg-surface">
      {groups.map(({ lane, nodes }) => {
        const shown = nodes.filter((n) => visibleIds.has(n.id));
        if (query.trim() && shown.length === 0) return null;
        const isCollapsed = collapsed.has(lane.id) && !query.trim();
        return (
          <div key={lane.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => toggleLane(lane.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
              <span className="flex-1 truncate">{lane.title}</span>
              <span className="text-xs text-text-muted">{shown.length}</span>
            </button>
            {!isCollapsed && (
              <ul className="pb-1">
                {shown.map((n) => {
                  const active = n.id === selectedNodeId;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(n.id)}
                        className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-sm transition-colors ${
                          active ? "bg-primary/10 font-semibold text-primary" : "text-text hover:bg-muted"
                        }`}
                      >
                        {typeof n.order === "number" && (
                          <span className="w-4 shrink-0 text-xs text-text-muted">{n.order}</span>
                        )}
                        <span className="truncate">{n.activity}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowSidebar.tsx"
git commit -F <임시파일>
# 메시지: "feat(workflow): 레인 그룹 단계 목록 사이드바 추가"
```

---

### Task 5: `WorkflowFlow` — 흐름도 탭 분리

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowFlow.tsx`

**Interfaces:**
- Consumes: `@xyflow/react`, `workflowEdges`, `workflowLanes`, `workflowNodes`, `getVisibleNodeIds`, `WorkflowActivityNode`, `WorkflowLane`, `WorkflowLaneId` (`@/config/workflowMap`)
- Produces: `export default function WorkflowFlow({ selectedNodeId, onSelect, query }: { selectedNodeId: string; onSelect: (id: string) => void; query: string })`

- [ ] **Step 1: 현재 page.tsx의 흐름도 로직을 컴포넌트로 이전**

현재 `page.tsx`(라인 96-289)의 React Flow 관련 로직(`flowNodes`, `flowEdges`, `ActivityNode`, `LaneNode`, 레인 토글, `showAllRelations`, `<ReactFlow>` 블록)을 이 컴포넌트로 옮긴다. 차이점: `selectedNodeId`/`onSelect`/`query`는 props로 받고, `activeLaneIds`와 `showAllRelations`는 내부 상태로 둔다. 검색 필터는 `getVisibleNodeIds(query, activeLaneIds)`로 일원화한다.

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Eye, EyeOff, Filter } from "lucide-react";
import {
  workflowEdges,
  workflowLanes,
  workflowNodes,
  getVisibleNodeIds,
  type WorkflowActivityNode,
  type WorkflowLane,
  type WorkflowLaneId,
} from "@/config/workflowMap";

interface ActivityNodeData extends Record<string, unknown> {
  activity: WorkflowActivityNode;
  lane: WorkflowLane;
  selected: boolean;
  dimmed: boolean;
}
interface LaneNodeData extends Record<string, unknown> {
  lane: WorkflowLane;
}
type ActivityFlowNode = Node<ActivityNodeData, "activity">;
type LaneFlowNode = Node<LaneNodeData, "lane">;
type WorkflowFlowNode = ActivityFlowNode | LaneFlowNode;

const laneById = new Map(workflowLanes.map((l) => [l.id, l]));
const nodeTypes = { activity: ActivityNode, lane: LaneNode };

export default function WorkflowFlow({
  selectedNodeId,
  onSelect,
  query,
}: {
  selectedNodeId: string;
  onSelect: (id: string) => void;
  query: string;
}) {
  const [activeLaneIds, setActiveLaneIds] = useState<Set<WorkflowLaneId>>(
    () => new Set(workflowLanes.map((l) => l.id)),
  );
  const [showAllRelations, setShowAllRelations] = useState(false);

  const visibleIds = useMemo(() => getVisibleNodeIds(query, activeLaneIds), [query, activeLaneIds]);

  const flowNodes: WorkflowFlowNode[] = useMemo(() => {
    const lanes: LaneFlowNode[] = workflowLanes.map((lane) => ({
      id: `lane-${lane.id}`,
      type: "lane",
      position: { x: -260, y: lane.y - 50 },
      data: { lane },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      zIndex: -1,
      style: { width: 3100, height: 152 },
    }));
    const acts: ActivityFlowNode[] = workflowNodes.map((activity) => {
      const lane = laneById.get(activity.lane)!;
      const visible = visibleIds.has(activity.id);
      return {
        id: activity.id,
        type: "activity",
        position: { x: activity.x, y: lane.y },
        data: { activity, lane, selected: activity.id === selectedNodeId, dimmed: !visible },
        hidden: !visible,
        draggable: false,
      };
    });
    return [...lanes, ...acts];
  }, [selectedNodeId, visibleIds]);

  const flowEdges: Edge[] = useMemo(() => {
    return workflowEdges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .filter((e) => {
        if (e.kind === "normal" || e.kind === "branch") return true;
        return showAllRelations || e.source === selectedNodeId || e.target === selectedNodeId;
      })
      .map((edge) => {
        const isReversal = edge.kind === "reversal";
        const isReference = edge.kind === "reference";
        const isFocused = edge.source === selectedNodeId || edge.target === selectedNodeId;
        const color = isReversal ? "#64748b" : isReference ? "#0891b2" : edge.kind === "branch" ? "#d97706" : "#2563eb";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          label: isFocused ? edge.label : undefined,
          animated: isFocused && (isReversal || isReference),
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: isFocused ? 2.4 : 1.7,
            opacity: isReference || isReversal ? 0.76 : 0.9,
            strokeDasharray: isReversal ? "7 5" : isReference ? "4 4" : undefined,
          },
          labelStyle: { fill: "#334155", fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: "#ffffff", fillOpacity: 0.88 },
        } satisfies Edge;
      });
  }, [selectedNodeId, showAllRelations, visibleIds]);

  const toggleLane = (laneId: WorkflowLaneId) =>
    setActiveLaneIds((cur) => {
      const next = new Set(cur);
      if (next.has(laneId) && next.size > 1) next.delete(laneId);
      else next.add(laneId);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs text-text-muted">
          <Filter className="h-3.5 w-3.5" />
          레인
        </span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {workflowLanes.map((lane) => {
            const active = activeLaneIds.has(lane.id);
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => toggleLane(lane.id)}
                className={`h-8 shrink-0 rounded border px-2.5 text-xs font-semibold transition-colors ${
                  active ? "border-transparent text-white" : "border-border bg-card text-text-muted hover:bg-muted"
                }`}
                style={active ? { backgroundColor: lane.color } : undefined}
              >
                {lane.title}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAllRelations((v) => !v)}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-border bg-card px-2.5 text-xs font-semibold text-text-muted hover:bg-muted"
        >
          {showAllRelations ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showAllRelations ? "보조 연결 숨김" : "보조 연결 보기"}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          className="h-full w-full"
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 180, y: 28, zoom: 0.62 }}
          minZoom={0.16}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          onNodeClick={(_, node) => {
            if (node.type === "activity") onSelect(node.id);
          }}
        >
          <Background gap={28} />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function ActivityNode({ data }: NodeProps<ActivityFlowNode>) {
  return (
    <button
      type="button"
      className={`w-[210px] rounded-lg border bg-card text-left shadow-sm transition-all ${
        data.selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60 hover:shadow-md"
      } ${data.dimmed ? "opacity-35" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-white" style={{ backgroundColor: data.lane.color }} />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-white" style={{ backgroundColor: data.lane.color }} />
      <div className="rounded-t-lg px-3 py-2 text-white" style={{ backgroundColor: data.lane.color }}>
        <div className="truncate text-[13px] font-semibold">{data.activity.activity}</div>
      </div>
      <div className="space-y-2 px-3 py-2">
        <p className="line-clamp-2 min-h-[34px] text-xs leading-4 text-text-muted">{data.activity.summary}</p>
        <div className="flex flex-wrap gap-1">
          {data.activity.dataObjects.slice(0, 3).map((object) => (
            <span key={object} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              {object}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-border/70 bg-surface/55">
      <div className="flex h-full items-center gap-3 px-4">
        <div className="h-16 w-1.5 rounded-full" style={{ backgroundColor: data.lane.color }} />
        <div className="w-[190px]">
          <div className="text-sm font-semibold">{data.lane.title}</div>
          <div className="mt-1 text-[11px] leading-4 text-text-muted">{data.lane.description}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건. (`page.tsx`는 아직 옛 코드라 같이 컴파일되지만, 중복 정의는 파일 스코프라 충돌 없음.)

- [ ] **Step 3: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowFlow.tsx"
git commit -F <임시파일>
# 메시지: "feat(workflow): 흐름도를 WorkflowFlow 컴포넌트로 분리"
```

---

### Task 6: `page.tsx` 재작성 — 셸 + 탭 + 구조 테스트 갱신

**Files:**
- Modify(전면 교체): `apps/frontend/src/app/(authenticated)/workflow/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs`

**Interfaces:**
- Consumes: `WorkflowSidebar` (Task 4), `WorkflowGuide` (Task 3), `WorkflowFlow` (Task 5), `workflowNodes`, `WorkflowActivityNode` (`@/config/workflowMap`)

- [ ] **Step 1: page.tsx 전면 교체**

```tsx
"use client";

/**
 * @file src/app/(authenticated)/workflow/page.tsx
 * @description 처음 사용자를 위한 업무 가이드 허브 — 좌측 단계 목록 + 중앙 가이드 + 흐름도 탭
 */

import { useState } from "react";
import { GitBranch, LayoutList, Search, Workflow } from "lucide-react";
import { workflowNodes, type WorkflowActivityNode } from "@/config/workflowMap";
import WorkflowSidebar from "./components/WorkflowSidebar";
import WorkflowGuide from "./components/WorkflowGuide";
import WorkflowFlow from "./components/WorkflowFlow";

type WorkflowTab = "guide" | "flow";

const nodeById = new Map(workflowNodes.map((n) => [n.id, n]));

export default function WorkflowPage() {
  const [tab, setTab] = useState<WorkflowTab>("guide");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(workflowNodes[0]?.id ?? "");

  const selectedNode: WorkflowActivityNode | undefined = nodeById.get(selectedNodeId) ?? workflowNodes[0];

  const selectFromFlow = (id: string) => {
    setSelectedNodeId(id);
    setTab("guide");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-text">
      {/* 헤더 */}
      <header className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">업무 가이드</h1>
              <p className="truncate text-xs text-text-muted">
                처음 사용자를 위한 단계별 업무 지침과 화면 바로가기를 제공합니다.
              </p>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <TabButton active={tab === "guide"} onClick={() => setTab("guide")} icon={<LayoutList className="h-3.5 w-3.5" />}>
              가이드
            </TabButton>
            <TabButton active={tab === "flow"} onClick={() => setTab("flow")} icon={<Workflow className="h-3.5 w-3.5" />}>
              흐름도
            </TabButton>
          </div>
        </div>
        <div className="mt-3">
          <label className="relative block w-[360px] max-w-[44vw]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="업무, 화면, 데이터 객체 검색"
              className="h-9 w-full rounded border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </header>

      {/* 본문 */}
      {tab === "guide" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
          <WorkflowSidebar query={query} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
          <main className="min-h-0 overflow-y-auto" data-workflow-detail-panel="true">
            {selectedNode ? (
              <WorkflowGuide node={selectedNode} onSelect={setSelectedNodeId} />
            ) : (
              <div className="p-5 text-sm text-text-muted">업무 단계를 선택하세요.</div>
            )}
          </main>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkflowFlow selectedNodeId={selectedNodeId} onSelect={selectFromFlow} query={query} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
        active ? "bg-primary text-white" : "text-text-muted hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: 구조 테스트 갱신**

흐름도 관련 단언이 `page.tsx`가 아니라 `WorkflowFlow.tsx`를 읽도록 바꾸고, 가이드 본문 단언은 `WorkflowGuide.tsx`를 읽도록 한다. 파일 상단 소스 로드부와 해당 테스트를 아래로 교체한다.

기존 라인 5-6 아래에 소스 로드를 추가:

```js
const flowSource = fs.readFileSync(
  "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowFlow.tsx",
  "utf8",
);
const guideSource = fs.readFileSync(
  "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowGuide.tsx",
  "utf8",
);
```

다음 테스트들을 교체한다:

```js
test("/workflow renders an interactive React Flow business map", () => {
  assert.match(flowSource, /@xyflow\/react/);
  assert.match(flowSource, /ReactFlow/);
  assert.match(flowSource, /Controls/);
  assert.match(flowSource, /Background/);
});

test("/workflow is static business guidance, not a live count dashboard", () => {
  assert.doesNotMatch(pageSource, /\/workflow\/summary/);
  assert.doesNotMatch(pageSource, /pendingCnt|activeCnt|doneCnt|reverseCnt/);
  assert.match(flowSource, /workflowNodes/);
  assert.match(flowSource, /workflowEdges/);
  assert.match(mapSource, /workflowLanes/);
});

test("/workflow keeps secondary relations out of the default visual noise", () => {
  assert.match(flowSource, /showAllRelations/);
  assert.match(flowSource, /보조 연결 보기/);
  assert.match(flowSource, /edge\.kind === "normal" \|\| edge\.kind === "branch"/);
});

test("/workflow shows input kiosk as the production floor start point", () => {
  assert.match(mapSource, /id: "input-kiosk-start"/);
  assert.match(mapSource, /activity: "조립실적\(키오스크\)"/);
  assert.match(mapSource, /path: "\/production\/input-kiosk"/);
  assert.match(mapSource, /source: "job-order", target: "input-kiosk-start", label: "현장 시작"/);
  assert.doesNotMatch(mapSource, /source: "job-order", target: "subprocess-kitting"/);
});

test("/workflow has a guide hub with tabs, sidebar and inline help", () => {
  assert.match(pageSource, /selectedNodeId/);
  assert.match(pageSource, /data-workflow-detail-panel/);
  assert.match(pageSource, /WorkflowSidebar/);
  assert.match(pageSource, /WorkflowGuide/);
  assert.match(pageSource, /WorkflowFlow/);
  assert.match(pageSource, /가이드/);
  assert.match(pageSource, /흐름도/);
  assert.match(guideSource, /router\.push/);
  assert.match(guideSource, /화면 바로가기/);
  assert.match(guideSource, /관련 화면 도움말/);
  assert.match(guideSource, /왜 하는가/);
});
```

(기존 `test("/workflow uses swimlanes and business activity nodes", ...)`는 `mapSource`만 검사하므로 그대로 둔다.)

- [ ] **Step 3: 구조 테스트 실행**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`
Expected: 전부 PASS.

- [ ] **Step 4: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 5: 브라우저 수동 확인**

개발 서버(`3002`)에서 `/workflow` 진입 → 가이드 탭 기본 표시, 좌측 레인 그룹/단계 클릭 시 중앙 본문 갱신, 화면 바로가기 동작, 관련 도움말 아코디언 펼침, [흐름도] 탭 전환 후 노드 클릭 시 가이드 탭으로 점프 확인.

- [ ] **Step 6: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/workflow/page.tsx" "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"
git commit -F <임시파일>
# 메시지: "feat(workflow): 가이드 허브 셸로 page 재작성 + 구조 테스트 갱신"
```

---

### Task 7: i18n UI 라벨 4파일 추가 (선택 강화)

> 본문은 한국어 하드코딩 유지. 이 태스크는 탭/헤더/섹션 제목 등 UI 라벨을 i18n 키로 전환해 4개 언어를 채운다. v1에서 컴포넌트는 한국어 문자열을 직접 써도 동작하므로, 이 태스크는 다국어 사용 환경 대응이 필요할 때 수행한다.

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`
- Modify: `page.tsx`, `WorkflowGuide.tsx`, `WorkflowSidebar.tsx`, `WorkflowFlow.tsx` (라벨을 `t("workflowGuide.x", "한국어기본값")`로 치환)

**Interfaces:**
- Produces: `workflowGuide` i18n 네임스페이스 (탭/섹션 라벨)

- [ ] **Step 1: 4개 locale 파일에 `workflowGuide` 키 추가**

각 파일의 기존 `"workflow": { ... }` 블록과 충돌하지 않도록 최상위에 새 `"workflowGuide"` 객체를 추가한다(기존 객체 사이 적절한 위치, 마지막 `}` 직전 권장). BOM 절대 금지.

ko.json:
```json
  "workflowGuide": {
    "pageTitle": "업무 가이드",
    "pageSubtitle": "처음 사용자를 위한 단계별 업무 지침과 화면 바로가기를 제공합니다.",
    "tabGuide": "가이드",
    "tabFlow": "흐름도",
    "searchPlaceholder": "업무, 화면, 데이터 객체 검색",
    "why": "왜 하는가",
    "when": "언제 하는가",
    "cautions": "주의점",
    "inputs": "입력",
    "outputs": "산출",
    "routes": "화면 바로가기",
    "help": "관련 화면 도움말",
    "dataObjects": "생성/변경 데이터",
    "previous": "선행 업무",
    "next": "후행 업무",
    "stepSuffix": "단계"
  },
```

en.json:
```json
  "workflowGuide": {
    "pageTitle": "Work Guide",
    "pageSubtitle": "Step-by-step work instructions and screen shortcuts for first-time users.",
    "tabGuide": "Guide",
    "tabFlow": "Flow Map",
    "searchPlaceholder": "Search task, screen, data object",
    "why": "Why",
    "when": "When",
    "cautions": "Cautions",
    "inputs": "Inputs",
    "outputs": "Outputs",
    "routes": "Screen Shortcuts",
    "help": "Related Screen Help",
    "dataObjects": "Created/Changed Data",
    "previous": "Previous Task",
    "next": "Next Task",
    "stepSuffix": "step"
  },
```

zh.json:
```json
  "workflowGuide": {
    "pageTitle": "业务指南",
    "pageSubtitle": "为初次使用者提供分步业务指引和画面快捷入口。",
    "tabGuide": "指南",
    "tabFlow": "流程图",
    "searchPlaceholder": "搜索业务、画面、数据对象",
    "why": "为什么做",
    "when": "何时做",
    "cautions": "注意事项",
    "inputs": "输入",
    "outputs": "产出",
    "routes": "画面快捷入口",
    "help": "相关画面帮助",
    "dataObjects": "生成/变更数据",
    "previous": "前置业务",
    "next": "后续业务",
    "stepSuffix": "步骤"
  },
```

vi.json:
```json
  "workflowGuide": {
    "pageTitle": "Hướng dẫn nghiệp vụ",
    "pageSubtitle": "Cung cấp hướng dẫn nghiệp vụ theo bước và lối tắt màn hình cho người dùng mới.",
    "tabGuide": "Hướng dẫn",
    "tabFlow": "Sơ đồ luồng",
    "searchPlaceholder": "Tìm nghiệp vụ, màn hình, đối tượng dữ liệu",
    "why": "Tại sao",
    "when": "Khi nào",
    "cautions": "Lưu ý",
    "inputs": "Đầu vào",
    "outputs": "Đầu ra",
    "routes": "Lối tắt màn hình",
    "help": "Trợ giúp màn hình liên quan",
    "dataObjects": "Dữ liệu tạo/thay đổi",
    "previous": "Nghiệp vụ trước",
    "next": "Nghiệp vụ sau",
    "stepSuffix": "bước"
  },
```

- [ ] **Step 2: 컴포넌트 라벨을 t()로 치환**

`page.tsx`/`WorkflowGuide.tsx`/`WorkflowSidebar.tsx`/`WorkflowFlow.tsx`에서 `useTranslation` 추가 후 고정 한국어 라벨을 `t("workflowGuide.키", "한국어기본값")`로 치환한다. 예: `업무 가이드` → `t("workflowGuide.pageTitle", "업무 가이드")`, `가이드` → `t("workflowGuide.tabGuide", "가이드")`, `왜 하는가` → `t("workflowGuide.why", "왜 하는가")` 등. node 본문(why/when/cautions 값)은 데이터이므로 치환 대상이 아니다.

- [ ] **Step 3: 키 동기화 점검**

Run: `node -e "const k=Object.keys; const a=require('./apps/frontend/src/locales/ko.json').workflowGuide; for (const f of ['en','zh','vi']){const b=require('./apps/frontend/src/locales/'+f+'.json').workflowGuide; const miss=k(a).filter(x=>!(x in b)); if(miss.length) throw new Error(f+' missing: '+miss.join(',')); } console.log('i18n ok');"`
Expected: `i18n ok`

- [ ] **Step 4: BOM 점검 + 타입 체크**

Run: `node -e "for (const f of ['ko','en','zh','vi']){const b=require('fs').readFileSync('apps/frontend/src/locales/'+f+'.json'); if(b[0]===0xEF) throw new Error('BOM in '+f);} console.log('no bom');"`
그리고: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: `no bom`, 타입 에러 0건.

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json "apps/frontend/src/app/(authenticated)/workflow/page.tsx" "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowGuide.tsx" "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowSidebar.tsx" "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowFlow.tsx"
git commit -F <임시파일>
# 메시지: "feat(workflow): 가이드 허브 UI 라벨 i18n 4파일 적용"
```

---

## 참고: 레거시 컴포넌트

`workflow/components/WorkflowBranch.tsx`, `WorkflowPopover.tsx`, `WorkflowNode.tsx`, `WorkflowCard.tsx` 및 `config/workflowConfig.ts`는 현재 라우트(`page.tsx`)에서 사용되지 않는 이전 버전 잔재다(서로만 참조). 이번 작업 범위에서는 **건드리지 않는다**. 정리는 별도 작업으로 분리한다.

## 검증 요약

- 각 태스크: `tsc --noEmit` 0 에러.
- Task 1·6: `node --test ...structure.test.mjs` 전부 PASS.
- Task 6: 브라우저에서 탭/사이드바/가이드/도움말/흐름도 점프 수동 확인.
- Task 7: i18n 키 동기화 + BOM 점검 통과.
