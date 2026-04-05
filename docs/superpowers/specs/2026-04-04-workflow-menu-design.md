# 워크플로우 메뉴 설계서

## 개요

MES 업무 프로세스의 시작→종료까지 연결 흐름을 시각화하는 워크플로우 페이지.
사이드바에 "워크플로우" 메뉴를 추가하고, 7개 업무 영역의 프로세스 흐름을 대시보드 그리드 형태로 제공한다.

**핵심 가치**: IQC 없이 입고 불가능한 것처럼, 업무 간 의존관계를 시각적으로 보여줘서 사용자가 전체 흐름을 한눈에 파악하고 각 단계로 바로 이동할 수 있게 한다.

## 아키텍처

### 프론트엔드
- **페이지**: `/workflow` (Next.js page)
- **설정**: `config/workflowConfig.ts` — 7개 워크플로우의 노드, 연결, 분기, 메뉴 경로 정의
- **컴포넌트**: `WorkflowCard`, `WorkflowNode`, `WorkflowPopover`
- **API 호출**: `GET /api/v1/workflow/summary` — 전체 워크플로우 건수 조회

### 백엔드
- **컨트롤러**: `WorkflowController` (`/workflow/summary`)
- **서비스**: `WorkflowService` — `PKG_WORKFLOW` Oracle 패키지 호출
- **Oracle 패키지**: `PKG_WORKFLOW.SP_WORKFLOW_SUMMARY` — 각 단계별 건수 반환

## 시각화 방식: 하이브리드 스텝 플로우

각 워크플로우는 카드 안에 수평 스텝 노드로 표현. 각 노드에 단계명 + 건수 + 상태 라벨을 표시한다.

```
[입하 3 대기] → [IQC 5 검사중] → {합격→/불합격×} → [입고 12 완료] → [출고 8 완료]
```

- 분기(합격/불합격)는 노드 사이에 분기 배지로 표시
- 역분개(취소)가 가능한 단계는 팝오버에서 역방향 버튼 제공

## 페이지 레이아웃: 대시보드 그리드

- 2열 그리드 (`grid-cols-2`)로 7개 워크플로우 카드 배치
- 마지막 카드(소모품)는 `col-span-2`로 전체 폭 사용
- 각 카드: 좌측 accent 보더 + 제목 + 진행중 건수 배지 + 스텝 플로우

## 노드 클릭 인터랙션: 팝오버

노드 클릭 시 팝오버에 표시할 내용:
1. **현황 통계** — 대기/진행/완료/실패 건수 (2×2 그리드)
2. **최근 처리 이력** — 최근 3건 (LOT번호, 결과, 담당자, 시간)
3. **액션 버튼**:
   - 정방향: `[해당 메뉴 바로가기 →]` (primary)
   - 역분개: `[↩ 취소]` (danger outline) — 역분개 가능한 단계만 표시
   - 닫기 버튼

### 역분개 대상 노드

| 워크플로우 | 노드 | 역분개 | 메뉴 경로 |
|-----------|------|--------|----------|
| 자재관리 | 입고 | 입고취소 | `/material/receipt-cancel` |
| 제품관리 | 입고 | 입고취소 | `/product/receipt-cancel` |
| 제품관리 | 출고 | 출고취소 | `/product/issue-cancel` |
| 출하관리 | 출하 | 반품 | `/shipping/return` |

## 7개 워크플로우 정의

### 1. 자재관리 (accent: green)
```
입하(/material/arrival) → 입고라벨(/material/receive-label) → IQC(/material/iqc) → {합격/불합격} → 입고(/material/receive) [↩취소] → 출고요청(/material/request) → 출고(/material/issue)
```

### 2. 생산관리 (accent: blue)
```
월간계획(/production/monthly-plan) → 시뮬레이션(/production/simulation) → 작업지시(/production/order) → 생산실적(/production/result) → 공정검사(/production/input-inspect) → 완제품입고(/product/receive) [↩취소]
```

### 3. 품질관리 (accent: amber)
```
IQC(/material/iqc) → 공정검사(/quality/inspect) → OQC(/quality/oqc) → 불량등록(/quality/defect) → 재작업(/quality/rework) → 재검사(/quality/rework-inspect) → CAPA(/quality/capa)
```

### 4. 출하관리 (accent: red)
```
포장실적(/production/pack-result) → 포장(/shipping/pack) → 파렛트(/shipping/pallet) → OQC(/quality/oqc) → {합격/불합격} → 출하확정(/shipping/confirm) [↩반품] → 출하이력(/shipping/history)
```

### 5. 설비관리 (accent: purple)
```
PM계획(/equipment/pm-plan) → PM캘린더(/equipment/pm-calendar) → PM실행결과(/equipment/pm-result) → 일상점검(/equipment/inspect-calendar) → 정기점검(/equipment/periodic-inspect-calendar) → 점검이력(/equipment/inspect-history)
```

