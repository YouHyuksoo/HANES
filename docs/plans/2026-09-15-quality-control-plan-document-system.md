# 품질 관리계획 문서체계 구현 계획

> **작업 실행 규칙:** `executing-plans`를 사용해 아래 체크박스를 순서대로 실행한다. HANES 프로젝트 규칙에 따라 작은 작업을 서브에이전트로 기계적으로 분배하지 않으며, 독립적인 대형 작업에만 별도 위임을 검토한다.

**Goal:** 품목·프로젝트별 PFD, PFMEA, Control Plan을 작성·발행·개정·비교하고 QREKA-PR-025 원문 형식의 PDF·Excel·인쇄물로 출력한다.

**Architecture:** 기존 `/quality/control-plan` 경로는 유지하되 프론트는 통합 문서 작업공간으로 분리한다. 백엔드는 SPC 모듈에서 관리계획 책임을 분리해 `quality/control-plan` 전용 모듈로 구성하고, 공통 Document/Revision 서비스가 불변 발행본과 개정 트랜잭션을 책임진다. PFD·PFMEA·Control Plan은 공통 문서 및 Revision 테이블을 공유하고 내용 행만 유형별 테이블로 분리한다.

**Tech Stack:** Next.js 15, React 19, NestJS 11, TypeORM, Oracle, `TransactionService`, `NumberingService`, jsPDF, jspdf-autotable, SheetJS `xlsx`, Playwright.

**Design:** `docs/specs/2026-09-15-quality-control-plan-document-system-design.md`

---

## 1. 실행 전 경계

- 작업 시작 시 coordination 상태와 활성 lock을 다시 확인한다.
- 현재 dirty tree의 사용자·다른 작업 변경을 보존한다.
- 구현용 격리 worktree가 필요하면 사용자와 경로를 정한 뒤 `using-git-worktrees`를 사용한다. 현재 dirty tree를 임의 이동하거나 초기화하지 않는다.
- DB 대상은 `JSHANES`이며 SQL 파일만 작성하고 끝내지 않는다. 사용자가 보류하지 않는 한 `oracle-db`로 pre-check, 적용, post-check까지 수행한다.
- 프론트 dev 서버가 실행 중이면 `pnpm build`를 실행하지 않는다.
- 커밋·push는 사용자가 요청할 때만 의도한 파일을 선별해 수행한다.

## 2. 목표 파일 구조

### 2.1 Shared

```text
packages/shared/src/types/quality-control-plan.ts
packages/shared/src/utils/quality-control-plan.rules.ts
packages/shared/src/utils/quality-control-plan.rules.test.mjs
packages/shared/src/types/index.ts
packages/shared/src/utils/index.ts
```

`quality-control-plan.ts`는 문서 유형·상태·행·검증결과 계약을 정의한다. `quality-control-plan.rules.ts`는 RPN, Revision 번호, 발행 전 순수 검증규칙을 제공해 프론트와 백엔드가 같은 규칙을 호출하게 한다.

### 2.2 Backend

```text
apps/backend/src/entities/quality-plan-package.entity.ts
apps/backend/src/entities/quality-plan-document.entity.ts
apps/backend/src/entities/quality-plan-revision.entity.ts
apps/backend/src/entities/process-flow-row.entity.ts
apps/backend/src/entities/pfmea-row.entity.ts
apps/backend/src/entities/quality-control-plan-row.entity.ts
apps/backend/src/entities/quality-plan-participant.entity.ts
apps/backend/src/entities/quality-plan-validation.entity.ts
apps/backend/src/entities/quality-plan-event.entity.ts

apps/backend/src/modules/quality/control-plan/control-plan.module.ts
apps/backend/src/modules/quality/control-plan/controllers/plan-package.controller.ts
apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts
apps/backend/src/modules/quality/control-plan/dto/plan-package.dto.ts
apps/backend/src/modules/quality/control-plan/dto/quality-document.dto.ts
apps/backend/src/modules/quality/control-plan/dto/process-flow.dto.ts
apps/backend/src/modules/quality/control-plan/dto/pfmea.dto.ts
apps/backend/src/modules/quality/control-plan/dto/control-plan-row.dto.ts
apps/backend/src/modules/quality/control-plan/services/plan-package.service.ts
apps/backend/src/modules/quality/control-plan/services/quality-document-revision.service.ts
apps/backend/src/modules/quality/control-plan/services/process-flow-document.service.ts
apps/backend/src/modules/quality/control-plan/services/pfmea-document.service.ts
apps/backend/src/modules/quality/control-plan/services/control-plan-document.service.ts
apps/backend/src/modules/quality/control-plan/services/quality-plan-draft-generator.service.ts
apps/backend/src/modules/quality/control-plan/services/quality-plan-validation.service.ts
apps/backend/src/modules/quality/control-plan/services/quality-plan-print-model.service.ts
apps/backend/src/modules/quality/control-plan/services/*.spec.ts
```

