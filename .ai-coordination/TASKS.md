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
status: REVIEW
owner: claude
role: implementer
scope:
- apps/backend/src/migrations/2026-05-26_iqc005_*.sql (5건)
- apps/backend/src/entities/{mat-lot,purchase-order,purchase-order-item}.entity.ts
- apps/backend/src/shared/numbering.service.ts (+ spec)
- apps/backend/src/modules/material/services/arrival.service.ts (+ spec, module)
- apps/backend/src/modules/material/controllers/arrival.controller.ts
- apps/backend/src/modules/material/dto/arrival.dto.ts
- apps/backend/src/modules/material/receiving/receiving.module.ts
- apps/frontend/src/app/(authenticated)/material/arrival/page.tsx
- apps/frontend/src/app/(authenticated)/material/arrival/components/{PoLineGrid,PoLineReceiptModal,SerialIssueConfirmModal,MatLabelPreviewModal,types}.tsx
- apps/frontend/src/components/shared/MfgPartnerSelect.tsx
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- docs/superpowers/specs/2026-05-26-iqc005-alignment-phase-a-design.md
- docs/superpowers/plans/2026-05-26-iqc005-alignment-phase-a.md
- docs/standards/numbering-rules.md
verification:
- pnpm --filter @harness/backend build (0 error) ✅
- pnpm --filter @harness/frontend build (0 error) ✅
- numbering.service spec 28/28 PASS ✅
- arrival.service spec 31/31 PASS ✅
- arrival.service.po-line.spec 5/5 PASS (receivePoLine 시리얼 발급 5 시나리오) ✅
- oracle-db JSHANES: 7 마이그 모두 적용, DB 객체/시드 검증 통과 ✅
- COM_CODES PO_LINE_STATUS(3) + PO_USE_TYPE(3) 시드 ✅
- i18n 4국어 동기화 (19 신규 + comCode 2 그룹) ✅
- SEQ_MAT_SERIAL_DAILY / SEQ_ARRIVAL_NO_DAILY NEXTVAL 정상 호출 확인 ✅
- PURCHASE_ORDER_ITEMS 9 라인 데모 시드 (OPEN 4 / PARTIAL 3 / CLOSE 2) ✅
- UI end-to-end (브라우저 입하 → 시리얼 → 라벨 인쇄): 사용자 환경에서 진행 (dev server 사용자 띄움)
review:
- ready-for-user-verification
notes:
- 패키지명 정정: @hanes/* → @harness/* (실제 monorepo 네이밍)
- PKG_SEQ_GENERATOR가 SEPARATOR를 양쪽에 적용해 PDF 형식 불가 → NumberingService에 application-level 포맷 메서드 2개 신설로 우회
- 결정 B 반영: PURCHASE_ORDER 메타 컬럼 신설 (LINE_NO/REV_NO/LINE_STATUS/USE_TYPE)
- PURCHASE_ORDER_ITEMS.LINE_NO 컬럼 매핑은 SQL에서 PO_ID (엔티티 필드명 poNo와 다름)
- Phase B/C/D는 별도 task로 분리. ArrivalHistoryTable / PoArrivalModal는 @deprecated, Phase B에서 receive-history로 이동/제거.
