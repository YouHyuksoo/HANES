# REVIEW_QUEUE

이 파일은 구현이 끝났지만 리뷰 또는 사용자 확인이 필요한 작업만 보관한다.
`TASKS.md`에는 `REVIEW` 작업을 남기지 않는다.

리뷰가 승인되거나 사용자가 완료를 확인하면:

1. 상세 결과와 검증은 `JOURNAL.md`에 있는지 확인한다.
2. `ARCHIVE.md`에 한 줄 요약을 남긴다.
3. 이 파일에서 해당 작업 본문을 제거한다.

## Review Tasks

## T-ARCH-PAGE-RULE-REFORM page.tsx 축소와 업무 규칙 중앙화 아키텍처 개선
status: REVIEW
owner: codex
role: implementer/reviewer
scope:
- HANES 전체 `page.tsx` 인라인 DataGrid 컬럼 분리 스윕
- 컬럼 정의를 화면별 `*Columns.tsx` 팩토리와 필요 시 `types.ts`로 분리
files:
- docs/reports/architecture-improvement-candidates.md
- apps/frontend/src/app/(authenticated)/customs/stock/**
- apps/frontend/src/app/(authenticated)/sales/customer-po-status/**
- apps/frontend/src/app/(authenticated)/outsourcing/receive/**
- apps/frontend/src/app/(authenticated)/quality/defect/**
- apps/frontend/src/app/(authenticated)/shipping/return/**
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `rg -n "ColumnDef<|const .*columns\\s*=\\s*useMemo<ColumnDef|const .*Columns\\s*=\\s*useMemo<ColumnDef" 'apps/frontend/src/app/(authenticated)' -g page.tsx` 결과 없음
- PASS: `node --test` 신규 5개 컬럼 구조 테스트 10/10 pass
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `git diff --check`
review:
- needs-review
notes:
- 사용자 승인 후 기존 active/stale lock이 남아 있던 5개 화면까지 컬럼 분리를 완료했다.
- 업무 규칙 중앙화의 추가 후보는 별도 작업으로 다시 lock을 잡고 진행한다.

## T-IQC-AQL-ISO-REDESIGN AQL ISO 2859 표준 구조 재설계
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/quality/aql`을 ISO 2859 흐름(`LOT+검사수준 -> Code Letter -> Sample Size -> AQL -> Ac/Re`) 기준 DB/API/UI로 재설계
- 기존 `AQL_SAMPLING_RULES` 직접 판정 구조를 즉시 폐기하고 신규 표준 테이블로 resolve 경로 전환
files:
- apps/backend/src/entities/aql-*.entity.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/migrations/2026-06-26_iqc_aql_iso2859_redesign.sql
- apps/frontend/src/app/(authenticated)/quality/aql/**
- docs/superpowers/plans/2026-06-26-aql-iso2859-redesign.md
- docs/reports/db-schema-erd.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/DECISIONS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: ISO Code Letter 기반 resolve 서비스 테스트가 구형 LOT 직접 rule 기준과 맞지 않아 실패
- PASS: `pnpm.cmd --filter @harness/backend test -- aql-standard.entity.spec.ts aql.service.spec.ts --runInBand`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: JSHANES `2026-06-26_iqc_aql_iso2859_redesign.sql` 적용
- PASS: JSHANES post-check `AQL_CODE_LETTER_RULES=105`, `AQL_CODE_LETTER_SAMPLES=16`, `AQL_ACCEPTANCE_RULES=62`
- PASS: JSHANES 대표값 `LOT 350 + Level II -> H`, `H -> sample 50`, `H + AQL 1.0 -> Ac1/Re2`, `A + AQL 0.015 -> sample code J / Ac0/Re1`
- PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
- PASS: 3002 `/quality/aql` Playwright 로그인 후 탭 표시/전환 확인, console error 0, 구형 LOT rule 안내문 미표시
- PASS: 후속 빈 화면 보고 대응 후 Code Letter/Sampling Plan 탭 진입 시 `/iso` 재조회 보강, 3002 Playwright `전체 105건` 표시 확인
- PASS: 후속 UI 보정 후 Code Letter/Sampling Plan을 사용자가 제공한 ISO 이미지형 매트릭스 표로 표시, 3002 Playwright 캡처 확인
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- 사용자가 점진폐기가 아니라 즉시 표준 구조 적용을 지시했다.
- 기존 REVIEW 작업 `T-IQC-AQL-SAMPLE-SIZE-NORMALIZE`의 cap/보정 방향은 이번 구조에서 폐기된다.
- 신규 UI는 `AQL 정책관리`, `AQL 기준`, `Code Letter 표`, `Sampling Plan 표` 4개 탭으로 구성한다.
- `Code Letter 표`와 `Sampling Plan 표`는 일반 DataGrid 목록이 아니라 ISO 원표처럼 행/열 매트릭스로 표시한다.

## T-IQC-AQL-SAMPLE-SIZE-NORMALIZE AQL 샘플수량 정상화
status: REVIEW
owner: codex
role: implementer/operator
scope:
- JSHANES `AQL_SAMPLING_RULES`의 `SAMPLE_SIZE > LOT_QTY_TO` 비정상 행 보정
- AQL resolve 결과가 실제 LOT 수량보다 큰 샘플수량을 반환하지 않도록 방어
files:
- apps/backend/src/modules/quality/aql/services/aql.service.ts
- apps/backend/src/modules/quality/aql/services/aql.service.spec.ts
- apps/backend/src/migrations/2026-06-26_fix_aql_sample_size_not_exceed_lot.sql
- apps/backend/src/migrations/2026-06-26_aql_standard_s1_0_015.sql
- apps/backend/src/migrations/2026-06-26_aql_standard_I_0.01.sql
- apps/backend/src/migrations/aql-sample-size-normalize.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `pnpm.cmd --filter @harness/backend test -- aql.service.spec.ts --runInBand`
- PASS: `node --test apps/backend/src/migrations/aql-sample-size-normalize.structure.test.mjs`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: JSHANES correction SQL 적용/재실행 성공
- PASS: JSHANES `SAMPLE_SIZE > LOT_QTY_TO` 0건
review:
- needs-review
notes:
- JSHANES pre-check에서 `SAMPLE_SIZE > LOT_QTY_TO` 행 9건 확인: `AQL-I-0.01` 5건, `AQL-S-1-0.015` 4건.
- 화면의 LOT 2~8 구간 sampleSize 80은 계산 문제가 아니라 seed/migration 데이터 문제다.
- 원본 seed SQL도 수정해 `AQL-S-1-0.015`와 `AQL-I-0.01` 작은 LOT 구간이 다시 비정상 샘플수량으로 돌아가지 않게 했다.
- 후속 사용자 정정으로 이 보정 방향은 ISO 2859 기준에서 폐기됐다. 관련 correction migration/test는 삭제했고, `T-IQC-AQL-ISO-REDESIGN`에서 표준 sample과 실제 검사수량을 분리했다.

## T-IQC-CERT-OPTIONAL IQC 성적서 첨부 선택 처리
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc` 검사 이후 성적서 미첨부 상태에서도 입고 등록이 가능하도록 백엔드 차단 정책 해제
files:
- apps/frontend/src/app/(authenticated)/material/receive/components/ReceivableTable.tsx
- apps/frontend/src/app/(authenticated)/material/receive/components/receivable-table-cert-status.structure.test.mjs
- apps/backend/src/modules/material/services/receiving.service.ts
- apps/backend/src/modules/material/services/receiving.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/receiving.service.spec.ts --runInBand`에서 성적서 미첨부 차단 테스트 2건 실패 확인
- RED: `node --test "apps/frontend/src/app/(authenticated)/material/receive/components/receivable-table-cert-status.structure.test.mjs"`에서 첨부 상태 우선 표시 조건 실패 확인
- PASS: `pnpm.cmd --filter @harness/backend test -- receiving.service.spec.ts --runInBand`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/material/receive/components/receivable-table-cert-status.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `/material/iqc`의 검사결과 저장 자체는 이미 `certFile`이 있을 때만 업로드하고 없어도 저장 API를 호출한다.
- 실제 강제는 `ReceivingService`가 IQC 대상품의 PASS 이력에 `certFilePath`가 없으면 입고를 차단하는 정책이다.
- 입고대기 그리드는 성적서가 선택 첨부로 바뀌어도 이미 첨부된 경우에는 `첨부` 상태를 먼저 보여야 한다.

## T-PRODUCT-RECEIVE-CANCEL-RETRY 제품입고 취소 후 재입고 버그 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/product/receive` 완제품 박스 입고 후 취소가 실제 `WIP_OUT` 입고 거래를 대상으로 처리되게 보정
- 취소 후 같은 박스를 재입고할 때 기존 `WIP_OUT DONE` 잔재로 중복입고 가드가 걸리지 않도록 이력/취소 경로 정합성 확인
files:
- apps/frontend/src/app/(authenticated)/product/receive/page.tsx
- apps/frontend/src/app/(authenticated)/product/receipt-cancel/page.tsx
- apps/frontend/src/app/(authenticated)/product/receive/product-receive-cancel-retry.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: 신규 구조 테스트가 `WIP_OUT,WIP_OUT_CANCEL` 박스 입고 이력 조회 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/product/receive/product-receive-cancel-retry.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `/inventory/fg/receive`는 박스 완제품 입고를 `PRODUCT_TRANSACTIONS.TRANS_TYPE='WIP_OUT'`, `REF_TYPE='BOX'`로 기록한다.
- 기존 `/product/receive` 완제품 이력은 `FG_IN,FG_IN_CANCEL`만 조회해 실제 입고 거래가 숨겨지고 취소 대상에서 빠졌다.

## T-PRODUCT-RECEIVE-BX2606260001-CLEANUP BX2606260001 제품입고 이력 정리
status: REVIEW
owner: codex
role: operator
scope:
- 취소 후에도 이미 입고된 박스로 판단되는 `BX2606260001` 제품입고 이력 삭제
- 제품재고를 입고 전 상태(`WIP_MAIN` 가용 5, `FG_MAIN` 제거/차감)로 복원
files:
- apps/backend/src/migrations/2026-06-26_cleanup_product_receive_bx2606260001.sql
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: JSHANES pre-check 원인 행 `PTX2026062600001 / WIP_OUT / REF_TYPE=BOX / REF_ID=BX2606260001 / STATUS=DONE` 확인
- PASS: JSHANES pre-check `FG_MAIN / N91H00-X9800` 재고 5, `WIP_MAIN` 없음 확인
- PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-26_cleanup_product_receive_bx2606260001.sql`
- PASS: post-check `BX2606260001` 관련 정상 BOX 전표 0건
- PASS: post-check 중복입고 가드 조건 count 0건
- PASS: post-check `WIP_MAIN / N91H00-X9800` = `QTY=5 / AVAILABLE_QTY=5 / STATUS=NORMAL`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- 원인 행: `PRODUCT_TRANSACTIONS.PTX2026062600001` = `WIP_OUT / REF_TYPE=BOX / REF_ID=BX2606260001 / STATUS=DONE`.
- 이력만 삭제하면 `WIP_MAIN` 재고 부족이 재발하므로 `FG_MAIN` 수량을 되돌려야 한다.

## T-PRODUCT-RECEIVE-BX2606260001-WIP-SEED BX2606260001 제품입고 WIP 재고 시드
status: REVIEW
owner: codex
role: operator
scope:
- `/product/receive`에서 `BX2606260001` 제품입고 시 `WIP_MAIN` 출고 재고 부족을 해소
files:
- apps/backend/src/migrations/2026-06-26_seed_wip_stock_bx2606260001_n91h00.sql
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: JSHANES pre-check `BX2606260001` = `CLOSED / QTY=5 / N91H00-X9800`
- PASS: JSHANES pre-check `PRODUCT_STOCKS`에 `N91H00-X9800` 재고 0건, `PRODUCT_TRANSACTIONS`의 `BX2606260001` 정상 BOX 전표 0건
- PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-26_seed_wip_stock_bx2606260001_n91h00.sql`
- PASS: 같은 SQL 재실행 idempotent 확인
- PASS: post-check `WIP_MAIN / N91H00-X9800` = `QTY=5 / AVAILABLE_QTY=5 / STATUS=NORMAL`
- PASS: seed 전표 `PTX-SEED-BX2606260001-WIP` = `WIP_IN / REF_TYPE=SEED`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `/inventory/fg/receive`는 `WIP_MAIN` 제품재고를 먼저 `WIP_OUT` 차감한 뒤 FG 기본창고로 이동한다.
- `BOX` refType 전표를 미리 만들면 이중입고 가드에 걸리므로 seed 전표는 `refType='SEED'`로 남긴다.

## T-SHIP-PACK-BX2606260001-SEED BX2606260001 포장 시드
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `/shipping/pack`에서 `BX2606260001`에 `N91H00-X9800` FG 시리얼을 담을 수 있도록 시드 데이터 추가
files:
- apps/backend/src/migrations/2026-06-26_seed_pack_bx2606260001_n91h00.sql
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: JSHANES pre-check `BX2606260001` = `OPEN / N91H00-X9800 / QTY=0 / SERIAL_LIST IS NULL`
- PASS: JSHANES pre-check `ITEM_MASTERS.N91H00-X9800` 존재, 기존 packable FG 0건
- PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-26_seed_pack_bx2606260001_n91h00.sql`
- PASS: 같은 SQL 재실행 idempotent 확인
- PASS: post-check `FG-N91-X9800-001`~`005` 5건이 `VISUAL_PASS / INSPECT_PASS_YN=Y / BOX_NO IS NULL`
- PASS: `MAT_LOTS` 동일 바코드 0건으로 포장 검증 충돌 없음
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `BOX_MASTERS.BX2606260001`은 이미 `OPEN / N91H00-X9800 / QTY=0 / SERIAL_LIST IS NULL` 상태다.
- 포장 가능 조건은 `FG_LABELS.STATUS='VISUAL_PASS'`, `INSPECT_PASS_YN='Y'`, `BOX_NO IS NULL`, 같은 회사/공장/품목이다.

## T-RECEIVE-HISTORY-CONCESSION-FLAG 입고이력 특채여부 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/receive-history` 그리드에 특채 입고 여부 표시
- `/material/receiving` 이력 응답에 LOT 기준 `isConcession`/`specialAcceptYn` 보강
files:
- apps/backend/src/modules/material/services/receiving.service.ts
- apps/backend/src/modules/material/services/receiving.service.spec.ts
- apps/frontend/src/app/(authenticated)/material/receive/components/ReceivingHistoryTable.tsx
- apps/frontend/src/app/(authenticated)/material/receive/components/types.ts
- apps/frontend/src/app/(authenticated)/material/receive-history/receive-history-concession-flag.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `receiving.service.spec.ts`에 특채 LOT 응답 기대 추가
- PASS: `pnpm.cmd --filter @harness/backend test -- receiving.service.spec.ts --runInBand`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/material/receive-history/receive-history-concession-flag.structure.test.mjs" "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs" apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `apps/backend/src/modules/material/services/receiving.service.ts`는 `T-RECEIVE-LOCATION` active lock과 겹친다. 사용자가 `/material/receive-history` 특채여부 표시를 바로 요청했으므로 충돌 사실을 기록하고 `findAll()` 반환부만 최소 범위로 수정한다.
- 특채여부 기준은 `MAT_LOTS.IQC_STATUS = 'FAIL' AND MAT_LOTS.SPECIAL_ACCEPT_YN = 'Y'`이다.

## T-CONCESSION-WORKER 특채처리 작업자 기록
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/material/concession` 특채 처리 모달에 특채처리 작업자 선택 추가
- 특채 처리 모달에서 작업자 QR 스캔으로도 같은 작업자 코드를 입력 가능하게 보정
- 작업자 선택과 QR 스캔을 분리된 두 영역이 아니라 한 줄 대체 입력 방식으로 정리
- `MAT_LOTS`에 특채처리 작업자 컬럼 추가 및 JSHANES 적용
files:
- apps/backend/src/entities/mat-lot.entity.ts
- apps/backend/src/modules/material/dto/concession.dto.ts
- apps/backend/src/modules/material/services/concession.service.ts
- apps/backend/src/modules/material/services/concession.service.spec.ts
- apps/backend/src/migrations/2026-06-26_mat_lots_concession_worker.sql
- apps/frontend/src/app/(authenticated)/material/concession/page.tsx
- apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs
- apps/frontend/src/hooks/useMasterOptions.ts
- apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs
- docs/reports/db-schema-erd.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/DECISIONS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: backend spec가 작업자 검증/저장 부재로 실패, frontend 구조 테스트가 `WorkerSelect`/payload 부재로 실패
- PASS: `pnpm.cmd --filter @harness/backend test -- concession.service.spec.ts --runInBand`
- PASS: `node --test apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs"`
- PASS: 후속 QR 스캔 보정 후 `node --test "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs" apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs`
- PASS: 후속 QR 스캔 보정 후 `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: QR 스캔 옆 작업자 선택 단일 영역화 후 `node --test "apps/frontend/src/app/(authenticated)/material/receive-history/receive-history-concession-flag.structure.test.mjs" "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs" apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs`
- PASS: QR 스캔 옆 작업자 선택 단일 영역화 후 `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: JSHANES `2026-06-26_mat_lots_concession_worker.sql` 적용 및 재실행 idempotent 확인
- PASS: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- 작업자 기준정보는 기존 `/master/workers`와 공용 `WorkerSelect`를 사용한다.
- QR 스캔은 기존 `GET /master/workers/by-qr/:qrCode`를 사용해 `specialAcceptWorkerCode`에 같은 값을 채운다.

## T-TRACE-WEBDISPLAY-WIZARD 추적성 WebDisplay식 시작 모달 적용
status: REVIEW
owner: codex
role: implementer
scope:
- `/quality/trace`를 WebDisplay 추적성처럼 추적 방식 선택 모달 → 후보 목록 → 상세 추적 흐름으로 개선
- 제품 바코드, 자재 UID/LOT, 박스번호, 팔레트번호, 출하지시번호, 설비+기간, 작업지시번호, SG 바코드 시작점을 지원
files:
- apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts
- apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
- apps/backend/src/modules/quality/inspection/controllers/trace.controller.ts
- apps/backend/src/modules/quality/inspection/inspection.module.ts
- apps/frontend/src/app/(authenticated)/quality/trace/page.tsx
- apps/frontend/src/app/(authenticated)/quality/trace/types.ts
- apps/frontend/src/app/(authenticated)/quality/trace/components/TraceSearchWizard.tsx
- apps/frontend/src/app/(authenticated)/quality/trace/trace-webdisplay-wizard.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/quality/trace/trace-webdisplay-wizard.structure.test.mjs"`가 `TraceSearchWizard.tsx` 부재 및 후보 API 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/trace/trace-webdisplay-wizard.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
- 미실행: 기존 3002 `/quality/trace`는 5초 HTTP 타임아웃이라 브라우저 런타임 확인 불가. 임의 대체 포트/서버는 사용하지 않음.
review:
- needs-review
notes:
- `T-TRACE-FULL` active lock과 같은 추적성 파일이 겹친다. 사용자가 본 대화에서 WebDisplay UI 방식 적용을 명시하고 "진행해"라고 지시했으므로 충돌 사실을 기록하고 진행한다.
- locale 파일은 다른 active lock과 충돌 중이므로 수정하지 않고 `t(key, fallback)` 패턴만 사용한다.

## T-SHIP-HISTORY-SHIPPED-DETAIL 출하이력 우측 패널 박스출하 표시 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/history` 우측 상세 패널이 팔레트 없는 박스 단건 출하를 0으로 표시하는 문제 보정
files:
- apps/frontend/src/app/(authenticated)/shipping/history/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs"`가 `OrderShippedBox` 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-no-info-cards.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-status-help.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 기존 3002 Playwright 확인. `SH2606250005` 선택 시 우측 패널 `팔레트 0 / 박스 1 / 총수량 10`, `BX2606250001` 표시. 스크린샷 `docs/reports/shipping-history-shipped-detail-3002.png`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- DB 확인: `SH2606250005`는 `PALLET_MASTERS` 0건, `BOX_MASTERS` 단건 `BX2606250001`/`SHIPPED`/수량 10. 기존 fulfillment API는 팔레트만 반환해 우측 패널이 0으로 보인다.
- 백엔드 lock 파일은 수정하지 않고 기존 `GET /shipping/orders/:id/shipped-detail`를 사용했다.

## T-SHIP-ORDER-SAVE-CONFIRM 출하지시 저장 후 확정 액션 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` 신규/수정 패널에서 임시저장 후 바로 확정 처리 가능하게 보정
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`가 `handleSaveAndConfirm` 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-required-fields.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-right-panel.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 기존 3002 Playwright 렌더 확인. 신규 등록 패널에서 `저장 후 확정` 버튼 표시, 필수값 전 disabled 정상, 가로 overflow 없음. 스크린샷 `docs/reports/shipping-order-save-confirm-3002.png`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- 백엔드 확정 API는 이미 `PUT /shipping/orders/:id/confirm`로 존재한다. 문제는 신규 작성 화면에서 저장 직후 확정 진입점이 없는 UX였다.
- 패널 하단에는 `저장 후 확정` 버튼을 추가했다. 신규는 `POST /shipping/orders` 응답의 `shipOrderNo`로 즉시 confirm하고, 기존 DRAFT 수정은 `PUT /shipping/orders/:id` 후 confirm한다.

## T-SHIP-PALLET-LAYOUT-TIDY 팔레트적재 툴바/우측 패널 정렬 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/pallet` 툴바 아이콘/바코드 입력 배치 정렬
- 우측 포함박스 섹션 폭 축소
files:
- apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `git diff --check -- "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`
- PASS: 3002 Playwright 렌더 측정. 1155px 폭에서 툴바 1줄, 겹침 0건, 가로 overflow 없음. 스크린샷 `docs/reports/shipping-pallet-layout-3002.png`
review:
- needs-review
notes:
- 공용 DataGrid는 건드리지 않고 팔레트 화면의 toolbarLeft와 본문 grid만 수정했다.
- 우측 포함박스 섹션은 `xl` 이상에서 18rem, `2xl` 이상에서 20rem으로 제한하고, 1155px 폭에서는 아래로 내려가도록 했다.

## T-SHIP-ORDER-UNCONFIRM 출하지시 확정취소(DRAFT 복귀) 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order`에서 확정된 출하지시를 출하 진행 전 `DRAFT`로 되돌리는 기능 추가
files:
- apps/backend/src/modules/shipping/services/ship-order.service.ts
- apps/backend/src/modules/shipping/services/ship-order.service.spec.ts
- apps/backend/src/modules/shipping/controllers/ship-order.controller.ts
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs
- apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/DECISIONS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `git diff --check -- apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/ship-order.service.spec.ts apps/backend/src/modules/shipping/controllers/ship-order.controller.ts "apps/frontend/src/app/(authenticated)/shipping/order/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/DECISIONS.md`
- PASS: 후속 400 보정 후 `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
- PASS: 후속 400 보정 후 `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 후속 400 보정 후 `git diff --check -- "apps/frontend/src/app/(authenticated)/shipping/order/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- PASS: 빈 팔레트 삭제/자동정리 보정 후 `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand`
- PASS: 빈 팔레트 삭제/자동정리 보정 후 FE/BE `tsc --noEmit --pretty false`
- PASS: 빈 팔레트 삭제/자동정리 보정 후 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `ship-order.service.ts`와 `ship-order.controller.ts`는 `T-SHIP-ORDER-CANCEL` active lock과 겹친다. 사용자가 2026-06-25 22:22 KST에 "지금 수정해"라고 명시 지시하여 충돌 사실을 기록하고 최소 범위로 진행한다.
- 전용 `PUT /shipping/orders/:id/unconfirm`은 `CONFIRMED` + 출하수량 0 + 배정 팔레트/박스 0건에서만 `DRAFT`로 되돌린다.
- 후속 오류: `CONFIRMED` 행에서도 삭제 버튼이 노출되어 `DELETE /shipping/orders/:id` 400이 발생했다. 삭제 액션은 `DRAFT`에만 노출하고 handler도 non-DRAFT API 호출 전 차단하도록 보정했다.
- 후속 오류: `SH2606220004`는 출하수량 0, 박스 0, 빈 `OPEN` 팔레트 1건(`PLT2606220002`)만 있어 확정취소에서 자동 정리 가능한 상태다. `/shipping/pallet`에도 빈 팔레트 삭제 UI를 추가한다.
- 실제 `SH2606220004` unconfirm 재호출은 DB 상태 변경이므로 수행하지 않았다.

## T-WORKFLOW-BUSINESS-MAP `/workflow` 업무 이해용 React Flow 재구성
status: REVIEW
owner: codex
role: implementer
scope:
- `/workflow`를 건수 대시보드가 아닌 업무-시스템 관계도 React Flow 캔버스로 재구성
- 6개 스윔레인, 업무 활동 노드, 우측 상세 패널, 관련 화면 바로가기 제공
files:
- apps/frontend/src/config/workflowMap.ts
- apps/frontend/src/app/(authenticated)/workflow/page.tsx
- apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs
- docs/superpowers/specs/2026-06-24-workflow-business-map-design.md
- docs/superpowers/plans/2026-06-24-workflow-business-map.md
- docs/reports/workflow-business-map-3002.png
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `git diff --check -- apps/frontend/src/config/workflowMap.ts "apps/frontend/src/app/(authenticated)/workflow" docs/superpowers/specs/2026-06-24-workflow-business-map-design.md docs/superpowers/plans/2026-06-24-workflow-business-map.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`
- PASS: 3002 기존 dev 서버에서 `/workflow` HTTP 200
- PASS: Playwright 인증 세션에서 React Flow 1개, 노드 34개, 상세 패널 1개, `IQC 판정` 클릭 후 상세 갱신, console/page error 0
- PASS: 사용자 제공 계정으로 3002 로그인 후 `/workflow` 재검증. React Flow 1개, 업무 노드 29개, 레인 6개, `조립실적(키오스크)` 표시, 노드 겹침 0, 미니맵 제거, 건수 배지 0개, console/page error 0. 캡처 `docs/reports/workflow-business-map-3002.png`
review:
- needs-review
notes:
- 실시간 건수/KPI/DB 패키지 변경은 제외한다. locale 파일은 다른 active lock과 충돌 가능성이 있어 수정하지 않는다.
- 사용자 지시에 따라 임의 대체 포트 dev server를 띄우지 않는다. 최종 검증은 3002 기준으로 수행했다.
- 사용자 피드백에 따라 기본 viewport를 `x=180, y=28, zoom=0.62`로 보정하고 장거리 보조 연결은 선택 업무 중심 표시로 접었다.
- 생산 레인은 `작업지시 -> 조립실적(키오스크) -> 서브공정 키팅/조립·라벨 실적`으로 현장 시작 공정을 명시한다.

## T-ER-VIEW-TABLE-NODES ER VIEW 테이블형 그래프 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/system/er-view` 중앙 그래프를 단순 네트워크가 아닌 DB 테이블 표형 ERD로 보정
files:
- apps/backend/src/modules/system/services/er-view.service.ts
- apps/backend/src/modules/system/services/er-view.service.spec.ts
- apps/frontend/src/app/(authenticated)/system/er-view/page.tsx
- apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs
verification:
- RED 확인: backend spec가 graph node의 `pkColumns`/`columns` 부재로 실패
- RED 확인: frontend structure test가 `nodeTypes`/`TableNode`/PK/FK 표시 부재로 실패
- GREEN: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: 3002 `/system/er-view` HTTP 200
- PASS: Chrome Playwright 인증 세션에서 `MAT_LOTS` 선택 시 table node 4개, edge 3개, controls 3개, minimap 표시, body/html overflow 없음
review:
- needs-review
notes:
- 원인: backend graph node 응답이 table/comment만 제공하고 frontend가 ReactFlow 기본 노드에 테이블명만 렌더링했다.
- 보정: backend graph node에 컬럼/PK/FK 후보 metadata를 포함하고, frontend는 `TableNode` custom node, arrow edge, fit/zoom/pan controls, overflow-hidden full-height 레이아웃으로 렌더링한다.

## T-ER-VIEW-SCHEMA-GOVERNANCE ER VIEW 스키마 거버넌스 도구
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/system/er-view` 실시간 Oracle DB 스키마 시각화/관계 분석/리스크 분석
- 물리 PK/FK/UK와 보수적 추정 관계 분리 표시
- 관계별 수동 orphan scan, DEV 모드 orphan DELETE/제한 UPDATE, FK/UK `ENABLE VALIDATE` 실행
- 실행 SQL 전체 표시, 구조화 action payload 기반 서버 SQL 생성, 파일 로그 및 migration/ERD 갱신
files:
- apps/backend/src/modules/system/controllers/er-view.controller.ts
- apps/backend/src/modules/system/services/er-view.service.ts
- apps/backend/src/modules/system/services/er-view.service.spec.ts
- apps/backend/src/modules/system/system.module.ts
- apps/frontend/src/app/(authenticated)/system/er-view/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/frontend/package.json
- pnpm-lock.yaml
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: backend spec가 `er-view.service.ts` 부재로 실패, frontend structure test가 page/menu/controller/service 부재로 실패
- GREEN: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `git diff --check`
- PASS: 3002 `/system/er-view` HTTP 200
- PASS: 3003 `/api/v1/system/er-view/summary` 인증 게이트 401 확인
review:
- needs-review
notes:
- 사용자 결정: 실시간 DB 기준, 3패널 UI, `@xyflow/react`, 조회/분석/실행 API 분리, VALIDATE 기본, DEV 기본 모드.
- Oracle DDL은 transaction rollback이 아니므로 batch 실패 시 이번 batch에서 생성된 constraint만 역순 DROP으로 보상 처리한다.
- 응답 래핑은 기존 API 패턴에 맞춰 프론트에서 `res.data?.data ?? res.data`로 처리한다.
- 작업 중 발견된 무관 변경 `apps/frontend/src/app/(authenticated)/system/config/page.tsx`, `apps/frontend/src/components/system/AiCatalogPanel.tsx`, help 문서 4개는 되돌리지 않았다.

## T-DEFECT-CODE-MASTER 불량코드 전용 마스터/3레벨 분류 관리
status: REVIEW
owner: codex
role: implementer/operator
scope:
- 불량코드를 `COM_CODES.DEFECT_TYPE`에서 전용 마스터 테이블로 분리
- 3레벨 불량분류, 불량코드/불량명, 등급, 적용범위, 모델구분별 적용 관리
- 품질관리 메뉴에 `/quality/defect-code` 불량코드관리 페이지 추가
- 기존 `/quality/defect` 불량등록관리 필터/등록과 백엔드 불량로그 저장 검증을 전용 불량코드 마스터로 연결
files:
- apps/backend/src/entities/defect-*-master.entity.ts
- apps/backend/src/modules/quality/defect-codes/**
- apps/backend/src/modules/quality/defects/**
- apps/backend/src/migrations/2026-06-21_defect_code_masters.sql
- apps/frontend/src/app/(authenticated)/quality/defect-code/**
- apps/frontend/src/app/(authenticated)/quality/defect/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/components/layout/page-registries/**
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/backend/src/seeds/menu-config.json
- docs/reports/db-schema-erd.md
verification:
- RED/GREEN backend defect-code service spec 4건 PASS
- RED/GREEN frontend/연동 구조 테스트 19건 PASS
- `aql.service.spec.ts` 포함 focused Jest 23건 PASS
- frontend/backend `tsc --noEmit --pretty false` PASS
- JSHANES migration 적용/재실행 PASS, 분류 18건/불량코드 12건/menu 배치 확인
- `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py` PASS
- 3002 `/quality/defect-code` HTTP 200, 3002 `/api/quality/defect-codes/options` 인증 게이트 401 확인
- hermes 종료 확인 후 `/quality/defect` 전환 추가: RED/GREEN 구조 테스트 3건 PASS, `defect-log.service.spec.ts` 39건 PASS
- `/quality/defect` HTTP 200, 전용 options API 인증 게이트 401 확인
- `/quality/defect-code` 화면 단순화: 좌측 전체 불량코드 그리드, 우측 1/2/3레벨 선택 등록/수정 폼으로 재구성. 구조 테스트 7건 PASS, locale JSON parse PASS, FE typecheck PASS, `git diff --check` PASS
- `/quality/defect-code` 분류 기준 재정의: 1레벨 `IQC/LQC/OQC`, 2레벨 `DEFECT_MODEL_GROUP`(`LV`=저전압, `HV`=고전압), 3레벨 `FUNCTION/APPEARANCE/ETC`로 JSHANES 재분류 적용 PASS. 품목마스터 `ITEM_MASTERS.DEFECT_MODEL_GROUP` 추가 및 IQC 불량코드 옵션 필터 연결 PASS.
- `git diff --check` PASS
review:
- needs-review
notes:
- `/quality/defect/page.tsx`는 hermes 종료 확인 후 전용 불량코드 API로 전환했다.
- 기존 `COM_CODES.DEFECT_TYPE`는 초기 마이그레이션 seed source로만 사용하고 신규 관리는 전용 테이블에서 수행한다.
- 2레벨 모델구분 선택에서 내부 매핑 `productTypes`를 파생 저장한다. API/DB 호환 필드명은 `PRODUCT_TYPE`/`productType`로 남지만 의미는 `DEFECT_MODEL_GROUP`이며, 모델구분 매핑 없는 불량코드는 공통처럼 노출하지 않는다.
- 3002/3003은 사용자 요청대로 재시작하지 않는다.

## T-PRODUCTION-ORDER-EDIT-SYNC 생산지시 수정패널 선택행 동기화
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/order` 우측 수정패널이 좌측 그리드 선택 변경을 즉시 반영
- 우측 수정패널에서 라인/공정 필드를 한 행에 배치
- 우측 수정패널에서 설비를 드롭다운이 아닌 즉시 보이는 버튼형 선택 목록으로 표시
files:
- apps/frontend/src/app/(authenticated)/production/order/page.tsx
- apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx
- apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: 신규 구조 테스트가 행 클릭 시 `editingOrder` 동기화 부재로 실패 확인
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 3002 `/production/order` HTTP 200
review:
- needs-review
notes:
- 사용자가 수정패널 열린 상태에서 좌측 그리드 행 변경 시 패널 내용도 같이 변경되어야 한다고 요청했다.

## T-IQC-AQL-TRACEABILITY-FIX IQC AQL 추적성/불량코드 판정 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc` 검사 저장 시 시료 바코드 길이 초과 저장 실패 방지
- 불량코드 입력과 항목 FAIL 판정의 의미 정렬
- `/material/iqc-history`에서 항목별 AQL 판정 결과 확인성 개선
files:
- apps/frontend/src/components/material/IqcModal.tsx
- apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs
- apps/frontend/src/app/(authenticated)/material/iqc-history/**
- apps/backend/src/modules/material/services/iqc-history.service.ts
- apps/backend/src/modules/material/services/iqc-history.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: IQC 모달 구조 테스트가 불량코드/FAIL 정렬과 `SAMPLE_BARCODE` 요약 함수 부재로 실패 확인
- RED: `iqc-history.service.spec.ts`가 긴 시리얼 목록 500바이트 초과와 PASS+불량코드 저장 허용으로 실패 확인
- GREEN: `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs`
- GREEN: `pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/iqc-history.service.spec.ts --runInBand`
- PASS: IQC 모달/이력 관련 구조 테스트 15건
- PASS: frontend/backend `tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `/quality/defect`는 hermes 작업 잠금 대상이므로 수정하지 않는다.
- `SAMPLE_BARCODE`에는 전체 시리얼을 저장하지 않고 500바이트 이내 요약만 저장한다. 전체 시리얼 상세는 `DETAILS` CLOB에 남는다.
- 불량코드는 FAIL 판정 근거가 있는 경우에만 입력/저장되도록 프론트와 서버에서 방어한다.

## T-IQC-AQL-POLICY-CODE 품목 AQL 정책코드 전환
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/master/part` AQL 개별 속성 제거 및 AQL 정책 선택 전환
- `ITEM_MASTERS`와 IQC AQL 판정의 정책 코드 기준 연결
- `/quality/aql` AQL 정책관리 CRUD 완성
files:
- apps/backend/src/entities/part-master.entity.ts
- apps/backend/src/entities/iqc-aql-policy.entity.ts
- apps/backend/src/modules/master/dto/part.dto.ts
- apps/backend/src/modules/master/services/part.service.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/migrations/2026-06-21_iqc_aql_policy_code.sql
- apps/frontend/src/app/(authenticated)/master/part/**
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/**
- apps/frontend/src/app/(authenticated)/quality/aql/**
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- docs/reports/db-schema-erd.md
verification:
- RED 확인: 구조 테스트와 AQL service spec이 신규 정책 코드 계약 부재로 실패
- GREEN: `/master/part`, `/master/iqc-part-spec`, `/quality/aql` 구조 테스트 12건 PASS
- GREEN: 정책 CRUD 구조 테스트 RED→GREEN, `aql.service.spec.ts` 정책 CRUD RED→GREEN
- PASS: `aql.service.spec.ts` 16건 PASS, 기존 `iqc-history.service.spec.ts` 계약 반영
- PASS: frontend/backend typecheck, `git diff --check`
- PASS: JSHANES 마이그레이션 적용/재실행, `ITEM_MASTERS` 구 AQL 컬럼 제거 및 `IQC_AQL_POLICY_CODE` 확인
- PASS: JSHANES IQC 대상 19건 정책 코드 보유, orphan 정책 참조 0건
- PASS: JSHANES `IQC_AQL_POLICIES` 정책 3건 확인, 정책 AQL 기준 orphan 0건
- PASS: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`
- PASS: 3002 `/master/part`, `/quality/aql` HTTP 200, `/api/quality/aql/policies` 인증 게이트 401 확인
- PASS: `/quality/aql` 정책관리 좌측상단 배치 구조 테스트 RED→GREEN, FE typecheck, 3002 `/quality/aql` HTTP 200
- PASS: `/quality/aql` 정책 도움말/좌측 스크롤 제거/상단 `AQL 기준 추가` 문구 구조 테스트 RED→GREEN, FE typecheck, 3002 `/quality/aql` HTTP 200
review:
- needs-review
notes:
- 품목은 `iqcAqlPolicyCode`만 보유하고 검사수준/Major/Minor 조합은 `IQC_AQL_POLICIES` 기준정보에서 관리한다.
- `/quality/aql` 좌측상단에서 정책 등록/수정/사용중지를 관리한다. 품목에 배정된 정책은 사용중지 차단한다.
- `/quality/aql` 도움말은 품목이 AQL 코드를 직접 참조하는 설명이 아니라 `ITEM_MASTERS.IQC_AQL_POLICY_CODE -> IQC_AQL_POLICIES -> AQL_STANDARDS` 구조를 기준으로 작성한다.

## T-HARNESS-WIRE-SPEC-SEPARATION 전선 길이/스트리핑 사양 분리
status: REVIEW
owner: codex
role: implementer/operator
scope:
- 품목마스터 전선 길이/스트리핑 속성 제거
- BOM 자재 소요량과 회로/라우팅 사양 연결
files:
- apps/backend/src/entities, apps/backend/src/modules/master, apps/backend/src/modules/production
- apps/frontend/src/app/(authenticated)/master/part, master/routing, production/specification-setup
- apps/backend/src/migrations, docs/reports/db-schema-erd.md
verification:
- PASS: RED/GREEN 구조 테스트, backend focused spec, frontend/backend typecheck, JSHANES migration, ERD 갱신, git diff --check
review:
- needs-review
notes:
- 전선 원자재는 품목 고유 길이를 갖지 않고 제품/회로/공정 사양으로 절단/스트리핑 조건을 관리한다.

## T-MASTER-PART-MODEL-NAME 품목관리 차종 컬럼 추가
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/master/part` 품목관리 차종 표시/등록/수정
- `ITEM_MASTERS` 차종 컬럼 추가
files:
- apps/backend/src/entities/part-master.entity.ts
- apps/backend/src/modules/master/dto/part.dto.ts
- apps/backend/src/modules/master/services/part.service.ts
- apps/backend/src/migrations/2026-06-21_add_item_master_model_name.sql
- apps/frontend/src/app/(authenticated)/master/part/**
- docs/reports/db-schema-erd.md
verification:
- RED: `/master/part` 구조 테스트가 `modelName`/`차종` 부재로 실패 확인
- GREEN: `/master/part` 구조 테스트 PASS
- PASS: frontend/backend typecheck, `git diff --check`
- PASS: JSHANES 마이그레이션/재실행/컬럼 확인, ERD 갱신
- PASS: 3002 Playwright DOM에서 목록 헤더/값/추가 패널 라벨 확인
review:
- needs-review
notes:
- 사용자 요청: 자동차용 MES 관리 특성으로 `/master/part`에 차종 컬럼을 추가한다.

## T-MENU-OPEN-DELAY 메뉴 클릭 후 화면 열림 지연 원인 진단
status: REVIEW
owner: codex
role: implementer
scope:
- 메뉴 클릭 후 30초 이상 지연되는 경로의 실제 병목 확인
files:
- apps/frontend/src/components/layout/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/scripts/gen-page-registry.mjs
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/backend/src/modules/menu-categories/**
- apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs
- apps/frontend/src/components/layout/tabPageState.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
verification:
- 원인 확인: `.next/trace`에서 `/system/menu-categories` RSC 요청 89~109초, `/inspection/terminal-result` compile 68초, authenticated page loader 다수 동시 준비 확인.
- PASS: `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 수정 후 3002 HTTP 반복 측정 `/dashboard` 514ms, `/master/part` 281ms, `/production/wip-stock` 212ms, `/system/menu-categories` 258ms.
- PASS: Playwright headless mock에서 `/master/part` 본문 검색 입력 `CODX_STATE_KEEP` 입력 후 `/dashboard` 이동, `/master/part` 재진입 시 값 복원 확인.
- PASS: Playwright headless mock에서 `/master/part` 우측 등록 패널 입력 `CODX_PANEL_KEEP` 입력 후 대시보드 탭 이동, 품목 탭 재진입 시 패널/입력값 보존 확인.
- PASS: 최종 3002 HTTP 측정 `/dashboard` 1030ms, `/master/part` 860ms, `/production/wip-stock` 331ms, `/system/menu-categories` 462ms.
- FAIL 확인: App Router `children` 캐시 방식은 실제 브라우저에서 `/master/part` 품목 추가 패널 입력 `CODX_REAL_KEEP` 후 대시보드 이동/품목 탭 복귀 시 패널이 초기화되어 값이 사라졌다.
- PASS: `getPageComponent(path)` lazy registry + 실제 page component keep-alive 적용 후 동일 3002 Playwright 로그인 세션에서 `/master/part` 품목 추가 패널 입력 `CODX_REAL_KEEP` 보존 확인.
- PASS: lazy registry 적용 후 최종 3002 HTTP 반복 측정 `/dashboard` 521ms, `/master/part` 330ms, `/production/wip-stock` 523ms, `/system/menu-categories` 266ms.
- FAIL 확인: 단일 `pageRegistry.generated.ts` lazy factory는 runtime 호출 경로는 1개였지만 파일 안에 모든 page `dynamic()` switch가 남아 있어 Turbopack trace에서 registry HMR/compile이 계속 크게 잡혔다.
- PASS: 그룹별 registry 분리 후 구조 테스트 2건 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `git diff --check` PASS.
- PASS: 그룹별 registry 분리 후 3002 HTTP `/dashboard` 1008ms, `/master/part` 442ms, `/production/wip-stock` 1982ms, `/system/menu-categories` 218ms, `/shipping/confirm` 451ms.
- PASS: 그룹별 registry 분리 후 Playwright 로그인 세션에서 `기준정보 > 품목관리` 메뉴 클릭 1473ms, 대시보드 탭 298ms, 품목관리 탭 복귀 889ms, 품목 추가 폼 입력값 보존 true.
- PASS: 경로별 registry 분리 후 구조 테스트 2건 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- PASS: `.next` 캐시 삭제 후 3002 clean restart. cold compile `/dashboard` 14913ms, `/master/part` 10331ms, `/production/wip-stock` 10769ms, `/system/menu-categories` 13657ms, `/shipping/confirm` 15599ms. warm 재방문 `/dashboard` 457ms, `/master/part` 269ms, `/production/wip-stock` 248ms, `/system/menu-categories` 199ms, `/shipping/confirm` 163ms.
- BLOCKED 확인: `/dashboard/summary` API 500 전역 모달이 브라우저 자동 메뉴 클릭 재검증을 막았다. 직전 동일 `TabKeepAlive` 로직에서는 Playwright로 품목 추가 폼 입력값 보존 확인 완료.
review:
- needs-review
notes:
- 원인: `TabKeepAlive`가 `pageRegistry.generated.ts`를 import해 Next dev 서버가 메뉴 클릭 시 authenticated page 전체를 on-demand compile 대상으로 잡았다.
- 변경: top-level `pageRegistry` 객체는 제거하고 `getPageComponent(path)`가 호출된 경로만 `dynamic()` 생성하도록 `pageRegistry.generated.ts`를 lazy factory로 재생성했다.
- 추가 변경: 단일 generated registry도 Turbopack 추적 범위가 커서, 메인 registry는 top-level 메뉴 그룹만 async import하고 실제 page `dynamic()` 목록은 `page-registries/*.generated.ts`로 분리했다.
- 최종 변경: 그룹 registry도 cold compile 범위가 남아 있어, `page-registries/<route>.generated.ts` 경로별 1 page 파일로 더 분리했다.
- 주의: Windows PowerShell에서는 `pnpm` 직접 호출 금지. `pnpm.ps1` 파일 연결이 Notepad로 열릴 수 있으므로 `pnpm.cmd`를 명시한다.
- 보정: `TabKeepAlive`는 방문한 실제 page component만 경로별 최대 `MAX_TABS`개 hidden mount로 유지해 열린 탭의 React state를 보존한다. DOM 입력값/선택값/스크롤 `sessionStorage` 저장은 추가 복원 보조로 유지한다.

## T-ROUTING-LABEL-ISSUE-UI 라우팅 공정 SG/FG 라벨 발행 설정 UI 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/routing` 공정순서에서 `ISSUE_SG_LABEL_YN`, `ISSUE_FG_LABEL_YN` 설정/표시
files:
- apps/backend/src/modules/master/dto/routing-group.dto.ts
- apps/backend/src/modules/master/services/routing-group.service.ts
- apps/backend/src/modules/master/services/routing-group.service.spec.ts
- apps/frontend/src/app/(authenticated)/master/routing/types.ts
- apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx
- apps/frontend/src/app/(authenticated)/master/routing/routing-label-issue-flags.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/routing/routing-label-issue-flags.structure.test.mjs"`가 플래그 type/UI/DTO/service/locale 부재로 6건 실패 확인.
- GREEN: 동일 구조 테스트 6/6 PASS.
- PASS: `pnpm --filter @harness/backend test -- routing-group.service.spec.ts -t "label issue flags" --runInBand` 2/2 PASS.
- PASS: `pnpm --filter @harness/backend test -- routing-group.service.spec.ts --runInBand` 28/28 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: 3012 브라우저 실측에서 `/master/routing` 공정 수정 모달 `라벨발행`, `SG 라벨 발행`, `FG 라벨 발행` 체크박스 표시 확인. 그리드 `라벨발행` 컬럼과 기존 `FG` 배지 표시 확인.
- PASS: 3012 API roundtrip으로 임시 라우팅 그룹/공정 생성 후 `issueSgLabelYn='Y'`, `issueFgLabelYn='N'` 저장, update 후 `issueSgLabelYn='N'`, `issueFgLabelYn='Y'` 조회 확인. 검증 데이터 삭제 후 JSHANES `ROUTING_CODE LIKE 'CODX_LABEL_%'` 잔여 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 현재 `ROUTING_PROCESSES` 엔티티에는 컬럼이 있으나 `/master/routing` UI와 DTO/서비스 저장 경로에 빠져 운영자가 설정할 수 없다.
- 3002 프론트는 HTTP 요청이 30초 타임아웃되어 3012 dev 서버에서 런타임 검증했다.

## T-WIP-FG-LABEL-SOURCE-SPLIT 재공 상세 라벨 SG/FG 분리 조회
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock`, `/production/fg-stock` 상세 라벨정보를 품목 유형별로 `SG_LABELS`/`FG_LABELS` 분리 조회
files:
- apps/backend/src/modules/production/services/production-views.service.ts
- apps/backend/src/modules/production/controllers/production-views.controller.ts
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs"`가 기존 `/fg-labels` 단일 조회와 `FG_LABELS` 전용 서비스로 실패 확인.
- GREEN: wip label detail, fg type filter, wip split, wip SQL, menu locale 구조 테스트 9건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: 3002 브라우저 fetch 실측. `SEMI_PRODUCT/HNS02C2ABCDE`는 `/api/production/wip-stock/labels?...itemType=SEMI_PRODUCT`에서 `SG_LABELS` SQL과 `labelType=SG` 1건 반환. `FINISHED` 요청은 `FG_LABELS` SQL 사용 확인.
- PASS: 3002 `/production/wip-stock` 우측 패널에 `라벨바코드`, `잔량` 컬럼 표시 및 console/page error 0 확인.
review:
- needs-review
notes:
- `SEMI_PRODUCT` 상세는 `SG_LABELS`, `FINISHED` 상세는 `FG_LABELS`가 source of truth다.

## T-WIP-STOCK-LABEL-DETAIL-PANEL 반제품재공조회 라벨 상세 패널 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock`에서 좌측 품목 선택 시 우측 상세 라벨정보 패널 표시
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs"`가 `showFgPanel` 조건과 일반 라벨 패널 문구 부재로 실패 확인.
- GREEN: wip label detail, fg type filter, wip split, wip SQL, menu locale 구조 테스트 8건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 `/production/wip-stock` HTTP 200.
- PASS: Playwright에서 반제품재공조회 우측 `상세 라벨정보` 패널 표시, 반제품 행 `HNS02C2ABCDE` 클릭 시 `/api/production/wip-stock/fg-labels?itemCode=HNS02C2ABCDE` 호출, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 백엔드 `/production/wip-stock/fg-labels`는 `itemCode` 기준 `FG_LABELS`를 조회하므로 반제품 품목도 라벨이 있으면 반환 가능하다.
- 현재 JSHANES `HNS02C2ABCDE` 반제품 재고는 1건이고, 연결 라벨 상세는 0건이라 패널은 `데이터가 없습니다.`로 표시된다.

## T-FG-STOCK-CARD-REMOVE-TYPE-FILTER 제품재공조회 정보카드 제거 및 유형 필터 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/fg-stock` 상단 정보카드 제거
- 좌측 품목 그리드 툴바에 유형 필터 추가
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/fg-stock/page.tsx
- apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs"`가 `enableTypeFilter` 부재와 `StatCard` 잔존으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 `/production/fg-stock` HTTP 200.
- PASS: Playwright DOM에서 `품목 수`/`총 재고` 정보카드 0건, 유형 옵션 `전체/완제품/반제품`, API 요청 `itemType=FINISHED` 후 `SEMI_PRODUCT`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기본 조회 유형은 `FINISHED`로 유지하고, `fg-stock` 화면에서만 유형 Select를 노출한다.

## T-WIP-MAT-LABEL-RAW-PROCESS 원자재 공정재고/수불 메뉴명 변경
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-material-stock`, `/production/wip-material-trans` 한국어 메뉴명과 화면 제목 변경
files:
- apps/frontend/src/locales/ko.json
- apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs"`가 기존 `공정재고` 값으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs" apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 HTTP `/production/wip-material-stock`, `/production/wip-material-trans` 200.
- PASS: Playwright DOM에서 제목 `원자재공정재고`, `원자재공정수불`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 메뉴 키/라우트/DB 메뉴 코드는 유지하고 한국어 표시 문구만 변경한다.

## T-PROD-WIP-FG-STOCK-MENU-SPLIT 반제품/제품 재공조회 메뉴 분리
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock` 합산 화면을 반제품재공조회와 제품재공조회로 메뉴/라우트 분리
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/**
- apps/frontend/src/app/(authenticated)/production/fg-stock/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/backend/src/migrations/2026-06-20_split_wip_fg_stock_menus.sql
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs"`가 신규 공유 컴포넌트/제품 라우트/메뉴 부재로 실패 확인.
- GREEN: wip-stock split/SQL, menu locale, menu-code-validator 구조 테스트 5건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: JSHANES 메뉴 마이그레이션 적용 및 재실행 성공, `PROD_WIP_STOCK` 70 / `PROD_FG_STOCK` 71 확인, `PROD_FG_STOCK` MANAGER/OPERATOR 권한 확인.
- PASS: 3002 브라우저에서 `/production/wip-stock` 제목 `반제품재공조회`, `/production/fg-stock` 제목 `제품재공조회`, API 요청 `itemType=SEMI_PRODUCT`/`FINISHED`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기존 `/production/wip-stock`는 `SEMI_PRODUCT`, 신규 `/production/fg-stock`는 `FINISHED` 고정 조회로 둔다.

## T-IQC-PART-SPEC-AQL-SUMMARY 품목별 IQC 항목관리 AQL 요약 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/iqc-part-spec`에서 선택 품목의 IQC AQL 기준을 검사 항목과 함께 표시
files:
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs"`가 AQL 요약 필드 부재로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/iqc-part-spec -TimeoutSec 30` 200.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 품목 선택 후 검사수준, 기본시료수, Critical/Major/Minor AQL, 샘플수량/Ac/Re 기준을 한 화면에서 확인 가능하게 한다.
- 사용자가 `/master/iqc-part-spec`에 AQL 관련 내용도 같이 표시되어야 하는 것 아니냐고 지적했다.
- Ac/Re는 LOT 수량이 필요하므로 화면에서 `LOT 수량 미리보기` 입력값 기준으로 `/quality/aql/resolve-iqc`를 호출해 표시한다.

## T-IQC-PART-SPEC-LEFT-PANEL 품목별 IQC 항목관리 좌측 패널 축소
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/iqc-part-spec` 좌측 품목 목록 패널 폭을 줄이고 우측 규격 관리 영역을 넓힘
files:
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"`가 기존 `col-span-4/8` 레이아웃으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/iqc-part-spec -TimeoutSec 30` 200.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기존 `col-span-4/8` 레이아웃을 좌측 3, 우측 9 비율로 조정한다.

## T-IQC-DEFECT-CODE-SEVERITY-AQL IQC 불량코드 등급별 AQL 판정
status: REVIEW
owner: codex
role: implementer
scope:
- IQC 판정 시 불량코드가 가진 `CRITICAL`/`MAJOR`/`MINOR` 등급으로 불량수량을 집계
- Critical은 1건 이상 즉시 FAIL, Major/Minor는 각각 독립 Ac/Re 판정
- `/material/iqc` 모달에서 등급별 수량 직접입력 대신 불량코드+수량 입력으로 전환
files:
- apps/backend/src/modules/quality/aql/services/aql.service.ts
- apps/backend/src/modules/quality/aql/services/aql.service.spec.ts
- apps/backend/src/entities/com-code.entity.ts
- apps/backend/src/modules/master/dto/com-code.dto.ts
- apps/backend/src/modules/master/services/com-code.service.ts
- apps/backend/src/modules/material/dto/iqc-history.dto.ts
- apps/backend/src/modules/material/services/iqc-history.service.ts
- apps/backend/src/migrations/2026-06-20_iqc_defect_code_grade.sql
- apps/frontend/src/components/material/IqcModal.tsx
- apps/frontend/src/hooks/material/useIqcData.ts
- apps/frontend/src/hooks/useComCode.ts
- apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs
- docs/reports/db-schema-erd.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: backend AQL focused test에서 불량코드 입력이 등급별 수량으로 집계되지 않고 Critical 즉시 FAIL도 동작하지 않는 것 확인.
- RED: IQC modal structure test에서 불량코드 행 상태/공통코드 조회/payload 계약 부재 확인.
- GREEN: `pnpm --filter @harness/backend test -- aql.service.spec.ts iqc-history.service.spec.ts --runInBand` PASS, 26/26.
- GREEN: `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` PASS, 3/3.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- JSHANES 마이그레이션 적용 PASS: `COM_CODES.DEFECT_GRADE` 추가, `DEFECT_TYPE` 12건 등급 백필, 체크 제약 2건 확인.
- `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py` PASS, 162 tables/2698 columns.
- 관련 파일 `git diff --check` PASS.
review:
- needs-review
notes:
- 불량코드 등급은 `COM_CODES.GROUP_CODE='DEFECT_TYPE'`, `DEFECT_GRADE IN ('CRITICAL','MAJOR','MINOR')` 기준으로 사용한다.
- 등급이 없거나 허용값이 아니면 IQC 판정을 중단한다.

## T-MASTER-PART-IQC-CODE-SELECT 품목마스터 검사 기준 선택식 전환
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/part` 품목 등록/수정 화면의 코드성 검사 항목을 공통코드/기준정보 선택 방식으로 전환
- 기본시료수는 수량 기준값이므로 소수점 직접 입력을 허용
- 입력방식보다 공통코드 또는 기준정보 선택을 우선하는 개발 표준 명시 및 기억 메모 반영
files:
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx
- apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs
- apps/backend/src/modules/master/dto/part.dto.ts
- docs/standards/implementation-rules.md
- AGENTS.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
review:
- needs-review
notes:
- 검사수준과 AQL 값은 기존 공통코드 `AQL_INSP_LEVEL`, `AQL_VALUE`를 사용한다.
- 기본시료수는 코드성 값이 아니라 검사 수량 기준값이므로 소수점 직접 입력을 허용한다.
- 개발 표준 문서와 사용자 기억 메모에 "코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 우선" 원칙을 기록했다.

## T-BOX-STOCK-PACKED-VS-RECEIVED 박스포장 재고와 창고재고 구분
status: REVIEW
owner: codex
role: implementer
scope:
- 박스포장 시 `FG_LABELS.BOX_NO`는 유지
- 제품입고 전 포장대기 재고와 제품입고 후 창고재고를 `/shipping/box-stock`에서 구분 표시
files:
- apps/backend/src/modules/shipping/services/box.service.ts
- apps/backend/src/modules/shipping/services/box.service.spec.ts
- apps/backend/src/modules/inventory/services/product-inventory.service.ts
- apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts
- apps/backend/src/modules/shipping/controllers/box-stock.controller.ts
- apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `pnpm --filter @harness/backend test -- box.service.spec.ts -t "findStockByBox separates" --runInBand`가 `PRODUCT_TRANSACTIONS` 조인 부재로 실패 확인.
- GREEN: `pnpm --filter @harness/backend test -- box.service.spec.ts -t "findStockByBox separates" --runInBand` PASS.
- RED/GREEN: `pnpm --filter @harness/backend test -- product-inventory.service.spec.ts -t "keeps FG label boxNo" --runInBand`.
- PASS: `pnpm --filter @harness/backend test -- product-inventory.service.spec.ts box.service.spec.ts --runInBand` 36/36.
- RED/GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-inventory-state.structure.test.mjs"`.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"`.
- PASS: ko/en/zh/vi locale JSON parse.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: JSHANES SQL로 `FG_LABELS` + `PRODUCT_TRANSACTIONS(refType=BOX, WIP_OUT/FG_IN)` 조회 정상 실행. 현재 미출하 박스 라벨은 0건.
- 참고: `http://localhost:3003/api/v1/shipping/box-stock` 직접 호출은 인증 누락으로 401.
- PASS: `git diff --check` 대상 파일 통과.
review:
- needs-review
notes:
- `BOX_NO IS NOT NULL`은 포장 식별 조건이지 창고입고 조건이 아니다.
- 창고입고 여부는 `PRODUCT_TRANSACTIONS`의 박스 `WIP_OUT`/`FG_IN` 입고 이동 이력으로 판정한다.
- 입고취소는 `FG_LABELS.BOX_NO`를 지우지 않고 수불 전표 취소와 재고 역분개만 수행한다.

## T-IQC-AQL-Z14-POLICY 품목별 AQL/업체 검사강도 정석 설계
status: REVIEW
owner: codex
role: implementer
scope:
- 품목별 Critical/Major/Minor AQL과 업체별 검사강도 기반 IQC AQL 정책 설계
- ISO 2859-1 / ANSI ASQ Z1.4 자동 샘플수량/Ac/Re 산출 계획
- 품목/업체 마스터 필드, AQL 자동산출, IQC 서버 판정 구현
files:
- docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md
- docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- docs/superpowers/plans/2026-06-20-iqc-aql-z14-policy-implementation.md
- apps/backend/src/entities/part-master.entity.ts
- apps/backend/src/entities/partner-master.entity.ts
- apps/backend/src/entities/iqc-log.entity.ts
- apps/backend/src/entities/aql-*.entity.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/modules/material/**
- apps/backend/src/modules/master/**
- apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql
- apps/frontend/src/app/(authenticated)/master/part/**
- apps/frontend/src/components/material/IqcModal.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md` 작성.
- PASS: 기존 `docs/superpowers/specs/2026-06-19-iqc-aql-design.md` superseded 표시.
- PASS: `docs/superpowers/plans/2026-06-20-iqc-aql-z14-policy-implementation.md` 작성.
- PASS: 대상 문서/협업 파일 `git diff --check` 통과.
- PASS: `pnpm --filter @harness/backend test -- aql.service.spec.ts iqc-history.service.spec.ts --runInBand`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"`.
- PASS: JSHANES `2026-06-20_iqc_aql_z14_policy.sql` 적용 성공.
- PASS: JSHANES post-check `ITEM=4`, `PARTNER=2`, `IQC_LOGS=15`, `HISTORY_TABLE=1`, `CODE_LETTER_ROWS=45`.
- PASS: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 갱신.
- PASS: 대상 변경 파일 `git diff --check` 통과.
review:
- needs-review
notes:
- 사용자가 2안 정석 구조를 선택했다.
- 기존 2026-06-19 AQL 설계는 superseded 처리하고, 새 설계/계획을 기준으로 구현한다.
- 2026-06-20 12:56까지 설계/계획 문서화 완료. 이후 같은 작업 ID로 구현 진행.
- 품목 AQL 기준, 업체 검사강도, IQC 서버 AQL 판정, Critical 즉시 FAIL, 업체 검사모드 자동전환 이력을 구현했다.

## T-TOAST-BOTTOM-LEFT 토스트 이벤트 메시지 좌하단 이동
status: REVIEW
owner: codex
role: implementer
scope:
- 전역 toast 이벤트 메시지 위치를 우상단에서 좌하단으로 이동
files:
- apps/frontend/src/app/providers.tsx
- apps/frontend/src/app/toaster-position.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/app/toaster-position.structure.test.mjs` 기존 `top-right` 설정으로 실패 확인.
- GREEN: `node --test apps/frontend/src/app/toaster-position.structure.test.mjs` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
review:
- needs-review
notes:
- `react-hot-toast` 공통 `Toaster` 위치 계약을 `bottom-left`로 고정한다.

## T-MATERIAL-PO-STATUS-RECEIVED-GREEN PO현황 입고완료 색상 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/po-status` 입고완료 상태 배지 색상 보정
files:
- apps/frontend/src/app/(authenticated)/material/po-status/page.tsx
- apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs"` 초록 전용 클래스/우선 적용 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 Playwright `/material/po-status` 좌측 그리드에서 `입고율 100%` 행들이 `입고완료` 초록 배지와 초록 진행바로 표시됨. console/page error 0.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `PO_STATUS.RECEIVED` 또는 좌측 그리드 `receiveRate >= 100`이면 `/material/po-status`에서 `입고완료` 초록 상태 배지로 표시한다.

## T-MASTER-PART-LABEL-TERMS 품목정보 용어 변경
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/part` 품목정보 화면 표시 용어 변경
files:
- apps/frontend/src/app/(authenticated)/master/part/page.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFieldHelp.tsx
- apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs
- apps/frontend/src/locales/ko.json
- tools/hanes-master-part-page-scenario-qa.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` 기존 용어/섹션 문구/도움말 누락/택타임 잔존으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/part -TimeoutSec 30` 200.
- PASS: 3002 Playwright DOM 검증. `품목 추가` 후 도움말 27개, `BOX_QTY/MIN_PACK_QTY/LOT_UNIT_QTY/STORAGE_LOCATION` DB 컬럼 title 표시, 10~100 후보값, `거래처 / 수량관리`/`택타임` 미표시 확인.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `박스입수량` -> `박스장입수량`, `최소포장단위` -> `최소불출단위수량(자재)`, `묶음단위수량` -> `묶음단위수량(생산공정품)`.
- `거래처 / 수량관리` 섹션 문구는 화면에서 제거한다.
- 입력 컬럼 제목 옆 `?` 도움말에 설명과 `ITEM_MASTERS` DB 컬럼명을 표시한다.
- `택타임`은 화면 사용처가 없어 `/master/part` 관리 UI와 QA 입력 시나리오에서 제거한다.

## T-SHIP-ORDER-SQL-PREVIEW 출하지시등록 SQL 미리보기 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` DataGrid SQL 미리보기 실제 조회 구조 반영
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs"` `SHIPPING_ORDERS` 오기와 조인 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs"` PASS.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` PASS.
- PASS: `node "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `http://localhost:3014/shipping/order` 200 및 Next compile PASS.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- 실제 `/shipping/orders` 조회는 `SHIPMENT_ORDERS` 헤더 조회 후 `SHIPMENT_ORDER_ITEMS`, `ITEM_MASTERS`, `PARTNER_MASTERS`를 보강한다.
- 화면 SQL 미리보기는 `SHIPMENT_ORDERS so` + 품목/품목명/고객명 LEFT JOIN 및 company/plant 조건을 표시한다.

## T-SHIP-ORDER-PRINT 출하지시서 출력 기능
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` 등록된 출하지시서 브라우저 출력
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` QR/출력 영역 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` PASS.
- PASS: ko/en/zh/vi locale JSON parse.
- PASS: `git diff --check`.
- PASS: `http://localhost:3014/shipping/order` 200 및 Next dev compile PASS. 3002는 HTTP timeout이라 기존 서버는 건드리지 않고 3014를 별도 기동했다.
- 참고: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`는 기존 진행 중 변경 `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx:318`의 `selectedRowId` `string | null` 타입 오류로 실패했다.
review:
- needs-review
notes:
- 출하지시번호는 출력물 상단에 텍스트와 2D QR 바코드로 함께 표시한다.
- 리스트 행 출력 버튼은 `window.print()`를 호출하고, print media에서는 `ship-order-print-root`만 표시한다.

## T-SHIP-CONFIRM-ORDER-PANEL 출하확정 좌측 출하지시 패널
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 좌측 미출하 출하지시 그리드 패널 추가
files:
- apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs
- apps/frontend/src/components/shipping/BoxScanShipModal.tsx
- apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs"` 좌측 패널/출하지시 조회 연결 누락으로 실패 확인.
- RED: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs` 모달 초기 출하지시번호 prop 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs"` PASS.
- GREEN: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs` PASS.
- PASS: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs`.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend build`.
- PASS: 3003 API `/api/v1/shipping/orders?status=CONFIRMED&limit=5000`에서 미출하 후보 `SO-RV-26061202215660`, `SO-OK-2606120221` 확인.
- PASS: 3002 `/shipping/confirm` Playwright 확인. 좌측 `미출하 출하지시` 패널과 `SO-RV-26061202215660` 표시, 행 클릭 시 박스스캔 모달 자동 로딩, 고객사/박스 바코드 입력 표시, 출하지시번호 수동 입력 프롬프트 미표시, console error 0.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `CONFIRMED` 출하지시 중 잔여수량이 있는 지시를 좌측 패널에 표시하고, 선택 시 박스스캔 모달에 출하지시번호를 자동 전달한다.
- 상단 `박스 스캔 출하` 버튼은 기존처럼 수동 출하지시번호 입력 흐름을 유지한다.

## T-SHIP-CONFIRM-CARD-REMOVE 출하확정 정보카드 제거
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 카드형 정보 영역 제거
files:
- apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"` `StatCard` 렌더링 존재로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `git diff --check`.
- 참고: `localhost:3002`는 node PID `55728`이 listen 중이나 `Invoke-WebRequest`가 30초 타임아웃되어 브라우저/HTTP 확인은 완료하지 못했다.
review:
- needs-review
notes:
- 조회/출하/스캔/모달 기능은 유지하고 상단 상태 요약 정보카드만 제거한다.

## T-SHIP-CONFIRM-BOXSCAN-ORDERNO 박스스캔출하 모달 출하지시번호 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 박스스캔출하 모달에 조회된 출하지시번호 표시
files:
- apps/frontend/src/components/shipping/BoxScanShipModal.tsx
- apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs` 표시 누락으로 실패
- GREEN: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/shipping/confirm` 200
- PASS: Playwright 3002 `/shipping/confirm` 박스스캔출하 모달에서 `SO-RV-26061202215660` 조회 후 번호/고객사/박스입력 표시, console error 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 주문 조회 후 박스 스캔 전에 현재 출하지시번호를 별도 요약 영역으로 보여준다.

## T-SHIP-BOX-STOCK-CARD-REMOVE 박스재고조회 정보카드 제거
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/box-stock` 카드형 정보 영역 제거
files:
- apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"` 카드 프레임 존재로 실패
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/shipping/box-stock` 200
- PASS: Playwright 3002 `/shipping/box-stock` title 표시, 카드형 wrapper 0, console error 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 조회/상세 그리드 기능은 유지하고 `Card/CardContent` 프레임만 제거했다.

## T-MENU-LOCALE-MISSING 메뉴 번역 누락 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `menuConfig` labelKey 기준 ko/en/zh/vi locale 누락 보정
files:
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- apps/frontend/src/config/menu-locale-coverage.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` 실패 확인. 실제 누락은 `en/zh/vi: menu.material.shelfLifeHistory`.
- GREEN: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS.
- `node -e "const fs=require('fs'); for (const l of ['ko','en','zh','vi']) JSON.parse(fs.readFileSync('apps/frontend/src/locales/'+l+'.json','utf8')); console.log('locale json ok');"` PASS.
review:
- needs-review
notes:
- `menuConfig` labelKey와 i18next의 점 포함 locale 키 구조를 기준으로 누락 검증 테스트를 추가했다.
- `menu.material.shelfLifeHistory`를 en/zh/vi menu locale에 추가했다. 기존 dirty locale 변경은 유지했다.

## T-SHIP-OQC-GATE-OFF OQC 출하 게이트 비활성화
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` `SYS_CONFIGS.OQC_ENABLED` 비활성화
files:
- JSHANES DB data: `SYS_CONFIGS.OQC_ENABLED`
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
verification:
- pre-check PASS: JSHANES `SYS_CONFIGS.OQC_ENABLED=Y`
- API PASS: `PATCH /api/system/configs/OQC_ENABLED` `{ configValue: "N" }` 성공
- post-check PASS: DB `CONFIG_VALUE=N`, `/api/system/configs/active` map `OQC_ENABLED=N`
review:
- needs-review
notes:
- 코드 변경 없이 출하 게이트 설정만 껐다. 실제 출하 처리는 수행하지 않았다.

## T-SHIP-SO999-APPROVE SO-20260619-999 출하 가능 상태 보정
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` SO-20260619-999 출하지시 상태 확인 및 승인 상태 보정
files:
- JSHANES DB data: `SO-20260619-999`
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
verification:
- pre-check PASS: `SO-20260619-999`는 `DRAFT`, 품목 `HNS02` 10개, 출하수량 0
- API PASS: `PUT /api/shipping/orders/SO-20260619-999/confirm` 성공, 상태 `CONFIRMED`
- OQC PASS: `POST /api/quality/oqc/OQC-20260619-001/execute`로 `BX2606190002` `PASS`
- post-check PASS: `SO CONFIRMED`, `BX2606190002 CLOSED/PASS`, `FG_MAIN HNS02 AVAILABLE_QTY=10`
review:
- needs-review
notes:
- 실제 출하 처리는 수행하지 않았고, 출하 스캔 가능 조건만 맞췄다.

## T-SHIP-ORDER-AUTO-NO 출하지시번호 자동 채번
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` 출하지시 등록 시 번호 수동입력 제거 및 서버 자동 채번
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs
- apps/backend/src/modules/shipping/dto/ship-order.dto.ts
- apps/backend/src/modules/shipping/services/ship-order.service.ts
- apps/backend/src/modules/shipping/services/ship-order.service.spec.ts
verification:
- RED: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts -t "generate shipOrderNo" --runInBand`
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"`
- GREEN: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand`
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"`
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `POST /api/v1/shipping/orders` without `shipOrderNo` generated `SH2606190001`, then deleted and DB residue 0 confirmed
- PASS: `http://localhost:3002/shipping/order` Playwright registration modal shows `출하지시번호=자동생성`, disabled true, console errors 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 기존 `NumberingService.nextShipmentNo()`를 사용해 서버에서 출하지시번호를 생성한다. 신규 등록 화면은 번호를 전송하지 않고 비활성 `자동생성` 필드만 표시한다.

## T-IQC-HISTORY-CERT-TIMESTAMP IQC 이력 성적서 업로드 timestamp 매칭
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 검사성적서 업로드 404 원인 수정
files:
- apps/backend/src/modules/material/services/iqc-history.service.ts
- apps/backend/src/modules/material/services/iqc-history.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES 확인: 에러 ISO `2026-06-19T07:56:27.354Z`는 DB `IQC_LOGS.INSPECT_DATE=2026-06-19 16:56:27.354`, `SEQ=1` 행과 대응
- RED 확인: 기존 구현은 `findOne(Date)` 실패 시 404를 던짐
- pnpm --filter @harness/backend test -- iqc-history.service.spec.ts -t "성적서 업로드" PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 화면은 `2026-06-19T07:56:27.354Z`를 보내지만 JSHANES `IQC_LOGS.INSPECT_DATE`는 `2026-06-19 16:56:27.354` 로컬 TIMESTAMP로 저장되어 exact Date PK 비교가 실패했다.
- 업로드는 기존 `findOne(Date)` 실패 시 ISO를 KST Oracle timestamp 문자열로 변환해 QueryBuilder fallback 조회/업데이트를 수행한다.

## T-IQC-HISTORY-ARRIVALNO-COLUMN IQC 이력 그리드 입하번호 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 그리드 입하번호 컬럼 추가
files:
- apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx
- apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs`에서 입하번호 컬럼 누락 실패 확인
- node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/material/iqc-history` 그리드 헤더 `입하번호`, 행 값 `R26061900002` 표시
review:
- needs-review
notes:
- 백엔드 응답과 타입에는 `arrivalNo`가 이미 있으며, 목록 그리드 표시만 누락되어 있다.

## T-ISSUE-REQUEST-BARCODE-VALIDATION 출고요청 바코드 출고 품목 검증
status: REVIEW
owner: codex
role: implementer
scope:
- 출고요청 기반 바코드 출고 시 요청 품목과 스캔 LOT 품목 일치 검증
files:
- apps/backend/src/modules/material/services/issue-request.service.ts
- apps/backend/src/modules/material/services/issue-request.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: 기존 `issueFromRequest`는 요청항목 ITEM-A에 ITEM-B LOT를 보내도 정상 완료됨
- pnpm --filter @harness/backend test -- issue-request.service.spec.ts PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- JSHANES `40/1000` 출고요청 상태: COMPLETED 8건, APPROVED/REQUESTED 0건
- JSHANES 완료 요청 기준 요청품목과 출고 LOT 품목 불일치 0건
review:
- needs-review
notes:
- 웹 요청출고 API는 실제 출고 생성 전에 요청항목 `ITEM_CODE`와 스캔 `MAT_UID`의 LOT `ITEM_CODE`를 대조하도록 보정했다.
- PDA `/material/issues/scan` 흐름은 출고요청번호를 소비하지 않는 별도 작업지시/BOM 기반 전량출고 흐름이다.

## T-HNS02-260619-SEED-CLEANUP HNS02 260619 시드 데이터 정리
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` HNS02 260619 시드성 데이터 정리
files:
- tools/seed/cleanup_hns02_260619_seed.py
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- dry-run PASS: 삭제 후보 679건, after-in-tx 시드 마커 잔여 0
- commit PASS: 삭제 679건 적용
- post-check PASS: LOT-입고/LOT-수불 품목 불일치 0, 재고 invariant 0, 미완료 출고요청 0
review:
- needs-review
notes:
- `tools/seed/cleanup_hns02_260619_seed.py --commit`으로 JSHANES `40/1000`에 반영했다.

## T-IQC-AQL-MENU AQL 기준관리 메뉴 진입점 추가
status: REVIEW
owner: codex
role: implementer
scope:
- 품질관리 하위 `AQL 기준관리` 메뉴/라우트 진입점 추가
files:
- apps/frontend/src/config/menuConfig.ts
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- apps/frontend/src/app/(authenticated)/quality/aql/page.tsx
- apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs` 4건 실패 확인
- node --test apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- AQL CRUD/API/DB 구현은 하지 않고, 메뉴 클릭 시 라우트가 깨지지 않는 기본 진입점만 추가한다.

## T-IQC-HISTORY-LOTNO-FALLBACK IQC 이력 LOT No. 시료바코드 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 입하단위 IQC 이력의 LOT No. 표시 보정
files:
- apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx
- apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES PASS: `R26061900002` 이력은 `IQC_LOGS.MAT_UID IS NULL`, `SAMPLE_BARCODE='VH1-RM260619-00011'` 확인
- API PASS: `/api/material/iqc-history?limit=5&inspectType=INITIAL&fromDate=2026-06-19&toDate=2026-06-19` 첫 행 `matUid=null`, `sampleBarcode='VH1-RM260619-00011'`
- node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/material/iqc-history` 첫 행 `R26061900002 / CBL-B` LOT No.에 `VH1-RM260619-00011` 표시
- git diff --check 대상 파일 PASS
review:
- needs-review
notes:
- 입하단위 IQC 이력은 `IQC_LOGS.MAT_UID`가 `NULL`이고 실제 스캔 시료 LOT는 `SAMPLE_BARCODE`에 저장된다. 목록 LOT No.는 `matUid || sampleBarcode`로 표시한다.

## T-IQC-AQL-PLAN IQC 우선 AQL 기준관리 설계/계획
status: REVIEW
owner: codex
role: implementer
scope:
- IQC 우선 AQL 기준관리 도입 설계와 구현 계획 문서화
files:
- docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 설계 문서 생성 확인: docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- 구현 계획 문서 생성 확인: docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md
- 문서 핵심 조건 확인: `SAMPLE_QTY` 미사용/물리삭제 보류, `QC_AQL`, `AQL_SAMPLE_SIZE`, `INSPECT_CLASS` 불변 명시
- git diff --check -- docs/superpowers/specs/2026-06-19-iqc-aql-design.md docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md PASS
review:
- needs-review
notes:
- 기존 `IQC_PART_SPECS.SAMPLE_QTY`는 1차에서 화면/로직 미사용 처리하고 물리 삭제는 안정화 후 2차로 분리한다.
- 구현 코드는 수정하지 않았다. 사용자 리뷰 후 실행 단계로 전환한다.

## T-MATERIAL-ARRIVAL-QTY-FORMAT 자재입하처리 모달 숫자 천단위 포맷
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/arrival` 자재입하처리 모달의 입수량 등 숫자 표시 포맷 보정
files:
- apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineReceiptModal.tsx
- apps/frontend/src/app/(authenticated)/material/arrival/components/po-line-receipt-number-format.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: `formatQuantity` 부재 및 `String(lotUnitQty)`/raw `lotUnitQty ?? '-'` 표시로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/material/arrival/components/po-line-receipt-number-format.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 입력용 입하수량 필드는 기존 `type="number"` 동작을 유지하고, 읽기 전용 입수량/예상 시리얼 계산식/예상 시리얼수 숫자 표시에 천단위 구분자를 적용했다.

## T-KIOSK-MOUNTED-RELOAD 키오스크 장착 자재/소모품 DB 재조회
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/input-kiosk` 재진입 시 DB 저장 장착 상태 재조회
files:
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ConsumableScanModal.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 키오스크 소모품 호출이 `selectedEquip`/`equipCode`/`includeMounted` 없이 실패함
- node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES DB PASS: `WO2606150066/HNS02C2ABCDE/EQ-ATCNS-01`, `CONSUMABLE_USAGE_MAP` 2건, `CONSUMABLE_STOCKS` MOUNTED 2건 확인
- API PASS: `GET /production/job-orders/WO2606150066/consumables?equipCode=EQ-ATCNS-01&includeMounted=1`이 `CT26061600001`, `CT26061600002` 반환
- 브라우저 PASS: 3002 `/production/input-kiosk` 진입 시 같은 API 호출 및 두 mountedConUid 화면 표시
review:
- needs-review
notes:
- localStorage에 저장하지 않고 `JOB_MATERIAL_LOTS` 및 `CONSUMABLE_STOCKS` 기준으로 재조회한다.
- 키오스크 소모품 API 호출은 현재 화면 선택 설비 `equipCode`와 `includeMounted=1`을 함께 전달해야 한다.
- 현재 JSHANES `JOB_MATERIAL_LOTS`는 0건이라 자재 쪽은 저장 데이터 표시 샘플이 없었지만, 기존 조회 경로와 구조 테스트로 DB 재조회 계약을 고정했다.

## T-WIP-STOCK-ACTUAL-SQL 반제품/제품재고 SQL 미리보기 실제 쿼리 반영
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock` DataGrid SQL 조회문을 실제 백엔드 조회 SQL 기준으로 보정
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/page.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 기존 `WIP_STOCKS` 하드코딩으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/production/wip-stock` SQL 조회문 모달에서 `PRODUCT_STOCKS`/`ITEM_MASTERS`/`WAREHOUSES` 표시, `WIP_STOCKS` 미표시
review:
- needs-review
notes:
- 실제 API `GET /production/wip-stock`는 `PRODUCT_STOCKS s`에서 조회하고 `ITEM_MASTERS im`, `WAREHOUSES wh`를 조인한다. 화면 fallback SQL의 `WIP_STOCKS` 하드코딩을 제거한다.
- 화면 검색어와 유형 필터 값에 따라 SQL 미리보기의 `itemType`/검색 조건이 함께 반영된다.

## T-DATAGRID-HOVER-SCROLL-REMOVE DataGrid 좌우 hover 스크롤 제거
status: REVIEW
owner: codex
role: implementer
scope:
- 공용 DataGrid 좌우 끝 hover 자동 스크롤 영역 제거
files:
- apps/frontend/src/components/data-grid/DataGrid.tsx
- apps/frontend/src/components/data-grid/ScrollHandle.tsx
- apps/frontend/src/components/data-grid/datagrid-scroll-handle-removal.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: DataGrid ScrollHandle import/render 및 파일 존재로 실패 확인
- node --test apps/frontend/src/components/data-grid/datagrid-scroll-handle-removal.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup DataGrid 렌더 상태에서 group/scroll 0, group-hover/scroll 0, data-scroll-id 0
review:
- needs-review
notes:
- 모든 DataGrid에서 좌/우 끝 마우스 hover 자동 스크롤 영역을 제거한다. 일반 스크롤 컨테이너 자체는 유지한다.

## T-HARNESS-CIRCUIT-PAYLOAD 회로 저장 payload 정리
status: REVIEW
owner: codex
role: implementer
scope:
- 제품 도면관리 회로 저장 400 오류 수정
files:
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 회로 payload sanitizer 부재 및 window.prompt 사용으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- API PASS: PUT /production/specifications/revisions/8 DTO 필드만 전송 시 200
- 브라우저 PASS: 저장 클릭 시 PUT /production/specifications/revisions/8 200, postData에 circuitId/revisionId/company/createdAt 미포함
- 브라우저 PASS: Rev 생성 모달 취소 시 /revise 호출 0건
review:
- needs-review
notes:
- 상세 조회 엔티티 필드가 회로 저장 DTO로 재전송되지 않도록 허용 필드만 payload에 담는다.
- `Rev 생성`은 브라우저 prompt/alert 계열이 아니라 화면 모달로 확인하고, 취소 시 API를 호출하지 않는다.

## T-HARNESS-CONNECTION-SYMBOL 연결문자 그림 표시
status: REVIEW
owner: codex
role: implementer
scope:
- 제품 도면관리 회로 그리드 연결 컬럼 표시 개선
files:
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 연결 그림 컴포넌트 부재로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup에서 HDW-SEED-HNS02-MAIN 선택 후 data-connection-symbol 8개, svg 8개, select 8개 렌더링 확인
review:
- needs-review
notes:
- `connectionSymbol` 저장값은 유지하고 화면에는 선/분기/단측 SVG 미리보기로 표시한다.

## T-HARNESS-DRAWING-SEED 하네스 도면관리 시드 데이터
status: REVIEW
owner: codex
role: operator
scope:
- 하네스 제품 도면관리 JSHANES 시드 데이터
files:
- apps/backend/src/modules/production/controllers/production-specification.controller.ts
- apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES pre-check 도면관리 0건 확인
- apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql JSHANES 적용 PASS
- seed SQL 재실행 PASS: 중복 없이 도면 2건, Revision 3건, 회로 17건 유지
- API PASS: HDW-SEED-HNS02-MAIN Rev.A 6회로, Rev.B 8회로 조회
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup 검색/선택 후 회로 입력값 VSF 0.75SQ 표시
review:
- needs-review
notes:
- 기존 품목 `HNS02`, `HNS02C1ABCD` 기준으로 재실행 가능한 seed를 적재한다.
- 검증 중 누락 확인된 Revision 상세 GET 라우트와 화면 회로 상세 로딩을 함께 보정한다.

## T-HARNESS-DRAWING-MGMT 하네스 제품 도면관리 신규 기능
status: REVIEW
owner: codex
role: implementer
scope:
- 생산 도면관리 신규 화면/API/DB
files:
- apps/backend/src/entities/harness-drawing-*.entity.ts
- apps/backend/src/modules/production/controllers/production-specification.controller.ts
- apps/backend/src/modules/production/services/production-specification.service.ts
- apps/backend/src/modules/production/dto/production-specification.dto.ts
- apps/backend/src/modules/production/production.module.ts
- apps/backend/src/migrations/2026-06-18_harness_drawing_management.sql
- apps/frontend/src/app/(authenticated)/production/specification-setup/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- docs/reports/db-schema-erd.md
- docs/superpowers/plans/2026-06-18-harness-drawing-management.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- pnpm --filter @harness/backend exec jest apps/backend/src/modules/production/services/production-specification.service.spec.ts --runInBand PASS
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES 마이그레이션 적용 PASS: HARNESS_DRAWING_MASTERS/REVISIONS/CIRCUIT_SPECS, SEQ_HARNESS_* 3개, PROD_SPEC_SETUP 메뉴 확인
- python tools/generate_db_schema_doc.py PASS
- API 실흐름 PASS: 도면 생성 -> 승인 -> Rev 생성 -> 삭제, 테스트 데이터 잔여 0건
- 브라우저 PASS: http://localhost:3002/production/specification-setup 인증 세션에서 제목/Header/회로 그리드/저장/승인 버튼 표시
review:
- needs-review
notes:
- 신규 기능으로 기존 작업지도서/문서관리 확장이 아니라 하네스 도면 전용 Master/Revision/Circuit 구조로 구현한다.
- 생성 ID는 Oracle SEQUENCE.NEXTVAL만 사용한다.

## T-CONSUMABLE-LABEL-REPRINT 기존 소모품 라벨 재발행 테스트
status: REVIEW
owner: codex
role: implementer
scope:
- apps/frontend/src/app/(authenticated)/consumables/label
files:
- apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/components/ConLabelDetailPanel.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx
- apps/print-agent/**
- tools/print-agent.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- http://localhost:3002/consumables/label 브라우저 재발행 테스트 PASS: UID C26061700029 재발행, 출력 팝업 UID/window.print 포함, 신규 /consumables/label/create 미호출, /material/label-print/log 201
- 좁은 우측 패널에서 재발행 버튼 상시 노출 Playwright 재검증 PASS: buttonBox가 420px panelBox 내부, UID 접근성 이름으로 클릭 가능
- 재발행 출력 방식 agent 전환 Playwright PASS: popup 0, agent /print 1회, jobId CON-REPRINT-C26061700029, 신규 채번 0건, print-log 201
- 재발행 전 미리보기 및 바코드 렌더 준비 대기 Playwright PASS: UID C26061700029, 미리보기 모달 ready barcode 1, pending 0, popup 0, agent /print 1회
- PDF 프린터 출력 결과 바코드 깨짐 원인 분리 및 수정 PASS: 전송 PNG before는 Tailwind class 미적용으로 barcode crop, after는 QR 전체/UID 정상
review:
- needs-review
notes:
- 기존 PENDING conUid를 새로 채번하지 않고 같은 UID로 재출력하고 print log만 추가한다.
- 420px 우측 패널의 넓은 테이블 구조에서는 재발행 버튼이 사용자에게 안 보일 수 있어 리스트형 행으로 보정 완료.
- 재발행 버튼은 브라우저 print dialog가 아니라 로컬 print-agent `/print`로 PNG를 전송한다.
- 출력 전 `미리보기`에서 같은 라벨 렌더링 결과를 확인할 수 있게 하고, 바코드 비동기 생성이 끝나기 전에는 agent PNG 캡처를 진행하지 않는다.
- 미리보기 정상/PDF 깨짐의 원인은 SVG foreignObject PNG 변환 시 Tailwind class가 적용되지 않아 absolute/object-contain 등 핵심 스타일이 빠진 것이다. `LabelDesignRenderer` 출력 필수 스타일은 inline style로 유지해야 한다.

## T-PRINT-AGENT-GO Go 기반 로컬 프린트 에이전트 추가
status: REVIEW
owner: codex
role: implementer
scope:
- apps/print-agent (Windows 로컬 프린트 에이전트)
- apps/frontend/src/services (프론트 연동용 클라이언트)
files:
- apps/print-agent/**
- apps/frontend/src/services/print-agent.ts
- tools/print-agent.structure.test.mjs
- docs/superpowers/plans/2026-06-17-hanes-print-agent.md
verification:
- node tools/print-agent.structure.test.mjs PASS
- C:\go\bin\go.exe test ./... PASS
- go build dist\hanes-print-agent.exe PASS
- tray 실행 경로 agent /health, /printers PASS
- agent 자체 `/settings` 설정관리 페이지 HTTP 200 PASS
- `/config` 기본 프린터 저장 및 config.json 반영 PASS
- `/test-print`가 저장된 기본 프린터 `Microsoft Print to PDF`로 queued PASS
- listenAddress 임시 변경 시 restartRequired=true, 복구 시 false PASS
- C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent PASS
review:
- needs-review
notes:
- 웹에서 사전 렌더링한 PNG를 localhost agent로 보내고, agent는 Windows 프린터 드라이버로 조용히 출력하는 1차 범위.
- Windows 트레이 상주, 상태 보기, 설정, 프린터 보기, 종료 메뉴 구현 완료. agent 자체 `/settings` 설정관리와 config 파일 저장 검증 완료. 트레이 설정 메뉴의 실제 클릭 육안 검증과 Zebra 실출력 검증은 남음.

## T-IQC-AQL-CRUD AQL 기준관리 CRUD/API/DB 구현
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/quality/aql` 기준관리 등록/수정/삭제와 LOT 범위 rule 관리
files:
- apps/backend/src/entities/aql-standard.entity.ts
- apps/backend/src/entities/aql-sampling-rule.entity.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/modules/quality/quality.module.ts
- apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql
- apps/frontend/src/app/(authenticated)/quality/aql/**
- docs/reports/db-schema-erd.md
verification:
- RED 확인: backend AQL entity/service spec가 신규 모듈 부재로 실패
- RED 확인: frontend `/quality/aql` 구조 테스트가 placeholder page로 실패
- pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts aql.service.spec.ts --runInBand PASS
- node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs" PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES 마이그레이션 적용 PASS: `AQL_STANDARDS`, `AQL_SAMPLING_RULES` 생성 및 재실행 idempotent PASS
- ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py PASS, ERD 문서 AQL 테이블 반영 확인
- API PASS: 목록/등록/상세/resolve/수정/삭제 soft-disable 확인, 검증 데이터 물리 삭제 후 잔여 0
- 브라우저 PASS: 3002 `/quality/aql` 제목/저장/추가/rule 입력 UI 표시 및 console/page error 0
review:
- needs-review
notes:
- 이번 범위는 AQL 기준관리 CRUD까지로 제한한다. IQC 품목별 기준 연결과 IQC 검사 적용은 후속 단계로 분리한다.
- 테스트 기준코드 `AQL-CODEX-260619`는 API 검증 후 `AQL_SAMPLING_RULES`, `AQL_STANDARDS`에서 물리 삭제했다.

## T-EQUIP-INSPECT-WORKER-PK-COLLISION 작업자설비점검 PK 충돌 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/equipment/daily-inspect` WORKER 저장 시 `EQUIP_INSPECT_LOGS` 물리 PK 충돌 방지
files:
- apps/backend/src/modules/equipment/services/equip-inspect.service.ts
- apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts
verification:
- JSHANES pre-check: `EQ-ATCNS-01`/`WORKER`/2026-06-19 00:00:00 충돌 로그 확인.
- JSHANES cleanup: `WO2606190100`, `WO2606190118` 충돌 로그 각 1건 삭제, 최종 잔여 0건.
- RED: `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts -t "stores WORKER inspectDate"` 실패 확인.
- GREEN: 동일 focused test PASS.
- `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts` PASS.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS.
- `git diff --check -- apps/backend/src/modules/equipment/services/equip-inspect.service.ts apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` PASS.
review:
- needs-review
notes:
- 원인: WORKER 이력의 `INSPECT_DATE`가 날짜 00:00:00으로 저장되어 같은 장비/유형/일자에서 작업지시가 달라도 기존 PK와 충돌.
- 변경: WORKER 저장만 명시 SQL `TO_DATE(:3, 'YYYY-MM-DD HH24:MI:SS')`로 실제 점검시각을 물리 PK에 보존한다. DAILY 저장 경로는 유지.

## T-MASTER-REQUIRED-MARKS 기준정보 필수컬럼 별표 표시
status: REVIEW
owner: codex
role: implementer
scope:
- 기준정보 하위 메뉴 폼의 DB/저장 필수 컬럼 라벨 `*` 표시 일관화
files:
- apps/frontend/src/components/ui/Select.tsx
- apps/frontend/src/app/(authenticated)/master/**
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: `Select` 별표 미표시 및 기준정보 폼 required 누락으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/master/master-required-fields.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 품목관리처럼 공통 Input/Select의 required prop을 사용해 필수 라벨 별표를 표시한다.
- `Select`도 `Input`과 동일하게 `required` 라벨 별표와 native required 속성을 처리한다.
- 작업지도서 폼의 수동 `*` 라벨은 자동 별표와 중복되지 않도록 제거했다.

## T-IQC-AQL-POLICY-CODE `/master/iqc-part-spec` 실제 IQC 판정 경로 연결
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/iqc-part-spec` 선택 품목 AQL 미리보기를 실제 IQC 검사항목 판정 경로로 연결
files:
- apps/backend/src/modules/quality/aql/controllers/aql.controller.ts
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs
verification:
- RED 확인: `/master/iqc-part-spec` 구조 테스트가 `resolve-iqc-items` endpoint 부재와 품목정책 단독 미리보기 호출로 실패
- node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs" "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs" PASS
- pnpm.cmd --filter @harness/backend exec jest src/modules/quality/aql/services/aql.service.spec.ts --runInBand PASS
- pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- `/quality/aql/resolve-iqc-items` endpoint를 추가해 `AqlService.resolveIqcPolicyByItem()` 결과를 화면 미리보기에 사용한다.
- `/master/iqc-part-spec` 상단 요약은 품목 정책 코드뿐 아니라 검사항목별 AQL/파괴/고정 기준 건수를 함께 보여준다.

## T-IQC-AQL-ACTUAL-PREVIEW 검사모달 AQL 실제 판정 경로 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc` 검사 모달 AQL 미리보기를 실제 저장 판정 경로와 일치
- AQL 정책 미설정 품목의 조용한 PASS 방지
files:
- apps/frontend/src/components/material/IqcModal.tsx
- apps/frontend/src/hooks/material/useIqcData.ts
- apps/frontend/src/components/material/iqc-modal-aql-preview.structure.test.mjs
- apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs
- apps/backend/src/modules/quality/aql/services/aql.service.ts
- apps/backend/src/modules/quality/aql/services/aql.service.spec.ts
verification:
- RED 확인: 검사 모달이 `/quality/aql/resolve-iqc` 및 `selectedItem.supplierName`을 사용하고, 정책 없는 품목이 PASS로 resolve되어 신규 테스트 실패
- node --test apps/frontend/src/components/material/iqc-modal-aql-preview.structure.test.mjs apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs apps/frontend/src/components/material/iqc-modal-destructive.structure.test.mjs apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs PASS
- pnpm.cmd --filter @harness/backend exec jest src/modules/quality/aql/services/aql.service.spec.ts --runInBand PASS
- pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/iqc-history.service.spec.ts --runInBand PASS
- pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 3002 `/material/iqc` HTTP 200
- git diff --check PASS
review:
- needs-review
notes:
- `IqcModal`은 `/quality/aql/resolve-iqc-items`를 호출하고 항목별 AQL/파괴/고정 요약을 표시한다.
- `useIqcData`는 표시명 `supplierName`과 실제 코드 `vendorCode`를 분리해 AQL preview에는 `vendorCode`를 전달한다.
- `AqlService.resolvePartPolicy()`는 정책코드 미설정 시 `BadRequestException`으로 차단한다.

## T-LABEL-TEXT-IMAGE-INPUT 라벨 텍스트 직접입력 및 이미지 업로드 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/label` 텍스트 객체가 소스 필드 없이 사용자 고정 문구를 직접 출력할 수 있게 보정
- 이미지 객체에 파일 업로드를 추가하고 업로드 URL을 `imageUrl`로 자동 반영
files:
- apps/frontend/src/app/(authenticated)/master/label/components/LabelObjectDesigner.tsx
- apps/frontend/src/app/(authenticated)/master/label/master-label-object-inputs.structure.test.mjs
- apps/backend/src/modules/master/controllers/label-template.controller.ts
- apps/backend/src/modules/master/controllers/label-template-upload.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-object-inputs.structure.test.mjs"`가 텍스트/이미지 sourceField 고정 및 업로드 API 부재로 실패
- RED 확인: `node --test "apps/backend/src/modules/master/controllers/label-template-upload.structure.test.mjs"`가 `upload-image` 엔드포인트 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-object-inputs.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs" "apps/backend/src/modules/master/controllers/label-template-upload.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: 기존 3002 `/master/label` Playwright 인증 세션 확인. 텍스트 고정값 입력 표시, `고정값 사용` option 1건, 이미지 업로드 버튼 표시, PNG 업로드 200, 정적 URL 200, console error 0건
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `LabelObjectDesigner.tsx`는 `T-KIOSK-SG-LABEL-PRINT` active lock에 포함되어 있으나, 사용자가 본 대화에서 충돌 수정 진행을 승인했다.
- locale 파일은 active lock 충돌이 있어 수정하지 않고 `t(key, fallback)` 패턴만 사용한다.
- 검증 중 생성된 `apps/backend/uploads/label-templates/label-image-1782398858012-220155548.png`는 검증 후 삭제했다.

## T-LABEL-BOX-STROKE 박스 객체 상단선 출력 누락 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/label` 박스 객체의 상단 stroke가 실제 출력/캡처에서 빠져 보이는 문제 원인 확인
- locked된 디자이너/타입 파일을 수정하지 않고 공용 렌더러에서 stroke 안정성 보정
files:
- apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx
- apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs"`가 `ShapeStrokeLayer` 부재로 실패
- PASS: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-sg-label-print.structure.test.mjs"`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 기존 3002 `/master/label` Playwright 인증 세션 확인. `data-label-element=8`, `data-label-shape-stroke=2`, console error 0건
- PASS: 대상 파일 `git diff --check`
review:
- needs-review
notes:
- `T-KIOSK-SG-LABEL-PRINT`가 `LabelObjectDesigner.tsx`, `types.ts`, `page.tsx` 등을 active lock 중이므로 해당 파일은 읽기만 한다.
- `apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs`는 이번 변경과 무관하게 현재 코드가 `t("consumables.label.preview", "미리보기")` 형태라 하드코딩 정규식 `>미리보기<`와 맞지 않아 실패한다. 해당 파일은 lock/scope 밖이라 수정하지 않았다.

## T-ER-VIEW-MENU-VISIBILITY ER VIEW 메뉴 노출 누락 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/system/er-view`가 사이드바 메뉴에 보이지 않는 원인 확인 및 메뉴 배치 소스 보정
files:
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/backend/src/seeds/menu-config.json
- apps/backend/src/migrations/2026-06-23_er_view_menu_seed.sql
- apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs
verification:
- RED 확인: `node apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs`가 `SYS_ER_VIEW` 누락으로 실패
- JSHANES pre-check: `MENU_CATEGORY_ITEMS`/`ROLE_MENU_PERMISSIONS`의 `SYS_ER_VIEW` 행 0건 확인
- JSHANES 적용: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_er_view_menu_seed.sql` PASS
- JSHANES post-check: `SYS_ER_VIEW`가 `SYSTEM`, sort 95, `IS_ACTIVE='Y'`로 조회됨
- `node apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs` PASS
- `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"` PASS
- `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false` PASS
- `node -e "JSON.parse(...menu-config.json...)"` PASS
- `git diff --check` PASS
review:
- needs-review
notes:
- 사이드바는 `/menu-categories/tree` DB 트리와 `menuConfig.ts` leaf를 병합한다. `MENU_CATEGORY_ITEMS`에 배치되지 않은 leaf는 menuConfig에 있어도 렌더링에서 제외된다.
- `SYS_ER_VIEW`는 기존 시스템 메뉴 패턴에 맞춰 ADMIN 전체허용 메뉴로 배치했다. `ROLE_MENU_PERMISSIONS`에는 추가하지 않았다.

## T-CONS-MOUNT-HELP-LOCALE `/consumables/mount` 도움말 및 다국어 처리
status: REVIEW
owner: kimi
role: implementer
scope:
- `/consumables/mount` 화면 도움말 작성 및 등록
- `consumables.mount.*` locale 키 누락 보정 (ko/en/zh/vi)
- `public/help/manifest.json` CONS_MOUNT 등록
files:
- apps/frontend/public/help/user/{ko,en,zh,vi}/CONS_MOUNT.md
- apps/frontend/public/help/operator/{ko,en,zh,vi}/CONS_MOUNT.md
- apps/frontend/public/help/manifest.json
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/frontend/src/app/(authenticated)/consumables/mount/consumables-mount-help-locale.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
verification:
- `node --test apps/frontend/src/app/(authenticated)/consumables/mount/consumables-mount-help-locale.structure.test.mjs` PASS
- `node -e "for (const l of ['ko','en','zh','vi']) JSON.parse(fs.readFileSync('apps/frontend/src/locales/'+l+'.json','utf8'))"` PASS
- `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS
- 3002 `/consumables/mount` HTTP 200 및 도움말 패널 표시 확인
review:
- needs-review
notes:
- 화면에 사용 중인 `consumables.mount.*` 키가 4개 언어 locale에 모두 없어 도움말과 함께 보정한다.
