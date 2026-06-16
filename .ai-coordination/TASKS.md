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

## T-EQUIPMENT-INSPECT-CARDS-REMOVE 설비점검 화면 정보카드 제거
status: IN_PROGRESS
owner: codex
role: implementer
scope:
- /equipment/inspect-history 상단 정보카드 제거
- /equipment/periodic-inspect 상단 정보카드 제거
files:
- apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx
- apps/frontend/src/app/(authenticated)/equipment/periodic-inspect/page.tsx
- .ai-coordination/LOCKS.md
- .ai-coordination/TASKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- frontend typecheck
- 3002 화면 카드 미표시 확인
review:
- needs-review
notes:
- 조회/필터/그리드/내보내기와 정기점검 CRUD는 유지하고 상단 통계 카드만 제거한다.

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
