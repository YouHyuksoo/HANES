# Workflow Knowledge Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 워크플로우 세 탭을 보존하면서 사용자가 업무·화면·테이블·조건·예외를 중심으로 검수된 관계를 탐색하는 네 번째 `지식맵` 탭을 구현한다.

**Architecture:** 기존 `workflowMap.ts`의 순수 데이터와 조회 함수를 `@harness/shared`의 워크플로우 모듈로 옮기고 기존 import 경로는 재수출 어댑터로 유지한다. 공유 모듈이 정형 지식 그래프, 검색, 1홉 확장, 검증을 담당하고 프론트는 React Flow로 세 레이아웃을 투영한다. 백엔드 AI 엔드포인트는 공유 카탈로그에 존재하는 중심 후보와 관계 필터만 반환하며, 실패해도 로컬 정확 검색은 유지한다.

**Tech Stack:** TypeScript, React 19, Next.js 15, `@xyflow/react`, Tailwind CSS, NestJS, Jest, Node test runner, `@harness/shared`

---

## 파일 구조

### 공유 그래프

- `packages/shared/src/workflow/legacy-map.ts`: 기존 레인·업무 노드·업무 엣지와 조회 함수의 단일 원천
- `packages/shared/src/workflow/knowledge-types.ts`: 노드, 관계, 범주별 검토상태, AI 계약 타입
- `packages/shared/src/workflow/knowledge-catalog.ts`: 기존 맵 변환과 검증된 추가 지식 관계
- `packages/shared/src/workflow/knowledge-graph.ts`: 검증, 검색 인덱스, 1홉 추출과 확장
- `packages/shared/src/workflow/index.ts`: 워크플로우 공개 API
- `packages/shared/src/index.ts`: 워크플로우 공개 API 재수출
- `apps/frontend/src/config/workflowMap.ts`: 기존 import 호환용 재수출 어댑터

### 백엔드 AI 해석

- `apps/backend/src/modules/ai/dto/workflow-knowledge.dto.ts`: 자연어 해석 요청 DTO
- `apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.ts`: 제한된 후보 해석과 응답 검증
- `apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.spec.ts`: 정상·허위 ID·실패 폴백 테스트
- `apps/backend/src/modules/ai/ai.controller.ts`: `POST /ai/workflow-knowledge/interpret`
- `apps/backend/src/modules/ai/ai.module.ts`: 서비스 provider 등록

### 프론트 탐색과 레이아웃

- `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-state.ts`: URL, 로컬 설정, 내부 이력 상태
- `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-layouts.ts`: 마인드맵·프로세스·관계도 좌표 계산
- `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-view-model.ts`: 공유 서브그래프를 React Flow 노드·엣지로 변환
- `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowKnowledgeMap.tsx`: 지식맵 화면 조립
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeSearch.tsx`: 정확 검색과 명시적 AI 해석
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeToolbar.tsx`: 레이아웃·보기·이력·링크 복사
- `apps/frontend/src/app/(authenticated)/workflow/components/RelationFilters.tsx`: 7개 관계 범주 필터
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeCanvas.tsx`: React Flow 캔버스
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeNode.tsx`: 도면형 노드
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeEdge.tsx`: 관계별 선·방향·조건 라벨
- `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeDetailPanel.tsx`: 상세·근거·바로가기
- `apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs`: 통합 구조와 회귀 테스트
- `apps/frontend/src/app/(authenticated)/workflow/page.tsx`: 네 번째 탭 연결
- `apps/frontend/src/locales/{ko,en,vi,zh}.json`: 탭과 공통 UI 번역

## Task 1: 기존 워크플로우 맵을 공유 패키지로 이동

**Files:**
- Create: `packages/shared/src/workflow/legacy-map.ts`
- Create: `packages/shared/src/workflow/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/frontend/src/config/workflowMap.ts`
- Test: `apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs`

- [ ] **Step 1: 기존 import 호환성 실패 테스트 추가**

`workflow-business-map.structure.test.mjs`에 `workflowMap.ts`가 `@harness/shared`에서 기존 식별자를 재수출하고 중복 데이터 리터럴을 갖지 않는지 검사한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`

