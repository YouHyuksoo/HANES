# TASKS

This file is active-work-only. Keep only `TODO`, `IN_PROGRESS`, and `BLOCKED` tasks here.

When a task reaches `DONE`:

1. Append detailed outcome and verification to `JOURNAL.md`.
2. Add one compact line to `ARCHIVE.md`.
3. Remove the task body from this file.

## Task Format

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

## T-MATERIAL-FLOW-FE-RUNTIME 자재관리 프론트 실제 흐름 검증
status: IN_PROGRESS
owner: codex
role: implementer
scope:
- 자재관리 하위 메뉴 프론트 런타임 QA
- 자재요청 -> 자재출고 -> 재고 -> 공정입고 데이터 정합성
files:
- tools/hanes-material-flow-frontend-runtime-qa.mjs
- docs/reports/hanes-material-flow-frontend-runtime-qa-2026-06-17/**
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 프론트 브라우저 조작으로 /material/request, /material/issue, 재고 조회, /production/input-kiosk 흐름 확인
- JSHANES Oracle에서 MAT_ISSUE_REQUESTS, MAT_ISSUES, MAT_STOCKS, WIP_MAT_STOCKS, STOCK_TRANSACTIONS 정합성 확인
review:
- needs-review
notes:
- 기존 2026-06-15 자재 메뉴 스윕은 저장 버튼을 실행하지 않는 표면 QA라서 업무 흐름 검증을 별도 수행한다.

## T-PDA-PALLET-SHIP PDA 팔레트 단위 출하 지원
status: TODO
owner: unassigned
role: implementer
scope:
- apps/backend/src/modules/shipping (출하지시-팔레트 연계 설계)
- apps/frontend/src/hooks/pda/useShippingScan.ts
files:
- apps/frontend/src/hooks/pda/useShippingScan.ts (TODO 마커 위치)
verification:
- PDA 팔레트 스캔 → 출하 → 재고 단일 차감 확인 (이중 차감 금지)
review:
- needs-review
notes:
- 결정 D-20260611-PDA-SHIPPING-BOX-ONLY 참조. 현재 PDA는 박스 단위만 지원, 팔레트 스캔은 PALLET_NOT_SUPPORTED 안내.
- 백엔드 shipBox()는 팔레트 적재 박스를 이중 차감 방지로 거부 — 우회 금지. shipment 자동 생성 또는 ship-pallet 전용 엔드포인트 설계 필요.
