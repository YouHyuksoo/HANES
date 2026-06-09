# Material Receive Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자재입고를 그리드 선택 방식이 아닌 거래처 바코드와 자체부착 바코드 순환 스캔 방식으로만 처리한다.

**Architecture:** 입고대기 그리드는 대상 조회 전용으로 유지한다. 스캔 모달에서 거래처 바코드와 `matUid`를 쌍으로 누적하고, 백엔드는 각 입고 행의 `MAT_RECEIVINGS.VENDOR_BARCODE`에 거래처 바코드 원본을 저장한다.

**Tech Stack:** Next.js React UI, NestJS DTO/service/controller, TypeORM Oracle entity, raw SQL migration.

---

### Task 1: Schema And API Contract

**Files:**
- Modify: `apps/backend/src/entities/mat-receiving.entity.ts`
- Modify: `apps/backend/src/modules/material/dto/receiving.dto.ts`
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`
- Create: `apps/backend/src/migrations/2026-06-09_mat_receiving_vendor_barcode.sql`

- [ ] Add optional `vendorBarcode` to receive item DTO.
- [ ] Persist `vendorBarcode` into `MAT_RECEIVINGS`.
- [ ] Add Oracle migration column and comment.
- [ ] Run backend type check and schema doc generation.

### Task 2: Scan-Only Receiving UI

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/receive/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/material/receive/components/ReceivableTable.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/material/receive/components/types.ts`
- Create: `apps/frontend/src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx`

- [ ] Remove checkbox, qty, warehouse edit columns from the grid.
- [ ] Add header `입고처리` button that opens scan modal.
- [ ] In modal, accept alternating scans: vendor barcode then own `matUid`.
- [ ] Validate duplicate scans and receivable target membership on the client.
- [ ] Submit scanned pairs to `/material/receiving`.
- [ ] Run frontend type check and browser verification.