Expected: 공유 재수출 패턴 누락으로 FAIL.

- [ ] **Step 3: 순수 맵 데이터와 함수를 이동**

`workflowMap.ts`의 타입, `workflowLanes`, `workflowNodes`, `workflowEdges`, 조회 함수를 `legacy-map.ts`로 이동한다. 프론트 파일은 다음 호환 어댑터만 남긴다.

```ts
export * from "@harness/shared";
```

`packages/shared/src/workflow/index.ts`와 루트 `index.ts`에서 재수출한다. React 또는 Next.js 의존성은 공유 패키지에 넣지 않는다.

- [ ] **Step 4: 구조 테스트와 양쪽 typecheck 실행**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"
pnpm.cmd --filter @harness/shared typecheck
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 5: 의도한 파일만 커밋**

```powershell
git add packages/shared/src/workflow packages/shared/src/index.ts "apps/frontend/src/config/workflowMap.ts" "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"
git commit -m "refactor(workflow): share workflow map catalog"
```

## Task 2: 공유 지식 그래프 계약과 탐색 함수 구현

**Files:**
- Create: `packages/shared/src/workflow/knowledge-types.ts`
- Create: `packages/shared/src/workflow/knowledge-catalog.ts`
- Create: `packages/shared/src/workflow/knowledge-graph.ts`
- Modify: `packages/shared/src/workflow/index.ts`
- Test: `apps/backend/src/modules/workflow/workflow-knowledge.spec.ts`

- [ ] **Step 1: 실패하는 그래프 단위 테스트 작성**

다음을 Jest로 검증한다.

```ts
expect(validateKnowledgeCatalog(workflowKnowledgeCatalog)).toEqual([]);
expect(searchKnowledge("MAT_LOTS")[0].kind).toBe("data");
expect(getKnowledgeNeighborhood("arrival-register", ["tables"]).nodes)
  .toEqual(expect.arrayContaining([expect.objectContaining({ id: "data:MAT_LOTS" })]));
expect(getCoverage("arrival-register", "constraints")).toBe("undocumented");
```

또한 존재하지 않는 대상 ID, 중복 관계 ID, `present`인데 관계가 없는 범주, `none`인데 관계가 있는 범주가 오류가 되는 케이스를 추가한다.

필수 무결성 케이스도 같은 테스트 파일에 포함한다.

- 모든 기존 `workflowNodes` ID가 지식맵 검색 인덱스에서 검색됨
- `screen` 노드의 경로가 `/`로 시작하고 기존 route 원천과 일치함
- `evidence` 노드의 repo 경로/API 식별자 형식이 유효함
- 허용 목록에 없는 순환 관계와 어떤 관계에도 연결되지 않은 고아 노드를 오류로 검출함
- 7개 관계 범주 각각을 활성/비활성화했을 때 `getKnowledgeNeighborhood` 포함·제외 결과가 정확함

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/workflow/workflow-knowledge.spec.ts --runInBand`

Expected: 지식 그래프 모듈이 없어 FAIL.

- [ ] **Step 3: 타입과 범주 매핑 구현**

7개 사용자 범주를 고정한다.

```ts
type KnowledgeCategory =
  | "flow" | "masters" | "constraints" | "requiredTasks"
  | "exceptions" | "logic" | "tables";
