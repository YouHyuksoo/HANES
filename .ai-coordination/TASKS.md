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

## T-IQC-METHOD-LABELS IQC 검사방법 라벨 통일
status: IN_PROGRESS
owner: codex
role: implementer
scope:
- IQC 검사방법 표시 라벨을 검사/무검사로 통일
files:
- apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/frontend/src/components/material/IqcModal.tsx
- apps/frontend/src/components/material/IqcTable.tsx
- apps/frontend/src/app/(authenticated)/master/part/page.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-item/components/{IqcGroupTab.tsx,IqcGroupModal.tsx,IqcLinkModal.tsx,IqcLinkTab.tsx,IqcDetailPanel.tsx}
verification:
- JSHANES COM_CODES 라벨 확인
- 구조 테스트 및 frontend typecheck
review:
- needs-review
notes:
- 코드값은 유지한다. FULL/SAMPLE은 표시만 "검사", SKIP은 "무검사"로 보인다.

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