### 2.3 Frontend

```text
apps/frontend/src/app/(authenticated)/quality/control-plan/page.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/controlPlanApi.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/useControlPlanWorkspace.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/controlPlanColumns.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanWorkspaceHeader.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/DocumentPackageList.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/DocumentWorkspaceTabs.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/BasicInfoTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/ProcessFlowTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/PfmeaTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/RevisionHistoryTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/OutputCenterTab.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/ValidationResultPanel.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/components/RevisionCreateModal.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/editors/processFlowColumns.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/editors/pfmeaColumns.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/editors/controlPlanItemColumns.tsx
apps/frontend/src/app/(authenticated)/quality/control-plan/print/controlPlanPrintModel.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/controlPlanPdf.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/pfmeaPdf.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/processFlowPdf.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/revisionHistoryPdf.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/excel/qualityPlanWorkbook.ts
apps/frontend/src/app/(authenticated)/quality/control-plan/print/qualityPlanPrint.structure.test.mjs
apps/frontend/src/app/(authenticated)/quality/control-plan/control-plan-workspace.structure.test.mjs
apps/frontend/e2e/control-plan-document-system.spec.ts
```

### 2.4 DB와 문서

```text
apps/backend/src/migrations/2026-09-15_quality_plan_document_system.sql
apps/backend/src/migrations/2026-09-15_migrate_legacy_control_plans.sql
docs/database/schema-erd.md
docs/business-logics/QC_CONTROL_PLAN.md
apps/frontend/public/help/user/ko/QC_CONTROL_PLAN.md
apps/frontend/public/help/operator/ko/QC_CONTROL_PLAN.md
```

---

## Task 1: 공유 계약과 순수 업무규칙

**Files:**

- Create: `packages/shared/src/types/quality-control-plan.ts`
- Create: `packages/shared/src/utils/quality-control-plan.rules.ts`
- Create: `packages/shared/src/utils/quality-control-plan.rules.test.mjs`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/utils/index.ts`

- [x] `QualityDocumentType = 'PFD' | 'PFMEA' | 'CONTROL_PLAN'`, `QualityRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED'`를 정의한다.
- [x] 패키지, 문서, Revision, PFD 행, PFMEA 행, Control Plan 행, 참여자, 검증오류 타입을 정의한다.
- [x] 검증오류는 `severity`, `code`, `documentType`, `revisionId`, `rowId`, `field`, `message`를 갖게 한다.
- [x] `calculateRpn(severity, occurrence, detection)` 테스트를 먼저 작성한다.
- [x] `nextRevisionCode('00') === '01'`, `nextRevisionCode('09') === '10'` 테스트를 작성한다.
- [x] 샘플 크기 `100%`일 때 주기 입력을 차단하는 순수규칙 테스트를 작성한다.
- [x] PFD 공정과 PFMEA/Control Plan 공정 참조 불일치 테스트를 작성한다.
- [x] 특별특성 PFMEA 행이 Control Plan에 연결되지 않은 경우 오류가 되는 테스트를 작성한다.
- [x] 최소 구현 후 공유 패키지 export를 연결한다.
- [x] 실행: `node packages/shared/src/utils/quality-control-plan.rules.test.mjs`
- [x] 실행: `pnpm.cmd --filter @harness/shared exec tsc --noEmit --pretty false`
- [x] 기대 결과: 순수규칙 테스트 PASS, TypeScript 오류 0건.

## Task 2: Oracle 스키마와 Entity

**Files:**

