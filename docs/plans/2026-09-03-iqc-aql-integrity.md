# 품목-AQL 정책 연결 무결성 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 품목과 AQL 정책·기준의 연결을 양방향으로 보호하고, 검사기준 없는 IQC 품목이 자동 PASS되는 경로를 차단한다.

**Architecture:** `PartService`가 품목 저장 시 tenant 범위의 활성 정책을 검증하고 면제 품목의 정책을 제거한다. `AqlService`는 사용 중인 정책·기준의 비활성화를 막고, 검사항목이 없는 IQC 대상 품목의 판정을 거부한다. Oracle 복합 FK와 정리 SQL이 애플리케이션 밖의 입력도 보호한다.

**Tech Stack:** NestJS, TypeORM, Jest, Oracle SQL, pnpm

---

### Task 1: 품목 저장 정책 검증

**Files:**
- Modify: `apps/backend/src/modules/master/services/part.service.spec.ts`
- Modify: `apps/backend/src/modules/master/services/part.service.ts`
- Modify: `apps/backend/src/modules/master/master.module.ts`

- [ ] 존재하지 않는 정책, 비활성 정책, 다른 tenant 정책, 소문자·공백 정규화, IQC 면제 시 정책 제거 테스트를 추가한다.
- [ ] focused Jest를 실행해 신규 테스트가 기존 구현에서 기대한 이유로 실패하는지 확인한다.
- [ ] `IqcAqlPolicy` repository를 주입하고 최종 품목 상태를 검증·정규화하는 공용 helper를 구현한다.
- [ ] create/update에 helper를 연결하고 `MasterModule`에 entity를 등록한다.
- [ ] focused Jest를 재실행해 통과를 확인한다.

Run: `pnpm.cmd --filter @harness/backend test -- src/modules/master/services/part.service.spec.ts --runInBand`

### Task 2: 정책과 AQL 기준의 역방향 보호

**Files:**
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.ts`

- [ ] `Y→N` 전이에서만 같은 tenant의 배정/참조를 검사하고, 이름·비고 수정, 이미 `N`인 행의 비상태 수정, 다른 tenant 참조는 정상 처리되는 테스트를 추가한다.
- [ ] focused Jest를 실행해 실패를 확인한다.
- [ ] update 경로에 tenant 범위 참조 건수 검사를 추가하고 기존 delete 정책 검사와 메시지를 정렬한다.
- [ ] focused Jest를 재실행해 통과를 확인한다.

Run: `pnpm.cmd --filter @harness/backend test -- src/modules/quality/aql/services/aql.service.spec.ts --runInBand`

### Task 3: 검사항목 없는 IQC 품목 판정 차단

**Files:**
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.ts`

- [ ] IQC 대상에서 검사항목 행이 0개인 경우와 활성 행은 있지만 판정 등급·유형이 없는 경우를 각각 같은 설정 오류로 차단하는 테스트를 작성한다.
- [ ] `IQC_FLAG='N'` 또는 `INSPECT_METHOD IN ('SKIP','NONE')`인 면제 품목은 `IQC 검사 대상이 아닌 품목입니다.` 오류를 반환하며 정책·판정표 repository를 조회하지 않는 테스트를 작성한다.
- [ ] focused Jest에서 기존 자동 PASS fallback 때문에 실패하는지 확인한다.
- [ ] 품목을 먼저 조회해 면제 여부를 판별하고, IQC 대상의 활성 검사항목이 없으면 설정 오류를 던진다.
- [ ] 검사항목이 있는 기존 판정 테스트와 함께 focused Jest를 통과시킨다.

### Task 4: Oracle 정리 및 FK migration

**Files:**
- Create: `apps/backend/src/migrations/2026-09-03_iqc_aql_policy_integrity.sql`
- Modify: `docs/database/schema-erd.md` (generator output)

- [ ] JSHANES에서 면제 품목 잔여 연결 1건, 고아 연결 0건, 부모 복합 PK/UK, 컬럼 타입·길이와 동일 이름 제약의 현재 정의를 pre-check한다.
- [ ] SQL 첫 블록에서 모든 FK 선행조건을 검증한다. 제약이 없으면 생성을 진행하고, 이미 있으면 `ENABLED/VALIDATED` 및 정확한 부모·자식 컬럼 정의가 일치할 때 성공 처리하며, 같은 이름의 다른 정의일 때만 DML 전에 중단한다.
- [ ] 후속 블록에 면제 연결 정리와 정확한 tenant 복합 FK 추가를 작성한다. Oracle DDL implicit commit으로 부분 적용될 수 있음을 주석으로 남기고, 각 블록을 재실행해 복구할 수 있게 한다.
- [ ] `oracle-db --execute-file`로 JSHANES에 적용한다.
- [ ] 잔여 연결 0건, 고아 0건, 활성 IQC 정책 누락 0건과 FK `ENABLED/VALIDATED`, `COMPANY, PLANT_CD, IQC_AQL_POLICY_CODE` 컬럼 순서를 post-check한다.
- [ ] migration을 두 번째 실행해 무변경·무오류인지 확인하고 post-check를 반복한다.
- [ ] `python tools/generate_db_schema_doc.py`로 ERD를 갱신한다.

### Task 5: 미완료 검사규격 기록 및 전체 검증

**Files:**
- Create: `docs/reports/unfinished-work/2026-09-03-iqc-item-specs.md`
- Modify: `.ai-coordination/JOURNAL.md`
- Modify: `.ai-coordination/ARCHIVE.md`
- Modify: `.ai-coordination/HANDOFF/codex.md`
- Modify: `.ai-coordination/TASKS.md`
- Modify: `.ai-coordination/LOCKS.md`

- [ ] 검사항목 미등록 원자재 20개와 IQC 여부 확인 대상 반제품·완제품 10개를 기록한다.
- [ ] 두 focused Jest, backend typecheck와 backend Nest 애플리케이션 bootstrap smoke 검증을 실행한다.
- [ ] `git diff --check` 및 의도한 파일만 변경됐는지 확인한다.
- [ ] coordination 결과·검증을 기록하고 task/lock을 종료한다.
- [ ] 사용자가 커밋을 요청하면 의도한 구현 파일만 범위 지정해 커밋한다.

Run: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