type CoverageStatus = "present" | "none" | "undocumented";
type EvidenceStatus = "verified" | "partial" | "undocumented";
```

노드 종류와 관계 종류는 설계 문서 4.1의 허용 목록을 그대로 타입과 런타임 상수로 정의한다.

- [ ] **Step 4: 기존 전체 맵 변환과 초기 카탈로그 구현**

- 모든 기존 업무를 `activity`로 변환한다.
- 모든 `routes`를 고유 `screen` 노드와 `references` 관계로 변환한다.
- 모든 `dataObjects`를 고유 `data` 노드와 근거가 불명확한 `references` 관계로 변환한다.
- 기존 업무 엣지를 종류별 업무 관계로 변환한다.
- 자동 변환된 범주는 `present` 또는 실제 빈 값이 확인된 경우 `none`, 나머지는 `undocumented`로 둔다.
- 입하/IQC/생산/출하 대표 흐름에는 기존 맵과 워크플로우 문서로 확인되는 기준정보·제약·예외·복구 관계를 최소 세트로 명시한다.

- [ ] **Step 5: 검색·1홉·검증 함수 구현**

검색은 대소문자와 공백을 정규화하고 제목, ID, 별칭, 화면 경로, 테이블명을 점수화한다. 서브그래프 함수는 중심과 선택 범주의 1홉만 반환하고, 펼친 노드 ID를 받으면 해당 노드의 1홉을 중복 없이 합친다.

- [ ] **Step 6: 테스트와 shared/backend typecheck 실행**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/workflow/workflow-knowledge.spec.ts --runInBand
pnpm.cmd --filter @harness/shared typecheck
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 7: 커밋**

```powershell
git add packages/shared/src/workflow apps/backend/src/modules/workflow/workflow-knowledge.spec.ts
git commit -m "feat(workflow): add curated knowledge graph"
```

## Task 3: 제한된 AI 질문 해석 API 구현

**Files:**
- Create: `apps/backend/src/modules/ai/dto/workflow-knowledge.dto.ts`
- Create: `apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.ts`
- Create: `apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.spec.ts`
- Modify: `apps/backend/src/modules/ai/ai.controller.ts`
- Modify: `apps/backend/src/modules/ai/ai.module.ts`

- [ ] **Step 1: 실패하는 서비스 테스트 작성**

AI mock이 등록된 ID를 반환하면 유지하고, 미등록 ID·관계 종류를 반환하면 제거하며, JSON 파싱 실패 시 빈 후보와 안전한 안내를 반환하는 테스트를 작성한다. 프롬프트에 허용된 후보 ID와 관계 종류만 포함되는지도 검사한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/workflow-knowledge-interpreter.service.spec.ts --runInBand`

Expected: 서비스가 없어 FAIL.

- [ ] **Step 3: DTO와 서비스 최소 구현**

요청은 `{ query: string }`, 응답은 `{ candidates: Array<{ nodeId, reason, relationKinds }>, interpreted: boolean, errorCode?: "AI_UNAVAILABLE" | "INVALID_RESPONSE" }`로 제한한다. `relationKinds`는 7개 사용자 범주가 아니라 설계 4.1의 허용된 관계 종류 목록이다. 프론트가 공유 매핑으로 관계 종류를 사용자 범주에 투영한다. `AiService.complete()`에 전체 노드 본문이 아니라 검색 후보의 ID·제목·별칭과 허용 관계 종류만 전달한다. 반환 JSON을 파싱한 뒤 공유 카탈로그와 런타임 상수로 화이트리스트 검증한다.

- [ ] **Step 4: Controller와 Module 연결**

`POST /ai/workflow-knowledge/interpret`를 추가한다. AI 비활성·키 누락·provider 실패는 이 엔드포인트에서 HTTP 200과 `{ interpreted: false, candidates: [], errorCode: "AI_UNAVAILABLE" }`를 반환한다. JSON 파싱 또는 계약 불일치는 `INVALID_RESPONSE`로 반환한다. Controller/service 테스트에서 두 응답을 고정한다.

- [ ] **Step 5: focused test와 backend typecheck 실행**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/workflow-knowledge-interpreter.service.spec.ts --runInBand
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 6: 커밋**

```powershell
git add apps/backend/src/modules/ai/dto/workflow-knowledge.dto.ts apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.ts apps/backend/src/modules/ai/workflow-knowledge-interpreter.service.spec.ts apps/backend/src/modules/ai/ai.controller.ts apps/backend/src/modules/ai/ai.module.ts
git commit -m "feat(ai): interpret workflow knowledge queries"
```