- Create: `apps/backend/src/migrations/2026-09-15_quality_plan_document_system.sql`
- Create: `apps/backend/src/entities/quality-plan-package.entity.ts`
- Create: `apps/backend/src/entities/quality-plan-document.entity.ts`
- Create: `apps/backend/src/entities/quality-plan-revision.entity.ts`
- Create: `apps/backend/src/entities/process-flow-row.entity.ts`
- Create: `apps/backend/src/entities/pfmea-row.entity.ts`
- Create: `apps/backend/src/entities/quality-control-plan-row.entity.ts`
- Create: `apps/backend/src/entities/quality-plan-participant.entity.ts`
- Create: `apps/backend/src/entities/quality-plan-validation.entity.ts`
- Create: `apps/backend/src/entities/quality-plan-event.entity.ts`

- [x] migration에 실제 기존 테이블 스키마를 조회하는 pre-check 주석과 post-check SQL을 먼저 적는다.
- [x] 각 숫자 PK용 Oracle Sequence를 생성하고 모든 insert가 `NEXTVAL`을 쓰게 한다.
- [x] `QUALITY_PLAN_PACKAGES`에 project/customer/item/phase/organization/key contact/tenant 필드를 둔다.
- [x] `QUALITY_PLAN_DOCUMENTS`에 document type, stable document number, package FK를 둔다.
- [x] `QUALITY_PLAN_REVISIONS`에 revision code, status, issue/revision/published date, change reason/content, author/publisher, 참조 PFD/PFMEA Revision ID를 둔다.
- [x] 유형별 행 테이블은 Revision FK와 `ROW_SEQ`를 갖고 `(COMPANY, PLANT_CD, REVISION_ID, ROW_SEQ)` unique 제약을 둔다.
- [x] 동일 문서의 DRAFT 1건 제약은 Oracle function-based unique index로 표현한다.
- [x] `(COMPANY, PLANT_CD, DOCUMENT_NO)`와 `(COMPANY, PLANT_CD, DOCUMENT_ID, REVISION_CODE)` unique 제약을 둔다.
- [x] FK는 가능한 모든 경로에서 `COMPANY`, `PLANT_CD`를 포함한다.
- [x] Entity의 컬럼명·길이·nullable·PK/FK가 SQL과 일치하는 구조 테스트를 추가한다.
- [x] SQL 블록과 DML 사이에 `/` 구분자를 넣는다.
- [x] 실행: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- [x] 기대 결과: Entity 타입 오류 0건. DB 적용은 Task 12까지 보류한다.

## Task 3: 문서번호 채번과 전용 Backend Module

**Files:**

- Modify: `apps/backend/src/shared/numbering.service.ts`
- Modify: `apps/backend/src/shared/numbering.service.spec.ts`
- Create: `apps/backend/src/modules/quality/control-plan/control-plan.module.ts`
- Modify: `apps/backend/src/modules/quality/quality.module.ts`
- Modify: `apps/backend/src/modules/quality/spc/spc.module.ts`

- [x] `nextQualityDocumentNo(qr, type, date)` 테스트를 작성한다.
- [x] `SEQ_QUALITY_PFD_NO`, `SEQ_QUALITY_PFMEA_NO`, `SEQ_QUALITY_CP_NO`의 `NEXTVAL`로 `PFD-YYYYMMDD-NNN`, `PFMEA-...`, `CP-...`을 만드는 메서드를 구현한다.
- [x] 문서번호의 날짜는 가독성용이고 전역 Sequence가 유일성을 보장하게 한다.
- [x] `ControlPlanDocumentModule`에 신규 Entity와 공용 인프라를 등록한다. Controller/Service는 실제 클래스가 생성되는 Task 4에서 등록한다.
- [x] `QualityModule`에서 새 모듈을 import/export한다.
- [x] 기존 `SpcModule`의 ControlPlan Controller/Service/Entity 제거는 아직 하지 않는다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/shared/numbering.service.spec.ts`
- [x] 실행: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`

## Task 4: 패키지 CRUD와 공통 Revision 생명주기

