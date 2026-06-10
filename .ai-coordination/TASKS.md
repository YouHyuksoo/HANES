# TASKS

This file is active-work-only. Keep only `TODO`, `IN_PROGRESS`, `REVIEW`, and `BLOCKED` tasks here.

When a task reaches `DONE`:

1. Append detailed outcome and verification to `JOURNAL.md`.
2. Add one compact line to `ARCHIVE.md`.
3. Remove the task body from this file.

Use this format for every shared task.

```md
## T-000 Short title
status: TODO | IN_PROGRESS | REVIEW | BLOCKED
owner: agent-name
role: implementer | reviewer | operator
scope:
- path/or/module
files:
- path/to/file
verification:
- command or manual check
review:
- reviewer or needs-review
notes:
- important context
```

## Active Tasks

## T-PROD-MONTHLY-ERP-LABEL 좌측 메뉴 월간생산계획 라벨 변경
status: BLOCKED
owner: codex
role: implementer
scope:
- production menu label
files:
- apps/frontend/src/locales/ko.json
verification:
- 미실행: `apps/frontend/src/locales/*`가 다른 active lock 범위라 코드 수정 전 중단
review:
- 사용자 확인 필요
notes:
- 요청: 좌측 메뉴 `월간생산계획`을 `ERP생산계획`으로 변경. 실제 라벨 키는 `menu.production.monthlyPlan`.
- 충돌: `T-MAT-CONCESSION-RECV`가 `apps/frontend/src/locales/*`를 lock 중이라 사용자 허가 없이는 수정하지 않음.

## T-MAT-RECV-FIXES 자재입고 프로세스 이슈 일괄 수정
status: IN_PROGRESS
owner: claude
role: implementer
scope:
- material/po, material/arrival(IQC005), material/IQC006(신규), lot-split, lot-merge, material/receive, production/order
files:
- apps/backend/src/common/filters/http-exception.filter.ts
- apps/backend/src/modules/material/dto/purchase-order.dto.ts
- apps/frontend/src/app/(authenticated)/material/po/components/PoFormPanel.tsx
verification:
- PO 생성 재현(API): qty=0/소수점 → 읽을 수 있는 메시지, 정상건 성공
- pnpm --filter @harness/frontend exec tsc --noEmit / 백엔드 tsc
review:
- needs-review
notes:
- 스테이크홀더(행성) 지적 목록 기반. 진행순서: 빠른버그(#1 PO오류, #2 일부입하 색상, 작업지시 품목필터) → IQC006 입하실적조회 → 분할/병합(채번규칙 pptx) → 라인→공정설비
- 목업: C:\Document\고객별프로젝트\행성사\THN_MockUp (MT\IQC001~006), 채번: C:\Document\고객별프로젝트\행성사\HANES_MES_채번규칙.pptx
- #1 근본원인: http-exception.filter가 class-validator message 배열을 버리고 "Bad Request Exception"으로 폴백 (앱 전체 systemic)
