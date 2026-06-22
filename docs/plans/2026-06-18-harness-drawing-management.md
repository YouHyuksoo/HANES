# Harness Drawing Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or equivalent task-by-task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제품별 하네스 도면 Header, Revision, 회로별 제작 사양을 관리하는 신규 생산 도면관리 화면/API/DB를 만든다.

**Architecture:** 생산 도메인 안에 `production/specifications` API를 추가하고, DB는 Master -> Revision -> Circuit 구조로 분리한다. 프론트는 `/production/specification-setup`에서 도면 목록과 선택 도면의 회로 상세 편집 그리드를 한 화면에 제공한다.

**Tech Stack:** NestJS, TypeORM, Oracle, Next.js, React, TanStack DataGrid, HANES i18n/menu infrastructure.

---

### Task 1: Backend Service Contract

**Files:**
- Create: `apps/backend/src/modules/production/services/production-specification.service.spec.ts`
- Create: `apps/backend/src/modules/production/services/production-specification.service.ts`
- Create: `apps/backend/src/modules/production/dto/production-specification.dto.ts`
- Create: `apps/backend/src/entities/harness-drawing-master.entity.ts`
- Create: `apps/backend/src/entities/harness-drawing-revision.entity.ts`
- Create: `apps/backend/src/entities/harness-circuit-spec.entity.ts`

- [ ] Write failing tests for create, update blocking approved revisions, and revise cloning circuits.
- [ ] Implement entities, DTOs, and service with sequence-backed IDs.
- [ ] Run focused backend spec.

### Task 2: Backend API and Module

**Files:**
- Create: `apps/backend/src/modules/production/controllers/production-specification.controller.ts`
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] Add CRUD, approve, and revise endpoints.
- [ ] Register controller, service, and entities.
- [ ] Run backend typecheck.

### Task 3: Database Migration and Menu Seed

**Files:**
- Create: `apps/backend/src/migrations/2026-06-18_harness_drawing_management.sql`
- Modify: `docs/reports/db-schema-erd.md`

- [ ] Create sequences and tables with tenant indexes and comments.
- [ ] Seed `PROD_SPEC_SETUP` into `MENU_CATEGORY_ITEMS`.
- [ ] Apply migration to JSHANES through oracle-db connector.
- [ ] Regenerate DB schema document.

### Task 4: Frontend Page

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs`
- Create: `apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx`
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/frontend/src/components/layout/pageRegistry.generated.ts`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`

- [ ] Write failing structure test for route/menu/API strings.
- [ ] Implement list/detail/circuit edit screen.
- [ ] Regenerate page registry.
- [ ] Run frontend structure test and typecheck.

### Task 5: Runtime Verification

- [ ] Load `/production/specification-setup` in browser.
- [ ] Create a sample drawing with at least two circuits.
- [ ] Confirm API response and JSHANES rows.
- [ ] Create a new revision and confirm cloned circuits.
- [ ] Update coordination journal and handoff.