**실행 상태:** 구현 및 단위 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/dto/plan-package.dto.ts`
- Create: `apps/backend/src/modules/quality/control-plan/dto/quality-document.dto.ts`
- Create: `apps/backend/src/modules/quality/control-plan/controllers/plan-package.controller.ts`
- Create: `apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/plan-package.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-document-revision.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/plan-package.service.spec.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-document-revision.service.spec.ts`

- [x] 다른 tenant 품목으로 패키지 생성을 거부하는 테스트를 작성한다.
- [x] 신규 문서가 `REV.00/DRAFT`로 생성되는 테스트를 작성한다.
- [x] 발행본 update/delete 거부 테스트를 작성한다.
- [x] 발행본에서 새 Revision 생성 시 머리정보·하위행 전체가 복제되는 테스트를 작성한다.
- [x] 동일 문서에 DRAFT가 이미 있으면 개정을 거부하는 테스트를 작성한다.
- [x] 새 Revision 발행 성공 후에만 직전 발행본이 `SUPERSEDED`가 되는 테스트를 작성한다.
- [x] 복제 또는 발행 중 오류가 나면 `TransactionService.run()`이 rollback하는 테스트를 작성한다.
- [x] Controller는 `@Company()`, `@Plant()`, `AuthenticatedRequest`에서 tenant와 사용자만 전달하게 한다.
- [x] 발행·개정·출력 이벤트를 `QUALITY_PLAN_EVENTS`에 기록한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/modules/quality/control-plan/services/plan-package.service.spec.ts src/modules/quality/control-plan/services/quality-document-revision.service.spec.ts`

## Task 5: PFD 행 편집과 자동 흐름 생성

**실행 상태:** 구현 및 단위 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/dto/process-flow.dto.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/process-flow-document.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/process-flow-document.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts`

- [x] DRAFT Revision에서만 PFD 행 추가·수정·삭제·재정렬이 가능한 테스트를 작성한다.
- [x] processCode가 있으면 같은 tenant의 공정마스터 존재를 검증한다.
- [x] flow lane은 `SUB`, `MAIN`, `OUTSOURCING`, symbol은 공통코드 값만 허용한다.
- [x] 행 순서 변경 시 중복 `ROW_SEQ`가 생기지 않도록 트랜잭션으로 재번호한다.
- [x] PFD 조회 응답에 출력용 연결선 순서 모델을 포함한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/modules/quality/control-plan/services/process-flow-document.service.spec.ts`

## Task 6: PFMEA 행과 RPN

**실행 상태:** 구현 및 단위 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/dto/pfmea.dto.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/pfmea-document.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/pfmea-document.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts`

- [x] PFMEA 행이 같은 패키지의 고정 PFD Revision 행을 참조하는 테스트를 작성한다.
- [x] severity/occurrence/detection 1~10 범위 테스트를 작성한다.
- [x] 서버가 RPN과 조치 후 RPN을 재계산하고 프론트 값을 덮어쓰는 테스트를 작성한다.
- [x] 특별특성은 신규 공통코드만 허용하는 테스트를 작성한다.
- [x] PFD Revision 변경 시 기존 PFMEA 발행본이 바뀌지 않는 테스트를 작성한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/modules/quality/control-plan/services/pfmea-document.service.spec.ts`

## Task 7: Control Plan 행과 문서 간 추적성

**실행 상태:** 구현 및 단위 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/dto/control-plan-row.dto.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/control-plan-document.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/control-plan-document.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts`
- Modify: `apps/backend/src/modules/quality/inspection/services/trace.service.ts`
- Modify: `apps/backend/src/modules/quality/inspection/services/trace.service.spec.ts`

- [x] Control Plan 행이 같은 패키지의 PFD 행과 PFMEA 행을 참조하는 테스트를 작성한다.
- [x] 공정번호·공정명은 참조 PFD에서 읽고 요청 본문 값으로 변조되지 않는 테스트를 작성한다.
- [x] 관리 특성, 규격, 측정기법, 시료수·주기, 관리방법, 담당, 반응계획, 기록 필드를 저장한다.
- [x] `100%` 시료의 주기 입력을 거부한다.
- [x] 품질 추적성은 최신 `PUBLISHED` Control Plan Revision만 조회하도록 전환한다.
- [x] 기존 `CONTROL_PLAN_ITEMS` 기반 trace 조회와 결과가 일치하는 호환 테스트를 추가한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/modules/quality/control-plan/services/control-plan-document.service.spec.ts src/modules/quality/inspection/services/trace.service.spec.ts`

## Task 8: 자동 초안과 발행 검증