## Task 4: 프론트 탐색 상태와 세 레이아웃 구현

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-state.ts`
- Create: `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-layouts.ts`
- Create: `apps/frontend/src/app/(authenticated)/workflow/knowledge/knowledge-view-model.ts`
- Test: `apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs`

- [ ] **Step 1: 실패하는 구조 테스트 작성**

세 레이아웃 식별자, `replaceState`, 내부 back/forward 스택, URL 파라미터 `center/layout/view/relations`, 보기 모드별 강조 규칙, 전체 펼치기 부재를 검사한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"`

Expected: 대상 파일이 없어 FAIL.

- [ ] **Step 3: 탐색 상태 구현**

초기 URL을 검증하고 유효하지 않은 중심은 오류 상태로 보존한다. 중심 이동은 내부 스택에 추가하고 URL을 `replaceState`로 동기화한다. 레이아웃·보기·필터 변경은 이력 항목을 만들지 않는다. URL 값이 없을 때만 로컬 저장된 레이아웃과 보기를 사용한다.

- [ ] **Step 4: 세 레이아웃과 뷰모델 구현**

마인드맵은 범주별 각도를 고정하고 깊이별 반경을 늘린다. 프로세스는 선행/필수-중심-후행과 하단 예외/복구 영역을 쓴다. 관계도는 업무 흐름을 수평, 기준·제약·데이터를 상하에 둔다. 보기 모드는 노드를 숨기지 않고 opacity, 요약 필드, 라벨 밀도만 바꾼다. 세 레이아웃 계산은 공통 `safeLayout`으로 감싸고 예외 또는 비유한 좌표가 나오면 단순 방사형 fallback을 반환한다. 구조 테스트에 고의로 실패하는 layout 함수를 주입해 fallback 좌표를 검증한다.

- [ ] **Step 5: 구조 테스트와 frontend typecheck 실행**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 6: 커밋**

```powershell
git add "apps/frontend/src/app/(authenticated)/workflow/knowledge" "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
git commit -m "feat(workflow): add knowledge map navigation model"
```

## Task 5: Knowledge Blueprint UI 구현

**Required skill:** `frontend-design`

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowKnowledgeMap.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeSearch.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeToolbar.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/RelationFilters.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeCanvas.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeNode.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeEdge.tsx`
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/KnowledgeDetailPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs`

- [ ] **Step 1: UI 계약 구조 테스트 추가**

React Flow, custom node/edge, 검색 결과와 AI 해석 후보 분리, `AI로 질문 해석`, `중심으로 보기`, 관계 필터, 세 레이아웃, 두 보기 모드, 미니맵, 접근성 이름, `prefers-reduced-motion` 대응을 검사한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"`

Expected: UI 컴포넌트가 없어 FAIL.

- [ ] **Step 3: 화면 골격과 도면형 토큰 구현**

기존 전역 테마 변수를 존중하면서 지식맵 루트에 도면 그리드, 청회색 잉크, 안전 황색, 예외 적색, 기준정보 청록색, 데이터 청색의 지역 CSS 변수를 둔다. 1440px에서는 좌측 필터·캔버스·우측 상세를 표시하고 작은 화면에서는 상세를 오버레이로 전환한다.

- [ ] **Step 4: 검색과 도구막대 구현**

입력 중에는 로컬 검색만 수행한다. 제출 결과가 없거나 사용자가 `AI로 질문 해석`을 클릭할 때만 API를 호출하고 `suppressErrorModal: true`를 사용한다. 응답은 공유 `isWorkflowKnowledgeInterpretation` 런타임 검증을 통과한 경우에만 사용하고, 각 `nodeId`와 `relationKinds`도 현재 공유 카탈로그/허용 상수에 존재하는지 프론트에서 재검증한다. 실패 응답과 구버전 응답은 후보를 비우고 로컬 검색을 유지한다. AI 후보는 선택 전까지 그래프를 바꾸지 않는다. 도구막대는 내부 이력, 레이아웃, 보기, 링크 복사를 제공한다.

- [ ] **Step 5: 캔버스와 상세패널 구현**

