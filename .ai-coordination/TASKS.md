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

## T-011 IQC005 자재 입하관리 정렬 — Phase A
status: IN_PROGRESS
owner: claude
role: implementer
scope:
- apps/backend/src/migrations/2026-05-26_iqc005_*.sql
- apps/backend/src/entities/mat-lot.entity.ts
- apps/backend/src/modules/material/services/mat-serial-number.service.ts
- apps/backend/src/modules/material/services/arrival.service.ts
- apps/backend/src/modules/material/controllers/arrival.controller.ts
- apps/backend/src/modules/material/dto/arrival.dto.ts
- apps/frontend/src/app/(authenticated)/material/arrival/page.tsx
- apps/frontend/src/app/(authenticated)/material/arrival/components/*
- apps/frontend/src/components/shared/MfgPartnerSelect.tsx
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- docs/superpowers/specs/2026-05-26-iqc005-alignment-phase-a-design.md
- docs/standards/numbering-rules.md
files:
- (위 scope 참조)
verification:
- pnpm --filter @hanes/backend build (0 error)
- pnpm --filter @hanes/frontend build (0 error)
- oracle-db JSHANES: MAT_LOTS.MFG_PARTNER_CODE 컬럼, SEQ_MAT_SERIAL_DAILY/SEQ_ARRIVAL_NO_DAILY 시퀀스, JOB_RESET_*_DAILY 잡 확인
- UI: PO 1라인 입하 → 시리얼 N건 발급 + 라벨 모달 + MAT_LOTS oracle-db 조회
review:
- needs-review
notes:
- 디자인 승인 완료. 스펙: docs/superpowers/specs/2026-05-26-iqc005-alignment-phase-a-design.md
- 사용자 결정: 제조사=PARTNER_MASTERS partnerType='MFG', 채번=Oracle SEQUENCE, 시리얼 접두 VH1-RM은 상수
- Phase B(IQC006 receive-history) / Phase C(라벨) / Phase D(분할/병합)은 별도 task로 분리