**실행 상태:** 구현 및 단위 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-draft-generator.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-draft-generator.service.spec.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-validation.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-validation.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/control-plan/controllers/plan-package.controller.ts`
- Modify: `apps/backend/src/modules/quality/control-plan/controllers/quality-document.controller.ts`

- [x] 품목 라우팅에서 PFD 행을 순서대로 생성하는 테스트를 작성한다.
- [x] 공정·설비·검사항목·압착규격이 있을 때 PFMEA/Control Plan 초안 후보로 매핑하는 테스트를 작성한다.
- [x] 기존 기준정보가 없어도 빈 문서 묶음을 생성할 수 있게 한다.
- [x] PFD 중복, PFMEA 미연결, RPN 오류, 특별특성 누락, 필수 관리방법 누락을 차단 오류로 반환한다.
- [x] RPN 100 이상 미조치, 검교정/MSA 미확인, 오래된 참조 Revision은 경고로 반환한다.
- [x] 발행 API가 `ERROR` 1건 이상이면 상태를 바꾸지 않는 테스트를 작성한다.
- [x] 검증결과 snapshot을 `QUALITY_PLAN_VALIDATIONS`에 저장한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend test -- --runInBand src/modules/quality/control-plan/services/quality-plan-draft-generator.service.spec.ts src/modules/quality/control-plan/services/quality-plan-validation.service.spec.ts`

## Task 9: 기존 데이터 이관과 호환 API

**실행 상태:** JSHANES 이관 및 읽기 호환 완료. 구 쓰기는 이중 원장 방지를 위해 410 종료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/migrations/2026-09-15_migrate_legacy_control_plans.sql`
- Modify: `apps/backend/src/modules/quality/spc/controllers/control-plan.controller.ts`
- Modify: `apps/backend/src/modules/quality/spc/services/control-plan.service.ts`
- Modify: `apps/backend/src/modules/quality/spc/services/control-plan.service.spec.ts`

- [x] 실제 JSHANES `CONTROL_PLANS`, `CONTROL_PLAN_ITEMS` 컬럼·PK·tenant·건수를 pre-check한다.
- [x] legacy `planNo`를 신규 document number로 보존하고 기존 `revisionNo`를 2자리 Revision code로 변환한다.
- [x] itemCode/phase 단위로 문서 계보를 구성하되 모호한 중복은 자동 합치지 않고 검증 결과로 중단한다.
- [x] `DRAFT`, `APPROVED`, `OBSOLETE`를 신규 상태로 명시적으로 매핑한다.
- [x] 기존 항목의 `CC/SC/HI`는 승인된 코드 매핑표에 따라 변환한다.
- [x] 기존 프론트/API 소비자를 위해 구 API가 신규 서비스를 호출하는 adapter를 둔다.
- [x] 프론트가 호출하지만 현재 없는 `/items` API를 임시 추가하지 않고 신규 Revision 행 API로 전환한다.
- [x] 이관 전후 계획서 수, 항목 수, 품목별 최신 발행본, 고아 FK가 일치하는 post-check를 SQL에 포함한다.
- [x] 실행: `git diff --check -- apps/backend/src/migrations/2026-09-15_migrate_legacy_control_plans.sql`

## Task 10: 프론트 통합 작업공간과 API 상태

**실행 상태:** 구현, 구조 테스트 및 typecheck 완료 (2026-09-15)

**Files:**

- Modify: `apps/frontend/src/app/(authenticated)/quality/control-plan/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/controlPlanApi.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/useControlPlanWorkspace.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanWorkspaceHeader.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/DocumentPackageList.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/DocumentWorkspaceTabs.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/BasicInfoTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/RevisionCreateModal.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ValidationResultPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/control-plan-workspace.structure.test.mjs`

- [x] 구조 테스트에서 `page.tsx`가 화면 조립과 선택 상태만 담당하도록 먼저 규정한다.
- [x] API 요청·응답 변환을 `controlPlanApi.ts`로 모은다.
- [x] 선택 패키지·문서·Revision·탭·저장상태를 `useControlPlanWorkspace.ts`가 관리한다.
- [x] 왼쪽 문서함에 PFD/PFMEA/Control Plan 현재 REV와 상태를 표시한다.
- [x] 상단에 신규, 자동 초안, 개정 생성, 발행, 출력 액션을 배치한다.
- [x] 발행본에서는 모든 입력을 읽기 전용으로 하고 `개정 생성`만 제공한다.
- [x] API 오류를 빈 목록으로 숨기지 않고 사용자에게 정확한 오류를 표시한다.
- [x] 검증오류 클릭 시 대상 탭·행으로 이동한다.
- [x] 실행: `node apps/frontend/src/app/(authenticated)/quality/control-plan/control-plan-workspace.structure.test.mjs`
- [x] 실행: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`