### 6. 외주관리 (accent: emerald)
```
외주업체(/outsourcing/vendor) → 외주발주(/outsourcing/order) → 외주입고(/outsourcing/receive)
```

### 7. 소모품관리 (accent: pink)
```
입고(/consumables/receiving) → 라벨(/consumables/label) → 출고(/consumables/issuing) → 장착(/consumables/mount) → 수명(/consumables/life)
```

## 설정 파일 구조: workflowConfig.ts

```typescript
interface WorkflowNode {
  id: string;              // 노드 고유 ID
  label: string;           // 표시명 (i18n 키)
  path: string;            // 메뉴 경로
  color: string;           // 노드 accent 색상
  statusLabel: string;     // 상태 라벨 (i18n 키)
  reversePath?: string;    // 역분개 메뉴 경로 (없으면 역분개 불가)
  reverseLabel?: string;   // 역분개 버튼 라벨 (i18n 키)
}

interface WorkflowBranch {
  afterNodeId: string;     // 분기가 발생하는 노드 ID
  conditions: Array<{
    label: string;         // 분기 라벨 (합격/불합격)
    type: 'pass' | 'fail'; // 분기 유형
  }>;
}

interface WorkflowDefinition {
  id: string;              // 워크플로우 ID
  titleKey: string;        // 제목 i18n 키
  icon: string;            // 이모지 아이콘
  accent: string;          // 카드 accent 색상
  nodes: WorkflowNode[];   // 순서대로 나열된 노드
  branches?: WorkflowBranch[]; // 분기 정의
}
```

## 데이터 소스: PKG_WORKFLOW

### SP_WORKFLOW_SUMMARY
- **IN**: 없음 (전체 조회)
- **OUT**: `o_cursor` SYS_REFCURSOR
- 각 워크플로우별 노드 건수를 한 번에 반환

반환 컬럼:
```sql
WORKFLOW_ID   VARCHAR2(30)  -- 워크플로우 ID (예: 'MATERIAL')
NODE_ID       VARCHAR2(30)  -- 노드 ID (예: 'ARRIVAL')
PENDING_CNT   NUMBER        -- 대기 건수
ACTIVE_CNT    NUMBER        -- 진행 건수
DONE_CNT      NUMBER        -- 완료 건수
REVERSE_CNT   NUMBER        -- 역분개(취소) 건수
```

### 각 노드별 건수 조회 SQL 매핑

| 워크플로우 | 노드 | 테이블 | 조건 |
|-----------|------|--------|------|
| MATERIAL | ARRIVAL | MAT_ARRIVALS | STATUS별 카운트 |
| MATERIAL | IQC | IQC_LOGS | 오늘 날짜, RESULT별 카운트 |
| MATERIAL | RECEIVE | STOCK_TRANSACTIONS | TYPE='RECEIVE', 오늘 날짜 |
| PRODUCTION | ORDER | JOB_ORDERS | 오늘 날짜, STATUS별 카운트 |
| PRODUCTION | RESULT | JOB_ORDERS | GOOD_QTY > 0 |
| SHIPPING | CONFIRM | SHIP_CONFIRMS | STATUS별 카운트 |
| EQUIPMENT | PM_PLAN | PM_WORK_ORDERS | SCHEDULED_DATE, STATUS별 |

## 사이드바 메뉴 추가

`menuConfig.ts`에 추가:
```typescript
{
  code: "WORKFLOW",
  labelKey: "menu.workflow",
  path: "/workflow",
  icon: GitBranch,  // lucide-react
}
```

대시보드 바로 아래에 배치.

## 파일 구조

```
apps/frontend/src/
├── config/workflowConfig.ts          # 워크플로우 정의
├── app/(authenticated)/workflow/
│   ├── page.tsx                       # 워크플로우 메인 페이지 (< 300줄)
│   └── components/
│       ├── WorkflowCard.tsx           # 워크플로우 카드 (< 200줄)
│       ├── WorkflowNode.tsx           # 노드 컴포넌트 (< 100줄)
│       ├── WorkflowBranch.tsx         # 분기 표시 (< 50줄)
│       └── WorkflowPopover.tsx        # 팝오버 (< 200줄)

apps/backend/src/
├── modules/workflow/
│   ├── workflow.module.ts
│   ├── workflow.controller.ts
│   └── workflow.service.ts

scripts/oracle/
└── PKG_WORKFLOW.sql
```

## i18n 키

`workflow.*` 네임스페이스로 추가 (ko, en, zh, vi 4개 파일):
- `workflow.title`, `workflow.subtitle`
- `workflow.material.title`, `workflow.material.arrival`, ...
- `workflow.popover.goTo`, `workflow.popover.cancel`, `workflow.popover.recentHistory`
- `workflow.status.pending`, `workflow.status.active`, `workflow.status.done`

## 다크 모드

모든 컴포넌트에 `dark:` 클래스 적용. 기본값과 다크 모드 함께 지정.