노드 클릭은 확장과 상세 표시만 수행하고 `중심으로 보기`가 중심을 이동한다. 노드 종류는 모양·아이콘·문자 라벨로 구분한다. `KnowledgeEdge`는 관계별 실선·점선·이중선, 방향, 관계 문장, 선택적 조건 라벨을 전담한다. 상세패널은 업무/기술 우선순위, 문서화 상태, 들어오는/나가는 관계, 화면 링크를 표시한다.

- [ ] **Step 6: 접근성과 반응형 마감**

키보드 포커스, 현재 중심·선택 `aria` 상태, 색상 외 표식, reduced motion, 작은 노트북 오버레이, 모바일 검색·상세 목록을 구현한다.

- [ ] **Step 7: 구조 테스트와 frontend typecheck 실행**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 8: 커밋**

```powershell
git add "apps/frontend/src/app/(authenticated)/workflow/components" "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
git commit -m "feat(workflow): build knowledge blueprint explorer"
```

## Task 6: 네 번째 탭과 번역 연결

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/workflow/page.tsx`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/vi.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs`

- [ ] **Step 1: 탭 회귀 실패 테스트 추가**

기존 `guide`, `flow`, `overview`와 새 `knowledge`가 모두 존재하고 기존 흐름도 선택 동작이 유지되는지 검사한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"`

Expected: `knowledge` 탭이 없어 FAIL.

- [ ] **Step 3: 페이지 연결과 번역 추가**

페이지는 `WorkflowKnowledgeMap`을 lazy하지 않은 일반 컴포넌트로 연결하되 탭 외 상태를 소유하지 않는다. 네 언어에 탭, 검색, 관계 범주, 레이아웃, 보기, 품질 상태, 빈 상태를 추가한다.

- [ ] **Step 4: focused tests와 frontend typecheck 실행**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs" "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 모두 PASS.

- [ ] **Step 5: 커밋**

```powershell
git add "apps/frontend/src/app/(authenticated)/workflow/page.tsx" "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/vi.json apps/frontend/src/locales/zh.json
git commit -m "feat(workflow): expose knowledge map tab"
```

## Task 7: 통합 검증과 브라우저 QA

**Files:**
- Modify only if a verified defect is found in the files already locked by this task.

- [ ] **Step 1: 전체 focused 검증 실행**

```powershell
pnpm.cmd --filter @harness/shared typecheck
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/workflow/workflow-knowledge.spec.ts src/modules/ai/workflow-knowledge-interpreter.service.spec.ts --runInBand
node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs" "apps/frontend/src/app/(authenticated)/workflow/workflow-knowledge-map.structure.test.mjs"
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: 모두 exit 0. 현재 dev 서버가 실행 중이면 production build를 실행하지 않는다.

- [ ] **Step 2: localhost:3002 브라우저 QA**

`playwright-cli`로 다음을 검증한다.

- 기존 세 탭 렌더와 동작 유지
- `입하 등록` 정확 검색과 중심 이동
- 관계 필터와 점진 확장
- 노드 클릭 상세와 별도 `중심으로 보기`
- 세 레이아웃 및 업무/기술 보기 전환 시 상태 유지
- 내부 뒤로·앞으로
- 공유 URL 새 탭 복원
- AI API 실패 시 로컬 검색 유지
- 1440px와 작은 노트북 viewport

Expected: 콘솔 오류 없이 핵심 시나리오 완료. 포트 3002가 unavailable이면 다른 포트를 띄우지 않고 실패를 기록한다.

- [ ] **Step 3: coordination 결과 기록**

검증 결과와 남은 위험을 `.ai-coordination/JOURNAL.md`와 `.ai-coordination/HANDOFF/codex.md`에 기록하고, 구현 완료 작업을 `REVIEW_QUEUE.md`로 이동하며 잠금을 제거한다.

- [ ] **Step 4: 최종 검증 커밋이 필요한 경우에만 커밋**

QA에서 수정한 의도된 파일만 stage하고 `git diff --cached --check` 후 커밋한다. unrelated dirty 파일은 stage하지 않는다.