## Task 11: PFD·PFMEA·Control Plan 편집기

**실행 상태:** 구현, 레거시 컴포넌트 제거 및 typecheck 완료 (2026-09-15)

**Files:**

- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ProcessFlowTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/PfmeaTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/RevisionHistoryTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/editors/processFlowColumns.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/editors/pfmeaColumns.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/editors/controlPlanItemColumns.tsx`
- Remove after parity: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanFormPanel.tsx`
- Remove after parity: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanItemList.tsx`

- [x] PFD 행에 공정마스터 선택, lane·기호 공통코드 선택, drag 정렬을 구현한다.
- [x] PFMEA 행은 선택 PFD 행을 기준으로 생성하고 RPN을 즉시 계산해 표시한다.
- [x] Control Plan 행은 PFMEA 항목을 선택해 연결하고 기준정보 선택을 우선한다.
- [x] 특별특성은 `ComCodeSelect`와 기호·설명으로 표시한다.
- [x] 긴 규격·반응계획은 한 줄 Input이 아니라 편집 모달 또는 textarea로 처리한다.
- [x] 행 저장은 optimistic update보다 서버 결과 재조회 방식을 우선해 Revision 불변성을 지킨다.
- [x] flex 스크롤 컨테이너에 `min-h-0`를 적용한다.
- [x] 기존 FormPanel/ItemList는 기능 parity와 참조 0건을 확인한 후 제거한다.
- [x] 실행: `rg -n "ControlPlanFormPanel|ControlPlanItemList" apps/frontend/src`
- [x] 기대 결과: 제거 시점에 legacy 참조 0건.
- [x] 실행: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`

## Task 12: 공식 PDF·Excel·인쇄

**실행 상태:** 구현 및 PDF/Excel 실파일 검증 완료 (2026-09-15)

**Files:**

- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-print-model.service.ts`
- Create: `apps/backend/src/modules/quality/control-plan/services/quality-plan-print-model.service.spec.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/components/OutputCenterTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/controlPlanPrintModel.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/processFlowPdf.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/pfmeaPdf.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/controlPlanPdf.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/pdf/revisionHistoryPdf.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/excel/qualityPlanWorkbook.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/control-plan/print/qualityPlanPrint.structure.test.mjs`

- [x] Backend print model이 발행 Revision snapshot만 반환하고 현재 마스터 값을 재조합하지 않는 테스트를 작성한다.
- [x] 공통 `loadNotoSansKrFont()`를 구현해 모든 PDF 템플릿이 같은 CID 폰트를 사용하게 한다.
- [x] PFD를 `A4 landscape`, PFMEA와 Control Plan을 `A3 landscape`, 이력을 `A4 portrait`로 생성한다.
- [x] Control Plan의 18개 물리 컬럼과 원문 그룹 헤더·rowSpan/colSpan을 구현한다.
- [x] PFMEA의 30개 번호 필드와 조치 전·후 RPN 영역을 구현한다.
- [x] 다중 페이지에서 문서 머리글, 컬럼 헤더, 양식번호, `page/total`을 반복한다.
- [x] 결재 제외에 따라 Verified/Approved는 `-`, 고객승인 필드는 기본 `N/A`로 출력한다.
- [x] Excel workbook은 `PFD`, `PFMEA`, `Control Plan`, `Revision History` Sheet를 생성하고 병합·열너비·인쇄영역을 설정한다.
- [x] 직접 인쇄는 생성된 PDF Blob을 사용하며 화면 DOM 캡처를 하지 않는다.
- [x] 실행: `node apps/frontend/src/app/(authenticated)/quality/control-plan/print/qualityPlanPrint.structure.test.mjs`
- [x] 출력 파일을 생성한 뒤 Python `pypdf`로 MediaBox와 페이지 수를 확인한다.
- [x] 원본 PDF 13~21페이지와 나란히 렌더링해 컬럼 순서·병합·머리글·바닥글을 시각 비교한다.

## Task 13: JSHANES 적용, 실제 UI 검증, 문서화

**실행 상태:** JSHANES 적용, 기본 포트 dev 서버, 실제 로그인 Playwright, 승인 아트팩트 기반 A3 미리보기와 출력 검증까지 완료 (2026-09-15)

**Files:**

- Modify: `docs/database/schema-erd.md`
- Modify: `docs/business-logics/QC_CONTROL_PLAN.md`
- Modify: `apps/frontend/public/help/user/ko/QC_CONTROL_PLAN.md`
- Modify: `apps/frontend/public/help/operator/ko/QC_CONTROL_PLAN.md`
- Create: `apps/frontend/e2e/control-plan-document-system.spec.ts`
- Modify if needed: `apps/frontend/src/locales/ko.json`
- Modify if needed: `apps/frontend/src/locales/en.json`
- Modify if needed: `apps/frontend/src/locales/vi.json`
- Modify if needed: `apps/frontend/src/locales/zh.json`

- [x] `oracle-db` 스킬을 읽고 JSHANES 연결·현재 스키마·legacy 데이터 건수를 pre-check한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend exec oracle-db apply src/migrations/2026-09-15_quality_plan_document_system.sql --site JSHANES`
- [x] 실행: `pnpm.cmd --filter @harness/backend exec oracle-db apply src/migrations/2026-09-15_migrate_legacy_control_plans.sql --site JSHANES`
- [x] 실패 시 다른 DB나 도구로 우회하지 않고 SQL 형식 또는 실제 스키마 불일치를 고쳐 같은 connector로 재적용한다.
- [x] post-check로 테이블·Sequence·제약·이관 건수·고아 FK·DRAFT 중복을 확인한다.
- [x] 실행: `python tools/generate_db_schema_doc.py`
- [x] Backend focused test 전체를 실행한다.
- [x] 실행: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- [x] 실행: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- [x] 포트 3002 dev 서버 상태를 확인하고 없거나 다른 서버면 임의 대체 포트를 띄우지 않는다.
- [x] 실제 로그인 자격정보를 환경변수로 넣고 실행: `pnpm.cmd --filter @harness/frontend exec playwright test e2e/control-plan-document-system.spec.ts --project=chromium`
- [x] E2E에서 신규 묶음, 자동 초안, PFD/PFMEA/CP 편집, 발행 차단, 발행, REV.01, 이전 REV, 네 PDF와 Excel 다운로드를 검증한다.
- [x] 출력 PDF를 이미지로 렌더링해 원본 양식과 브라우저 미리보기의 시각 일치를 확인한다.
- [x] 도움말과 비즈니스 로직 문서를 실제 구현 기준으로 갱신하고 `verifiedCommit`은 커밋 시점에 스탬프한다.
- [x] 실행: `node tools/help-frontmatter-audit.mjs`
- [x] 실행: `git diff --check`
- [x] dev 서버 실행 중에는 build를 실행하지 않는다. 전체 build는 사용자가 별도로 요청한 경우에만 수행한다.

---

## 3. 구현 완료 체크포인트

- [x] PFD, PFMEA, Control Plan이 같은 패키지에서 Revision 참조로 연결된다.
- [x] 발행본은 수정·삭제되지 않고 개정 복제로만 변경된다.
- [x] 결재 없이 작성자·발행자·시각이 자동 기록된다.
- [x] PFD→PFMEA→Control Plan 특별특성 누락을 서버가 차단한다.
- [x] 기존 `CONTROL_PLANS`/`CONTROL_PLAN_ITEMS` 데이터와 trace 소비자가 유실 없이 전환된다.
- [x] A4 PFD, A3 PFMEA, A4 이력, A3 Control Plan이 원문 양식으로 출력된다.
- [x] PDF 한글과 특별특성 기호가 깨지지 않는다.
- [x] Excel 4개 Sheet가 PDF와 동일 데이터를 가진다.
- [x] Backend focused tests, shared/frontend/backend typecheck, JSHANES post-check, 포트 3002 Playwright가 모두 통과한다.
- [x] 미검증 항목이 있으면 `docs/reports/unfinished-work/`에 기록한다.

## 4. 커밋 경계 제안

사용자가 커밋을 요청한 경우에만 다음 단위로 stage한다.

1. `feat(quality): add versioned quality-plan schema and contracts`
2. `feat(quality): add PFD PFMEA and control-plan document services`
3. `feat(quality): add integrated control-plan workspace`
4. `feat(quality): add official control-plan document exports`
5. `docs(quality): document control-plan workflow and verification`

각 커밋 전 `git status --short`, `git diff --cached --check`, stage 대상 파일을 확인하며 현재 dirty tree의 다른 작업 파일은 포함하지 않는다.
