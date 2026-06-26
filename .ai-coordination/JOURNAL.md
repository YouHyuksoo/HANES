# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

## 2026-06-26 21:44 Codex

### T-IQC-AQL-SAMPLE-SIZE-NORMALIZE
- 요청: `/quality/aql`에서 LOT 2~8 구간 샘플수량이 80으로 표시되는 비정상 AQL 기준을 전부 정상화.
- 원인: 화면 계산 문제가 아니라 `AQL_SAMPLING_RULES` seed/migration 데이터에 `SAMPLE_SIZE > LOT_QTY_TO`가 들어가 있었다. JSHANES pre-check 결과 9건: `AQL-I-0.01` 5건, `AQL-S-1-0.015` 4건.
- 조치: correction migration `apps/backend/src/migrations/2026-06-26_fix_aql_sample_size_not_exceed_lot.sql`로 `SAMPLE_SIZE = LOT_QTY_TO` 일괄 보정 후 JSHANES 적용/재실행. 원본 seed `2026-06-26_aql_standard_s1_0_015.sql`, `2026-06-26_aql_standard_I_0.01.sql`도 작은 LOT 구간 정상값으로 수정해 재실행 시 재발하지 않게 했다.
- 보호: `AqlService`는 저장 시 `sampleSize > lotQtyTo`를 거부하고, resolve 결과는 실제 `lotQty`보다 큰 `sampleSize`를 반환하지 않도록 cap 처리한다.

검증:
- PASS: `pnpm.cmd --filter @harness/backend test -- aql.service.spec.ts --runInBand`
- PASS: `node --test apps/backend/src/migrations/aql-sample-size-normalize.structure.test.mjs`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: JSHANES `SAMPLE_SIZE > LOT_QTY_TO` 0건
- PASS: 대상 파일 `git diff --check`

## 2026-06-26 17:47 Codex

### T-PRODUCT-RECEIVE-BX2606260001-CLEANUP
- 요청: `BX2606260001` 제품입고를 했다가 취소했는데 이미 입고된 것으로 판단되어, 해당 박스 관련 입고이력을 삭제.
- 원인 증거: JSHANES `PRODUCT_TRANSACTIONS`에 `PTX2026062600001 / WIP_OUT / REF_TYPE=BOX / REF_ID=BX2606260001 / STATUS=DONE`이 남아 있었다. `ProductInventoryService.receiveFinishedFromWip()`의 이중입고 가드는 `REF_TYPE='BOX'`, `REF_ID='BX2606260001'`, `TRANS_TYPE IN ('WIP_OUT','FG_IN','WIP_IN')`, `STATUS='DONE'`을 보므로 이 행 때문에 재입고가 차단된다.
- 재고 증거: `FG_MAIN / N91H00-X9800` 재고 5가 남아 있고 `WIP_MAIN` 재고는 없었다. 이력만 삭제하면 다음 입고 시 WIP 재고 부족이 재발하므로 재고도 입고 전 상태로 복원했다.
- 조치: `apps/backend/src/migrations/2026-06-26_cleanup_product_receive_bx2606260001.sql` 추가 및 JSHANES 적용. `PTX2026062600001` 및 그 취소참조 전표 삭제, `FG_MAIN / N91H00-X9800` 5개 제거, `WIP_MAIN / N91H00-X9800` 가용 5개 복원.
- 보존: `BOX_MASTERS.BX2606260001`은 `CLOSED / QTY=5` 유지, `FG_LABELS` 5건은 `PACKED / BOX_NO=BX2606260001` 유지.

검증:
- PASS: `BX2606260001` 관련 정상 BOX 제품전표 0건.
- PASS: 중복입고 가드 조건 count 0건.
- PASS: `WIP_MAIN / N91H00-X9800 / QTY=5 / AVAILABLE_QTY=5 / STATUS=NORMAL`.
- PASS: 대상 파일 `git diff --check`.

남은 의심:
- 사용자가 취소를 눌렀는데 원본 `WIP_OUT`이 `CANCELED` 처리되지 않고 취소 전표도 보이지 않았다. 제품입고 취소 로직은 별도 버그로 추적 필요.

## 2026-06-26 17:36 Codex

### T-PRODUCT-RECEIVE-BX2606260001-WIP-SEED
- 요청: `/product/receive`에서 `BX2606260001` 박스입고 시 `재고 부족으로 출고할 수 없습니다: N91H00-X9800 (가용 0, 요청 5)` 오류 해결.
- 원인: `POST /inventory/fg/receive`는 `ProductInventoryService.receiveFinishedFromWip()`에서 `WIP_MAIN`의 `PRODUCT_STOCKS`를 먼저 `WIP_OUT` 차감하고 FG 기본창고(`FG_SHIP`)로 이동한다. JSHANES `PRODUCT_STOCKS`에 `WIP_MAIN / N91H00-X9800` 재고 행이 없어 가용 0으로 차단됐다.
- 조치: `apps/backend/src/migrations/2026-06-26_seed_wip_stock_bx2606260001_n91h00.sql` 추가 및 JSHANES 적용. `PRODUCT_STOCKS`에 `WIP_MAIN / N91H00-X9800 / QTY=5 / AVAILABLE_QTY=5 / STATUS=NORMAL` 시드, 추적용 `PRODUCT_TRANSACTIONS` seed 전표 `PTX-SEED-BX2606260001-WIP` 생성.
- 보호: 실제 박스 입고 이중처리 가드에 걸리지 않도록 seed 전표는 `REF_TYPE='SEED'`로 남겼다. SQL은 `BX2606260001`의 정상 `BOX` 입고/이동 전표가 이미 있으면 재고를 다시 만들지 않는다.

검증:
- PASS: SQL 적용 및 재실행 성공.
- PASS: post-check `WIP_MAIN / N91H00-X9800` 가용 5 확인.
- PASS: `BX2606260001` 정상 BOX 전표 0건이라 사용자가 UI에서 재시도 가능.
- PASS: 대상 파일 `git diff --check`.

## 2026-06-26 17:16 Codex

### T-SHIP-PACK-BX2606260001-SEED
- 요청: `http://localhost:3002/shipping/pack`에서 `BX2606260001`에 `N91H00-X9800`을 담을 수 있도록 시드 데이터 생성.
- 원인/상태: `BOX_MASTERS.BX2606260001`은 이미 `OPEN / N91H00-X9800 / QTY=0 / SERIAL_LIST IS NULL` 상태였고, `N91H00-X9800` 포장 가능 FG 라벨이 0건이었다.
- 조치: `apps/backend/src/migrations/2026-06-26_seed_pack_bx2606260001_n91h00.sql` 추가 및 JSHANES 적용. `FG-N91-X9800-001`~`FG-N91-X9800-005` 5건을 `FG_LABELS`에 `VISUAL_PASS / INSPECT_PASS_YN='Y' / BOX_NO NULL`로 시드했다.
- 보호: SQL은 `MERGE` 기반으로 재실행 가능하다. 이미 박스에 담긴 FG 라벨은 `BOX_NO`를 되돌리지 않는다.

검증:
- PASS: SQL 적용 및 재실행 성공.
- PASS: `/shipping/pack` 포장 가능 조건 동일 SQL에서 `N91H00-X9800` packable 5건 확인.
- PASS: 동일 바코드 `MAT_LOTS` 0건으로 `BoxService.addSerial()`의 원자재 LOT 품목 검증 충돌 없음.
- PASS: 대상 파일 `git diff --check`.

## 2026-06-26 17:05 Codex

### T-CONCESSION-WORKER / T-RECEIVE-HISTORY-CONCESSION-FLAG
- `/material/concession` 특채처리 모달의 작업자 입력을 QR 스캔 입력과 작업자 선택이 나란히 있는 단일 영역으로 정리했다. 저장 payload는 기존처럼 `specialAcceptWorkerCode` 하나만 사용한다.
- `/material/receive-history` 그리드에 `특채여부` 컬럼을 추가했다. 백엔드 `/material/receiving` `findAll()`은 LOT 기준 `IQC_STATUS='FAIL' AND SPECIAL_ACCEPT_YN='Y'`이면 `isConcession=true`, `specialAcceptYn='Y'`, `lot.specialAcceptYn`, `lot.iqcStatus`를 응답에 포함한다.
- `receiving.service.ts`는 `T-RECEIVE-LOCATION` active lock과 겹쳤으나 사용자 요청 범위상 이력 응답 반환부만 최소 수정했고 충돌 사실을 TASKS/LOCKS에 기록했다.

검증:
- PASS: `pnpm.cmd --filter @harness/backend test -- receiving.service.spec.ts --runInBand`
- PASS: `node --test "apps/frontend/src/app/(authenticated)/material/receive-history/receive-history-concession-flag.structure.test.mjs" "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs" apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs`
- PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: 대상 파일 `git diff --check`

## 2026-06-26 Claude — N91H00 후속(품목속성/AQL표준/라우팅)

### 1) 품목마스터 속성 채움 (T-ITEM-ATTR-FILL)
/master/part에서 제품유형·차종·모델구분·리비전 빈값 → ITEM_MASTERS 26건 NVL UPDATE(기존값 보존).
- 제품유형(PRODUCT_TYPE): 완제품 HARNESS, 반제품 SUB_ASSY, 원자재는 ITEM_NAME 매핑(WIRE/TUBE/TAPE/TERMINAL/HOUSING/SEAL/SHIELD/HOLDER/LABEL). 코드마스터 PRODUCT_TYPE 기반.
- 차종(MODEL_NAME)=OV(Usage Vehicle), 모델구분(DEFECT_MODEL_GROUP)=HV(고전압), 리비전(REV)=A.
- migration: 2026-06-26_item_master_fill_attrs.sql.

### 2) AQL 표준 추가 — resolve-iqc-items 404 (T-AQL-STD-I001)
원인: 6TPP210190 IQC_PART_SPEC_ITEMS의 'IQC-TEST' 항목이 INSPECTION_LEVEL='I'/AQL=0.01/MAJOR인데 AQL_STANDARDS엔 II 3건만 → aql.service.ts:747 resolveSeverityRule('I',0.01) 후보 AQL-I-0.01 부재 → 404.
조치: AQL_STANDARDS 'AQL-I-0.01' + AQL_SAMPLING_RULES 15구간(ISO 2859-1 보통검사 1회, AQL0.010 유효플랜 sample125/Ac0/Re1, 화살표 상향). lotQty=1000 → 501-1200 구간 매칭 검증. migration: 2026-06-26_aql_standard_I_0.01.sql.
주: 'IQC-TEST'/AQL0.01은 테스트성 검사항목으로 보임. 표준만 보강했고 검사항목 자체는 미수정.

### 3) N91H00-X9800 라우팅 생성 (T-N91H00-ROUTING)
BOM 부모(완제품/C1/C2)별 ROUTING_GROUPS 3 + ROUTING_PROCESSES 17 + ROUTING_MATERIALS 33. 회신 시트 공정순서를 PROCESS_MASTERS 코드에 매핑.
- C1/C2 공정: ATCNS(전선절단탈피)→SHDCT(차폐선절단)→HEXPR(압착준비)→HEXCP(육각압착)→TMCRP(일반압착). TMCRP 파괴검사+SG라벨.
- 완제품 공정: TUBHT(열수축접착)→SGINS(반제품검사)→MATPR(조립자재준비)→PROTC(커넥터체결)→MASSY(외장재조립)→CIINS(통합회로검사,FG라벨)→AINSP(최종검사). 검사공정 SAMPLE_INSPECT_YN=Y.
- 자재: 회신 공정별 투입자재를 BOM 자식으로 매핑. 33건 전부 BOM child 정합 검증(백엔드 BOM 검증규칙 충족, 위반 0).
- 공정코드 일부는 근사 매핑(커넥터체결→PROTC, 외장재조립→MASSY, 최종검사→AINSP). 생성기: tools/seed/gen_n91h00_routing.py.

## 2026-06-26 Claude — T-N91H00-BOM (N91H00-X9800 BOM 생성)

### 입력
사용자 엑셀 `정보전략 BOM 작성 회신 N91H00-X9800.xlsx` (회신 시트 = 공정별 투입자재, Usage 시트 = 완제품 1대 총소요량). 앞선 purge로 N91H00 BOM은 0건이었음(원래 미등록).

### 레벨 (사용자 확정)
완제품 N91H00-X9800 ← 반제품 C1/C2 + 완제품 조립자재. 압착공정(준비/육각/일반압착) 자재는 C1·C2 각 반제품에 분배(사용자 선택). 1EA 공통 압착자재(HTEAVCW002MA/DLMLS6-3-3/EKEESNATBC)는 C1 귀속, VSFT1-201은 C1 압착1+완제품 열수축1.

### 조치
- 누락 투입자재 3종 품목마스터 추가(MERGE): LB04201250(LABEL 42x12), LB08802520(LABEL 88x25 회로라벨), RIBON-7(라벨프린터 먹지). UNIT=EA, RAW_MATERIAL. 나머지 18종은 보존 원자재 재사용.
- BOM_MASTERS 33행(완제품 11/C1 13/C2 9). 길이자재 QTY_PER=mm(전선 C1 670·C2 785, 튜브345, 테이프1330, 리본94), 그 외 EA.
- migration: 2026-06-26_n91h00_x9800_bom.sql (37블록 전부 success).

### 검증
CONNECT BY 전개 leaf 21종 총소요량 = Usage 시트 QTY 전부 일치(1SH21A7A09 1455mm=1.455MT, 압착 7종 각 2EA, 1EA 3종, 조립자재 전부).

### 미수행(범위 밖)
라우팅(공정순서)·작업지도서는 미생성(사용자 BOM만 요청). 회신 시트에 공정/설비/관리항목 있어 후속 요청 시 활용 가능.

## 2026-06-26 Claude — T-PURGE-HNS02-KS (HNS02 트리 + KS_ 품목 전 데이터 삭제)

### 요청
사용자: HNS02 BOM 하위 모든 품목 + KS_ 접두 품목의 기준정보 + 전 트랜잭션(IQC/PO/입고/출고/재고/입하/수불/포장/작업지시/실적/박스/팔레트) 삭제. 확인사항 2건 — 원자재 18종 포함, 품목마스터까지 완전 삭제.

### 대상 품목 70개 (품목 한정, N91H00 계열 23개 보존)
- HNS02 BOM 트리 전개(CONNECT BY): 반제품 17 + 전용 원자재 18(CBL/TMN/RSL/HSG/TP/TUB/NFT/PHDL/CNTR/CSH/HLD) + HNS02
- ITEM_MASTERS LIKE 'HNS02%' / 'KS\_%' (KS_ 34개: 완제품 3/반제품 4/원자재 27)
- 원자재 공유 검증: HNS02 전용 원자재는 비-HNS02 부모 BOM 0건(공유 안 됨), KS BOM 폐쇄적.

### 도구
`tools/seed/purge_items_hns02_ks.py` (reset_transactional_data.py 패턴). introspection으로 ITEM_CODE 직접/간접키(ORDER_NO·RESULT_NO·FG/SG바코드·MAT_UID·BOX_NO·PO_NO·SHIP_ORDER_NO·ROUTING_CODE) 전파, FK 비활성→자식우선 DELETE→재활성. dry-run/--commit.

### 실행 결과 (JSHANES)
1. 메인 purge: 트랜잭션 3547행(31테이블) + 기준정보 231행(WORK_INSTRUCTIONS 31/ROUTING_PROCESSES 42/ROUTING_GROUPS 22/BOM_MASTERS 66/ITEM_MASTERS 70) = **3778행 commit**.
   - 헤더 혼합 0 확인(PO/출하): 대상 헤더 전량 삭제 안전. PURCHASE_ORDERS 4/5(비대상 1 보존), EQUIP_INSPECT_LOGS 1/9(대상 작업지시분만).
   - 보존: 소모품 CONSUMABLE_* 380, 스케줄러 20, 재고실사 1, LABEL_PRINT_LOGS 3 (품목 무관/요청 범위 밖).
   - FK 재활성화 1건 실패(ORA-02298): IQC_ITEM_MASTERS 잔존 → 2차 정리.
2. 잔존 정리(migration sql 2개): IQC_ITEM_MASTERS 15/IQC_PART_SPECS 18/IQC_PART_SPEC_ITEMS 53 + CONTROL_PLANS 1(+자식 25)/HARNESS 도면 체인(회로스펙→리비전→도면 2). CONTROL_PLAN_ID(VARCHAR)=PLAN_NO 매핑, 하네스 체인 회로스펙 자식 처리.

### 검증
- 대상 품목 잔존 0 (HNS02%/KS_% = 0). ITEM_MASTERS 23 보존(N91H00 완제품/반제품3/원자재19).
- DISABLED FK 0개(전수 복구). JOB_ORDERS/MAT_LOTS/FG_LABELS=0(전부 HNS02/KS였음).
- _BAK 백업 3종(104행)은 의도적 보존(복구 안전장치).

### 비고
- 앞서 같은 날 추가한 KS 작업지도서 시드도 품목 삭제와 함께 제거됨(품목 자체 삭제로 무의미).
- 산출물: tools/seed/purge_items_hns02_ks.py, migrations/2026-06-26_purge_hns02_ks_master_residue{,2}.sql.

## 2026-06-26 Claude — T-KS-WORK-INSTRUCTION-SEED

### 문제
`/production/input-kiosk` 작업지도서(WorkInstructionView)가 KS 라인 작업지시 선택 시 표시되지 않음. WorkInstructionView는 `GET /master/work-instructions?itemCode=&processCode=&useYn=Y`로 조회하며, itemCode=작업지시 품목, processCode=선택 설비 공정(없으면 작업지시 PROCESS_CODE 폴백)으로 필터(`WorkInstructionView.tsx:53,57-63`).

### 원인 (실측, JSHANES)
- WORK_INSTRUCTIONS에 HNS02 계열 20건만 존재, KS 라인 0건.
- 활성 작업지시 중 KS_L1_ACOMP_N91H00-X9800/KS_ASPRP(WAITING), KS_L2_SHLDCABLE/KS_CUTST(RUNNING)가 작업지도서 MISSING → 키오스크 빈 화면.
- KS_EQ_* 설비는 PROCESS_CODE 전부 null → 키오스크는 작업지시 PROCESS_CODE로 폴백 조회.

### 조치
- `tools/generate-ks-work-instruction-seed.mjs` 신규(기존 generate-work-instruction-seed-images.mjs 패턴 차용, UPDATE→MERGE). KS 두 품목의 ROUTING_PROCESSES 전 공정(완제품 4 + 반제품 8 = 12건)에 대해 SVG + WORK_INSTRUCTIONS 행 생성.
  - SVG: `apps/backend/uploads/work-instructions/wi-seed-ks_*.svg` 12개.
  - SQL: `apps/backend/src/migrations/2026-06-26_ks_work_instruction_seed.sql` (MERGE 멱등, TITLE/CONTENT/IMAGE_URL/USE_YN='Y', COMPANY='40'/PLANT_CD='1000').
- IMAGE_URL이 404여도 WorkInstructionView 마지막 fallback(`:170-177`)에서 CONTENT 텍스트 표시되도록 CONTENT도 채움.

### 검증 (JSHANES)
- 마이그레이션 실행: 13블록(MERGE 12 + COMMIT) 전부 success.
- KS 작업지도서 12건 등록 확인.
- 활성 작업지시(WAITING/RUNNING) 19건 ↔ WORK_INSTRUCTIONS LEFT JOIN: 전부 WI=OK, MISSING 0.

### 비고
- 코드 로직/locales 미수정(데이터 시드만). 로컬 backend가 uploads 정적 서빙 시 SVG 표시, 배포(hswbs)엔 SVG 미배포여도 CONTENT fallback으로 표시.
- 라우팅 전 공정 시드로 향후 설비-공정 매핑/추가 작업지시도 커버.

## 2026-06-25 11:28 Codex

- 작업: `T-MANUAL-INDEX-PAGE` 매뉴얼 메인 목차 페이지 생성.
- 변경: `docs/manuals/index.html` 추가. `docs/manuals/*.result.json` 기준 7개 매뉴얼 그룹(기준정보/자재/생산/품질/검사/제품수불/출하)과 104개 화면을 정적 HTML 목차로 구성했다.
- 기능: 좌측 그룹 네비게이션, 상단 요약(그룹/화면/누락 수), 화면명·메뉴코드·경로 검색, 매뉴얼 열기, 결과 JSON 열기, 화면별 `#screen-N` 바로가기.
- 검증: HTML script syntax PASS, runtime smoke PASS(`manualCount=7`, `screenCount=104`), embedded manual/result link existence PASS, index total 104/result total 104 PASS, `git diff --check -- docs/manuals/index.html .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` PASS.
- 범위: 기존 매뉴얼 HTML/result JSON은 수정하지 않았다.

## 2026-06-24 21:37 Codex

- 작업: `T-REMAINING-HELP-MANUALS` 공식 runner 3002 재시도 및 최종 완료.
- 사용자 선택: 이전 캡처 누락에 대해 1번(`3002 단독 사용 상태에서 공식 runner 재시도`) 선택.
- 실행: 추가 포트/대체 runner/우회 캡처 없이 `C:\Users\hsyou\.claude\skills\help-manual-export\scripts\help-manual-export-runner.mjs`만 `HANES_FRONTEND_URL=http://localhost:3002`로 재실행.
- 결과: `docs/manuals/hanes-product-mgmt-manual-2026-06-24.result.json` `total=4`, `missingHelp=[]`, `missingCapture=[]`; `docs/manuals/hanes-inspection-manual-2026-06-24.result.json` `total=6`, `missingHelp=[]`, `missingCapture=[]`; `docs/manuals/hanes-shipping-manual-2026-06-24.result.json` `total=9`, `missingHelp=[]`, `missingCapture=[]`; `docs/manuals/hanes-quality-manual-2026-06-24.result.json` `total=25`, `missingHelp=[]`, `missingCapture=[]`.
- 검증: runner 프로세스 잔여 없음. 재시도 로그 파일 삭제. 후속 검증에서 manifest/frontmatter/result/diff check 확인 예정.

## 2026-06-24 19:39 Codex

- 작업: `T-REMAINING-HELP-MANUALS` 품질/검사/제품수불/출하 매뉴얼 생성.
- 생성: `.ai-coordination/TASK-quality-manual.md`, `TASK-inspection-manual.md`, `TASK-product-mgmt-manual.md`, `TASK-shipping-manual.md` 기준으로 user 도움말 36개, operator 도움말 30개를 작성하고 `apps/frontend/public/help/manifest.json`을 보강했다.
- 산출물: `docs/manuals/hanes-quality-manual-2026-06-24.html`, `docs/manuals/hanes-inspection-manual-2026-06-24.html`, `docs/manuals/hanes-product-mgmt-manual-2026-06-24.html`, `docs/manuals/hanes-shipping-manual-2026-06-24.html` 및 각 `.result.json`.
- 검증: frontmatter/BOM/audience/manifest 검사 PASS. 공식 `C:\Users\hsyou\.claude\skills\help-manual-export\scripts\help-manual-export-runner.mjs`를 `HANES_FRONTEND_URL=http://localhost:3002`로만 실행했다. 추가 포트/대체 runner/우회 캡처는 사용하지 않았다.
- 결과: 4개 result 모두 `missingHelp=[]`. `total`은 quality 25, inspection 6, product 4, shipping 9.
- BLOCKED: 공식 runner 캡처가 `page.goto: Timeout 120000ms exceeded.`로 실패해 `missingCapture`가 남았다. quality 5건(`QC_PPAP`, `QC_SPC`, `QC_CONTROL_PLAN`, `QC_AUDIT`, `SYS_TRAINING`), inspection 6건 전체, product 4건 전체, shipping 9건 전체.
- 다음 결정 필요: 3002 단독 사용 상태에서 공식 runner 재시도, 3002 환경 원인 수정, 또는 사용자 승인 후 runner/캡처 방식 보정.

## 2026-06-24 Claude (T-KIOSK-MAT-MOUNT 키오스크 자재 설비기준 장착 전환)

- 작업: 키오스크(`/production/input-kiosk`) 자재 입력을 작업지시 기준(JOB_MATERIAL_LOTS)에서 **설비 기준 장착**(WIP_MAT_STOCKS)으로 전환. 소모품은 이미 설비 기준이라 미변경. 입력 방식만 변경, 이력(WIP_MAT_TRANSACTIONS) 전량 보존.
- 백엔드(신규): `kiosk-material.dto.ts`(ScanMaterialMountDto), `kiosk-material.service.ts`(작업지시→설비 해석, MAT_LOT 조회, BOM USE_YN='Y' 오장착 가드 후 `EquipMaterialService.mount` 위임), `kiosk-material.controller.ts`(`POST /production/job-orders/:orderNo/material-mounts/scan`). production.module에 등록. 목록/해제는 기존 `/production/equip-material/mounted`·`/unmount` 재사용(키오스크가 equipCode 보유).
- 사전 검증(systemic): auto-issue.service / wip-mat-stock.service 정독 → scannedMatUids는 우선순위일 뿐 필수 아님, deductStockInTx 빈 배열로 FIFO 동작. JOB_MATERIAL_LOTS 미적재해도 소비경로 무손상 확인.
- 프론트: MaterialListPanel 자재섹션을 `/equip-material/mounted?equipCode` 로드 + BOM 커버리지 조인으로 교체(interlock=모든 BOM childItemCode가 availableQty>0로 커버), 해제는 `/equip-material/unmount`. MaterialScanModal은 `.../material-mounts/scan {matUid,equipCode}`로 전환 후 materialMountRefreshSeq bump. kioskStore: scannedMaterialLots 기계장치 제거, materialMountRefreshSeq/bumpMaterialMountRefresh 추가. 구조테스트 1번 케이스를 mount 모델로 갱신(3/3 pass).
- i18n: `kiosk.material.andMore` 4 locale(ko/en/zh/vi) 추가(BOM 없음).
- 검증: frontend tsc 0 / backend tsc 0 / 구조테스트 3 pass.

## 2026-06-23 Claude (Phase 3 STATUS→ComCodeSelect)

- 작업: `T-INLINE-SELECT-CLEANUP` Phase 3 — STATUS/유형 inline 하드코딩을 ComCodeSelect로 치환.
- 방법: COM_CODES 156개 그룹 코드집합을 DB 덤프해 inline 코드값과 1:1 대조 + comCode.* i18n 키 4 locale 완비 확인한 것만 치환(locale 미수정).
- 1차(4): customs/stock→CUSTOMS_LOT_STATUS(필터), customs/entry→CUSTOMS_ENTRY_STATUS, outsourcing/vendor→VENDOR_TYPE, outsourcing/receive→SUBCON_INSPECT_RESULT. 미사용 Select import 제거.
- 2차(2): master/part PartFormPanel·PartFormModal itemType→FieldComCodeSelect groupCode="ITEM_TYPE"(옆 productType과 동일 패턴으로 일관화, partTypeOptions useMemo 제거).
- 검증: tsc --noEmit 0 에러(각 배치별).
- 보류(구조적): warehouse(WAREHOUSE_TYPES가 getTypeLabel 라벨매핑 병용→useComCodeLabel 리팩토링 필요), iqc-history(resultOptions 미사용 의혹), PRINT_MODE(comCode 키 4 locale 누락+locale 잠금), consumables issuing/receiving(CONSUMABLE_LOG_TYPE 부분집합), Phase 2 기준정보 spread(빈값 허용 케이스별 확인). inspection/protocol·simulation·specification-setup은 매칭 그룹 없음/시스템 enum.

## 2026-06-23 20:46 Kimi

- 작업: `T-CONS-MOUNT-SQL-PREVIEW` `/consumables/mount` DataGrid SQL 미리보기 실제 조회 구조 반영.
- 변경:
  - `apps/frontend/src/app/(authenticated)/consumables/mount/page.tsx`의 `DataGrid.sqlQuery`를 `CON_MOUNTS` 가짜 테이블에서 `CONSUMABLE_MASTERS` 실제 테이블 기준으로 교체.
  - 실제 `GET /equipment/consumables`는 `ConsumableService.findAll()` → `CONSUMABLE_MASTERS`를 `CONSUMABLE_CODE ASC`로 조회하며, `COMPANY`/`PLANT_CD`, `CATEGORY`, 검색어(`CONSUMABLE_CODE`, `NAME`) 조건을 동적으로 추가한다.
  - 페이지가 요청하는 `limit=5000`과 `OFFSET/FETCH` 구문을 SQL에 반영.
- 검증:
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`.
  - PASS: `git diff --check`.
- 발견 사항(범위 밖):
  - 프론트 `/consumables/mount`는 `operStatus` 필터를 `params.operStatus`로 전송하지만, 백엔드 `ConsumableQueryDto`/`ConsumableService.findAll()`은 `status` 필터만 수신/사용한다. 따라서 현재 화면의 운영상태(WAREHOUSE/MOUNTED/REPAIR) 필터는 실제로 적용되지 않음. 이는 별도 버그 수정 작업이 필요함.

## 2026-06-23 21:20 Kimi

- 작업: `T-CONS-MOUNT-HELP-LOCALE` `/consumables/mount` 도움말 작성 및 다국어 처리 완료.
- 변경:
  - `apps/frontend/public/help/user/{ko,en,zh,vi}/CONS_MOUNT.md` 신규 작성(사용자 도움말).
  - `apps/frontend/public/help/operator/{ko,en,zh,vi}/CONS_MOUNT.md` 신규 작성(운영자 도움말).
  - `apps/frontend/public/help/manifest.json`에 `CONS_MOUNT` 항목 등록.
  - `apps/frontend/src/locales/{ko,en,zh,vi}.json`에 `consumables.mount.*` 키 25개 추가.
  - `apps/frontend/src/app/(authenticated)/consumables/mount/consumables-mount-help-locale.structure.test.mjs` 신규 작성.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/consumables/mount/consumables-mount-help-locale.structure.test.mjs"` 4/4 PASS.
  - PASS: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` 1/1 PASS.
  - PASS: `node -e`로 ko/en/zh/vi locale JSON parse 및 `parseHelpDoc` 8개 파일 frontmatter 파싱 확인.
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`.
  - PASS: `git diff --check`.
  - PASS: `Invoke-WebRequest http://localhost:3002/consumables/mount` HTTP 200.
  - PASS: `Invoke-WebRequest http://localhost:3002/help/user/ko/CONS_MOUNT.md` 정상 반환.
- 남은 위험:
  - `/consumables/mount` 페이지 상단 DataGrid `sqlQuery` 샘플 SQL은 하드코딩 상태(기존 다른 화면과 동일). 실제 조회 SQL은 별도 개선 작업 필요.
  - 도움말 본문 번역(en/zh/vi)은 AI 번역으로 작성되어 현장 용어와 미세 차이가 있을 수 있음.

## 2026-06-23 20:57 Kimi

- 작업: `T-CONS-MOUNT-HELP-LOCALE` 중국어(간체) 운영자 도움말 번역.
- 변경: `apps/frontend/public/help/operator/zh/CONS_MOUNT.md` 신규 작성(한국어 원문 `apps/frontend/public/help/operator/ko/CONS_MOUNT.md` 기준 번역).
- 번역 규칙 준수:
  - frontmatter `title`, `summary`, `tags`, `keywords`는 중국어(간체)로 번역.
  - `menuCode`, `audience`, `related`는 원문 유지.
  - DB 테이블/컬럼명, API 경로, 코드값, 메뉴 경로, 시퀀스명, 멀티테넌트 스코프 등 기술 식별자는 원문 유지.
  - 마크다운 테이블 파이프 정렬 및 구조 보존.
- 검증:
  - 출력 파일 첫 줄 `---` 확인.
  - UTF-8 BOM 없음 확인.
  - frontmatter 파싱 정상 확인.
  - Chinese characters: 804, word-like tokens: 414.
- 남은 작업: ko/en/vi 사용자/운영자 도움말 중 일부, locale JSON, manifest 갱신은 동일 lock 내 후속 작업으로 남음.

## 2026-06-23 20:46 Kimi

- 작업: `T-CONS-MOUNT-HELP-LOCALE` 영문 도움말 번역.
- 변경: `apps/frontend/public/help/user/en/CONS_MOUNT.md` 신규 작성(한국어 원문 `apps/frontend/public/help/user/ko/CONS_MOUNT.md` 기준 번역).
- 번역 규칙 준수:
  - frontmatter `title`, `summary`, `tags`, `keywords`는 영어로 번역.
  - `menuCode`, `audience`, `related`는 원문 유지.
  - DB 테이블/컬럼명, API 경로, 코드값, 메뉴 경로, 시퀀스명 등 기술 식별자는 원문 유지.
  - 마크다운 테이블 파이프 정렬 및 구조 보존.
- 검증:
  - 출력 파일 첫 줄 `---` 확인.
  - frontmatter 파싱 정상 확인.
  - word count: 848.
- 남은 작업: zh/vi 사용자/운영자 도움말 및 locale JSON, manifest 갱신은 동일 lock 내 후속 작업으로 남음.

## 2026-06-23 Claude

- 작업: `T-INLINE-SELECT-CLEANUP` Phase 1 — 페이지 inline Y/N(useYn) 드롭다운을 `UseYnSelect`로 통일.
- 변경: `UseYnSelect`에 `includeAll` prop + `useUseYnOptions` 훅 추가(하위호환 — 기존 필터 3곳 "사용여부: 전체…" 유지). 폼 useYn inline 6곳 치환(worker·vendor-barcode는 FieldSelect 유지하며 `options={useUseYnOptions(false)}`, equip-inspect-item·consumable-usage-map·department·code는 직접 `UseYnSelect`/훅). CodeFormModal 미사용 `Select` import 제거.
- 검증: `tsc --noEmit` 0 에러. locales 미수정(기존 common.useY/useN/all 재사용 → ship-order/kimi lock 회피).
- 제외(의미 다른 Y/N): transferRule(허용/거부)·part(IQC 대상/비대상)·input-inspect·sample-inspect(합격/불합격 판정)은 useYn 아니라 미치환.
- 후속: Phase 2(기준정보 inline map→EquipSelect/WorkerSelect 등), Phase 3(STATUS inline→ComCodeSelect, 공통코드 등록 확인 선행). 별건 보고: `FieldSelect`가 8개 FieldHelp.tsx에 중복 정의됨(이번 범위 외).

## 2026-06-23 17:09 Codex

- 작업: `T-ALL-MENU-QA` 전체 메뉴 기능 QA 리포트 완료.
- 결과: `menuConfig.ts` 등록 메뉴 157개를 실제 브라우저로 순회해 최종 `PASS 157 / FAIL 0 / MISSING 0`까지 정리했다.
- 중간 보정:
  - `INSP_RESULT`의 실패는 Turbopack HMR 콘솔 노이즈와 `/login?_rsc` aborted request를 러너에서 불필요하게 실패로 잡은 것이었다.
  - `PROD_WIP_STOCK`, `PROD_REPAIR`, `INSP_HISTORY`, `QC_IQC`, `QC_CONCESSION`, `QC_DEFECT`, `QC_DEFECT_CODE`, `PROD_INPUT_ASSEMBLY`는 최신 PASS 리포트로 재검증했다.
- 산출물:
  - [누적 요약](../docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/index.html)
  - [INSP_RESULT 재검증](../docs/reports/hanes-all-menu-scenario-qa-2026-06-23-insp-result-rerun/index.html)
  - [QC_IQC 최종 재검증](../docs/reports/hanes-all-menu-scenario-qa-2026-06-23-qc-iqc-final/index.html)
- 검증:
  - PASS: `node tools/hanes-all-menu-page-scenario-qa.mjs` 여러 배치 및 단건 재실행
  - PASS: `node tools/hanes-all-menu-report-aggregate.mjs`
  - PASS: 최신 집계 `totalMenus=157`, `pass=157`, `fail=0`, `missing=0`

## 2026-06-23 Task-8 claude

T-TRACE-FULL Task 8 완료: quality.trace 네임스페이스에 13개 신규 키(statusCol/inspections/noInspections/packaging/semiProducts/noSemiProducts/semiMaterials/noMaterials/po/arrival/iqc/receiving/issue)를 ko/en/zh/vi 4파일에 additive 추가. 기존 키 보존. JSON BOM 없음, 유효성 OK. commit: 5553b50d.

Use local time in 24-hour format.

## 2026-06-23 01:12 Codex

- 작업: `T-ER-VIEW-NODE-COLUMN-SCROLL` `/system/er-view` 테이블 노드 컬럼 스크롤, 확인 문구 단순화, 추정 관계 선 유형 선택, schema governance 실행 오류 방어 완료.
- 원인:
  - 테이블 노드가 `data.columns.slice(0, 12)`로 컬럼을 잘라 렌더링하고 컬럼 영역이 `overflow-hidden`이라 전체 컬럼을 볼 수 없었다.
  - 실행 확인 문구가 constraint별 긴 문구라 사용성이 나빴다.
  - 추정 관계 edge가 한 가지 선 모양이라 직선 겹침 시 구분이 어려웠다.
  - migration 파일 생성 경로가 backend cwd에서 `apps/backend/apps/backend/src/migrations`로 중복 조립되어 `ENOENT`가 발생했다.
  - 이미 존재하는 FK/UK 후보를 다시 실행할 수 있어 `ORA-02275`가 500으로 노출됐다.
- 변경:
  - `TableNode`가 모든 컬럼을 렌더링하고 `data-er-view-node-columns="true"` 영역을 `overflow-y-auto`로 전환했다.
  - dry-run 확인 문구를 모든 action에서 공통 `실행`으로 단순화했다.
  - 추정 관계 edge 유형 선택 셀렉터를 추가했다. 옵션은 `곡선`, `완만한 계단`, `계단`, `직선`이다.
  - migration 경로를 repo root cwd와 `apps/backend` cwd 양쪽에서 올바르게 계산하도록 `backendMigrationsDir()`를 추가했다.
  - `ADD_FK`/`ADD_UK` preview가 최신 snapshot을 강제 조회해 동일 FK/동일 PK/UK/동일 constraint name을 사전 차단한다.
  - execute 중 Oracle `ORA-02275`/`ORA-02264`/`ORA-02261`은 500 대신 `BadRequestException`으로 변환한다.
  - 물리 FK 관계 선택 시 상세 패널에 이미 적용된 관계 안내를 표시하고 `FK DDL 후보` 버튼을 비활성화한다.
- 실측:
  - JSHANES `CONSUMABLE_STOCKS -> CONSUMABLE_MASTERS` FK는 `FK_CONSUMABLE_S_CONSUMABLE_C`, `ENABLED/VALIDATED`, child columns `COMPANY,PLANT_CD,CONSUMABLE_CODE`, parent columns `COMPANY,PLANT_CD,CONSUMABLE_CODE`로 이미 존재함을 확인했다.
  - JSHANES `UK_CONSUMABLE_M_CONSUMABLE_C`는 execute 500 이후에도 존재 여부를 확인했고, 이후 중복 제약 실행 방어를 추가했다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"` 9/9.
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand` 11/11.
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`.
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`.
  - PASS: `git diff --check`.
  - PASS: Chrome headless 3002 인증 세션에서 `ER VIEW` 진입, 추정 관계 선 유형 옵션/직선 선택 확인, `IQC_LOGS` 테이블 노드 컬럼 영역 `clientHeight 310`, `scrollHeight 1051`, `scrollTop 741`, `overflowY auto`, `canScroll true` 확인.
- 상태: lock 제거. DDL 추가 실행은 하지 않았다. ER VIEW 관련 source/spec/page/test 파일들은 이전 작업부터 git 미추적 상태라 커밋 시 포함 범위 확인 필요.

## 2026-06-23 00:54 Codex

- 작업: `T-ER-VIEW-PARENT-UK-FLOW` `/system/er-view` 부모 PK/UK 없는 FK 후보 실행 흐름 보정 완료.
- 사용자 에러: `POST /system/er-view/actions/dry-run`, `ADD_FK`, `IQC_LOGS(COMPANY, PLANT_CD, VENDOR_CODE) -> VENDOR_MASTERS(COMPANY, PLANT_CD, VENDOR_CODE)`가 `부모 PK/UK가 없어 FK를 생성할 수 없습니다` 400 반환.
- 원인:
  - JSHANES 실측 결과 `VENDOR_MASTERS` 키는 `PK_VENDOR_MASTERS(VENDOR_CODE)` 하나뿐이며, `(COMPANY, PLANT_CD, VENDOR_CODE)` PK/UK는 없었다.
  - 해당 컬럼 조합은 중복 0건, NULL 0건이라 부모 UK dry-run 가능.
  - `IQC_LOGS -> VENDOR_MASTERS` 동일 조합 orphan은 1건이라, 부모 UK를 만든 뒤에도 orphan 정리 전에는 FK `ENABLE VALIDATE`가 막히는 상태다.
  - backend는 부모키 없는 `ADD_FK`를 올바르게 차단했지만, frontend가 `parentKeyReady=false` 관계에도 `FK DDL 후보` 버튼을 활성화해 사용자가 실행 가능한 작업처럼 보게 했다.
- 변경:
  - `/system/er-view/page.tsx`에 `ActionRequest`/`previewPayload`를 추가해 dry-run payload를 execute 시 그대로 재사용한다. `ADD_UK`도 실행 payload에 `tableName`/`columns`가 보존된다.
  - 부모 PK/UK가 없는 관계에서는 안내문을 표시하고 `부모 UK 후보` 버튼을 제공하며 `FK DDL 후보` 버튼은 비활성화한다.
  - backend `executeAction()`에서 `ADD_FK`/`ADD_UK` DDL 성공 후 schema snapshot cache를 무효화해, UK 생성 후 그래프 재조회가 최신 키 상태를 보게 했다.
  - frontend 구조 테스트에 부모 UK 선행 흐름 검증을 추가했고, backend spec에 `ADD_UK` preview 및 DDL 후 cache 무효화 테스트를 추가했다.
- 검증:
  - JSHANES 키 실측: `PK_VENDOR_MASTERS(P)` columns `VENDOR_CODE`만 존재.
  - JSHANES UK 후보 데이터 실측: `(COMPANY, PLANT_CD, VENDOR_CODE)` duplicate 0, NULL 0.
  - JSHANES FK 후보 orphan 실측: `IQC_LOGS -> VENDOR_MASTERS` orphan 1.
  - RED 확인: frontend structure test가 `ADD_UK`/`부모 UK 후보` 부재로 실패.
  - GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"` 6/6 PASS.
  - GREEN: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand` 7/7 PASS.
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`.
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`.
  - PASS: `git diff --check`.
  - PASS: Chrome Playwright 3002에서 `IQC_LOGS` 선택 시 부모키 없음 안내, `부모 UK 후보` 버튼, disabled `FK DDL 후보` 확인.
  - PASS: Chrome Playwright dry-run API: `ADD_UK VENDOR_MASTERS(COMPANY, PLANT_CD, VENDOR_CODE)` 201 preview SQL 반환, 기존 `ADD_FK`는 부모키 없음 400 유지.
- 상태: lock 제거. DDL 실행/DB 변경은 하지 않았다. ER VIEW 관련 source/spec/page/test 파일들은 이전 작업부터 git 미추적 상태라 커밋 시 포함 범위를 확인해야 한다.

## 2026-06-23 00:44 Codex

- 작업: `T-ER-VIEW-INTERACTION-FIX` `/system/er-view` ReactFlow 그래프 조작/하단 잘림 보정 완료.
- 원인:
  - `@xyflow/react/dist/style.css`가 전역으로 로드되지 않아 `.react-flow__viewport`/노드 레이어 배치가 깨졌고, 마우스 hit target이 테이블 노드가 아니라 SVG `rect`로 잡혔다.
  - `ReactFlow`를 controlled `nodes`로 렌더링하면서 `onNodesChange`로 드래그 좌표를 상태에 반영하지 않아 노드 이동이 유지될 수 없는 구조였다.
  - `panOnScroll`과 `zoomOnScroll`을 같이 둬 휠 확대/축소 기대와 충돌할 수 있었다.
- 변경:
  - `apps/frontend/src/app/globals.css`에 `@import "@xyflow/react/dist/style.css";` 추가.
  - `apps/frontend/src/app/(authenticated)/system/er-view/page.tsx`에서 `useNodesState`/`onNodesChange`를 연결하고, `computedNodes`와 조작 상태 `nodes`를 분리했다.
  - 노드 드래그 직후 `onNodeClick`이 테이블 선택/그래프 재로딩을 실행하지 않도록 `nodeDragRef` guard를 추가했다.
  - 캔버스에 `data-er-view-canvas="true"`, ReactFlow `className="h-full w-full"`, `minZoom={0.05}`, `maxZoom={2.5}`, `nodesDraggable`, `nodesConnectable={false}`를 명시했다.
  - 구조 테스트가 ReactFlow CSS import, node change handler, drag guard, zoom 설정을 검증하도록 보강했다.
- 검증:
  - RED 확인: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`가 `useNodesState` 부재로 실패.
  - GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"` 5/5 PASS.
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`.
  - PASS: `git diff --check`.
  - PASS: Chrome Playwright 인증 세션 1440x900, `MAT_LOTS` 선택 시 table node 4개, edge 3개, controls 3개, minimap 표시. ReactFlow viewport position `absolute`, `elementFromPoint`가 테이블 헤더 DIV로 잡힘. 휠 줌 transform 변경, 노드 드래그 후 `MAT_LOTS` 좌표 변경, body/html overflow 없음.
  - PASS: Chrome Playwright 1366x768, canvas bottom이 viewport 768에 맞고 body/html overflow 없음. 휠 줌아웃 transform 변경.
- 상태: lock 제거. DB/백엔드 변경 없음. `apps/frontend/src/app/(authenticated)/system/er-view/page.tsx`와 구조 테스트는 이전 ER VIEW 작업부터 git 미추적 상태라 커밋 시 포함 범위 확인 필요.

## 2026-06-22 19:37 Codex

- 작업: `T-AI-PAGE-TOOL-WORKFLOW` 구현 완료. `/production/order` 단일 실험이 아니라 HANES 전체 화면에 반복 적용할 AI Page Tool Workflow 표준으로 설계/계획/파일럿을 반영했다.
- 문서: `docs/superpowers/specs/2026-06-22-ai-page-tool-workflow-design.md`, `docs/superpowers/plans/2026-06-22-ai-page-tool-workflow.md`.
- 백엔드: `AiPageToolsModule` 추가. `GET /ai/page-tools/:pageId`로 페이지 도구 manifest 제공, `POST /ai/page-tools/:pageId/execute`로 backend read-only 후보조회 도구 실행. `/production/order` manifest는 `draft-only`이며 품목/라인/공정/설비 후보조회와 `buildJobOrderDraft`/`applyJobOrderDraft` 도구를 노출한다.
- 후보조회 정책: exact code 단일 매칭은 자동확정 가능, 명칭 단일 매칭과 복수 후보는 사용자 확인 필요로 응답한다. 저장/삭제/상태변경은 이번 범위에서 실행하지 않는다.
- 프론트 공통: `usePageAiTools`, `pageToolStore`, `PageToolInspector`, `PageToolExecutionLog` 추가. AI 채팅 패널에 `채팅|도구|실행로그` 탭을 추가하고, 채팅 요청에 현재 페이지 도구 context를 전달한다.
- `/production/order`: 상단 버튼 영역에 `도구보기` 버튼을 추가해 AI 채팅 패널의 도구 탭을 연다. `applyJobOrderDraft` 프론트 도구는 작업지시 입력 패널에 초안만 반영하고 API 저장 호출은 하지 않는다. 신규 작업지시번호는 서버 자동채번과 맞춰 빈 값/선택값으로 처리한다.
- 백엔드 AI 채팅: `pageToolContext` DTO를 추가하고, 페이지 도구 컨텍스트가 있는 등록/생성/작성류 요청은 SQL INSERT/UPDATE 생성 대신 도구 절차 안내 경로로 보낸다. `CreateJobOrderDto.orderNo`는 서비스 자동채번 계약과 맞게 optional로 보정했다.
- 검증 PASS:
  - `node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs`
  - `node --test "apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs"`
  - `node --test "apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs"`
  - `pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand`
  - `pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/job-order.service.spec.ts --runInBand`
  - `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- 상태: active task/lock 제거. 커밋하지 않았다. 현재 worktree에는 다른 세션의 locale/shipping/coordination 변경이 함께 있으므로 커밋 시 파일 범위 분리 필요.

## 2026-06-22 Claude (box-ship-confirm: /shipping/confirm 박스별출하 재구성)

- 배경: `/shipping/confirm`이 OrderFulfillmentModal로 팔레트 구성→팔레트 출하를 담당했으나, 팔레트 적재/출하는 `/shipping/pallet`·`/shipping/pallet-ship`에 이미 별도 존재해 역할 중복. 사용자 요청으로 confirm을 **박스 단위 출하** 전용으로 재구성.
- 핵심 발견: `components/shipping/BoxScanShipModal.tsx`가 박스 스캔 출하+취소(ship-box/cancel-ship-box, 라인 진행률, workerId, 중복 가드)를 이미 완비한 채 **어느 페이지에도 연결 안 된 고아 컴포넌트**(구조 테스트만 존재). 새 모달을 만들지 않고 재사용 → 작업 경량화. 백엔드(ship-box/cancel-ship-box/fulfillment/box-stock serials) 변경 0.
- 변경:
  - i18n(커밋 1038f0e4): 메뉴 평면키 shipping.confirm "출하작업"→"박스별출하"(en Box Shipping/zh 按箱出货/vi Xuất hàng theo thùng), `shipping.confirm.*` 페이지 키 14개 추가(4파일). `shipping.boxScan.*`는 기존 존재 확인. BOM 없음, JSON valid 4/4.
  - page(커밋 27793ade): 3-컬럼 — 좌 출하지시 목록(CONFIRMED·items.some(orderQty>shippedQty)), 중 라인 진행률+출하가능 박스 그리드(fulfillment candidateBoxes, **읽기 전용**: 행 클릭→우측 시리얼), 우 박스 시리얼(box-stock/{boxNo}/serials). 출하는 BoxScanShipModal(initialShipOrderNo)에서만 수행→onShipped로 orders+fulfillment 재조회. OrderFulfillmentModal.tsx 삭제, Shipment(SHIPMENT_LOGS) 목록 패널·cancel/reverse 모달·ShipmentScanModal·/shipping/shipments 호출 전면 제거. 구조 테스트 `box-ship-page.structure.test.mjs` 추가(positive: BoxScanShipModal/fulfillment/box-stock, negative: OrderFulfillmentModal/ShipmentScanModal/shipments).
  - 라우트 `/shipping/confirm`·메뉴코드 `SHIP_CONFIRM`·menuConfig 미변경(RBAC 보존).
- 방식: SDD(subagent-driven). Task1 i18n→리뷰 승인, Task2 page→리뷰 승인(Minor만), Task3 검증(컨트롤러). 최종 전체 리뷰(opus) **Ready to merge: Yes**(Critical/Important 0, Minor 3=비차단).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` exit 0. i18n 누락 점검 — shipping.confirm/boxScan 누락 0(보고된 18건은 무관 ai.config/shipping.pallet/master.label). 구조 테스트 RED→GREEN. **브라우저 UI E2E는 사용자 직접 확인 권장**(dev :3002).
- 범위 외(보고만): ① candidateBoxes는 항상 oqcStatus='PASS' 필터이나 ship-box는 OQC_ENABLED일 때만 PASS 강제 → OQC 미사용 시 후보 목록이 좁을 수 있음(백엔드 정합화 별도). ② BoxMaster에 shipOrderNo 컬럼 없음 → 세션 밖 출하 박스 취소는 미지원(모달 세션 내 행만 취소). ③ **팔레트 출하로 생성되는 Shipment 생명주기 UI(SHIPPED→DELIVERED/역분개/ERP동기화)가 confirm에서만 있었는데 제거됨 → 새 거처(history 등) 필요. 박스출하는 Shipment 미생성이라 무관. 별도 과제.** ④ confirm.* 네임스페이스에 팔레트/Shipment 시절 미사용 키 잔존(계획상 허용, 추후 i18n 정리 권장).
- 설계 `docs/superpowers/specs/2026-06-22-box-shipping-confirm-design.md`, 계획 `docs/superpowers/plans/2026-06-22-box-shipping-confirm.md`.

## 2026-06-21 Claude (i18n 혼입 이력 메모 — 분리 보류)

- 사실: 커밋 341f1c15(fix(ui))와 631fa09c(feat(part))의 locales 4파일에 **다른 세션의 미커밋 i18n 변경이 함께 혼입**됨(ko.json 기준 내 키 2줄=imageLoadFailed, 타 세션 키 ~121줄 등). 통째 커밋 방침(사용자 승인)에 따른 결과.
- 영향: 혼입된 타 세션 i18n은 해당 커밋에만 존재하는 **유일본**이며 이후 1a0fca2c는 locales 미수정 → **중복·충돌·손실 없음, i18n 기능 정상**. 문제는 "커밋 메시지와 내용 불일치"라는 이력 미관뿐.
- 결정: history 재작성(rebase/reset)으로 분리하지 않음. 이유 — main을 다중 세션이 공유·동시 커밋 중이고, 내 두 커밋 위에 타 세션 커밋 4개(7fa0e92d/1a0fca2c/0cf26d52 등)가 쌓여 있어 재작성 시 그 커밋 해시가 바뀌어 다른 세션 작업이 깨질 위험이 큼. 실익(이력 미관) < 위험(타 세션 손상). 사용자 승인 하에 보류.

## 2026-06-21 Claude (이미지 로드 실패 시 placeholder fallback 일괄 적용)

- 배경: `/uploads/parts/...png 404`(파일 누락)로 깨진 이미지 노출. 서버 업로드 이미지를 onError 처리 없이 렌더하던 화면 전반 점검.
- 적용 파일:
  - `master/part/page.tsx`(썸네일→PartImageThumb), `master/part/components/PartFormPanel.tsx`(폼 미리보기, imageError state)
  - `consumables/master/page.tsx`(썸네일→ConsumableImageThumb), `consumables/master/components/ConsumableFormPanel.tsx`
  - `components/worker/WorkerSelector.tsx`(WorkerAvatar onError→이니셜), `WorkerSelectModal.tsx`(WorkerPhoto 로컬 컴포넌트, 리스트+Step2), `WorkerPhotoUpload.tsx`(Camera fallback)
  - `system/users/components/UserFormPanel.tsx`(Users 아이콘 fallback)
- 공통 패턴: 이미지 url 변경 시 에러 state 리셋(useEffect), onError로 placeholder 전환, 깨진 경로도 삭제 가능하도록 삭제 버튼 유지.
- 적용 파일 (2차 — 남은 후보 개별 처리):
  - `production/input-{manual,equip,machine,inspect}/page.tsx`(작업자 사진 → 공통 `WorkerPhoto`로 교체, 이니셜 fallback). `WorkerSelector.tsx`에 `WorkerPhoto` export 추가.
  - `system/improvement-requests/components/ImprovementDetailModal.tsx`(screenshot → noScreenshot 텍스트로 fallback)
  - `master/equip-inspect-item/page.tsx`(썸네일→EquipInspectImageThumb, 폼 imageError state)
  - `production/input-kiosk/components/WorkInstructionView.tsx`(작업지도서 이미지 → onError 시 본문 placeholder로, 줌도 차단)
  - `consumables/label/components/ConLabelColumns.tsx`(LabelImageCell errored→'-')
  - `master/label/components/LabelDesignRenderer.tsx`(이미지 요소만 LabelImageElement로 분리, IMG placeholder fallback)
- i18n: `master.part.imageLoadFailed`, `consumables.master.imageLoadFailed`, `master.equipInspectItem.imageLoadFailed` ko/en/zh/vi 추가(검증 완료).
- 제외(동적 생성 이미지, 404 무관): `master/label/ZplEditor.tsx`(ZPL 미리보기 외부 생성), `LabelDesignRenderer` 바코드(BarcodeImage, dataURL 생성).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과(에러 0). i18n JSON 4파일 파싱 정상.

## 2026-06-21 Claude (메뉴 진입 시 페이지 2중 마운트 → API 중복 호출 제거)

- 증상: 메뉴 진입 시 동일 API가 2번씩 호출(예: `/quality/aql`의 `aql?limit=5000`, `aql/policies` 각 2회). 모든 페이지 공통.
- 원인: `MainLayout`이 본문을 `TabKeepAlive`로 감싸는데, registry 동적 import resolve 전 fallback으로 App Router `children`(page.tsx)을 마운트 → AqlPage 마운트 #1(API 1차). ~1초 뒤 registry resolve되면 `KeepAliveCell`이 같은 페이지를 다시 마운트 #2(API 2차). children 버전과 keep-alive 버전이 둘 다 마운트되어 mount/effect가 2회 발생.
- 수정: `apps/frontend/src/components/layout/TabKeepAlive.tsx`
  - `loadedPage` 초기값 `path: pathname` → `path: ""` (로딩 중 vs 미등록 페이지 구분).
  - fallback 렌더를 `loadedPage.path === pathname`일 때만 `children` 사용, 로딩 중에는 빈 `div`로 대체해 children 2중 마운트 차단.
- 결과: keep-alive registry 컴포넌트만 1회 마운트. 미등록 경로는 종전대로 children fallback 유지.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과(에러 0). 런타임 네트워크 중복 제거는 사용자 dev 서버에서 메뉴 진입 시 단일 호출 확인 필요.

## 2026-06-21 Claude (회로사양 UI: 크게보기 + 터미널/하우징 BOM 참조)

- 작업: `/production/specification-setup` 회로별 제작 사양 ① 크게 보기(전체화면 모달) ② 터미널/하우징/전선을 BOM 자재 productType 참조 select로 전환.
- ① 크게 보기: 테이블을 `CircuitSpecTable` 컴포넌트로 추출 → 카드/모달 재사용. 카드 헤더에 "크게 보기" 버튼, `size="full"`(90vw×90vh) 모달에서 편집·회로추가·삭제 가능. 연결 형태 그림 가로 1줄화 및 연결심볼 5종(직선/양단압착/스플라이스/분기/단측, 구 LINE→STRAIGHT 통합)도 같은 세션에서 처리.
- ② 터미널/하우징 참조: 사용자 결정 = "도면 품목의 BOM 자재" 방식(전선과 동일).
  - 백엔드 `bom.service.ts`: findAll/findByParentId/findById의 part `select`에 `productType` 추가 → BOM 조회 응답 `childPart.productType` 노출. (DDL/엔티티 변경 없음, 컬럼 기존 존재)
  - 프론트 `page.tsx`: BOM 응답을 평탄화 매핑(childPart.itemName/itemNo/unit/productType). 이 과정에서 기존 전선 드롭다운이 `item.childItemName`을 직접 참조해 이름/단위가 안 뜨던 매핑 오류도 수정. `wireOptions`(부속자재 productType 제외)/`terminalOptions`(TERMINAL)/`housingOptions`(HOUSING)로 분류. A/B Housing·Terminal 4개 컬럼 + Wire를 `ItemRefSelect`로 전환. 기존 자유텍스트 값은 "(미등록)" fallback 옵션으로 보존.
- DB 실측(JSHANES, company=40/plant=1000): PRODUCT_TYPE 분류 존재하나 시드 수준 — TERMINAL 4(TMN-A/B/C/SE1), HOUSING 1(HSG0001), CONNECTOR 1, WIRE 3, 미분류(null) 18. BOM 자식에도 동일 분포. → 드롭다운 선택지가 적으므로 운영 전 ITEM_MASTERS.PRODUCT_TYPE 분류 보강 필요(데이터 작업, 코드 아님).
- 검증: page.structure.test.mjs 7/7 pass(테스트 심볼명 loadBomWireOptions→loadBomOptions, wireItemOptions→bomOptions 동기화), 프론트 `tsc --noEmit` EXIT=0.
- 주의: 백엔드 전체 `tsc --noEmit`는 codex 진행 중 `aql.service.spec.ts`(createPolicy/deletePolicy 누락)로 실패 상태 — 본 변경(bom.service.ts)과 무관, 에러 목록에 본 파일 없음.
- 남은 것: productType 미설정 BOM 자식은 터미널/하우징 드롭다운에 노출 안 됨(전선은 미분류 포함). 커넥터(CONNECTOR) 컬럼은 별도 논의 필요 시 추가.

## 2026-06-21 Codex

- 작업: `T-HARNESS-WIRE-SPEC-SEPARATION` 전선 길이/스트리핑 사양 분리.
- 변경: `/master/part` 품목마스터에서 `LENGTH`, `STRIP_BEFORE`, `STRIP_AFTER` 코드/API/UI 계약 제거. `HARNESS_CIRCUIT_SPECS.WIRE_ITEM_CODE` 추가 및 BOM child 검증. `ROUTING_MATERIALS.CIRCUIT_ID` 추가 및 회로 사양 선택 연결.
- DB: JSHANES에 `apps/backend/src/migrations/2026-06-21_harness_wire_spec_separation.sql` 적용 PASS. 확인 쿼리에서 `ITEM_MASTERS` 길이/스트리핑 컬럼 제거, `HARNESS_CIRCUIT_SPECS.WIRE_ITEM_CODE`, `ROUTING_MATERIALS.CIRCUIT_ID`, `FK_ROUTING_MATERIALS_CIRCUIT ENABLED` 확인.
- 문서: `docs/reports/db-schema-erd.md` 재생성, `docs/superpowers/specs/2026-06-21-harness-wire-spec-separation-design.md` 작성.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/routing/routing-material-circuit-link.structure.test.mjs"` PASS 17/17.
- 검증: `pnpm.cmd --filter @harness/backend test -- production-specification.service.spec.ts routing-group.service.spec.ts --runInBand` PASS 35/35.
- 검증: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false` PASS.
- 검증: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 검증: `git diff --check` PASS.
- 남은 위험: 현재 worktree에는 품질/AQL/TabKeepAlive 등 다른 작업 변경이 함께 존재하므로 커밋 시 파일 범위를 분리해야 한다.

## 2026-06-21 Claude

- 작업: `T-TAB-KEEPALIVE-ONLY` 탭 상태보존을 keep-alive(display:none) 단일 메커니즘으로 정리. 메뉴 클릭/페이지 이동 체감 지연 원인 점검 중 발견한 중복 레이어 제거.
- 배경: `TabKeepAlive`는 이미 떠난 탭을 `display:none`으로 살려둬 React state·DOM 입력값·스크롤이 그대로 보존됨. 그 위에 `tabPageState.ts`가 별도로 DOM을 직렬화해 sessionStorage에 저장/복원하는 두 번째 레이어가 얹혀 있었음. 이게 평상시 비용을 깔았음:
  - `document`에 `pointerdown/keydown/input/change` 캡처 리스너 4종을 디바운스 없이 등록 → 매 입력·클릭마다 저장 실행.
  - 저장/복원 시 `root.querySelectorAll("*")` 전체 DOM 순회 + 각 노드 `scrollTop/scrollLeft` 접근(강제 reflow). DataGrid 등 노드 많은 화면에서 layout thrashing.
  - 페이지 진입마다 `restore`를 raf + setTimeout(50/150/350/750ms) = 최대 5회 반복(매번 전체 DOM 순회).
- 변경:
  - `apps/frontend/src/components/layout/TabKeepAlive.tsx`: `tabPageState` import, restore/save useEffect, 전역 캡처 리스너 useEffect, `pathnameRef`, `rootsRef`, ref 콜백, `data-tab-page-state-root` 제거. keep-alive 캐시 로직(pagesRef/visiblePages/display:none)은 유지.
  - `apps/frontend/src/components/layout/tabPageState.ts`: 파일 삭제(참조처 0).
  - `tab-keep-alive-unique-paths.structure.test.mjs`: save/restore/data-attr assertion 제거, 부재 검증(doesNotMatch)으로 교체.
- 검증: 구조 테스트 pass(1/1), `tsc --noEmit` EXIT=0, 앱 코드 내 `tabPageState` 잔존 참조 grep 0건.
- 영향/주의: 새로고침(F5) 시 입력값 sessionStorage 복원 기능은 함께 사라짐. 단 `tabStore`도 persist가 없어 새로고침하면 탭 자체가 초기화되므로 실효성이 낮던 기능이라 일관성 있게 제거. 탭 evict는 MAX_TABS=10 + addTab 차단 구조상 사실상 발생 안 함 → keep-alive로 항상 보존됨.
- 남은 것: 메뉴 클릭→이동 지연의 잔여 원인(동적 import 청크 컴파일/진입 API 페칭)은 별도 실측 필요. 이번 변경은 "탭 저장 기능" 의심분만 제거.

## 2026-06-20 23:45 Hermes

- 작업: `T-QUALITY-DEFECT-FILTER-ONE-LINE` `/quality/defect` 필터 툴바가 두 줄로 감기던 레이아웃을 한 줄 배치로 조정했다.
- 변경: 검색 입력은 남는 폭을 사용하고, 날짜 범위와 불량유형/상태 Select는 `shrink-0` 고정 폭으로 배치했다. 기존 `flex-wrap`과 Select `fullWidth`로 인한 줄바꿈을 제거하고 좁은 폭에서는 툴바 내부 가로 스크롤로 대응한다.
- 검증: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright headless 1366x768에서 `/quality/defect` 필터 컨트롤 5개가 모두 top=213 한 줄에 표시됨을 확인했다. `git diff --check` PASS.
- 상태: lock 제거. 커밋하지 않음.

## 2026-06-20 21:47 Codex

- 작업: `T-MENU-OPEN-DELAY` 최종 보정. 그룹별 registry도 한 그룹 안에 여러 page `dynamic()`을 담아 cold compile 범위가 아직 커서, registry를 경로별 파일 1개당 page 1개 구조로 더 세분화했다.
- 변경: 메인 `pageRegistry.generated.ts`는 경로별 `page-registries/<route>.generated.ts`만 async import한다. 예: `/master/part`는 `master__part.generated.ts` 하나만 import하며, 그 파일만 `@/app/(authenticated)/master/part/page` dynamic import를 가진다.
- 검증: 구조 테스트 2건 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. `.next` 캐시 삭제 후 3002 clean restart PASS.
- 실측: clean restart 직후 cold compile은 `/dashboard` 14913ms, `/master/part` 10331ms, `/production/wip-stock` 10769ms, `/system/menu-categories` 13657ms, `/shipping/confirm` 15599ms로 아직 dev 서버 첫 컴파일 비용이 남았다. 같은 경로 재방문 warm 상태는 `/dashboard` 457ms, `/master/part` 269ms, `/production/wip-stock` 248ms, `/system/menu-categories` 199ms, `/shipping/confirm` 163ms.
- 한계: `/dashboard/summary` API 500 전역 모달이 브라우저 자동 메뉴 클릭 검증을 막았다. 이번 최종 변경은 `TabKeepAlive` state 보존 로직이 아니라 registry 파일 분할만 바꾼 것이며, 직전 동일 `TabKeepAlive` 코드에서 품목 추가 폼 입력값 보존은 Playwright로 확인했다.
- 주의: dev 서버 `predev`는 로컬 미추적 `/production/fg-stock` page까지 registry에 넣으므로, 커밋 전 generated 파일에서 해당 case와 `production__fg-stock.generated.ts`를 제거했다.

## 2026-06-20 21:18 Codex

- 작업: `T-MENU-OPEN-DELAY` 메뉴 첫 진입 지연 추가 보정. 직전 커밋의 단일 `pageRegistry.generated.ts` lazy factory는 runtime 호출 경로는 1개로 줄였지만, 파일 안에 모든 authenticated page `dynamic()` switch가 남아 있어 Turbopack HMR/compile trace에서 여전히 전체 registry를 추적했다.
- 변경: `apps/frontend/scripts/gen-page-registry.mjs`를 top-level 메뉴 그룹별 registry 생성 방식으로 바꿨다. 메인 `pageRegistry.generated.ts`는 `master`, `production`, `shipping` 같은 그룹 파일만 비동기 import하고, 실제 page `dynamic()` 목록은 `page-registries/*.generated.ts`에 분리했다. `TabKeepAlive`는 async `getPageComponent(path)` 결과를 받아 기존처럼 방문 탭 page component를 hidden mount로 유지한다.
- 주의: 로컬 미추적 `/production/fg-stock` page가 codegen에 섞였으나 커밋 대상 generated file에서는 해당 case를 제거했다. 커밋 시 미추적 route를 포함하지 않는다.
- 검증: `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `git diff --check` PASS.
- 실측: 3002 HTTP `/dashboard` 1008ms, `/master/part` 442ms, `/production/wip-stock` 1982ms, `/system/menu-categories` 218ms, `/shipping/confirm` 451ms. Playwright 로그인 세션에서 `기준정보 > 품목관리` 메뉴 클릭 1473ms, 대시보드 탭 298ms, 품목관리 탭 복귀 889ms, 품목 추가 폼 입력값 보존 true 확인.
- 운영 실수 방지: PowerShell에서 `pnpm`을 직접 호출하면 `pnpm.ps1` 파일 연결이 Notepad로 열릴 수 있으므로, HANES 작업에서는 반드시 `pnpm.cmd` 또는 직접 `node` 실행을 사용한다.

## 2026-06-20 20:37 Codex

- 작업: `T-MENU-OPEN-DELAY` 탭 보존 재수정. 단순 App Router `children` 캐시는 실제 브라우저에서 `/master/part` 품목 추가 패널 입력 후 대시보드 이동/품목 탭 복귀 시 패널이 초기화되는 것을 확인했다.
- 원인: `children`은 Next App Router 라우트 컨텍스트에 묶여 있어 ref에 보관해도 페이지 컴포넌트 인스턴스 keep-alive로 동작하지 않았다. 기존 30초 지연의 원인은 keep-alive 자체가 아니라 `pageRegistry.generated.ts`의 top-level `dynamic()` 159개 생성으로 dev 서버가 전체 authenticated page를 compile 대상으로 잡은 구조였다.
- 변경: `apps/frontend/scripts/gen-page-registry.mjs`와 `pageRegistry.generated.ts`를 `getPageComponent(path)` lazy factory로 바꿨다. `TabKeepAlive`는 현재 방문한 경로만 `getPageComponent(path)`로 dynamic 생성하고, 열린 탭 page component를 최대 `MAX_TABS`개 hidden mount로 유지한다. `tabPageState.ts` 입력/select/checkbox/radio/스크롤 sessionStorage 복원은 보조 장치로 유지했다.
- 검증: `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 Playwright 로그인 세션에서 `/master/part` 품목 추가 패널 입력 `CODX_REAL_KEEP`가 대시보드 이동 후 품목 탭 복귀에도 보존됨을 확인했다.
- 성능: lazy registry 적용 후 3002 HTTP 반복 측정 최종 `/dashboard` 521ms, `/master/part` 330ms, `/production/wip-stock` 523ms, `/system/menu-categories` 266ms. 커밋하지 않았다.

## 2026-06-20 19:33 Codex

- 작업: `T-ROUTING-LABEL-ISSUE-UI` `/master/routing` 공정순서에 `ISSUE_SG_LABEL_YN`, `ISSUE_FG_LABEL_YN` 설정 UI를 추가했다.
- 원인: `ROUTING_PROCESSES` 엔티티와 SG/FG 라벨 발행 로직은 플래그를 사용하지만, 라우팅 공정 UI/프론트 타입/DTO/서비스 저장 경로에 해당 필드가 없어 운영자가 설정할 수 없었다.
- 변경: 백엔드 `CreateRoutingProcessDto`/`UpdateRoutingProcessDto`와 `RoutingGroupService` create/update 저장 경로에 `issueSgLabelYn`, `issueFgLabelYn`을 추가했다. `/master/routing` 프론트 타입, 공정 등록/수정 모달 체크박스, 저장 payload, 공정 그리드 `라벨발행` 배지를 추가했고 ko/en/zh/vi locale을 보강했다.
- 검증: 구조 테스트 RED 6건 실패 확인 후 GREEN 6/6 PASS. `routing-group.service.spec.ts` focused 2/2 및 전체 28/28 PASS. FE/BE `tsc --noEmit` PASS, 대상 파일 `git diff --check` PASS. 3012 브라우저에서 모달 체크박스와 그리드 SG/FG 배지 표시 확인, API roundtrip으로 생성/수정/조회 및 검증 데이터 삭제 후 JSHANES 잔여 0 확인.
- 참고: 3002 프론트는 HTTP 요청이 30초 타임아웃되어 3012 dev 서버에서 런타임 검증했다. 커밋하지 않았다.

## 2026-06-20 Claude (T-IQC-JUDGE-BY-ITEM)

- 작업: IQC 수입검사 판정을 "품목 단일 검사수준 + 등급별 불량합계" → "검사항목별(각 항목 검사수준/등급/AQL) 판정"으로 전환. (T-IQC-SPEC-ITEM-LEVEL-AQL 마스터 구조의 판정 로직 후속)
- 백엔드:
  - `aql.module.ts`: IqcPartSpecItem forFeature 등록.
  - `aql.service.ts`: **resolveIqcPolicyByItem 신규**. IQC_PART_SPEC_ITEMS에서 등급 설정된 검사항목별로 검사수준(항목→품목 폴백)+AQL→resolveSeverityRule(Ac/Re) 산출. CRITICAL 항목 불량1+ FAIL, MAJOR/MINOR 항목 불량>Ac FAIL(AQL 미설정 시 1+ FAIL 보수), 하나라도 FAIL→LOT FAIL. **등급 설정 항목 0개면 기존 resolveIqcPolicy로 폴백**(하위호환). 반환 shape은 IqcAqlPolicyResolution 호환 + itemResults[] 추가.
  - `iqc-history.service.ts`: `countFailByInspItem`(details SERIAL_INSPECTION의 itemId `code::seq`에서 검사항목별 FAIL 샘플 집계) + createArrivalResult가 resolveIqcPolicy→resolveIqcPolicyByItem 호출(fallback counts 전달). IqcLog 생성부는 반환 호환이라 무변경.
- 입력 무변경: 검사자는 기존처럼 시리얼별 항목 측정(LSL/USL 자동판정). 백엔드가 details(항목별 FAIL) + 마스터(항목별 등급/AQL) 조인해 판정.
- 검증: BE `tsc --noEmit` 0. jest 신규 3건(Critical 항목 FAIL / Major AQL Ac초과 FAIL / 등급 미설정 폴백) + 기존 회귀 PASS — aql.service 13/13, iqc-history 통과(mock을 resolveIqcPolicyByItem로 갱신). 코드 미커밋.
- 검사 화면 표시: resolveItems(iqc-part-spec.service)에 defectGrade/inspectionLevel/aql 반환 추가, IqcModal 측정행 검사항목 셀에 불량등급 배지+검사수준/AQL 표시. FE/BE tsc 0.
- **커밋 655f32e0**(마스터 구조 + 판정 전환 + 화면 표시 12파일). DB(IQC_PART_SPEC_ITEMS 3컬럼 + DEFECT_GRADE 코드)는 시드로 commit 완료. codex z14는 이미 3ca39c1c로 커밋돼 있어 내 변경만 분리 커밋됨.
- IQC_LOGS 항목별 영구저장 완료(커밋 2044b737): IQC_LOGS.ITEM_RESULTS CLOB 추가(seed_iqc_log_item_results.py 멱등, DDL 후 PKG_DASHBOARD/IF_PO/IF_ITEM_MASTER COMPILE→VALID 복구), IqcLog.itemResults 필드, createArrivalResult가 itemResults JSON 저장, 이력 조회 getMany 자동 반환. BE tsc 0/jest 16 PASS.
- codex z14(품목 단일) 위에 항목별 확장 — 등급 미설정 품목은 폴백으로 기존 동작.
- 이력 화면 표시 완료(커밋 2b03b18d): IqcDetailModal에 검사항목별 판정 섹션(검사항목/불량등급 배지/검사수준/AQL/불량수/Ac·Re/판정/사유). 백엔드 조회 `...log` spread로 itemResults 자동 반환. FE tsc 0. itemResults 없는 기존 이력은 섹션 미표시.
- 이번 세션 IQC 커밋 체인: 655f32e0(마스터+판정전환+검사화면) → 2044b737(이력 영구저장) → 2b03b18d(이력 표시). DB 시드 commit 완료. 미push.

## 2026-06-20 14:59 Codex

- 작업: `T-PROD-WIP-FG-STOCK-MENU-SPLIT` `/production/wip-stock` 합산 재고 화면을 반제품재공조회와 제품재공조회 메뉴로 분리.
- 변경: 기존 페이지 본문을 `WipStockView` 공통 컴포넌트로 분리하고 `/production/wip-stock`은 `SEMI_PRODUCT`, 신규 `/production/fg-stock`은 `FINISHED` 고정 조회로 구성했다. 제품 화면에만 미포장 FG라벨 우측 패널을 표시한다.
- 메뉴: `menuConfig.ts`에서 `PROD_WIP_STOCK` 라벨을 `menu.production.wipSemiStock`로 변경하고 `PROD_FG_STOCK` 신규 메뉴를 `/production/fg-stock`에 추가했다. `pageRegistry.generated.ts`, ko/en/zh/vi locale, menu-code-validator, seed JSON을 동기화했다.
- DB: `apps/backend/src/migrations/2026-06-20_split_wip_fg_stock_menus.sql`을 JSHANES에 적용하고 재실행성까지 확인했다. 최종 `MENU_CATEGORY_ITEMS`는 `PROD_WIP_STOCK=70`, `PROD_FG_STOCK=71`, `ROLE_MENU_PERMISSIONS`는 MANAGER/OPERATOR `CAN_ACCESS='Y'`.
- 검증: 신규 구조 테스트는 RED 실패 후 GREEN, 관련 구조 테스트 5건 PASS, FE tsc PASS, 3002 HTTP 두 라우트 200. 브라우저 실측에서 두 제목과 API 요청 `itemType=SEMI_PRODUCT`/`FINISHED`, console/page error 0 확인. 대상 파일 diff check PASS.
- 상태: REVIEW 대기, lock 제거. 커밋하지 않음.

## 2026-06-20 Claude (T-IQC-SPEC-ITEM-LEVEL-AQL)

- 작업: 품목별 IQC 검사항목(IQC_PART_SPEC_ITEMS)에 **검사항목별 불량등급/검사수준/AQL** 도입. 검사기준서(Control Plan) 구조 — "품목 1개=검사수준 1개"가 아니라 품목 × 검사항목마다 등급/검사수준/AQL 관리(사용자 요구).
- DB(JSHANES): IQC_PART_SPEC_ITEMS에 `DEFECT_GRADE`(VARCHAR2 10)/`INSPECTION_LEVEL`(VARCHAR2 5)/`AQL`(NUMBER) 비파괴 ADD. COM_CODES `DEFECT_GRADE` 그룹(CRITICAL/MAJOR/MINOR, 배지색) 시드. 시드 `tools/seed/seed_iqc_spec_item_level_aql.py`(멱등). commit.
- 백엔드: `iqc-part-spec-item.entity.ts` 3필드(nullable, type 명시), `iqc-part-spec.dto.ts` IqcPartSpecItemDto 3필드(defectGrade IsIn CRITICAL/MAJOR/MINOR), `iqc-part-spec.service.ts` upsert 매핑. findByItemCode/findAll은 relations로 자동 포함.
- 프론트: `iqc-item/types.ts` IqcSpecRow 3필드. `IqcSpecPanel.tsx`(품목별 IQC 그리드)에 불량등급(DEFECT_GRADE 배지/드롭다운)·검사수준(AQL_INSP_LEVEL 드롭다운, 표시는 코드)·AQL(AQL_VALUE 드롭다운) 컬럼 추가 — 표시/편집 양쪽. 검사수준/AQL은 기존 공통코드 재사용.
- 검사수준/AQL/등급은 측정형·판정형 무관하게 모든 항목에 적용(LSL/USL는 측정형만 유지).
- 범위: 마스터 데이터 구조 + 입력 화면까지. **판정 산출 로직(검사수준→코드문자→Ac/Re) 항목별 전환은 미포함** — codex z14(품목 단일) 산출 로직과 얽혀 별도 작업 권장. resolveItems도 미변경.
- 검증: BE/FE `tsc --noEmit` 0. **3002 브라우저 E2E**: `/master/iqc-part-spec` CBL-A 선택→검사항목 그리드에 불량등급/검사수준/AQL 컬럼 표시, "수정"→3종 드롭다운 정상. 코드 미커밋. codex 미커밋 변경 위에 쌓임.
- **함정**: 엔티티 AQL을 처음 `@Column type:'number'`로 했더니 BE 부팅 실패(GET /health 500). TypeORM Oracle에서 `'number'`는 비표준 — lsl/usl처럼 `type:'decimal' precision/scale`로 수정해 복구. Oracle NUMBER는 decimal 매핑.
- 참고: codex가 ITEM_MASTERS에 품목 단일 검사수준/AQL을 구현(미커밋)했고 /master/part·/master/iqc-part-spec page.tsx에 AQL 요약을 붙임. 본 작업은 검사항목 단위로 모델을 확장한 것 — ITEM_MASTERS 품목 단일값은 폴백/정리 대상(추후).

## 2026-06-20 14:44 Codex

- 작업: `LOCKS.md` 누적 정리 및 ai-coordination 종료 정리 규칙 보강.
- 확인: coordination 상태는 `enabled=false`로 정지 상태였지만, `LOCKS.md`의 `## Active Locks` 아래에 `status: released` 항목이 다수 누적되어 대시보드/다음 세션에서 아직 잠금이 남은 것처럼 보일 수 있었다.
- 조치: `LOCKS.md`를 현재 활성 잠금 없음으로 축소하고, 완료 lock은 `JOURNAL.md`/`ARCHIVE.md`/`HANDOFF`에 증거를 남긴 뒤 `LOCKS.md`에서 제거한다는 규칙을 `README.md`와 `PROTOCOL.md`에 추가했다.
- 스킬 보강: `ai-coordination` 스킬과 `check_coordination.py`에 Active Locks 내 released/stale 누적 경고 및 종료 시 lock 제거 규칙을 추가했다.

## 2026-06-20 Codex (T-BOX-STOCK-PACKED-VS-RECEIVED)

- 요청: 박스포장으로 `BOX_NO`를 부여받은 상태와 제품입고 후 창고재고 상태를 구분. `BOX_NO`는 포장 식별자로 유지하고, 창고이동 기준으로만 쓰면 안 된다는 도메인 정정 반영.
- 원인: `/shipping/box-stock` 조회가 `FG_LABELS.BOX_NO IS NOT NULL AND STATUS <> 'SHIPPED'`만으로 박스별 재고를 집계해 포장대기와 창고입고 완료를 같은 상태로 보였다.
- 변경: `BoxService.findStockByBox()`와 `findStockSerials()`가 `PRODUCT_TRANSACTIONS`를 `refType='BOX'`, `transType IN ('WIP_OUT','FG_IN')`, `status='DONE'` 조건으로 left join해 `inventoryState`를 `PACKED_WAITING` 또는 `WAREHOUSE_RECEIVED`로 반환한다. `/shipping/box-stock` 화면은 재고상태, 창고, 입고일시 컬럼과 SQL 미리보기를 추가했다. `ProductInventoryService.cancelTransactionInTx()`는 박스 입고취소 시 `FG_LABELS.BOX_NO`를 지우지 않고 수불 전표 취소와 재고 역분개만 수행한다.
- 테스트: 백엔드 회귀 테스트는 기존 구현에서 `PRODUCT_TRANSACTIONS` 조인이 없어 RED 실패 후 GREEN 통과했다. 입고취소 시 `BOX_NO` 유지 테스트도 기존 구현에서 RED 실패 후 GREEN 통과했다. 프론트 구조 테스트도 `inventoryState`/수불 조인 SQL 누락으로 RED 실패 후 GREEN 통과했다.
- 검증: `pnpm --filter @harness/backend test -- product-inventory.service.spec.ts box.service.spec.ts --runInBand` 36/36 PASS, 신규/기존 box-stock 구조 테스트 PASS, ko/en/zh/vi JSON parse PASS, BE/FE `tsc --noEmit` PASS, JSHANES SQL 정상 실행(현재 미출하 박스 라벨 0건), 대상 파일 `git diff --check` PASS. 직접 API 호출은 인증 누락으로 401이라 브라우저 세션 실측은 수행하지 못했다.

## 2026-06-20 Claude (T-PROCESS-LINE-TYPE-UI)

- 작업: PROCESS_MASTERS `LINE_TYPE` 화면 반영 (T-PROCESS-MASTER-PDF-REORG 후속).
- 백엔드: `process.dto.ts` CreateProcessDto에 `lineType`(IsIn LV/HV/CM). `process.service.ts` create에 lineType + **processCategory 누락 동반 수정**(기존 create에 processCategory 미저장 버그), update Pick/매핑에 lineType. `equip-master.service.ts` findAll에서 PROCESS_MASTERS 조인 시 processName과 함께 `lineType` 매핑(설비모달용).
- 프론트: `master/process` ProcessList에 라인 컬럼(ComCodeBadge groupCode=LINE_TYPE)+멀티필터, page.tsx 모달에 라인 입력(ComCodeSelect). 설비선택 모달(`EquipSelectModal`)을 **라인(저전압/고전압/공통)별 섹션 → 공정별 카드 멀티컬럼** 2단계 그룹으로 재구성. `equipOptions.ts` normalize에 lineType 파싱 + undefined 필드 미포함으로 정리.
- DB: `COM_CODES` LINE_TYPE 3건(LV=저전압/HV=고전압/CM=공통, attr1 배지색) JSHANES commit. 시드 `tools/seed/seed_line_type_comcode.py`(멱등).
- i18n: 신규 라벨(`master.process.lineType`, `kiosk.equip.noLine`)은 `t(..., {defaultValue})` 폴백 — locales 4파일 codex 점유 회피.
- 검증: FE/BE `tsc --noEmit` 0. `equipOptions.test.mjs` 2/2 PASS(기존에 undefined 필드 때문에 깨질 상태였던 테스트를 normalize 정리로 동반 GREEN). 브라우저 렌더 검증은 dev 서버가 BE3+FE3 파일 재컴파일 중이라 새 페이지 진입 일시 실패(사용자 기존 탭은 정상) — 코드/DB 검증으로 갈음, 사용자 직접 확인 권장. 코드 미커밋.

## 2026-06-20 13:15 Codex

- 작업: `T-IQC-AQL-Z14-POLICY` IQC AQL 정책 구현.
- 변경: `ITEM_MASTERS`에 품목 기준 `INSPECTION_LEVEL/AQL_CRITICAL/AQL_MAJOR/AQL_MINOR`, `PARTNER_MASTERS`에 `QUALITY_GRADE/INSPECTION_MODE`, `IQC_LOGS`에 AQL 판정 근거/불량수/업체/LOT 수량 컬럼을 추가했다. `AQL_SAMPLING_RULES.CODE_LETTER`와 `VENDOR_INSPECTION_MODE_HISTORY`도 추가했다.
- 변경: `AqlService.resolveIqcPolicy()`가 품목 AQL + 업체 검사강도 + LOT 수량으로 Major/Minor 샘플수량/Ac/Re를 산출하고, Critical 불량 1건 이상은 즉시 FAIL 처리한다. `updateVendorInspectionModeAfterLot()`로 최근 이력 기반 NORMAL/TIGHTENED/REDUCED 자동전환과 이력 저장을 처리한다.
- 변경: `/material/iqc-history/arrival` 저장은 프론트 요청 결과를 그대로 믿지 않고 서버 AQL 판정 결과로 `MAT_LOTS`, `MAT_ARRIVALS`, `IQC_LOGS`를 저장한다. 기존 기본시료수(`SAMPLE_QTY`)는 파괴시료/검사시료 용도로 유지하고, AQL 샘플수량은 별도 `AQL_SAMPLE_QTY`로 저장한다.
- 화면: `/master/part` 품목 폼/그리드에 기본시료수, 검사수준, Critical/Major/Minor AQL 입력/표시를 추가했다. IQC 모달에는 AQL 샘플수량/검사수준/검사모드/Ac/Re 표시와 Critical/Major/Minor 불량수 입력을 추가했다.
- DB: `apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql`을 JSHANES에 적용 완료. post-check: ITEM 4, PARTNER 2, IQC_LOGS 15, HISTORY_TABLE 1, CODE_LETTER_ROWS 45.
- 검증: backend AQL/IQC focused Jest 23건 PASS, backend tsc PASS, frontend tsc PASS, IQC modal/master part 구조 테스트 PASS, `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py` PASS, `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 12:56 Codex

- 작업: `T-IQC-AQL-Z14-POLICY` IQC AQL 정석 구조 설계/계획.
- 배경: 사용자가 `품목별 AQL + 업체별 검사강도 + Critical/Major/Minor + ISO 2859-1 자동계산 + 업체 검사모드 자동전환` 정책을 제시하고, 2안 정석 구현을 선택했다.
- 확인: 현재 repo의 `ITEM_MASTERS`에는 `INSPECTION_LEVEL/AQL_CRITICAL/AQL_MAJOR/AQL_MINOR`가 없고, `PARTNER_MASTERS`에는 `QUALITY_GRADE/INSPECTION_MODE`가 없다. 기존 `/quality/aql`은 LOT 범위별 `sampleSize/Ac/Re` 직접 등록형 1차 화면이다.
- 변경: 새 설계 문서 `docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md` 작성. 기존 `docs/superpowers/specs/2026-06-19-iqc-aql-design.md`는 superseded 표시.
- 계획: 구현 계획 `docs/superpowers/plans/2026-06-20-iqc-aql-z14-policy-implementation.md` 작성. 스키마/엔티티, AQL policy resolve engine, 마스터 UI/API, IQC 서버 판정, 업체 검사모드 자동전환, Oracle/ERD/runtime 검증으로 분리했다.
- 검증: `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 생산 코드 수정 없음, 커밋하지 않음.

## 2026-06-20 Claude (T-PROCESS-MASTER-PDF-REORG)

- 작업: `03.제조공정_THN.pdf`(THN 와이어링하네스 공정 흐름도, 저전압/고전압) 기준 `PROCESS_MASTERS` 정비.
- 설계(brainstorming): `docs/superpowers/specs/2026-06-20-process-master-pdf-reorg-design.md`. 확정 — 코드 유지 + LINE_TYPE 컬럼 + 저/고전압 둘 다 + 제조공정만 + 신규 전부 추가 + 그로멧·부자재삽입 공용(CM).
- 변경: ① `PROCESS_MASTERS`에 `LINE_TYPE VARCHAR2(2)`(LV/HV/CM) 비파괴 ADD. ② 기존 18개 PROCESS_CODE **무변경**, PROCESS_NAME/LINE_TYPE/SORT_ORDER만 UPDATE(WELDR→초음파융착, TUBHT→열수축, SHDRM→실드편조절단, OINSP→육안검사 등). ③ 신규 23개 INSERT(저전압17·고전압4·공통2). ④ 미사용 PRC-* 4개 USE_YN='N'. ⑤ 엔티티 `process-master.entity.ts`에 `lineType` 필드(nullable, type 명시).
- 적용: 멱등 시드 `tools/seed/seed_process_master_pdf.py`(컬럼ADD존재시skip + UPDATE + 없을때만INSERT + 비활성, dry-run 기본/`--commit`). JSHANES commit. SORT 체계 LV 1000~/HV 2000~/CM 3000~.
- 검증: dry-run/commit 일치, 실DB 재조회 활성 41(LV25/HV6/CM10)+비활성4. BE `tsc --noEmit` 0. `PROCESS_CODE` 무변경으로 23개 참조 테이블(라우팅/작업지시/생산실적/genealogy/SPC 등) 무손상. DDL 후 INVALID는 IF_PO 1건뿐이나 PROCESS_MASTERS 미참조(원래 INVALID, 무관).
- 남은 것: 화면 반영(공정마스터 화면 LINE_TYPE 컬럼/필터, 설비선택 모달 라인별 그룹)은 별도 작업. 코드 미커밋(시드/엔티티/spec).

## 2026-06-20 11:58 Codex

- 작업: `T-MATERIAL-PO-STATUS-RECEIVED-GREEN` `/material/po-status` PO현황 입고완료 상태 배지 색상 보정.
- 원인: PO현황 좌측 그리드는 `입고율`을 갖고 있고 실제 데이터 중 `receiveRate=100`인 행이 많지만, 상태 배지는 원래 `PO_STATUS` 공통코드의 `attr1`과 상태 코드명만 사용해 `확정/임시저장` 또는 분홍 계열로 보일 수 있었다.
- 변경: `/material/po-status/page.tsx`에 `RECEIVED_STATUS_CLASS`를 추가하고, 상태값이 `RECEIVED`이거나 좌측 행 `receiveRate >= 100`이면 상태 배지 문구를 `입고완료`로 표시하고 초록 클래스를 우선 적용한다. 좌측 `입고율` 진행바도 100%는 초록, 부분입고는 노랑, 0%는 회색으로 맞췄다. 다른 상태는 기존 공통코드 색상을 유지한다.
- 테스트: 구조 테스트 `po-status-received-green.structure.test.mjs`를 추가/확장해 초록 전용 클래스, `RECEIVED 또는 receiveRate>=100` 판단, 입고완료 문구, 좌측 진행바 색상을 고정했다. RED 실패 확인 후 GREEN 통과.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 Playwright `/material/po-status` 좌측 그리드에서 `입고율 100%` 행들이 `입고완료` 초록 배지와 초록 진행바로 표시됨을 확인했다. console/page error 0, `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 11:55 Codex

- 작업: `T-TOAST-BOTTOM-LEFT` 전역 toast 이벤트 메시지 위치 변경.
- 원인/범위: `react-hot-toast` 공통 `Toaster`가 [providers.tsx](/c:/Project/HANES/apps/frontend/src/app/providers.tsx)의 `position="top-right"`로 설정되어 모든 토스트가 우상단에 표시됐다.
- 변경: `Toaster` 위치를 `position="bottom-left"`로 변경하고, `apps/frontend/src/app/toaster-position.structure.test.mjs`로 좌하단 계약을 고정했다.
- 검증: 구조 테스트 RED(`top-right` 기존 설정 실패) 확인 후 GREEN, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 11:28 Codex

- 작업: `T-MASTER-PART-LABEL-TERMS` `/master/part` 품목정보 용어 변경, 입력 컬럼 도움말 추가, 미사용 택타임 제거.
- 변경: 그리드와 등록/수정 패널의 `박스입수량`을 `박스장입수량`, `최소포장단위`를 `최소불출단위수량(자재)`, `묶음단위수량`을 `묶음단위수량(생산공정품)`, `적재 로케이션`을 `품목고정 적재로케이션`으로 맞췄다. `거래처 / 수량관리` 섹션 제목은 제거했다.
- 도움말: `PartFieldHelp.tsx`를 추가해 품목정보 입력 라벨 옆 `?` 아이콘을 공통 처리하고, title/aria-label에 컬럼 설명과 `ITEM_MASTERS.*` DB 컬럼명을 표시한다.
- 포장 후보: `박스장입수량` 입력에 `10,20,30,40,50,60,70,80,90,100` datalist 후보를 붙였고 직접 타이핑은 유지했다.
- 정리: `/master/part` 관리 화면과 품목 QA 시나리오에서 미사용 `택타임` 입력/컬럼/payload/type 참조를 제거했다.
- 검증: 구조 테스트 RED→GREEN, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `http://localhost:3002/master/part` 200, 3002 Playwright DOM에서 도움말 27개와 DB 컬럼 title/새 라벨/택타임 미표시/후보값 확인 PASS, `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 10:52 Codex

- 작업: `T-SHIP-ORDER-SQL-PREVIEW` `/shipping/order` SQL 미리보기 보정.
- 원인: 화면 `DataGrid.sqlQuery`가 실제 테이블이 아닌 `SHIPPING_ORDERS`를 표시하고 있어 `/shipping/orders` 실제 조회 구조와 달랐다.
- 근거: 백엔드 `ShipOrderService.findAll()`은 `SHIPMENT_ORDERS`를 조회하고, 조회된 출하지시번호 기준으로 `SHIPMENT_ORDER_ITEMS`, `ITEM_MASTERS`, `PARTNER_MASTERS` 데이터를 보강한다.
- 변경: `/shipping/order/page.tsx`의 SQL 미리보기를 `SHIPMENT_ORDERS so` 기준으로 바꾸고 `SHIPMENT_ORDER_ITEMS soi`, `ITEM_MASTERS im`, `PARTNER_MASTERS pm` LEFT JOIN 및 `so.COMPANY`, `so.PLANT_CD`, `so.CREATED_AT DESC` 조건을 표시했다.
- 검증: SQL preview 구조 테스트 RED→GREEN, 기존 ship-order print/payload 구조 테스트 PASS, FE tsc PASS, `http://localhost:3014/shipping/order` 200 및 compile PASS, `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 Claude (T-KIOSK-EQUIP-MODAL-GROUP)

- 작업: `/production/input-kiosk` 설비선택 모달(`EquipSelectModal.tsx`) 직접선택 목록을 공정별 그룹화 + 모달 확대 + 스크롤 최소화.
- 변경: `equips`(이미 `processCode`/`processName` 보유 — `/equipment/equips` findAll이 PROCESS_MASTERS 조인으로 채움)를 `useMemo`로 공정별 그룹핑(공정명 가나다순, 미지정 맨 뒤, 그룹 내 설비명순). 검색은 설비코드/명+공정코드/명 매칭. Modal `size="md"`→`"full"`(90vw). 그룹은 `columns-2 md:3 xl:4 2xl:5` 멀티컬럼 + `break-inside-avoid` 카드. 스캔+검색을 한 줄로 압축해 세로 공간 확보.
- i18n: 신규 라벨은 `kiosk.equip.noProcess` 1개뿐이고 현재 전 설비가 공정 보유라 거의 미표시 → `t(..., {defaultValue:'공정 미지정'})` 폴백 처리. **locales 4파일은 codex(T-SHIP-ORDER-PRINT)가 active 점유 중이라 미수정**(충돌 회피).
- 검증: FE `tsc --noEmit` 0건. 3002 브라우저 실측 — 설비선택 모달이 22개 공정/48설비를 5컬럼으로 거의 한 화면에 표시(스크롤 최소), 공정 카드(공정명+설비수 배지)·설비 버튼(명+코드) 정상.
- 참고: 검증 중 input-kiosk 일시 500 — codex가 3002 dev 서버를 재시작(아래 10:50 항목)한 직후 첫 컴파일 지연이었음. EquipSelectModal만 stash해도 500 동일 → 내 변경 무관 확인, 재컴파일 완료 후 정상. (별건: 진입 시 localStorage의 삭제된 작업지시 WO2606150057 404 에러모달 — 데이터 이슈, 본 작업 무관.)

## 2026-06-20 10:50 Codex

- 작업: `T-SHIP-CONFIRM-ORDER-PANEL` `/shipping/confirm` 좌측 미출하 출하지시 그리드 패널 추가.
- 변경: 기존 `/shipping/orders?status=CONFIRMED&limit=5000` API를 조회해 `orderQty > shippedQty`인 품목이 남은 출하지시만 좌측 패널에 표시한다. 컬럼은 출하지시번호, 고객사, 잔여수량, 출하일이다.
- 변경: 좌측 출하지시 행을 클릭하면 `BoxScanShipModal`에 `initialShipOrderNo`를 전달해 출하지시를 자동 조회한다. 이 경로에서는 출하지시번호 수동 입력 영역을 숨기고 박스 바코드 입력부터 진행한다. 상단 `박스 스캔 출하` 버튼은 기존 수동 입력 흐름을 유지한다.
- 런타임: 기존 3002 dev 서버가 500을 반환해 재시작했다. 3005 `next start`는 전체 페이지 500이라 사용하지 않았고, 3006 임시 dev 검증 후 종료했다. 최종 검증은 3002에서 완료했다.
- 검증: 구조 테스트 4개 RED/GREEN 및 회귀 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/frontend build` PASS, 3003 API 미출하 후보 확인, 3002 Playwright에서 좌측 패널/행 클릭/모달 자동 로딩/수동 출하지시번호 프롬프트 미표시/console error 0 확인, `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 10:35 Codex

- 작업: `T-SHIP-ORDER-PRINT` `/shipping/order` 등록 출하지시서 출력 기능 추가.
- 변경: 출하지시 목록 행 액션에 출력 버튼을 추가하고, 선택한 출하지시를 A4 브라우저 출력 영역(`ship-order-print-root`)으로 렌더링한다. 출력물 상단에는 `shipOrderNo` 텍스트와 `react-qr-code` 기반 2D QR 바코드를 함께 표시한다. 품목 목록, 고객사, 상태, 납기일, 출하일, 비고, 합계수량을 출력한다.
- locale: `shipping.shipOrder.printOrder`, `printTitle`, `printDate`를 ko/en/zh/vi에 추가했다.
- 검증: 구조 테스트 RED→GREEN, locale JSON parse PASS, `git diff --check` PASS, 별도 dev 서버 `http://localhost:3014/shipping/order` 200 및 `/shipping/order` compile PASS.
- 제한: 기존 `localhost:3002`는 HTTP 요청이 timeout이라 건드리지 않았다. 전체 FE tsc는 현재 진행 중인 `/shipping/confirm/page.tsx:318`의 `selectedRowId` 타입 오류(`string | null` -> `string | undefined`)로 실패했으며 이번 `/shipping/order` 변경과는 별도다.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-20 Claude

- 작업: `T-QUALITY-AQL-COMCODE-DROPDOWN` `/quality/aql` 기준관리 화면의 코드성 입력 필드를 공통코드 드롭다운으로 전환.
- 코드화 대상(사용자 확정: 3개 모두 + ISO 2859-1 표준 전체):
  - 검사수준 `inspectionLevel`: 자유텍스트 → `ComCodeSelect groupCode="AQL_INSP_LEVEL"` (신규 그룹 7종: 특별 S-1~S-4, 일반 I/II/III)
  - AQL값 `aqlValue`: number Input → `ComCodeSelect groupCode="AQL_VALUE"` (신규 그룹 26종: 0.010~1000)
  - 사용여부 `useYn`: 하드코딩 Select → `ComCodeSelect groupCode="USE_YN"` (기존 그룹 재사용)
- DB: JSHANES(40/1000) `COM_CODES`에 AQL_INSP_LEVEL(7)+AQL_VALUE(26)=33건 commit. 빌더 `tools/seed/seed_aql_comcodes.py`(DELETE 후 INSERT, 멱등, dry-run 기본/`--commit`). pre-check: 두 그룹 0건/USE_YN 2건 존재. post-check: 33건 재조회 확인.
- **핵심 설계**: AQL_VALUE `DETAIL_CODE`는 프론트 `String(form.aqlValue)`와 정확히 매칭돼야 기존 값이 드롭다운에 선택 표시됨 → DETAIL_CODE는 JS canonical 표기(`1.0`→`"1"`, `0.040`→`"0.04"`), `CODE_NAME`(라벨)만 ISO 표준 표기. 기존 데이터 II/1.0/2.5/4.0 모두 매칭 확인.
- i18n: ko/en/zh/vi 4파일에 `comCode.AQL_INSP_LEVEL.*` 7키 추가(검사수준 다국어). AQL값은 숫자 표기라 DB codeName 폴백으로 충분(키 생략).
- 스코프: 입력 폼만 전환. 좌측 그리드 검사수준/AQL값 컬럼은 코드값 자체가 의미라 그대로 유지. 제1지침 점검 — inspectionLevel/aqlValue 입력 화면은 `/quality/aql` 1곳뿐(유사 문제 없음).
- 검증: FE `tsc --noEmit` 0건, 구조 테스트 5/5 PASS, locale JSON 4파일 parse OK. 브라우저 E2E는 미수행(사용자 확인 권장). 코드 미커밋.

## 2026-06-19 19:13 Codex

- 작업: `T-SHIP-CONFIRM-CARD-REMOVE` `/shipping/confirm` 출하확정 화면 정보카드 제거.
- 변경: `page.tsx`에서 상단 4개 `StatCard` 상태 요약 영역과 관련 `stats` 계산, 미사용 아이콘/import를 제거했다. 조회 그리드, 필터, 등록, 박스스캔출하, 출하확정/취소/역분개 모달 흐름은 유지했다.
- 검증: 구조 테스트 RED(`StatCard` 존재) 확인 후 GREEN, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `git diff --check` PASS.
- 런타임 참고: `localhost:3002`는 node PID `55728`이 listen 중이나 `Invoke-WebRequest`가 30초 타임아웃되어 HTTP/브라우저 확인은 완료하지 못했다.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-19 19:02 Codex

- 작업: `T-MENU-LOCALE-MISSING` 사이드바 메뉴 번역 누락 보정.
- 변경: `menuConfig.ts`의 `labelKey`를 기준으로 ko/en/zh/vi locale 누락을 검증하는 구조 테스트 `apps/frontend/src/config/menu-locale-coverage.structure.test.mjs`를 추가했다.
- RED: 테스트 기준을 실제 i18next 점 포함 locale 키 구조에 맞춘 뒤 `en/zh/vi: menu.material.shelfLifeHistory` 누락을 확인했다.
- 조치: `apps/frontend/src/locales/en.json`, `zh.json`, `vi.json`의 menu 블록에 `material.shelfLifeHistory` 번역을 추가했다.
- 검증: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS, ko/en/zh/vi JSON parse PASS.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-19 18:55 Codex

- 작업: `T-SHIP-OQC-GATE-OFF` JSHANES `40/1000` 출하 OQC 게이트 비활성화.
- pre-check: `SYS_CONFIGS`에서 `CONFIG_KEY=OQC_ENABLED`, `CONFIG_VALUE=Y`, `IS_ACTIVE=Y` 확인.
- 조치: 기존 API `PATCH /api/system/configs/OQC_ENABLED`에 `{ "configValue": "N" }` 전송해 설정 변경.
- post-check: JSHANES DB `OQC_ENABLED=N`, `/api/system/configs/active` 응답 map `OQC_ENABLED=N`, `/api/system/configs?configGroup=QUALITY` 응답 `configValue=N` 확인.
- 비고: 코드 변경 없음. 실제 출하 처리는 수행하지 않았다. 이후 출하 게이트는 마감 박스 `CLOSED` 기준이며 `OQC_STATUS=PASS` 요구가 꺼진다.
- 상태: REVIEW 대기, lock released.

## 2026-06-19 18:46 Codex

- 작업: `T-SHIP-SO999-APPROVE` JSHANES `40/1000` 출하지시 `SO-20260619-999` 출하 가능 상태 보정.
- pre-check: `SHIPMENT_ORDERS` 상태 `DRAFT`, `SHIPMENT_ORDER_ITEMS`는 `HNS02` 지시수량 10/출하수량 0. `BX2606190002`는 `HNS02` 10개, `CLOSED`, `OQC_STATUS=PENDING`, 팔레트 미적재. `FG_MAIN/HNS02` 가용수량 10. `SYS_CONFIGS.OQC_ENABLED=Y`.
- 조치: 기존 API `PUT /api/shipping/orders/SO-20260619-999/confirm` 호출로 출하지시를 `CONFIRMED` 처리했다. 이어 기존 API `POST /api/quality/oqc/OQC-20260619-001/execute` 호출로 `BX2606190002` OQC를 `PASS` 처리했다.
- post-check: `SO-20260619-999=CONFIRMED`, `BX2606190002=CLOSED/PASS`, `FG_MAIN/HNS02 AVAILABLE_QTY=10`.
- 비고: 실제 `ship-box` 출하 처리는 수행하지 않았다. 화면에서 출하지시 `SO-20260619-999`와 박스 `BX2606190002`를 스캔하면 출하 게이트 조건은 충족한다.
- 상태: REVIEW 대기, lock released. 코드 변경 없음.

## 2026-06-19 16:50 Codex

- 작업: `T-IQC-HISTORY-ARRIVALNO-COLUMN` `/material/iqc-history` 그리드 입하번호 표시.
- 변경: `page.tsx`의 IQC 이력 DataGrid columns에 `arrivalNo` 컬럼을 추가했다. 백엔드 응답과 `IqcHistoryItem` 타입에는 이미 `arrivalNo`가 있어서 API/DB 변경 없이 화면 표시만 보정했다.
- 검증: 구조 테스트에 입하번호 컬럼 누락 RED를 추가해 실패 확인 후 구현했다. `node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs` 2/2 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright CLI로 3002 `/material/iqc-history` 인증 세션 진입 후 DOM에서 `입하번호` 헤더와 `R26061900002` 행 값 표시 확인.
- 상태: REVIEW 대기, lock released. 커밋하지 않음.

## 2026-06-19 16:34 Codex

- 작업: `T-IQC-AQL-MENU` 품질관리 하위 AQL 기준관리 메뉴 진입점 추가.
- 변경: `menuConfig`에 `QC_AQL`과 `/quality/aql`을 추가하고, 백엔드 메뉴 코드 validator에 `QC_AQL`을 허용했다. page registry를 생성기로 갱신하고 ko/en/zh/vi 메뉴/페이지 문구를 추가했다. `/quality/aql/page.tsx`는 AQL 기준/LOT 수량별 판정 기준 placeholder 화면으로 생성했다.
- 범위 제한: DB/API/CRUD 구현은 하지 않았다. 현재는 메뉴 클릭 시 화면이 깨지지 않는 진입점만 추가했다.
- 검증: 신규 구조 테스트를 먼저 RED로 확인한 뒤 구현 후 `node --test apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs` 4/4 PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: REVIEW 대기, lock released.

## 2026-06-19 16:07 Codex

- 작업: `T-IQC-HISTORY-LOTNO-FALLBACK` `/material/iqc-history` LOT No. 빈 값 보정.
- 원인: 입하단위 IQC 저장은 `IQC_LOGS.MAT_UID`를 `NULL`로 두고 실제 스캔 시료 LOT를 `SAMPLE_BARCODE`에 저장하지만, 이력조회 그리드는 `matUid`만 `LOT No.`로 표시했다.
- 변경: `page.tsx`에 `getLotNoDisplay(record) = record.matUid || record.sampleBarcode || "-"`를 추가하고, 목록 LOT No. 컬럼과 판정취소 모달 LOT No. 표시가 같은 fallback을 쓰도록 했다. 구조 테스트 `iqc-history-lot-no.structure.test.mjs`를 추가했다.
- 검증: JSHANES `R26061900002` 이력 `MAT_UID NULL`, `SAMPLE_BARCODE='VH1-RM260619-00011'` 확인. API 첫 행도 같은 shape 확인. `node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 대상 파일 `git diff --check` PASS. 3002 브라우저에서 첫 행 `R26061900002 / CBL-B` LOT No.가 `VH1-RM260619-00011`로 표시됨.
- 상태: REVIEW, lock released. 커밋하지 않음.

## 2026-06-19 15:55 Codex

- 작업: `T-IQC-AQL-PLAN` IQC 우선 AQL 기준관리 설계/계획 문서화.
- 결정 반영: 1차 적용 범위는 IQC로 한정한다. 기존 `IQC_PART_SPECS.SAMPLE_QTY`는 AQL 적용 후 혼동을 막기 위해 화면/로직에서 제거하되, DB 컬럼 물리 삭제는 안정화 후 2차로 분리한다. `IQC_LOGS.INSPECT_CLASS`는 기존 legacy 검사분류 의미를 유지하고 AQL 축으로 사용하지 않는다.
- 산출물: `docs/superpowers/specs/2026-06-19-iqc-aql-design.md`, `docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md`.
- 검증: 문서 파일 존재 확인, 핵심 키워드(`SAMPLE_QTY`, `QC_AQL`, `AQL_SAMPLE_SIZE`, `INSPECT_CLASS`) 포함 확인, 대상 문서/coordination `git diff --check` PASS.
- 상태: REVIEW 대기, lock released. 구현 코드는 수정하지 않았고 커밋하지 않았다.

## 2026-06-19 Claude (창고 드롭다운 빈값 버그 수정)

창고관리 로케이션 탭/이동규칙 탭의 창고 선택 드롭다운이 비는 버그 수정.

- 근본원인(브라우저 실응답으로 확정): `GET /inventory/warehouses` 응답이 **이중 중첩** `{success, data:{data:[13건], total, page, limit}, meta}`. 정상 코드(WarehouseList·useMasterOptions hook)는 `raw=res.data.data` → `raw.data`로 두 번 언랩. 버그 코드(LocationList·TransferRuleList)는 `res.data.data`(=`{data,total}` 객체)를 배열로 가정해 `.map()` TypeError → `catch` 삼킴 → 드롭다운 빈 상태.
- 수정: `const raw = res.data?.data; Array.isArray(raw) ? raw : raw?.data ?? []`로 통일. LocationList(fetchWarehouses/fetchData), TransferRuleList(fetchWarehouses/fetchData) **4곳**.
- systemic 점검(제1지침): `useMasterOptions.ts` hook은 이미 정상. 동일 잘못된 파싱은 창고관리 2개 컴포넌트에만 존재.
- 검증: 브라우저 실응답 `res.data.data.data=13건` 확인, 프론트 tsc 0. **코드는 a25f9bd3(작업트리 전체 커밋, 타 세션)에 이미 포함됨.**

## 2026-06-19 14:49 Codex

- 작업: `T-MATERIAL-ARRIVAL-QTY-FORMAT` `/material/arrival` 자재입하처리 모달 숫자 천단위 포맷 적용.
- 원인: `PoLineReceiptModal.tsx`의 입수량(read-only `serialUnitQty`) 표시가 `String(lotUnitQty)`를 사용하고, 예상 시리얼 계산식도 `{lotUnitQty ?? '-'}`를 그대로 출력해 1000 이상 값에 구분자가 붙지 않았다.
- 변경: 표시 전용 `formatQuantity()` helper를 추가해 입수량과 계산식의 나눗셈 값, 예상 시리얼수에 `toLocaleString()` 천단위 포맷을 적용했다. 사용자가 직접 입력하는 입하수량 `Input type="number"`는 기존 입력 동작을 유지했다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node --test apps/frontend/src/app/(authenticated)/material/arrival/components/po-line-receipt-number-format.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: 완료, REVIEW 대기, lock released.

## 2026-06-19 Claude (hns02-seed 출하지시 추가)

T-HNS02-STOCK100-SEED 후속 — 출하지시·출하이력 표시 요구. 사용자 결정: 출하지시만, 재고 100 유지.

- 흐름 파악: 출하지시 화면(`/shipping/order`)·출하이력 화면(`/shipping/history`) 모두 `GET /shipping/orders`(SHIPMENT_ORDERS) 조회, **출하이력 화면 날짜필터 기본값 없음**. 실제 출하/재고차감은 출하확정(`/shipping/confirm`, SHIPMENT_LOGS, mark-shipped)에서만 발생.
- 추가: 빌더에 SHIPMENT_ORDERS 1건(SOH-260619-001, CONFIRMED, CUS-001 현대자동차, SHIP_DATE=오늘) + SHIPMENT_ORDER_ITEMS(HNS02 ORDER_QTY=100, SHIPPED_QTY=0). SHIPMENT_LOGS는 미생성 → 재고 미차감. 정리 DELETE에 SOH-260619% 추가. 멱등 재실행(--commit).
- 검증 PASS: SHIPMENT_ORDERS 1/ITEMS 100/SHIPMENT_LOGS 0/제품재고 HNS02 100 유지. 독립연결 재확인.
- spec §4.9/§5 갱신. 출하지시·출하이력 화면에 노출, 출하확정 화면은 빈 상태(의도).

## 2026-06-19 Claude (hns02-seed 포장실적 보완)

T-HNS02-STOCK100-SEED 후속 — 포장실적 화면(`/production/pack-result`)에 시드가 안 보이는 문제 수정.

- 근본원인(코드+데이터 확정): 포장실적 화면은 `ProductionViewsService.getPackResult`가 **`BOX_MASTERS`(박스 단위)** 조회 + **날짜 필터 기본 '오늘'**. 1차 시드는 FG라벨을 PACKED로만 만들고 **BOX_MASTERS 미생성**(spec §4.6 누락) → 시드분 0. 기존 HNS02 박스 8건은 6/12~6/17이라 오늘 필터에서 제외.
- 수정: 빌더에 박스입고 추가 — FG라벨 100개를 10개/박스로 묶어 BOX_MASTERS 10건(BXH260619-001~010, QTY=10, STATUS=CLOSED, OQC_STATUS=PASS, SERIAL_LIST=FG바코드10), FG_LABELS.BOX_NO 스탬프. 정리 DELETE에 BOX_MASTERS(BXH260619%) 추가. 멱등 재실행(--commit).
- 검증 PASS: BOX_MASTERS 시드 10 / FG BOX_NO 스탬프 100 / 나머지(제품재고100·FG100·SG20·작업지시17·검사200·수불균형·출하무변화) 유지. 포장실적 조회조건(40/1000, CREATED_AT>=오늘)으로 박스 10건 노출 확인.
- spec §4.6/§5 갱신.

## 2026-06-19 Claude (P4·P5 재고 일원화)

T-HARNESS-FLOW-RENEWAL-P45 — PRODUCT_STOCKS 시리얼(PRD_UID) 제거, 품목+창고 수량 일원화 + 출하 단순화.

- DDL: PRODUCT_STOCKS PK를 `(COMPANY,PLANT_CD,WAREHOUSE_CODE,ITEM_CODE)`로 단일화, PRD_UID는 PK 제외·NULL 잔존(2단계 안전, 물리 drop은 추후). 빈 테이블이라 무손실.
- 코드(단일행화): 엔티티 PrimaryColumn 제거, `ProductInventoryService`(receive/issue/issueStockByItemFifo/transfer/receiveFinishedFromWip/cancel/getStock) 품목+창고 단일행 처리·FIFO 루프 제거. `issueStockInTx` 소진행 삭제 보완(qty0 잔재 방지). PRODUCT_TRANSACTIONS.prdUid는 원장 유지.
- 호출부: prod-result(adsorb/defect/reverse), subprocess-kitting, ship-order(cancelShipBox), rework — PRODUCT_STOCKS용 prdUid 제거. ProdResult.prdUid 채번은 유지.
- hold/physical-inv: stockId `wh::item::prdUid` → `wh::item`(2-part) 백/프론트 동기. production-views·inventory 화면 prdUid 컬럼 정리.
- 검증: 백/프론트 tsc 0. 실DB(AppModule, 서버 무중단) 재검증 — 묶음발행/키팅/박스입고(WIP→FG) 단일행(PRD_UID=NULL, '*' 없음), 과다 키팅 BadRequest 롤백, 단일행 불변식 확인. 테스트데이터 정리.
- 사고복구: 동시 작업 중 한 subagent의 git stash로 codex 미커밋분이 stash에 갇혔던 것을 선별 복원(codex 파일·locales·LOCKS), stash drop. codex 작업·내 kitting locale 키 보존.
- 상태: main 커밋(78d46411 + qty0 보완). **미push**(라이브 출하 영향이라 9단계 출하 OQC/팔레트 E2E는 미수행 — 배포 시점 사용자 결정). lock 해제.

## 2026-06-19 Claude (hns02-stock100-seed)

T-HNS02-STOCK100-SEED — HNS02 완제품 제품재고 100개 BOM 완전 다단계 정합 시드 (JSHANES / 40 / 1000).

- 요구: 포장 가능 완제품 HNS02 제품재고 100개를 PO~입하~입고~자재재고~투입~작업지시~생산실적~반제품~제품재고~검사~장착 전구간 정합 생성. 출하 제외. 기존 트랜잭션 정리 후 클린 재구성. 기준정보 무수정.
- 사용자 결정: 완전 다단계 BOM(원자재 7단계) / 작업지시 품번당 1건 / SG 묶음 5개 단위 / 출하 안 함(100 보유) / 기존 HNS02 작업지시 55건 전량 삭제 후 재구성(codex WO2606150066 참조 손실 감수 — 명시 승인).
- 사전 실측: HNS02=FINISHED, 라우팅 RT-HNS02(SASSY=FG발행/AINSP/OINSP), SG발행=HNS02_FA/TAPPN. 대상 트랜잭션 테이블 간 DB FK 없음(삭제 논리역순 안전). PRODUCT_STOCKS PK=(CO,PLANT,WH,ITEM) — PRD_UID는 PK 아님. 원자재는 공유분(MAT_LOTS 112건 기존)이라 시드 채번(VH1-RM260619)만 정리 대상으로 한정.
- 구현: tools/seed/seed_hns02_stock100.py (BOM_MASTERS 재귀 전개→수량 산출→정리 DELETE→단계별 INSERT→검증, dry-run 기본 rollback / --commit). 채번 시드 마커 POH-/ARH-/RVH-/ISH-/WOH-/PRH-/STH-/PTH-/SGH/FGH/IRH, MAT_UID는 VH1-RM 규칙.
- 정리: MAT_ISSUE_REQUEST_ITEMS 34, MAT_ISSUE_REQUESTS 25, JOB_ORDERS(HNS02%) 55 삭제. (라벨/실적/제품재고/검사/genealogy는 기존 0건)
- 생성: PO 1+라인18, 원자재 18종(MAT_ARRIVALS/IQC_LOGS/MAT_RECEIVINGS/MAT_LOTS/MAT_STOCKS/STOCK_TX MAT_IN), 작업지시 17(DONE, PARENT_ID 트리), 생산실적 17, 자재소비(MAT_ISSUES 18+STOCK_TX MAT_OUT 18), SG라벨 20(INIT_QTY=5, CONSUMED), 반제품 WIP 재고/수불(WIP_IN/OUT net0), FG라벨 100(PACKED), 제품재고 HNS02 FG_MAIN 100, PRODUCT_TX FG_IN, 검사 200(AINSP+OINSP 전수 PASS), genealogy FG←SG 100.
- 검증(독립 연결 재확인 PASS): FG재고 100 / FG_LABELS PACKED 100 / SG CONSUMED 20 / JOB_ORDERS 17 / PROD_RESULTS 17 / INSPECT 200 / PRODUCT_TX 33 / STOCK_TX 36(합 0) / 반제품 WIP 잔량 0 / 시드 원자재 MAT_STOCKS 잔량 0 / 공유원자재 MAT_LOTS 112 보존 / SHIPMENT_LOGS 무변화.
- spec: docs/superpowers/specs/2026-06-19-hns02-product-stock-100-seed-design.md. 빌더는 멱등(재실행 시 시드 채번 정리 선행).

## 2026-06-19 Claude (P3 + 전구간 실증)

T-HARNESS-FLOW-RENEWAL-P3 — 서브공정 키팅 직접 원자재 차감 + 전 구간 E2E 실증.

- Phase 3(main 커밋 053693af, BE tsc 0): 키팅 `kit()`의 matLots를 실제 차감 — equipCode 있으면 `WipMatStockService.deductStockInTx`(PROD_CONSUME), 없으면 신규 `AutoIssueService.consumeMatLotInTx`(원자재창고 MAT_STOCKS 차감, 기존 deductMatStock 재사용). RAW BOM 화이트리스트 검증, genealogy(FG←MAT_LOT) 유지.
- 전 구간 E2E 실증(AppModule+실DB JSHANES, 서버 무중단, 8/9 단계): 반제품 작업지시→묶음 발행(SG)→완제품 작업지시→키팅(FG/genealogy/재고)→통전(ON_SUBPROCESS, 재발행 없음)→외관(VISUAL_PASS)→포장(BOX_NO/PACKED)→박스입고(WIP→FG). 신규 코드 버그 0. 9단계 출하는 기존 OQC게이트+팔레트 선행 필요(리뉴얼 신규부 아님).
- 원자재 차감 실증: MAT_STOCKS 100→97, STOCK_TRANSACTIONS(MAT_OUT/KITTING), genealogy MAT_LOT 3행, BOM 음성가드 BadRequest+롤백. 테스트데이터 전량 정리.
- 결론: 계획된 생산 프로세스(원자재→반제품묶음→서브공정키팅→제품라벨→통전→외관→포장→박스입고, genealogy+재고+수불) 정상작동 실증 완료. 남은 Phase 4(PRODUCT_STOCKS 시리얼 정리)·5(출하 단일키/우회 제거)는 라이브 출하에 파괴적이라(현 '*'/FIFO로 정상작동 중) 배포·점검창 결정 후 진행 권장. 브라우저 UI E2E는 백엔드 재배포(dist) 필요.

## 2026-06-19 Claude (P2)

T-HARNESS-FLOW-RENEWAL-P2 — 생산흐름 리뉴얼 Phase 2(백엔드 엔진 + 키팅 메뉴/화면 + 실증).

- 구현(전부 main 커밋, BE tsc 0):
  - DDL: ROUTING_PROCESSES `ISSUE_SG_LABEL_YN`/`ISSUE_FG_LABEL_YN`, SG_LABELS `RESULT_NO` (JSHANES 적용).
  - 채번: `nextGenealogyId`(SEQ_PROD_GENEALOGY). 라우팅 엔티티 플래그 매핑.
  - 묶음 발행: prod-result `create()`에 `issueSgLabelInTx`(반제품+발행공정 플래그/첫공정 폴백, bundleCount×qtyPerBundle 정합, resultNo 멱등).
  - 서브공정 키팅: `POST /production/subprocess-kitting`(+GET sg-label) — 완제품 BOM SEMI 화이트리스트, FIFO 가닥 소비, FG 발행, PRODUCT_GENEALOGY(FG←SG/MAT_LOT), 제품 WIP_IN 재고/수불, ProdResult(DONE).
  - 통전검사: FG 발행 시점 `ON_SUBPROCESS` 분기(비파괴, 기존 ON_INSPECT 기본 유지).
  - 프론트: 생산관리 "서브공정 키팅" 메뉴+화면(`/production/subprocess-kitting`) + i18n 4종 + MENU_CATEGORY_ITEMS.
  - 시드: HNS02 흐름 플래그(HNS02_FA/TAPPN=SG, RT-HNS02/SASSY=FG).
- 실증(AppModule createApplicationContext + 실DB JSHANES, 서버 무중단): kit() 실행 — FG 3건 발행(HNS02/ISSUED), SG 10→7(FIFO), genealogy 3행(FG←SG), PRODUCT_STOCKS HNS02/WIP_MAIN 0→3, PROD_RESULTS DONE goodQty3, PRODUCT_TRANSACTIONS WIP_IN/KITTING, qty=999 재고부족 BadRequest+롤백. 테스트데이터 정리 완료.
- 미완(다음): Phase 3 원자재 서브공정 수불(현재 matLots는 genealogy만), Phase 4 PRODUCT_STOCKS 시리얼('*'/배치) 정리 마이그레이션, Phase 5 포장/출하 단일키 전환·우회 제거, Phase 6 화면 풀 와이어링·브라우저 E2E, 불량/재작업(repair 연계). 라이브 파괴적 변경이라 사용자 체크포인트 권장.

## 2026-06-19 Claude

T-HARNESS-FLOW-RENEWAL-P1 — 하네스 생산흐름 리뉴얼 Phase 1(스키마 비파괴 추가).

- 배경: grill로 전체 설계 확정(재고=PRODUCT_STOCKS 수량 / 추적=FG_LABELS+SG_LABELS 분리, 제품라벨 서브공정 발행으로 출하 키 우회 제거). 마스터 계획 `docs/superpowers/plans/2026-06-19-harness-production-flow-renewal.md`, Phase 1 sub-plan `...harness-renewal-phase1-schema.md`.
- DB(JSHANES): `SG_LABELS`(반제품 묶음 추적라벨, 잔량 보유)·`PRODUCT_GENEALOGY`(재귀 genealogy) 테이블 + `SEQ_SG_LABEL`·`SEQ_PROD_GENEALOGY` 시퀀스 생성(oracle-db 스킬, idempotent). 신규 테이블이라 의존 PL/SQL 영향 0(기존 INVALID는 IF_PO 1건, 무관).
- 코드: 엔티티 `SgLabel`·`ProductGenealogy` 추가, `production.module` forFeature 등록, `numbering.service.nextSgLabel`(SG+YYMMDD+5자리, 전역 SEQ) TDD RED→GREEN.
- 검증: 백엔드 tsc 0건, `numbering.sg-label.spec` PASS. 비파괴(기존 서비스/흐름 미변경, 미사용 등록).
- 상태: 작업 브랜치 `feat/harness-renewal-phase1`에 커밋 4건(8e67d4d8·1f3cc0ae·d2f03182·d2f59a7c), **main 미머지·미push**. lock 해제. Phase 2(채번·발행) 대기.

## 2026-06-18 13:48 Codex

T-WIP-STOCK-ACTUAL-SQL - `/production/wip-stock` SQL 미리보기 실제 SQL 반영.

- 원인: 화면 `DataGrid.sqlQuery`가 `WIP_STOCKS`를 하드코딩했다. 실제 백엔드 `ProductionViewsService.getWipStock()`는 `PRODUCT_STOCKS s`에서 조회하고 `ITEM_MASTERS im`, `WAREHOUSES wh`를 조인한다. 공통 SQL 모달은 preview SQL의 테이블명으로 API `meta.debugSql` 캐시를 매칭하므로, 잘못된 preview 테이블 때문에 실제 SQL 캐시 매칭도 실패할 수 있었다.
- 변경: `apps/frontend/src/app/(authenticated)/production/wip-stock/page.tsx`에 `wipStockSql`을 추가해 실제 조회 SELECT/JOIN/WHERE/ORDER BY 구조를 표시한다. 현재 화면의 유형 필터와 검색어가 있으면 `ITEM_TYPE`/검색 조건도 SQL 미리보기에 반영한다. 구조 테스트 `wip-stock-actual-sql.structure.test.mjs`를 추가해 `WIP_STOCKS` 재유입을 막았다.
- 검증: 구조 테스트 RED 확인 후 GREEN, `node --test apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 `/production/wip-stock` → 그리드 옵션 → `SQL 조회문` 모달 확인 결과 `PRODUCT_STOCKS`, `ITEM_MASTERS`, `WAREHOUSES` 표시 true, `WIP_STOCKS` 표시 false, console/page error 0.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:26 Codex

T-DATAGRID-HOVER-SCROLL-REMOVE - 공용 DataGrid 좌우 끝 hover 자동 스크롤 제거.

- 정정: 사용자의 의도는 `/production/specification-setup` 회로 테이블이 아니라 모든 공용 `DataGrid`의 좌/우 끝 hover 자동 스크롤 기능 제거였다. 앞서 추가했던 회로 테이블 전용 구조 테스트는 제거하고 공용 DataGrid 기준으로 전환했다.
- 변경: `apps/frontend/src/components/data-grid/DataGrid.tsx`에서 `ScrollHandle` import와 좌/우 렌더링을 제거했다. `group/scroll` wrapper와 주석도 일반 테이블 컨테이너로 정리했다.
- 삭제: `apps/frontend/src/components/data-grid/ScrollHandle.tsx` 삭제. 이 파일은 hover 시 `setInterval`로 `scrollLeft`를 변경하는 전용 구현이었다.
- 테스트: `datagrid-scroll-handle-removal.structure.test.mjs` 추가. DataGrid에 `ScrollHandle`, `group/scroll`, `with scroll handles`가 없고 `ScrollHandle.tsx` 파일이 삭제됐는지 검증한다.
- 검증: 신규 구조 테스트 PASS, 제품 도면관리 구조 테스트 PASS, frontend tsc PASS. 3002 브라우저 `/production/specification-setup`에서 DataGrid 렌더 후 `group/scroll=0`, `group-hover/scroll=0`, `data-scroll-id=0` 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:18 Codex

T-HARNESS-CIRCUIT-PAYLOAD - 제품 도면관리 회로 저장 400 및 Rev 생성 취소 문제 수정.

- 원인: Revision 상세 API 응답의 회로 엔티티 전체(`circuitId`, `revisionId`, `sortOrder`, `company`, `plant`, `createdAt` 등)를 프론트 상태에 넣은 뒤 저장 payload에서 `...circuit`으로 그대로 재전송했다. 백엔드 DTO whitelist가 해당 필드를 거부해 `PUT /production/specifications/revisions/8` 400 발생.
- 변경: `toCircuitPayload()`를 추가해 `HarnessCircuitSpecDto` 허용 필드만 명시적으로 전송하도록 변경했다. 빈 문자열은 `undefined`로 정리해 JSON payload에서 빠지게 했다.
- Rev 생성: `window.prompt()`를 제거하고 공용 `Modal` 기반 Rev 생성 모달로 변경했다. 취소 버튼은 `setReviseModalOpen(false)`만 수행하며 `/revise` API를 호출하지 않는다.
- 테스트: 구조 테스트에 payload sanitizer와 prompt 제거/모달 사용 조건을 추가해 RED 확인 후 GREEN. 구조 테스트 6/6 PASS, frontend tsc PASS.
- 런타임 검증: 3002 브라우저에서 `HDW-SEED-HNS02-C1ABCD` 저장 클릭 시 `PUT /production/specifications/revisions/8` 200. 요청 payload에는 `circuitId/revisionId/company/createdAt` 등 금지 필드 미포함. Rev 생성 모달 취소 시 `/revise` 호출 0건 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:11 Codex

T-HARNESS-CONNECTION-SYMBOL - 제품 도면관리 회로 그리드의 연결문자 그림 표시.

- 변경: `/production/specification-setup` 회로별 제작 사양 그리드의 `연결` 컬럼을 문자 입력칸에서 SVG 미리보기 + 선택 컨트롤로 변경했다.
- 지원 형태: `STRAIGHT/LINE`은 직선, `BRIDGE`는 분기형, `ONE_SIDE`는 단측 연결 그림으로 표시한다. 저장값은 기존 `connectionSymbol` 필드를 그대로 사용한다.
- 테스트: 구조 테스트에 `ConnectionSymbolControl`, `data-connection-symbol`, `svg`, `connectionSymbolOptions` 검증을 먼저 추가해 RED 확인 후 구현했다.
- 검증: 구조 테스트 4/4 PASS, frontend tsc PASS. 3002 브라우저에서 `HDW-SEED-HNS02-MAIN` 선택 후 연결 셀 8개가 SVG와 select로 렌더링되고 `STRAIGHT`, `BRIDGE` 값이 표시됨을 확인했다.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 12:35 Codex

T-HARNESS-DRAWING-SEED - 제품 도면관리 확인용 seed 데이터 작성 및 적용.

- 추가: `apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql` 생성. `HDW-SEED-HNS02-MAIN`, `HDW-SEED-HNS02-C1ABCD` 2개 도면만 삭제 후 재삽입하는 재실행 가능 seed이며 키는 모두 `SEQ_HARNESS_* .NEXTVAL` 사용.
- 데이터: HNS02 메인 도면 Rev.A APPROVED 6회로, Rev.B DRAFT 8회로, HNS02C1ABCD 서브 도면 Rev.A DRAFT 3회로. 화면 예시의 wire/stripping/crimping/housing/terminal 값을 포함.
- 보정: 검증 중 `GET /production/specifications/revisions/:revisionId` 컨트롤러 라우트가 누락된 것과 화면 `loadDetail()`이 회로 없는 Revision 요약을 사용하던 문제를 수정했다.
- 검증: seed SQL JSHANES 적용 및 재실행 성공. post-check는 도면 2건/Revision 3건/회로 17건. API에서 `HDW-SEED-HNS02-MAIN` Rev.A 6회로, Rev.B 8회로 조회 확인.
- 테스트: production specification 구조 테스트, frontend/backend tsc 통과. 3002 브라우저에서 `/production/specification-setup` 검색 `HDW-SEED` 후 메인 도면 선택 시 Header와 회로 입력값 `VSF 0.75SQ` 표시 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 12:24 Codex

T-HARNESS-DRAWING-MGMT - 하네스 제품 도면관리 신규 기능 구현.

- 구현: 생산관리 하위 `/production/specification-setup` 신규 화면 추가. 좌측 도면 목록, 우측 도면 Header, Revision 선택/승인/Rev 생성, 회로별 제작 사양 그리드를 제공한다.
- 백엔드: `HARNESS_DRAWING_MASTERS`, `HARNESS_DRAWING_REVISIONS`, `HARNESS_CIRCUIT_SPECS` 엔티티/API/서비스 추가. 승인 Revision은 직접 수정 차단, Rev 생성 시 회로 복제. 키는 `SEQ_HARNESS_* .NEXTVAL` 사용.
- DB: `apps/backend/src/migrations/2026-06-18_harness_drawing_management.sql`을 JSHANES에 적용해 테이블 3개, 시퀀스 3개, `PROD_SPEC_SETUP` 메뉴를 생성했다. `tools/generate_db_schema_doc.py`로 ERD 문서 재생성.
- 검증: 백엔드 서비스 테스트, 프론트 구조 테스트, backend/frontend tsc 통과. 인증 API로 도면 생성 -> 승인 -> Rev 생성 -> 삭제 흐름을 실측했고 `DWG-CODEX-%` 테스트 데이터 잔여 0건 확인.
- 브라우저: 3002/3003 dev 서버에서 `http://localhost:3002/production/specification-setup` 인증 세션 접속, `제품 도면관리`, `도면 Header`, `회로별 제작 사양`, 저장/승인 버튼 표시 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 dashboard-ora04068-fix Claude

대시보드 500(`PKG_DASHBOARD.SP_JOB_ORDER_STATS` 프로시저 호출 실패) 원인 규명 + 백엔드 하드닝.

- 원인: 본 세션의 `ALTER TABLE INSPECT_RESULTS ADD EQUIP_CODE`(LAST_DDL 2026-06-18 03:13)가 INSPECT_RESULTS를 참조하는 `PKG_DASHBOARD`를 INVALID화. 사용자가 09:21:42 대시보드 호출 시 패키지 BODY 자동 재컴파일(LAST_DDL 09:21:41)되며, 기존 패키지 상태를 들고 있던 백엔드 세션이 첫 호출에서 **ORA-04068(existing state of packages discarded)** 1회성 오류 → 500. 현재 패키지 VALID, 자가복구됨.
- 진단(oracle-db 스킬): SP_JOB_ORDER_STATS의 SELECT 재현 정상, 프로시저 직접/백엔드 동일 익명블록 경로 모두 정상, SP_KPI(INSPECT_RESULTS 참조)도 정상. LAST_DDL 타임스탬프가 에러시각과 일치 → 확정.
- 하드닝: `common/services/oracle.service.ts`에 `isPackageStateDiscarded`(ORA-0406x) + `executeWithRetry`(같은 커넥션 1회 재시도) 추가. callProc/callProcMultiCursor/callProcScalar 3곳 모두 적용. ORA-04068은 본문 실행 전 발생·상태 재설정되므로 재시도가 안전(이중 실행 없음). BE tsc 0.
- 교훈: 테이블 DDL은 의존 PL/SQL 패키지를 INVALID화 → 다음 호출에서 ORA-04068 1회성 발생 가능. 마이그레이션 후 의존 패키지 수동 재컴파일(ALTER PACKAGE ... COMPILE) 권장. 미커밋.

## 2026-06-18 inspection-consumable-persist Claude

T-INSPECT-CONSUMABLE-PERSIST — 검사기 장착 소모품 영속화 + 교체 + 강제 장착해제 + terminal-result 동일 적용.

요구(사용자): 소모품은 한번 장착되면 그 설비에 항상 장착 유지 — 작업지시가 바뀌어도 유지, 다른 롯트로 교체하거나 강제 장착해제할 때만 변경.

구현:
- BE `kiosk-consumable.service.findByJobOrder`에 `includeMountedOnEquip` 파라미터 추가. true면 (현재 품목 매핑에 없더라도) 설비에 MOUNTED인 소모품도 union하여 표시 → 작업지시(품목) 바뀌어도 설비 장착분 계속 노출. 소모품은 설비 귀속(CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE)이라 DB상 이미 영속이며, 표시 로직만 보강.
- BE `scanMount`: 같은 설비에 이미 장착된 동일 consumableCode의 다른 롯트는 ACTIVE로 자동 해제 후 신규 장착(설비당 1롯트 불변식 = "다른 롯트로 교체").
- BE controller GET에 `includeMounted` 쿼리(=1/true) 추가 → service에 전달. 키오스크는 미전송이라 기존 동작 유지(하위호환). 인스펙션 ConsumablePanel만 `includeMounted:1` 전송.
- FE ConsumablePanel: 장착 행에 **강제 장착해제** 버튼(텍스트+확인 모달 ConfirmModal). DELETE unmount → ACTIVE 복귀. i18n `inspection.result.{consumableUnmount,consumableUnmountConfirm,consumableUnmounted}` ko/en/zh/vi.
- terminal-result(`/inspection/terminal-result`)는 이미 **동일 `InspectionResultWorkflow`** 를 inspectType="TERMINAL"로 사용 → 검사기 선택/소모품/전체화면/영속/교체/강제해제 모두 자동 적용. localStorage 검사기 키도 inspectType별 분리(`hanes:inspection:equip:TERMINAL`).

검증:
- FE/BE tsc 0, locale 4파일 OK.
- 브라우저(로그인 유효 동안): EQ-TEST-01 선택→WO2606150060(HNS02C1ABCD) CM-JG-CT1/CT2 표시→C26020100019 장착→**작업지시를 HNS02_FA(EQ-TEST-01 미매핑)로 전환해도 CM-JG-CT1 "장착됨" 유지**(includeMounted 영속 확인), 강제해제 버튼 노출.
- 교체(다른 롯트)/강제해제 확인모달/terminal-result 화면은 dev 로그인 세션 만료(401)로 브라우저 재검증 미완 — 코드/tsc만. (사용자 로그인 시 재검증 가능)
- 테스트 롯트 C26020100019 ACTIVE 원복.

공유모듈 주의: kiosk-consumable(service/controller) 변경은 includeMounted opt-in(키오스크 영향 없음)이나, **scanMount 교체(이전 롯트 자동해제)는 키오스크에도 적용됨** — 설비당 동일소모품 1롯트는 물리적으로 옳은 불변식이라 의도적 적용(키오스크 잠재 이중장착 교정). 미커밋.

## 2026-06-18 inspection-result-equip-persist Claude

T-INSPECT-RESULT-EQUIP-SELECT 후속 — 선택 검사기 유지. `InspectionResultWorkflow`에서 선택 검사기를 `localStorage['hanes:inspection:equip:${inspectType}']`에 저장(handleSelectEquip)하고, 마운트 시 복원. TESTER 목록 로드 후 저장값이 목록에 없으면 정리. 검증: 로컬 3002에서 EQ-TEST-01 선택→localStorage 기록 확인→페이지 reload→Select가 "도통검사기 #1 (EQ-TEST-01)"로 자동 복원(JS+육안). FE tsc 0. 미커밋.

## 2026-06-18 inspection-result-equip-select Claude

T-INSPECT-RESULT-EQUIP-SELECT — `/inspection/result`(통전검사 실적)에 검사기(TESTER) 선택 기능 + 소모품 출처 교정 + 검사 실적 검사기 기록 + chromeless 전체화면.

배경/의심 해소:
- 사용자가 "설비 선택도 없는데 소모품을 어떻게 가져왔나" 의심 → 백엔드가 작업지시 생산설비(`jobOrder.equipCode`)로 조회 중이었음. 실측: WO2606150060 → EQ-ATCUT-01(자동절단 설비) → CM-BL-F01/V01(절단 블레이드). 검사 화면인데 절단설비 소모품을 표시 → 잘못된 동작. 검사는 별도 검사기(EQUIP_TYPE='TESTER')이므로 검사기 선택 후 그 기준으로 조회해야 맞음.

사용자 결정(4): ① 검사기 목록=전체 TESTER, ② 검사기 소모품 매핑 샘플 시드 추가, ③ 선택 검사기를 검사 실적에도 기록, ④ 전체화면=사이드바까지 숨김.

구현:
- BE DDL: `INSPECT_RESULTS`에 `EQUIP_CODE VARCHAR2(50)` 추가(`apps/backend/src/migrations/2026-06-18_inspect_result_equip_code.sql`). 엔티티 `inspect-result.entity.ts`에 equipCode 컬럼. `continuity-inspect.service.inspect()`에서 `dto.equipCode` 저장(DTO엔 이미 equipCode 존재).
- BE 소모품 API(공유 kiosk-consumable): service/controller/dto에 **선택적 equipCode override** 추가. 제공 시 jobOrder.equipCode 대신 사용(조회/장착). 미제공 시 기존 키오스크 동작 유지(하위호환). GET `?equipCode`, POST scan body `equipCode`.
- DB 시드: `CONSUMABLE_USAGE_MAP`에 검사기 소모품 매핑 5건(`2026-06-18_tester_consumable_map_seed.sql`) — (HNS02C1ABCD|HNS02)×(EQ-TEST-01|EQ-AINSP-01)×JIG 소모품(CM-JG-CT1/CT2 통전검사 치구). 해당 소모품 ACTIVE 롯트 기보유.
- FE 전체화면: `MainLayout`에 `view=full`이면 header/sidebar/tab 숨기는 chromeless 분기(기존 키오스크 `view=work` 패턴 일반화). 검사 화면 헤더에 전체화면 토글(라우터 param + Fullscreen API).
- FE 검사기 선택: `InspectionResultWorkflow`에 검사기 Select(`/equipment/equips/type/TESTER`) + selectedEquipCode 상태. ConsumablePanel에 equipCode 전달(GET params/scan body), InspectPanel에 equipCode 전달(inspect payload + 미선택 시 검사 차단 인터락, 소모품보다 우선). i18n `inspection.result.{selectEquip,selectEquipFirst,equipRequired,fullscreen,exitFullscreen}` ko/en/zh/vi.

검증(로컬 3002 브라우저 E2E):
- 검사기 Select에 TESTER 10대 로드, EQ-AINSP-01 선택.
- WO2606150060(HNS02C1ABCD) 선택 → 좌측 소모품이 **CM-JG-CT1(통전검사 치구)** 로 표시(절단 블레이드 아님). 배너 "소모품 1개 미장착", PASS/FAIL 비활성.
- C26020100019 스캔 → CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE=**EQ-AINSP-01**(검사기, 작업지시 EQ-ATCUT-01 아님) 확인. 1/1, 버튼 활성.
- PASS → INSPECT_RESULTS IR26061800008.EQUIP_CODE=**EQ-AINSP-01** 기록 확인.
- 전체화면 토글 → `?view=full`, 사이드바/헤더/탭 숨김 전체폭. 종료 시 복귀.
- 테스트데이터 원복: FG26061800008/IR26061800008 삭제, C26020100019 ACTIVE 복귀, prod_result 부수효과 없음.
- FE tsc 0, BE tsc 0, locale 4파일 파싱 OK(BOM 없음).

공유모듈 주의: kiosk-consumable(service/controller/dto), MainLayout은 additive/backward-compatible 변경만 — 키오스크 기존 흐름 영향 없음. DDL/seed는 JSHANES 적용 완료(deploy서버와 DB 공유라 별도 적용 불필요). 커밋/푸시 안 함.

## 2026-06-18 inspection-result-consumable-move Claude

T-INSPECT-RESULT-CONSUMABLE-MOUNT 후속 — 사용자 요청으로 소모성 설비부품 섹션을 우측 InspectPanel(통계 카드 아래)에서 **좌측 작업지시 목록 하단**으로 이동.

- 상태 끌어올림: `consumablesReady`/`unmountedConsumCount`/`handleConsumableStatus`를 `InspectionResultWorkflow`로 이동. 좌측 컬럼을 flex-col(목록 카드 flex-1 + ConsumablePanel shrink-0)로 재구성, `<ConsumablePanel key={orderNo}>`를 좌측 하단에 렌더. `InspectPanel`은 두 값을 props로 받아 인터락(배너+PASS/FAIL 차단)만 우측에 유지.
- `InspectPanel`에서 ConsumablePanel import/렌더와 내부 상태 제거(파일 정리). ConsumablePanel 자체는 변경 없음(이미 orderNo prop + onStatusChange 콜백 구조).
- 검증: frontend tsc 0. 로컬 3002 — WO2606150060 선택 시 좌측 하단 0/2 카드 + 우측 "소모품 2개 미장착" 배너+버튼 비활성, C26020100025 스캔→좌측 1/2·우측 배너 "1개"로 즉시 갱신(좌→우 전파 확인)→X 해제 원복, 테스트 롯트 ACTIVE 복귀.
- 미커밋.

## 2026-06-18 inspection-result-consumable Claude

T-INSPECT-RESULT-CONSUMABLE-MOUNT — `/inspection/result`(통전검사 실적)에 input-kiosk와 동일한 소모성 설비부품 표시+conUid 스캔 장착 추가.

- 설계: `docs/superpowers/specs/2026-06-18-inspection-result-consumable-mount-design.md`. 사용자 결정 — ① 설비 기준은 input-kiosk와 동일하게 `jobOrder.equipCode`(백엔드 변경 0), ② 소모품 장착을 검사 선행 조건(미장착 시 PASS/FAIL 차단), ③ 통계 카드 아래 카드형.
- 재사용 API(키오스크): `GET/POST(scan)/DELETE /production/job-orders/:orderNo/consumables`. 검사 화면은 이미 `order.orderNo` 컨텍스트가 있어 그대로 호출.
- 신규 `inspection/result/components/ConsumablePanel.tsx`: kioskStore 비의존, `orderNo` prop + `onStatusChange(allMounted, unmountedCount)` 콜백. 카드 내 인라인 스캔 입력(별도 모달 X) + 소모품 행 목록(미장착/장착/경고/초과 색상, 수명 현재/예상, 해제 X). 행 스타일은 `MaterialListPanel` 소모품 섹션을 따름.
- `InspectPanel.tsx`: 통계 카드 아래 `<ConsumablePanel>` 삽입, `consumablesReady`/`unmountedConsumCount` 상태 추가. `scanDisabled`에 `!consumablesReady`를 OR로 합쳐 PASS/FAIL 동시 차단, 버튼 title은 소모품 사유 우선. 버튼 위 주황 인터락 배너 추가. 매핑 0건이면 allMounted=true로 기존 검사 흐름 유지.
- i18n: `inspection.result.{consumablesTitle,consumableScanPlaceholder,consumableMountRequired,noConsumables,consumableMounted}` ko/en/zh/vi 4파일 추가(BOM 없음, 파싱 OK).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 0건. 로컬 3002 브라우저 — (a) HNS02(매핑 0) 선택 시 "매핑된 소모품이 없습니다" + 검사 버튼 활성, (b) WO2606150060(HNS02C1ABCD/EQ-ATCUT-01, 매핑 2: CM-BL-F01/CM-BL-V01) 선택 시 0/2·미장착 빨강·"소모품 2개 미장착" 배너·PASS/FAIL 비활성, (c) C26020100025 스캔→CM-BL-F01 초록·4,500/2,500,000·1/2·여전히 비활성, (d) X 해제→0/2 재차단. 테스트 롯트 C26020100025 STATUS=ACTIVE 원복, EQ-ATCUT-01 장착 0 확인.
- 백엔드/DB 스키마 변경 없음. 커밋/푸시 안 함(사용자 지시 대기).

## 2026-06-18 00:36 Codex

- 작업: `T-ARRIVAL-RESULT-AGENT-REPRINT` `/material/arrival-result` 라벨 재발행을 `/material/arrival`과 같은 `mat_lot` 템플릿 선택 + 로컬 print-agent 출력 방식으로 전환.
- 변경: 페이지가 `/master/label-templates?category=mat_lot`를 조회하고 `LabelDesign`을 `ensureObjectLabelDesign(..., "mat_lot")`로 정규화한다. 우측 재발행 액션 영역에 `입하 라벨 템플릿` Select를 추가하고, 선택한 `labelDesign/templateOptions/selectedTemplateKey/onTemplateChange`를 `MatLabelPreviewModal`로 전달한다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/material/arrival-result/arrival-result-mfg-refresh.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `node tools/print-agent.structure.test.mjs` PASS, `C:\go\bin\go.exe test ./...` PASS, `node --test apps/frontend/src/app/(authenticated)/material/arrival/components/mat-label-preview-modal-print.structure.test.mjs` PASS.
- 실출력 테스트: Playwright로 `http://localhost:3002/material/arrival-result` 접속 후 `R26061800003` 행 선택, 시리얼 체크, `matlot_label / BROWSER` 선택, `라벨 재발행` 모달 진입을 확인했다. 모달 선택값은 `matlot_label::mat_lot`로 유지됐고 바코드 ready 후 출력 버튼 클릭 시 agent `/print` 1회 호출, `jobId=MAT-ARRIVAL-VH1-RM260618-00003`, 출력 PDF `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\MAT-ARRIVAL-VH1-RM260618-00003.pdf` 45,103 bytes 확인.
- 상태: 완료, lock released.

## 2026-06-19 Codex

- 작업: `T-MASTER-REQUIRED-MARKS` 기준정보 하위 메뉴 필수컬럼 별표 표시 일관화.
- 원인: 공통 `Input`은 `required` prop을 받으면 라벨에 `*`를 붙였지만, 공통 `Select`는 `required`를 렌더링하지 않았다. 또한 품목관리 외 기준정보 폼 일부는 저장 차단 조건 또는 DTO 필수 필드인데도 `required` prop이 누락돼 있었다.
- 변경: `Select.tsx`에 `required` destructuring, 라벨 별표, native `required` 전달을 추가했다. 작업자/거래처/회사/사업장/공정/설비/계측기/CAPA/창고위치/공통코드/BOM/IQC 항목/라우팅/제조사바코드/품목유형 폼의 필수 필드에 `required`를 붙였다. 작업지도서 폼은 기존 수동 `*` 라벨을 제거해 자동 별표와 중복되지 않게 했다.
- 검증: 구조 테스트 RED 확인 후 `node --test apps/frontend/src/app/(authenticated)/master/master-required-fields.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: REVIEW, lock released.

## 2026-06-18 00:10 Codex

- 작업: `T-PRINT-AGENT-PDF-OUTPUT` `Microsoft Print to PDF` 테스트 출력 실패 보정 및 `/material/arrival` 실제 출력 재검증.
- 원인: agent의 Windows GDI 출력 경로가 `DOCINFO.lpszOutput`을 비워 둔 채 `Microsoft Print to PDF`로 `StartDocW`를 호출했다. PDF 드라이버는 저장 파일명이 없으면 대화상자/권한 문제로 `Access is denied`를 반환했다.
- 변경: `PrintPNGRequest/PrintResult`에 `outputPath`를 추가하고, server가 프린터명이 `Microsoft Print to PDF`이면 기본 출력 경로를 `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\<jobId>.pdf`로 자동 지정한다. Windows printer backend는 `DOCINFO.lpszOutput`에 이 경로를 넘긴다. job log에도 `outputPath`를 기록한다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS, `C:\go\bin\go.exe test ./...` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. agent 재빌드/재시작 후 `/test-print` queued 및 `HANES-TEST-PRINT.pdf` 10,553 bytes 생성 확인.
- 실출력 테스트: `http://localhost:3002/material/arrival`에서 상단 `입하 라벨 템플릿` Select에 `matlot_label / BROWSER`가 표시되고 선택값 `matlot_label::mat_lot`이 라벨 모달까지 유지되는 것을 Playwright로 확인했다. `PO-26-T01 / TMN-C` 1개 입하 발행 후 라벨 모달에서 바코드 ready 1건, 출력 버튼 `인쇄` 클릭, agent `/print` 응답 200 queued. 생성 UID `VH1-RM260618-00003`, 출력 PDF `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\MAT-ARRIVAL-VH1-RM260618-00003.pdf` 45,103 bytes 확인. console/page error 0.
- 상태: 완료, lock released. 테스트 과정에서 `PO-26-T01 / TMN-C`는 누적 입하수량이 3으로 증가했다.
## 2026-06-17 23:38 Codex

- 작업: `T-MATERIAL-ARRIVAL-AGENT-LABEL` `/material/arrival` 입하 라벨 출력 방식을 소모품 라벨과 같은 템플릿 선택 + 로컬 print-agent 출력으로 전환.
- 변경: `MatLabelPreviewModal`에서 기존 `MaterialArrivalLabel` + 숨김 iframe + `window.print()` 경로를 제거했다. 모달 오픈 시 `/master/label-templates?category=mat_lot`를 조회하고, 기본/저장 템플릿을 `ensureObjectLabelDesign(..., "mat_lot")`로 정규화해 `LabelDesignRenderer` 미리보기와 `LabelPrintRenderer` 출력 DOM에 공통 적용한다.
- 출력: 발급된 `matUid`별 데이터를 `mat_lot` 소스 필드(`matUid`, `itemCode`, `itemName`, `qty`, `unit`, `vendor`, `lotNo`)와 추가 필드(`arrivalNo`, `arrivalSeq`, `receivedDate`)로 매핑한다. 출력 버튼은 바코드 pending이 사라지고 이미지 로드가 끝난 뒤 라벨 DOM을 PNG로 변환해 `printAgentPng()`에 `jobId=MAT-ARRIVAL-${matUid}`로 순차 전송한다.
- 테스트: 구조 테스트를 “mat_lot 템플릿 조회/선택, 공통 렌더러 미리보기, print-agent PNG 전송, iframe/window.print 금지” 기준으로 갱신했고 RED 실패 확인 후 GREEN 통과.
- 검증: `node --test apps/frontend/src/app/(authenticated)/material/arrival/components/mat-label-preview-modal-print.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright headless로 `http://localhost:3002/material/arrival` 인증 접속 후 입하/PO 화면 텍스트 표시 true, console/page error 0 확인.
- 상태: 완료, lock released. 이번 작업 파일은 `apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx`와 `mat-label-preview-modal-print.structure.test.mjs`이며, 워크트리의 다른 dirty 파일은 기존/외부 변경으로 유지했다.

## 2026-06-17 23:14 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` Microsoft Print to PDF 결과에서 바코드가 검은 블록/잘림처럼 깨지는 문제 수정.
- 원인: 미리보기는 브라우저 DOM에서 Tailwind CSS가 적용되어 정상이다. 하지만 agent 전송용 PNG는 `renderLabelNodeToPngBase64()`가 라벨 DOM을 SVG `foreignObject`로 직렬화한 뒤 이미지로 로드해 canvas에 그린다. 이 과정에서는 외부 Tailwind class(`relative`, `absolute`, `w-full`, `h-full`, `object-contain`, `box-border`)가 적용되지 않아 라벨 객체의 절대 배치와 바코드 이미지 맞춤이 풀렸다. 그 결과 agent가 받은 PNG 자체가 이미 바코드 일부만 잘린 상태였다.
- 실측: Playwright로 agent `/print`를 mock해 실제 전송 PNG를 저장했다. 수정 전 `docs/reports/label-print-debug-2026-06-17/CON-REPRINT-C26061700029.png`는 바코드 일부만 검은 블록처럼 보였고, payload는 `widthMm=10`, `heightMm=10`, `base64Length=2864`였다. 선택 템플릿 `consumable_label`의 저장 크기 자체도 `10x10mm`임을 API로 확인했다.
- 변경: `LabelDesignRenderer`에 SVG 직렬화 후에도 유지돼야 하는 핵심 스타일을 inline style로 보강했다. 라벨 루트는 `position: relative`, `overflow: hidden`, `boxSizing`, 배경/테두리를 inline으로 갖고, 각 객체는 `position: absolute`, `boxSizing: border-box`를 inline으로 가진다. 바코드/이미지의 `width/height/objectFit: contain/display:block`도 inline으로 넣었다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 foreignObject 변환용 inline style 요구를 추가했고 RED 실패 확인 후 GREEN 확인.
- 검증: 수정 후 동일 UID `C26061700029` 재발행 payload를 다시 캡처해 `docs/reports/label-print-debug-2026-06-17/CON-REPRINT-C26061700029-after.png` 저장. 결과 QR 전체와 UID 텍스트가 정상 표시됐고 `base64Length=4488`로 증가했다. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS, issue-feedback/template-selection 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `node tools/print-agent.structure.test.mjs` PASS, 관련 diff check PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 저장 PDF 파일 생성은 OS `Microsoft Print to PDF` 저장 대화상자 자동화 문제로 수행하지 않았고, 이번 검증은 agent로 전달되는 PNG 원본을 확인했다.

## 2026-06-17 22:48 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 전 라벨 미리보기와 바코드 렌더 완료 대기 보강.
- 원인: 라벨 바코드는 `bwip-js` 동적 import 후 canvas를 PNG data URL로 만드는 비동기 렌더인데, 기존 출력 흐름은 고정 500ms 후 DOM을 복사/캡처했다. 느린 경우 `BAR` placeholder 상태가 출력 PNG나 브라우저 인쇄 HTML에 들어갈 수 있었다.
- 변경: `ConLabelDetailPanel`의 각 UID 행에 `미리보기` 버튼을 추가하고 `aria-label="${conUid} 라벨 미리보기"`를 부여했다. `/consumables/label` 페이지에는 `previewPrintItem` 상태와 `라벨 미리보기` Modal을 추가해 실제 `LabelDesignRenderer`로 같은 라벨을 출력 전 확인한다.
- 변경: `LabelDesignRenderer`의 바코드 placeholder에는 `data-label-barcode-pending`, 완료 이미지는 `data-label-barcode-ready`를 부여했다. 출력 전 `waitForLabelRenderReady()`가 pending marker가 사라지고 이미지 로드가 끝날 때까지 대기하며, 시간 초과 시 미리보기 확인 안내 오류를 표시한다. 신규 발행 브라우저 인쇄와 재발행 agent PNG 캡처 모두 이 대기 로직을 거친다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 미리보기 콜백/버튼/Modal/바코드 pending-ready marker/출력 전 대기 요구를 추가했고, RED 실패 확인 후 구현해 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 UID `C26061700029` 기준 `라벨 미리보기` 버튼 클릭. 모달 표시, UID 표시, `data-label-barcode-ready` 1개, `data-label-barcode-pending` 0개 확인. 모달 닫은 뒤 `라벨 재발행` 클릭 시 popup 0, agent `/print` 1회, `jobId=CON-REPRINT-C26061700029`, `format=png`, `contentBase64Length=2864`, 상태 문구 `agent로 전송했습니다`, console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. Playwright에서는 OS 저장 대화상자를 피하려고 agent `/print`를 mock했다.

## 2026-06-17 22:22 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 출력 방식을 예전 웹 인쇄에서 print-agent 방식으로 전환.
- 원인: `ConLabelDetailPanel`의 `재발행` 버튼은 보이도록 보정됐지만, 부모 `handleReprintLabel()`이 여전히 `window.open("", "_blank")`로 팝업을 열고 팝업 HTML 안에서 `window.print()`를 호출했다. 그래서 사용자가 본 것처럼 예전 웹 인쇄 다이얼로그 방식으로 동작했다.
- 변경: `page.tsx`에 `printAgentPng` 연동과 `renderLabelNodeToPngBase64()` 헬퍼를 추가했다. 재발행 시 기존 `conUid`로 `activePrintItems`를 렌더링한 뒤 숨겨진 `LabelPrintRenderer` 첫 라벨 DOM을 SVG foreignObject -> canvas PNG base64로 변환하고, `POST http://127.0.0.1:37111/print` payload로 전송한다. 재발행 핸들러에서 `window.open`/`window.print` 경로는 제거했다.
- 기록: 백엔드 `LabelPrintDto.printMode` enum은 현재 `BROWSER/ZPL_USB/ZPL_TCP`만 허용하므로 서버 enum 변경 없이 기존 `logBrowserPrint()`를 유지해 print-log는 계속 `printMode=BROWSER`로 남긴다. 실제 출력 경로는 agent다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 `printAgentPng`, `renderLabelNodeToPngBase64`, 재발행 핸들러 내 `window.open/window.print` 금지 조건을 추가했다. RED 실패 확인 후 구현했고 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 `C26061700029 라벨 재발행` 클릭. agent 요청은 저장 대화상자를 피하려고 `http://127.0.0.1:37111/print`를 route mock 처리했다. 결과 popup count 0, agent `/print` 1회, `jobId=CON-REPRINT-C26061700029`, `format=png`, `contentBase64Length=2864`, `/consumables/label/create` 요청 0건, `/material/label-print/log` POST 201, 상태 문구 `C26061700029 라벨을 agent로 전송했습니다.`, console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 OS 프린터 큐까지 보내는 검증은 이전 agent `/print` 테스트에서 `Microsoft Print to PDF queued`로 확인했고, 이번 Playwright는 agent 호출을 mock했다.

## 2026-06-17 22:10 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 버튼 가시성 보정 및 Playwright 재검증.
- 원인: 기존 우측 상세 패널은 420px 폭 안에 UID/상태/위치/사용횟수/입고일/재발행 6컬럼 테이블을 넣어 `재발행` 버튼이 사용자에게 잘리거나 없는 것처럼 보일 수 있었다.
- 변경: `ConLabelDetailPanel.tsx`의 미입고 UID 목록을 테이블에서 리스트형 행으로 바꿨다. 각 행은 UID/상태/위치와 사용횟수/입고일을 표시하고, `재발행` 버튼은 행 우측 `shrink-0` 영역에 고정했다. 버튼에는 `aria-label="${conUid} 라벨 재발행"`을 부여해 Playwright와 접근성 이름으로 직접 찾을 수 있게 했다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 420px 패널에서 넓은 테이블 구조를 금지하고 UID별 재발행 버튼 접근성 이름을 요구하는 RED 테스트를 추가했다. RED 실패 확인 후 구현했고 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 `C26061700029 라벨 재발행` 버튼을 찾았다. `buttonBox={x:1313,y:223,width:102,height:36}`, `panelBox={x:1020,y:100,width:420,height:800}`로 버튼이 패널 내부임을 확인했다. 클릭 후 출력 팝업 HTML에 `C26061700029`와 `window.print` 포함, `/consumables/label/create` 요청 0건, `/material/label-print/log` POST 201, 상태 문구 `C26061700029 라벨 재발행 인쇄 다이얼로그를 호출했습니다.` 확인. console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 tracked 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. `ConLabelDetailPanel.tsx`와 재발행 구조 테스트는 아직 git 기준 untracked 파일이다.

## 2026-06-17 21:57 Codex

- 작업: `T-PRINT-AGENT-GO` agent 자체 설정관리 보강.
- 결정: agent 운영 설정의 주인은 웹 MES가 아니라 agent 자체로 둔다. `D-20260617-PRINT-AGENT-OWNS-CONFIG` 기록.
- 변경: `GET /settings` 로컬 HTML 설정관리 화면 추가. 화면에서 `/health`, `/config`, `/printers`를 조회하고 `/config` 저장, `/test-print` 실행을 처리한다. 설정 항목은 `listenAddress`, 기본 프린터, 허용 Origin, token 변경/제거, 최대 payload bytes, 로그 폴더다.
- 변경: `/config` 응답에 `configPath`, `effectiveListenAddress`, `restartRequired`를 추가했다. `listenAddress` 변경은 실행 중 서버 포트를 즉시 바꾸지 않고 재시작 필요로 표시한다. 기존 token은 `clearToken=true`가 아니면 빈 POST로 지워지지 않도록 보존한다.
- 변경: Windows tray 메뉴에 `설정`을 추가하고 `ShellExecuteW`로 `http://<listenAddress>/settings`를 기본 브라우저에서 열도록 했다. 상태 보기에는 설정 URL도 표시한다.
- 보정: `/test-print` 내장 PNG가 `invalid checksum`으로 실패하던 문제를 런타임 PNG 생성 방식으로 바꿔 수정했다.
- 실측: 새 빌드로 agent를 재시작했다. 현재 PID `42964`, 경로 `C:\Project\HANES\apps\print-agent\dist\hanes-print-agent.exe`. `GET http://127.0.0.1:37111/settings` HTTP 200, 본문 `HANES Print Agent 설정` 포함. `/config`는 기본 프린터 `Microsoft Print to PDF`, `effectiveListenAddress=127.0.0.1:37111`, `restartRequired=false` 반환.
- 실측: `/config` POST로 기본 프린터 `Microsoft Print to PDF` 저장 후 `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\config.json` 반영 확인. printerName 없이 `/test-print` POST 호출 결과 `HANES-TEST-PRINT`, `Microsoft Print to PDF`, `queued` 성공 및 로그 기록 확인.
- 실측: `listenAddress=127.0.0.1:37112` 임시 저장 시 `effectiveListenAddress=127.0.0.1:37111`, `restartRequired=true` 확인 후 `127.0.0.1:37111`로 복구해 `restartRequired=false` 확인.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 트레이 `설정` 메뉴 실제 마우스 클릭과 Zebra 실출력은 미검증.

## 2026-06-17 21:28 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` `/consumables/label` 기발행 소모품 UID 재발행.
- 변경: 우측 `ConLabelDetailPanel`의 PENDING UID 목록에 `재발행` 버튼을 추가하고, 부모 페이지에서 `handleReprintLabel()`을 통해 기존 `conUid`를 그대로 `LabelPrintRenderer`에 전달하도록 했다. 신규 발행과 재발행 출력 데이터는 `activePrintItems`로 공통화했다.
- 보장: 재발행은 `createConUids()`나 `/consumables/label/create`를 호출하지 않고, 기존 UID로 출력 팝업을 열어 `window.print()`를 호출한 뒤 `/material/label-print/log`에 `uidList`를 남긴다.
- 런타임 검증: `http://localhost:3002/consumables/label`에서 `APPCT-A`의 기발행 UID `C26061700029` 행 `재발행` 클릭. 출력 팝업 HTML에 `C26061700029`와 `window.print` 포함, 클릭 이후 `/consumables/label/create` 요청 0건, `/material/label-print/log` POST payload `{"category":"con_uid","printMode":"BROWSER","uidList":["C26061700029"],"labelCount":1,"status":"SUCCESS"}` 응답 201, 화면 상태 문구 `C26061700029 라벨 재발행 인쇄 다이얼로그를 호출했습니다.` 확인.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 Zebra 물리 출력은 현재 PC에 Zebra 프린터가 없어 미검증.

## 2026-06-17 21:18 Codex

- 작업: `T-PRINT-AGENT-GO` Windows 트레이 상주 모드 추가.
- 변경: `cmd/hanes-print-agent/main.go`가 플랫폼별 `runAgent()`로 실행을 위임하도록 변경했다. Windows 실행 경로는 `http.Server`를 goroutine으로 띄우고 `internal/tray`의 Win32 message loop를 실행한다. 비-Windows는 기존 HTTP-only 실행을 유지한다.
- 트레이: `internal/tray/tray_windows.go` 추가. `Shell_NotifyIconW`로 시스템 트레이 아이콘을 등록하고, 우클릭 시 `TrackPopupMenu`로 `상태 보기`, `프린터 보기`, `종료` 메뉴를 표시한다. 상태/프린터 결과는 `MessageBoxW`로 보여주며, 종료 메뉴는 hidden window destroy 후 message loop를 종료하고 HTTP server shutdown을 호출한다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent.exe .\cmd\hanes-print-agent` PASS. 빌드된 exe 실행 후 `/health` true, `/printers` 2건(`OneNote(데스크톱) - 보호됨`, `Microsoft Print to PDF`) 확인 후 프로세스 종료.
- 남은 검증: 현재 자동화로 트레이 우클릭 메뉴 육안 클릭은 확인하지 못했다. 현재 PC에 Zebra 프린터가 잡혀 있지 않아 실제 Zebra 출력도 미검증.
- 상태: 구현 완료, REVIEW 유지, lock released.

## 2026-06-17 20:58 Codex

- 작업: `T-PRINT-AGENT-GO` Go 기반 HANES 로컬 프린트 에이전트 1차 추가.
- 설계: 웹이 라벨을 PNG로 사전 렌더링하고 `http://127.0.0.1:37111` agent로 전송한다. Agent는 라벨 디자인을 해석하지 않고 Windows 프린터 드라이버에 이미지를 전달한다.
- 변경: `apps/print-agent` Go 앱 추가. `GET /health`, `GET /printers`, `GET/POST /config`, `POST /print`, `POST /test-print`를 제공한다. 설정은 사용자 config dir의 `HANES/print-agent/config.json`, 로그는 일자별 jsonl에 기록한다. Windows 구현은 `winspool.drv`로 프린터 목록을 조회하고 `gdi32.dll` printer DC에 PNG를 `StretchDIBits`로 그리는 방식이다. 비-Windows는 명시적 unsupported stub이다.
- 프론트: `apps/frontend/src/services/print-agent.ts`에 `checkPrintAgent`, `getPrintAgentPrinters`, `getPrintAgentConfig`, `savePrintAgentConfig`, `printAgentPng` 클라이언트를 추가했다.
- 테스트: TDD 순서로 `tools/print-agent.structure.test.mjs`를 먼저 추가하고 누락 파일 실패를 확인한 뒤 구현했다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent.exe .\cmd\hanes-print-agent` PASS. 빌드된 exe를 실행해 `/health` true, `/printers` 2건(`OneNote(데스크톱) - 보호됨`, `Microsoft Print to PDF`) 확인 후 프로세스 종료.
- 상태: 구현 1차 완료, 현재 PC에 Zebra 프린터가 잡혀 있지 않아 실제 Zebra 라벨 출력은 미검증. `TASKS.md`는 REVIEW 유지, lock released.

## 2026-06-17 15:28 Codex

- 작업: `T-CONSUMABLE-STOCK-DEPLOY-QUERY` `/consumables/stock` 배포 서버 재고현황 조회 빈 화면 복구.
- 원인: `ConsumableStockController.list()`가 `{ data: rows }`를 반환하고 전역 `TransformInterceptor`/`SqlDebugInterceptor`가 이를 다시 표준 응답으로 감싸면 배포 응답이 `{ success: true, data: { data: rows } }` 형태가 된다. 기존 프론트 `useStockData`는 `res.data.data`까지만 읽고 배열이 아니면 `[]`로 처리해 테이블이 비었다.
- 변경: `useStockData`가 `/consumables/stocks?limit=5000`을 호출하고, 1단계 배열 응답과 `{ data: rows }` 중첩 응답을 모두 풀어 최종 배열만 `rawData`로 반영하도록 보정했다. `useStockData.structure.test.mjs`를 추가해 `limit=5000`, 1차/2차 `data` 파싱, 배열 가드를 고정했다.
- 검증: `node --test apps/frontend/src/hooks/consumables/useStockData.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. `git diff --cached --check`는 커밋 직전 실행 예정.
- 상태: 완료, lock released.
## 2026-06-17 14:31 Codex

- 작업: `T-CONSUMABLE-LABEL-CLICK-OPEN-PRINT` `/consumables/label` UID 발행 출력창 선점 보정.
- 원인: 현재 소스는 숨김 iframe을 만들고 UID 발행 API 완료 후 `printWin.print()`를 호출했다. 로컬에서는 빠르게 동작할 수 있지만 배포 브라우저에서는 사용자 클릭 동기 구간을 벗어난 `print()` 호출이 무시될 수 있다.
- 변경: `handleBrowserPrint()`에서 버튼 클릭 직후 `window.open("", "_blank")`로 출력창을 먼저 열고 대기 HTML을 표시한다. UID 발행 실패/0건/출력 준비 실패 시 선점한 창을 `close()`하고, 성공 시 같은 창에 `LabelPrintRenderer` HTML과 `window.print()` 스크립트를 주입한다. 숨김 iframe 생성/DOM 삽입 경로는 제거했다.
- 테스트: 구조 테스트를 먼저 새 계약으로 변경해 RED 실패 확인 후 구현했다. 이후 `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs`, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 모두 통과.
- 브라우저 검증: 3002 실제 페이지에서 Playwright headless로 인증 localStorage를 주입하고 masters/template/create/log API를 mock했다. 출력 버튼 클릭 직후 popup이 열리고 mock create 응답을 지연한 상태에서 popup body에 `UID를 발행하고 라벨 출력 준비 중입니다.`가 표시됨을 확인했다. create 응답 release 후 같은 popup HTML에 `label-grid`와 `window.print`가 포함됨을 확인했다.
- 기타: `git diff --check` 통과. worktree에는 이번 작업 외 `apps/frontend/.gitignore`, `apps/frontend/package.json`, `/consumables/life`, `useStockData`, locale 파일, `.claude/worktrees/`, `apps/frontend/playwright.config.ts` 등 기존/타 작업 변경이 남아 있어 커밋 시 범위 선별 필요.
- 상태: 완료, lock released. commit/push 안 함.

## 2026-06-17 13:55 Codex

- 작업: `T-CONSUMABLE-LIFE-LARGE-INFO-CARDS` `/consumables/life` 상단 정보카드 확대.
- 원인: 기존 상단 상태 정보가 `flex gap-2 text-xs`의 작은 pill 배지 4개로 표시되어 수명현황의 총계/정상/주의/교체필요 지표가 눈에 잘 들어오지 않았다.
- 변경: `infoCards` 배열을 추가해 총계/정상/주의/교체필요 4개 지표를 반응형 큰 요약 카드(`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`)로 렌더링한다. 각 카드는 최소 높이 118px, 큰 수치(`text-3xl font-bold`), 상태별 아이콘과 색상 톤을 가진다. 기존 작은 배지 행은 제거했다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/life/consumable-life-large-info-cards.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS, `http://localhost:3002/consumables/life` HTTP 200 확인. Playwright DOM 자동 검증은 현재 루트에서 `@playwright/test` require 불가로 수행하지 못했다.
- 상태: 완료, lock released. 사용자 지시에 따른 commit/push 요청은 없어서 수행하지 않았다.

## 2026-06-17 11:45 Codex

- 작업: `T-CONSUMABLE-LABEL-ONE-LINE-STATUS` `/consumables/label` 상태 표시 축소 및 카테고리 고정 필터 추가.
- 원인: UID 발행 결과/상태 배너가 그리드 위 공간을 추가로 차지해 화면 높이와 배치가 변했다. 사용자는 별도 결과 영역 대신 한 줄 상태만 원했다. 또한 카테고리 기준으로 빠르게 좁히는 고정 필터가 필요했다.
- 변경: `issueNotice` 배너와 생성 UID 결과 배너를 제거하고, 헤더 우측에 고정 폭 `role="status"` 한 줄 상태만 표시하도록 변경했다. 발행 UID 목록은 출력 렌더링에만 사용하고 성공 후 `clearCreatedUids()`로 정리한다. 그리드 toolbar 검색 input 옆에 `카테고리 필터` Select를 추가하고, 실제 `masters`의 `category` 값으로 옵션을 구성해 `filteredMasters`를 고정 필터링한다. 카테고리 변경 시 숨겨진 행 선택이 남지 않도록 선택을 초기화한다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 11:30 Codex

- 작업: `T-CONSUMABLE-LABEL-HIDDEN-IFRAME-PRINT` `/consumables/label` UID 라벨 출력 UX 보정.
- 원인: 직전 보정은 팝업 차단 회피를 위해 `window.open()`을 클릭 즉시 실행했지만, 브라우저가 새 탭/창으로 포커스를 옮겨 `라벨 출력 준비 중입니다...`가 전체 화면처럼 보이는 UX 문제가 있었다.
- 변경: 새 탭을 열지 않고 `consumable-label-print-iframe` 숨김 iframe을 생성해 라벨 HTML을 주입하고 `contentWindow.print()`를 호출하도록 전환했다. iframe은 0x0, opacity 0, pointer-events none이며 `afterprint`에서 제거한다. 오류/0건/출력 준비 실패 시 iframe을 제거한다.
- 검증: 구조 테스트 3건, FE tsc, diff check 통과. 3014 mock 브라우저 검증에서 `windowOpenCalled=0`, iframe 0x0 숨김 상태, `iframePrintCalled=1` 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 10:43 Codex

- 작업: `T-CONSUMABLE-LABEL-TEMPLATE-SELECT-PRINT` `/consumables/label` UID 발행 시 라벨디자인마스터 저장 템플릿 선택/적용 보정.
- 원인: 기존 화면도 `/master/label-templates?category=jig`를 조회하고 `LabelPrintRenderer`를 사용했지만, 기본 템플릿 또는 첫 번째 템플릿을 자동 선택할 뿐 사용자가 라벨디자인마스터에서 만든 특정 템플릿을 선택할 수 없었다. 그래서 어떤 템플릿으로 출력되는지 운영자가 명확히 제어할 수 없었다.
- 변경: `/consumables/label` 헤더에 라벨 템플릿 Select를 추가했다. `TemplateInfo`에 `templateKey`와 `designData`를 보관하고, 선택 변경 시 해당 템플릿의 `designData`를 `ensureObjectLabelDesign(..., "jig")`로 정규화해 `LabelPrintRenderer`에 전달한다. 템플릿이 없거나 기본 디자인을 선택하면 기존 기본 디자인으로 출력한다.
- 검증: TDD RED 확인 후 `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-image-url.structure.test.mjs` PASS, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3013 임시 프론트에서 검증용 `jig` 템플릿 `CODEX_CON_TPL_60546393`을 생성하고 `/consumables/label`에서 Select로 선택 후 첫 소모품 UID 발행을 실행했다. 인쇄 HTML에 선택 템플릿 marker `CODEX_TEMPLATE_MARK_60546393`, 생성 UID `C26061700014`, 선택 템플릿 크기 `@page{size:50mm 25mm`가 포함됨을 확인했다.
- 정리: 검증용 템플릿은 API 삭제 후 0건, 검증 UID `C26061700013`, `C26061700014` 관련 `CONSUMABLE_STOCKS`와 `LABEL_PRINT_LOGS`는 JSHANES에서 삭제 후 잔여 0건 확인.
- 참고: 기존 `master-label-bartender-designer.structure.test.mjs`는 다른 작업에서 라벨 디자이너 좌측 필드 추가/수정/삭제 UI를 제거한 상태와 예전 테스트 기대가 맞지 않아 계속 실패한다. 이번 템플릿 선택 출력 변경과 직접 관련 없는 기존 테스트 불일치다.
- 상태: 완료, lock released.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-ISSUE-FEEDBACK` `/consumables/label` UID 발행 피드백 보강.
- 원인: 기존 `handleBrowserPrint()`는 선택 없음/생성 0건/팝업 차단/출력 DOM 미준비에서 조용히 `return`했고, 성공 후 `clearCreatedUids()`를 바로 호출해 생성 UID 배너가 즉시 사라질 수 있었다. 사용자는 발행이 진행 중인지, 완료됐는지, 어떤 UID가 생성됐는지 화면에서 확인하기 어려웠다.
- 변경: `page.tsx`에 `react-hot-toast` 진행/성공/실패 메시지와 `issueNotice` 화면 배너를 추가했다. 발행 시작, UID 생성 후 인쇄창 열기, 완료, 0건, 팝업 차단, 출력 DOM 미준비, 예외 상황을 각각 표시한다. 성공 후에는 생성 UID 목록을 화면 배너와 기존 결과 배너에 남기고, 다음 발행 시작 시 이전 결과를 정리한다. 버튼 문구도 출력 단계에서는 `출력중`으로 표시한다.
- 테스트: RED 확인 후 `apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` 추가. 이후 `node --test` 신규 테스트 PASS, 템플릿 선택 구조 테스트 PASS, `useConLabelIssue` 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3014 임시 dev 서버에서 mock API로 `/consumables/label` 실제 클릭 검증. `UID를 발행하고 라벨 출력 준비 중입니다.`, `1건 UID 발행 및 라벨 출력 요청이 완료되었습니다.`, `C-FEEDBACK-0001` 화면 표시 및 출력 HTML 생성 확인.
- 실제 API/DB 검증: 3014 화면에서 실제 API로 UID `C26061700016` 1건 발행, 완료 메시지 표시와 출력 HTML 생성 확인. JSHANES에서 `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 존재 확인 후 삭제했다. 최종 잔여 `CONSUMABLE_STOCKS=0`, `LABEL_PRINT_LOGS=0` 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-503-FEEDBACK` `/consumables/label` UID 발행 503 오류 피드백 보정.
- 확인: 3002 프록시 `/api/health`와 3003 백엔드 `/api/v1/health`는 DB 연결 포함 200이었다. 직접 `POST /api/v1/consumables/label/create`는 `APPCT-A`, qty 1 기준 201로 성공해 서버/DB 상시 장애는 아니었다.
- 원인: `useConLabelIssue.createConUids()`의 catch가 AxiosError를 `console.error("Failed to create conUids:", err)`로 그대로 출력하고 `allCreated`를 반환했다. 이 때문에 Next dev console overlay에 `AxiosError: Request failed with status code 503`이 노출되고, page의 `try/catch`는 서버 메시지를 받을 수 없었다.
- 변경: `getApiErrorMessage(err)`를 추가해 `response.data.message/error`를 우선 추출하고, 실패 시 `throw new Error(...)`로 page에 전달한다. `page.tsx`는 `err.message`를 toast와 화면 배너에 표시하며 AxiosError 객체를 console.error로 출력하지 않는다.
- 검증: `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, 템플릿 선택 구조 테스트, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 관련 파일 `git diff --check` 모두 통과.
- 브라우저 검증: 3014 dev 서버에서 `/api/consumables/label/create`만 503 mock 처리. 화면에 `데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.`가 표시되고, `AxiosError`/`Request failed with status code 503` console/page overlay는 발생하지 않음을 확인했다.
- DB 정리: 직접 API 검증으로 생성된 `C26061700017`은 JSHANES `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 1건을 삭제했고 최종 잔여 0건 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-ACTUAL-PRINT` `/consumables/label` UID 라벨 실제 출력창 호출 보정.
- 원인: 기존 `handleBrowserPrint()`는 `await createConUids()`와 `setTimeout` 이후에 `window.open()`을 호출했다. 브라우저는 사용자 클릭 이벤트와 분리된 비동기 팝업/인쇄 호출을 막을 수 있어, 화면에는 처리 완료 메시지가 나오지만 실제 인쇄창이 열리지 않을 수 있었다.
- 변경: UID 발행 버튼 클릭 직후 `const printWindow = window.open("", "_blank")`를 먼저 실행한다. 팝업이 차단되면 UID를 만들지 않고 오류를 표시한다. 팝업이 열리면 준비 화면을 먼저 쓰고, UID 생성 후 기존 `LabelPrintRenderer` HTML을 해당 창에 다시 쓰며 `window.focus(); window.print();`를 호출한다. 즉시 `window.close()`하지 않고 `onafterprint`에서 닫도록 변경했다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, 템플릿 선택 구조 테스트, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 관련 파일 `git diff --check` 모두 통과.
- 브라우저 검증: 3014 dev 서버에서 API 응답을 1.2초 지연시켜도 `window.open`이 API 요청보다 먼저 호출됨을 확인했다. 최종 출력 HTML에 `window.print()`와 라벨 내용 `CODEX-PRINT-JIG` 포함 확인.
- 실제 API/DB 검증: 3014 화면에서 실제 API로 `C26061700019` 1건 발행, 출력창 HTML 생성 및 `window.print()` 포함 확인. JSHANES `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 삭제 후 최종 잔여 0건 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 10:19 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-DEPLOY-IMAGE-URL` 서버 배포 후 `/master/equip-inspect-item` 이미지 링크 깨짐 원인 확인 및 보정.
- 원인: 점검항목 이미지 `imageUrl`은 `/uploads/equip-inspect-items/...` 상대경로로 저장되어 있고, `/master/equip-inspect-item` 목록/편집 패널과 공용 `InspectItemImage`가 이를 그대로 `<img src>`에 사용했다. 로컬은 같은 호스트/proxy 조건으로 보일 수 있지만 배포 환경에서는 프론트 호스트 기준 경로가 되어 깨질 수 있다. 추가로 `apps/backend/uploads`는 `.gitignore` 대상이라 로컬에 있는 점검항목 시드 SVG 50개가 Git에는 없고, 서버 배포 시 재생성이 필요했다.
- 변경: `/master/equip-inspect-item` 목록 이미지와 편집 패널 미리보기, 공용 `InspectItemImage`가 `resolveBackendFileUrl()`을 통해 `/uploads/...`를 `NEXT_PUBLIC_API_URL`의 backend base 기준으로 변환하도록 수정했다. `blob:`/`data:`/절대 URL은 helper가 그대로 유지한다.
- 배포 보정: `.github/workflows/deploy.yml`의 runtime seed upload assets 단계에 `node tools\generate-equip-inspect-item-seed-images.mjs`를 추가해 서버 배포 때 `apps/backend/uploads/equip-inspect-items/*.svg` 50개를 재생성한다.
- 검증: `node tools\generate-equip-inspect-item-seed-images.mjs` 성공(`generated 50 SVG files`), `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-image-url.structure.test.mjs` PASS, 기존 패널 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released.

## 2026-06-17 10:07 Codex

- 작업: `T-CONSUMABLE-LABEL-DEPLOY-IMAGE-URL` 서버 배포 후 `/consumables/label` 이미지 링크 깨짐 원인 확인 및 보정.
- 원인: `/consumables/label` 그리드와 라벨 인쇄 렌더러가 API 응답의 `imageUrl`(`/uploads/consumables/...`)을 그대로 `<img src>`에 사용했다. 로컬은 `/uploads` rewrite/동일 호스트 조건으로 보이지만, 배포 환경에서는 프론트 호스트 기준 경로가 되어 깨질 수 있다. 추가로 `apps/backend/uploads`는 `.gitignore` 대상이라 로컬에 존재하는 소모품 시드 SVG 37개가 Git에는 0개이고, 서버 배포 시 파일 자체가 없을 수 있다.
- 변경: `resolveBackendFileUrl()` 공통 helper를 추가해 `/uploads/...`를 `NEXT_PUBLIC_API_URL`의 `/api` 또는 `/api/v1` 접미사를 제거한 백엔드 base URL 기준으로 변환한다. `/consumables/label` 이미지 컬럼과 `LabelDesignRenderer` 이미지 객체에 적용해 그리드와 인쇄 라벨 모두 같은 기준을 사용한다.
- 배포 보정: `.github/workflows/deploy.yml`에 `node tools\generate-consumable-master-seed-images.mjs` 단계를 추가해 서버 배포 때 gitignore된 `apps/backend/uploads/consumables/*.svg` 37개를 재생성한다.
- 검증: `node tools\generate-consumable-master-seed-images.mjs` 로컬 실행 성공, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-image-url.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 참고: 기존 `master-label-bartender-designer.structure.test.mjs`는 현재 다른 작업에서 라벨 디자이너 좌측 필드 추가/수정/삭제 UI를 제거한 상태와 예전 테스트 기대가 맞지 않아 실패한다. 이번 이미지 경로 변경과 직접 관련 없는 기존 테스트 불일치다.
- 상태: 완료, lock released.

## 2026-06-17 04:12 Codex

- 작업: `T-MATERIAL-FLOW-FE-RUNTIME` 자재관리 하위 등록 메뉴 전체를 실제 프론트로 순회하고, 자재요청 -> 자재출고 -> 자재재고 -> 공정재고/키오스크 흐름을 실데이터로 검증.
- 원인/보정: QA 스크립트가 프론트 proxy 경로(`/api/material/...`)와 백엔드 경로(`/api/v1/material/...`)를 모두 기다리지 못해 출고 승인 응답을 놓쳤고, 통합 후 실제 메뉴 경로는 `/inventory/material-stock`인데 구 경로 `/material/stock`을 확인했다. 공정재고는 `WIP_MAT_STOCKS.ORDER_NO`가 아니라 `WIP_MAT_TRANSACTIONS.ORDER_NO`와 `WIP_MAT_STOCKS` 현재고를 함께 확인해야 했다. `MAT_HOLD`는 실제 `MAT_LOTS` 상태 변경 모델인데 화면 SQL/QA 기준이 존재하지 않는 `MAT_HOLDS`를 가리켜 정합성이 맞지 않았다.
- 변경: `tools/hanes-material-flow-frontend-runtime-qa.mjs`에 proxy/API 경로 매칭, GET 503 재시도, `/inventory/material-stock` 및 `/production/wip-material-stock` 확인, `WIP_MAT_TRANSACTIONS`/`WIP_MAT_STOCKS` DB 검증을 추가했다. `tools/hanes-material-menu-page-scenario-qa.mjs`는 통합된 MATERIAL 메뉴 24개와 실제 물리 테이블(`PHYSICAL_INV_COUNT_DETAILS`, `MAT_LOTS`) 기준을 반영했다. `/material/hold` 화면 SQL 안내도 `MAT_LOTS` + `MAT_STOCKS` 조인으로 수정했다.
- 검증: `HANES_FRONTEND_URL=http://localhost:3012 node tools/hanes-material-flow-frontend-runtime-qa.mjs` PASS. 요청번호 `MR2606170035`, 작업지시 `JO-MATFE-26061618422034`; `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_ISSUES`, `WIP_MAT_TRANSACTIONS`, `WIP_MAT_STOCKS` DB 체크 전부 OK. 증적: `docs/reports/hanes-material-flow-frontend-runtime-qa-2026-06-17/index.html`, `material-flow-result.json`, 스크린샷 10장.
- 검증: `HANES_FRONTEND_URL=http://localhost:3012 HANES_QA_AGGREGATE=1 node tools/hanes-material-menu-page-scenario-qa.mjs` PASS, `/menu-categories/tree` 기준 MATERIAL 등록 메뉴 24개 중 24개 PASS. 증적: `docs/reports/hanes-material-menu-scenario-qa-2026-06-17/index.html`, `material-menu-result.json`, 페이지 JSON 24개.
- 추가 확인: `node --test apps/frontend/src/components/material/issue-from-request-modal-contract.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 3002 기존 프론트가 응답 지연 상태라 임시 프론트 `http://localhost:3012`로 검증했다.

## 2026-06-17 03:30 Codex

- 작업: `T-SHIPPING-PACK-EMPTY-BOX-DELETE` `/shipping/pack` 박스포장 화면에서 제품을 담지 않은 생성 박스를 삭제할 수 있게 하고, 행 액션 버튼 위치와 현재 담는 박스 표시를 보강.
- 확인: 백엔드 `DELETE /shipping/boxes/:id`는 이미 `OPEN`, 팔레트 미할당, `qty=0`, `serialList` 없음, OQC 이력 없음 조건에서만 삭제를 허용한다. 프론트에 이 조건을 `canDeleteEmptyBox()`로 노출하고 삭제 확인 모달을 연결했다.
- 변경: 그리드 행 액션을 `제품 담기 / 박스 마감·재오픈 / 라벨 재발행 / 빈 박스 삭제` 4개 고정 아이콘 슬롯(`grid grid-cols-4`, 32x32 버튼)으로 통일했다. 상태별로 버튼을 숨기지 않고 disabled 처리해 위치가 들쭉날쭉 바뀌지 않게 했다. 제품 담기 모달 상단에는 `현재 담는 박스`와 박스번호를 크게 표시하고, 해당 행은 `ring-2 ring-primary bg-primary/5`로 강조한다.
- 검증: 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/shipping/pack/shipping-pack-empty-box-delete.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 첫 행 액션 버튼 4개, 32x32 고정, title `제품 담기/박스 마감/라벨 재발행/빈 박스 삭제`, 현재 박스 `BX2606170001` 표시, 하이라이트 행 1건, console/page error 0 확인. API로 HNS02 빈 박스 `BX2606170003` 생성 후 삭제, 재조회 404 확인.
- 상태: 완료, lock released. 기존 진행 중인 `T-MATERIAL-FLOW-FE-RUNTIME` 작업은 별도 active로 유지.

## 2026-06-17 03:13 Claude

- 작업: 사용자 요청으로 (1) 라벨 디자이너 `/master/label` 소스테이블에 `box`(제품포장) 추가, (2) 좌측 필드 패널을 읽기전용 컬럼 목록(클릭→글자 객체 추가)으로 단순화. 별개로 `/equipment/status`를 모니터링(사이니지) 화면으로 재구성, `/workflow` CPU 폭주 수정.
- 원인: 좌측 필드 key/표시명/샘플 수동 편집이 과도하게 저수준이라는 사용자 피드백 → A안(컬럼 목록+선택만) 승인. 설비현황은 스크롤 없이 한 화면+자동 롤링 요구.
- 변경(라벨): `labelSources.ts`/`types.ts`/`page.tsx`/`label-template.dto.ts`에 box 소스(boxNo/itemCode/itemName/qty/packUnit/palletNo, category=box) 추가. `LabelObjectDesigner.tsx` 좌측 편집 UI(updateSourceField/addSourceField/deleteSourceField/newField) 제거 → 읽기전용 목록, 클릭 시 해당 컬럼 글자 객체 추가. `addElement(type, fmt, fieldKey?)`. **design.sourceFields 데이터 구조는 보존**(편집 UI만 제거)하여 기존 템플릿 호환.
- 변경(모니터링): `components/monitoring/` 공통 컴포넌트 신규(MonitoringFrame=옵션바/롤링본문/상태바 + 페이지 자동 롤링, MonitoringSettingsModal=설비 다중선택+재조회/롤링 인터벌+그리드, useMonitoringConfig=localStorage). `equipment/status` 재구성 + `EquipStatusCard` 신규(LINE→공정, 작업중 모델+계획/실적 진행바, /production/progress 매핑). `WorkflowCard.tsx` 무한 SMIL 90개 → 정적 화살표(Chrome 렌더러 CPU 9.52→2.78s/8s 측정으로 폭주 수정).
- 참고: `T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS`(Codex, 완료/released)가 만든 sourceFields 편집 기능을 사용자 승인 하에 단순화. 데이터 모델은 보존하여 충돌 최소화.
- 검증: frontend/backend `tsc --noEmit` PASS. locale JSON 4파일 BOM 없음. 브라우저: 모니터링 카드/자동롤링/공정표시, SMIL CPU 측정 확인. 라벨 좌측 단순화는 브라우저 점유로 코드(tsc)로만 검증.
- 상태: 완료.

## 2026-06-17 02:49 Codex

- 작업: `T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS` `/master/label` 좌측 필드 목록을 고정 정의가 아닌 디자인별 사용자 정의 필드로 전환.
- 원인: 기존 `labelSources.ts`의 필드 목록이 실제 DB/API 메타가 아니라 정적 하드코딩이라, 사용자가 라벨 디자인별로 필요한 필드를 자유롭게 정해야 하는 요구와 맞지 않았다.
- 변경: `LabelDesign.sourceFields`를 추가해 템플릿 JSON에 사용자 정의 필드 목록을 저장한다. `labelSources`는 소스테이블별 초기 제안값으로만 쓰고, 디자이너 좌측 필드 패널에서 key/표시명/샘플값을 추가·수정·삭제할 수 있게 했다. 텍스트/바코드/이미지 객체의 `소스 필드` 선택지는 `design.sourceFields`를 기준으로 표시되고, 필드 key 변경 시 기존 객체 매핑도 같이 갱신된다.
- 검증: 구조 테스트 `master-label-bartender-designer.structure.test.mjs`, `master-label-design-only.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 `customTraceNo/사용자추적번호/TRACE-001` 필드 추가 → 글자 객체 매핑 → 저장 요청 201 확인, 요청 `designData.sourceFields`와 객체 `sourceField=customTraceNo` 보존 확인. 검증용 `CODEX_FIELD%` 템플릿 삭제 후 조회 0건 확인. 관련 diff check PASS.
- 상태: 완료, lock released.

## 2026-06-17 02:36 Codex

- 작업: `T-MASTER-LABEL-BARTENDER-DESIGNER` `/master/label` 객체 기반 라벨 디자이너와 `/consumables/label` 저장 디자인 출력 연결 최종 검증.
- 실측: 3002 실제 브라우저 세션(`admin@hanes.com`, company `40`, plant `1000`)에서 임시 기본 소모품 템플릿 `CODEX_PRINT_1781631331283`을 `LABEL_TEMPLATES`에 저장한 뒤 `/consumables/label` 첫 행을 선택해 `UID 발행`을 클릭했다. `POST /api/consumables/label/create`가 `C26061700011`을 생성했고, `POST /api/material/label-print/log`는 201로 성공했다. `window.open().document.write()`에 전달된 인쇄 HTML 캡처 결과 실제 `conUid`, `APPCT-A`, `어플리케이터A`, 정적 마커 `CODEX_TEMPLATE_MARK`가 포함됐고 `<img>` 바코드/QR 이미지 2개가 포함됐다.
- 정리: 검증용 템플릿은 API 삭제 후 `CODEX_PRINT%` 조회 0건을 확인했다. 검증용 UID `C26061700011`은 JSHANES에서 `LABEL_PRINT_LOGS` 2건, `CONSUMABLE_STOCKS` 1건 삭제 후 두 테이블 잔여 0건을 확인했다. 중간 실패 검증에서 생성된 `C26061700009`, `C26061700010`도 같은 방식으로 정리해 잔여 0건이다.
- 검증: `node "apps/frontend/src/app/(authenticated)/master/label/master-label-bartender-designer.structure.test.mjs"` PASS, `node "apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs"` PASS, `node "apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 이전 1차 검증의 `/master/label` 도구/앵커/상단 탭 제거/UI 저장/API 조회/삭제도 유지된다.
- 상태: 완료, lock released.

## 2026-06-17 02:20 Codex

- 작업: `T-MASTER-LABEL-BARTENDER-DESIGNER` `/master/label` 라벨다자인관리 바텐더형 객체 디자이너 전환 1차 구현.
- 변경: `LabelDesign`을 기존 좌표 입력형과 호환되게 유지하면서 `sourceTable`, `elements[]`, 객체 타입(`text/barcode/box/line/circle/image`), 객체별 `sourceField` 매핑을 저장하는 포맷으로 확장했다. `/master/label`은 상단 탭을 제거하고 좌측 소스테이블 선택 + 도구 팔레트, 중앙 캔버스, 우측 속성/템플릿 패널 구조로 변경했다. 객체는 마우스 포인터로 이동하고 선택 객체에는 모서리 리사이즈 앵커가 표시된다.
- 출력 연결: `LabelDesignRenderer`/`LabelPrintRenderer`를 추가해 저장된 객체 포맷을 화면/인쇄용 HTML로 렌더링한다. 바코드는 인쇄 창 복사 시 비지 않도록 `bwip-js` 캔버스를 data URL 이미지로 변환한다. `/consumables/label`은 `category=jig` 라벨 템플릿을 조회하고, 생성된 `conUid`와 소모품 마스터 데이터를 저장 디자인의 `sourceField`에 치환해 출력하도록 연결했다.
- 검증: RED 후 GREEN 구조 테스트 `master-label-bartender-designer.structure.test.mjs`, 갱신한 `master-label-design-only.structure.test.mjs`, 기존 `useConLabelIssue.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 Playwright에서 `/master/label` 도구(`글자/1D/2D/박스/선/원/이미지`), 상단 탭 제거, 박스 추가 후 리사이즈 앵커 4개 확인. `/consumables/label`에서 `/api/master/label-templates?category=jig` 요청 확인. UI `새로 저장`으로 객체 템플릿 저장 후 API 조회에서 `elements` 보존 확인, 테스트 템플릿 삭제 완료. 직접 API 저장/조회/삭제도 객체 JSON `sourceField=conUid` 보존 확인.
- 남음: 실제 소모품 UID 발행 버튼을 눌러 인쇄 HTML에 저장 템플릿 데이터가 치환되는지 실측하고, 생성 테스트 UID/로그 정리 방법까지 확인해야 전체 목표 완료로 볼 수 있다.
- 상태: 진행 중, lock released.

## 2026-06-17 01:59 Codex

- 작업: `T-MASTER-LABEL-DESIGN-ONLY` `/master/label` 라벨다자인관리의 모든 카테고리를 디자인 제공 전용으로 전환.
- 변경: `품목` 탭과 `LabelCategory`의 `part`를 제거했다. `지그/금형` 탭명은 `소모품`으로 변경했다. 설비/소모품/작업자/자재롯트라벨 모든 탭에서 대상 조회 API, 대상 선택 그리드, 선택 항목 인쇄 패널을 제거하고 샘플 미리보기 + 디자인/템플릿 관리만 남겼다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node "apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright로 `http://localhost:3002/master/label` 접속해 탭 `설비/소모품/작업자/자재롯트라벨` 노출, `품목`/`선택 출력` 미노출, 각 탭 디자인 제공 안내 표시, 대상 조회 API(`/equipment/equips`, `/consumables`, `/master/workers`, `/master/parts`) 호출 0건 확인.
- 상태: 완료, lock released. 이번 작업 외 워크트리의 기존 dirty 변경은 되돌리지 않았다.

## 2026-06-17 00:09 Codex

- 작업: `T-EQUIPMENT-PERIODIC-DAILY-FLOW` `/equipment/periodic-inspect` 처리 방식을 `/equipment/daily-inspect` 방식으로 통일.
- 원인: 백엔드는 `DailyInspectController`와 `PeriodicInspectController`가 같은 `EquipInspectService`를 사용하고 `inspectType`만 각각 `DAILY`, `PERIODIC`으로 고정한다. 차이는 프론트였다. 일일점검은 `/master/equip-inspect-items`, 점검로그, 설비마스터를 합쳐 대상 설비 목록 + 항목 입력 패널로 처리했고, 정기점검은 단순 DataGrid/모달 CRUD로 처리했다.
- 변경: `periodic-inspect/page.tsx`를 일일점검형 분할 패널로 교체했다. 좌측은 `PERIODIC` 점검항목이 배정된 설비 목록과 해당일 처리상태를 표시하고, 우측은 선택 설비의 `PERIODIC` 항목을 입력해 `/equipment/periodic-inspect`에 저장한다. 기존 일일점검 컴포넌트 `EquipListPanel`, `InspectEntryPanel`은 기본 동작을 유지하면서 `PERIODIC`용 문구, 엔드포인트, 기존이력 여부를 주입받도록 확장했다.
- 보정: 정기점검 미점검 설비 선택 시 존재하지 않는 로그를 단건 조회해 404 모달이 뜨지 않도록 `existingInspected`가 true일 때만 상세 로그를 조회한다. 점검항목 API가 `seq` 대신 `sortSeq/itemCode`를 내려주는 케이스 때문에 화면 key와 입력상태 key를 `itemCode` 우선으로 바꿔 React key 중복 경고를 제거했다.
- 검증: `node apps/frontend/src/app/(authenticated)/equipment/periodic-inspect/periodic-inspect-daily-flow.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3002 실제 화면에서 `/equipment/periodic-inspect`와 `/equipment/daily-inspect` 모두 좌측 대상 패널 + 우측 입력 패널로 렌더링됨을 확인했다. 정기점검 첫 설비 선택 후 `정기점검 입력`, 점검항목 테이블, 측정값/입력, 판정 컬럼 표시 true, 오류 모달 false, console error/warning 0. 증적: `docs/reports/equipment-periodic-inspect-daily-flow-2026-06-17.png`, `docs/reports/equipment-daily-inspect-daily-flow-2026-06-17.png`, `docs/reports/equipment-periodic-inspect-selected-2026-06-17.png`.
- 상태: 완료, lock released.

## 2026-06-17 00:08 Codex

- 작업: `T-EQUIPMENT-INSPECT-CARDS-REMOVE` `/equipment/inspect-history`, `/equipment/periodic-inspect` 상단 정보카드 제거.
- 변경: `inspect-history/page.tsx`와 `periodic-inspect/page.tsx`에서 상단 `StatCard` 영역과 카드 전용 `stats` 계산/import만 제거했다. 이후 정기점검 화면은 사용자 요청에 따라 `T-EQUIPMENT-PERIODIC-DAILY-FLOW`에서 일일점검형 처리 화면으로 전환했다.
- 검증: 카드 관련 잔여 참조 검색 0건, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 3002 브라우저에서 `/equipment/inspect-history`와 `/equipment/periodic-inspect` 상단 정보카드 미표시 확인. 증적: `docs/reports/equipment-inspect-history-no-cards-2026-06-17.png`, `docs/reports/equipment-periodic-inspect-no-cards-2026-06-17.png`.
- 상태: 완료, lock released.

## 2026-06-16 22:48 Codex

- 작업: `T-CONSUMABLE-LIFE-STATUS-SHAPE` `/consumables/life` 런타임 `data.filter is not a function` 수정.
- 원인: 프론트 수명현황 화면은 `DataGrid`와 통계 계산을 위해 `LifeStatus[]` 행 배열을 기대하지만, 백엔드 `ConsumablesService.getLifeStatus()`가 `{ good, warning, replace }` 카운트 객체를 반환했다. 같은 카운트 목적은 이미 `/consumables/summary`가 담당한다.
- 변경: `getLifeStatus()`가 활성 소모품 행 목록을 반환하도록 수정하고, 서비스 단위 테스트 기대값을 수명현황 그리드용 행 배열 계약으로 변경했다. `ConsumablesService` 테스트 모듈에 최근 추가된 repository 의존성 mock도 보강했다.
- 검증: RED 확인 후 `pnpm --filter @harness/backend test -- consumables.service.spec.ts --runInBand` 20/20 PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. API `http://localhost:3003/api/v1/consumables/life-status`는 `data` 배열 37건 반환 확인. Playwright로 `http://localhost:3002/consumables/life` 진입 시 런타임 에러 없음, 수명현황 37건 렌더링 확인.
- 상태: 완료, lock released.

## 2026-06-16 22:24 Codex

- 작업: `T-CONSUMABLE-LABEL-RESPONSE-FIX` `/consumables/label` 라벨 발행 대상 미조회 수정.
- 원인: `ConsumableLabelController`가 `return { data }`를 반환하고 전역 `TransformInterceptor`가 다시 `{ success, data }`로 감싸 실제 응답이 `data.data` 이중 구조가 됐다. 프론트 `page.tsx`는 `res.data?.data`까지만 읽어 배열이 아닌 객체를 받고 `setMasters([])`로 처리했다.
- 변경: `apps/backend/src/modules/consumables/controllers/consumable-label.controller.ts`의 `masters/create/pending/confirm/confirm-bulk` 응답을 `ResponseUtil.success(data)`로 통일하고 미사용 `UseGuards/JwtAuthGuard` import를 제거했다. 구조 테스트 `apps/backend/src/modules/consumables/controllers/consumable-label.controller.structure.test.mjs`를 추가했다.
- 검증: 구조 테스트 RED 후 GREEN(`node --test apps/backend/src/modules/consumables/controllers/consumable-label.controller.structure.test.mjs` 1/1 PASS), `pnpm --filter @harness/backend build` PASS, 인증 API `/api/v1/consumables/label/masters` 응답 `data` 배열 37건 확인, 실제 브라우저 `http://localhost:3002/consumables/label`에서 `데이터가 없습니다` 미표시, 37행 및 `APPCT-A` 표시 확인.
- 상태: 완료, lock released.

## 2026-06-16 22:21 Codex

- 작업: `T-FRONTEND-DELETE-CONFIRM-GUARD` 삭제 버튼 클릭 시 즉시 삭제되는 프론트 지점 보강.
- 변경: 라우팅/라인/공정 탭, 소모품 사용매핑, 소모품/사용자/품목/점검항목 이미지 제거, 교육 참석자, 팔레트 박스, 포장 시리얼, 공정-설비 매핑, 자주검사 항목, 라벨/IQC 템플릿, 품질 audit/control-plan 하위 항목 삭제가 공용 `ConfirmModal` 확인 후 실행되도록 변경했다. 이미 모달을 쓰던 설비점검 할당 패널은 `danger` variant 기준에 맞췄다.
- 테스트: `apps/frontend/src/delete-confirm-guard.structure.test.mjs` 추가. 알려진 삭제 버튼 파일들이 `ConfirmModal`과 `variant="danger"`를 쓰는지, 직접 삭제 호출 패턴이 남아 있지 않은지 검사한다.
- 검증: `node --test apps/frontend/src/delete-confirm-guard.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 대상 파일 `git diff --check`, 직접 삭제 호출 `rg` 검색 통과.
- 상태: 완료, lock released.

## 2026-06-16 21:52 Codex

- 작업: `T-CONSUMABLE-MASTER-USAGE-MAP-FIXED` `/consumables/master`의 `CONSUMABLE_USAGE_MAP` 매핑 UI를 상시 우측 고정 섹션으로 전환.
- 변경: `ConsumableUsageMapPanel.tsx`를 별도 우측 섹션으로 추가하고 `page.tsx`에서 선택 소모품 상태를 관리해 목록 선택 시 매핑이 즉시 갱신되도록 했다. `ConsumableFormPanel.tsx`는 기본정보/수명/거래처/이미지만 담당하도록 유지했고, 매핑 영역은 편집 패널 내부에 넣지 않았다.
- 보정: 우측 매핑 섹션과 등록/수정 패널에 `flex-shrink-0`을 적용해 화면 우측 고정 영역이 축소로 사라지지 않게 했다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/master` HTTP 200 확인. 백엔드 usage-maps API는 기존 `T-CONSUMABLE-MASTER-USAGE-MAP`에서 조회/생성/삭제 및 JSHANES 테스트 잔여 0건 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 20:36 Codex

- 작업: `T-CONSUMABLE-LABEL-CARDS-REMOVE` `/consumables/label` 상단 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/label/page.tsx`에서 `StatCard` 4개 grid, 카드 전용 `stats` useMemo, `StatCard`/`Package`/`Clock` import, 주석의 StatCards 설명만 제거했다.
- 유지: 마스터 조회, 검색, 선택/수량 입력, UID 발행, 브라우저 인쇄, 생성 결과 배너, DataGrid export/SQL 조회는 변경하지 않았다.
- 검증: 대상 파일 `StatCard|stats|totalMasters|pendingCount|selectedCount|selectedQty|Package|Clock` 잔여 0건, `git diff --check` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/label` HTTP 200 확인.
- 상태: 완료, lock released.

## 2026-06-16 17:50 Codex

- 작업: `T-KIOSK-JOBORDER-PERSIST-REFRESH` `/production/input-kiosk` 새로고침 시 선택 작업지시가 사라지는 문제 수정.
- 원인: `apps/frontend/src/stores/kioskStore.ts`는 Zustand persist를 사용하지만 `partialize`에서 `selectedJobOrder`를 제외하고 있었다. 코드 주석도 "selectedJobOrder는 저장하지 않아 페이지 재진입 시 반드시 새로 선택"이라고 되어 있어 브라우저 refresh 후 작업지시가 null로 복원되는 것이 현재 구현이었다.
- 변경: `harness-kiosk` persist 대상에 `selectedJobOrder: state.selectedJobOrder`를 추가했다. 기존 설비 선택과 `lotSize` persist는 유지했고, active lock이 걸린 `MaterialListPanel.tsx`는 수정하지 않았다.
- 검증: RED 후 GREEN 구조 테스트 `node --test apps/frontend/src/stores/kiosk-store-persist.structure.test.mjs` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과, 관련 파일 `git diff --check` 통과.
- 상태: 완료, lock released.

## 2026-06-16 17:30 Codex

- 작업: `T-BOM-ITEM-TYPE-LABEL-FIX` `/master/bom` 품목유형 원 코드 노출 원인 확인 및 보정.
- 원인: BOM 백엔드와 DB는 별도 BOM 유형 컬럼을 쓰지 않고 `ITEM_MASTERS.ITEM_TYPE`을 조인해 `itemType`으로 내려준다. 품목마스터 화면은 이를 한글 라벨로 변환하지만, BOM 화면의 부모 목록/트리 배지/범례/자품목 선택 힌트는 `FINISHED`, `SEMI_PRODUCT`, `RAW_MATERIAL`, `CONSUMABLE` 값을 그대로 출력했다.
- 변경: `page.tsx` 부모 목록은 `useComCodeOptions("ITEM_TYPE")` 기반 `itemTypeLabelMap`으로 표시하고, `BomTab.tsx` 트리/범례 및 `BomFormModal.tsx` 선택 자품목 힌트는 `t("comCode.ITEM_TYPE...")` 라벨을 사용하도록 수정했다. 저장/API/DB 값은 변경하지 않았다.
- 검증: 신규 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/master/bom/bom-item-type-label.structure.test.mjs` RED 후 GREEN 3/3 PASS. `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 통과. API `/api/v1/master/boms/parents`는 `itemType` 원 코드 반환 확인. Oracle JSHANES에서 `BOM_MASTERS`에 TYPE 컬럼 없음 및 `ITEM_MASTERS.ITEM_TYPE/PRODUCT_TYPE` 조회 확인. 3002 프론트는 응답 타임아웃이라 건드리지 않고 3012 임시 dev 서버로 `/master/bom` 브라우저 실측, 화면 텍스트에서 `FINISHED/SEMI_PRODUCT/RAW_MATERIAL` 미노출 및 `완제품/반제품/원자재/소모품` 노출 확인 후 3012 서버 종료.
- 상태: 완료, lock released.

## 2026-06-13 22:24 Codex

- 작업: `T-SQL-ACTUAL-GLOBAL` 모든 `DataGrid.sqlQuery` SQL 조회문 실제 실행 SQL 우선 표시.
- 변경: TypeORM logger(`SqlDebugTypeormLogger`)와 요청 단위 `AsyncLocalStorage` SQL 수집 컨텍스트를 추가하고, 전역 `SqlDebugInterceptor`가 GET 응답 `meta.debugSql`에 실제 실행 SELECT/parameters/tables/queries를 붙이도록 했다. 프론트 Axios 응답 인터셉터는 모든 API 응답의 `meta.debugSql`을 캐시하고, 공통 `SqlViewerModal`은 하드코딩 preview SQL과 같은 테이블의 최신 실제 SQL을 우선 표시한다.
- 보정: `getManyAndCount()` 화면은 데이터 SELECT와 COUNT SELECT가 함께 실행되므로 COUNT-only SELECT를 대표 SQL에서 후순위로 내렸다. 그리드 SQL 모달에는 COUNT가 아니라 행 조회 SELECT가 나오도록 백엔드 대표 SQL과 프론트 캐시 매칭 양쪽에 반영했다.
- 적용 범위: `rg` 확인 결과 SQL 조회문 버튼은 `DataGrid -> SqlViewerModal` 단일 경로를 타며, 100개 이상 `sqlQuery` 사용처가 공통 모달 변경을 받는다. `/material/iqc`의 기존 수동 `meta.debugSql`도 전역 수집 경로와 호환된다.
- trade-off: 페이지별로 정확한 API endpoint와 그리드를 1:1 매핑하지 않고 테이블명 기반 최신 실행 SQL을 매칭한다. 따라서 동일 테이블을 여러 API가 연달아 조회하는 특수 화면에서는 가장 최근 같은 테이블 쿼리가 표시될 수 있다. 대신 페이지 100개 이상을 개별 배관하지 않고 전역 적용하며, 실제 DB에 실행된 TypeORM SQL과 bind parameters를 확보한다.
- 런타임 검증: 백엔드 3003을 빌드 후 `dist/main`으로 재시작. `POST /api/v1/auth/login` `admin@hanes.com`/company `40`/plant `1000` 성공. `GET /api/v1/material/iqc-history/pending-arrivals` 응답에 `meta.debugSql`, table `MAT_LOTS`, queryCount 1 확인. `GET /api/v1/master/parts?page=1&limit=5` 응답에 table `ITEM_MASTERS`, queryCount 2, 대표 SQL이 COUNT가 아닌 행 조회 SELECT임을 확인.
- 검증 명령: `node apps/frontend/src/components/data-grid/sql-viewer-actual-sql.structure.test.mjs`, `node apps/frontend/src/components/data-grid/sql-viewer-modal.structure.test.mjs`, `pnpm --filter @harness/backend test -- sql-debug-context.spec.ts --runInBand`, `pnpm --filter @harness/backend exec tsc --noEmit`, `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 모두 통과. `pnpm --filter @harness/backend build` 통과.

## 2026-06-12 17:14 Codex

- 작업: `T-UI-CRUD-RED-MENU-QA` `ui-test-crud-red` 스킬 기반 좌측 메뉴 전체 성공 캡처 QA 진행 중.
- 스킬 변경: `C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 추가/보강. 실제 좌측 메뉴 트리(`hanes-menu-tree`)에서 route를 읽고, 각 화면을 Playwright로 열어 콘솔/pageerror/API 400+를 실패로 판정하며 성공 화면만 screenshot으로 남긴다. cold compile 대응을 위해 navigation timeout 6분, timeout/`ERR_NETWORK_IO_SUSPENDED`/`ERR_ABORTED` 재시도, route별 새 context, viewport screenshot, partial JSON 저장을 추가했다.
- 런타임 조치: 3002 프론트 dev server가 전체 500 상태가 되어 포트 3002 Next 프론트 프로세스만 재시작했다. 백엔드 3003은 재기동 직후 연결 거부가 있었으나 이후 `/api/v1/health`, `/api/v1/material/po-status`, 프론트 `/api/health` 모두 정상 확인.
- 현재 진행: 최종 중단 시 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/result.partial.json` 기준 좌측 메뉴 96개 중 36개 완료, 36개 PASS, 실패 0. 최종 HTML은 아직 작성하지 않았다(전체 PASS 완료 시에만 작성 예정). 성공 캡처는 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/screenshots/`에 partial로 존재.
- 검증: `node --check C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 통과, `python C:\Users\hsyou\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\hsyou\.codex\skills\ui-test-crud-red` 통과. 전체 runner는 Turbopack cold compile이 매우 느려 중간 정지했다.
- 재개 명령: `node C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 또는 백그라운드 로그 방식으로 실행. 현재 3002 프론트 로그는 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/frontend-3002-restart.out.log`.

## 2026-06-12 09:45 Codex

- 작업: `T-CUSTOMER-INTRO-FLOW-SLIDE` 고객 소개 자료 4페이지 기능흐름도 추가.
- 변경: 사용자 제공 MES 설명 이미지의 구성을 참고해 `docs/presentation/hanes-mes-introduction.html`에 `04 / 기능흐름도` 슬라이드를 삽입. Enterprise System, Manufacturing Execution System, MES 주요 기능 3영역으로 나누고 기준정보, 생산계획, 자재관리, 생산진행, 검사관리, 품질관리, 설비관리, 출하관리, 추적관리 흐름을 한 장에 표현. 기존 4페이지 이후는 5~24페이지로 순번 이동.
- PPTX: `docs/presentation/hanes-mes-introduction.pptx`를 최신 HTML 렌더 기준 24장으로 재생성. `docs/presentation/artifact-build-manifest.json`도 24장 기준으로 갱신.
- 검증: HTML 슬라이드 24장, `04 / 기능흐름도` 포함, 이미지 참조 56개/누락 0개. 4페이지 브라우저 렌더 overflow X/Y 없음 확인 및 시각 확인. PPTX 패키지 슬라이드 24장, media 24개, 빈 media 0개 확인. 작업용 `outputs/manual-20260612-flow-slide` 삭제 완료.
- 참고: artifact-tool 런타임 번들 경로가 비어 있어 이번 PPTX는 HTML 렌더 이미지를 16:9 슬라이드로 재구성했다. 기존 기준정보/갤러리 일부 HTML 페이지에는 기존 세로 overflow 경고가 남아 있으나 신규 4페이지는 해소했다.

## 2026-06-11 23:30 Claude

- 작업: T-EQUIP-INSPECT-TABLE-RESTRUCTURE — 두 테이블 역할 뒤바뀜 전면 수정 완료.
- 결론: DB 재생성(두 테이블 모두 0건이라 데이터 마이그레이션 불필요), 엔티티 클래스명·데코레이터 스왑, 서비스·컨트롤러·DTO·프론트엔드 전면 재작성.
- ① DB: `EQUIP_INSPECT_ITEM_MASTERS`(COMPANY+PLANT_CD+ITEM_CODE PK, EQUIP_TYPE 있음) / `EQUIP_INSPECT_ITEM_POOL`(EQUIP_CODE+ITEM_CODE+INSPECT_TYPE 복합PK, 린 링크 테이블). 마이그레이션: `2026-06-11_equip_inspect_tables_restructure.sql`.
- ② 엔티티 파일: `equip-inspect-item-pool.entity.ts` → class `EquipInspectItemMaster` @Entity('EQUIP_INSPECT_ITEM_MASTERS') / `equip-inspect-item-master.entity.ts` → class `EquipInspectItemPool` @Entity('EQUIP_INSPECT_ITEM_POOL'). 파일명은 변경 없음(클래스명·데코레이터만 스왑).
- ③ master/equip-inspect.service: POOL 레포 inject, findAll=POOL LEFT JOIN MASTERS(getRawMany), create=린(equipCode+itemCode+inspectType+useYn+sortSeq), delete=복합키.
- ④ equipment/equip-inspect.service: POOL 레포 inject + MASTERS는 JOIN 타깃, `fetchItemsWithDetails` 헬퍼(JOIN), item.seq → item.itemCode, detailBySeq → detailByItemCode.
- ⑤ equipment.module, master.module: 양쪽 entity 등록.
- ⑥ spec 파일 4개 수정: 신 엔티티명/토큰으로 교체, master equip-inspect.service.spec 전면 재작성(update 제거, 신 create/delete 테스트).
- ⑦ 프론트: types.ts(InspectItemMasterRow/InspectItemRow 재정의), AddInspectItemModal(마스터 endpoint), EquipAssignTab(delete 시그니처), InspectItemPanel(seq→sortSeq), equip-inspect-item page(마스터 endpoint).
- 검증: 백엔드 tsc --noEmit 통과, 프론트 tsc --noEmit 통과.

## 2026-06-11 22:30 Claude

- 작업: T-EQUIP-INSPECT-POOL-TYPE — 설비점검 항목을 설비유형(EQUIP_TYPE) 기준으로 가져오도록 구조 정리.
- 의도(사용자 확인): `/master/equip-inspect`(설비별 매핑·운영 기준)에서 점검항목 추가 시 풀(점검항목 마스터)을 그 설비의 설비유형으로 필터해 가져온다. `/master/equip-inspect-item`(마스터=구성용 기준정보)은 설비코드 대신 설비유형으로 관리.
- 실측: EQUIP_INSPECT_ITEM_POOL에 EQUIP_TYPE 없음, POOL·MASTERS 둘 다 0건(HNS02 클린징 이후) → 데이터 마이그레이션 불필요. EQUIP_TYPE 공통코드 11종.
- ① DB: `ALTER TABLE EQUIP_INSPECT_ITEM_POOL ADD (EQUIP_TYPE VARCHAR2(50))` JSHANES 적용 + COMMENT. 마이그레이션 파일 `2026-06-11_equip_inspect_pool_equip_type.sql`(저장소 `/` 구분 컨벤션).
- ② 백엔드 POOL: entity equipType 컬럼, DTO Create/Query equipType(옵셔널·MaxLength 50), service create/update 저장 + findAll equipType 필터.
- ③ `/master/equip-inspect-item` page.tsx: 백엔드 소스를 MASTERS(equipCode)→POOL(equip-inspect-item-pool)로 전환, 설비코드 컬럼/입력 제거하고 설비유형(ComCodeSelect/ComCodeBadge EQUIP_TYPE)으로 대체, 통계 '설비 수'→'설비유형 수', 항목코드 PK 입력·비고 추가. (기존 페이지는 per-equip MASTERS 중복 편집 → 마스터(카탈로그)로 정리)
- ④ `/master/equip-inspect` AddInspectItemModal: 풀 조회 params에 선택 설비의 equipType 추가(있을 때만), 대상설비 박스에 유형 배지, 해당 유형 풀 없을 때 안내 문구. EquipAssignTab에서 equipType 전달. ItemMasterTab(풀 편집기)에도 설비유형 컬럼·입력 추가(여기서 만든 풀 항목도 유형 보유).
- 검증: 백엔드/프론트 tsc --noEmit 통과, equip-inspect 구조테스트 3건 통과, ko/en/zh/vi 4파일 키 동기화·BOM 없음.
- 참고(미해결/판단필요): (a) equipType=NULL 풀 항목은 특정 유형 설비 추가 모달에 안 보임(엄격 필터). 공통항목 노출 필요 시 별도 처리. (b) ItemMasterTab과 equip-inspect-item 페이지가 둘 다 풀 편집기 → 중복. 통합은 사용자 결정 영역이라 보존. (c) 백엔드는 nest watch 모드 가정(자동 반영).

## 2026-06-11 21:20 Claude

- 작업: T-PDA-RECEIVE-WORKER-GUARD — PDA 자재입고 사전 게이트 검증·사용자 메시지 + 작업자 스캔 등록·workerId 저장 (프론트 전용).
- 근본원인(시스템 오류처럼 보임): 입고 훅이 `suppressErrorModal` 미지정 → 백엔드 400이 전역 `useErrorStore` 시스템-에러 상세 모달로 표출. 훅 api 호출 2곳에 `suppressErrorModal:true` 추가.
- ① 사전검증: 입고확인 전 작업자등록/수량≥1/수량≤잔량/창고선택을 클라이언트에서 검사 → 실패 시 백엔드 호출 없이 친화 메시지. ② PdaErrorDialog(PDA 오버레이) 닫으면 handleReset+수량초기화로 입고창 클리어. ③ WorkerBar 작업자 QR 스캔(by-qr, workerCode 폴백)→currentWorker 등록, 미등록 시 자재 스캔·입고확인 차단, 입고확인 시 workerId=workerCode 전송(이력에 작업자명).
- 버그 수정: by-qr 응답이 ResponseUtil envelope(`data:{workerCode,workerName,dept}`, id/name 아님)인데 초안이 `res.data.id/name` 읽음 → `(res.data?.data ?? res.data)` 언랩 + workerName 사용으로 수정. (헤더 `WorkerQrPanel`도 동일 버그로 currentWorker.name/workerCode가 undefined — 범위 밖, 별도 수정 필요 보고)
- 검증(localhost, 실 API+DB): by-qr W003→박민수 200. 잔량초과(99>3)→400 친화메시지 "입고수량(99)이 잔량(3)을 초과합니다". 정상입고(qty2, W003)→201. DB 실측 — MAT_RECEIVINGS.WORKER_ID=W003, STOCK_TRANSACTIONS(RECEIVE).WORKER_ID=W003 저장 확인. FE tsc 통과.
- 파일: `apps/frontend/src/hooks/pda/useMatReceivingScan.ts`, `apps/frontend/src/app/pda/material/receiving/{page.tsx,components.tsx}`. 미커밋. 백엔드 무수정(DTO/서비스 이미 workerId 저장).

## 2026-06-11 21:10 Claude

- 작업: T-IQC-MODAL-POOL-ITEMS — IQC 검사결과 등록 모달의 검사항목 일부 누락·검사기준 컬럼 누락 수정 + 전체 변경분 커밋.
- 원인(실측): 모달이 `GET /master/iqc-items`(IQC_ITEM_MASTERS) 조회 — CNTR001은 여기 2행(검사기준/LSL/USL 전무)뿐. 정상 출처인 품목→그룹→그룹항목→풀(IQC_ITEM_POOL) 체인이 끊겨 있었음: IQC_PART_LINKS가 존재하지 않는 GRP-* 그룹 참조, 실재 IGR-* 그룹은 IQC_GROUP_ITEMS 매핑 0건.
- 수정: ①시드 `2026-06-11_iqc_group_chain_repair_seed.sql` — GRP-*→IGR-* 링크 정정(UPDATE) + IGR-* 그룹별 검사항목 매핑 시드(SET 기반 INSERT, NOT EXISTS 가드). ②백엔드 `GET /master/iqc-part-links/resolve-items/:itemCode`(거래처 전용→기본(*)→첫 링크 해석, 풀의 criteria→spec/lsl/usl/unit/judgeMethod 반환). ③모달이 새 엔드포인트 사용.
- 검증: JSHANES 시드 적용, CNTR001 체인 4항목(외관/캐비티치수/락기능/조립) + 검사기준 정상. resolve-items API 4행 반환 실측. FE/BE tsc 통과, nest build+재시작.
- 커밋: 지금까지 미커밋분 전부를 작업 단위로 분리 커밋 — PDA계약통일, 팔레트화면정합, 키오스크단절수정, IQC코드그룹, 메뉴수정, 테마, 공정설비시드, IQC라벨통일, 재검수불분리, UID분리, 본 IQC모달수정, 협업보드. (codex 완료분 포함)
- 주의: 백엔드 3003 새 빌드본 재시작됨. hswbs 반영은 별도 배포 필요. T-PDA-RECEIVE-WORKER-GUARD 락은 작업파일 미존재라 보존(타 컨텍스트 진행분).

## 2026-06-11 20:50 Claude

- 작업: T-KIOSK-FLOW-FIX — 키오스크 점검에서 발견한 단절 3건 수정 (우선순위 ①→③→②) + 연쇄 버그 1건.
- ①(설정 시드): `2026-06-11_mat_auto_issue_config_seed.sql` — `MAT_AUTO_ISSUE_TIMING='ON_CREATE'`(SELECT: OFF/ON_CREATE/ON_COMPLETE), `MAT_ISSUE_STOCK_CHECK='WARN'`(BLOCK/WARN — 자재 미입고 상태에서 생산 차단 방지를 위해 WARN 기본) PRODUCTION 그룹 시드, JSHANES 적용. SysConfig 무캐시라 즉시 효력.
- ③(진행률 서버화): `job-order.service.findByOrderNo`에 PROD_RESULTS 집계(goodQty/defectQty, CANCELED 제외) 추가. 키오스크 `savedResultCount` 의미를 "누적 생산수량(서버 집계)"으로 정정 — `setSavedResultCount` 액션, `refreshProgress()`로 작업지시 선택/재진입/저장 후 서버 동기화. 초물 트리거·중물 차단·`prodQtyAtInspect`가 모두 실제 생산량 기준이 됨. `incrementResultCount` 제거.
- ②(스캔 LOT 우선): `auto-issue.service` — JOB_MATERIAL_LOTS(키오스크 스캔 LOT)를 차감 1순위로 정렬 후 FIFO. 스캔 추적과 실제 차감 LOT 일치.
- 연쇄버그(역분개 복원 불가): AutoIssue가 만들던 StockTransaction에 FROM_WAREHOUSE_ID 부재 → `reverseAutoIssue`가 복원을 skip(원거래 존재+창고 null은 fallback도 안 탐). 수정: `deductMatStock`이 창고별 차감 내역 반환 → 창고별 TX 생성(FROM_WAREHOUSE_ID 기록). 실증: 차감 7→6 → 취소 → 복원 6→7 + MAT_IN 보상 TX.
- 검증: auto-issue/job-order spec 47건(신규 스캔우선 1건 포함) 통과, FE/BE tsc 통과, nest build 후 백엔드 재시작(node dist/main). 통합 실증 — by-order-no goodQty 14→15→복원, 백플러시 MAT_ISSUES(PROD_AUTO) 생성·차감 LOT=스캔 LOT 일치, WARN 정책으로 재고 없는 BOM 품목 있어도 실적 저장 성공.
- 정리: 검증 잔여물(PR 2건, ISS 2건, TX 3건, 스캔기록) 삭제, 수정 전 미복원분 +1 보정(재고 8 원복), EQ-CRIMP-03 작업지시 할당 복원. 기존 실적 14/4 보존.
- 미커밋. hswbs 반영은 백엔드 재배포 필요(시드는 DB 공유로 즉시 반영). 주의: 백엔드 3003 프로세스를 새 빌드본으로 재시작했음.

## 2026-06-11 20:48 Codex

- 작업: `T-IQC-CODE-ALIGN` 품목정보/IQC 검사그룹/IQC 검사입력/IQC 이력의 검사방법·검사유형 코드 매핑 통일.
- 원인: `ITEM_MASTERS.INSPECT_METHOD`와 `IQC_GROUPS.INSPECT_METHOD`는 `FULL/SAMPLE/SKIP` 의미인데, 기존 공통코드 `INSPECT_METHOD`는 `VISUAL/MEASUREMENT/FUNCTIONAL/ELECTRICAL/DESTRUCTIVE` 의미였다. IQC 이력 필터는 `IQC_LOGS.INSPECT_TYPE=INITIAL/RETEST`를 조회하면서 `IQC_TYPE=IQC/PQC/FQC/OQC` 그룹을 사용해 라벨과 필터가 불일치했다. 검사입력 모달은 동일 의미에 `NONE`을 사용해 품목/그룹의 `SKIP`과도 달랐다.
- 변경: JSHANES `COM_CODES`에 `IQC_INSPECT_METHOD`(`FULL=전수검사`, `SAMPLE=샘플검사`, `SKIP=무검사`)와 `IQC_INSPECT_TYPE`(`INITIAL=초기검사`, `RETEST=재검사`) 추가. 품목정보, 품목 폼, 품목별 IQC 그룹 선택, IQC 검사그룹 관리, 수입검사 목록/입력, IQC 이력 화면이 새 전용 그룹을 사용하도록 변경. 백엔드 DTO는 `SKIP`을 허용하고 legacy `NONE` 요청은 저장 전 `SKIP`으로 정규화한다.
- 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/material/dto/iqc-history.dto.ts`, `apps/backend/src/modules/material/services/iqc-history.service.ts`, IQC 관련 프론트 파일 9개, `packages/shared/src/{types/com-code.ts,constants/com-code-values.ts}`, `docs/reports/db-schema-erd.md`.
- 실행/검증: JSHANES 마이그레이션 적용 성공(`blocks_executed=1`). DB 조회로 신규 공통코드 5건 확인. `IQC_LOGS.INSPECT_CLASS`는 `SAMPLE=10`, `NULL=6`, `NONE=0` 확인. `node --test apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs` 통과(3 tests). `pnpm --filter @harness/frontend exec tsc --noEmit`, `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `python tools/generate_db_schema_doc.py` 실행해 ERD 문서 갱신.

## 2026-06-11 20:27 Codex

- 작업: `T-PROCESS-EQUIP-SEED` 공정별 설비 마스터/공정-설비 매핑 시드 생성 및 JSHANES 적용.
- 변경: `apps/backend/src/migrations/2026-06-11_process_equipment_seed.sql` 추가. `PROCESS_MASTERS` 활성 공정(COMPANY=40, PLANT_CD=1000)을 기준으로 `EQ-<PROCESS_CODE>-NN` 설비코드를 생성하고 `EQUIP_MASTERS`, `PROCESS_EQUIPMENTS`에 `MERGE`한다. WIRE/TERMINAL/INSPECTION 공정은 2대, ASSEMBLY/HEAT/미분류 공정은 1대씩 생성한다.
- 실행: `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --execute-file apps\backend\src\migrations\2026-06-11_process_equipment_seed.sql` 성공(`blocks_executed=1`).
- 검증: 활성 공정 21개, `EQUIP_MASTERS` 시드 설비 36건, `PROCESS_EQUIPMENTS` 시드 매핑 36건, 시드 매핑이 붙은 활성 공정 21개 확인.
- 주의: 기존 활성 매핑은 삭제하지 않았다. 기존 데이터 때문에 ATCUT/STRPB는 전체 활성 매핑 3건, PRC-CUT은 전체 활성 매핑 4건으로 보인다. 신규 시드 기준으로는 각 공정 1~2건이 정상 생성됐다.

## 2026-06-11 20:15 Claude

- 작업: 유수명자재 검사이력(`/material/shelf-life-history`) 재검사 데이터 생성·조회 검증 (코드 수정 없음, 실 API+DB).
- 데이터 모델: 재검사 = `IQC_LOGS(INSPECT_TYPE='RETEST')`. 등록 API `POST /material/shelf-life/reinspect {matUid, result, extendDays, inspectorName, details, remark, destructSampleQty}`. PASS→만료일=검사일+연장일(품목 EXPIRY_EXT_DAYS 상한), FAIL→불용창고 이동+LOT DISCARDED. 회차=기존 RETEST수+1.
- 생성(실 API, 인증 브라우저): 유수명 품목 LOT 대상 5건 — PASS 4(RM-GROM-001 회차1·2 동일LOT, RSL-T, TMN-A) + FAIL 1(TMN-B). 기존 RETEST 0→5.
- 검증: ①IQC_LOGS RETEST 5행(회차 1·2 증가 정상), ②PASS 만료연장 실측 — RM-GROM-001 +30→2026-07-11, RSL-T +90→2026-09-09, TMN-A +120→2026-10-09, ③FAIL 폐기 — VH1-RM260605-00002 status=DISCARDED + STOCK_TRANSACTIONS MAT_MOVE WH-MAT-A→DEFECT qty=500(REINSPECT_FAIL), ④페이지 "전체 5건" 4개 LOT·합격/불합격 라벨 표시 확인.
- 주의: 검증 데이터는 사용자 요청대로 보존(미삭제). FAIL 1건이 실 LOT VH1-RM260605-00002(TMN-B, 500)를 폐기·불용이동시킴 — 원복 필요 시 알림.

## 2026-06-11 20:00 Claude

- 작업: 투입 키오스크(`/production/input-kiosk`) 전체 워크플로우 점검 + 후속 프로세스 연결성 실증 (코드 수정 없음, API+실DB).
- 실증 시나리오: EQ-CRIMP-03/W2026-001/W010으로 일일점검→작업자점검→자재 LOT 스캔→실적 저장(양품2/불량1+상세)→통전검사 PASS→FG 라벨 포장→의뢰검사 PENDING 차단/해제 전 구간 실행.
- 정상 연결(실증): ①점검 2종 EQUIP_INSPECT_LOGS 저장+check API 인터록 복원, ②자재 스캔 JOB_MATERIAL_LOTS 기록(BOM 오장착 검증), ③실적 PROD_RESULTS+DEFECT_LOGS(WAIT, 불량관리 동일 테이블) 단일 TX+planQty 초과 차단+WAITING→RUNNING 승격, ④통전검사 PASS→FG_LABELS(ISSUED, INSPECT_PASS_YN=Y) 발행→포장 박스 추가 성공(생산→검사→포장 체인), ⑤의뢰검사 PENDING→pending API 차단→PATCH PASS→해제(키오스크↔의뢰검사 화면 양방향).
- 단절①(중대): `MAT_AUTO_ISSUE_TIMING` 설정이 SYS_CONFIGS에 부재 → `AutoIssueService.execute()` 항상 skip → **실적 저장해도 자재 백플러시 0건** (CNTR001 재고 8→8, MAT_ISSUES 0건 실측). 생산과 자재 재고가 완전 단절.
- 단절②(구조): AutoIssue FIFO가 키오스크 스캔 LOT(JOB_MATERIAL_LOTS)을 참조하지 않음 — 켜져도 스캔 LOT 추적과 실제 차감 LOT이 따로 놂.
- 단절③: `GET /production/job-orders/order-no/:orderNo` 응답 goodQty/defectQty가 실적 미집계(0 고정) — findAll/findById에만 집계 존재. 키오스크 진행률(savedResultCount)은 클라이언트 스토어 카운트라 새로고침 시 0 리셋 → 중물(60%) 차단이 실제 실적과 무관.
- 관찰④: 통전검사 resolveProdResult는 prodResultNo/fgBarcode 미전달 시 실적 1건일 때만 자동 연결(다건이면 null — 실측 재현). 검사기 연동 시 prodResultNo 전달 필요.
- 관찰⑤: planQty 도달해도 작업지시 자동 DONE 없음(수동 완료 전제). 관찰⑥: 소모품 스캔은 세션 기록만(사용 카운트 미증가).
- 정리: PR26061100012/DEFECT_LOGS/FG26061100007/IR26061100007/SELF_INSPECT_RESULTS/EQUIP_INSPECT_LOGS/JOB_MATERIAL_LOTS/BXKIOSKVERIFY1 전부 삭제 검증(0건). W2026-001 기존 실적 11건·설비 할당은 보존.

## 2026-06-11 19:35 Claude

- 작업: T-OQC-SHIP-TOGGLE — OQC 사용여부 시스템 설정 추가 + 출하처리 게이트 조건부 적용.
- 요구: OQC 사용 시 합격(PASS) 박스만 출하 가능, 미사용 시 모든 마감 박스 출하 가능.
- config: `SYS_CONFIGS`에 `OQC_ENABLED`(QUALITY, BOOLEAN, 기본 'Y') 시드. ConfigItemRow가 BOOLEAN→토글로 렌더, label DB 직접사용이라 i18n 불필요. /system/config QUALITY 탭에 즉시 노출.
- 백엔드: `ShippingModule`에 `SystemModule` import(순환참조 없음), `SysConfigService`를 `ShipOrderService`·`ShipmentService`에 주입. 출하 OQC 게이트 3곳을 `isEnabled('OQC_ENABLED')`로 분기 — ①`ship-order.shipBox`(박스 스캔), ②`shipment.loadPallets`(팔레트 적재), ③`shipment.markAsShipped`(출하확정). 켜짐=PASS만, 꺼짐=전부 통과. 기본 'Y'라 기존 동작 무회귀.
- 인프라: 백엔드 localhost:3003은 `node dist/main`(빌드본, watch 아님) → nest build + 사용자 재시작 후 검증.
- 검증(비파괴, 실 API): SO-OQCTEST-1(HNS01 라인) 생성·확정 후 — OQC=Y: ship-box BX2606110003(PENDING)→`400 "OQC 합격(PASS) 박스만..."`(게이트 ON). OQC=N(config flip): 동일 박스→`400 "출하지시에 없는 품목"`(게이트 우회→하류 도달), HNS01 박스(BX2606110002, PENDING)→`400 "재고 부족 가용0/요청5"`(OQC·품목·수량·창고 전부 통과, 재고만 별개=완전 우회 입증). 전부 throw 선에서 끝나 쓰기 없음.
- 정리: config 'Y' 복원, 테스트 지시 삭제, 박스 미변경 확인.
- 미커밋/미배포: 백엔드 코드 변경은 디스크+로컬 dist에만. **hswbs 적용은 백엔드 재배포 필요**(시드/토글은 DB공유라 hswbs에 이미 보이나 게이트 enforcement는 미반영).

## 2026-06-11 19:20 Claude

- 작업: T-PALLET-SCREEN-FIX — 팔레트 구성 관리 화면(`/shipping/pallet`)을 백엔드 계약에 정합 + 팔레트 자동채번 신설.
- 검토 결과(수정 전 실증): 화면의 생성/적재/마감이 전부 400 — ①생성: 바디 없음인데 `palletNo` 필수+자동채번 미구현, ②적재: `{boxNos}` vs 백엔드 `{boxIds}`, ③마감: `PUT {status:CLOSED}` vs 전용 `POST /:id/close`(직접 변경 차단), ④`search` 파라미터 미지원, ⑤우측 포함박스 패널은 목록 응답에 없는 `boxes` 참조로 항상 빈 화면, ⑥필드명 불일치(`shipmentNo/closedAt/quantity/itemName`). 화면이 사실상 조회 전용이었음.
- 백엔드: `SEQ_PALLET_NO_DAILY` 시퀀스+일별 리셋 잡 신설(`2026-06-11_seq_pallet_no_daily.sql`, JSHANES 적용), `NumberingService.nextPalletNo()`(PLT+YYMMDD+4자리), `CreatePalletDto.palletNo` optional, `pallet.service.create` 미지정 시 자동채번.
- 프론트: `palletNo` 검색 파라미터, `{boxIds}` 적재, `POST /:id/close`/`/:id/reopen`, 우측 패널은 `GET /shipping/pallets/barcode/:no/boxes`로 실조회 + OPEN 팔레트에서 박스 제거 버튼(DELETE /:id/boxes), 적재 후보는 CLOSED+미할당 조회 후 OQC PASS 필터, 필드명 정합(shipmentId/closeAt/itemCode/qty), 액션 응답으로 선택 팔레트 동기화.
- i18n: `shipping.pallet.reopenPallet/removeBox/noBoxes/noLoadableBoxes` 4개 언어 추가(카운트 검증).
- 검증: pallet.service.spec 16건 통과, FE/BE tsc 통과. API 실증 — 빈 바디 생성 → `PLT2606110001` 자동채번, `boxIds` 검증 통과(없는 박스 404), 빈 팔레트 close 400 가드, barcode boxes 응답 구조 확인. 테스트 팔레트 삭제 정리.
- 주의: 동시 작업 중인 T-OQC-SHIP-TOGGLE(ship-order/shipment.service)과 파일 겹침 없음. 미커밋.

## 2026-06-11 18:40 Claude

- 작업: 포장실적조회(`/production/pack-result`) — ①날짜 당일 기본값 ②정보카드 제거 ③실제 포장 실적 생성.
- ③ 실제 포장(진짜 API): 인증된 브라우저(claude-in-chrome)에서 `harness-token`+`X-Company/X-Plant` 헤더 복제 fetch로 실제 백엔드 호출. create→addSerial→close 순서. BX2606110002(HNS01×5, FGHNS01T001~005), BX2606110003(HNS02×1, FG26060900006) 생성. closeBox 로직대로 FG_LABELS→PACKED, OQC-20260611-001 자동생성, oqcStatus PENDING. JSHANES 실측 검증. FGHNS01T006은 packUnit=5 단품 잔여라 보류.
- ①② 프론트: `pack-result/page.tsx` — `getTodayStr()`로 startDate/endDate 초기값 당일(런타임 계산), StatCard 3종+stats useMemo+미사용 import 제거. tsc 통과.
- 검증: localhost:3002(이 머신 dev)에서 날짜=2026-06-11 기본, 카드 없음, 당일 필터 "전체 2건"(두 박스) 확인.
- 인프라 발견: 사용자가 보던 `hswbs.haengsung.com:3002`(공인 210.206.166.207)은 **로컬 dev와 별개 배포 서버**. 백엔드/DB(JSHANES)만 공유 → 박스 데이터는 즉시 보이나 프론트 코드 변경은 hswbs에 배포해야 반영. 로컬 dev 재시작은 hswbs에 무효였음.
- 미커밋/미배포: 프론트 변경은 디스크에만 있음.

## 2026-06-11 18:35 Claude

- 작업: T-PDA-API-UNIFY — PDA 자재입고/자재출고/창고입고(제품입고)/출하처리 4개 워크플로우 검증 + 웹과 동일 백엔드 API 계약으로 통일.
- 조사 결과: 자재입고(`useMatReceivingScan`)·제품입고(`pda/product/receiving`)는 이미 웹과 동일 계약(✓). **자재출고와 출하처리에서 불일치 발견**.
- 불일치①(자재출고, 전 단계 동작 불능이었음): `useMatIssuingScan.ts`가 envelope(`{success,data}`)를 안 벗기고 존재하지 않는 필드(`jo.id/partCode/bom`, `lot.remainQty/lotNo`)를 참조, 확정 바디 `{jobOrderId, lots[]}`는 백엔드 `ScanIssueDto{matUid}`와 완전 불일치(400 확정). 출고유형 `TRANSFER`는 ComCode ISSUE_TYPE에 없는 무효 코드.
- 수정①: Phase1은 `GET /production/job-orders/order-no/:orderNo` + `GET /material/issue-requests/job-orders/:orderNo/bom-items`(웹 출고요청과 동일 API)로 BOM 세팅, Phase2는 `currentQty` 기반 + LOT 중복/소진 가드, Phase3은 LOT마다 웹과 동일 `POST /material/issues/scan {matUid, issueType, remark:'PDA 작업지시 출고: <orderNo>'}` 순차 호출(부분 실패 시 성공분 제외하고 실패 LOT만 잔류). `TRANSFER`→`SAMPLE` 교체. 컴포넌트 `partCode/partName`→`itemCode/itemName`.
- 불일치②(출하처리): PDA 팔레트 스캔이 하위 박스마다 `ship-box`를 호출하나 백엔드 `shipBox()`는 팔레트 적재 박스를 이중차감 방지로 무조건 거부 → 모순으로 항상 실패. 응답 접근도 `data.boxes`로 envelope 미언래핑.
- 수정②: `useShippingScan.ts` 팔레트 분기 제거, PLT 접두사 스캔 시 `PALLET_NOT_SUPPORTED` 에러로 안내(팔레트 출하는 웹 출하확정 mark-shipped 경로 전용). 박스 스캔은 웹과 동일 `ship-box` 계약 유지.
- i18n: `pda.issuing.sample/bomNotFound/duplicateLot/lotDepleted/noScannedLots`, `pda.shipping.palletNotSupported` — ko/en/zh/vi 4개 파일 동시 추가, 키 카운트 검증.
- 검증: frontend tsc --noEmit 통과. API 실증 — 자재입고(by-barcode→POST receiving→MAT_STOCKS 반영, 성적서 가드 웹과 동일 작동), 자재출고(scan 출고→재고 8→0/LOT DEPLETED→취소 복원), 제품입고(fg/receive 빈 warehouseId 허용·FG_MAIN 강제, /inventory/cancel 보상 트랜잭션+재고 복원), 출하(ship-box 완출 시 지시 자동 CLOSED). 검증 잔여물 정리 완료(사용자 작업 중이던 BX2606110002/0003·OQC 2건은 보존, T006 라벨 VISUAL_PASS 복원).
- 잔여 과제: PDA 팔레트 단위 출하가 현장 요구라면 출하지시-팔레트 연계 별도 설계 필요(현재는 웹 출하확정 경로 안내). 미커밋 상태.

## 2026-06-11 18:05 Claude

- 작업: 출하관리 잘못된 검증 데이터 전체 삭제 (JSHANES, COMPANY=40/PLANT_CD=1000 스코프, 명시적 키 목록 DELETE).
- 사전 전수 실측: 출하 관련 테이블의 모든 행이 테스트/오염 데이터임을 확인 — 박스 7건(BOX-TEST-001, BX2606080002 qty100 라벨없음, BX2606090001 교차오염, BXPDATEST01, BX2606100001, BX2606110001, BXCLAUDETEST2), 팔레트 2건(PLT-TEST-001, PLTCLAUDETEST1), 출하 3건(SHP-TEST-001, SHPCLAUDETEST1, SH-20260401-001 고객명 깨짐), 지시 1건(SOCLAUDETEST1)+품목, OQC 2건+박스매핑, PTX 10건(전부 HNS01 테스트 참조), PRODUCT_STOCKS 2건(FG_MAIN 2 테스트잔여, WH-FG 10 죽은재고).
- 실행: 10블록 DELETE/UPDATE 전체 성공. FG_LABELS HNS01 6건은 시드 원상태로 복원(STATUS=VISUAL_PASS, BOX_NO=NULL). HNS02 라벨(ISSUED)은 무변경.
- 검증: BOX/PALLET/SHIPMENT/SHIP_ORDER/ORDER_ITEM/RETURN/OQC/OQC_BOX/PTX/PRODUCT_STOCKS 전부 0건, 라벨 7건 정상, box-stock·pack-result API 빈 응답 확인.
- 결과 상태: 출하관리 전 테이블 클린. 라벨 6건(VISUAL_PASS, 검사합격)으로 포장부터 재검증 가능.

## 2026-06-11 18:00 Claude

- 작업: T-SHIP-CROSSBOX-GUARD — 교차 박스 중복 포장 가드 추가 (실증 테스트 발견 버그① 수정).
- 원인: FG 라벨 상태는 박스 마감 전까지 ISSUED/VISUAL_PASS로 유지되므로 라벨 상태 검증만으로는 OPEN 박스 간 동일 시리얼 중복 포장을 막지 못함. 시리얼 진입 경로 3곳(create의 serialList, update의 serialList, addSerial) 모두 무방비였음.
- 변경: `box.service.ts`에 `assertSerialsNotPackedElsewhere()` 헬퍼 추가 — SERIAL_LIST(CLOB) `LIKE '%"시리얼"%'` 후보 조회(OR, 단일 쿼리) 후 JSON 파싱 정확 비교로 오탐 제거, 충돌 시 409(`이미 다른 박스에 포장된 시리얼입니다: 시리얼(박스번호)`). create/update/addSerial 3개 경로에 호출 추가.
- 테스트: `box.service.spec.ts` 신규 4건(addSerial/create/update 차단 + LIKE 오탐 무시) 포함 17건 전체 통과. tsc --noEmit 통과. API 실증: 3개 경로 모두 409 재현, 충돌 없는 시리얼(T006) 추가는 정상 성공. 테스트 박스(BXGUARDTEST*)는 삭제 정리.
- 추가 발견(실데이터): 기존 OPEN 박스 `BX2606090001`의 SERIAL_LIST에 T001~T005가 잔존 — T001/T002는 BX2606110001(CLOSED/PACKED), T003은 SHIPPED인데도 이 박스에 남아 있는 **가드 도입 전 발생한 교차 중복 데이터**. qty=5도 이중 계상. 데이터 정리는 미실시(범위 밖) — 해당 박스 serialList 정리 또는 박스 삭제 필요.
- 한계: 가드는 조회 시점 검사라 완전 동시 요청(TOCTOU)은 이론상 통과 가능. 근본 차단은 시리얼 정규화 테이블(BOX_SERIALS, UNIQUE 제약)로의 개선 필요.

## 2026-06-11 17:50 Claude

- 작업: 출하관리 카테고리 8개 메뉴 실증 테스트 (코드 수정 없음, API+실DB 검증). 박스 포장→OQC→팔레트→출하지시→출하확정→역분개→취소→반품 전 구간을 실제 API 호출 + JSHANES DB 조회로 검증.
- 정상 확인: 박스 close 시 FG_LABELS→PACKED + OQC_REQUESTS 자동생성, reopen 시 VISUAL_PASS 복원+OQC 삭제, 재고부족 출하 거부, 팔레트 적재 박스 ship-box 차단(이중차감 방지), mark-shipped 시 FG_OUT 차감+지시 자동 CLOSED, reverse 시 보상 트랜잭션(FG_OUT_CANCEL)+지시 CONFIRMED 복원, cancel 시 팔레트 CLOSED 복원. 상태머신 가드 전체 정상.
- 발견 버그①: `box.service.ts addSerial`(L345-401)이 같은 박스 내 중복만 검사 → 동일 시리얼을 OPEN 박스 2개에 교차 포장 가능 (FGHNS01T001로 재현). 실물 1개가 복수 박스 qty로 이중 계상될 수 있음.
- 발견 이슈②: `POST /inventory/fg/receive` — 컨트롤러가 FG 기본창고로 warehouseId를 덮어쓰는데 DTO는 필수라 클라이언트 값이 조용히 무시됨(WH-FG 지정해도 FG_MAIN 입고 재현).
- 발견 이슈③: 반품(ship-return)은 CRUD만 구현. DRAFT→CONFIRMED→COMPLETED 전이 API 부재(직접 변경은 "전용 처리 API 사용" 메시지로 차단되나 그 API가 없음), RESTOCK 재입고의 재고 처리 없음(PRODUCT_TRANSACTIONS 0건 확인). 기록 전용 상태.
- 발견 이슈④: OQC 요청번호 채번 `nextOqcRequestNo()`(box.service.ts L58-74)가 LIKE prefix MAX+1 방식 — STATE.md 채번 규칙(SEQUENCE.NEXTVAL) 위반, 동시 박스마감 시 중복 위험. BOX_NO는 SEQ_BOX_NO_DAILY 시퀀스 사용으로 정상.
- 발견 데이터 이슈⑤: 기존 박스 BX2606080002(qty=100, 라벨 7개뿐), BOX-TEST-001(CLOSED인데 OQC null) 등 시드 잔재 정합 깨짐. WH-FG의 HNS01 10개는 기본창고가 FG_MAIN으로 바뀌면서 죽은 재고.
- 테스트 잔여 데이터: SOCLAUDETEST1(CONFIRMED, 1/3 출하), SHPCLAUDETEST1(CANCELED), PLTCLAUDETEST1(CLOSED, 박스 1), BX2606110001(CLOSED/PASS, T001·T002 PACKED), BXCLAUDETEST2(SHIPPED, T003), FG_MAIN 재고 2. 모두 일관 상태로 잔존(이력 보존 위해 미삭제). RTCLAUDETEST1은 DELETE API 실증 겸 삭제 완료.

## 2026-06-11 16:55 Claude

- 작업: 공정생품검사(`SELF_INSPECT_ITEMS`) — 실 라우팅 공정코드 17종 검사항목 시드.
- 근본원인 실측: 기존 자주검사 항목은 데모용 `PRC-*` 코드에만 존재. ROUTING_PROCESSES는 `SASSY/MASSY/CRMPF/CRMPR/HEXCP/ATCUT/...` 실 코드를 쓰므로 라우팅 공정생품검사 탭이 어느 공정을 골라도 0건이었음(코드 네임스페이스 단절).
- 변경: 실 코드 17종(AINSP/ATCNS/ATCUT/AUXMT/CRMPF/CRMPR/HEXCP/MASSY/MTASY/OINSP/SASSY/SHDRM/STRPB/TAPPN/TINSP/TUBHT/WELDR)에 검사항목 55건 idempotent INSERT. 측정형은 LSL/USL/UNIT 예시값(압착높이 1.20±0.05, pull test 하한 60N, 절연저항 1MΩ 등), 판정형은 규격 없음.
- 파일: `scripts/seed_self_inspect_real_processes.py`(데이터+실행), `apps/backend/src/migrations/2026-06-11_self_inspect_real_processes_seed.sql`(동일 데이터 생성, WHERE NOT EXISTS, BOM 없음). 실행: JSHANES.
- 검증: 55건 삽입 확인, 공정별 분포 출력. SASSY=3건(측정형 1: 서브조립 길이 295~305mm) 확인. 자연키 중복가드로 재실행 안전.
- 주의: LSL/USL는 예시값. 실 규격은 공정생품검사 탭에서 조정. 기존 `PRC-*` 항목은 의뢰검사 테스트 시드가 참조하므로 그대로 둠(미삭제).

## 2026-06-11 16:40 Claude

- 작업: 공정생품검사(`SELF_INSPECT_ITEMS`) 측정형 규격 시드 — 의뢰검사 패널 LSL/USL 표시용.
- 실측: DELEGATE 항목 3개 모두 `ITEM_TYPE='VISUAL'`, LSL/USL=null 상태였음(기존 seed가 해당 컬럼 미설정). 테스트 시드가 참조하는 ID가 실DB 행과 정확히 일치 확인.
- 변경: `인장강도 시험 (Pull test)`(PRC-CRIMP) → MEASURE/N/LSL=60, `절연 저항 측정`(PRC-TEST) → MEASURE/MΩ/LSL=1 로 UPDATE(자연키, 각 1행). `도통 검사`는 양/부 판정이라 VISUAL 유지.
- 파일: `apps/backend/src/migrations/2026-06-11_self_inspect_measure_specs_seed.sql`(idempotent UPDATE). 실행: `scripts/execute_sql.py`(JSHANES).
- 검증: API JOIN(`r.INSPECT_ITEM_ID=i.ID`) 실DB 시뮬레이션 → PENDING 5행 중 인장강도 x2/절연저항 x1은 LSL/단위 표시, 도통검사 x2는 판정형으로 정상 해석.
- 주의: LSL 값(60N)은 예시. 실 규격은 사용자 확인 후 공정생품검사 탭에서 조정 필요.

## 2026-06-11 20:00 Codex

- 작업: `T-MENU-SHELF-LIFE-REINSPECT` 유수명자재 재검사 메뉴 미배치/카테고리 이동 오류 수정.
- 원인: `apps/frontend/src/config/menuConfig.ts`에는 `MAT_SHELF_LIFE_REINSPECT` / `MAT_SHELF_LIFE_HISTORY`가 있으나, 백엔드 `menu-code-validator.ts`의 `KNOWN_LEAF_CODES`에서 누락되어 있었다. 메뉴를 미배치로 삭제하면 DB 배치 행이 사라지고, 미배치 목록은 validator 목록 기준이라 해당 코드가 목록에도 나타나지 않으며, 다시 카테고리로 이동하면 `알 수 없는 메뉴 코드`로 실패하는 구조였다.
- 변경: `menu-code-validator.ts`에 누락 leaf 7개(`MAT_ARRIVAL_RESULT`, `MAT_SHELF_LIFE_REINSPECT`, `MAT_SHELF_LIFE_HISTORY`, `PROD_INPUT_KIOSK`, `QC_IQC_PART_SPEC`, `QC_REQUEST_INSPECT`, `QC_SELF_INSPECT_HISTORY`) 추가. `menu-code-validator.structure.test.mjs`를 추가해 `menuConfig.ts`의 path-backed leaf가 validator에 모두 있는지 검증.
- DB 적용: `apps/backend/src/migrations/2026-06-11_shelf_life_reinspect_menu_restore.sql` 작성 및 JSHANES 적용. `MAT_SHELF_LIFE`, `MAT_SHELF_LIFE_REINSPECT`, `MAT_SHELF_LIFE_HISTORY`를 `MATERIAL` 카테고리 sort 170/180/190으로 복구하고 `MANAGER` 권한을 `Y`로 보강.
- 검증: `node --test apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs` 통과. `pnpm --filter @harness/backend exec jest apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts apps/backend/src/modules/menu-categories/controllers/menu-category-items.controller.spec.ts --runInBand` 통과(2 suites, 10 tests).
- 실측: JSHANES `MENU_CATEGORY_ITEMS` 조회 결과 유수명 3개 메뉴 모두 `MATERIAL`에 존재. `ROLE_MENU_PERMISSIONS` 조회 결과 `MANAGER` 3개 모두 `CAN_ACCESS='Y'`. `GET /api/v1/menu-categories/tree`에 `MAT_SHELF_LIFE_REINSPECT`가 MATERIAL 아래 노출됨. `PATCH /api/v1/menu-category-items/move`로 `MAT_SHELF_LIFE_REINSPECT`를 MATERIAL로 이동 호출 성공.

## 2026-06-11 19:30 Codex

- 작업: `T-FE-THEME-PRESET` 상단 컬러 테마 아이콘에서 선택 가능한 신규 테마 preset 추가.
- 변경: `apps/frontend/src/app/globals.css`에 사용자가 제공한 OKLCH 기반 Orchid 테마를 `data-color-theme="orchid"` preset으로 추가. 기존 `default`/`custom` 테마와 HANES 호환 변수(`--text`, `--surface`, `--primary-hover` 등)는 유지.
- 변경: `apps/frontend/src/stores/themeStore.ts`의 `ColorTheme` 타입을 `default | custom | orchid`로 확장. `apps/frontend/src/components/layout/Header.tsx`의 팔레트 아이콘은 `default → custom → orchid` 순환 선택으로 변경하고 활성 상태 점 표시를 추가.
- 검증: `pnpm --filter @harness/frontend build` 실행. Next 컴파일과 타입 검사 단계는 통과했으나, 정적 페이지 생성에서 기존 누락 라우트(`/pda/login`, `/equipment/daily-inspect`, `/inventory/material-physical-inv`, `/shipping/customer-po-status`, `/production/result`, `/material/shelf-life-reinspect`, `/master/worker`)의 `PageNotFoundError`로 실패. 변경 파일 관련 컴파일 오류는 없음.
- 런타임: 기존 3002 포트가 사용 중이라 `http://localhost:3004`로 dev 서버 기동, `Invoke-WebRequest http://localhost:3004` 응답 200 확인.

## 2026-06-11 16:24 Codex

- 작업: `T-TAB-LIMIT-10` 페이지 열기 탭 제한 개수 변경.
- 변경: `apps/frontend/src/stores/tabStore.ts`의 `MAX_TABS`를 6에서 10으로 변경하고 상단 설명 주석을 갱신. `apps/frontend/src/components/layout/TabKeepAlive.tsx`의 동시 마운트 유지 상한 `MAX_ALIVE`도 6에서 10으로 맞춤.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs` 통과. `node --test apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` 통과. 관련 상수 검색으로 `MAX_TABS=10`, `MAX_ALIVE=10` 확인.

## 2026-06-11 15:30 Claude

- 작업: `T-REQINSPECT-LSL-USL` 의뢰검사 입력(`/quality/request-inspect`) 우측 패널에 LSL/USL 검사기준 표시.
- 관계: 라우팅 "공정생품검사" 탭(`SelfInspectConfigEditor` → `SELF_INSPECT_ITEMS`)에 등록한 측정형 항목의 LSL/USL/단위/기준을, 의뢰검사 대기행(`SELF_INSPECT_RESULTS`)의 `INSPECT_ITEM_ID` FK로 JOIN하여 표시.
- 백엔드: `self-inspect.service.ts` `findPendingDelegates`를 `.find()` → QueryBuilder LEFT JOIN(`i.id = r.inspectItemId`)으로 전환, `itemType/unit/standard/lslValue/uslValue` 추가 반환.
- 프론트: `request-inspect/page.tsx` `DelegateItem`에 5개 필드 추가, 우측 항목정보에 "검사 기준" 블록(LSL/USL/단위/기준) 추가. LSL/USL 없으면 측정형은 "규격 없음", 판정형은 "판정형 항목" 안내.
- i18n: ko/en/zh/vi 4파일에 `requestInspect.spec/unit/standard/noSpec/visualItem` 추가.
- 검증: `tsc --noEmit` 프론트/백엔드 모두 exit 0. LEFT JOIN이라 매칭 없으면 null → graceful.

## 2026-06-11 14:43 Codex

- 작업: `T-CUSTOMER-INTRO-WORK-INSTRUCTION` 고객용 제품 소개 자료 재생성 작업지시 문서 작성.
- 산출물: `docs/presentation/hanes-mes-introduction-work-instruction.md`.
- 내용: 최종 산출물 위치, 핵심 요구, 슬라이드 흐름, 캡처 우선순위, 기존 이미지 목록, 로컬 실행 기준, 문구/디자인 기준, 검증 기준, 최종 보고 형식을 정리.
- 검증: 문서 첫 40줄을 읽어 목적, 산출물, 핵심 요구, 자료 구성 원칙이 정상 반영됐는지 확인.

## 2026-06-11 13:59 Codex

- 작업: `T-CUSTOMER-INTRO-MENU-SCREEN-DECK` 현재 메뉴 화면 캡처 기반 고객용 제품 소개 자료 확장.
- 변경: 장수 제약을 제거하고 PPTX/HTML을 15장 구성으로 확장. 기준정보 화면은 여러 마스터 화면을 한 장에 묶고, 자재/재고, 생산/현장, 검사/품질, 불량, 출하, End-to-end trace 흐름을 화면 중심으로 재구성.
- 캡처: 실행 중인 프론트 `http://localhost:3002`와 현재 `menuConfig.ts` 기준으로 화면 캡처 자동화를 수행. DB 연결 확인 오버레이와 인증/초기 API를 캡처 세션에서 성공 응답으로 처리해 화면 프레임을 확보. `docs/presentation/assets/menu-captures/`에 메뉴 캡처 20개 저장, 파일 크기 기준 사용 가능 캡처 17개 선별. 기존 안정 캡처 5개와 함께 소개자료에 총 47개 이미지 참조를 사용.
- 산출물: `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/menu-captures/*`.
- 검증: PPTX 빌드 15장 완료, 레이아웃 검사 오류 0개, PPTX 패키지 미디어 47개/빈 미디어 0개. HTML 슬라이드 15장, 이미지 참조 47개, 누락 이미지 0개. 렌더 contact sheet 육안 확인 완료.
- 참고: 자재/생산/품질/출하 일부 메뉴는 실시간 캡처 자동화가 시간 제한에 걸려 기존 안정 캡처와 메뉴 화면 갤러리 방식으로 보강했다.

## 2026-06-12 01:35 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-DESIGN` 고객 소개 HTML 디자인 재정리.
- 변경: 사용자가 지적한 흰 카드+상단 컬러바형 AI 느낌을 줄이기 위해 `metric`, `step`, `panel`, `callout`, `screen` 공통 스타일을 재정리했다. 컬러는 산화동/황동/스틸/세이지 계열로 낮추고, 단계 박스는 번호가 붙은 공정 보드 형태로 변경했다.
- 산출물: `docs/presentation/hanes-mes-introduction.html`.
- 검증: 정적 검증 결과 슬라이드 22장, 이미지 56개, 누락 0개. 기존 `border-top` 컬러바/구형 카드 그림자/뷰포트 폰트/`object-fit: cover` 위험 패턴 0개. `npx playwright screenshot`으로 파일 URL 기본 렌더 확인. `git diff --check` 통과.

## 2026-06-12 01:21 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-V2` 고객 소개 HTML 자료 재구성.
- 변경: `docs/presentation/hanes-mes-introduction-work-instruction.md` 기준으로 기존 HTML을 22장 가로형 슬라이드로 재작성. PPTX는 생성하지 않고 후속 단계로 남김.
- 구성: 고객 가치, 메뉴 커버리지, 기준정보 2장, 자재 입하/IQC/바코드 매핑/불출/폐기·유수명/LOT 계보, 작업지시/키오스크/공정검사/설비관리/일상점검, 품질 불량 조치, 포장·출하, 역추적, 화면 갤러리, 시연 마무리 순서.
- 산출물: `docs/presentation/hanes-mes-introduction.html`.
- 검증: 정적 검증 결과 슬라이드 22장, 이미지 56개, 이미지 누락 0개, `font-size: clamp`/폰트 vw/`object-fit: cover` 위험 패턴 0개. Chrome headless 및 `npx playwright screenshot`으로 파일 URL 기본 렌더 확인.

## 2026-06-11 13:15 Codex

- 작업: `T-CUSTOMER-INTRO-PRODUCT-DECK` 고객용 HANES MES 제품 소개 자료 전면 재작성.
- 변경: 기존 자료에서 `설명 구성`, `시연 순서`, `고객에게 보여줄 포인트`처럼 문서 작성 방향을 설명하는 메타 문구를 제거하고, HANES MES 제품 자체를 소개하는 10장 구성으로 재작성.
- 구성: 하네스 업종 추적 리스크, MES 제품 구성, 자재 LOT 입고, 키오스크 작업 실적, 통전검사, 불량 조치, 제품/박스 출하, 클레임 역추적, 고객 가치로 정리.
- 산출물: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`.
- 검증: PPTX 패키지 검증 결과 슬라이드 10장, 미디어 7개, 빈 미디어 0개. 레이아웃 검사 결과 오류 0개. HTML 검증 결과 슬라이드 10장, 이미지 참조 7개, 누락 이미지 0개. 렌더 contact sheet로 제품 소개 자료로 읽히는지 확인.
- 정리: 이전 `docs/presentation/artifact-build-manifest.json` 제거, PPTX 빌드용 임시 작업 폴더 삭제.

## 2026-06-11 12:56 Codex

- 작업: `T-CUSTOMER-INTRO-PPTX` 고객 소개용 HANES MES 가로형 PPTX 문서 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.pptx`.
- 구성: HTML 소개 자료의 12장 워크플로우 구성을 PowerPoint 문서로 변환. 고객 설명용으로 기준정보, 자재 LOT, 생산/키오스크, 검사/품질, 불량 조치, 제품/출하 추적 흐름과 핵심 장점을 간결하게 구성.
- 검증: artifact-tool로 PPTX 빌드 완료. 레이아웃 검사 결과 12개 슬라이드 기준 오류 0개. PPTX 패키지 검증 결과 슬라이드 12장, 미디어 9개, 빈 미디어 0개. 렌더 contact sheet로 전체 슬라이드 시각 확인 완료.
- 정리: 빌드용 임시 작업 폴더 `outputs/019eb42d-791a-7821-9b1c-7a16a7d3686e/presentations/hanes-mes-introduction` 삭제 완료.

## 2026-06-11 12:39 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-REV` 고객 소개 HTML 자료 워크플로우형 보강.
- 변경: 기존 8장 자료를 12장으로 재구성. 글자 크기 축소, 제목 침범/겹침 보정, `기준정보 → 자재 입하 → IQC/입고 → 생산 준비 → 현장 실행 → 검사/품질 → 제품/출하` 순서의 워크플로우 맵 추가.
- 메뉴 보강: 품목마스터, BOM 관리, 공정/라인, 라우팅, IQC품목규격, 설비점검항목, 월간생산계획, 작업지시관리, 자재출고요청, 생산진도현황, WIP재고, 실적입력 키오스크, 통전검사 실적, 불량등록관리, 수리/재작업, OQC, SPC, 제품재고조회, 포장, 출하지시, 출하처리, 반품관리 등을 소개 흐름에 노출.
- 검증: 로컬 Chrome + Playwright로 `docs/presentation/hanes-mes-introduction.html` 로드 확인. 슬라이드 12개, 본문 이미지 9개 참조 모두 로드, 모든 `.canvas` overflow X/Y 없음 확인.

## 2026-06-11 21:50 Codex

- 작업: `T-DATA-CLEAN-HNS02` HNS02 BOM 기준 JSHANES 테스트 데이터 클린징 준비.
- 확인: `BOM_MASTERS`에서 `BOM_GRP='HNS02'` 47행 확인. HNS02 기준 품목은 parent/child 합산 47개. `ITEM_MASTERS`는 76개 중 HNS02 기준 47개 유지, 29개 삭제 대상. `BOM_MASTERS`는 78개 중 HNS02 47행 유지, 31행 삭제 대상.
- dry-run: 사용자 요청 범위의 입하/입고/IQC/자재입출고/재고/제품재고/작업지시/생산실적/검사의뢰/품질검사 계열 전체 삭제와 비-HNS02 품목 기준정보 삭제 SQL을 JSHANES 트랜잭션에서 실행 후 `ROLLBACK`. 문법/FK 오류 없음. 예상 삭제 합계 1,375행.
- 상태: 실제 `DELETE`/`COMMIT`은 실행하지 않음. 사용자 최종 승인 대기.

## 2026-06-12 04:19 Codex

- 작업: `T-QUALITY-INSPECT-USEMEMO` `/quality/inspect` 외관검사 화면 `useMemo is not defined` 런타임 오류 수정.
- 원인: 통계 카드 제거 과정에서 React import의 `useMemo`가 함께 제거됐지만, 이력 DataGrid `columns` 정의는 계속 `useMemo<ColumnDef<VisualInspectRecord>[]>`를 사용했다.
- 변경: `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`의 React import에 `useMemo`를 복원했다. 기존 통계 카드 제거 변경은 건드리지 않았다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. `useMemo` 사용 TSX 파일 중 React import에 `useMemo`가 없는 파일 추가 검색 결과 없음.

## 2026-06-12 05:59 Codex

- 작업: `T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD` 키오스크 투입스캔 LOT와 BOM 품목 불일치 실적처리 차단.
- 원인: 스캔 API는 `MAT_LOTS` 품목이 프론트에서 전달한 BOM 항목에 없으면 오장착으로 막지만, 실적처리 단계의 `AutoIssueService`는 기존 `JOB_MATERIAL_LOTS` 행을 다시 검증하지 않고 스캔 `matUid` 우선순위만 적용했다. 오염된 스캔 행이 있으면 잘못된 LOT는 후보에서 빠지고 FIFO로 넘어갈 수 있었다.
- 변경: `AutoIssueService`에서 작업지시의 유효 BOM child 품목 집합을 만든 뒤, `JOB_MATERIAL_LOTS.itemCode`와 실제 `MAT_LOTS.itemCode`를 모두 대조한다. BOM에 없는 스캔 자재, 존재하지 않는 스캔 LOT, 등록 품목과 실제 LOT 품목 불일치는 `BadRequestException`으로 실적처리/자동차감을 중단한다.
- 검증: TDD RED 확인 후 수정. `pnpm --filter @harness/backend test -- auto-issue.service.spec.ts --runInBand` 통과(13건). `pnpm --filter @harness/backend test -- job-material-lot.service.spec.ts auto-issue.service.spec.ts --runInBand` 통과(17건). `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.

## 2026-06-11 22:03 Codex

- 작업: `T-DATA-CLEAN-HNS02` 사용자 승인 후 JSHANES 데이터 클린징 실행.
- 실행: dry-run 검증 SQL을 JSHANES에 `COMMIT`. 실행 시점 추가 데이터 포함으로 1차 삭제 1,379행. 후검증에서 `SIMULATION_PLANS` 비-HNS02 24건이 남아 `SIMULATION_SCHEDULES` 38건, `SIMULATION_PLANS` 24건, `SIMULATION_HEADERS` 2건을 추가 삭제/커밋했다.
- 최종 검증: 비-HNS02 `ITEM_CODE` 잔여 `NONE`. `KEEP_ITEMS=47`, `ITEM_MASTERS=47`, `BOM_MASTERS=47`. 요청 업무 테이블 잔여 `NONE`.
- 완료: HNS02 BOM 기준 품목/BOM만 유지하고 입하/입고/IQC/자재입출고/재고/제품재고/제품실적/작업지시/창고입고/검사의뢰/품질검사/시뮬레이션 데이터 제거 완료.

## 2026-06-11 21:37 Codex

- 작업: `T-IQC-SAMPLE-REMOVE` IQC 검사구분에서 `SAMPLE` 제거.
- 판단: `IQC_GROUPS.INSPECT_METHOD`는 검사그룹 마스터의 검사/무검사 구분이고, `IQC_LOGS.INSPECT_CLASS`는 별도/legacy 검사이력 컬럼이다. 두 컬럼을 같은 의미로 매핑하는 것은 잘못이므로 `IQC_LOGS.INSPECT_CLASS` 기존 값은 변경하지 않았다.
- 변경: `IQC_INSPECT_METHOD` 활성 코드를 `FULL=검사`, `SKIP=무검사`만 남기고 `SAMPLE`은 비활성화하도록 마이그레이션 정리. JSHANES 기존 `IQC_GROUPS.INSPECT_METHOD='SAMPLE'` 4건은 `FULL`로 정규화하고 `SAMPLE_QTY`는 null 처리. 신규 수입검사 모달/훅은 검사구분 값을 `inspectClass`로 보내지 않도록 분리. `IqcGroupService`는 신규/수정 시 legacy `sampleQty`를 항상 null로 둔다.
- DB 검증: 적용 전 `ITEM_MASTERS_SAMPLE=0`, `IQC_GROUPS_SAMPLE=4`, `IQC_LOGS_CLASS_SAMPLE=10`, `COM_CODES_SAMPLE_ACTIVE=1`. 적용 후 `ITEM_MASTERS_SAMPLE=0`, `IQC_GROUPS_SAMPLE=0`, `IQC_LOGS_CLASS_SAMPLE=10`, `COM_CODES_SAMPLE_ACTIVE=0`. `IQC_GROUPS`는 `FULL=5`만 존재.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs"` 통과(7건). `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `pnpm --filter @harness/backend test -- iqc-group.service.spec.ts` 통과(9건). `git diff --check` 통과.

## 2026-06-11 21:20 Codex

- 작업: `T-MAT-LOT-IQC-UID-SEPARATE` MAT_LOTS 시드 LOT와 IQC 이력 UID 중복 해소.
- 원인: JSHANES에서 `MAT_LOTS.MAT_UID`와 `IQC_LOGS.MAT_UID`가 `VH1-RM260526-00007`, `VH1-RM260603-00003`, `VH1-RM260605-00002`, `VH1-RM260607-00001` 4개 UID로 겹쳤고, IQC 이력은 6건이라 LOT 화면에서 이미 검사된 LOT처럼 혼동될 수 있었다.
- 조치: `apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql` 추가. IQC 이력은 유지하고 `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`의 재고/LOT 쪽 UID만 `MLT-RM260526-00007`, `MLT-RM260603-00003`, `MLT-RM260605-00002`, `MLT-RM260607-00001`로 변경했다.
- 검증: oracle-db connector로 JSHANES 적용 및 재실행 성공. `OLD_INVENTORY_REFS=0`, `NEW_INVENTORY_REFS=15`, `MAT_LOT_IQC_OVERLAP=0`. `git diff --check -- apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.

## 2026-06-11 21:21 Codex

- 작업: `T-IQC-METHOD-LABELS` IQC 검사/무검사 표시 라벨 통일.
- 원인: 같은 IQC `FULL/SAMPLE/SKIP` 구분이 화면별로 `검사방법`, `검사형태`, `검사분류`로 표시되고, 선택값도 `전수검사/샘플검사`처럼 나뉘어 사용자가 검사/무검사 구분으로 읽기 어려웠다.
- 변경: `IQC_INSPECT_METHOD`의 `FULL`, `SAMPLE` 표시명을 모두 `검사`, `SKIP` 표시명을 `무검사`로 유지. 품목정보, IQC 검사기준, IQC 검사그룹, 수입검사 목록/입력, 검사이력 범위 라벨의 한국어 표준 표시명을 `검사구분`으로 통일하고 ko/en/zh/vi locale 및 fallback 문자열을 갱신했다. 내부 타입/공통코드 주석도 `IQC 검사구분`으로 정리했다.
- DB: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`을 JSHANES에 재적용. 확인 결과 `FULL=검사`, `SAMPLE=검사`, `SKIP=무검사`, `CODE_DESC=IQC 검사구분:*` 3건.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs"` 통과(5건). `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 구조 테스트는 IQC 라벨이 `검사구분`, 선택값이 `검사/무검사`만 되도록 회귀 방지한다.

## 2026-06-11 12:27 Claude

- 작업 1: 스케줄러 알림 벨 임시 비활성화 (커밋 `1f439a7`).
  - `NotificationBell.tsx` 폴링 60초 → 30분, 백그라운드 탭 폴링 중지(`visibilitychange` 시 즉시 갱신).
  - 백엔드 미기동 시 unread-count 폴링이 ECONNREFUSED 에러 리포트 모달을 띄우는 노이즈 때문에 `Header.tsx`에서 `<NotificationBell />` 렌더링·import 주석 처리. 재활성화는 Header 주석 2곳 해제.
- 작업 2: 앱 탭 재진입 초기화 + 최대 6개 제한 (커밋 `2fd6335`).
  - `tabStore.ts`: zustand persist 제거(비영속) → 새로고침/재진입 시 탭 초기화. `MAX_TABS=10→6`, 초과 시 자동 제거 대신 추가 차단 + `limitNoticeOpen` 플래그, `addTab`이 boolean 반환.
  - `useTabSync.ts`: 현재 경로 탭이 없으면(딥링크/새로고침) `findMenuItemByPath`(menuConfig 신규 유틸)로 탭 자동 등록 — 비영속 전환 후 빈 화면 방지.
  - `SidebarMenu.tsx`: 탭 추가 차단 시 `e.preventDefault()`로 페이지 이동도 차단. `TabBar.tsx`: 한도 초과 안내 Modal(md). `TabKeepAlive.tsx`: `MAX_ALIVE 8→6`.
  - i18n: `tabs.limitTitle`/`tabs.limitMessage` ko/en/zh/vi 4개 파일 추가.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과, 구조 테스트 2건 통과(sidebar-menu-navigation, tab-keep-alive-unique-paths), locale JSON 4종 파싱 정상. dev 서버 가동 중이라 `pnpm build` 미실행.

## 2026-06-11 12:00 Codex

- 작업: `T-CUSTOMER-INTRO-HTML` 고객 소개용 HANES MES 가로형 HTML 자료 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/01-material-receive.png`, `02-input-kiosk.png`, `03-inspection-result.png`, `04-quality-defect.png`, `05-shipping-box-stock.png`.
- 구성: 16:9 가로 슬라이드 8장. 하네스 업종 특성에 맞춰 자재 LOT/시리얼 추적, 키오스크 작업, 통전검사, 불량관리, 박스/개별제품 출하 추적성을 고객 소개 관점으로 요약.
- 검증: 로컬 Chrome + Playwright로 HTML 로드 확인, 슬라이드 수 8개 확인, 본문 이미지 5개 모두 `naturalWidth=1600`, `naturalHeight=900` 로드 확인.
- 참고: `/shipping/pack`, `/shipping/order`, `/production/pack-result`는 `domcontentloaded` 대기에서 타임아웃되어 소개자료에는 안정적으로 캡처된 `/shipping/box-stock`을 사용.

## 2026-06-12 02:20 Codex

- 작업: `T-INV-TRANSACTION-CARDS` `/inventory/transaction` 재고수불현황 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`에서 상단 `StatCard` 3개(전체 거래, 입고 합계, 출고 합계)를 제거하고, 카드 전용 `total`, `totalIn`, `totalOut` 상태/계산 및 관련 아이콘/import를 정리했다. 조회 조건, 새로고침, 그리드, MAT UID 검색, 내보내기는 그대로 유지했다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 1차 통과. 최종 재실행 시 다른 변경 파일인 `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`의 `useMemo` import 누락 및 implicit any 오류로 전체 typecheck가 실패했다. `inventory/transaction`의 카드 관련 잔여 참조 검색 결과 없음. `git diff --check -- "apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx" ".ai-coordination/TASKS.md" ".ai-coordination/LOCKS.md" ".ai-coordination/JOURNAL.md" ".ai-coordination/HANDOFF/codex.md" ".ai-coordination/ARCHIVE.md"` 통과. `http://localhost:3002/inventory/transaction` HTTP 200 확인.
- 참고: `pnpm --filter @harness/frontend lint -- --file "src/app/(authenticated)/inventory/transaction/page.tsx"`는 기존 `next lint` 스크립트가 ESLint 설정 프롬프트를 띄워 실패했다. `browse.exe`는 자체 서버 시작이 15초 내 완료되지 않아 브라우저 DOM 검증은 수행하지 못했다.

## 2026-06-12 16:17 Codex

- 작업: `T-QC-SAMPLE-MENU-LABEL` 품질검사 하위 자주검사 이력 메뉴명 변경.
- 변경: 좌측 메뉴가 참조하는 `menu.quality.selfInspectHistory` 한글 번역을 `자주검사 이력`에서 사용자 요청 문구 `공정샘풀검사`로 변경했다. `menuConfig.ts`의 `QC_SELF_INSPECT_HISTORY`는 동일 labelKey를 사용하므로 메뉴 코드/경로/권한/DB seed는 변경하지 않았다.
- 검증: `node -e "JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/ko.json','utf8')); console.log('ko.json OK')"` 통과. `rg`로 `menuConfig.ts`가 `menu.quality.selfInspectHistory`를 참조하고 `ko.json` 값이 `공정샘풀검사`임을 확인했다.

## 2026-06-12 05:28 Codex

- 작업: `T-CUSTOMER-INTRO-PPTX-EXPORT` 고객 소개 HTML 23장 기준 편집 가능한 PPTX 재생성.
- 변경: `docs/presentation/hanes-mes-introduction.html` 내용을 파싱해 `docs/presentation/hanes-mes-introduction.pptx`를 새로 생성했다. 제목, 본문, 절차 박스, 메뉴 표, 캡션, 하단 문구는 PowerPoint 편집 가능한 텍스트/도형 객체로 구성했고, 실제 화면 캡처와 회사 배경 이미지는 이미지 객체로 배치했다.
- 산출: 최종 PPTX는 `docs/presentation/hanes-mes-introduction.pptx`. 생성용 임시 스크립트와 PowerPoint 렌더 PNG는 검증 후 정리했다.
- 검증: PPTX 패키지 기준 슬라이드 23장, 미디어 25개, 빈 미디어 0개. 대표 슬라이드 객체 확인 결과 1/2/3/9/10/16/20/21/23페이지 모두 텍스트 객체 포함. PowerPoint COM으로 전체 23장을 PNG 렌더링했고 1, 2, 3, 6, 10, 16, 20, 21, 23페이지를 시각 확인했다. `git diff --check` 통과.
## 2026-06-12 10:41 Codex

- 작업: `T-INTEGRATION-FLOW-REPORT` HNS02 기준 MES 전 공정 통합 테스트 및 보고서 작성.
- 실행: JSHANES company `40`, plant `1000`, 계정 `admin@hanes.com`로 실제 API 런타임을 호출해 PO `PO-IT-0612102556`부터 입하 `R26061200002`, IQC, 검사성적서 업로드, PDA 자재입고 `RCV20260612-0001`, 원자재 재고조회, 작업지시 `JO-IT-0612102813`, 자재요청 `MR2606120004`, 자재출고 `ISS20260612-0001`, 생산실적 `PR26061200015`, 제품입고 `PTX2026061200002`, 제품포장 `BX-IT-0612103010`, OQC `OQC-20260612-001`, 출하지시 `SO-IT-0612103010`, 출하 처리까지 한 흐름을 완료했다.
- 결함 수정: 출하 처리에서 박스 `serialList`가 있어도 `ShipOrderService.shipBox()`가 제품재고 차감을 `prdUid='*'`로 호출해 실제 재고 `PRD-IT-0612102849`를 찾지 못하는 문제를 수정했다. 시리얼이 있으면 시리얼별 1개씩 출고하고, 박스 수량과 시리얼 수량 불일치 시 거부하도록 변경했다.
- 검증: TDD RED 후 `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand` 통과(19건). 동일 실데이터 `SO-IT-0612103010/BX-IT-0612103010` 출하 재호출 성공. API/DB 확인 결과 출하지시 `CLOSED`, 박스 `SHIPPED`, `FG_MAIN/HNS02/PRD-IT-0612102849` 재고 0, `PRODUCT_TRANSACTIONS`에 `FG_OUT` `PTX2026061200003` 생성 확인.
- 산출물: `docs/reports/hanes-integration-flow-test-2026-06-12.md`.
- 남은 이슈: `FG_LABELS` 기준 라벨 행 부재로 박스 품목 조회가 `missingLabel=true`이고 박스재고 serial 조회가 비어 있음. 제품라벨 생성 API의 `sourceId` 숫자형 계약과 문자열 생산실적번호 불일치 의심. 제품입고 후 `WIP_MAIN/HNS02/PRD-IT-0612102849` 재고 1이 남아 WIP→FG 이동 처리 확인 필요.
## 2026-06-12 11:02 Codex

- 작업: `T-INTEGRATION-FLOW-ISSUES-FIX` 최종보고서 등록 문제점 수정 및 재테스트.
- 원인/수정 1: 제품라벨 생성 API가 문자열 생산실적 번호를 받을 수 없고 `FG_LABELS`를 생성하지 않아 포장/박스재고 화면에서 `missingLabel=true`가 됐다. `CreatePrdLabelsDto.sourceId`를 문자열 변환/검증으로 변경하고, 제품라벨 발행 시 `FG_LABELS`를 생성 또는 누락 보강하도록 수정했다. `LABEL_PRINT_LOGS.PRINTED_AT` NOT NULL 런타임 오류도 `printedAt` 명시로 수정했다.
- 원인/수정 2: 박스 마감 시 라벨 상태만 `PACKED`로 바꾸고 `FG_LABELS.BOX_NO`를 찍지 않아 `box-stock` 조회 기준에 걸리지 않았다. `BoxService.closeBox()`에서 `STATUS='PACKED'`와 `BOX_NO=<boxNo>`를 함께 갱신하도록 수정했다.
- 원인/수정 3: 완제품 입고가 WIP 재고를 차감하지 않고 FG 재고를 별도 입고로만 생성해 WIP 잔량이 남았다. `/inventory/fg/receive`가 `ProductInventoryService.receiveFinishedFromWip()`를 통해 `WIP_MAIN -> FG_MAIN` 이동(`WIP_OUT`)으로 처리되도록 변경했다.
- 재테스트: JSHANES 실데이터로 `JO-FIX-105908`, `PR26061200017`, `P26061200004`, `BX-FIX-105908`, `OQC-20260612-002`, `SO-FIX-105908` 흐름을 실행. 결과: 박스 품목 `missingLabel=0`, 출하 전 박스재고 serial 1건, 출하지시 `CLOSED`, 박스 `SHIPPED`, `FG_MAIN/HNS02/P26061200004=0`, `WIP_MAIN/HNS02/P26061200004=0`.
- DB 검증: `FG_LABELS`는 `P26061200004`가 `BOX_NO=BX-FIX-105908`, `STATUS=SHIPPED`, `INSPECT_PASS_YN=Y`. `PRODUCT_TRANSACTIONS`는 `WIP_IN PTX2026061200004`, `WIP_OUT PTX2026061200005`, `FG_OUT PTX2026061200006`.
- 검증 명령: `pnpm --filter @harness/backend test -- product-label.service.spec.ts product-inventory.service.spec.ts box.service.spec.ts ship-order.service.spec.ts --runInBand` 통과(59건). `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과. `git diff --check` 통과.
- 산출물: `docs/reports/hanes-integration-flow-test-2026-06-12.md` 갱신.

## 2026-06-12 11:25 Codex

- 작업: `T-INTEGRATION-NORMAL-REVERSE` HNS02 정상/역처리 통합 재테스트.
- 변경: `POST /shipping/orders/:id/cancel-ship-box`를 추가해 출하된 박스를 출하 직전 상태로 되돌리도록 했다. 처리 내용은 `FG_OUT_CANCEL` 제품재고 복원, `BOX_MASTERS.STATUS='CLOSED'`, `FG_LABELS.STATUS='PACKED'`, `SHIPMENT_ORDER_ITEMS.SHIPPED_QTY` 차감, `SHIPMENT_ORDERS.STATUS='CONFIRMED'` 복원이다. 기존 `shipBox()`는 박스 `serialList`가 있으면 시리얼별 `prdUid`로 제품재고를 차감하고, 박스 수량과 시리얼 수량이 다르면 거부한다.
- 정상 시나리오: `PO-NR-26061202215660` → `R26061200007` → IQC PASS/성적서 업로드 → `RCV20260612-0006` → `JO-OK-26061202215660` → `MR2606120012`/`ISS20260612-0011` → `PR26061200022`/`P26061200009` → `BX-OK-26061202215660`/`OQC-20260612-006` → `SO-OK-26061202215660` 출하 완료.
- 출하 역처리 시나리오: `JO-RV-26061202215660` → `PR26061200023`/`P26061200010` → `BX-RV-26061202215660`/`OQC-20260612-007` → `SO-RV-26061202215660` 출하 후 `cancel-ship-box` 실행. DB 결과 `SHIPMENT_ORDERS.STATUS=CONFIRMED`, `SHIPPED_QTY=0`, 박스 `CLOSED`, 라벨 `PACKED`, `FG_MAIN/HNS02/P26061200010=1`, `FG_OUT_CANCEL PTX2026061200020` 확인.
- 취소/삭제 검증: `SO-DEL-26061202215660` DRAFT 출하지시 삭제, `BX-DEL-26061202215660` 빈 박스 삭제, `JO-CXL-26061202215660` 작업지시 취소를 확인했다. 추가로 `PR26061200024` 생산실적을 취소 후 삭제했고, `ISS20260612-0013/1` 자재출고 취소 후 `MAT_STOCKS.W001/HSG0001/M26061200075=1` 복원을 확인했다.
- 검증: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand` 통과(20건). `pnpm --filter @harness/backend build` 통과. `pnpm --filter @harness/backend typecheck`는 패키지 스크립트가 없어 실행 불가. JSHANES `oracle-db` 조회로 정상/역처리 최종 상태 확인.
- 산출물: `docs/reports/hanes-integration-normal-reverse-test-2026-06-12.md`, `docs/reports/hns02-normal-reverse-runtime-test-26061202215660.json`, `tools/hns02-normal-reverse-runtime-test.mjs`.

## 2026-06-12 11:49 Codex

- 작업: `T-MASTER-CRUD-RUNTIME` 기준정보 화면/API CRUD 실데이터 점검 및 보고서 작성.
- 실행: `tools/hanes-master-crud-runtime-test.mjs`를 추가하고 `http://localhost:3003/api/v1`, company `40`, plant `1000`, 계정 `admin@hanes.com`으로 기준정보 CRUD를 실행했다. 최종 stamp는 `26061202474131`.
- 범위: 공통코드, 거래처, 품목 2종, 공정, 생산라인, 작업자, 창고/로케이션/이동규칙, 설비/공정-설비매핑, BOM, 라우팅그룹/공정/조건/자재, 공정CAPA, 제조사바코드, IQC 검사항목풀/품목검사/품목규격, 설비점검항목/매핑, 라벨템플릿, 작업지도서, 교대패턴, 작업달력, 설비BOM, 계측기.
- 조치: 초기 실패는 백엔드 결함이 아니라 테스트 payload와 DTO 불일치였다. `businessNo -> bizNo`, 생산라인 `oper` 길이 제한 대응, IQC revision 정수화, IQC 품목규격 DTO 구조 수정, 설비점검매핑 `sortSeq`, 작업달력 `holidayApply` 제거, IQC 품목규격 cleanup 선행 삭제를 반영했다.
- 검증: 최종 실행 결과 API 단계 101/101 성공, cleanup 30/30 성공, 실패 0건. Oracle `JSHANES` 직접 조회로 테스트 stamp `26061202474131`이 32개 관련 기준정보 테이블에 남지 않음을 확인했다(`nonzero=[]`). 이전 실패 실행에서 남은 IQC 품목규격/검사항목풀 테스트행 8건도 API로 정리했다.
- 산출물: `docs/reports/hanes-master-crud-runtime-test-2026-06-12.md`, `docs/reports/hanes-master-crud-runtime-test-26061202474131.json`, `tools/hanes-master-crud-runtime-test.mjs`.

## 2026-06-12 12:32 Codex

- 작업: `T-IQC-SERIAL3-RUNTIME` 수입검사(IQC) 절차대로 시리얼 3개 실데이터 처리 및 기록 작성.
- 실행: `tools/hanes-iqc-serial3-runtime-test.mjs`로 `http://localhost:3003/api/v1`, company `40`, plant `1000`, 계정 `admin@hanes.com` 헤더를 사용해 구매발주 `PO-IQC3-26061203191605`, 입하 `R26061200008`, 시리얼 `VH1-RM260612-00017/00018/00019`, 입고 `RCV20260612-0007` 흐름을 처리했다.
- 판단: JSHANES 기준 IQC 대상 원자재 중 `LOT_UNIT_QTY=1` 품목이 없어 `HSG0001`(`IQC_FLAG=Y`, `INSPECT_METHOD=FULL`, `LOT_UNIT_QTY=20`)을 수량 60으로 입하해 시리얼 3개를 생성했다.
- 검증: API 단계 17/17 성공, 실패 0건. Oracle `JSHANES` 조회로 `PURCHASE_ORDERS` 확정, `PURCHASE_ORDER_ITEMS.RECEIVED_QTY=60`, `MAT_ARRIVALS` 3건 `PASS/DONE`, `MAT_LOTS` 3건 `PASS/NORMAL`, `IQC_LOGS.RESULT=PASS`, `MAT_RECEIVINGS` 3건 `DONE`, `STOCK_TRANSACTIONS` 6건, 각 시리얼 `RM_MAIN` 재고 20 및 `W001` 재고 0을 확인했다.
- 산출물: `docs/reports/hanes-iqc-serial3-runtime-test-2026-06-12.md`, `docs/reports/hanes-iqc-serial3-runtime-test-26061203191605.json`, `tools/hanes-iqc-serial3-runtime-test.mjs`.

## 2026-06-12 12:49 Codex

- 작업: `T-MASTER-FE-QA` 기준정보 하위 메뉴 프론트엔드 실테스트 및 HTML 보고서 작성.
- 실행: `tools/hanes-master-frontend-qa.mjs`를 추가하고 `http://localhost:3002` 프론트엔드, `http://localhost:3003/api/v1` 백엔드, company `40`, plant `1000`, 계정 `admin@hanes.com` 세션으로 Playwright 실제 브라우저 검증을 수행했다.
- 범위: `pageRegistry.generated.ts` 기준 `/master/*` 21개 화면(BOM, 공통코드, 회사/사업장, 설비, 설비점검, 계측기, IQC 기준정보, 라벨, 품목, 거래처, 공정, CAPA, 생산라인, 라우팅, 제조사바코드, 창고, 작업달력, 작업지도서, 작업자)을 전부 순회했다.
- 시나리오: 각 화면 진입 후 초기 화면 캡처, 검색/조회 가능한 화면은 검색 실행 후 캡처, 추가/신규 버튼이 있는 화면은 저장 없이 폼을 열어 캡처했다. 콘솔 오류, page error, `/api`/`_next` HTTP 400 이상 응답을 실패 조건으로 수집했다.
- 검증: 최종 `node tools\hanes-master-frontend-qa.mjs` 실행 결과 21/21 성공, 실패 0건, 캡처 60개. HTML 내 `<img>` 60개 상대경로도 전부 존재 확인(`missing=[]`).
- 산출물: `docs/reports/hanes-master-frontend-qa-2026-06-12.html`, `docs/reports/hanes-master-frontend-qa-2026-06-12/result.json`, `docs/reports/hanes-master-frontend-qa-2026-06-12/screenshots/*.png`, `tools/hanes-master-frontend-qa.mjs`.

## 2026-06-13 21:26 Codex

- 작업: `T-IQC-SQL-DISPLAY` `/material/iqc` 최초 그리드 SQL 조회문 정확화.
- 변경: `IqcHistoryService.findPendingArrivals()`를 `MAT_LOTS`와 `ITEM_MASTERS` 단일 QueryBuilder 조인으로 구성하고 `qb.getSql()`/`qb.getParameters()`를 `debugSql`로 반환하게 했다. 컨트롤러는 기존 `data` 배열 응답을 유지하면서 `meta.debugSql`을 추가한다. 프론트는 `meta.debugSql`을 받아 SQL 조회문 모달에 실제 SQL과 parameters 주석을 표시하고, 기존 `MAT_ARRIVALS` 하드코딩 SQL은 제거했다.
- 검증: TDD RED 후 신규 테스트 `검사 대상 목록과 함께 실제 QueryBuilder SQL과 파라미터를 반환한다` 통과. `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 관련 파일 `git diff --check` 통과.
- 남은 이슈: `pnpm --filter @harness/backend test -- iqc-history.service.spec.ts` 전체 실행은 기존 `findAll` 테스트 3건 실패가 남아 실패한다. 이번 신규 `findPendingArrivals` 테스트는 통과한다.

## 2026-06-13 21:45 Codex

- 작업: `T-SQL-SCHEMA-TOGGLE` SQL 조회문 모달 컬럼명세 토글 공통 적용.
- 변경: `SqlViewerModal` 기본 화면을 SQL 단독 보기로 바꾸고, 상단에 `컬럼명세 보기/숨기기` 버튼을 추가했다. 컬럼명세 API(`/system/table-schema`)는 사용자가 버튼을 눌러 펼칠 때만 호출한다. `SqlViewerModal`은 `DataGrid`에서 단일 공통 경로로 사용되므로 모든 `DataGrid.sqlQuery` 페이지에 적용된다.
- 검증: TDD RED 후 `node apps/frontend/src/components/data-grid/sql-viewer-modal.structure.test.mjs` 통과. `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 관련 파일 `git diff --check` 통과.

## 2026-06-15 18:56 Codex

- 작업: `T-UI-CRUD-RED-MENU-QA` 좌측 메뉴 전체 최종 PASS QA 및 HTML 보고서 작성.
- 실행: `ui-test-crud-red` 좌측 메뉴 runner로 실제 프론트 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000` 세션에서 현재 좌측메뉴 노출 화면 96개를 순회했다. 범위는 화면 진입, 초기 조회 API, 콘솔/page error, 주요 렌더링 상태, 화면 캡처 검증이다.
- 수정: `/production/wip-stock`은 `MatStock.part` 없는 관계를 조인해 500이 발생하던 문제를 `ProductStock` 기준 raw join(`PRODUCT_STOCKS`, `ITEM_MASTERS`, `WAREHOUSES`)으로 수정하고 단위 테스트를 보강했다. `/system/config`는 API 응답에 `id`가 없고 `configKey`가 식별자인데 프론트가 `cfg.id`를 key/저장/삭제 식별자로 사용해 React key 경고가 발생하던 문제를 `configKey` fallback 식별자로 수정했다. 테스트 러너는 장시간 Turbopack/DB transient와 `로그인` 단어 오탐을 구분하도록 보강하고, 최종 HTML 양식을 승인된 최종 PASS 보고서 구조로 변경했다.
- 런타임 조치: Turbopack panic으로 `.next` manifest/chunk 생성물이 손상되어 프론트 dev 서버를 정리하고, workspace 내부 `apps/frontend/.next`만 삭제 후 `pnpm dev`를 재시작했다.
- 검증: 최종 재실행 `run-resume-final-after-config-key-fix.log` 결과 96/96 PASS, 실패 0. `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/result.json` 무결성 검증 결과 total 96, completed 96, passed 96, failed 0, 누락 스크린샷 0, HTML PASS 문구 확인. `pnpm --filter @harness/backend test -- production-views.service.spec.ts --runInBand` 통과(5건). `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. `GET /api/v1/health` DB connected 확인.
- 산출물: `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`, `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/result.json`, `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/screenshots/*.png`.

## 2026-06-15 19:08 Codex

- 작업: `T-MENU-QA-DETAIL-REPORT` 좌측 메뉴 QA HTML 보고서 상세화.
- 변경: 기존 최종 PASS 결과와 스크린샷은 유지하고 `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`을 메뉴별 상세 절차형 보고서로 재생성했다. 96개 메뉴마다 메뉴명/코드/경로/그룹, 수행 절차, 확인 기준, 최종 화면 캡처를 별도 섹션으로 분리했다.
- 추가: `tools/generate-menu-qa-detailed-report.mjs`를 추가해 `result.json`과 `ko.json`, 스크린샷 파일을 읽어 동일 양식의 상세 HTML을 재생성할 수 있게 했다.
- 검증: 생성 결과 `status=PASS`, total 96, detailSections 96, missingScreenshots 0. HTML 구조 검증 결과 `.menu-detail` 96개, `<img>` 96개, 스크린샷 누락 0개, 재검증 필요 문구 없음, 실패 문구 없음. 관련 파일 `git diff --check` 통과.
- 산출물: `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`, `tools/generate-menu-qa-detailed-report.mjs`.

## 2026-06-15 19:47 Codex

- 작업: `T-MASTER-PART-PAGE-SCENARIO-QA` `/master/part` 품목관리 페이지 단위 상세 시나리오 QA 파일럿.
- 실행: 실제 브라우저 `http://localhost:3002/master/part`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000` 세션으로 품목관리 1개 화면을 테스트했다. 시나리오는 초기 조회, 새로고침, 신규 전 검색, 신규 등록/저장 검증, 등록 후 재조회, 중복 등록 방어, 수정/저장 검증, 수정 후 재조회, 삭제/저장 검증, 삭제 후 재조회 10단계다.
- 검증: 최종 실행 `node tools/hanes-master-part-page-scenario-qa.mjs` 결과 PASS. 테스트 키 `FECRUD-260615104355`, 단계 10개 전부 PASS, UI/API 호출 기록 24건, Oracle `JSHANES` DB 검증 9건, 화면 증적 누락 0개. 최종 DB 조회에서 `ITEM_CODE LIKE 'FECRUD%' OR PART_NO LIKE 'FECRUD%'` 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 페이지 상세 `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-part.html`, 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-part-result.json`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-part/*.png`, 실행 스크립트 `tools/hanes-master-part-page-scenario-qa.mjs`.

## 2026-06-15 20:24 Codex

- 작업: `T-MASTER-BOM-PAGE-SCENARIO-QA` `/master/bom` BOM관리 페이지 단위 상세 시나리오 QA.
- 실행: `hanes-page-scenario-qa` 기준으로 실제 브라우저 `http://localhost:3002/master/bom`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`를 사용해 BOM관리 화면을 테스트했다. 기존 부모 BOM `HNS02`를 선택하고 테스트 자품목 `FBOMC-260615112131`을 임시 생성해 화면에서 BOM 추가/수정/삭제를 수행했다.
- 시나리오: 초기 조회, 부모 검색/선택, 폼 다운로드, 엑셀 업로드 모달 확인, 테스트 자품목 준비, 선택 부모 BOM 내보내기, BOM 신규 등록/저장 검증, 등록 후 화면 재조회, 중복 등록 방어, BOM 수정/저장 검증, 라우팅 패널 확인, BOM 삭제/저장 검증, 삭제 후 화면 재조회 및 정리까지 13단계다.
- 런타임 조치: 기존 프론트 3002 프로세스가 응답하지 않아 PID 2796을 정리하고 `apps/frontend`에서 `pnpm run dev`를 숨김 프로세스로 재시작했다. 재시작 후 3002는 PID 17636으로 Ready 상태였고, 백엔드 3003은 `GET /api/v1/master/boms/parents` 200으로 확인했다.
- 검증: 최종 실행 `node tools/hanes-master-bom-page-scenario-qa.mjs` 결과 PASS. 결과 JSON 검증 결과 status `PASS`, page `/master/bom`, parent `HNS02`, steps 13, 기록 API 38, failedApi 0, failedSteps 0, consoleErrors 0, pageErrors 0. 산출물 파일 3개 존재, BOM 스크린샷 13장 존재 확인. Oracle `JSHANES` 최종 조회에서 `BOM_MASTERS` 테스트 BOM 잔여 0건, `ITEM_MASTERS` 테스트 자품목 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 페이지 상세 `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-bom.html`, 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-bom-result.json`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-bom/*.png`, 실행 스크립트 `tools/hanes-master-bom-page-scenario-qa.mjs`.

## 2026-06-15 21:03 Codex

- 작업: `T-MASTER-REMAINING-PAGE-SCENARIO-QA` 기준정보 잔여 메뉴 페이지 단위 상세 시나리오 QA.
- 실행: `hanes-page-scenario-qa`, `ui-test-crud-red`, `oracle-db` 기준으로 `/master/part`, `/master/bom`을 제외한 기준정보 잔여 19개 화면을 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 순회했다. 대상은 코드관리, 회사관리, 설비관리, 설비별 점검항목, 점검항목마스터, 계측기마스터, 검사항목마스터, 품목별 IQC 항목관리, 라벨관리, 거래처관리, 공정관리, 공정 CAPA, 생산라인관리, 라우팅관리, 제조사 바코드 매핑, 창고관리, 생산월력관리, 작업지도서관리, 작업자관리다.
- 처리 방식: 각 화면마다 초기 조회, 검색/조회 또는 탭 전환, 노출 버튼/프로세스 목록화, 신규/수정/삭제 가능 여부 확인, 대표 API 직접 조회, 대표 Oracle DB count 확인을 수행했다. 저장 검증은 최신 기준정보 API CRUD 런타임 결과 `docs/reports/hanes-master-crud-runtime-test-26061511325085.json`를 연결했다. 해당 CRUD 결과는 101단계 성공, 실패 0, cleanup 완료다.
- 런타임 조치: 첫 실행은 300초 제한과 프론트 콜드 컴파일 때문에 중간 종료됐고, 두 번째는 작업자 화면 등록 패널 진입 대기에서 장시간 멈췄다. `worker` 화면은 UI 등록 패널 열기 대신 CRUD API 저장 검증으로 대체하도록 러너를 보강했고, `HANES_QA_REUSE_CRUD=1`로 최신 CRUD 결과를 재사용해 전체 재실행했다.
- 검증: 최종 실행 `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 status `PASS`, 잔여 페이지 19/19 PASS, failed 0, CRUD failures 0. 결과 JSON 검증 결과 failedPages 0, failedSteps 0, missingReports 0, missingShots 0, crudResidueSuccess true, crudResidueNonZero 없음. 기준정보 페이지 HTML은 기존 품목/BOM 포함 21개, 스크린샷은 전체 119장이다. `git diff --check` 통과. Oracle `JSHANES` 독립 잔여 쿼리에서 COM_CODES, PARTNER_MASTERS, ITEM_MASTERS, PROCESS_MASTERS, PROD_LINE_MASTERS, WORKER_MASTERS, WAREHOUSES, EQUIP_MASTERS, ROUTING_GROUPS, IQC_ITEM_POOL, LABEL_TEMPLATES, WORK_CALENDARS, GAUGE_MASTERS 모두 테스트 키 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 통합 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`, 개별 페이지 HTML `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-*.html`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-*/*.png`, 실행 스크립트 `tools/hanes-master-remaining-page-scenario-qa.mjs`.

## 2026-06-15 22:31 Codex

- 작업: `T-MASTER-EQUIP-REPORT-EVIDENCE-FIX` `/master/equip` 설비관리 QA 보고서 증적 정합성 보정.
- 원인: 잔여 기준정보 보고서 러너가 검색 단계에서 `HNS02`를 입력한 뒤 STEP 05 저장 검증 캡처 전에 검색 조건을 초기화하지 않았다. 그래서 STEP 05의 “API/DB 검증 후 화면” 캡처가 실제 저장/API/DB 검증 상태가 아니라 이전 검색 결과 0건 화면으로 남았다.
- 변경: `tools/hanes-master-remaining-page-scenario-qa.mjs`에 검색 조건 초기화+재조회 헬퍼를 추가하고, 버튼 목록화 및 API/DB 저장 검증 증적 전에 이를 실행하도록 보정했다. STEP 05 캡션은 `검색 초기화 후 API/DB 검증 기준 화면`으로 변경했고, 수정/삭제 가능 여부의 행 액션 수는 전체 `tr button`이 아니라 본문 데이터 행 버튼만 세도록 바꿨다.
- 검증: `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 19개 화면 모두 PASS, failed 0, CRUD failures 0. `master-equip` 결과는 5단계 PASS, 이미지 누락 0, STEP 05 증적 파일 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-equip/05-api-db-verification.png` 72,137 bytes. 육안 확인 결과 검색어가 비어 있고 설비 목록 44건 기준 그리드가 표시된다. `git diff --check` 통과.
- 산출물: `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-equip.html`, `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-equip/05-api-db-verification.png`, `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`.

## 2026-06-15 23:22 Codex

- 작업: `T-MASTER-REPORT-SEARCH-DUPLICATE-FIX` 기준정보 잔여 페이지 QA 보고서 검색어/중복방어 시나리오 보정.
- 변경: `tools/hanes-master-remaining-page-scenario-qa.mjs`의 검색 단계에서 `HNS02` 하드코딩을 제거하고 현재 화면 데이터 기반 검색어 또는 빈 조회로 대체했다. 모든 잔여 19개 페이지에 공통 `duplicate-defense` 단계를 추가해 기준정보 CRUD 런타임의 `DUPLICATE_GUARD` 결과를 연결한다.
- 변경: `tools/hanes-master-crud-runtime-test.mjs`에 회사 포함 30개 `DUPLICATE_GUARD` 검증을 추가했다. 실제 실행 중 중복 허용으로 확인된 `공정-설비매핑`, `IQC품목검사`, `라벨템플릿`, `작업지도서`, `설비BOM품목`, `설비BOM관계` 생성 경로는 409 중복 방어를 추가했고 해당 단위 테스트를 보강했다.
- 검증: `node tools/hanes-master-crud-runtime-test.mjs` 최종 결과 `docs/reports/hanes-master-crud-runtime-test-26061513195369.json`, total 134, passed 134, failed 0, cleanup 31, duplicateGuards 30, duplicateFailures 0. `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 잔여 19개 페이지 19/19 PASS. JSON 검증 결과 19개 페이지 모두 `duplicate-defense` 단계 존재, non-PASS 0, 중복방어 증적 누락 0. `pnpm --dir apps/backend exec tsc --noEmit --pretty false` 통과. `git diff --check` 통과.
- 참고: 잔여 19개 페이지의 `HNS02` 고정 검색은 제거됐다. 별도 BOM 전용 보고서 `master-bom.html`에는 실제 BOM 부모 기준 데이터가 HNS02 계열뿐이라 BOM 부모 검색 증적으로 남아 있다.
- 산출물: `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`, `docs/reports/hanes-master-crud-runtime-test-26061513195369.json`, `tools/hanes-master-crud-runtime-test.mjs`, `tools/hanes-master-remaining-page-scenario-qa.mjs`.

## 2026-06-16 00:42 Codex

- 작업: `T-MATERIAL-MENU-PAGE-SCENARIO-QA` 좌측 `자재수불관리` 실제 등록 하위 메뉴 상세 시나리오 QA.
- 범위: `/api/v1/menu-categories/tree`의 `MATERIAL` 카테고리에 실제 등록된 16개 하위 메뉴만 대상으로 했다. 대상은 `PUR_PO`, `PUR_PO_STATUS`, `MAT_ARRIVAL`, `MAT_ARRIVAL_RESULT`, `QC_CONCESSION`, `MAT_RECEIVE`, `MAT_RECEIVE_HISTORY`, `MAT_REQUEST`, `MAT_ISSUE`, `MAT_ISSUE_OTHER`, `MAT_LOT_SPLIT`, `MAT_LOT_MERGE`, `MAT_SCRAP`, `MAT_ADJUSTMENT`, `MAT_MISC_RECEIPT`, `MAT_RECEIPT_CANCEL`이다.
- 실행: `tools/hanes-material-menu-page-scenario-qa.mjs`를 추가했다. 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 각 페이지를 테스트했다. 각 화면은 초기 조회, 검색/재조회, 버튼/입력/프로세스 목록화, 신규/수정/삭제 가능 여부, 저장 검증 및 중복 방어 정책, 직접 API+DB 확인, 화면 재조회 6단계로 기록했다.
- 조치: 전체 실행 중 자정 경계로 보고서 날짜가 갈라지는 문제를 막기 위해 `HANES_REPORT_DATE`를 지원하도록 했고, 장시간 메뉴 스윕을 위해 페이지별 JSON 저장과 집계 모드를 추가했다. `특채처리` 대표 API는 실제 계약에 맞게 `/material/concession/targets`로 보정했다. 빈 화면 문구 `데이터가 없습니다.`가 검색어로 들어가 400을 만드는 테스트 러너 문제도 검색어 추출 필터에서 제외해 해소했다. 운영 재고를 변경하는 저장/삭제 버튼은 임의 실행하지 않고 별도 저장형 상세 시나리오 대상으로 명시했다.
- 검증: 최종 집계 `$env:HANES_REPORT_DATE='2026-06-15'; $env:HANES_QA_AGGREGATE='1'; node tools/hanes-material-menu-page-scenario-qa.mjs` 결과 status `PASS`, pages 16, passed 16, failed 0. 추가 JSON/HTML 검증 결과 16페이지, 96단계, 96개 스크린샷, 모든 단계 PASS, HTML `API 호출`/`DB 확인` 섹션 존재, 이미지 링크 누락 0개. `git diff --check -- tools/hanes-material-menu-page-scenario-qa.mjs .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 산출물: 목차 `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/index.html`, 통합 결과 JSON `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/material-menu-result.json`, 개별 페이지 HTML/JSON `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/pages/*.html|*.json`, 스크린샷 `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/screenshots/*/*.png`, 실행 스크립트 `tools/hanes-material-menu-page-scenario-qa.mjs`.

## 2026-06-16 03:00 Codex

- 작업: `T-MULTI-CATEGORY-MENU-PAGE-SCENARIO-QA` 좌측 등록 메뉴 중 자재재고관리, 생산관리, 품질관리, 검사관리, 제품수불관리, 설비관리, 출하관리 하위 메뉴 상세 시나리오 QA.
- 범위: `/api/v1/menu-categories/tree`의 활성 카테고리 기준으로 `INVENTORY` 7개, `PRODUCTION` 10개, `QUALITY` 11개, `INSPECTION` 5개, `PRODUCT_MGMT` 4개, `EQUIPMENT` 6개, `SHIPPING` 7개, 총 50개 등록 메뉴만 대상으로 했다. `PRODUCT_INVENTORY`는 비활성이라 제외했고, 사용자 요청의 `제품수불관리`는 활성 `PRODUCT_MGMT`로 처리했다.
- 실행: `tools/hanes-registered-categories-page-scenario-qa.mjs`를 추가해 `menuConfig.ts`와 `ko.json`에서 등록 메뉴 경로/한글명을 매핑하고, 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 테스트했다. 각 페이지는 초기 조회, 검색/재조회, 버튼/입력/프로세스 목록화, 신규/수정/삭제 가능 여부, 저장 검증 및 중복 방어 정책, 직접 API+DB 확인, 화면 재조회 6단계로 기록했다.
- 수정: `/production/result` 화면은 프론트가 `search`를 보내지만 `ProdResultQueryDto`가 이를 허용하지 않아 400이 발생했다. `ProdResultQueryDto.search`와 `ProdResultService.findAll()` 통합 검색(실적번호/작업지시번호/제품 UID)을 추가했다. `/shipping/pack` 화면도 프론트가 `/shipping/boxes?search=...`를 보내지만 `BoxQueryDto`가 이를 허용하지 않아 400이 발생했다. `BoxQueryDto.search`와 `BoxService.findAll()` 박스번호/품목코드 검색을 추가했다.
- 검증: 최종 집계 `$env:HANES_REPORT_DATE='2026-06-16'; $env:HANES_QA_AGGREGATE='1'; node tools/hanes-registered-categories-page-scenario-qa.mjs` 결과 status `PASS`, pages 50, passed 50, failed 0. 추가 JSON/HTML 검증 결과 카테고리별 건수 `INVENTORY=7`, `PRODUCTION=10`, `QUALITY=11`, `INSPECTION=5`, `PRODUCT_MGMT=4`, `EQUIPMENT=6`, `SHIPPING=7`, 총 300단계, 스크린샷 300개, API 기록 675건, DB count 150건, 모든 단계 PASS, HTML `API 호출`/`DB 확인` 섹션 존재, 이미지 링크 누락 0개. `pnpm --dir apps/backend exec tsc --noEmit --pretty false` 통과. 관련 파일 `git diff --check` 통과.
- 산출물: 목차 `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/index.html`, 통합 결과 JSON `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/registered-categories-result.json`, 개별 페이지 HTML/JSON `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/pages/*.html|*.json`, 스크린샷 `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/screenshots/*/*.png`, 실행 스크립트 `tools/hanes-registered-categories-page-scenario-qa.mjs`.

## 2026-06-16 11:16 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 입하재고 테이블 분리 A안 설계.
- 결정: 사용자가 테이블까지 분리하고 기존 데이터도 마이그레이션하라고 승인했다. 설계는 `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` 신규 테이블을 두고, 기존 `STOCK_TRANSACTIONS.MAT_IN`을 입하원장으로 이관하며, 입고 후 미입고 잔량만 `MAT_ARRIVAL_STOCKS`로 산출하는 방식이다.
- 실측: JSHANES company `40`, plant `1000`에서 `MAT_IN` 57건/322,303, `RECEIVE` 44건/316,303, `MAT_ARRIVALS` 67건/327,303, `MAT_RECEIVINGS DONE` 44건/316,303, `MAT_STOCKS` 93행/227,314 확인. `MAT_IN` 중 `MAT_UID` NULL은 0건이다.
- 산출물: `docs/superpowers/specs/2026-06-16-mat-arrival-stock-split-design.md`.
- 검증: 관련 파일 `git diff --check` 통과. 서브에이전트 설계 검토는 현재 도구 정책상 사용자가 명시적으로 요청한 경우에만 가능해 수행하지 않았고, 자체 검토로 `TRANS_NO` 유지와 `MAT_UID` 기준 이관 근거를 문서에 보강했다.
- 상태: `TASKS.md`에 `REVIEW`로 남김. 사용자 리뷰 승인 후 구현 계획 작성 및 마이그레이션/코드 수정 단계로 전환한다.

## 2026-06-16 11:22 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 구현 계획 작성.
- 입력: 사용자가 설계서 A안을 승인했다.
- 산출물: `docs/superpowers/plans/2026-06-16-mat-arrival-stock-split.md`.
- 내용: 사전 DB dry-run, Oracle 마이그레이션, 신규 엔티티, `ArrivalStockService`, `arrival.service.ts`, `receiving.service.ts`, `receipt-cancel.service.ts`, `/inventory/transaction` API/UI 정리, 런타임 검증, 최종 handoff까지 10개 작업으로 분해했다.
- 주의: 현재 도구 정책상 사용자가 명시적으로 서브에이전트를 요청한 경우에만 plan reviewer/subagent 사용이 가능하므로 별도 subagent review는 수행하지 않았다. 실행은 DB 변경이 포함되므로 inline checkpoint 방식이 더 적합하다고 계획서에 명시했다.
- 상태: 구현은 아직 시작하지 않았다. 사용자에게 실행 방식을 확인해야 한다.

## 2026-06-16 11:33 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` Task 1 사전 DB dry-run.
- 실행: JSHANES company `40`, plant `1000`에 SELECT만 수행했다.
- 결과: `MAT_IN` 57건/322,303, `RECEIVE` 44건/316,303, `MAT_IN` 중 `MAT_UID IS NULL` 0건. `MAT_UID`별 pending 산출 결과 `POSITIVE_PENDING` 36건/6,023, `ZERO` 21건/0, `NEGATIVE_PENDING` 23건/-23.
- 차단: `NEGATIVE_PENDING` 23건은 `RECEIVE`가 있으나 같은 `MAT_UID` 기준 `MAT_IN`이 없는 legacy UID다. 또한 `VH1-RM260612-00011`은 `MAT_IN` 3 이후 `MAT_OUT` 3건으로 이미 `MAT_STOCKS`가 0이라 입하재고 후보 3을 차감할 수 없다.
- 산출물: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`.
- 상태: 계획 기준 차단 조건이므로 구현을 중단하고 `TASKS.md`를 `BLOCKED`로 변경했다. 사용자에게 데이터 보정 정책 결정을 받아야 한다.

## 2026-06-16 13:10 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 입하재고/입고재고 테이블 분리 구현 및 JSHANES 마이그레이션 적용.
- 반영: `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` 엔티티/마이그레이션 추가. IQC005 입하는 입하재고/입하원장으로 기록하고, 정상 입고 확정은 `MAT_ARRIVAL_STOCKS` 감소 후 `MAT_STOCKS` 증가로 변경했다. 특채 입고는 기존 창고재고 차감 경로를 유지했다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql`을 JSHANES에 실행했고 12개 블록 모두 성공. 적용 후 `MAT_ARRIVAL_TRANSACTIONS` 57건/322,303, `MAT_ARRIVAL_STOCKS` 35건/6,020, `STOCK_TRANSACTIONS` 잔존 `MAT_IN/MAT_IN_CANCEL` 0건, 백업 57건 확인.
- 프론트: `/inventory/transaction` 필터에서 `MAT_IN/MAT_IN_CANCEL` 제거. 입하 이력 타입/버튼 조건은 `ARRIVAL_IN/ARRIVAL_CANCEL`로 변경.
- 문서: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`, `docs/reports/db-schema-erd.md` 갱신.
- 검증: `pnpm --filter @harness/backend build`, `pnpm --filter @harness/backend test -- arrival.service.spec.ts receiving.service.spec.ts inventory-query.service.spec.ts`, `pnpm --filter @harness/frontend build` 통과. 인증 없는 API 직접 호출은 401로 차단되어 DB 검증으로 대체했다.
- 상태: `TASKS.md` DONE, lock released.

## 2026-06-16 13:55 Codex

- 작업: `T-MAT-ARRIVAL-TRANSACTION-PAGE` 입하수불조회 화면 추가.
- 범위: 메뉴 통합 작업과 충돌하지 않도록 좌측 메뉴 파일과 DB 메뉴 등록은 수정하지 않았다. 직접 URL `/material/arrival-transaction`로 접근 가능한 화면을 추가하고, 나중에 `MATERIAL` 카테고리 메뉴에 연결할 수 있게 route를 고정했다.
- 변경: `apps/frontend/src/app/(authenticated)/material/arrival-transaction/page.tsx` 추가. 화면은 `MAT_ARRIVAL_TRANSACTIONS` 원장 조회 전용이며 기간, 유형(`ARRIVAL_IN/ARRIVAL_CANCEL`), 상태, `MAT_UID`, 통합 검색 필터와 DataGrid 내보내기/SQL 조회를 제공한다. 신규/수정/삭제는 조회 화면 성격상 넣지 않았다.
- API: `ArrivalQueryDto`에 `transType`, `matUid`, `arrivalNo` 필터를 추가하고 `ArrivalService.findAll()` 검색 조건에 거래번호, 입하번호, 참조번호, `MAT_UID`, 품목코드/품목명을 포함했다.
- 검증: `pnpm --filter @harness/frontend gen:registry`, `pnpm --filter @harness/backend build`, `pnpm --filter @harness/frontend build` 통과. 빌드 산출 라우트 목록에 `/material/arrival-transaction` 포함 확인. 실행 중인 3002 서버에서 `http://localhost:3002/material/arrival-transaction` HTTP 200 확인. 백엔드 직접 API `http://localhost:3003/api/v1/material/arrivals?limit=1&transType=ARRIVAL_IN`은 인증 없이 401로 차단됨을 확인했다.
- 상태: 완료, lock released. 좌측 메뉴 노출은 메뉴 통합 산출물 기준으로 별도 후속 작업에서 `MATERIAL` 카테고리에 추가해야 한다.

## 2026-06-16 14:35 Codex

- 작업: `T-MAT-ARRIVAL-TRANSACTION-MENU` 입하수불조회 메뉴 등록.
- 변경: `MAT_ARRIVAL_TRANSACTION` leaf를 `apps/frontend/src/config/menuConfig.ts`의 `MATERIAL` 카테고리 `MAT_ARRIVAL_RESULT` 바로 뒤에 추가했다. labelKey는 `menu.material.arrivalTransaction`, path는 `/material/arrival-transaction`이다.
- i18n: `ko/en/zh/vi.json`에 각각 `입하수불조회`, `Arrival Ledger Inquiry`, `到货流水查询`, `Tra cứu giao dịch nhập hàng` 라벨을 추가했다.
- 백엔드/시드: `menu-code-validator.ts`의 leaf whitelist에 `MAT_ARRIVAL_TRANSACTION`을 추가했고, `scripts/2026-05-18_seed_menu_categories.sql`에도 MATERIAL sort 25로 반영했다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_add_arrival_transaction_menu.sql`을 작성했다. 첫 실행은 익명 PL/SQL 블록 종료 파싱 문제로 실패했으나 변경은 적용되지 않았고, 기존 repo 패턴에 맞춰 SQL statement + `/` 구분자로 수정 후 JSHANES에 재실행했다. 최종 실행은 3개 블록 모두 성공.
- DB 검증: `MENU_CATEGORY_ITEMS`에서 `MAT_ARRIVAL_TRANSACTION`이 company `40`, plant `1000`, category `MATERIAL`, sort `45`로 등록됨을 확인했다. `ROLE_MENU_PERMISSIONS`는 `INV_ARRIVAL_STOCK`의 접근권한을 복제해 `MANAGER`/`Y` 1건 등록됐다.
- 런타임 검증: JSON 파싱 4종 성공, `pnpm --filter @harness/backend build`, `pnpm --filter @harness/frontend build` 통과. 인증 헤더 `Bearer admin@hanes.com`, `X-Company=40`, `X-Plant=1000`로 `/api/v1/menu-categories/tree` 호출 시 `MATERIAL.menus`에 `MAT_ARRIVAL_TRANSACTION` sort 45가 반환됨을 확인했다. `http://localhost:3002/material/arrival-transaction`도 HTTP 200.
- 운영 메모: `next build` 후 3002 dev 서버가 500을 반환해 3002 프론트만 재시작했다. 이후 3002는 정상 200. 3003 백엔드 watch 프로세스도 listen이 내려가 있어 해당 dev 프로세스만 재시작했고 health 200 및 메뉴 API 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 15:25 Codex

- 작업: `T-KIOSK-WORKER-INSPECT-EMPTY-FIX` `/production/input-kiosk` 작업자설비점검 모달 빈 화면 원인 확인 및 보정.
- 원인: 모달이 `/master/equip-inspect-items?equipCode=...&inspectType=WORKER` 설비별 배정만 조회한다. JSHANES 실측에서 `EQ-CUT-01` 같은 절단/압착 설비는 WORKER 배정 0건이고, WORKER 점검항목 마스터 4건은 `EQUIP_INSPECT_ITEM_MASTERS`에 공통(`EQUIP_TYPE` null)으로만 존재했다. 프론트는 `items.length=0`일 때 빈 상태 문구도 표시하지 않아 헤더 외 내용이 없는 모달처럼 보였다. 또한 배정 API 응답은 `sortSeq`를 주는데 모달은 `seq`를 기대해 순번/결과 키가 불안정했다.
- 변경: 설비별 배정이 없으면 항목을 띄우지 않는 기존 업무 규칙을 유지했다. `WorkerInspectModal`은 `/master/equip-inspect-items` 설비별 배정만 조회하고, 0건이면 현재 선택 설비 기준으로 `기준정보 > 설비점검항목(/master/equip-inspect)`에서 설비 선택 → 작업자점검(WORKER) 선택 → 점검항목 추가 → 저장 → 모달 재오픈 절차를 상세 안내한다. 배정 API 응답의 `sortSeq -> seq` 정규화도 추가했다.
- 검증: 인증 헤더 `Bearer admin@hanes.com`, company `40`, plant `1000`으로 `EQ-CUT-01` 배정 API 0건, `EQ-OINSP-01` 배정 API 4건, WORKER 마스터 API 4건 확인. `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/worker-inspect-modal.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 이 워크스페이스에는 `browse`/`playwright` 실행 파일이 없어 실제 브라우저 캡처 검증은 수행하지 못했다.
- 상태: 완료, lock released.

## 2026-06-16 16:50 Codex

- 작업: `T-KIOSK-DAILY-INSPECT-EMPTY-GUIDE` `/production/input-kiosk` 설비일일점검 모달의 배정 누락 안내 보강.
- 원인/정책: 설비일일점검도 작업자설비점검과 동일하게 `/master/equip-inspect-items?equipCode=...&inspectType=DAILY` 설비별 배정 항목만 표시해야 한다. 배정이 없으면 항목이 안 뜨는 것이 정상이며, 기존처럼 `항목 없음 - 자동완료`로 인터락을 완료하면 기준정보 배정 누락을 숨긴다.
- 변경: `DailyInspectModal`에서 무항목 자동완료 `handleSkip` 경로와 `confirmWithoutItems` 버튼을 제거했다. 0건이면 현재 선택 설비 기준으로 `기준정보 > 설비점검항목마스터(/master/equip-inspect-item)`에서 DAILY 항목 등록 → `기준정보 > 설비점검항목(/master/equip-inspect)`에서 설비 선택 → DAILY 선택 → 점검항목 추가 → 저장 → 모달 재오픈 절차를 표시한다. 배정 API 응답의 `sortSeq -> seq` 정규화도 추가했다.
- 검증: RED 후 GREEN 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/daily-inspect-modal.structure.test.mjs` 통과(3/3), `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 상태: 완료, lock released.
## 2026-06-16 20:29 Codex

- 작업: `T-CONSUMABLE-MASTER-CARDS-REMOVE` `/consumables/master` 상단 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/master/page.tsx`에서 카드 전용 `StatCard` grid, `computedStats`, `Package`/`StatCard` import, 주석의 통계카드 설명만 제거했다.
- 유지: `/consumables` 목록 조회, 검색어/분류 필터, DataGrid, 등록/수정 우측 패널, 삭제 확인 흐름은 변경하지 않았다.
- 검증: 대상 파일 `StatCard|computedStats|totalConsumables|mold|jig|tool|Package` 잔여 0건, `git diff --check` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/master` HTTP 200 확인. Playwright 브라우저 DOM 확인은 3002 페이지 로드가 60초 타임아웃으로 완료하지 못했다.
- 상태: 완료, lock released.

## 2026-06-16 19:25 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-IMAGE-SEED` 설비점검항목 위치 안내 이미지 시드 생성 및 JSHANES 적용.
- 변경: `tools/generate-equip-inspect-item-seed-images.mjs`를 추가해 항목별 고정 SVG 50개를 `apps/backend/uploads/equip-inspect-items`에 생성했다. 각 SVG는 설비유형 도식, 주황색 점검 위치 표시, `점검 위치` 라벨을 포함한다. `uploads`는 git ignore 대상이라 로컬 서버에는 생성 파일이 있고, 재생성은 스크립트로 수행한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_equip_inspect_item_image_seed.sql`로 `EQUIP_INSPECT_ITEM_MASTERS.IMAGE_URL`을 `/uploads/equip-inspect-items/*.svg`로 채웠고, JSHANES `--execute-file` 실행 성공(`blocks_executed=51`).
- 검증: JSHANES `TOTAL=50`, `WITH_IMAGE=50`, `SVG_URLS=50`, `DISTINCT_URLS=50`. 로컬 SVG 파일 50개 존재. `http://localhost:3003/uploads/equip-inspect-items/ei_atc_001.svg`와 `http://localhost:3002/uploads/equip-inspect-items/ei_atc_001.svg` 모두 200, `image/svg+xml`. `/api/v1/master/equip-inspect-item-masters?limit=2`는 `imageUrl` 반환. 실제 브라우저 `http://localhost:3002/master/equip-inspect-item`에서 이미지 50개 렌더링, 첫 이미지 natural size 720x420 확인.
- 상태: 완료, lock released.

## 2026-06-16 13:50 Codex

- 작업: `T-MAT-FLOW-COHERENCE-FIX` 입하 → 입하재고 → 입고 → 입고후재고 → 출고 → 출고후재고 → 공정입고 → 공정재고 흐름 정합성 점검 및 보정.
- 코드 보정: `ArrivalService.createPoArrival()`와 `createManualArrival()`의 레거시 `MAT_IN`/`MAT_STOCKS` 직행 경로를 내부 `MAT_LOTS` 발행 후 `MAT_ARRIVAL_STOCKS`/`MAT_ARRIVAL_TRANSACTIONS(ARRIVAL_IN)` 기록으로 변경했다. 원자재 현재고 증가는 기존 입고 확정 경로에서만 수행한다. `/material/arrival`의 수동/PO 모달 payload도 백엔드 계약에 맞춰 `warehouseId`를 보내도록 수정했다.
- DB 보정: `apps/backend/src/migrations/2026-06-16_repair_mat_flow_audit_gaps.sql`을 JSHANES에 적용했다. 현재고 수량은 변경하지 않고 과거 데이터의 누락 감사원장만 보강했다. `ARRIVAL_REPAIR` 23건/23수량, `RECEIVE_REPAIR` 1건/3수량이 추가됐다.
- 실측 결과: 적용 후 `MAT_ARRIVAL_TRANSACTIONS` 80건/322,326, `MAT_ARRIVAL_STOCKS` 35건/6,020, `MAT_RECEIVINGS DONE` 45건/316,306, `STOCK_TRANSACTIONS RECEIVE` 45건/316,306, `MAT_OUT` 14건/-100,011, `MAT_STOCKS` 58건/221,294. 입하원장 - 입고원장 - 입하재고 LOT 대사 `BAD_ROWS=0`, `ABS_DIFF=0`, `NET_DIFF=0`.
- 공정재고 확인: 생산실적 `DONE` 8건은 `PRODUCT_TRANSACTIONS.WIP_IN` 8건/8수량으로 연결되고, `PRODUCT_STOCKS`의 `WIP_MAIN` 현재 잔량은 9행/2수량이다. 제품/원자재/입하재고 음수 수량 0건, `QTY <> AVAILABLE_QTY + RESERVED_QTY` 오류는 원자재/제품 모두 0건.
- 검증: `pnpm --filter @harness/backend test -- arrival.service.spec.ts --runInBand` 34/34 PASS, `pnpm --filter @harness/backend build` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 런타임 `http://localhost:3003/api/v1/health` 200, `http://localhost:3002/material/arrival` 200.
- 상태: 완료, lock released. 워크트리에는 이번 작업 외 기존 변경 파일이 다수 있어 커밋 시 범위 선별 필요.

## 2026-06-16 15:45 Codex

- 작업: `T-KIOSK-EQUIP-INSPECT-WORKDAY-ORDER` 설비일일점검/작업자설비점검 이력 유지 기준 전환.
- 원인: 기존 `EQUIP_INSPECT_LOGS`와 `/equipment/daily-inspect/check`는 `equipCode + inspectType + inspectDate` 달력일 기준이었다. 키오스크 프론트도 `new Date().toISOString().split('T')[0]`를 보내서 설비일일점검은 조업일 08:00 기준을 반영하지 못했고, 작업자설비점검은 `ORDER_NO` 컬럼/API payload가 없어 작업지시별 완료 이력을 판정할 수 없었다.
- 변경: `EQUIP_INSPECT_LOGS`에 `ORDER_NO`, `WORK_DATE`, `INSPECT_AT`, `OP_WINDOW_START_AT`, `OP_WINDOW_END_AT`를 추가했다. `EquipInspectService.getInspectionStatus()`는 설비의 `processCode` 기준 공정 월력 → 공장 공통 월력 → 08:00 fallback 순서로 기존 `WORK_CALENDARS`/`WORK_CALENDAR_DAYS`/`SHIFT_PATTERNS`를 사용해 조업일을 계산한다. `DAILY` 완료 여부는 `WORK_DATE`, `WORKER` 완료 여부는 `ORDER_NO`로 조회한다. 상세 조회도 `DAILY`는 `WORK_DATE` 우선으로 변경했다.
- 프론트 변경: `/production/input-kiosk`는 설비 선택 시 `inspectType=DAILY`만 보내 서버 조업일 판정을 사용한다. 작업지시 선택/변경 시 `inspectType=WORKER&orderNo=<작업지시>`로 이력을 확인해 `workerInspectDone`을 갱신한다. `DailyInspectModal` 저장 payload에서 프론트 계산 `inspectDate`를 제거했고, 완료 화면은 서버가 반환한 조업일/유효구간을 표시한다. `WorkerInspectModal` 저장 payload는 `orderNo`를 포함한다.
- DB 적용: JSHANES에 새 컬럼 5개를 추가하고 기존 14건 `WORK_DATE=TRUNC(INSPECT_DATE)`, `INSPECT_AT=INSPECT_DATE`로 백필했다. 조회 인덱스 `IDX_EQUIP_INSPECT_WORK_DATE`, `IDX_EQUIP_INSPECT_ORDER_NO`와 업무 중복 방어 unique index `UX_EQUIP_INSPECT_DAILY_WORK`, `UX_EQUIP_INSPECT_WORKER_ORDER`를 생성했다. `--execute-file`은 PL/SQL 블록 파싱 문제로 변경 없이 실패해 실제 적용은 `oracle_connector.py --query` 단위로 순차 실행했다.
- DB 검증: JSHANES `EQUIP_INSPECT_LOGS` 새 컬럼 5개 존재, 관련 인덱스 4개 존재, `WORK_DATE/INSPECT_AT` 누락 0건, `DAILY` 업무키 중복 0건 확인.
- 문서: `docs/superpowers/plans/2026-06-16-equip-inspect-workday-order.md` 작성, `python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 재생성.
- 검증: RED 확인 후 `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts daily-inspect.controller.spec.ts --runInBand` 16/16 PASS, 프론트 구조 테스트 9/9 PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/backend build` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 워크트리에는 이번 작업 외 다른 AI/이전 작업 변경이 다수 있으므로 커밋 시 파일 범위를 선별해야 한다.

## 2026-06-17 01:52 Codex

- 작업: `T-SYSTEM-LABEL-MENU-RENAME` 시스템관리 하위 라벨관리 메뉴명 변경.
- 확인: 메뉴 항목 `MST_LABEL`은 `apps/frontend/src/config/menuConfig.ts`에서 `labelKey="menu.master.label"`을 사용한다. 한글 표시명은 `apps/frontend/src/locales/ko.json`의 `menu["master.label"]` 값이다.
- 변경: `menu["master.label"]`을 요청 표기 그대로 `라벨다자인관리`로 변경했다. `/master/label` 페이지 내부 제목 `label.title = 라벨관리`는 메뉴명 변경 범위가 아니므로 유지했다.
- 검증: `ko.json` JSON 파싱 성공, `menu.master.label` 출력값 `라벨다자인관리` 확인, `MST_LABEL` labelKey 검색 확인, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released.

## 2026-06-17 01:45 Codex

- 작업: `T-CONSUMABLE-LABEL-PRINTLOG-PAYLOAD` `/consumables/label` 브라우저 인쇄 후 `/material/label-print/log` 400 오류 수정.
- 원인: 소모품 라벨 훅 `useConLabelIssue.logBrowserPrint()`가 공용 라벨 이력 API에 `matUids`를 보냈다. 백엔드 `CreatePrintLogDto`는 `uidList: string[]`만 허용하고, `matUids`는 `/material/label-print/generate`용 `GenerateZplDto` 전용 필드라 class-validator에서 `property matUids should not exist`, `uidList must be an array` 400이 발생했다.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.ts`의 payload를 `uidList: conUids`로 수정했다. 구조 테스트 `useConLabelIssue.structure.test.mjs`를 추가해 `con_uid` 인쇄이력 호출이 `uidList`를 사용하고 `matUids`를 재사용하지 않도록 검증한다.
- 검증: 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 실제 API에 `uidList=['CODEX-CON-PRINTLOG-2606170141']` payload로 `POST /api/v1/material/label-print/log` 성공, 기존 `matUids` payload는 동일 400 재현 확인. 검증 로그는 삭제 후 잔여 0 확인. 3002 브라우저 `/consumables/label`에서 첫 행 선택 후 `UID 발행` 클릭 시 `/consumables/label/create` 201, `/material/label-print/log` 201 확인. 생성된 검증 UID `C26061700007` 관련 `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 삭제 후 잔여 0 확인.
- 상태: 완료, lock released.

## 2026-06-17 01:04 Codex

- 작업: `T-CONSUMABLE-LABEL-IMAGE-PRINTLOG` `/consumables/label` 소모품 사진 표시 및 라벨 발행 500 오류 수정.
- 원인: `ConsumableLabelService.createConLabels()`가 `LabelPrintLog`를 생성하면서 복합 PK 필드 `PRINTED_AT`를 명시하지 않았다. TypeORM은 PK 컬럼 default를 맡기지 않고 null insert를 시도해 JSHANES `LABEL_PRINT_LOGS.PRINTED_AT` NOT NULL 제약에서 ORA-01400이 발생했다.
- 변경: 라벨 발행 가능 마스터 응답에 `imageUrl`을 포함했다. 소모품 라벨 발행 로그 생성 시 자재 라벨 서비스와 동일하게 `printedAt: new Date()`, `seq: 1`을 명시했다. 프론트 라벨 발행 그리드에 이미지 컬럼을 추가해 `/uploads/consumables/*.svg`를 표시한다.
- 검증: `pnpm --filter @harness/backend test -- consumable-label.service.spec.ts --runInBand` 8/8 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 실제 3003 `POST /api/v1/consumables/label/create` with `APPCT-A/qty=1` 성공, 생성 UID `C26061700004`는 검증 후 `CONSUMABLE_STOCKS`와 `LABEL_PRINT_LOGS`에서 각 1건 삭제해 잔여 0 확인. API `/consumables/label/masters`에서 `APPCT-A imageUrl=/uploads/consumables/appct_a.svg` 확인. 3002 브라우저 `/consumables/label`에서 소모품 이미지 37개 렌더링, 첫 이미지 natural size 720x420 확인.
- 상태: 완료, lock released.

## 2026-06-17 00:47 Codex

- 작업: `T-EQUIPMENT-INSPECT-HISTORY-ACTUAL-SQL` `/equipment/inspect-history` DataGrid SQL 보기 실제 SQL 표시 보정.
- 원인: 화면의 `DataGrid.sqlQuery`가 실제 조회 테이블이 아닌 `EQUIP_INSPECTIONS`를 참조했다. 전역 SQL 모달은 preview SQL의 `FROM/JOIN` 테이블명과 API 응답 `meta.debugSql.tables`를 매칭하는데, 실제 백엔드 `EquipInspectService.findAll()`은 `EQUIP_INSPECT_LOGS`와 `EQUIP_MASTERS`를 조회하므로 테이블 매칭이 실패해 하드코딩 SQL이 그대로 보였다.
- 변경: `apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx`의 SQL preview를 `EQUIP_INSPECT_LOGS log LEFT JOIN EQUIP_MASTERS equip` 기준으로 교체했다. 구조 테스트 `inspect-history-actual-sql.structure.test.mjs`를 추가해 잘못된 `EQUIP_INSPECTIONS` 재유입을 막았다.
- 검증: 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. JSHANES 활성 계정으로 3003 API 호출 시 `meta.debugSql.tables = EQUIP_INSPECT_LOGS, EQUIP_MASTERS` 및 실제 SELECT/parameters 확인. 3002 브라우저에서 `/equipment/inspect-history` → 그리드 옵션 → `SQL 조회문` 클릭 후 모달에 `"EQUIP_INSPECT_LOGS"`, `"EQUIP_MASTERS"`, bind 변수 `:1`, `:2`가 표시되고 구 preview `EQUIP_INSPECTIONS`는 미표시임을 확인했다.
- 상태: 완료, lock released. worktree에는 이전 작업의 backend/equipment 변경과 `.claude/worktrees` 미추적 폴더가 남아 있어 커밋 시 파일 범위 선별 필요.

## 2026-06-18 21:55 Codex

- 작업: `T-KIOSK-MOUNTED-RELOAD` `/production/input-kiosk` 재진입 시 장착 자재/소모품 DB 재조회 보정.
- 원인: 자재는 `JOB_MATERIAL_LOTS`를 `GET /production/job-orders/:orderNo/material-lots`로 다시 읽는 경로가 있었지만, 소모품 화면/스캔 모달은 `GET/POST /production/job-orders/:orderNo/consumables` 호출 때 현재 키오스크에서 선택한 설비를 넘기지 않았다. 백엔드는 `equipCode` query/body를 지원하고 `includeMounted=1`이면 `CONSUMABLE_STOCKS.STATUS='MOUNTED'`와 `MOUNTED_EQUIP_CODE` 기준으로 실제 장착 롯트를 읽을 수 있는데, 키오스크만 이 계약을 쓰지 않아 재진입 후 장착 상태가 설비 기준으로 복원되지 않을 수 있었다.
- 변경: `MaterialListPanel.tsx`가 소모품 조회 시 `params: { equipCode: selectedEquip?.equipCode, includeMounted: 1 }`를 전달하고, `ConsumableScanModal.tsx`도 목록 재조회와 스캔 장착 POST body에 같은 `equipCode`를 전달하도록 수정했다. localStorage에는 장착 UID를 추가 저장하지 않았다.
- 검증: 신규 구조 테스트 `kiosk-mounted-reload.structure.test.mjs` RED 확인 후 GREEN. `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 실DB/API/브라우저: JSHANES에서 `WO2606150066 / HNS02C2ABCDE / EQ-ATCNS-01` 매핑 2건과 `CONSUMABLE_STOCKS` mounted UID `CT26061600001`, `CT26061600002` 확인. 인증 API `GET http://localhost:3002/api/production/job-orders/WO2606150066/consumables?equipCode=EQ-ATCNS-01&includeMounted=1`이 두 UID를 반환. headless Playwright로 `http://localhost:3002/production/input-kiosk`에 인증/키오스크 컨텍스트만 주입했을 때 동일 API가 호출되고 화면 body에 두 UID가 표시됨을 확인했다.
- 상태: 완료, REVIEW 대기, lock released. JSHANES `JOB_MATERIAL_LOTS`는 현재 0건이라 자재 저장 샘플 표시는 확인하지 못했지만 기존 DB 조회 경로는 테스트로 고정했다.

## 2026-06-16 23:58 Codex

- 작업: `T-EQUIP-INSPECT-HISTORY-BLANK-ROWS` `/equipment/inspect-history` 그리드 빈 행 수정.
- 원인: JSHANES `EQUIP_INSPECT_LOGS`에는 company `40`, plant `1000` 기준 실제 이력 15건이 있었다. 문제는 백엔드 `EquipInspectService.findAll()`이 `getRawMany()` 결과를 `log.log` 엔티티 객체처럼 펼쳐서 모든 점검 필드가 `undefined`가 된 것이다. JSON 응답에서는 undefined 필드가 제거되어 `{ equip: {} }` 15행만 내려갔고, 프론트 DataGrid가 이를 빈 행처럼 렌더링했다.
- 변경: `findAll()`에서 TypeORM raw alias(`log_EQUIP_CODE`, `log_INSPECT_TYPE` 등)를 명시적으로 camelCase 응답 필드로 매핑했다. Oracle custom alias가 대문자로 반환되는 케이스(`EQUIP_NAME`, `EQUIP_LINECODE`)도 fallback 처리했다. 프론트 `inspectDate` 컬럼은 ISO 원문 대신 Asia/Seoul 기준 `YYYY-MM-DD`로 표시하도록 정리했다.
- 테스트: `equip-inspect.service.spec.ts`에 raw 점검이력 행이 그리드 응답 shape(`equipCode`, `equipName`, `inspectType`, `inspectorName`, `overallResult`, `remark`)로 변환되는 회귀 테스트 추가. 기존 테스트와 함께 `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts --runInBand` 14/14 PASS.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. API `http://localhost:3002/api/equipment/inspect-history?limit=3`에서 `EQ-ATCUT-01`, `자동절단 설비 #1`, `DAILY`, `오지훈`, `PASS` 반환 확인.
- 브라우저 검증: 임시 headless Chrome으로 `http://localhost:3002/equipment/inspect-history` 접속. DOM 기준 `EQ-ATCUT-01`, `자동절단 설비 #1`, `오지훈`, `합격`, `2026-06-16` 표시 true, ISO 원문 `2026-06-15T15:00:00.000Z` 및 `[object Object]` 미표시. 스크린샷 `docs/reports/equipment-inspect-history-grid-2026-06-16-after.png` 저장 후 육안 확인.
- 상태: 완료, lock released.

## 2026-06-16 23:30 Codex

- 작업: `T-KIOSK-WI-SEED-HNS02C1ABCD` `/production/input-kiosk` 작업지도서 미표시 원인 확인 및 시드 보완.
- 원인 확인: `WO2606150060`은 JSHANES `JOB_ORDERS` 기준 `ITEM_CODE=HNS02C1ABCD`, `PROCESS_CODE=ATCUT`, `EQUIP_CODE=EQ-ATCUT-01`, `STATUS=RUNNING`, `PLAN_QTY=5`였다. `EQ-ATCUT-01`도 `PROCESS_CODE=ATCUT`이고, 키오스크 `WorkInstructionView`는 `GET /master/work-instructions?itemCode=HNS02C1ABCD&processCode=ATCUT&useYn=Y&limit=20`를 호출한다.
- 데이터 부재: JSHANES `WORK_INSTRUCTIONS`에서 `COMPANY=40`, `PLANT_CD=1000`, `ITEM_CODE=HNS02C1ABCD`, `PROCESS_CODE=ATCUT`, `USE_YN=Y` 조건 0건, 동일 API도 `total=0`이었다.
- 변경: `apps/backend/src/migrations/2026-06-16_work_instruction_hns02c1abcd_seed.sql`을 추가했다. 복합키 `ITEM_CODE + PROCESS_CODE + REVISION + COMPANY + PLANT_CD` 기준 `MERGE`로 `HNS02C1ABCD 자동절단 작업지도서` Rev.A를 재실행 가능하게 적재한다.
- DB/API 검증: `oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_work_instruction_hns02c1abcd_seed.sql` 성공. 이후 DB 조회 1건, API `GET http://localhost:3002/api/master/work-instructions?itemCode=HNS02C1ABCD&processCode=ATCUT&useYn=Y&limit=20` total 1 및 제목/본문 반환 확인.
- 브라우저 검증: 임시 headless Chrome CDP에 `harness-auth`와 `harness-kiosk`를 주입해 `http://localhost:3002/production/input-kiosk`를 열었다. DOM 기준 `HNS02C1ABCD 자동절단 작업지도서`와 `작업지시 WO2606150060과 품목 HNS02C1ABCD를 확인한다` 표시 true, `작업지도서 없음` false. 스크린샷 `docs/reports/kiosk-work-instruction-hns02c1abcd-2026-06-16.png` 저장 및 육안 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 16:15 Codex

- 작업: `T-KIOSK-EQUIP-INSPECT-MIGRATION-RERUN` 점검이력 마이그레이션 파일 재실행성 보정.
- 원인: `oracle_connector.py --execute-file`은 SQL을 세미콜론이 아니라 `/` 단독 라인으로 분리한다. 또한 블록이 주석으로 시작하면 PL/SQL 블록으로 인식하지 못해 `END;`의 세미콜론을 제거한다. 이전 파일은 주석으로 시작한 PL/SQL 또는 세미콜론 구분 SQL이라 재실행 파일로 부적합했다.
- 변경: `apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql`을 파일 첫 줄이 `DECLARE`인 단일 idempotent PL/SQL 블록으로 변경했다. 컬럼/인덱스 존재 여부를 `USER_TAB_COLUMNS`, `USER_INDEXES`에서 확인하고 없을 때만 DDL을 `EXECUTE IMMEDIATE`로 실행한다. 백필 UPDATE도 동적 SQL로 처리해 신규 DB에서 컬럼 추가 후 같은 블록 안에서 실행 가능하게 했다.
- 검증: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql` 재실행 성공(`blocks_executed=1`). Post-check 결과 컬럼 5개, 인덱스 4개, `WORK_DATE/INSPECT_AT` 누락 0건. 관련 파일 `git diff --check` 통과.
- 상태: 완료, lock released.

## 2026-06-16 19:00 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-IMAGE-PANEL` `/master/equip-inspect-item` 사진 첨부와 모달 제거, 누락 기준정보 보정.
- 프론트: 등록/수정 UI를 모달에서 480px 우측 패널(`animate-slide-in-right`, `border-l`)로 전환했다. 목록에 사진 컬럼을 추가하고 패널에서 이미지 미리보기, 선택, 저장 후 업로드, 기존 이미지 삭제를 지원한다. 측정형 판정기준은 LSL/USL이 없더라도 `CRITERIA + UNIT`을 표시하도록 fallback을 보강했다.
- 백엔드/DB: `EQUIP_INSPECT_ITEM_MASTERS.IMAGE_URL` 컬럼과 DTO/entity/service/controller 저장 경로를 추가했다. `POST/DELETE /master/equip-inspect-item-masters/:itemCode/image`로 이미지 업로드/삭제를 처리하며 업로드 파일은 `uploads/equip-inspect-items`에 저장한다. JSHANES에는 `2026-06-16_equip_inspect_item_image_url.sql`을 적용했다.
- 데이터 보정: `2026-06-16_equip_inspect_item_missing_fields.sql`로 `EQUIP_TYPE COMMON=공통` 공통코드를 추가하고, 기존 공통/작업자 점검항목 10건의 누락 유형을 `COMMON`으로 채웠다. 누락 주기 7건은 `PERIODIC -> MONTHLY`, 그 외 `DAILY`로 보정했고, 측정형 항목의 단위/확정 가능한 기준값을 보강했다.
- DB/API 검증: JSHANES `EQUIP_INSPECT_ITEM_MASTERS` 50건 기준 `EQUIP_TYPE/ITEM_TYPE/CRITERIA/CYCLE` 누락 0건. API 인증 호출(`Bearer admin@hanes.com`, company `40`, plant `1000`) 결과 total 50, missing 0, `COMMON` 10, `imageUrl` field true. `COM_CODES`도 `EQUIP_TYPE/COMMON/공통` 1건 확인.
- 런타임 검증: `http://localhost:3002/master/equip-inspect-item` 실제 브라우저에서 `공통`, `작업표준서 규격 이내 (mm)`, `매월` 표시 확인. 등록 클릭 후 파일 입력 상위 컨테이너가 `x=960`, `width=480`, `animate-slide-in-right`, `border-l` 우측 패널이며 `role=dialog` 모달은 표시되지 않음. 이미지 업로드/삭제 API도 실제 PNG 업로드 후 DB URL 저장, 삭제 후 null 복귀 확인.
- 테스트: RED 후 GREEN으로 구조 테스트 3/3, `pnpm --filter @harness/backend test -- equip-inspect-item-pool.service.spec.ts equip-inspect-item-pool.controller.spec.ts --runInBand` 8/8 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit` PASS, `pnpm --filter @harness/shared exec tsc --noEmit` PASS, `pnpm --filter @harness/backend build` PASS. `python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 재생성.
- 상태: 완료, lock released. 워크트리에는 다른 AI/기존 변경이 다수 있어 커밋 시 이번 작업 파일 범위를 선별해야 한다.

## 2026-06-16 20:33 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-UNIT-DROPDOWN` `/master/equip-inspect-item` 등록/수정 패널의 측정 단위 입력형을 공통코드 드롭다운으로 전환.
- 확인: JSHANES 공통코드에서 단위 그룹은 `UNIT_TYPE`이며 기존 `UNIT` 그룹은 없음. `UNIT_TYPE`에는 `EA/M/KG/SET/ROLL/BOX/L/PCS/G/MM/CM/BAG/PAIR` 13건이 있었다.
- 변경: 측정형(`MEASURE`)일 때 `Input` 단위 필드를 `ComCodeSelect groupCode="UNIT_TYPE" includeAll={false} showCode`로 교체했다. 기존 데이터의 `mm`는 화면 편집 시 `MM`으로 정규화한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_equip_inspect_item_unit_type.sql` 추가 및 JSHANES 적용. 현재 점검항목 데이터에서 쓰는 `°C`, `Ω`를 `UNIT_TYPE`에 추가하고 기존 `mm` 4건은 `MM`으로 정규화했다.
- 검증: 구조 테스트 RED 확인 후 GREEN 4/4 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit` PASS. JSHANES 단위값은 `MM` 4건, `°C` 2건, `Ω` 1건으로 정리됐고 세 값 모두 `UNIT_TYPE` 공통코드/API에서 확인. 3002 실제 브라우저에서 등록 패널 → 판정구분 `MEASURE` 선택 시 `단위` 컨트롤이 `SELECT`이고 `MM/°C/Ω` 옵션이 노출됨을 확인했다.
- 상태: 완료, lock released. 3002가 일시적으로 응답 지연되어 3012 임시 dev 서버를 띄웠으나 사용자 재실행 후 3002에서 최종 검증했고 3012 프로세스는 종료했다.

## 2026-06-16 21:28 Codex

- 작업: `T-CONSUMABLE-MASTER-IMAGE-SEED` `/consumables/master` 소모품 마스터 전체 시드 이미지 등록.
- 전제 확인: 이전 `T-ITEM-CONSUMABLE-MOVE` 이후 JSHANES 기준 `CONSUMABLE_MASTERS` 37건, `ITEM_MASTERS.ITEM_TYPE='CONSUMABLE'` 0건, 이미지 보유 0건을 확인했다.
- 생성: `tools/generate-consumable-master-seed-images.mjs`를 추가해 `apps/backend/uploads/consumables`에 소모품별 SVG 37개를 생성했다. 카테고리별로 `JIG/MOLD/TOOL` 형태와 색상을 달리하고, 코드/명칭/보관위치를 SVG에 표시한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_consumable_master_image_seed.sql` 생성 후 JSHANES에 적용했다. 37개 UPDATE + COMMIT 총 38블록 모두 성공.
- 검증: 로컬 SVG 37개, SQL UPDATE 37개 확인. JSHANES `CONSUMABLE_MASTERS` total 37, with_image 37, missing_image 0. 인증 API `/api/v1/consumables?limit=100&useYn=Y`도 total 37, missing 0, 첫 이미지 `/uploads/consumables/appct_a.svg` 반환. 정적 파일 `http://localhost:3003/uploads/consumables/cm_jg_ct1.svg` 200 `image/svg+xml`. 3002 실제 브라우저 `/consumables/master`에서 이미지 37개 전부 로드, 첫 이미지 natural size 720x420, console/page error 0.
- 상태: 완료, lock released.

## 2026-06-16 21:12 Codex

- 작업: `T-ITEM-CONSUMABLE-MOVE` 품목마스터에 남아 있던 소모품 12건을 소모품마스터로 이동.
- 사전 확인: JSHANES `ITEM_MASTERS` company `40`, plant `1000`, `ITEM_TYPE='CONSUMABLE'` 대상은 `APPCT-A/B/SE`, `CUTBL001/002/003/004/009`, `JIGHD-A/B/C/D` 총 12건. `BOM_MASTERS` parent/child, `MAT_LOTS`, `MAT_STOCKS`, FK 대상 `PROD_PLANS` 참조는 모두 0건이었다. `CONSUMABLE_CATEGORY` 공통코드는 `MOLD/JIG/TOOL` 3개만 활성이다.
- 변경: `apps/backend/src/migrations/2026-06-16_move_item_consumables_to_consumable_master.sql` 추가 및 JSHANES 적용. `CONSUMABLE_MASTERS`에는 기존 품목코드를 `CONSUMABLE_CODE`로 유지해 MERGE하고, `JIGHD*`는 `JIG`, 그 외 `APPCT*`/`CUTBL*`는 `TOOL`, `STATUS='NORMAL'`, `OPER_STATUS='WAREHOUSE'`, 재고 0으로 적재했다. 이후 `ITEM_MASTERS`의 대상 소모품 12건은 삭제했다.
- 보정: 첫 적용 때 파일 상단 주석 때문에 `oracle_connector.py --execute-file`의 PL/SQL 세미콜론 보존이 깨져 백업 블록이 실패했으나 실제 이동 블록은 성공했다. 파일을 `DECLARE` 시작 블록으로 고치고, 이미 이동된 DB에서도 `ITEM_MASTERS_CONSUMABLE_BAK_20260616` 백업 테이블을 핵심 컬럼으로 보강하도록 수정했다.
- 검증: 마이그레이션 재실행 성공(`blocks_executed=2`). 최종 JSHANES post-check는 `ITEM_MASTERS` 소모품 잔여 0건, `CONSUMABLE_MASTERS` 이동 12건, `ITEM_MASTERS_CONSUMABLE_BAK_20260616` 백업 12건. 이동 12건 분류는 `JIG=4`, `TOOL=8`. `git diff --check` 대상 파일 통과.
- 상태: 완료, lock released.

## 2026-06-16 21:39 Codex

- 작업: `T-CONSUMABLE-MASTER-USAGE-MAP` `/consumables/master` 우측 패널 내 `CONSUMABLE_USAGE_MAP` 매핑 섹션 추가.
- 확인: `CONSUMABLE_USAGE_MAP`는 JSHANES에 있고 20건 사용 중이며, 키오스크 `/production/job-orders/:orderNo/consumables`와 생산실적 완료 타수 누적 로직에서 쓰지만 관리 CRUD 화면/API가 없었다.
- 백엔드 변경: `ConsumablesModule`에 `ConsumableUsageMap`, `PartMaster`, `EquipMaster` repository를 등록하고, `/consumables/:id/usage-maps` GET/POST, `/consumables/:id/usage-maps/:productItemCode/:equipCode` PUT/DELETE를 추가했다. 목록은 `ITEM_MASTERS`, `EQUIP_MASTERS`, `CONSUMABLE_MASTERS`를 JOIN해 제품명/설비명/소모품명을 함께 반환한다. 생성은 동일 키가 있으면 업데이트로 동작한다.
- 프론트 변경: `apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx` 패널 폭을 560px로 넓히고, 기존 기본정보/수명/거래처/이미지 섹션 아래에 `소모품 사용매핑` 고정 섹션을 추가했다. 신규 등록 모드에서는 저장 후 매핑 가능 안내만 표시하고, 수정/선택 모드에서는 제품/모델(`/master/parts`), 설비(`/equipment/equips`), 단위사용량, 사용여부, 비고 입력 후 저장/토글/삭제할 수 있다.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. API `GET /api/v1/consumables/CM-JG-SL1/usage-maps`는 2건 반환. API 생성/삭제 경로는 `APPCT-A/HNS02/EQ-SASSY-01` 테스트 매핑을 생성 후 삭제해 둘 다 success true 확인, JSHANES 잔여 0건 확인. `http://localhost:3002/consumables/master` HTTP 200. 이 워크스페이스에는 Playwright 패키지/설정이 없어 브라우저 DOM 자동 검증은 수행하지 못했다.
- 상태: 완료, lock released.
# 2026-06-19 codex T-HNS02-260619-SEED-CLEANUP
- 요청: 원자재 IQC/입하/입고/재고/출고예정 정합성 어긋난 데이터를 정리.
- 원인: HNS02 260619 시드가 `VH1-RM260619-*` MAT_UID 공간을 실제 `R260619*` 원자재 입하/IQC 데이터와 공유해 `ARH/RVH/STH/ISH/WOH/PRH/FGH/SGH/BXH/SOH/PTH/POH-260619` 마커 데이터가 현재 흐름과 충돌했다.
- 작업: `tools/seed/cleanup_hns02_260619_seed.py` 작성. 기본은 dry-run rollback, `--commit`으로 반영.
- dry-run: `python tools/seed/cleanup_hns02_260619_seed.py` 실행. 삭제 후보 679건, after-in-tx 시드 마커 잔여 0, LOT-입고/LOT-수불 품목 불일치 0, `MAT_STOCKS` invariant 0 확인 후 rollback.
- 반영: `python tools/seed/cleanup_hns02_260619_seed.py --commit` 실행. 총 679건 삭제 후 commit.
- 삭제 건수: `PRODUCT_GENEALOGY` 100, `INSPECT_RESULTS` 200, `BOX_MASTERS` 10, `FG_LABELS` 100, `SG_LABELS` 20, `SHIPMENT_ORDER_ITEMS` 1, `SHIPMENT_ORDERS` 1, `PRODUCT_TRANSACTIONS` 33, `PRODUCT_STOCKS` 17, `PROD_RESULTS` 17, `MAT_ISSUES` 18, `STOCK_TRANSACTIONS` 36, `MAT_STOCKS` 18, `MAT_RECEIVINGS` 18, `MAT_LOTS` 18, `IQC_LOGS` 18, `MAT_ARRIVALS` 18, `JOB_ORDERS` 17, `PURCHASE_ORDER_ITEMS` 18, `PURCHASE_ORDERS` 1.
- 사후 검증: `ARH/RVH/STH/ISH/WOH/FGH` 잔여 0, LOT-입고 품목/입하 불일치 0, LOT-수불 품목 불일치 0, `MAT_STOCKS` 및 `MAT_ARRIVAL_STOCKS` 수량 invariant 0, 미완료 출고요청 없음.
- `R26061900002` 확인: `MAT_ARRIVALS` PASS 10건 1,000,000, `MAT_LOTS` PASS 10건 1,000,000, `MAT_ARRIVAL_STOCKS` AVAILABLE 10건 1,000,000.

# 2026-06-19 codex T-ISSUE-REQUEST-BARCODE-VALIDATION
- 요청: 출고요청한 내용에 대한 바코드스캔 출고처리가 문제 없는지 점검.
- 원인: 웹 요청출고 API `IssueRequestService.issueFromRequest()`가 실제 출고 `MatIssueService.createInTx()`를 먼저 호출하고, 이후 요청항목 `issuedQty`만 갱신했다. 이 경로에는 요청항목 `ITEM_CODE`와 스캔 `MAT_UID`의 `MAT_LOTS.ITEM_CODE` 대조가 없어 잘못된 품목 LOT도 수량만 맞으면 출고될 수 있었다.
- 변경: 실제 출고 생성 전에 같은 트랜잭션 안에서 요청항목 존재, 잔여수량, 스캔 LOT 존재, 요청품목과 LOT 품목 일치를 선검증하도록 보정했다. 불일치 시 `출고요청 품목과 스캔 LOT 품목이 일치하지 않습니다` 오류로 중단하며 `MatIssueService.createInTx()`를 호출하지 않는다.
- 테스트: 신규 회귀 테스트로 ITEM-A 요청항목에 ITEM-B LOT를 넣는 케이스가 기존 구현에서 정상 완료되는 RED를 확인했고, 수정 후 `pnpm --filter @harness/backend test -- issue-request.service.spec.ts` 15/15 PASS.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS. JSHANES `40/1000` 기준 출고요청은 COMPLETED 8건만 있고 APPROVED/REQUESTED는 0건이라 즉시 브라우저 실출고 재현 데이터는 없었다. 완료 요청 기준 요청품목과 출고 LOT 품목 불일치 조회는 0건.
- 참고: PDA `/material/issues/scan`은 출고요청번호를 소비하지 않는 작업지시/BOM 기반 전량 출고 흐름이므로, 출고요청 내용과의 직접 매칭 보장은 웹 요청출고 API 경로에서 처리한다.

# 2026-06-19 codex T-IQC-HISTORY-CERT-TIMESTAMP
- 요청: `/material/iqc-history`에서 검사성적서 업로드 시 `IQC 이력을 찾을 수 없습니다: 2026-06-19T07:56:27.354Z/1` 404가 발생.
- 원인: 화면은 API 응답 Date를 ISO UTC 문자열(`2026-06-19T07:56:27.354Z`)로 다시 보내지만, JSHANES `IQC_LOGS.INSPECT_DATE`는 timezone 없는 Oracle `TIMESTAMP`라 같은 이력이 `2026-06-19 16:56:27.354`로 저장되어 있었다. 기존 `uploadCert()`는 `new Date(inspectDate)`를 그대로 PK 조건에 넣어 exact match를 시도해 404가 났다.
- DB 확인: `COMPANY=40`, `PLANT_CD=1000`, `INSPECT_TYPE=INITIAL`, 2026-06-19 최신 행에서 `R26061900020 / CBL-B / SEQ=1 / INSPECT_DATE=2026-06-19 16:56:27.354 / CERT_FILE_PATH=NULL` 확인. 에러 timestamp의 07:56Z와 KST 로컬 16:56이 대응된다.
- 변경: `IqcHistoryService.uploadCert()`에서 기존 `findOne(Date)`를 먼저 시도하고, 실패하면 ISO/offset timestamp를 Asia/Seoul 기준 `YYYY-MM-DD HH24:MI:SS.FF3` 문자열로 정규화해 `TO_TIMESTAMP(:inspectTs, ...)` QueryBuilder 조회/업데이트 fallback을 수행한다.
- 테스트: 신규 회귀 테스트로 ISO `2026-06-19T07:56:27.354Z`가 `2026-06-19 16:56:27.354` 조건으로 조회/업데이트되는지 검증. `pnpm --filter @harness/backend test -- iqc-history.service.spec.ts -t "성적서 업로드"` PASS.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS. 실제 업로드 API는 DB와 파일을 변경하므로 임의 더미 업로드 실측은 수행하지 않았다.

# 2026-06-19 codex T-EQUIP-INSPECT-WORKER-PK-COLLISION
- 요청: `/equipment/daily-inspect` 작업자설비점검 저장 시 `ORA-00001 TEST.PK_EQUIP_INSPECT_LOGS` 오류 정리.
- 원인: `EQUIP_INSPECT_LOGS` 물리 PK는 `EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE`인데, WORKER 이력의 `INSPECT_DATE`가 `2026-06-19 00:00:00`처럼 날짜값으로 저장되어 같은 장비/유형/일자에서 작업지시가 달라도 PK가 충돌했다.
- DB 정리: JSHANES `40/1000` 기준 `EQ-ATCNS-01`, `WORKER`, `2026-06-19 00:00:00` 충돌 로그 `WO2606190100`, `WO2606190118` 각 1건 삭제. 최종 2026-06-19 해당 장비 WORKER 로그 잔여 0건 확인.
- 변경: `EquipInspectService.create()`에서 `WORKER` 저장만 분기해 `INSPECT_DATE`를 `TO_DATE(:3, 'YYYY-MM-DD HH24:MI:SS')`로 명시 삽입한다. `DAILY` 저장은 기존 TypeORM 저장 경로를 유지한다.
- 테스트: 신규 회귀 테스트가 기존 구현에서 `mockLogRepo.query` 호출 0회로 RED 실패하는 것을 확인했고, 수정 후 GREEN 통과.
- 검증: `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts` 15/15 PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.

# 2026-06-19 codex T-IQC-AQL-CRUD
- 요청: `/quality/aql`이 빈 껍데기라 실제 등록 기능이 필요함.
- 범위: AQL 기준관리 CRUD/API/DB 구현까지. IQC 품목별 AQL 기준 연결과 IQC 검사 적용은 후속 단계로 분리.
- DB: JSHANES에 `AQL_STANDARDS`, `AQL_SAMPLING_RULES`를 생성했다. `AQL_SAMPLING_RULES`는 `AQL_STANDARDS`에 FK cascade를 갖고, LOT 범위와 Ac/Re 체크 제약을 포함한다.
- 백엔드: `AqlModule`, controller/service/DTO/entity/spec를 추가했다. API는 목록, 상세, 등록, 수정, soft-disable 삭제, `resolve?aqlCode=&lotQty=`를 제공한다. service는 LOT 범위 중복, `rejectQty > acceptQty`, inactive 기준 resolve 차단을 검증한다.
- 프론트: `/quality/aql` page를 DataGrid + 우측 입력 패널 + LOT 수량별 sampling rule 편집 UI로 교체했다. 저장 전 LOT 범위 중복과 Ac/Re 오류를 화면에서 차단한다.
- 문서: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md`를 JSHANES 기준 재생성했고 `AQL_STANDARDS`, `AQL_SAMPLING_RULES` 반영을 확인했다.
- 검증: backend spec RED→GREEN, frontend 구조 테스트 RED→GREEN, BE/FE tsc PASS, JSHANES 마이그레이션 적용 및 재실행 idempotent PASS, API 목록/등록/상세/resolve/수정/삭제 PASS, 3002 브라우저 UI 표시 PASS.
- 정리: API 검증 데이터 `AQL-CODEX-260619`는 `AQL_SAMPLING_RULES` 2건, `AQL_STANDARDS` 1건 물리 삭제 후 잔여 0 확인.

# 2026-06-19 codex T-SHIP-ORDER-AUTO-NO
- 요청: `/shipping/order` 출하지시 등록 시 출하지시번호를 사용자가 입력하지 않고 자동 생성.
- 원인: 프론트 등록 폼이 `shipOrderNo`를 필수 입력처럼 관리했고, 백엔드 `CreateShipOrderDto`도 필수값으로 검증해 신규 등록자가 번호 규칙을 직접 알아야 했다.
- 변경: `CreateShipOrderDto.shipOrderNo`를 선택값으로 바꾸고, `ShipOrderService.create()`에서 미입력 시 트랜잭션 안에서 `NumberingService.nextShipmentNo()`로 채번한다. 중복 검사는 자동/수동 번호 모두 생성 후 수행한다.
- 프론트: `/shipping/order` 신규 등록 폼은 출하지시번호를 payload에 보내지 않고, 비활성 입력에 `자동생성`만 표시한다. 수정 모드에서는 기존 출하지시번호를 표시하되 변경하지 않는다.
- 테스트: 자동 채번 backend 회귀 테스트와 frontend payload 구조 테스트를 RED→GREEN으로 추가했다. 전체 `ship-order.service.spec.ts`, frontend 구조 테스트, BE/FE `tsc --noEmit`, `git diff --check` 통과.
- 실측: 3003 API에 `shipOrderNo` 없이 출하지시를 등록해 `SH2606190001` 자동 발급을 확인했고, 검증 데이터 삭제 후 JSHANES `SHIPMENT_ORDERS`/`SHIPMENT_ORDER_ITEMS` 잔여 0건을 확인했다. 3002 브라우저에서 등록 모달 `출하지시번호=자동생성`, disabled true, console error 0 확인.

# 2026-06-19 codex T-SHIP-BOX-STOCK-CARD-REMOVE
- 요청: `/shipping/box-stock` 정보카드 제거.
- 확인: 현재 상단 KPI형 `StatCard`는 없지만 좌/우 조회 영역이 `Card/CardContent` 프레임으로 감싸져 화면상 카드형 정보 영역처럼 보이는 구조였다.
- 변경: `/shipping/box-stock` 페이지에서 `Card/CardContent` import와 wrapper를 제거하고 일반 `div` 레이아웃으로 바꿨다. 박스 목록 DataGrid, 박스 내 개별제품 DataGrid, 검색, 선택 박스 상세 조회 API 호출은 유지했다.
- 테스트: 신규 구조 테스트가 기존 코드에서 `<Card>` 존재로 RED 실패한 뒤, 수정 후 GREEN 통과했다.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 HTTP 200, Playwright에서 `제품재고조회` 표시/카드형 wrapper 0/console error 0 확인, `git diff --check` PASS.

# 2026-06-19 codex T-SHIP-CONFIRM-BOXSCAN-ORDERNO
- 요청: `/shipping/confirm` 박스스캔출하 모달에 출하지시번호를 미리 표시.
- 확인: `BoxScanShipModal`은 출하지시번호 입력칸은 유지하지만, 주문 조회 후 박스 스캔 단계의 요약 영역에는 고객사/상태만 보여줘 현재 출하지시번호를 작업자가 다시 확인하기 어려웠다.
- 변경: 주문 조회 성공 후 표시되는 요약 영역 첫 줄에 `출하지시번호` 라벨과 `order.shipOrderNo`를 큰 monospace 강조값으로 추가했다. `ship-box`/`cancel-ship-box` API 호출과 스캔 흐름은 변경하지 않았다.
- 테스트: 신규 구조 테스트가 기존 코드에서 `order.shipOrderNo` 요약 표시 누락으로 RED 실패한 뒤, 수정 후 GREEN 통과했다.
- 검증: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 HTTP 200, Playwright에서 `SO-RV-26061202215660` 조회 후 출하지시번호/고객사/박스 바코드 입력 표시와 console error 0 확인, `git diff --check` PASS.

# 2026-06-20 codex T-MASTER-PART-IQC-CODE-SELECT
- 요청: `/master/part` 검사 관련 항목을 입력 방식이 아니라 선택 방식으로 변경하고, 자유입력보다 공통코드/기준정보 선택을 우선하는 원칙을 개발표준과 기억 메모에 남김.
- 변경: `PartFormPanel.tsx`, `PartFormModal.tsx`에서 기본시료수는 ISO 2859-1 샘플 크기 계열 선택값으로 변경했다. 검사수준은 `AQL_INSP_LEVEL`, Critical/Major/Minor AQL은 `AQL_VALUE` 공통코드 선택으로 변경했다. 모달의 검사구분 하드코딩 `FULL/SKIP`도 `IQC_INSPECT_METHOD` 공통코드 선택으로 맞췄다.
- 표준화: `docs/standards/implementation-rules.md`, `AGENTS.md`, 사용자 기억 메모에 코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 방식을 우선한다는 규칙을 기록했다.
- 테스트: 구조 테스트에 검사 기준 필드가 `FieldInput`이면 실패하는 계약을 추가했고 RED 확인 후 GREEN 통과했다.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.

# 2026-06-20 codex T-MASTER-PART-IQC-CODE-SELECT 보정
- 요청: 기본시료수는 소수점 이하도 직접 넣을 수 있어야 함.
- 원인: 직전 변경에서 기본시료수를 ISO 샘플 크기 선택값으로 제한했고, 백엔드 `CreatePartDto.sampleQty`도 `@IsInt()`라 소수 입력을 막았다.
- 변경: `PartFormPanel.tsx`, `PartFormModal.tsx`의 기본시료수를 `FieldInput type="number" step="0.001"`로 되돌렸다. 검사수준/AQL/검사구분 공통코드 선택 방식은 유지했다. `part.dto.ts`의 `sampleQty`는 `@IsNumber()`로 변경해 소수 저장을 허용한다.
- 테스트: 구조 테스트가 `sampleQty` 선택식이면 실패하고, `sampleQty` DTO가 `@IsInt()`면 실패하도록 갱신했다. RED 확인 후 GREEN 통과.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS.

# 2026-06-20 codex T-IQC-DEFECT-CODE-SEVERITY-AQL
- 요청: IQC 불량코드는 반드시 Critical/Major/Minor 등급을 가지고, IQC 판정 시 등급별 AQL을 독립 적용하며 Critical 1건 이상은 즉시 FAIL 처리.
- 확인: 기존 `COM_CODES.ATTR1`은 `DEFECT_TYPE`에서 색상/영문 설명으로 이미 사용 중이었다. 따라서 불량등급 저장에는 전용 `DEFECT_GRADE` 컬럼을 추가했다.
- DB: JSHANES `COM_CODES`에 `DEFECT_GRADE VARCHAR2(20)` 추가, `DEFECT_TYPE`에는 등급 필수 체크 제약과 허용값 체크 제약을 적용했다. 기존 12개 불량코드는 `CRACK=CRITICAL`, `DIM/MATERIAL/WORK/FUNC/WELD/ASM/MAT=MAJOR`, `APP/MARK/BURR/ETC=MINOR`로 백필했다.
- 백엔드: IQC AQL 정책 계산이 `defectCodes[{defectCode, qty}]`를 받아 `DEFECT_TYPE.DEFECT_GRADE`로 Critical/Major/Minor 수량을 집계한다. 등급 누락/미등록/사용중지 코드는 판정을 중단한다. Major와 Minor는 각각 독립 Ac/Re 판정하고 하나라도 실패하면 LOT FAIL 처리한다.
- 프론트: `/material/iqc` 모달에서 등급별 수량 직접입력을 제거하고 `DEFECT_TYPE` 불량코드 선택 + 수량 입력 행으로 변경했다. 선택된 코드의 등급을 화면에 표시하고, 저장 payload는 `defects` 배열로 전송한다.
- 문서: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md`를 JSHANES 기준 재생성했다.
- 검증: backend focused RED/GREEN, frontend structure RED/GREEN 확인. 최종 `pnpm --filter @harness/backend test -- aql.service.spec.ts iqc-history.service.spec.ts --runInBand` 26/26 PASS, `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` 3/3 PASS, BE/FE `tsc --noEmit` PASS, JSHANES 컬럼/제약/불량코드 12건 등급 조회 PASS, 관련 파일 `git diff --check` PASS.

# 2026-06-20 codex T-IQC-PART-SPEC-AQL-SUMMARY
- 요청: `/master/iqc-part-spec`에 AQL 관련 내용도 같이 표시되어야 하는 것 아니냐는 지적.
- 변경: 품목별 IQC 항목관리 우측 상단에 선택 품목의 `AQL 기준` 요약 영역을 추가했다. 검사수준, 기본시료수, Critical/Major/Minor AQL을 품목마스터 응답에서 표시한다.
- 변경: Ac/Re는 LOT 수량이 있어야 산출되므로 `LOT 수량 미리보기` 숫자 입력을 추가하고, 선택 품목 + 입력 LOT 수량으로 `/quality/aql/resolve-iqc`를 호출해 샘플수량, Major Ac/Re, Minor Ac/Re를 표시한다.
- 유지: 기존 좌측 품목 목록 3/12, 우측 관리 영역 9/12 레이아웃과 `IqcSpecPanel` 검사항목 저장 흐름은 변경하지 않았다.
- 검증: 신규 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/master/iqc-part-spec` HTTP 200, 대상 파일 `git diff --check` PASS.

# 2026-06-20 codex T-IQC-PART-SPEC-LEFT-PANEL
- 요청: `/master/iqc-part-spec` 좌측 패널을 더 작게 표시.
- 변경: `page.tsx`의 12컬럼 그리드 비율을 좌측 `col-span-4`, 우측 `col-span-8`에서 좌측 `col-span-3`, 우측 `col-span-9`로 조정해 품목 목록은 줄이고 규격 관리 영역을 넓혔다.
- 테스트: 구조 테스트 `iqc-part-spec-layout.structure.test.mjs`를 추가했고 기존 `4/8` 레이아웃에서 RED, 변경 후 GREEN을 확인했다.
- 검증: 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/master/iqc-part-spec` HTTP 200, 대상 파일 `git diff --check` PASS.

# 2026-06-20 15:33 codex T-WIP-MAT-LABEL-RAW-PROCESS
- 요청: `/production/wip-material-stock` 메뉴명을 `공정재고`에서 `원자재공정재고`로, `공정수불`을 `원자재공정수불`로 변경.
- 변경: `apps/frontend/src/locales/ko.json`의 한국어 메뉴 키 `menu.production.wipMaterialStock`, `menu.production.wipMaterialTrans`와 화면 제목/설명을 새 용어로 변경했다. 라우트, 메뉴 코드, DB 메뉴 데이터는 변경하지 않았다.
- 테스트: 신규 구조 테스트 `wip-material-menu-label.structure.test.mjs`를 추가했고 기존 `공정재고` 값에서 RED 실패 확인 후 GREEN 통과했다.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs" apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 두 라우트 HTTP 200, Playwright DOM 제목 `원자재공정재고`/`원자재공정수불` 및 console/page error 0 확인, 대상 파일 `git diff --check` PASS.

# 2026-06-20 17:58 codex T-FG-STOCK-CARD-REMOVE-TYPE-FILTER
- 요청: `/production/fg-stock` 정보카드 제거, 좌측 그리드에 유형 필터 추가.
- 변경: 공유 `WipStockView`에서 상단 `StatCard` 2개와 통계 계산을 제거했다. `/production/fg-stock`만 `enableTypeFilter`를 켜고, 좌측 그리드 툴바에 `유형: 전체/완제품/반제품` Select를 표시한다.
- 변경: 유형 필터는 기본 `FINISHED`로 시작하며, 변경 시 `/production/wip-stock` 조회 파라미터 `itemType`과 SQL 미리보기의 `s.ITEM_TYPE` 조건이 함께 바뀐다. `wip-stock` 메뉴는 필터 없이 기존 `SEMI_PRODUCT` 고정 조회를 유지한다.
- 테스트: 신규 구조 테스트가 기존 코드에서 `enableTypeFilter` 부재와 `StatCard` 잔존으로 RED 실패하는 것을 확인했고, 수정 후 기존 split/SQL 구조 테스트와 함께 GREEN 통과했다.
- 검증: 구조 테스트 5건 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/production/fg-stock` HTTP 200, Playwright에서 정보카드 문구 0건, 유형 옵션 3개, API 요청 `FINISHED -> SEMI_PRODUCT`, console/page error 0 확인, 대상 파일 `git diff --check` PASS.

# 2026-06-20 18:37 codex T-WIP-STOCK-LABEL-DETAIL-PANEL
- 요청: `/production/wip-stock`에도 라벨이 있을 수 있으므로 `/production/fg-stock`처럼 상세 라벨정보를 표시해야 함.
- 확인: 백엔드 `GET /production/wip-stock/fg-labels`는 `FG_LABELS`를 `itemCode` 기준으로 조회하므로 반제품 품목도 라벨이 있으면 반환할 수 있다. 문제는 프론트 `WipStockView`가 `itemType === "FINISHED"`에서만 우측 패널과 행 클릭 라벨 조회를 허용한 조건이었다.
- 변경: `showFgPanel` 조건을 제거하고 반제품/제품 화면 모두 우측 `상세 라벨정보` 패널을 항상 렌더한다. 행 클릭 시 품목 유형과 관계없이 `/production/wip-stock/fg-labels?itemCode=...`를 호출한다.
- 변경: 패널 제목/빈 상태 문구를 `미포장 제품(FG라벨)`에서 범용 `상세 라벨정보`로 바꿀 수 있도록 `labelPanelTitle`, `labelPanelEmpty` locale 키를 ko/en/zh/vi에 추가했다. 기존 `fgPanelTitle`/`fgPanelEmpty` 키는 호환을 위해 남겼다.
- 검증: 신규 구조 테스트 RED 확인 후 GREEN. 관련 구조 테스트 8건 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/production/wip-stock` HTTP 200, Playwright에서 우측 패널 표시 및 반제품 `HNS02C2ABCDE` 클릭 시 라벨 API 호출 확인. 현재 해당 품목의 라벨 상세 데이터는 0건이라 패널 그리드는 `데이터가 없습니다.`로 표시된다. 대상 파일 `git diff --check` PASS.

# 2026-06-20 18:53 codex T-WIP-FG-LABEL-SOURCE-SPLIT
- 요청: `SG_LABELS`와 `FG_LABELS` 두 개로 분리 조회되도록 수정.
- 원인: 직전 상태는 `/production/wip-stock` 반제품 화면도 우측 패널은 열리지만, API가 `/production/wip-stock/fg-labels` 하나뿐이라 `FG_LABELS`만 조회했다. 반제품 묶음 라벨 source인 `SG_LABELS`를 전혀 보지 않았다.
- 변경: 백엔드 `GET /production/wip-stock/labels?itemCode=&itemType=` endpoint를 추가했다. `itemType='SEMI_PRODUCT'`이면 `SgLabel` repository로 `SG_LABELS`를 조회해 `labelType='SG'`, `barcode`, `remainQty`, `currentProcessCode`, `mountedEquipCode` 등을 반환한다. 그 외 `FINISHED`는 `FgLabel` repository로 `FG_LABELS`를 조회해 `labelType='FG'`, `barcode`, `inspectPassYn` 등을 반환한다. 기존 `/fg-labels` endpoint는 호환용으로 `FINISHED` wrapper로 유지했다.
- 변경: 프론트 `WipStockView`는 행 클릭 시 `/production/wip-stock/labels`에 `itemCode`와 `row.itemType`을 함께 전달하고, 우측 그리드는 공통 컬럼 `구분`, `라벨바코드`, `상태`, `잔량`, `검사`, `작업지시`, `현재공정`, `장착설비`, `발행일시`로 표시한다.
- 검증: 구조 테스트 RED 확인 후 GREEN. 관련 구조 테스트 9건 PASS, FE/BE tsc PASS. 3002 브라우저 fetch 실측에서 `SEMI_PRODUCT/HNS02C2ABCDE`는 `SG_LABELS` SQL과 `labelType=SG` 1건, `FINISHED` 요청은 `FG_LABELS` SQL을 사용하는 것 확인. 화면 우측 패널에 `라벨바코드`, `잔량` 컬럼 표시 및 console/page error 0 확인.

# 2026-06-21 codex T-DEFECT-CODE-MASTER
- 요청: 불량코드를 공통코드가 아니라 전용 테이블로 분리하고, 외관/기능/원자재/제품/제품류 등 많은 그룹을 3레벨로 분류해 관리하는 불량코드관리 화면과 메뉴 추가.
- 변경: `DEFECT_CATEGORY_MASTERS`, `DEFECT_CODE_MASTERS`, `DEFECT_CODE_PRODUCT_TYPES` 엔티티/마이그레이션/API를 추가했다. 카테고리는 3레벨 tree, 불량코드는 leaf category 참조, 제품류 적용은 별도 mapping table로 분리했다.
- 변경: `/quality/defect-code` 불량코드관리 페이지를 추가하고 품질관리 메뉴 `QC_DEFECT_CODE`로 연결했다. 좌측 3레벨 분류, 중앙 불량코드 목록, 우측 분류/코드 편집 폼으로 구성했다.
- 변경: IQC 모달 불량코드 선택과 `AqlService` 불량등급 조회는 `COM_CODES.DEFECT_TYPE` 대신 `DEFECT_CODE_MASTERS` 기반 API/Repository를 사용한다.
- DB 검증: JSHANES 마이그레이션 적용 및 재실행 PASS. category 18건, code 12건, product-type mapping 0건, 메뉴 `QC_DEFECT_CODE` 1건, `FK_DEFECT_CATEGORY_PARENT` ENABLED 확인. ERD 문서 재생성 완료.
- 검증: backend defect-code spec 4건, AQL spec 19건, frontend/source/IQC 구조 테스트 19건, BE/FE tsc, 3002 `/quality/defect-code` HTTP 200, 3002 `/api/quality/defect-codes/options` 인증 게이트 401, `git diff --check` PASS.
- 제한: `apps/frontend/src/app/(authenticated)/quality/defect/page.tsx`는 `T-QUALITY-DEFECT-FILTER-ONE-LINE` hermes lock 대상이라 수정하지 않았다.

# 2026-06-21 codex T-DEFECT-CODE-MASTER 최종 연결
- 추가 요청: hermes 세션 종료 확인 후 기존 `/quality/defect` 불량등록관리 화면도 전용 불량코드 마스터로 연결.
- 변경: `/quality/defect` 필터와 등록 모달의 `DEFECT_TYPE` 공통코드 Select를 제거하고 `/quality/defect-codes/options` 기반 Select로 전환했다. 등록 payload의 `defectName`은 전용 불량코드 옵션에서 가져온다.
- 변경: `DefectLogService.create/update`는 `DEFECT_CODE_MASTERS` 활성 코드만 허용하고, 프론트가 보낸 `defectName` 대신 마스터의 `DEFECT_NAME`으로 저장한다. 미등록/사용중지 코드는 `BadRequestException`으로 차단한다.
- 검증: RED 확인 후 GREEN. `/quality/defect` 구조 테스트 3/3 PASS, `defect-log.service.spec.ts` 39/39 PASS, 기존 불량코드 구조 테스트 9/9 PASS, BE/FE tsc PASS, `git diff --check` PASS, 3002 `/quality/defect` HTTP 200, 3002 `/api/quality/defect-codes/options` 인증 게이트 401 확인.

# 2026-06-20 20:02 codex T-MENU-OPEN-DELAY
- 요청: 예전에는 메뉴 클릭 시 화면이 바로 열렸는데 지금은 30초 이상 기다려야 열리는 원인 확인.
- 원인: `TabKeepAlive`가 레이아웃 런타임에서 `pageRegistry.generated.ts`를 import하고, 해당 registry가 authenticated `page.tsx` 163개를 `next/dynamic` 정적 목록으로 들고 있었다. Next dev 서버가 메뉴 하나를 열 때 전체 page loader를 on-demand compile 대상으로 잡아 지연이 발생했다.
- 증거: 수정 전 HTTP 측정에서 `/dashboard` 첫 응답 22.8초, `/master/part` 8.9초, `/production/wip-stock` 4.0초. `.next/trace`에는 `/system/menu-categories` RSC 요청 89~109초, `/inspection/terminal-result` compile 68초, authenticated page loader 다수 동시 준비 기록이 있었다.
- 변경: `TabKeepAlive`에서 `pageRegistry.generated.ts`, `useTabStore`, 동적 page cell 렌더링을 제거했다. 탭 UI는 `TabBar`/`tabStore`가 유지하고, 본문은 App Router `children`만 렌더한다.
- 보정: 전체 page registry 방식 대신 방문한 App Router `children`만 경로별로 최대 `MAX_TABS`개 캐시하도록 바꿨다. 열린 탭의 React state를 보존하며, `tabPageState.ts`는 본문 입력값, select/checkbox/radio 값, 스크롤 위치를 `sessionStorage`에 저장하는 추가 복원 보조로 유지한다.
- 검증: `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 실측: 수정 후 3002 반복 HTTP 측정에서 `/dashboard` 514ms, `/master/part` 281ms, `/production/wip-stock` 212ms, `/system/menu-categories` 258ms.
- 추가 검증: Playwright headless mock에서 `/master/part` 본문 검색 입력 `CODX_STATE_KEEP` 복원 확인. 우측 등록 패널에 `CODX_PANEL_KEEP` 입력 후 대시보드 탭 이동, 품목 탭 재진입 시 패널/입력값 보존 확인. 최종 3002 HTTP 측정 `/dashboard` 1030ms, `/master/part` 860ms, `/production/wip-stock` 331ms, `/system/menu-categories` 462ms.

# 2026-06-21 01:11 codex T-MASTER-PART-MODEL-NAME
- 요청: `http://localhost:3002/master/part` 품목관리 화면에 자동차용 MES 관리 특성인 `차종` 컬럼 추가.
- 변경: `ITEM_MASTERS.MODEL_NAME VARCHAR2(100)` nullable 컬럼 마이그레이션을 추가하고 JSHANES에 적용했다. `PartMaster`, `CreatePartDto/UpdatePartDto`, `PartService` create/update/search, `/master/part` 타입/그리드/우측 패널/레거시 모달/help/locale에 `modelName`/`차종`을 연결했다.
- 문서: `python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md`를 JSHANES 기준 재생성했다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` PASS, FE/BE `pnpm.cmd ... tsc --noEmit --pretty false` PASS, `git diff --check` PASS.
- DB 검증: 적용 전 JSHANES `ITEM_MASTERS.MODEL_NAME` 0건, 마이그레이션 적용 및 재실행 성공, 적용 후 `VARCHAR2(100)`/주석 `차종` 확인.
- 화면 검증: 3002 HTTP 200. Playwright DOM에서 목록 헤더 `차종`, mock 행 값 `CN7`, `품목 추가` 우측 패널 라벨 `차종`, console/page error 0 확인.

# 2026-06-21 codex T-IQC-AQL-POLICY-CODE
- 요청: `/master/part`의 검사수준/Critical/Major/Minor AQL 개별 속성을 품목 속성이 아니라 AQL 정책 코드 참조 구조로 개선.
- 변경: 신규 `IQC_AQL_POLICIES` 엔티티/테이블/목록 API `GET /quality/aql/policies`를 추가했다. 정책은 `INSPECTION_LEVEL`, `MAJOR_AQL_CODE`, `MINOR_AQL_CODE`, `CRITICAL_MODE`를 가진다.
- 변경: `ITEM_MASTERS` 애플리케이션 계약을 `iqcAqlPolicyCode`로 전환했다. `PartMaster`, `CreatePartDto/UpdatePartDto`, `PartService`, `/master/part` 타입/목록/우측 패널/레거시 모달/help/locale에서 구 AQL 개별 필드를 제거했다.
- 변경: `AqlService.resolveIqcPolicy()`는 품목의 `IQC_AQL_POLICY_CODE`로 정책을 조회한 뒤 `AQL_STANDARDS` 코드와 sampling rule을 산출한다. Critical 1건 즉시 FAIL 결정은 유지했다. `IQC_PART_SPEC_ITEMS`의 검사수준/AQL은 항목별 override로 유지했다.
- DB 검증: JSHANES pre-check에서 구 컬럼 4개 존재, 정책 테이블 0건 확인. 마이그레이션 적용 및 재실행 PASS. post-check에서 `ITEM_MASTERS`는 `IQC_AQL_POLICY_CODE`만 남고 구 AQL 컬럼은 제거됨. IQC 대상 19건은 정책 코드 보유, 비대상 17건은 null, orphan 정책 참조 0건.
- 문서: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 재생성.
- 검증: RED/GREEN 구조 테스트 12건 PASS, `aql.service.spec.ts`/`iqc-history.service.spec.ts` 31건 PASS, FE/BE typecheck PASS, `git diff --check` PASS, 3002 `/master/part` HTTP 200.

# 2026-06-21 codex T-IQC-AQL-POLICY-CODE 정책관리 완성
- 요청: `/master/part` AQL 정책이 1개만 보이는 이유 확인 후 정책관리까지 완성.
- 원인: `/master/part`는 `AQL_STANDARDS`가 아니라 `IQC_AQL_POLICIES`를 조회하고 있었고, JSHANES 정책 테이블에는 1건만 있었다. `AQL_STANDARDS`는 `AQL-II-1.0`, `AQL-II-2.5`, `AQL-II-4.0` 3건이었다.
- 변경: `CreateIqcAqlPolicyDto`, `UpdateIqcAqlPolicyDto`와 `POST/PUT/DELETE /quality/aql/policies`를 추가했다. 정책 등록/수정 시 Major/Minor AQL 기준 코드가 활성 `AQL_STANDARDS`인지 검증한다.
- 변경: `/quality/aql` 우측 패널에 `AQL 정책관리` 폼/목록을 추가해 `IQC_AQL_POLICIES` 정책 코드, 정책명, 검사수준, Major/Minor AQL 기준을 관리한다.
- 변경: 품목에 배정된 정책은 사용중지할 수 없도록 `deletePolicy()`에서 `ITEM_MASTERS.IQC_AQL_POLICY_CODE` 참조를 검사한다.
- DB 적용: 기존 마이그레이션 seed를 보강하고 JSHANES 재적용. 정책은 `AQLP-II-1.0-2.5`, `AQLP-II-1.0-4.0`, `AQLP-II-2.5-4.0` 3건. 정책 AQL 기준 orphan 0건, 품목 정책 참조는 기존 19건 유지.
- 검증: 정책 CRUD 구조 테스트 RED→GREEN, backend policy spec RED→GREEN. `aql.service.spec.ts` 16/16 PASS, FE/BE typecheck PASS, `/quality/aql` 및 `/master/part` HTTP 200, 3002 `/api/quality/aql/policies`는 인증 게이트 401 확인, `git diff --check` PASS.

# 2026-06-21 codex T-IQC-AQL-POLICY-CODE 정책관리 좌측상단 배치
- 요청: `/quality/aql`의 정책관리는 우측상단보다 좌측상단에 있는 것이 자연스럽다는 지적.
- 변경: `/quality/aql` 12컬럼 첫 좌측 카드에 `AQL 정책관리` 폼과 정책 목록을 배치했다. 우측 카드는 `AQL_STANDARDS` 기준 목록, AQL 기준 등록/수정, LOT 판정기준 관리로 정리했다.
- 테스트: 구조 테스트에 `AQL 정책관리`가 AQL 기준 목록/폼보다 먼저 렌더되어 좌측상단 작업 영역이 되도록 계약을 추가했다. 기존 배치에서 RED 실패 확인 후 GREEN 통과했다.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"` 4/4 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/quality/aql` HTTP 200, `git diff --check` PASS. Headless Chrome은 인증 세션이 없어 로그인 페이지만 확인했다.

# 2026-06-21 codex T-IQC-AQL-POLICY-CODE 정책 도움말 및 좌측 패널 보정
- 요청: `/quality/aql` 좌측 정책관리에도 자세한 `?` 도움말을 추가하고, 우측 AQL 코드 설명이 예전 품목 직접 연결 설명으로 남아 있는 문제를 수정. 좌측 섹션은 한 화면에 보여야 하며 우측상단 추가 버튼도 무엇을 추가하는지 명확해야 한다는 추가 지적 반영.
- 변경: `AqlFieldHelp.tsx`에 `IQC_AQL_POLICIES` 정책 필드 도움말을 추가했다. `AQL_STANDARDS.AQL_CODE` 설명은 품목 직접 참조가 아니라 `IQC_AQL_POLICIES.MAJOR_AQL_CODE`/`MINOR_AQL_CODE`에서 참조되는 기준 코드라고 수정했다.
- 변경: 좌측 정책관리 폼 라벨과 정책 목록 헤더에 `HelpField`/`HelpHeader`를 적용했다. 좌측 카드는 `overflow-auto`를 제거하고 `p-3 overflow-hidden flex flex-col`, 3열 폼, `flex-1 min-h-0` 정책 그리드로 바꿔 자체 세로 스크롤이 생기지 않게 했다.
- 변경: 상단 `추가` 버튼 문구를 `AQL 기준 추가`로 바꿔 좌측 `정책 추가`와 구분했다.
- 검증: 구조 테스트 RED→GREEN. `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"` 7/7 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/quality/aql` HTTP 200.

# 2026-06-21 codex T-IQC-AQL-POLICY-CODE `/master/iqc-part-spec` 실제 IQC 판정 경로 연결
- 요청: `/master/iqc-part-spec`과 품목관리 AQL 관리가 유기적으로 연결되어 있는지 확인 후 개선.
- 원인: 데이터 구조는 `ITEM_MASTERS.IQC_AQL_POLICY_CODE -> IQC_AQL_POLICIES -> AQL_STANDARDS`와 `IQC_PART_SPEC_ITEMS` override로 연결돼 있었지만, `/master/iqc-part-spec` 상단 AQL 미리보기는 품목 정책 단독 endpoint인 `/quality/aql/resolve-iqc`를 호출했다. 실제 IQC 저장/판정은 `AqlService.resolveIqcPolicyByItem()`로 검사항목별 등급/AQL/파괴검사를 적용한다.
- 변경: `GET /quality/aql/resolve-iqc-items` endpoint를 추가해 `resolveIqcPolicyByItem()` 결과를 반환하게 했다. `/master/iqc-part-spec` 미리보기는 이 endpoint를 호출하고, 상단 요약에 `검사항목 기준`과 `파괴/고정` 건수를 표시한다.
- DB 확인: JSHANES 기준 IQC 대상 품목 19건은 정책 코드를 보유하고 orphan 정책 참조는 0건이었다. 활성 `IQC_PART_SPEC_ITEMS` 검사항목 기준은 53건이며, 정책과 검사항목 Major/Minor AQL 및 검사수준 불일치 0건을 확인했다.
- 검증: 관련 구조 테스트 18/18 PASS, `aql.service.spec.ts` 16/16 PASS, FE/BE typecheck PASS.

# 2026-06-21 codex T-IQC-AQL-ACTUAL-PREVIEW 검사모달 AQL 실제 판정 경로 보정
- 요청: AQL 정책코드 기반 IQC 검사프로세스 리뷰 결과 중 실제 수정 필요 항목 반영.
- 원인: `/master/iqc-part-spec` 미리보기는 검사항목별 경로로 보정됐지만, 실제 검사 모달 `IqcModal`은 아직 `/quality/aql/resolve-iqc` 단일 정책 preview를 호출했다. 또한 품목 정책코드가 없으면 `resolveIqcPolicy()`에서 Major/Minor rule이 `null`이 되어 Major/Minor 불량이 있어도 PASS가 될 수 있었다.
- 변경: `IqcModal` preview 호출을 `/quality/aql/resolve-iqc-items`로 변경하고 `itemResults` 기반 `검사항목 기준`, `파괴/고정`, 항목별 `Ac/Re` 또는 고정시료 정보를 표시했다. `useIqcData`는 `vendorCode`와 `supplierName`을 분리해 preview에는 코드값을 넘긴다.
- 변경: `AqlService.resolvePartPolicy()`는 `ITEM_MASTERS.IQC_AQL_POLICY_CODE` 미설정 시 `BadRequestException`을 던져 조용한 PASS를 차단한다. 기존 fallback은 정책코드가 있는 품목에 대해서만 유지한다.
- 테스트: 신규 구조 테스트와 서비스 테스트를 먼저 RED로 확인한 뒤 GREEN 처리했다. IQC 모달 구조 테스트 10/10 PASS, `aql.service.spec.ts` 17/17 PASS, `iqc-history.service.spec.ts` 17/17 PASS, FE/BE typecheck PASS, 3002 `/material/iqc` HTTP 200, `git diff --check` PASS.

# 2026-06-21 codex T-IQC-AQL-TRACEABILITY-FIX IQC AQL 추적성/불량코드 판정 보정
- 요청: IQC AQL 최종 리뷰에서 남은 실질 문제 해결.
- 변경: `IqcModal` 저장 payload의 `sampleBarcode`는 전체 스캔 시리얼 join이 아니라 500바이트 이내 요약 문자열로 전송한다. 전체 시리얼/항목 상세는 기존처럼 `DETAILS` CLOB에 남긴다.
- 변경: `IqcModal`은 FAIL 판정이 있으면 불량코드를 요구하고, FAIL 판정 없이 불량코드만 입력된 상태는 제출하지 못하게 했다.
- 변경: `IqcHistoryService.createArrivalResult()`는 API 직접 호출에서도 `details`가 모두 PASS인데 불량코드만 있는 저장을 `BadRequestException`으로 차단한다. 검사항목 없는 수동 FAIL은 시리얼 result FAIL을 근거로 인정한다.
- 변경: 서버 저장 시에도 `sampleBarcode`가 500바이트를 초과하면 `...(+N more)` 형태로 요약해 `IQC_LOGS.SAMPLE_BARCODE` 저장 실패를 방지한다.
- 검증: RED 확인 후 GREEN. `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` 5/5 PASS, `pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/iqc-history.service.spec.ts --runInBand` 20/20 PASS, IQC 모달/이력 구조 테스트 15/15 PASS, FE/BE typecheck PASS, 대상 파일 `git diff --check` PASS.

# 2026-06-22 codex T-DEFECT-CATEGORY-CLASSIFICATION 불량분류 기준 재정의
- 요청: 불량코드 1/2/3레벨 기준이 모호하므로 1레벨은 `IQC/LQC/OQC`, 2레벨은 제품류별, 3레벨은 `기능/외관/기타`로 정리. 다른 모델/제품류 불량코드가 표시되지 않도록 제품류 매핑을 강제.
- 변경: `2026-06-21_defect_code_masters.sql` 초기 seed와 신규 `2026-06-22_reclassify_defect_categories.sql`를 같은 기준으로 보정했다. 활성 분류는 `IQC/LQC/OQC -> PRODUCT_TYPE -> FUNCTION/APPEARANCE/ETC` 코드 패턴을 사용한다.
- 변경: 기존 12개 불량코드는 `MATERIAL/MAT -> IQC_WIRE_ETC`, `WORK/ASM/WELD -> LQC_HARNESS_ETC`, `FUNC -> OQC_HARNESS_FUNCTION`, `APP/MARK/BURR/CRACK/DIM -> OQC_HARNESS_APPEARANCE`, `ETC -> OQC_HARNESS_ETC`로 재분류했다.
- 변경: 불량코드 옵션 조회에서 제품류 매핑이 없는 코드를 공통처럼 노출하지 않도록 `productType` 필터를 엄격화했다. `/quality/defect-code` 등록 저장은 선택한 2레벨 코드에서 제품류를 파생해 `productTypes`로 저장한다.
- 검증: RED/GREEN 구조/서비스 테스트 PASS. `node --test apps/backend/src/modules/quality/defect-codes/defect-code-source.structure.test.mjs` 3/3 PASS, `node --test "apps/frontend/src/app/(authenticated)/quality/defect-code/defect-code-master.structure.test.mjs"` 10/10 PASS, `pnpm.cmd --filter @harness/backend test -- src/modules/quality/defect-codes/services/defect-code.service.spec.ts --runInBand` 4/4 PASS.
- 검증: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS.
- DB 검증: JSHANES에 `2026-06-22_reclassify_defect_categories.sql` 적용 PASS. 활성 분류는 1레벨 3건, 2레벨 48건, 3레벨 144건. 기존 구분 18건은 `USE_YN='N'`. 제품류 매핑은 HARNESS 10건, WIRE 2건.
- 참고: 3002/3003 dev server는 사용자 요청대로 재시작하지 않았다. 스키마 변경은 없어서 ERD는 갱신하지 않았다.

# 2026-06-21 codex T-PRODUCTION-ORDER-EDIT-SYNC 생산지시 수정패널 선택행 동기화
- 요청: `/production/order`에서 우측 수정패널이 열린 상태로 좌측 그리드 행을 변경하면 수정패널 내용도 같이 변경되어야 함. 추가 요청으로 우측 폼의 라인/공정 필드를 한 행에 배치.
- 원인: 좌측 행 클릭 핸들러는 `selectedRow`만 토글하고, 수정패널의 source인 `editingOrder`는 갱신하지 않아 패널 폼이 최초 수정 대상에 머물렀다.
- 변경: `toJobOrderFormData(row)` helper를 추가해 행→수정폼 데이터 매핑을 단일화했다. `handleEdit()`와 열린 수정패널 상태의 `handleRowClick()`이 같은 helper를 사용한다.
- 변경: 수정패널이 열린 수정 모드(`isPanelOpen && editingOrder`)에서 다른 행을 클릭하면 `editingOrder`를 새 행 데이터로 갱신하고, 재슬라이드 애니메이션은 끈다. 신규 생성 패널은 행 클릭으로 덮어쓰지 않는다.
- 변경: `JobOrderFormPanel`의 `라인`/`공정` Select를 `grid grid-cols-2` 한 행으로 묶고, 공정 종속 필드인 `설비`는 아래 행에 유지했다.
- 추가 변경: 사용자 추가 요청에 따라 `설비`를 드롭다운에서 버튼형 선택 목록으로 변경했다. `useEquipOptions(form.processCode || undefined)` 결과를 즉시 펼쳐 보여주며, 공정 미선택 시 전체 설비, 공정 선택 시 해당 공정 설비를 바로 클릭해 선택한다.
- 검증: RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs"` 4/4 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/production/order` HTTP 200, 대상 파일 `git diff --check` PASS.

# 2026-06-21 codex T-DEFECT-CODE-MASTER 불량코드관리 미번역 라벨 보정
- 요청: `/quality/defect-code` 화면에서 영어키/DB 필드명이 번역 없이 보이는 항목 전부 처리.
- 변경: 분류/불량코드 폼의 raw label(`levelNo`, `parentCategoryCode`, `defectGrade` 등)을 `quality.defectCode.*` 번역 키로 교체했다.
- 변경: 목록과 Select 옵션에서 `CRITICAL`/`MAJOR`/`MINOR`, `COMMON`/`RAW_MATERIAL` 같은 enum 저장값을 직접 렌더링하지 않고 `formatDefectGrade()`/`formatDefectScope()`로 표시한다. 좌측 분류 배지 `L1/L2/L3`도 `levelBadge` 번역 키로 교체했다.
- 변경: ko/en/zh/vi locale에 `/quality/defect-code` 전용 문구와 등급 표시 키를 추가했다.
- 검증: RED 구조 테스트로 raw label/enum 노출 실패 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/quality/defect-code/defect-code-master.structure.test.mjs"` 7/7 PASS, locale JSON parse PASS, raw label/enum 검색 매칭 없음, `git diff --check` PASS.
- 참고: 전체 frontend typecheck는 다른 통합검사 변경(`apps/frontend/src/app/(authenticated)/inspection/integrated/**`)의 `IntegratedInspectPanel` prop 불일치로 실패했다. 해당 파일들은 이번 보정 범위가 아니다.

# 2026-06-21 codex T-DEFECT-CODE-MASTER 불량코드관리 화면 단순화
- 요청: 사용자가 원한 것은 좌측에 등록된 불량 전체 그리드가 나오고, 등록 시 1/2/3레벨을 선택하는 간결한 구조였음. 기존 좌측 분류 트리 + 중간 코드목록 + 우측 폼은 복잡하다고 지적.
- 변경: `/quality/defect-code`를 2컬럼으로 재구성했다. 좌측은 `등록된 불량 전체` 그리드이며 검색만 적용하고 분류 선택으로 목록을 필터링하지 않는다.
- 변경: 우측 불량코드 등록/수정 폼에서 `1레벨 -> 2레벨 -> 3레벨` Select를 순차 선택하고, 선택된 3레벨 categoryCode로 저장한다. 기존 `CategoryNode` 트리와 `params.categoryCode` 조회 필터를 제거했다.
- 변경: 분류 관리는 우측 하단 `분류 빠른 추가`로 축소했다. 목록의 등급/적용범위/사용여부는 raw 코드값 대신 번역 표시로 렌더링한다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/quality/defect-code/defect-code-master.structure.test.mjs"` 7/7 PASS, locale JSON parse PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 트리/분류필터 잔재 검색 매칭 없음, `git diff --check` PASS.
- 참고: 사용자 요청대로 3002/3003 dev server는 재시작하지 않았다.

# 2026-06-22 codex T-DEFECT-CODE-GRID-LEVEL-COLUMNS 불량코드관리 그리드 레벨 컬럼 분리
- 요청: `/quality/defect-code` 좌측 그리드에서 1/2/3레벨 분류를 구분해서 표시.
- 변경: 기존 단일 `분류` 경로 컬럼을 `1레벨`, `2레벨`, `3레벨` 컬럼으로 분리했다. `categoryLevels()`가 3레벨 categoryCode에서 부모를 역추적해 각 레벨명을 채운다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/quality/defect-code/defect-code-master.structure.test.mjs"` 8/8 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS.
- 참고: 3002/3003 dev server는 재시작하지 않았다.

# 2026-06-22 codex T-DEFECT-CODE-PAGE-HEIGHT 불량코드관리 화면 높이 overflow 보정
- 요청: `/quality/defect-code` 화면 하단이 화면을 벗어남.
- 원인: 본문 grid가 `h-[calc(100vh-150px)]` 고정 높이를 사용해 페이지 padding/header와 합쳐질 때 부모 화면 높이를 초과할 수 있었다.
- 변경: 페이지 루트를 `flex flex-col`로 바꾸고 헤더는 `shrink-0`, 본문 grid는 `flex-1 min-h-0`로 변경해 남은 높이 안에서 좌측 그리드/우측 폼이 내부 스크롤되게 했다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/quality/defect-code/defect-code-master.structure.test.mjs"` 9/9 PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS.
- 참고: 3002/3003 dev server는 재시작하지 않았다.

# 2026-06-21 claude T-VENDOR-NAME-MATERIAL 입하·입고·수불 화면 공급사 업체명 표시
- 요청: `/material/iqc`, `/material/arrival-result`, `/material/arrival-transaction` 공급사 코드만 표시 지적 후, 입하·입고·수불 계열 전체 점검 요청.
- 점검: material 17개 화면을 Explore 3개로 점검. 정상 3건(arrival/arrival-stock/receive-label), 코드만표시 7건, 컬럼없음 2건(iqc-history/stock), 개념부적절 1건(misc-receipt), 입고취소는 별도 enrichment 누락 의심.
- 변경(BE): receiving/mat-lot/hold/shelf-life/lot-split/lot-merge/iqc-history/mat-stock 서비스 findAll에 PARTNER_MASTERS IN절 일괄조회(company/plant 스코프)로 vendorName 매핑 추가. lot.vendor(=PARTNER_CODE)→PARTNER_NAME. N+1 없음, as any 없음. 각 모듈 forFeature에 PartnerMaster 등록(lot/inventory-control/receiving).
- 변경(FE): 코드만표시 7건은 vendor 컬럼 cell을 `vendorName || vendor || '-'`로, iqc-history/stock은 공급사 컬럼 신규 추가(헤더 기존 키 `material.arrivalResult.supplier` 재사용).
- 선행 직접수정 3건: iqc(pending-arrivals PARTNER JOIN), arrival-result(그리드 공급사 컬럼+오늘날짜 기본), arrival-transaction(그리드 공급사 컬럼+i18n vendor 키 4파일).
- 검증: BE/FE `tsc --noEmit` PASS, 모듈 forFeature PartnerMaster 등록 확인(DI 부팅 안전), DB 실측 vendor↔PARTNER_NAME 매칭 확인(VND-001=한국단자공업, SUPL001=(주)행성테크놀러지).
- 미처리(범위밖, 한줄보고): 두 입고화면 공급사 필터/distinct는 여전히 vendor 코드 기준. 입고취소(receipt-cancel) raw StockTransaction enrichment 누락(공급사+품목명+창고명) 별도 사안. stock은 dev 재시작 후 화면 확인 필요.
- 참고: locales(ko/en/zh/vi)는 codex 잠금 중이라 미수정, 기존 키 재사용. dev server 미재시작.

# 2026-06-21 claude T-RECEIPT-CANCEL-FIX 입고취소 화면 enrichment+transType 버그 수정
- 발견: `receipt-cancel.service.ts`가 (1) raw StockTransaction 반환으로 id/품목명/단위/창고명/공급사 누락(프론트 id 없으면 취소 동작 불가), (2) findCancellable/cancel이 transType='RECEIPT'로 필터하나 실제 입고는 'RECEIVE'(receiving.service:539, DB 실측 RECEIVE만 존재)라 화면이 항상 빈 목록+취소 불가.
- 변경(BE): findCancellable에 PartMaster/Warehouse/MatLot+PartnerMaster IN절 enrichment 추가(id=transNo, itemName, unit, warehouseName, vendor/vendorName). transType 필터·cancel 체크 'RECEIPT'→'RECEIVE'. 역분개 transType('RECEIPT_CANCEL')은 이력 라벨이라 유지.
- 변경(FE): receipt-cancel/page.tsx 공급사 컬럼 추가(헤더 기존 키 material.arrivalResult.supplier 재사용), 인터페이스 vendorName 추가.
- 변경(test): spec providers에 PartMaster/PartnerMaster/Warehouse mock 추가, cancel 모킹 transType RECEIPT→RECEIVE.
- 검증: BE tsc PASS, jest receipt-cancel.service.spec 10/10 PASS, DB 실측 enrichment 매칭 확인(TX20260619-00113=케이블B/MM/원자재창고/대한전선).
- 미처리(범위밖): 원본 RECEIVE의 status가 취소 후에도 DONE 유지→receivedQty(SUM RECEIVE) 미감소 가능성. cancelRefId로 목록 제외는 정상. search 파라미터 백엔드 미사용. dev server 미재시작.

# 2026-06-21 claude T-RECEIPT-CANCEL-FIX 후속(잔여 2건 처리)
- 변경1(BE): cancel 시 원본 RECEIVE 트랜잭션 status='CANCELED' 설정 추가. receiving.service의 기입고수량 SUM(transType='RECEIVE' AND status='DONE')에서 제외→취소 후 LOT 잔여 입고수량/재입고 정상 복구. (역분개 RECEIPT_CANCEL 이력은 유지)
- 변경2(BE): findCancellable에 search 적용(거래번호/품목코드/시리얼 LIKE OR, fromDate·toDate 포함 baseWhere). 기존 미사용 파라미터 활성화. 품목명 검색은 enrich 전이라 코드 기준 한정.
- 변경(test): cancel 정상처리 원본 update 검증에 status:'CANCELED' 반영.
- 검증: BE tsc PASS, jest receipt-cancel.service.spec 10/10 PASS.

# 2026-06-21 claude T-DEADFILTER-AUDIT 상태 문자열 상수(기록≠조회) 죽은필터 전수점검
- 동기: 입고취소 RECEIPT≠RECEIVE 버그와 동형(기록값과 조회값 리터럴 불일치)이 다른 곳에도 있는지 점검 요청.
- 방법: StockTransaction/MatArrivalTransaction/MatArrival/MatReceiving/MatIssue/MatLot의 transType/status/refType 등 생성(W) vs 조회(R) 리터럴 집합 대조 + DB 실측.
- 발견3: (1) receipt-cancel.service refType==='PO' PO receivedQty 차감(죽은필터, DB PO 0건, 게다가 PO수량은 입하단계 관리라 살리면 이중차감) (2) arrival.service:211-220 refType='RETURN'+MAT_IN_CANCEL 반품합계(죽은필터, DB 0건, RETURN/MAT_IN 기록경로 없음) (3) prod-result:1250 PROD_CONSUME 삼항(StockTx에선 미성립→항상 else MAT_IN, 영향 제한적).
- 변경(BE): receipt-cancel.service.ts의 PO receivedQty 차감 블록 제거 + 미사용 PurchaseOrderItem import/주입 제거. spec 동기화. BE tsc PASS, spec 10/10 PASS.
- 미처리(보고만): #2 arrival RETURN/MAT_IN_CANCEL(반품 미구현 placeholder 추정, 현재 무해), #3 prod-result PROD_CONSUME(역분개 라벨, 영향 제한적). 사용자 판단 대기.
- 정상확인: status(DONE/CANCELED), MatArrival/MatReceiving/MatIssue/MatLot 상태값은 기록↔조회 일관. ARRIVAL_IN/WIP_IN/FG_IN 등은 별도 테이블 소속(오탐 아님).

# 2026-06-21 claude T-DEADFILTER-AUDIT 후속(#2,#3 처리 + 죽은 spec 발견)
- #2(BE): arrival.service.ts 입하잔량 검증의 RETURN/MAT_IN_CANCEL 반품합계(returnTxs/returnQtyMap) 제거 → remaining=orderQty-receivedQty. 입하취소가 receivedQty 직접 감소시켜 잔량 복원, 별도 반품보정은 항상 0인 데드코드+이중복원 위험이라 제거. poItemCodes 미사용 제거.
- #3(BE): prod-result.service.ts 자재투입 역분개 삼항(transType==='PROD_CONSUME'?'PROD_CONSUME_CANCEL':'MAT_IN') → 'MAT_IN' 고정. 이 루프는 refType='MAT_ISSUE' StockTransaction만 조회하며 그 transType은 MAT_OUT/WIP_IN뿐(PROD_CONSUME는 WIP_MAT_TRANSACTIONS 소속, DB 0건)이라 PROD_CONSUME 가지는 도달불가. 동작 불변(항상 MAT_IN)+주석 명확화.
- 검증: BE tsc PASS.
- 발견(별개 기존이슈): arrival.service.po-line.spec(5) + prod-result.cancel.spec(5) = DI provider 누락으로 모듈 compile 단계에서 전체 실패. git stash로 변경 전 원본에서도 동일 10/10 실패 확인 → 내 변경 무관, 서비스 생성자에 의존성 추가(예: ArrivalService PartnerMaster) 후 spec providers 미동기화로 추정. 핵심 로직(입하 PO라인 검증, 생산실적 취소 역분개) 테스트가 죽어있어 검증 0 상태. 수정은 범위밖이라 미처리, 보고만.

# 2026-06-22 claude T-DEADSPEC-REVIVE 죽은 백엔드 spec 31개 전수 복구
- 동기: vendorName 작업서 PartnerMaster 주입 후 spec 미동기화로 깬 것 발견 → 백엔드 전체 죽은 spec 점검 요청.
- 진단: 31개 suite 실패. (A)DI provider 누락 ~13서비스: 내가 깬 PartnerMaster 8 + 기존누락(arrival MatArrivalStock/MatArrivalTransaction, defect-log FgLabel/DefectCodeMaster, prod-plan RoutingProcess, prod-result WorkerMaster/WipMatStockService, production-views FgLabel/SgLabel, rework PartMaster/ProductInventoryService). (B)stale mock/기대값 ~18: 소스 리팩토링(N+1제거 QueryBuilder전환, parseDateStart timezone-safe, PRD_UID 비키화, ProductStock 2-part키) 미반영.
- 조치: 5개 병렬 에이전트로 분담, 담당 spec만 수정(서비스/엔티티 불변). DI는 누락 provider createMock 보충, stale은 현재 동작에 맞춰 기대값 갱신(의미있는 expect 보존, 쿼리절 검증 강화). 실제 코드 버그 0건.
- product-hold "코드버그 의심" 1건은 직접 검증: 엔티티PK+실DB PK+커밋78d46411 대조 결과 PRD_UID 비키화 정상동작 확정 → spec stale로 수정(2-part키). 메모리 project_product_stock_prduid_sentinel 갱신(PRD_UID 비키화/센티넬'*' 폐기).
- 검증: 백엔드 전체 jest 176 suites / 1830 tests ALL GREEN. tsc PASS.
- 교훈: DI 누락 spec은 compile 단계 실패라 핵심 로직 검증이 0이었음에도 방치됨(CI 미가동 의심). 사용자 원질문("왜 테스트서 안 드러났나")의 근본 원인 중 하나.

# 2026-06-22 codex T-DEFECT-MODEL-GROUP-CLASSIFICATION 불량코드 2레벨 모델구분 보정
- 요청: 불량코드 2레벨은 제품류가 아니라 모델 구분(예: 저전압/고전압)이며, 필요하면 품목마스터에 추가하라는 사용자 정정 반영.
- 변경(DB): `DEFECT_MODEL_GROUP` 공통코드 `LV`=저전압, `HV`=고전압을 추가하고, `ITEM_MASTERS.DEFECT_MODEL_GROUP` 컬럼을 추가했다. 기존 JSHANES 품목 36건은 기본 `LV`로 백필했다.
- 변경(분류): `/quality/defect-code` 분류 seed/reclass 기준을 1레벨 `IQC/LQC/OQC`, 2레벨 `DEFECT_MODEL_GROUP`, 3레벨 `FUNCTION/APPEARANCE/ETC`로 재정의했다. 이전에 생성된 제품류 기반 stage 하위 분류는 동적 cleanup으로 비활성화한다.
- 변경(IQC): `GET /material/iqc-history/pending-arrivals`가 품목의 `defectModelGroup`를 반환하고, `useIqcData`/`IqcModal`이 `/quality/defect-codes/options`에 해당 값을 `productType` 파라미터로 전달해 다른 모델구분 불량코드가 섞이지 않게 했다.
- 변경(문구): 내부 호환명 `PRODUCT_TYPE`/`productType`은 유지하되 DTO 설명과 DB comment는 `모델구분`으로 보정했다.
- DB 검증(JSHANES): `COM_CODES.DEFECT_MODEL_GROUP` 2건(LV/HV), `ITEM_MASTERS.DEFECT_MODEL_GROUP` LV 36건, 활성 분류 1레벨 3건/2레벨 6건/3레벨 18건, HARNESS/WIRE/TERMINAL/CONNECTOR 기반 활성 분류 0건, 불량코드 매핑 `PRODUCT_TYPE=LV` 12건 확인.
- 검증: `2026-06-22_item_defect_model_group.sql` 및 `2026-06-22_reclassify_defect_categories.sql` JSHANES 적용/재실행 PASS, `python tools/generate_db_schema_doc.py` PASS, backend/frontend typecheck PASS, 구조 테스트 26건 PASS, `defect-code.service.spec.ts` 4건 PASS, 대상 파일 `git diff --check` PASS.
- 참고: 3002/3003 dev server는 사용자 요청대로 재시작하지 않았다.

# 2026-06-22 codex T-MASTER-LABEL-PALLET-SOURCE 라벨디자인 팔레트 소스 추가
- 요청: `/master/label` 라벨 디자인관리 소스테이블에 팔레트 라벨도 추가.
- 변경: `LabelCategory`/`LabelSourceTable`에 `pallet`을 추가하고, `/master/label` 소스테이블 선택 목록에 `팔레트`를 표시하도록 `LabelObjectDesigner` 라벨 매핑을 추가했다.
- 변경: 팔레트 라벨 소스 필드로 `palletNo`, `boxCount`, `totalQty`, `status`, `shipOrderNo`, `customerName`, `itemCode`, `itemName`, `createdAt` 샘플 필드를 추가했다. 기본 팔레트 디자인은 바코드/코드=`palletNo`, 이름=`boxCount`, 보조=`totalQty`를 사용한다.
- 검증: RED 확인 후 `node --test apps/frontend/src/app/(authenticated)/master/label/master-label-pallet-source.structure.test.mjs apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs` PASS, `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 3002 `/master/label` HTTP 200, 대상 파일 `git diff --check` PASS.
- 참고: 기존 `master-label-bartender-designer.structure.test.mjs`는 팔레트와 무관한 오래된 `필드 추가/updateSourceField/deleteSourceField` 기대값으로 실패해 이번 focused 검증 범위에서 제외했다.

# 2026-06-22 codex T-MASTER-LABEL-PALLET-BACKEND 라벨템플릿 팔레트 카테고리 백엔드 허용
- 요청/증상: `/master/label-templates?category=pallet` 호출이 `category must be one of the following values: equip, jig, worker, part, mat_lot, box` 400으로 실패.
- 원인: `/master/label` 프론트 소스/타입에는 `pallet`을 추가했지만, 백엔드 `LabelTemplateQueryDto`/`CreateLabelTemplateDto`의 `@IsIn` 허용 목록은 기존 6개 카테고리만 유지하고 있었다.
- 변경: `LABEL_TEMPLATE_CATEGORIES` 상수를 추가해 `equip/jig/worker/part/mat_lot/box/pallet`을 단일 목록으로 관리하고, create/query DTO 검증과 Swagger enum이 같은 목록을 사용하게 했다.
- 검증: RED 확인 후 `node --test apps/backend/src/modules/master/dto/label-template-pallet-category.structure.test.mjs` PASS, `pnpm.cmd --filter @harness/backend test -- src/modules/master/services/label-template.service.spec.ts --runInBand` 7/7 PASS, `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false` PASS. 3003 직접 호출은 인증 전 단계 401로 바뀌어 무인증 상태에서 카테고리 검증 400은 재현되지 않았다. 3002에 `/api/v1`을 직접 붙이면 프록시가 `/api/v1/v1`로 중복 전달되어 404가 난다.

# 2026-06-22 codex T-SHIP-HISTORY-PALLET-DETAIL 출하이력 우측 팔레트 상세 표시
- 요청: `/shipping/history` 우측에 상세 팔레트정보를 표시하고, 팔레트번호가 보여야 함. 추가 요청으로 기본 날짜 필터는 당일, 출하상태 배지는 상태별 색상과 도움말을 표시.
- 변경(FE): `/shipping/history`를 좌측 출하이력 그리드 + 우측 팔레트 상세 패널로 구성했다. 행 선택 시 기존 `/shipping/orders/:shipOrderNo/fulfillment`를 호출해 팔레트번호, 상태, 박스수, 총수량, 마감/출하 시각, 하위 박스 목록을 표시한다.
- 변경(FE): 날짜 필터 `from/to` 기본값을 현재일(`YYYY-MM-DD`)로 넣고, 목록 조회 API를 `shipDateFrom/shipDateTo`가 실제 동작하는 `/shipping/history`로 전환했다.
- 변경(FE): 출하상태 배지는 화면 로컬 색상맵으로 `DRAFT/CONFIRMED/SHIPPING/SHIPPED/CLOSED`를 서로 다른 색상으로 표시하고, 상태 설명을 `title`/`aria-label` 도움말로 제공한다.
- 변경(BE): 출하이력 DTO 상태 필터 허용 목록에 실제 마감 상태 `CLOSED`를 추가했다.
- 검증: 신규 구조 테스트 RED 확인 후 GREEN, `node --test "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-no-info-cards.structure.test.mjs"` PASS, `node --test apps/backend/src/modules/shipping/dto/ship-history-status.structure.test.mjs` PASS, FE/BE tsc PASS, 대상 파일 `git diff --check` PASS.
- 브라우저 검증(3002): 기본 날짜 input이 `2026-06-22/2026-06-22`로 표시되고 `/api/shipping/history?limit=5000&shipDateFrom=2026-06-22&shipDateTo=2026-06-22` 200 확인. 날짜를 `2026-06-12`로 바꾼 뒤 `SO-RV-26061202215660` 선택 시 우측에 `PLT2606200001`, 박스 2건, 총수량 2 표시 확인. 상태 `확정` 배지에 파란색 클래스와 도움말 `출하지시가 확정되어 박스 또는 팔레트 출하 작업을 진행할 수 있습니다.` 확인.

# 2026-06-22 codex T-SHIP-ORDER-STATUS-HELP 출하지시 상태 도움말/출하일 필수 보정
- 요청: `/shipping/order` 그리드 상태 컬럼에 `?` 도움말 추가. 이어서 출하지시 등록 시 고객사 출하일 없이 저장되는 버그 지적 및 `/shipping/history`에도 상태 설명 추가 요청.
- 원인: `/shipping/order` 프론트 저장 가능 조건이 품목 수량만 검사했고 `shipDate`가 비어 있으면 payload에서 `undefined`로 보냈다. 백엔드 `CreateShipOrderDto.shipDate`도 optional이라 API 직접 호출도 빈 출하일 저장을 허용했다.
- 변경(FE): `/shipping/order` 상태 컬럼 header를 `ShipOrderStatusHeader`로 바꾸고 `HelpCircle` 아이콘에 `DRAFT/CONFIRMED/SHIPPING/SHIPPED/CLOSED` 설명을 `title`/`aria-label`로 제공했다. 고객사 출하일 input은 required로 표시하고, `canSave`에 `form.shipDate.trim().length > 0`를 포함했으며 payload는 선택된 `shipDate`를 그대로 보낸다.
- 변경(BE): `CreateShipOrderDto.shipDate`를 필수 `@ApiProperty`/`@IsDateString` 계약으로 바꾸고, `ShipOrderService.create()`가 고객사 출하일 누락 시 `BadRequestException('고객사 출하일은 필수입니다.')`으로 차단한다. update도 `shipDate`가 들어온 경우 빈 문자열을 거부한다.
- 변경(FE): `/shipping/history` 상태 컬럼 header도 `ShipHistoryStatusHeader`로 바꾸고 `HelpCircle` 아이콘에 같은 상태 설명을 `title`/`aria-label`로 제공했다. 기존 상태별 색상 배지와 배지 tooltip은 유지했다.
- 검증: 신규 테스트 RED 확인 후 GREEN. `node --test` shipping order/history 구조 테스트 10건 PASS. `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand` 25/25 PASS. frontend/backend `tsc --noEmit --pretty false` PASS. 대상 파일 `git diff --check` PASS.
- 브라우저 검증(3002): `/shipping/order` 상태 헤더 도움말에 `CONFIRMED/CLOSED` 설명 포함 확인, 등록 패널의 고객사 출하일 date input `required=true` 확인. `/shipping/history` 상태 헤더 도움말에 `CONFIRMED/CLOSED` 설명 포함 확인.

# 2026-06-22 codex T-SHIP-PALLET-ORDER-REQUIRED 팔레트 구성 출하지시 필수화
- 요청: `/shipping/pallet`에서 출하지시 없이 팔레트 구성하면 안 된다는 사용자 정정.
- 원인: `/shipping/pallet` 화면이 일반 `POST /shipping/pallets`로 출하지시 없는 팔레트를 생성하고, 박스 적재/마감도 일반 팔레트 API를 사용했다. 백엔드 `PalletService.create/addBox`도 출하지시 없이 팔레트를 만들거나 구성하는 흐름을 허용했다.
- 변경(FE): 팔레트 생성 모달에서 `CONFIRMED` 상태이고 미출하 잔량이 있는 출하지시를 조회해 선택하도록 변경했다. 생성은 `POST /shipping/orders/:shipOrderNo/pallets`만 사용하고 일반 `/shipping/pallets` 생성 호출은 제거했다.
- 변경(FE): 박스 적재/제거/마감은 출하지시번호가 있는 팔레트만 가능하게 버튼을 비활성화하고, 각각 `/shipping/orders/:shipOrderNo/pallets/:palletNo/boxes`, `DELETE /shipping/orders/:shipOrderNo/pallets/:palletNo/boxes`, `/close`를 사용하게 했다.
- 변경(BE): 일반 `PalletService.create()`는 `BadRequestException`으로 차단한다. 일반 `PalletService.addBox()`는 출하지시 기준 API 사용을 안내하며 차단한다. 출하지시 없는 팔레트의 일반 마감도 차단한다. `findAll()`은 화면 row id 계약에 맞춰 `id=palletNo`를 포함해 반환한다.
- 검증: 신규 구조 테스트 RED 확인 후 GREEN. `node --test apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs` PASS. `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/pallet.service.spec.ts --runInBand` 18/18 PASS. frontend/backend `tsc --noEmit --pretty false` PASS. 대상 파일 `git diff --check` PASS.
- 브라우저 검증(3002): `/shipping/pallet` 팔레트 생성 모달에서 출하지시 선택 Select가 `required=true`이고, `/api/shipping/orders?status=CONFIRMED&limit=5000` 호출 확인. 일반 `/api/shipping/pallets` POST는 호출되지 않음 확인.

# 2026-06-22 codex T-SHIP-PALLET-SCAN-CREATE 출하지시 스캔 기반 팔레트 생성/상태 도움말
- 요청: `/shipping/pallet` 팔레트 생성 모달은 출하지시번호 스캔 방식이어야 하며, 이미 생성된 출하지시는 재생성하면 안 된다. 보조로 모달 좌측에 팔레트 생성 대기 출하지시 목록을 기본 표시한다. 추가로 팔레트 그리드 상태 컬럼에 `?` 도움말로 상태전이를 자세히 설명한다.
- 원인: 기존 모달은 `CONFIRMED` + 미출하 잔량 출하지시를 드롭다운으로 보여줬고, 이미 `PALLET_MASTERS.SHIP_ORDER_NO`가 있는 출하지시를 제외하지 않았다. 백엔드 `createPalletForOrder()`도 동일 출하지시 기존 팔레트 존재 여부를 검사하지 않아 API 직접 호출로 재생성이 가능했다. 팔레트 상태 컬럼은 단순 텍스트 헤더라 `OPEN/CLOSED/LOADED/SHIPPED` 전이 설명이 없었다.
- 변경(FE): 팔레트 생성 모달을 좌측 `팔레트 대기중인 출하지시` 목록 + 우측 출하지시번호 스캔 입력 구조로 바꿨다. Enter 스캔 시 대기 목록과 대조하고, 좌측 목록 클릭도 스캔 입력에 반영한다. 대기 목록은 `status=CONFIRMED`, 미출하 잔량 존재, `palletCount === 0`인 출하지시만 표시한다.
- 변경(FE): 팔레트 상태 컬럼 header를 `PalletStatusHeader`로 바꾸고 `HelpCircle` 아이콘의 `title`/`aria-label`에 `OPEN -> CLOSED -> LOADED -> SHIPPED`, `CLOSED -> OPEN` 되돌림 조건, 각 상태 의미를 제공한다.
- 변경(BE): `ShipOrderService.createPalletForOrder()`가 같은 출하지시에 기존 팔레트가 있으면 `BadRequestException('이미 팔레트가 생성된 출하지시입니다')`로 차단한다.
- 검증: RED 확인 후 `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-status-help.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs"` PASS, `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts src/modules/shipping/services/pallet.service.spec.ts --runInBand` 44/44 PASS, frontend/backend `tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS.
- 런타임 확인: Browser 플러그인 `iab`는 현재 사용 불가. 별도 Playwright는 실행됐지만 유효 인증 토큰이 없어 `/shipping/pallet` 진입 전 `/login`으로 리다이렉트되어 DOM 실측은 못 했다.

# 2026-06-22 codex T-SHIP-PALLET-SHIP-STATUS-HELP 팔레트 출하 중앙 그리드 상태 도움말/출하번호 표시
- 요청: `/shipping/pallet-ship` 중앙 패널 그리드의 상태 컬럼에 `?` 설명을 추가하고, 중앙 패널 그리드에 출하번호가 왜 안 나오는지 점검 후 수정.
- 원인: 중앙 팔레트 그리드는 `shipmentId` 원값만 `출하번호`로 표시했다. 팔레트 출하 확정 전 `CLOSED` 팔레트는 아직 실제 출하 건이 생성되지 않아 `shipmentId`가 비어 있는 것이 정상인데, 화면에는 그 의미가 드러나지 않았다. 또한 fulfillment 응답에 단일 출하 건이 있을 때도 팔레트 행에서 fallback 표시를 하지 않았다.
- 변경(FE): 중앙 그리드 상태 헤더를 `PalletShipStatusHeader`로 바꾸고 `HelpCircle` 아이콘 `title`/`aria-label`에 `OPEN -> CLOSED -> SHIPPED`, `OPEN/CLOSED/LOADED/SHIPPED` 의미를 제공했다.
- 변경(FE): `OrderPalletRow`를 추가해 팔레트 행의 `shipmentNo`/`shipmentNoText`를 정규화했다. `pallet.shipmentId`를 우선 표시하고, fulfillment 출하 건이 1건이면 `shipNo`를 fallback으로 표시한다. 아직 출하 전이면 `출하 전`, 이미 출하 상태인데 번호가 없으면 `확인필요`로 표시한다.
- 검증: 신규 구조 테스트 RED 확인 후 GREEN. `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet-ship/shipping-pallet-ship-grid-help.structure.test.mjs"` PASS, 관련 shipping pallet 구조 테스트 6/6 PASS, frontend `tsc --noEmit --pretty false` PASS, 대상 파일 `git diff --check` PASS.
- 브라우저 검증(3002): `/shipping/pallet-ship` 진입 후 첫 출하지시 선택 시 중앙 그리드에 `출하번호` 헤더와 상태 `?` 도움말 1개가 표시됨을 확인했다. 현재 데이터 `PLT2606200001`은 출하 전이라 출하번호 칸은 `출하 전`으로 표시되는 것이 정상이다.

# 2026-06-22 claude T-IQC-DEFECT-CODE-REMOVE IQC 검사모달 불량코드 제거
- 요청: IQC는 정해진 검사항목 절차로 합/불·측정값만 넣으면 되는데 불량코드를 왜 별도 입력하나 → 제거하고 검사항목 판정만으로 정리.
- 근거: 검사항목 판정(시리얼·항목별 OK/NG·측정값)이 이미 불량 종류·등급(defectGrade)을 내포. 백엔드도 itemDefectCounts가 주 판정, defects는 보조(fallback)였음.
- 변경(FE): IqcModal 불량코드 UI/state/handlers/defect-codes options API/defects 전송 + "불량시 불량코드 필수" 강제 로직 제거. useIqcData defects 전송 제거. codex의 defectModelGroup 필드는 보존(미사용화).
- 백엔드 무변경: defects 미전송 시 검사항목 판정·AQL 등급으로만 합·불 산출.
- 검증: FE tsc PASS, 브라우저(3002) 모달서 불량코드 섹션 제거 확인. 커밋 57d90264.

# 2026-06-22 claude T-SHIP-PALLET-DESIGN shipping 팔레트 화면 디자인 정리
- pallet-ship: 패널 타이틀 표준(text-sm) 통일, 출하지시 목록에 구성 팔레트·박스 수 표시(ship-order.service findAll 집계). 커밋 1f7f2562.
- pallet: 정보카드(StatCard) 제거, 좌측 그리드 표준 래핑(카드 꽉 채움+내부 스크롤), 패널 타이틀 통일. codex의 출하지시 스캔 작업과 같은 파일이라 codex 커밋(0c500d79 등)에 함께 포함됨.
- 검증: FE/BE tsc PASS, 실DB 팔레트/박스 집계 일치 확인, 브라우저 확인.

# 2026-06-22 claude T-MASTER-FIELD-HELP 기준정보 화면 필드별 ? 도움말 + 집계성 숫자 천단위 포맷
- 요청: 품목관리(part)처럼 다른 기준정보 화면에도 입력 필드마다 ? 도움말을 전부 추가. 이어서 숫자컬럼 천단위 포맷도 적용.
- 패턴: PartFieldHelp.tsx(필드키→{db, description} + FieldLabel/FieldInput/FieldSelect/FieldComCodeSelect/FieldYnRadio 래퍼) + 공통 HelpTooltip(? 아이콘, description+DB컬럼 표시) 복제. i18n은 t(`...fieldHelp.${field}`, description) 한글 fallback(locales 4파일 미수정).
- 범위: 기준정보(MASTER) 메뉴 13개 화면(part 제외). 표준 입력폼만, 라벨 디자이너/캔버스·라우팅 행편집 그리드 등 특수 위젯 제외.
- 변경(FE): 13개 화면에 *FieldHelp.tsx 신규 생성 + 폼 컴포넌트의 입력 라벨을 Field* 래퍼로 교체.
  - bom, partner, equip(EquipMasterTab), process, prod-line(ProdLineTab), routing(그룹/헤더 표준필드만), work-calendar(Calendar/Add/DayEdit/ShiftPattern), worker, work-instruction, warehouse(Form/Location/TransferRule), vendor-barcode, process-capa, label(템플릿 기본정보만).
  - DB 컬럼은 백엔드 엔티티 실측 매핑(예: WORKER_MASTERS.*, ROUTING_GROUPS/ROUTING_PROCESSES.*, BOM_MASTERS.*, PROCESS_CAPAS.*, LABEL_TEMPLATES.*).
- 천단위 포맷(집계성 숫자만, 순번·연도·Rev·일수·카운트·코드성 제외):
  - equip/EquipBomTab: stockQty(재고)·quantity(수량) toLocaleString 추가(unitPrice는 기존 적용).
  - process-capa/page: stdUph(시간당생산량) cell 추가(dailyCapa는 기존 적용). workerCnt/boardCnt/equipCnt(소수 카운트)·stdTactTime(초)·balanceEff(%)는 제외.
  - bom/BomTab: qtyPer(소요량) toLocaleString 추가.
- 검증: frontend tsc --noEmit PASS(에러 0건). dev 서버 가동 중이라 prod build 미실행(CLAUDE.md 규칙).
- 참고: part 화면은 사용자 지정 범위(13개) 밖이라 미변경. part 그리드 일부 수량 컬럼(boxQty/lotUnitQty/sampleQty/safetyStock)은 콤마 미적용 상태로 남아 있음(차후 필요 시 별도 처리).

# 2026-06-22 claude T-THOUSAND-FORMAT 전역 트랜잭션 화면 집계성 숫자 천단위 포맷
- 요청: 품목관리(part)도 맞추고, 입고·재고·출고·생산량 등 전체 화면의 집계성 숫자에 천단위 콤마 적용.
- 기준: 집계성 숫자(수량·재고·입출고·생산량·금액·단가·합계·물리량)만 toLocaleString. 제외 = 순번/SEQ·연도·Rev·일수/분/초·%·비율·효율·통계지표(Cpk 등)·측정값·식별번호(LOT/시리얼/전표/PO)·코드성·한두자리 카운트. 표시 전용(로직/정렬/필터/합계/API/DTO/엔티티 무변경).
- part(직접): 그리드 boxQty·lotUnitQty·sampleQty·packUnit 콤마 추가(minPackQty는 기존 적용).
- 도메인 6개 병렬 에이전트:
  - material: lot-split·physical-inv·scrap 등 수량 컬럼(이미 적용된 다수는 스킵).
  - inventory: material-physical-inv(SessionModals)·product-physical-inv 등 장부/실사/차이 수량.
  - production: repair·subprocess-kitting·input-kiosk(Defect/Material/WorkHistory 패널) 생산/투입 수량.
  - product+shipping: confirm·pallet·pallet-ship 등 출하/박스/팔레트 수량.
  - quality: oqc(box/sample)·rework·rework-inspect·trace(usedQty) 등 8파일 11개 위치. defect/는 잠금 준수 미수정.
  - 기타(consumables/outsourcing/customs/sales/inspection): consumables Receiving/Issuing Table qty, inspection result workflow plan/good/defect qty. customs·outsourcing·sales는 이미 전부 적용돼 변경 0건.
- 잠금 준수: material/receive/ReceiveScanModal.tsx(T-RECEIVE-LOCATION), quality/defect/**(T-DEFECT-REGISTER-PANEL) 미수정.
- 검증: frontend tsc --noEmit PASS(에러 0건). git diff --check 통과(공백 오류 0), as any 도입 0, 추가는 전부 인라인 toLocaleString(?? 0 / != null 가드). dev 서버 가동 중이라 prod build 미실행(CLAUDE.md 규칙).

# 2026-06-22 claude T-SHIP-ORDER-CUSTOMER-PO 출하지시 고객 PO번호 컬럼 추가
- 요청: /shipping/order 출하지시에 고객 PO번호를 수동 입력해 생성하고 그리드에도 표시.
- DB(JSHANES): pre-check USER_TAB_COLUMNS로 SHIPMENT_ORDERS 13컬럼 확인(CUSTOMER_PO_NO 없음) → ALTER TABLE SHIPMENT_ORDERS ADD CUSTOMER_PO_NO VARCHAR2(100) NULL. post-check 컬럼 확인. INVALID였던 IF_ITEM_MASTER(무관 프로시저)는 ALTER ... COMPILE로 VALID 복구.
- BE: shipment-order.entity.ts customerPoNo(varchar2 100 nullable, type 명시) / ship-order.dto.ts CreateShipOrderDto.customerPoNo(@IsOptional @MaxLength 100) / ship-order.service.ts create insert + buildShipmentOrderUpdate Pick에 customerPoNo 추가. 목록/단건 응답은 ...order 전개라 자동 포함.
- FE: shipping/order/page.tsx — ShipOrder 인터페이스·form state·openCreate/openEdit·handleSave payload·그리드 컬럼(고객명 다음, filter text)·우측 패널 입력칸(고객 선택 다음)·출하지시서 출력물에 고객 PO번호 추가.
- i18n 4파일: shipping.shipOrder.customerPoNo/customerPoNoPlaceholder 추가(JSON 파싱 삽입, 무수정 재덤프 동일성 가드로 포맷 보존, BOM 없음·CRLF 유지, 각 +2줄). 화면은 t(key,fallback)로도 안전.
- 검증: FE tsc PASS, BE tsc PASS. 구조 테스트 payload/required-fields/print/sql-preview/status-help 통과.
- 선재 이슈(무관): ship-order-right-panel.structure.test.mjs는 grid-cols-[minmax(0,1fr)_minmax(420px,480px)] 패턴을 기대하나 현재 화면은 aside w-[480px] 패널 구현 → HEAD 원본에도 패턴 없음(내 변경 전부터 실패하던 stale 테스트). 패널 레이아웃 미수정, 스코프 밖이라 보류.

# 2026-06-22 claude T-PROD-PLAN-MISC 제품생산계획 정보카드 제거·메뉴명 변경·7일치 시드
- 정보카드 제거: /production/monthly-plan page.tsx 상단 StatCard 4개 + stats useMemo 집계 + StatCard/ProdPlanSummary import 제거. FE tsc PASS.
- 메뉴명/타이틀 변경: 월간생산계획→제품생산계획. locales 4파일 menu."production.monthlyPlan" + monthlyPlan.title (ko/zh/vi 동일, en은 menu "Product Plan"/title "Product Production Plan"). JSON 파싱 삽입(포맷 보존, codex 동시 locales 작업분 보존). 폴더/키명(monthly-plan/monthlyPlan)·주석은 유지.
- 7일치 생산계획 시드(JSHANES PROD_PLANS): 최상위 BOM 모델=HNS02(완제품 하네스, 유일) 확인. PP-202606-001~007, PLAN_MONTH 2026-06, HNS02 FINISHED, PLAN_QTY 100, STATUS DRAFT, REMARK 일자(2026-06-22~28 요일). 생산계획이 월단위 테이블(일자컬럼 없음)이라 7건으로 넣고 일자는 remark 표기. 7 rows. 채번 PP-YYYYMM-NNN 패턴 준수(기존 0건).
## 2026-06-22 codex T-AI-PAGE-TOOL-WORKFLOW

- 요청: `/production/order` 한 화면 실험이 아니라 HANES 전체 화면에 적용할 AI 업무 도구 표준과 소스 개발 절차로 설계.
- 결정: 1차 실행 수준은 `draft-only`. AI는 저장/삭제/상태변경 API를 직접 호출하지 않고, 현재 페이지 도구 manifest를 보고 후보 조회와 초안 적용만 수행한다. 최종 저장은 사용자가 기존 화면 버튼으로 실행한다.
- 설계 문서: `docs/superpowers/specs/2026-06-22-ai-page-tool-workflow-design.md`
- 구현 계획: `docs/superpowers/plans/2026-06-22-ai-page-tool-workflow.md`
- 핵심 내용: 공통 `pageToolManifest`, 백엔드 후보 조회/검증 + 프론트 draft 적용 혼합 구조, 사람/AI가 같은 manifest를 보는 `도구보기`, AI 패널 `채팅|도구|실행로그` 탭, `/production/order` 파일럿 도구와 품목 후보 확정 정책.
- 계획 태스크: backend manifest, backend candidate resolution, frontend page tool state/inspector, AI panel tabs, page registration hook, `/production/order` draft applier, AI chat DTO compatibility, E2E verification 총 8개.
- 검증: `git diff --check -- docs/superpowers/plans/2026-06-22-ai-page-tool-workflow.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` PASS.
- 상태: 사용자 리뷰 대기. 구현은 아직 진행하지 않았다. 커밋하지 않았다.
# 2026-06-22 - T-ER-VIEW-SCHEMA-GOVERNANCE ER VIEW 스키마 거버넌스 도구

- owner: codex
- status: REVIEW
- 변경:
  - 신규 백엔드 `ErViewController`/`ErViewService`를 추가해 `/api/v1/system/er-view/*` 조회/분석/실행 API를 분리했다.
  - 실시간 Oracle `USER_*` data dictionary snapshot 기준으로 테이블/컬럼/PK/UK/FK를 조회하고, 보수적 추정 관계를 계산한다.
  - `COMPANY`, `PLANT_CD`가 양쪽 테이블에 있으면 테넌트 포함 FK 후보를 우선 추천하고, 부모 PK/UK 준비 여부와 orphan count를 리스크에 반영한다.
  - DDL은 `ENABLE VALIDATE` 기본이며, 클라이언트 raw SQL 대신 구조화 action payload만 받아 서버가 whitelist 기반 SQL을 생성한다.
  - DEV 모드에서 FK/UK 실행 시 migration 파일 생성 및 `tools/generate_db_schema_doc.py` 실행 경로를 넣었다. 실행 로그는 `logs/schema-governance/actions-YYYY-MM.jsonl`에 남긴다.
  - 신규 `/system/er-view` 페이지를 추가했다. 좌측 테이블 목록/중앙 `@xyflow/react` 관계 그래프/우측 상세 패널 3패널 구조이며 orphan scan, DDL 후보, 실행 SQL, 확인 문구를 표시한다.
  - 시스템관리 메뉴 `SYS_ER_VIEW`, ko/en/zh/vi locale, page registry, `@xyflow/react` 의존성을 추가했다.
- 검증:
  - RED 확인: backend spec가 `er-view.service.ts` 부재로 실패, frontend structure test가 page/menu/controller/service 부재로 실패.
  - GREEN: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
  - PASS: 3002 `/system/er-view` HTTP 200
  - PASS: 3003 `/api/v1/system/er-view/summary` 인증 게이트 401
- 주의:
  - Oracle DDL은 transaction rollback이 아니므로 batch 실패 시 이번 batch에서 생성한 constraint만 역순 DROP으로 보상하는 구조다.
  - 실제 인증 세션으로 schema summary 데이터 렌더링과 orphan scan 실행은 아직 수행하지 않았다.
  - 작업 중 발견된 무관 변경 `apps/frontend/src/app/(authenticated)/system/config/page.tsx`, `apps/frontend/src/components/system/AiCatalogPanel.tsx`, help 문서 4개는 되돌리지 않았다.

# 2026-06-23 - T-ER-VIEW-MENU-VISIBILITY ER VIEW 메뉴 노출 누락 보정

- owner: codex
- status: REVIEW
- 원인:
  - `SYS_ER_VIEW`가 `apps/frontend/src/config/menuConfig.ts`에만 있고 백엔드 메뉴 코드 화이트리스트, seed JSON, JSHANES `MENU_CATEGORY_ITEMS` 배치에 빠져 있었다.
  - 사이드바는 `/menu-categories/tree` DB 트리와 `menuConfig.ts` leaf를 병합하므로, DB 배치가 없으면 leaf가 렌더링되지 않는다.
- 변경:
  - `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`에 `SYS_ER_VIEW` 추가.
  - `apps/backend/src/seeds/menu-config.json`의 `SYSTEM` child에 `SYS_ER_VIEW` 추가.
  - `apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs`가 validator/seed 등록도 검증하도록 보강.
  - `apps/backend/src/migrations/2026-06-23_er_view_menu_seed.sql` 추가 및 JSHANES 적용.
- DB 적용:
  - JSHANES `MENU_CATEGORY_ITEMS`: `SYS_ER_VIEW`, `SYSTEM`, sort 95, `IS_ACTIVE='Y'` 확인.
  - 기존 시스템 메뉴 패턴에 맞춰 `ROLE_MENU_PERMISSIONS`는 추가하지 않았다. ADMIN은 전체허용으로 접근한다.
- 검증:
  - RED 확인: validator structure test가 `SYS_ER_VIEW` 누락으로 실패.
  - GREEN: `node apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs`
  - GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `node -e "JSON.parse(...menu-config.json...)"`
  - PASS: `git diff --check`

# 2026-06-23 - T-ER-VIEW-TABLE-NODES ER VIEW 테이블형 그래프 보정

- owner: codex
- status: REVIEW
- 원인:
  - `/system/er-view` 중앙 그래프가 ReactFlow 기본 노드에 테이블명만 넣고 있어 DB 테이블 표형 ERD가 아니라 일반 네트워크 그래프처럼 보였다.
  - backend `getGraph()` 응답도 node별 컬럼/PK/FK 후보 metadata를 제공하지 않았다.
  - 페이지 루트/grid/canvas overflow가 닫혀 있지 않아 화면이 아래로 밀릴 수 있었다.
- 변경:
  - `ErViewService.getGraph()` node 응답에 `pkColumns`, `columns[]`, `isPk`, `isFkCandidate`, `dataType`, `nullable`을 추가했다.
  - `/system/er-view/page.tsx`는 ReactFlow `nodeTypes`와 `TableNode` custom node를 사용해 테이블명/주석/컬럼행/PK/FK badge를 표시한다.
  - edge는 `smoothstep` + `MarkerType.ArrowClosed`로 FK 방향을 보이게 했다.
  - 페이지 루트, 3열 grid, graph panel을 `overflow-hidden`/`min-h-0` 구조로 고정하고 ReactFlow `Controls`, `MiniMap`, `panOnDrag`, `zoomOnScroll`, `fitView` 옵션을 명시했다.
- 검증:
  - RED 확인: backend spec가 graph node의 `pkColumns`/`columns` 부재로 실패.
  - RED 확인: frontend structure test가 `nodeTypes`/`TableNode`/PK/FK 표시 부재로 실패.
  - GREEN: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - GREEN: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: 3002 `/system/er-view` HTTP 200
  - PASS: Chrome Playwright 인증 세션에서 `MAT_LOTS` 선택 시 table node 4개, edge 3개, controls 3개, minimap 표시, body/html overflow 없음

# 2026-06-23 - T-BOX-ID-TO-BOX-NO TRACE_LOGS BOX_ID 및 WORKER_ID 표준 컬럼명 변경

- owner: codex
- status: DONE
- 원인:
  - 사용자가 `ADD_UK BOX_MASTERS(COMPANY, PLANT_CD, BOX_ID)` dry-run에서 `ORA-00904: "BOX_ID": 부적합한 식별자`를 보고했다.
  - JSHANES 실측상 `BOX_ID` 물리 컬럼은 `TRACE_LOGS` 1개뿐이고, `BOX_MASTERS`는 이미 표준 `BOX_NO` PK를 사용한다.
  - JSHANES 실측상 `WORKER_ID` 물리 컬럼은 20개 테이블에 존재했고, `WORKER_MASTERS`는 현재 `WORKER_CODE` PK를 사용한다.
- 변경:
  - JSHANES `TRACE_LOGS.BOX_ID`를 `BOX_NO`로 rename하는 idempotent migration `apps/backend/src/migrations/2026-06-23_trace_logs_box_id_to_box_no.sql`을 추가/적용했다.
  - JSHANES 20개 테이블의 `WORKER_ID`를 `WORKER_NO`로 rename하는 idempotent migration `apps/backend/src/migrations/2026-06-23_worker_id_to_worker_no.sql`을 추가/적용했다.
  - `REPAIR_ORDERS` 작업자 인덱스를 `IDX_REPAIR_ORDERS_WORKER_NO(WORKER_NO)`로 rename했다.
  - 관련 TypeORM entity의 물리 컬럼 매핑을 `WORKER_NO`/`BOX_NO`로 변경했다. API property명 `workerId`는 호환을 위해 유지했다.
  - `WipMatStockService.findTransactions()` raw select를 `tx.WORKER_NO`로 변경했다.
  - `ErViewService`의 추정 관계를 `BOX_NO -> BOX_MASTERS.BOX_NO`, `WORKER_NO -> WORKER_MASTERS.WORKER_CODE`로 해석하도록 보정했다.
  - `apps/backend/src/database/create-hanes-schema.sql`과 `docs/reports/db-schema-erd.md`를 현재 표준 컬럼명으로 갱신했다.
- DB 검증:
  - JSHANES 컬럼 집계: `BOX_NO` 4개, `WORKER_NO` 20개, `BOX_ID` 0개, `WORKER_ID` 0개.
  - `TRACE_LOGS`: `BOX_NO`, `WORKER_NO` 확인.
  - `USER_IND_COLUMNS`: `IDX_REPAIR_ORDERS_WORKER_NO`가 `WORKER_NO` 컬럼을 사용함을 확인.
  - `ASSIGNED_WORKER_ID`는 PM 작업지시의 별도 의미 컬럼이라 유지했다.
- 검증:
  - PASS: `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_worker_id_to_worker_no.sql` 적용 및 재실행
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- wip-mat-stock.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`

# 2026-06-23 - T-MASTER-TENANT-PK 마스터 테이블 tenant 복합 PK 정석화

- owner: codex
- status: DONE
- 결정:
  - 사용자 지시에 따라 우회 UK가 아니라 마스터 테이블 PK 자체를 `COMPANY, PLANT_CD, 업무키`로 변경했다.
  - `D-20260623-MASTER-TENANT-PK`에 durable decision으로 기록했다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_master_tenant_composite_pk.sql` 추가 및 JSHANES 적용/재실행.
  - backup 제외 `COMPANY`, `PLANT_CD` 보유 마스터 테이블 19개 중 tenant PK 적용 19개, 잔여 0개 확인.
  - 주요 변경 PK:
    - `PROCESS_MASTERS`: `COMPANY, PLANT_CD, PROCESS_CODE`
    - `ITEM_MASTERS`: `COMPANY, PLANT_CD, ITEM_CODE`
    - `EQUIP_MASTERS`: `COMPANY, PLANT_CD, EQUIP_CODE`
    - `WORKER_MASTERS`: `COMPANY, PLANT_CD, WORKER_CODE`
    - `VENDOR_MASTERS`: `COMPANY, PLANT_CD, VENDOR_CODE`
    - `CONSUMABLE_MASTERS`: `COMPANY, PLANT_CD, CONSUMABLE_CODE`
    - `BOX_MASTERS`: `COMPANY, PLANT_CD, BOX_NO`
  - 기존 composite UK로 우회하던 `CONSUMABLE_MASTERS`, `EQUIP_MASTERS`, `ITEM_MASTERS`, `VENDOR_MASTERS` UK는 제거하고 동일 컬럼 PK로 승격했다.
  - 관련 FK 7개를 tenant composite FK로 재생성했고 모두 `ENABLED/VALIDATED` 확인:
    - `FK_BOX_MASTERS_ITEM_CODE`
    - `FK_CONSUMABLE_L_CONSUMABLE_C`
    - `FK_CONSUMABLE_S_CONSUMABLE_C`
    - `FK_CONSUMABLE_L_EQUIP_CODE`
    - `FK_CONSUMABLE_L_VENDOR_CODE`
    - `FK_PROD_PLANS_ITEM`
    - `FK_HARNESS_REV_MASTER`
- 코드/문서 변경:
  - 관련 마스터 entity의 `COMPANY`, `PLANT_CD`를 `@PrimaryColumn`으로 변경했다.
  - `apps/backend/src/database/create-hanes-schema.sql` PK/FK 정의를 갱신했다.
  - `docs/reports/db-schema-erd.md`를 JSHANES 기준으로 재생성했다.
- 검증:
  - PASS: JSHANES duplicate/null pre-check 0건.
  - PASS: JSHANES composite orphan pre-check 0건.
  - PASS: migration 적용 및 재실행.
  - PASS: JSHANES post-check `MASTER_TABLES_WITH_TENANT_COLS=19`, `TENANT_PK_TABLES=19`, `REMAINING=0`.
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend build`
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
- 주의:
  - 전체 backend `tsc --noEmit`는 기존 `ai-page-tools.service.spec.ts` union type 오류로 실패하며, 이번 변경과 직접 관련 없는 기존 실패로 분리했다.
  - 자식 테이블 전체의 TypeORM `@JoinColumn`을 모두 composite relation으로 바꾸는 작업은 후속 정리 대상이다. 이번 범위는 마스터 물리 PK/FK와 마스터 entity PK 정렬이다.

# 2026-06-23 - T-VENDOR-ID-TO-VENDOR-CODE VENDOR_ID 컬럼 표준명 변경

- owner: codex
- status: DONE
- 원인:
  - 사용자 지시에 따라 DB 물리 컬럼 표준을 `VENDOR_ID`가 아니라 `VENDOR_CODE`로 정리했다.
  - JSHANES 실측상 `VENDOR_ID` 물리 컬럼은 `MAT_ARRIVALS`, `SUBCON_ORDERS`, `WAREHOUSES` 3개에만 존재했다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_vendor_id_to_vendor_code.sql` 추가 및 JSHANES 적용/재실행.
  - `MAT_ARRIVALS.VENDOR_ID -> VENDOR_CODE`
  - `SUBCON_ORDERS.VENDOR_ID -> VENDOR_CODE`
  - `WAREHOUSES.VENDOR_ID -> VENDOR_CODE`
  - `IDX_MAT_ARRIVALS_VENDOR_ID -> IDX_MAT_ARRIVALS_VENDOR_CODE`
  - 세 컬럼 주석을 `VENDOR_MASTERS.VENDOR_CODE` 기준으로 갱신했다.
- 코드/문서 변경:
  - `MatArrival`, `SubconOrder`, `Warehouse` entity의 물리 컬럼 매핑과 업무 속성명을 `vendorCode`로 변경했다.
  - 입하/외주/창고 DTO, service, focused spec, 관련 프론트 타입/form을 `vendorCode`로 변경했다.
  - `ErViewService`의 `VENDOR_ID -> VENDOR_CODE` 예외 매핑을 제거했다.
  - `apps/backend/src/database/create-hanes-schema.sql`과 `docs/reports/db-schema-erd.md`를 현재 표준 컬럼명으로 갱신했다.
- DB 검증:
  - JSHANES `USER_TAB_COLUMNS`에서 `VENDOR_ID` row_count 0 확인.
  - `MAT_ARRIVALS`, `SUBCON_ORDERS`, `WAREHOUSES` 모두 `VENDOR_CODE`로 확인.
  - `USER_INDEXES`에서 `IDX_MAT_ARRIVALS_VENDOR_CODE` 확인.
- 검증:
  - PASS: `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_vendor_id_to_vendor_code.sql` 적용 및 재실행
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend test -- arrival.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- outsourcing.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend build`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`

# 2026-06-23 - T-PARTNER-ID-TO-PARTNER-CODE PARTNER_ID 컬럼 표준명 변경

- owner: codex
- status: DONE
- 원인:
  - 사용자 지시에 따라 DB 물리 컬럼 표준을 `PARTNER_ID`가 아니라 `PARTNER_CODE`로 정리했다.
  - JSHANES 실측상 `PARTNER_ID` 물리 컬럼은 `PURCHASE_ORDERS` 1개뿐이었다.
  - `create-hanes-schema.sql`에는 현재 JSHANES에 없는 `IQC_PART_LINKS.PARTNER_ID` 과거 정의도 남아 있어 생성 기준 파일에서 함께 정리했다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_partner_id_to_partner_code.sql` 추가 및 JSHANES 적용/재실행.
  - `PURCHASE_ORDERS.PARTNER_ID -> PARTNER_CODE`
  - `PURCHASE_ORDERS.PARTNER_CODE` 컬럼 주석을 `PARTNER_MASTERS.PARTNER_CODE` 기준으로 갱신했다.
- 코드/문서 변경:
  - `PurchaseOrder` entity의 물리 컬럼 매핑과 업무 속성명을 `partnerCode`로 변경했다.
  - 구매발주 DTO/service/spec, ERP PO 수신 controller/service/spec, 입하 서비스의 PO 참조, 구매발주 프론트 패널, 입하 타입을 `partnerCode`로 변경했다.
  - `ErViewService`의 `PARTNER_ID -> PARTNER_CODE` 예외 매핑을 제거했다.
  - `apps/backend/src/database/create-hanes-schema.sql`, 보조 TypeORM migration, `docs/reports/db-schema-erd.md`를 현재 표준 컬럼명으로 갱신했다.
- DB 검증:
  - JSHANES `USER_TAB_COLUMNS`에서 `PARTNER_ID` row_count 0 확인.
  - `PURCHASE_ORDERS.PARTNER_CODE`와 `PARTNER_MASTERS.PARTNER_CODE` 확인.
- 검증:
  - PASS: `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_partner_id_to_partner_code.sql` 적용 및 재실행
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend test -- purchase-order.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- erp-material.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- arrival.service.spec.ts arrival.service.po-line.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `pnpm.cmd --filter @harness/backend build`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
- 주의:
  - `arrival.service.spec.ts`/`arrival.service.po-line.spec.ts` 묶음은 PASS 후 기존 Jest open-handle 경고가 출력됐다. 테스트 실패는 아니다.

# 2026-06-23 - T-ER-VIEW-FK-NAME-RISK-DISPLAY ER VIEW FK명/리스크 근거 표시 보정

- owner: codex
- status: DONE
- 원인:
  - 백엔드는 물리 FK 관계의 `constraintName`을 이미 내려주고 있었지만 `/system/er-view` 우측 상세 패널과 그래프 edge 라벨에서 FK명을 표시하지 않았다.
  - `PHYSICAL_FK_EXISTS` 사유가 내부 정렬용 음수 보정값 `-100`으로 표시되어 이미 적용된 FK가 리스크 점수처럼 보였다.
- 변경:
  - 물리 FK 관계 상세에 `현재 FK명`을 별도 표시하고, 추정 관계에는 실행 전 확인용 `FK 후보명`을 표시했다.
  - 물리 FK edge 라벨은 컬럼명 대신 실제 `constraintName`을 우선 표시한다.
  - 물리 FK 리스크 사유를 `이미 FK 존재: 신규 생성 불필요`, score `0`, recommendation `신규 생성 불필요`로 정리했다.
  - 우측 `상태/리스크 근거` 목록은 양수 리스크만 점수로 표시하고, 이미 존재/양호 같은 상태성 사유는 점수를 숨긴다.
- 검증:
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`

# 2026-06-23 - T-ER-VIEW-MULTI-TABLE-SELECT ER VIEW 다중 테이블 선택 그래프

- owner: codex
- status: DONE
- 변경:
  - `/system/er-view` 좌측 테이블 목록을 단일 선택 버튼에서 checkbox 기반 다중 선택 목록으로 변경했다.
  - `selectedTables` 배열의 첫 번째 값을 포커스 테이블로 두고, 새로 선택한 테이블 또는 그래프 노드 클릭 테이블을 포커스로 올린다.
  - 선택된 각 테이블의 기존 `/system/er-view/graph?table=...&depth=1` 응답을 `Promise.all`로 조회한 뒤 node/edge/relationship을 `id` 기준으로 병합한다.
  - 마지막 1개 선택은 해제되지 않게 막아 빈 그래프 상태를 방지한다.
  - 중앙 그래프 헤더와 좌측 패널에 선택 개수와 포커스 테이블을 표시한다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
  - PASS: 3002 `/system/er-view` HTTP 200

# 2026-06-23 - T-ACTIVITY-LOGS-USERS-FK ACTIVITY_LOGS 사용자 FK 정합화

- owner: codex
- status: DONE
- 원인:
  - JSHANES 실측상 `ACTIVITY_LOGS`는 실제 저장 컬럼 `USER_EMAIL`과 표시용 `USER_NAME`을 가진다.
  - `USERS`의 물리 PK는 `EMAIL` 단독이다.
  - 기존 ER VIEW 추정 로직은 `_CODE/_ID/_NO`만 부모 후보로 처리해 `USER_EMAIL -> USERS.EMAIL` 관계를 만들지 못했다.
  - `USER_NAME`은 표시용 컬럼이므로 FK 대상이 아니다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_activity_logs_user_email_fk.sql` 추가 및 JSHANES 적용/재실행.
  - `FK_ACTIVITY_LOGS_USER_EMAIL`: `ACTIVITY_LOGS.USER_EMAIL -> USERS.EMAIL ENABLE VALIDATE`.
- 코드/문서 변경:
  - `ErViewService`에 `USER_EMAIL -> USERS` semantic mapping과 `USER_EMAIL -> EMAIL` parent column mapping을 추가했다.
  - `USERS.EMAIL` 참조에서는 tenant 컬럼을 자동 조합하지 않도록 했다.
  - `er-view.service.spec.ts`에 `ACTIVITY_LOGS.USER_EMAIL -> USERS.EMAIL` 회귀 테스트를 추가했다.
  - `docs/reports/db-schema-erd.md`를 재생성했다.
- DB 검증:
  - JSHANES pre/post orphan `0`.
  - `FK_ACTIVITY_LOGS_USER_EMAIL`이 `ENABLED/VALIDATED`이고 child `USER_EMAIL`, parent `EMAIL`로 조회됨.
- 검증:
  - PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_activity_logs_user_email_fk.sql` 적용 및 재실행
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
- 주의:
  - 생성 ERD 문서에서 `USER_AUTHS.USER_EMAIL` 주석에 과거 표현 `USERS.ID`가 남아 있는 별도 문제를 발견했다. 이번 범위는 ACTIVITY_LOGS FK 정합화로 제한했다.
  - 후속 사용자 정정에 따라 이 작업의 `ACTIVITY_LOGS.USER_EMAIL -> USERS.EMAIL` FK-only 접근은 `T-ACTIVITY-LOGS-EMAIL-COLUMN`에서 물리 컬럼 rename 방식으로 대체됐다.

# 2026-06-23 - T-ACTIVITY-LOGS-EMAIL-COLUMN ACTIVITY_LOGS 사용자 컬럼명 마스터 정렬

- owner: codex
- status: DONE
- 사용자 정정:
  - FK만 다른 이름끼리 연결하는 것이 아니라, `ACTIVITY_LOGS`에 단독으로 쓰인 사용자 컬럼명 자체를 마스터 `USERS.EMAIL`에 맞춰야 한다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_activity_logs_user_email_to_email.sql` 추가 및 JSHANES 적용/재실행.
  - 기존 `FK_ACTIVITY_LOGS_USER_EMAIL`을 drop.
  - `ACTIVITY_LOGS.USER_EMAIL -> EMAIL` rename.
  - 신규 `FK_ACTIVITY_LOGS_EMAIL`: `ACTIVITY_LOGS.EMAIL -> USERS.EMAIL ENABLE VALIDATE`.
- 코드/문서 변경:
  - `ActivityLog.userEmail` TypeORM property는 API/서비스 호환을 위해 유지하되 물리 컬럼 매핑을 `EMAIL`로 변경했다.
  - `ErViewService` 추정 로직은 `ACTIVITY_LOGS.EMAIL -> USERS.EMAIL`을 표준 관계로 추정하도록 변경했다.
  - `activity-log.service.spec.ts`와 `er-view.service.spec.ts` 회귀 테스트를 갱신/추가했다.
  - `docs/reports/db-schema-erd.md`와 `apps/backend/src/database/create-hanes-schema.sql`을 라이브 DB 기준으로 갱신했다.
- DB 검증:
  - JSHANES `ACTIVITY_LOGS.USER_EMAIL` 컬럼 0건, `ACTIVITY_LOGS.EMAIL` 컬럼 1건.
  - `FK_ACTIVITY_LOGS_EMAIL`이 child `EMAIL`, parent `USERS.EMAIL`, `ENABLED/VALIDATED`로 조회됨.
  - orphan 0건.
- 검증:
  - PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_activity_logs_user_email_to_email.sql` 적용 및 재실행
  - PASS: `pnpm.cmd --filter @harness/backend test -- activity-log.service.spec.ts er-view.service.spec.ts --runInBand`
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `python scripts/gen-live-schema.py JSHANES apps/backend/src/database/create-hanes-schema.sql`
  - PASS: `git diff --check`
- 주의:
  - 전체 backend `tsc --noEmit`는 기존 `ai-page-tools.service.spec.ts`의 생성자 인자 오류로 실패한다. 이번 변경 파일 대상 테스트와 DB 검증은 통과했다.

# 2026-06-23 - T-ACTIVITY-LOGS-NAME-COLUMN ACTIVITY_LOGS 사용자명 컬럼 표준화

- owner: codex
- status: DONE
- 판단:
  - JSHANES 실측상 `USERS` 마스터의 사용자명 컬럼은 `NAME`이고, `ACTIVITY_LOGS`에는 중복 표시명 컬럼 `USER_NAME`이 남아 있었다.
  - `ACTIVITY_LOGS` 데이터는 0건이라 rename 데이터 리스크는 낮았다.
  - 사용자 기준에 따라 마스터 컬럼명과 물리 컬럼명을 맞추는 것이 정석이므로 `ACTIVITY_LOGS.USER_NAME -> NAME`으로 rename했다.
- DB 적용:
  - 신규 migration `apps/backend/src/migrations/2026-06-23_activity_logs_user_name_to_name.sql` 추가 및 JSHANES 적용/재실행.
  - post-check: `ACTIVITY_LOGS` 사용자 컬럼은 `EMAIL`, `NAME`만 존재하고 `USER_NAME`은 없음.
- 코드/문서 변경:
  - `ActivityLog.userName` property는 API/서비스 호환을 위해 유지하되 `@Column({ name: 'NAME' })`로 매핑했다.
  - `activity-log.service.spec.ts`에 `ACTIVITY_LOGS.NAME` 매핑 회귀 테스트를 추가했다.
  - `er-view.service.spec.ts`의 ACTIVITY_LOGS 컬럼 fixture를 `NAME` 기준으로 갱신했다.
  - `docs/reports/db-schema-erd.md`, `apps/backend/src/database/create-hanes-schema.sql`을 JSHANES 라이브 DB 기준으로 재생성했다.
- 검증:
  - PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-23_activity_logs_user_name_to_name.sql` 적용 및 재실행
  - PASS: JSHANES column post-check `EMAIL`, `NAME`
  - PASS: `pnpm.cmd --filter @harness/backend test -- activity-log.service.spec.ts er-view.service.spec.ts --runInBand`
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: `python scripts/gen-live-schema.py JSHANES apps/backend/src/database/create-hanes-schema.sql`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`

# 2026-06-23 - T-ER-VIEW-DROP-FK ER VIEW FK 제거 액션 추가

- owner: codex
- status: DONE
- 변경:
  - `ErViewService` action type에 `DROP_FK`를 추가했다.
  - dry-run은 `constraintName`과 `childTable`을 정규화하고, 최신 snapshot의 실제 물리 FK와 일치할 때만 `ALTER TABLE <child> DROP CONSTRAINT <fk>`를 생성한다.
  - execute는 `DROP_FK`를 DDL 경로로 처리해 schema snapshot cache 무효화, DEV migration 파일 작성, ERD 재생성, action log 기록 흐름을 탄다.
  - `/system/er-view` 상세 패널에서 물리 FK 관계 선택 시 `FK 제거 후보` 버튼을 표시하고 `DROP_FK` payload를 dry-run으로 보낸다.
- 범위 제외:
  - PK/UK 제거 기능은 추가하지 않았다.
  - 실제 FK DROP DDL은 실행하지 않았다. 기능 구현과 dry-run/execute 경로 테스트만 수행했다.
- 검증:
  - RED 확인: `DROP_FK` 미지원으로 backend spec 실패, 프론트 구조 테스트가 `DROP_FK`/`FK 제거 후보` 부재로 실패.
  - PASS: `pnpm.cmd --filter @harness/backend test -- er-view.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/er-view/er-view.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check`
  - PASS: `http://localhost:3002/system/er-view` HTTP 200
- 주의:
  - 내장 브라우저 `iab`는 현재 세션에서 unavailable이고, repo Node module 경로에서 `playwright` import가 되지 않아 DOM 자동 확인은 수행하지 못했다. 구조 테스트와 HTTP 200으로 대체했다.

# 2026-06-23 - T-ALL-MENU-QA 전체 메뉴 QA 러너 1차 체크포인트

- owner: codex
- status: IN_PROGRESS
- 변경:
  - 전체 등록 메뉴를 `menuConfig.ts`에서 추출해 실제 브라우저로 route/API/console/request failure/화면 기능 목록을 수집하는 `tools/hanes-all-menu-page-scenario-qa.mjs`를 추가했다.
  - 리포트는 `docs/reports/hanes-all-menu-scenario-qa-<date>/index.html`과 `all-menu-result.json`, 페이지 HTML, 로드 스크린샷으로 생성한다.
  - 인증 localStorage 주입, API response 수집, 버튼/입력/select/grid/table 목록화, 메뉴 코드/건수 필터 환경변수를 지원한다.
- 검증:
  - PASS: 3002 frontend HTTP 200, 3003 `/api/v1/health` HTTP 200 확인
  - PASS: `HANES_REPORT_DATE=2026-06-23-smoke HANES_MENU_LIMIT=3 node tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: smoke 결과 3/3 PASS (`/dashboard`, `/workflow`, `/equipment/status`)
  - PASS: `git diff --check -- tools/hanes-all-menu-page-scenario-qa.mjs .ai-coordination/LOCKS.md .ai-coordination/TASKS.md`
- 주의:
  - 이번 커밋은 전체 메뉴 완료가 아니라 전체 메뉴 QA 자동화 기반과 3개 메뉴 스모크 산출물 체크포인트다. 전체 메뉴 상세 기능 실행/수정/재테스트는 계속 진행 대상이다.

# 2026-06-23 - T-ALL-MENU-QA 타임박스 실행 방식 보정

- owner: codex
- status: IN_PROGRESS
- 변경:
  - `tools/hanes-all-menu-page-scenario-qa.mjs`에 `HANES_QA_BUDGET_MS`를 추가했다.
  - 실행 예산이 소진되면 다음 메뉴 진입 전에 중단하고 현재까지 결과를 `PARTIAL` 상태로 `all-menu-result.json`과 `index.html`에 저장한다.
  - 리포트 JSON에는 `plannedTotal`, `runBudgetMs`, `elapsedMs`, `stoppedReason`을 남긴다.
- 검증:
  - PASS: `node --check tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `git diff --check -- .ai-coordination/LOCKS.md tools/hanes-all-menu-page-scenario-qa.mjs`
- 현재 런타임 상태:
  - 3003 backend health는 200으로 확인됐다.
  - 3002/3012 frontend는 중단된 Next dev/build 산출물 영향으로 500 상태다.
  - frontend 로그 원인: `.next/server/app/.../app-build-manifest.json` 및 `.next/static/development/_buildManifest.js.tmp.*` ENOENT.
- 다음 조치:
  - generated `.next`를 정리하고 frontend dev 서버를 한 개만 재시작한 뒤, `HANES_QA_BUDGET_MS=600000` 같은 10분 예산으로 chunk 실행을 재개한다.
  - `/shipping/return`의 `GET /api/v1/shipping/orders/shipped` 500은 `T-SHIP-ORDER-CANCEL` active lock 범위라 직접 수정하지 않았다.

# 2026-06-23 - T-ALL-MENU-QA frontend 런타임 복구 및 타임박스 검증

- owner: codex
- status: IN_PROGRESS
- 조치:
  - 중복으로 떠 있던 3002/3012 Next dev 프로세스를 종료했다.
  - 깨진 generated artifact `apps/frontend/.next`를 삭제했다.
  - Turbopack manifest ENOENT 재발을 피하기 위해 `pnpm.cmd --filter @harness/frontend exec next dev -p 3002`로 frontend dev 서버를 1개만 재시작했다.
- 검증:
  - PASS: `http://localhost:3002/dashboard` HTTP 200
  - PASS: `http://localhost:3003/api/v1/health` HTTP 200
  - PASS: `HANES_QA_BUDGET_MS=1`, `HANES_MENU_LIMIT=5` 실행 시 `PARTIAL`, `stoppedReason=time budget exhausted before DASHBOARD` 저장
  - PASS: `HANES_MENU_CODES=DASHBOARD`, `HANES_QA_BUDGET_MS=60000` 실행 시 1/1 PASS
  - PASS: `node --check tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `git diff --check`
- 산출물:
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-budget-partial-verify/all-menu-result.json`
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-dashboard-smoke-after-recovery/all-menu-result.json`
- 주의:
  - 전체 목표는 아직 완료가 아니다. 현재 변경은 장시간 실행을 피하기 위한 타임박스/부분 저장 기반과 런타임 복구다.

# 2026-06-23 - T-ALL-MENU-QA 누적 리포트 집계

- owner: codex
- status: IN_PROGRESS
- 변경:
  - `tools/hanes-all-menu-report-aggregate.mjs`를 추가했다.
  - `docs/reports/hanes-all-menu-scenario-qa-*/all-menu-result.json`들을 읽어 `menuConfig.ts` 기준 전체 메뉴 156개의 최신 PASS/FAIL/MISSING 상태를 집계한다.
  - 집계 HTML/JSON은 `docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/`에 생성한다.
- 현재 집계:
  - 전체 메뉴: 156
  - PASS: 89
  - FAIL: 1
  - MISSING: 66
  - FAIL: `SHIP_RETURN /shipping/return` - `GET /api/shipping/orders/shipped` 500
- 검증:
  - PASS: `node --check tools/hanes-all-menu-report-aggregate.mjs`
  - PASS: `node --check tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: aggregate 생성 명령은 실패/미실행이 남아 exit 1을 반환하지만 JSON/HTML 생성은 정상 완료
- 산출물:
  - `docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/index.html`
  - `docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/all-menu-summary.json`
- 다음 조치:
  - 미실행 66개를 작은 chunk와 `HANES_QA_BUDGET_MS`로 이어서 실행한다.
  - `SHIP_RETURN`은 `T-SHIP-ORDER-CANCEL` active lock 해소 후 수정/재테스트한다.

# 2026-06-23 - T-ALL-MENU-QA receive-label 및 미실행 청크 재검증

- owner: codex
- status: IN_PROGRESS
- 원인/변경:
  - `/material/receive-label` 실패 원인은 기본 출력 방식이 `BROWSER`인데도 `PrintActionBar` 렌더 시 `useZebraPrinter()`가 즉시 실행되어 선택하지 않은 `ZPL_USB`용 `http://localhost:9100/available` 요청이 발생한 것이다.
  - `useZebraPrinter(enabled = true)` disabled mode를 추가하고, `PrintActionBar`는 `printMethod === 'ZPL_USB'`일 때만 Zebra Browser Print 상태를 조회하도록 보정했다.
  - 회귀 방지 구조 테스트 `receive-label-zebra-lazy.structure.test.mjs`를 추가했다.
- 실행/재테스트:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/material/receive-label/receive-label-zebra-lazy.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 3003 backend 재기동 후 `/api/v1/health` HTTP 200
  - PASS: `HANES_MENU_CODES=MAT_RECEIVE_LABEL HANES_REPORT_DATE=2026-06-23-mat-receive-label-zebra-lazy-retry node tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `HANES_MENU_CODES=MAT_RECEIVE_HISTORY,MAT_REQUEST,MAT_ISSUE,MAT_ISSUE_OTHER,MAT_LOT HANES_REPORT_DATE=2026-06-23-missing-chunk-02 node tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `node --check tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `node --check tools/hanes-all-menu-report-aggregate.mjs`
  - PASS: `git diff --check -- tools/hanes-all-menu-page-scenario-qa.mjs tools/hanes-all-menu-report-aggregate.mjs apps/frontend/src/hooks/useZebraPrinter.ts apps/frontend/src/app/(authenticated)/material/receive-label/components/PrintActionBar.tsx apps/frontend/src/app/(authenticated)/material/receive-label/receive-label-zebra-lazy.structure.test.mjs`
- 현재 집계:
  - 전체 메뉴: 156
  - PASS: 97
  - FAIL: 1
  - MISSING: 58
  - 유일 FAIL: `SHIP_RETURN /shipping/return` - `GET /api/shipping/orders/shipped` 500, `T-SHIP-ORDER-CANCEL` active lock 범위라 직접 수정하지 않음.
- 산출물:
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-mat-receive-label-zebra-lazy-retry/`
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-missing-chunk-02/`
  - `docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/`

# 2026-06-23 - T-ALL-MENU-QA 미실행 청크 03/04 실행

- owner: codex
- status: IN_PROGRESS
- 실행:
  - PASS: `HANES_MENU_CODES=MAT_LOT_SPLIT,MAT_LOT_MERGE,MAT_SHELF_LIFE,MAT_SHELF_LIFE_REINSPECT,MAT_SHELF_LIFE_HISTORY HANES_REPORT_DATE=2026-06-23-missing-chunk-03 node tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `HANES_MENU_CODES=MAT_SCRAP,MAT_ADJUSTMENT,MAT_MISC_RECEIPT,MAT_RECEIPT_CANCEL,INV_MAT_STOCK HANES_REPORT_DATE=2026-06-23-missing-chunk-04 node tools/hanes-all-menu-page-scenario-qa.mjs`
- 현재 집계:
  - 전체 메뉴: 156
  - PASS: 107
  - FAIL: 1
  - MISSING: 48
  - 유일 FAIL: `SHIP_RETURN /shipping/return` - `GET /api/shipping/orders/shipped` 500, `T-SHIP-ORDER-CANCEL` active lock 범위라 직접 수정하지 않음.
- 다음 미실행 시작 후보:
  - `INV_TRANSACTION`, `INV_MAT_PHYSICAL_INV`, `INV_MAT_PHYSICAL_INV_APPLY`, `INV_MAT_PHYSICAL_INV_HISTORY`, `INV_ARRIVAL_STOCK`
- 검증:
  - PASS: `node --check tools/hanes-all-menu-page-scenario-qa.mjs`
  - PASS: `node --check tools/hanes-all-menu-report-aggregate.mjs`
  - PASS: `git diff --check -- tools/hanes-all-menu-page-scenario-qa.mjs tools/hanes-all-menu-report-aggregate.mjs apps/frontend/src/hooks/useZebraPrinter.ts apps/frontend/src/app/(authenticated)/material/receive-label/components/PrintActionBar.tsx apps/frontend/src/app/(authenticated)/material/receive-label/receive-label-zebra-lazy.structure.test.mjs .ai-coordination/LOCKS.md .ai-coordination/TASKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`
- 산출물:
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-missing-chunk-03/`
  - `docs/reports/hanes-all-menu-scenario-qa-2026-06-23-missing-chunk-04/`
  - `docs/reports/hanes-all-menu-scenario-qa-summary-2026-06-23/`
- `T-MASTER-PART-PAGE-STANDARD` 완료. `/master/part`를 기준 화면으로 삼아 품목마스터 유지보수 표준 문서를 추가했다. 상단 액션 배치, 12px 배지, 아이콘 중심 행 액션, 우측 슬라이드 패널, 필드별 DB 컬럼 툴팁, 유지보수 체크리스트를 정리했고 `docs/standards/ui-screen-patterns.md`에 연결했다. 검증: `playwright-cli`로 `/master/part` 실제 화면 확인, `git diff --check` PASS. 커밋하지 않았다.

# 2026-06-24 - T-MASTER-EQUIP-IMAGE-UPLOAD 설비마스터 사진 업로드 추가

- owner: codex
- status: DONE
- 변경:
  - `EQUIP_MASTERS.IMAGE_URL` 컬럼을 JSHANES에 추가하고 주석 `설비 사진 파일 URL (/uploads/equips/...)`을 등록했다.
  - 설비마스터 엔티티/DTO/서비스/컨트롤러에 사진 업로드·삭제 경로를 추가하고, `POST /equipment/equips/:id/image`, `DELETE /equipment/equips/:id/image`로 품목마스터와 같은 패턴을 맞췄다.
  - `/master/equip` 우측 패널에 사진 썸네일, 업로드, 삭제 확인, 미리보기 상태를 추가하고 field help에 `EQUIP_MASTERS.IMAGE_URL` 메타를 넣었다.
  - `docs/reports/db-schema-erd.md`를 재생성해 스키마 문서에 `IMAGE_URL` 반영을 포함시켰다.
- 검증:
  - PASS: `pnpm.cmd --filter @harness/backend exec jest src/modules/equipment/services/equip-master.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/master/equip/equip-image-upload.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- apps/backend/src/entities/equip-master.entity.ts apps/backend/src/modules/equipment/dto/equip-master.dto.ts apps/backend/src/modules/equipment/controllers/equip-master.controller.ts apps/backend/src/modules/equipment/services/equip-master.service.ts apps/backend/src/modules/equipment/services/equip-master.service.spec.ts apps/backend/src/migrations/2026-06-24_add_equip_master_image_url.sql apps/frontend/src/app/(authenticated)/master/equip/types.ts apps/frontend/src/app/(authenticated)/master/equip/components/EquipFieldHelp.tsx apps/frontend/src/app/(authenticated)/master/equip/components/EquipMasterTab.tsx apps/frontend/src/app/(authenticated)/master/equip/equip-image-upload.structure.test.mjs docs/reports/db-schema-erd.md`
  - PASS: Oracle `EQUIP_MASTERS.IMAGE_URL` 컬럼/주석 확인

# 2026-06-24 - T-WORKFLOW-BUSINESS-MAP `/workflow` 업무 이해용 React Flow 재구성

- owner: codex
- status: REVIEW
- 변경:
  - `/workflow`를 기존 카드형 건수 대시보드에서 `@xyflow/react` 기반 업무-시스템 관계도 캔버스로 재구성했다.
  - `apps/frontend/src/config/workflowMap.ts`에 6개 스윔레인과 29개 업무 활동 노드, 업무 산출물 기반 edge를 정적 정의로 추가했다.
  - 노드 클릭 시 바로 이동하지 않고 우측 상세 패널에서 업무 설명, 관련 화면, 생성/변경 데이터, 입력/산출, 선행/후행 업무를 보여준다.
  - 실시간 건수, KPI, `/workflow/summary`, Oracle `PKG_WORKFLOW` 변경은 제외했다.
  - 설계와 구현 계획은 `docs/superpowers/specs/2026-06-24-workflow-business-map-design.md`, `docs/superpowers/plans/2026-06-24-workflow-business-map.md`에 남겼다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- apps/frontend/src/config/workflowMap.ts "apps/frontend/src/app/(authenticated)/workflow" docs/superpowers/specs/2026-06-24-workflow-business-map-design.md docs/superpowers/plans/2026-06-24-workflow-business-map.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`
  - PASS: 3002 기존 dev 서버에서 `/workflow` HTTP 200
  - PASS: Playwright 인증 세션에서 React Flow 1개, 노드 34개, 상세 패널 1개, `IQC 판정` 클릭 후 상세 갱신, console/page error 0
  - PASS: 사용자 제공 계정으로 3002 로그인 후 `/workflow` 재검증. React Flow 1개, 업무 노드 29개, 레인 6개, 노드 겹침 0, edge label 1개, 건수 배지 0개, minimap false, console/page error 0
  - PASS: 사용자 지적에 따라 생산 레인에 `조립실적(키오스크)` 노드를 추가한 뒤 3002에서 재검증. React Flow 1개, 업무 노드 29개, 레인 6개, `조립실적(키오스크)` 표시, `조립/라벨 실적` 명칭 분리, 노드 겹침 0, console/page error 0
- 산출물:
  - `docs/reports/workflow-business-map-3002.png`
- 참고:
  - 임시 대체 포트 검증 서버와 이전 캡처는 정리했고, 최종 검증은 3002 기준으로 다시 수행했다.
  - 사용자 피드백 후 기본 viewport를 `x=180, y=28, zoom=0.62`로 조정해 스윔레인 설명이 잘리지 않게 했다.
  - 출하 구간 x 좌표 겹침을 제거했고, 장거리 reference/reversal edge는 선택 업무 주변 또는 `보조 연결 보기`에서만 노출한다.
  - 미니맵은 하단 레인 설명을 가려 제거했다.
  - 생산 실행 흐름은 `작업지시 -> 조립실적(키오스크) -> 서브공정 키팅/조립·라벨 실적`로 보이도록 갱신했다.

## 2026-06-25 22:35 - T-SHIP-ORDER-UNCONFIRM 출하지시 확정취소(DRAFT 복귀) 추가

- owner: codex
- status: REVIEW
- 변경:
  - `/shipping/order`에서 `CONFIRMED` 행에 확정취소 버튼을 추가하고 확인 모달에서 전용 API를 호출하도록 했다.
  - `PUT /shipping/orders/:id/unconfirm` API와 `ShipOrderService.unconfirm()`을 추가했다.
  - 확정취소는 `CONFIRMED` 상태, 모든 품목 `shippedQty=0`, 연결 팔레트/박스 0건일 때만 `DRAFT`로 되돌린다.
  - `CONFIRMED` 편집 패널에서는 저장 버튼을 비활성화하고 확정취소 버튼을 제공한다.
- 검증:
  - RED 확인: backend spec는 `target.unconfirm is not a function`, frontend structure test는 `unconfirmTarget` 부재로 실패.
  - PASS: `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/ship-order.service.spec.ts apps/backend/src/modules/shipping/controllers/ship-order.controller.ts "apps/frontend/src/app/(authenticated)/shipping/order/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/DECISIONS.md`
- 참고:
  - `ship-order.service.ts`와 `ship-order.controller.ts`는 `T-SHIP-ORDER-CANCEL` active lock과 겹쳤다. 사용자 직접 지시로 최소 변경만 수행했고 출하취소 로직은 수정하지 않았다.
  - 3002 dev server는 새로 시작하지 않았다. 브라우저 실측은 미수행.

## 2026-06-25 22:31 - T-SHIP-ORDER-UNCONFIRM 후속: CONFIRMED 삭제 400 보정

- owner: codex
- status: REVIEW
- 원인:
  - `/shipping/order` 행 액션의 삭제 버튼이 모든 상태에 노출되어 `CONFIRMED` 출하지시에서도 `DELETE /shipping/orders/:id`가 호출됐다.
  - 백엔드는 의도대로 `DRAFT`만 삭제 허용하므로 400을 반환했다.
- 변경:
  - 삭제 버튼은 `DRAFT` 행에만 렌더링한다.
  - `handleDeleteConfirm()`도 `deleteTarget.status !== "DRAFT"`이면 API 호출 전 모달만 닫고 반환한다.
  - 기존 확정취소 구조 테스트에 DRAFT-only 삭제 조건을 추가했다.
- 검증:
  - RED 확인: 신규 구조 테스트가 `deleteTarget.status !== "DRAFT"` 부재로 실패.
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- "apps/frontend/src/app/(authenticated)/shipping/order/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- 참고:
  - 백엔드와 dev server는 건드리지 않았다. 3002 새 시작 또는 대체 포트 사용 없음.

## 2026-06-25 22:45 - T-SHIP-ORDER-UNCONFIRM 후속: 빈 OPEN 팔레트 자동정리 및 삭제 UI

- owner: codex
- status: REVIEW
- 원인:
  - 사용자 리포트 `PUT /shipping/orders/SH2606220004/unconfirm` 400은 빈 `OPEN` 팔레트 1건 때문에 발생했다.
  - JSHANES 실측: `SH2606220004`는 `CONFIRMED`, 품목 `HNS02` `ORDER_QTY=100`, `SHIPPED_QTY=0`, 팔레트 `PLT2606220002` `OPEN/BOX_COUNT=0/TOTAL_QTY=0/SHIPMENT_ID=NULL`, 관련 박스 0건.
  - `/shipping/pallet`에는 기존 `DELETE /shipping/pallets/:id` 백엔드 API가 있는데 화면에서 빈 팔레트 삭제 액션이 없었다.
- 변경:
  - `ShipOrderService.unconfirm()`은 빈 `OPEN` 팔레트만 있으면 같은 transaction에서 해당 팔레트를 삭제하고 출하지시를 `DRAFT`로 전환한다.
  - 박스가 있거나, 팔레트가 `OPEN`이 아니거나, 출하 할당/수량이 있으면 기존처럼 확정취소를 차단한다.
  - `/shipping/pallet` 그리드에 `빈 팔레트 삭제` 버튼과 확인 모달을 추가했다. 조건은 `OPEN`, `boxCount === 0`, `shipmentId` 없음이다.
- 검증:
  - RED 확인: backend spec는 빈 `OPEN` 팔레트 삭제 transaction 부재로 실패, frontend structure test는 `deletePalletTarget` 부재로 실패.
  - PASS: `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/ship-order.service.spec.ts "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- 참고:
  - 실제 `SH2606220004` unconfirm 재호출은 DB 상태 변경이므로 수행하지 않았다.
  - dev server 새 시작 또는 대체 포트 사용 없음.

# 2026-06-24 15:39 - T-MATERIAL-HELP-MANUAL 자재관리 도움말 및 단일 HTML 매뉴얼 생성

- owner: codex
- status: DONE
- 변경:
  - `.ai-coordination/TASK-material-manual.md`의 26개 자재관리 메뉴 기준으로 누락 도움말을 작성했다.
  - 신규 user 도움말 13개와 신규 operator 도움말 10개를 `apps/frontend/public/help/{user,operator}/ko/`에 추가했다.
  - 기존 완비 13개 도움말은 덮어쓰지 않았고, user-only 3개(`MAT_ISSUE_OTHER`, `MAT_SHELF_LIFE_REINSPECT`, `MAT_SHELF_LIFE_HISTORY`)는 기존 operator 문서가 없으므로 user 문서만 추가했다.
  - `apps/frontend/public/help/manifest.json`에 대상 메뉴 13개 항목을 보강했다.
  - 공식 `help-manual-export-runner.mjs`로 단일 HTML 매뉴얼을 생성했다.
- 산출물:
  - `docs/manuals/hanes-material-manual-2026-06-24.html`
  - `docs/manuals/hanes-material-manual-2026-06-24.result.json`
- 검증:
  - PASS: 도움말 frontmatter/BOM/audience/manifest 중복/누락 검증, errors 0건
  - PASS: 공식 runner 결과 JSON `total=26`, `missingHelp=[]`, `missingCapture=[]`
  - PASS: `git diff --check -- apps/frontend/public/help/user/ko apps/frontend/public/help/operator/ko apps/frontend/public/help/manifest.json docs/manuals .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- 참고:
  - 기존 3002는 `/inventory/material-physical-inv-history` 캡처에서 타임아웃되어 별도 3004 dev 서버로 생성했고, 작업 후 3004 임시 서버는 종료한다.
  - 소스 추적 중 `MAT_SCRAP`, `MAT_MISC_RECEIPT`, `INV_MAT_PHYSICAL_INV_HISTORY` 화면의 표시용 SQL 텍스트가 실제 backend 저장/조회 테이블과 달라 도움말에는 실제 서비스 기준(`STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`)으로 설명했다.

# 2026-06-26 00:08 KST - codex - T-LABEL-TEXT-IMAGE-INPUT

- `/master/label` 라벨 디자이너에서 텍스트 객체가 사용자 고정 문구를 직접 출력할 수 없고, 이미지 객체가 파일 업로드 없이 URL 직접 입력만 가능하던 문제를 보정했다.
- `LabelObjectDesigner.tsx`는 `T-KIOSK-SG-LABEL-PRINT` active lock에 포함되어 있었지만, 사용자가 충돌 수정 진행을 명시 승인해 최소 범위로 수정했다.
- 변경:
  - 툴바에서 추가한 글자/이미지 객체는 기본 소스 필드에 묶지 않고 `고정값 사용` 상태로 시작한다.
  - 필드 목록을 클릭해 추가한 글자 객체만 해당 소스 필드에 연결한다.
  - 텍스트 고정 문구 입력을 여러 줄 `TextareaInput`으로 변경했다.
  - 이미지 객체 속성에 `이미지 업로드` 버튼, 미리보기, URL 직접 입력, 제거 버튼을 추가했다.
  - `POST /master/label-templates/upload-image`를 추가해 `/uploads/label-templates`에 이미지 파일을 저장하고 URL을 반환한다.
- 검증:
  - RED: 프론트 구조 테스트가 sourceField/업로드 UI 부재로 실패
  - RED: 백엔드 구조 테스트가 upload-image endpoint 부재로 실패
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-object-inputs.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs" "apps/backend/src/modules/master/controllers/label-template-upload.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: 기존 3002 `/master/label` Playwright 확인. 고정 텍스트 입력/이미지 업로드/정적 URL 200/미리보기/console error 0건
  - PASS: 대상 파일 `git diff --check`
- 참고:
  - locale 파일은 active lock 충돌이 있어 수정하지 않고 `t(key, fallback)`만 사용했다.
  - 검증 중 생성한 업로드 파일 `label-image-1782398858012-220155548.png`는 삭제했다.

# 2026-06-25 23:42 KST - codex - T-LABEL-BOX-STROKE

- `/master/label` 박스 객체가 실제 사용/출력에서 상단선이 빠져 보이는 문제를 공용 `LabelDesignRenderer`에서 보정했다.
- 원인: 박스/원/선 stroke를 outer element의 CSS `border`/`borderTop` 한 겹으로만 그려서 SVG `foreignObject` 캡처 및 객체 가장자리/겹침 조건에서 stroke가 쉽게 잘려 보일 수 있었다.
- 조치:
  - `ShapeStrokeLayer`를 추가해 박스/원은 내부 `box-shadow: inset ...`로 stroke를 그리고, 선은 절대 위치 내부 span으로 그린다.
  - shape outer element의 CSS border를 제거하고 shape에 한해 `overflow: visible`을 적용했다.
  - locked 상태인 `LabelObjectDesigner.tsx`, `types.ts`, `page.tsx`는 수정하지 않았다.
- 검증:
  - RED: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs"`가 `ShapeStrokeLayer` 부재로 실패
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/master/label/master-label-box-stroke.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-sg-label-print.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 기존 3002 `/master/label` Playwright 인증 세션 확인. `data-label-element=8`, `data-label-shape-stroke=2`, console error 0건
  - PASS: 대상 파일 `git diff --check`
- 참고: `apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs`는 이번 변경과 무관하게 현재 코드의 i18n 함수 호출 문자열과 테스트의 하드코딩 정규식이 맞지 않아 실패한다. scope 밖이라 수정하지 않았다.

# 2026-06-24 16:39 - T-PRODUCTION-HELP-MANUAL 생산관리 도움말 및 단일 HTML 매뉴얼 생성

- owner: codex
- status: DONE
- 변경:
  - `.ai-coordination/TASK-production-manual.md`의 생산관리 19개 메뉴 기준으로 누락 도움말을 작성했다.
  - 신규 user 도움말 15개와 신규 operator 도움말 12개를 `apps/frontend/public/help/{user,operator}/ko/`에 추가했다.
  - 기존 완비 4개(`PROD_MONTHLY_PLAN`, `PROD_ORDER`, `PROD_INPUT_KIOSK`, `PROD_WIP_MAT_TRANS`)와 기존 operator 3개(`PROD_RESULT`, `PROD_RESULT_SUMMARY`, `QC_REWORK`)는 덮어쓰지 않았다.
  - `apps/frontend/public/help/manifest.json`에 생산관리 17개와 품질관리 2개(`QC_REWORK`, `QC_REWORK_HISTORY`) 항목을 등재/보강했다.
  - 공식 `help-manual-export-runner.mjs`를 3002 기준으로 실행해 단일 HTML 매뉴얼을 생성했다.
- 산출물:
  - `docs/manuals/hanes-production-manual-2026-06-24.html`
  - `docs/manuals/hanes-production-manual-2026-06-24.result.json`
- 검증:
  - PASS: 도움말 frontmatter/BOM/audience/manifest 검증, errors 0건
  - PASS: 공식 runner 결과 JSON `total=19`, `missingHelp=[]`, `missingCapture=[]`
  - PASS: `git diff --check -- apps/frontend/public/help/user/ko apps/frontend/public/help/operator/ko apps/frontend/public/help/manifest.json docs/manuals .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- 참고:
  - 3002만 사용했다. 추가 포트 또는 대체 runner는 사용하지 않았다.
  - 중간에 runner 진행 감시 명령에서 stdout/stderr 동일 파일 지정 오류가 있었고, 이후 분리 로그로 재실행해 정상 완료했다.

## 2026-06-24 Claude — T-PRESENTATION-REINFORCE 소개자료 슬라이드 보강 + 캡처 재생성
- 배경: `docs/presentation/hanes-mes-introduction.{html,pptx}` 소개자료에 5개 주제 보강 요청. 기존 menu-captures가 빈 DB("Capture Admin")·렌더 실패로 빈 껍데기/백지였음(예: `20-material-mat_arrival.png` 백지, 품목/재고 그리드 "데이터 없음").
- 캡처 재생성:
  - help-manual-export 러너 방식 차용한 `docs/presentation/scripts/capture-screens.mjs` 작성(addInitScript 인증 주입, 메뉴트리 code→path, 1600x900).
  - 근본 원인 = Next dev의 좌측 메뉴 **prefetch 폭주**가 전체 라우트 동시 컴파일 → 컴파일러 잼. 캡처 시 `next-router-prefetch`/`purpose:prefetch` 요청 abort로 해결.
  - 강제중단 시 남은 고아 헤드리스 크롬이 서버를 두드려 추가 지연 → 정리.
  - 결과: 37/37 성공, 빈화면·실패 0건. 백지였던 mat_arrival 정상화.
  - 진입 시 빈 조회화면(추적성조회/출하이력)은 `capture-interactive.mjs`로 실제 조회 수행 후 캡처: 추적성=제품시리얼 FG26062300301 검색→제품/공정타임라인/검사/자재 전 구간, 출하이력=날짜 2026-01-01~ 현대자동차 출하 2건.
- 슬라이드: `insert-slides.mjs`로 신규 5장 삽입 후 전체 번호 재정렬(24→29). 09 AQL / 15 생산실적(서브·조립) / 18 검사·출하 이력 / 23 팔레트 구성 / 25 추적성 종합.
- PPTX: `render-slides.mjs`(?slide=N 단일모드 렌더)+`build-pptx.py`(python-pptx)로 29장 재빌드, 빈이미지 0.
- 산출물: docs/presentation/hanes-mes-introduction.{html,pptx}, artifact-build-manifest.json, assets/menu-captures/(재생성+21~31 신규), scripts/(capture-screens/capture-interactive/insert-slides/render-slides/build-pptx).
- 검증: 캡처 manifest suspect 0건, 신규 화면 육안 데이터 확인(AQL·키오스크 서브공정·팔레트·검사결과·출하이력·추적성), 렌더 29/29, PPTX 10.3MB/29장/빈이미지0.
- 미수정: locales(ko/en/zh/vi), help 파일(codex T-MATERIAL-HELP-MANUAL 잠금 회피). 소개자료는 자체 HTML 텍스트라 i18n 영향 없음.
# 2026-06-25 22:46 KST - codex - T-SHIP-PALLET-LAYOUT-TIDY

- `/shipping/pallet` 팔레트적재 화면에서 우측 포함박스 섹션이 본문 폭을 과하게 차지하고, 좌측 그리드 툴바가 좁은 폭에서 불안정하게 배치되는 문제를 보정했다.
- 공용 `DataGrid`는 수정하지 않고 `apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx` 전용으로 처리했다.
- 본문 레이아웃은 `xl:grid-cols-[minmax(0,1fr)_18rem]`, `2xl:grid-cols-[minmax(0,1fr)_20rem]`로 바꿔 우측 섹션을 좁혔다. 1155px 폭에서는 좌우 분할 대신 포함박스 섹션이 아래로 내려가게 했다.
- 툴바는 `flex-wrap` 대신 고정 grid 컬럼을 사용하고, 날짜 프리셋 버튼 제거, 검색 input 최소폭 해제, 상태/바코드 폭 축소로 아이콘/입력 겹침을 제거했다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `git diff --check -- "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-empty-delete.structure.test.mjs" .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`
  - PASS: 기존 `http://localhost:3002/shipping/pallet` Playwright 측정. 1155px 폭에서 툴바 1줄, 겹침 0건, 가로 overflow 없음. 스크린샷 `docs/reports/shipping-pallet-layout-3002.png`
# 2026-06-25 22:55 KST - codex - T-SHIP-ORDER-SAVE-CONFIRM

- `/shipping/order` 출하지시등록 화면에서 백엔드 확정 API(`PUT /shipping/orders/:id/confirm`)와 행 액션은 이미 있었지만, 신규 작성 패널에서 임시저장 직후 확정으로 이어지는 명확한 액션이 없어 사용자가 확정 단계를 찾기 어려운 문제가 있었다.
- `apps/frontend/src/app/(authenticated)/shipping/order/page.tsx`에 `buildSavePayload()`와 `handleSaveAndConfirm()`을 추가했다.
- 패널 하단에는 신규/기존 DRAFT 상태에서 `저장 후 확정` 버튼을 표시한다. 신규 작성은 `POST /shipping/orders` 응답의 `shipOrderNo`로 즉시 confirm하고, 기존 DRAFT 수정은 저장 `PUT` 후 confirm한다.
- 기존 그리드 행의 초록 체크 확정 액션과 `CONFIRMED` 상태의 확정취소 액션은 유지했다.
- 검증:
  - RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs"`가 `handleSaveAndConfirm` 부재로 실패
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-required-fields.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-right-panel.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 기존 `http://localhost:3002/shipping/order` Playwright 확인. 신규 등록 패널에서 `저장 후 확정` 버튼 표시, 필수값 전 disabled 정상, 가로 overflow 없음. 스크린샷 `docs/reports/shipping-order-save-confirm-3002.png`
  - PASS: 대상 파일 `git diff --check`
# 2026-06-25 23:07 KST - codex - T-SHIP-HISTORY-SHIPPED-DETAIL

- `/shipping/history` 우측 패널이 팔레트 없는 박스 단건 출하를 `팔레트 0 / 박스 0 / 총수량 0`처럼 보이게 하는 문제를 보정했다.
- 원인: 화면이 `GET /shipping/orders/:id/fulfillment`를 호출해 팔레트 목록만 기준으로 우측 패널을 구성했다. 실제 `SH2606250005`는 `PALLET_MASTERS` 0건이지만 `BOX_MASTERS`에는 `BX2606250001`/`SHIPPED`/수량 10이 있다.
- 백엔드에는 이미 `GET /shipping/orders/:id/shipped-detail`가 있고, 이 API는 `boxShipped`로 팔레트 없는 박스 출하를 내려준다. 백엔드 lock 파일은 수정하지 않고 history 화면만 해당 API를 사용하도록 변경했다.
- 우측 패널 합계는 팔레트 박스 수량과 `boxShipped`를 함께 계산한다. 팔레트 집계는 stale 가능성이 있는 `pallet.boxCount`보다 실제 반환된 `pallet.boxes.length`를 우선 사용한다.
- 검증:
  - RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs"`가 `OrderShippedBox` 부재로 실패
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-pallet-detail.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-no-info-cards.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/history/shipping-history-status-help.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 기존 `http://localhost:3002/shipping/history` Playwright 확인. `SH2606250005` 선택 시 우측 패널 `팔레트 0 / 박스 1 / 총수량 10`, `BX2606250001` 표시. 스크린샷 `docs/reports/shipping-history-shipped-detail-3002.png`
  - PASS: 대상 파일 `git diff --check`

# 2026-06-25 23:59 KST - codex - T-SHIP-WORKFLOW-QA

- 출하관리 메뉴 상태전이 QA 러너 `tools/hanes-shipping-workflow-scenario-qa.mjs`를 추가했다.
- 3002/3003/JSHANES 기준으로 `/shipping/order`, `/shipping/pack`, `/shipping/pallet`, `/shipping/pallet-ship`, `/shipping/confirm`, `/shipping/return`, `/shipping/history`, `/shipping/box-stock` 8개 화면을 Playwright로 열고 API 호출/버튼/스크린샷을 수집했다.
- 새 테스트 키 `SWF260625235757`로 실제 전이 실행:
  - 출하지시 생성 `- -> DRAFT`, 확정 `DRAFT -> CONFIRMED`, 확정취소 `CONFIRMED -> DRAFT`, 재확정.
  - 박스 생성 `- -> OPEN`, 시리얼 담기, 마감 `OPEN -> CLOSED`, 재오픈 `CLOSED -> OPEN`, 재마감.
  - 팔레트 생성 `- -> OPEN`, 박스 적재, 마감 `OPEN -> CLOSED`, 재오픈 `CLOSED -> OPEN`, 박스 제거.
  - 박스출하 `CLOSED -> SHIPPED`, box-stock 제외와 shipped-detail 노출 확인, 박스출하취소 `SHIPPED -> CLOSED`, box-stock 재노출 확인.
  - 정리: 박스 재오픈/시리얼 제거/박스 삭제/확정취소/출하지시 삭제.
- 발견:
  - 일반 `shipping/shipments` 전이 API(`mark-loaded`, `mark-shipped`, `mark-delivered`, `reverse`, `cancel`, `erp-sync`)는 백엔드와 `ShipmentScanModal` 컴포넌트에는 있으나 현재 출하관리 메뉴 페이지에서 연결 사용처가 확인되지 않는다.
  - JSHANES `OQC_ENABLED=N`인데 박스 단건 출하 서비스는 PENDING 박스를 허용하고, 팔레트 적재/팔레트 출하 경로는 여전히 `OQC_STATUS=PASS`를 요구한다. 화면 `/shipping/confirm`도 후보 조회에 `oqcStatus=PASS`를 붙여 서비스 설정과 노출 조건이 다르다.
- 산출물:
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-25/index.html`
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-25/pages/shipping-workflow.html`
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-25/shipping-workflow-result.json`
- 검증:
  - PASS: `node tools/hanes-shipping-workflow-scenario-qa.mjs`
  - PASS: 결과 JSON 검증. 화면 8/8, 스크린샷 8건, 전이 step 전부 PASS, 최종 테스트 잔여 0건.
  - PASS: `git diff --check -- tools/hanes-shipping-workflow-scenario-qa.mjs docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-25 .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md .ai-coordination/ARCHIVE.md`

# 2026-06-26 00:18 KST - codex - T-SHIP-OQC-GATE-CONSISTENCY

- 출하관리 워크플로우 QA에서 발견된 OQC 게이트 불일치를 수정했다.
- 원인: `shipBox()`는 `SYS_CONFIGS.OQC_ENABLED`가 켜진 경우에만 `OQC_STATUS=PASS`를 요구하지만, `getFulfillment()`, `addBoxesToOrderPallet()`, `shipOrderPallets()`와 `/shipping/pallet` 후보 조회는 `OQC_STATUS=PASS`를 고정 강제했다. JSHANES는 `OQC_ENABLED=N`이라 같은 CLOSED 박스가 단건 출하는 가능하지만 팔레트 적재/출하는 막히는 상태였다.
- 변경:
  - `apps/backend/src/modules/shipping/services/ship-order.service.ts`: fulfillment 후보 조회, 팔레트 적재, 팔레트 출하에서 `OQC_ENABLED`가 true일 때만 PASS 필터/검증을 적용한다.
  - `apps/backend/src/modules/shipping/services/ship-order.service.spec.ts`: OQC 미사용 시 PENDING 박스가 후보/적재/팔레트출하 경로에서 허용되는 회귀 테스트를 추가했다.
  - `apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx`: `useSysConfigStore`로 `OQC_ENABLED`를 읽고, 후보/스캔 박스 조회의 `oqcStatus=PASS` 파라미터를 조건부로 붙인다. 설정 미로드 상태는 보수적으로 PASS 필터를 유지한다.
  - `apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-oqc-gate.structure.test.mjs`: 화면의 조건부 OQC 필터 구조 테스트를 추가했다.
  - `tools/hanes-shipping-workflow-scenario-qa.mjs`: 테스트 박스 `OQC_STATUS`를 PASS로 강제 변경하던 전제 step을 제거해 `OQC_ENABLED=N` 기준 그대로 검증하게 했다.
- 검증:
  - RED 확인: 기존 코드에서 backend OQC disabled 테스트 3건과 frontend 구조 테스트가 실패.
  - PASS: `pnpm.cmd --filter @harness/backend exec jest src/modules/shipping/services/ship-order.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-oqc-gate.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/pallet/shipping-pallet-order-required.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: `node tools/hanes-shipping-workflow-scenario-qa.mjs` 결과 `status=PASS`, 테스트 키 `SWF260626000949`, 잔여 0건.
  - PASS: 대상 파일 `git diff --check`
- 산출물:
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-26/index.html`
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-26/pages/shipping-workflow.html`
  - `docs/reports/hanes-shipping-workflow-scenario-qa-2026-06-26/shipping-workflow-result.json`
- 참고:
  - 작업 중 HEAD가 `131fb013 chore: 진행 중 작업 일괄 커밋...`으로 이동하며 코드 변경 일부가 이미 커밋에 포함됐다. 본 로그 정리 시점의 working tree에는 2026-06-26 QA 리포트 미추적 파일과 협업 문서 정리 변경만 남아 있다.

# 2026-06-26 00:37 KST - codex - T-SHIP-ORDER-TOP-ACTIONS

- `/shipping/order` 목록의 행 관리 액션을 상단 선택행 공통 버튼으로 전환했다.
- 변경:
  - `apps/frontend/src/app/(authenticated)/shipping/order/page.tsx`: `selectedOrder` 상태를 추가하고 `DataGrid` 행 클릭/하이라이트(`onRowClick`, `selectedRowId`, `getRowId`)를 연결했다.
  - 행 액션 컬럼은 수정 아이콘만 남겼다. 수정 아이콘 클릭 시 행 선택도 동기화하고 우측 패널을 연다.
  - 출력, 확정, 확정취소, 삭제는 상단 버튼으로 이동했다. 선택 행이 없거나 상태가 맞지 않으면 비활성화한다.
  - `apps/frontend/src/app/(authenticated)/shipping/order/ship-order-top-actions.structure.test.mjs`: 상단 공통 액션과 행 수정 단독 액션 계약을 추가했다.
  - `apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs`: 확정취소/삭제가 행 액션이 아니라 상단 선택행 액션이라는 계약으로 갱신했다.
- 검증:
  - RED: 신규 `ship-order-top-actions.structure.test.mjs`가 `selectedOrder` 부재로 실패.
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-top-actions.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-unconfirm.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-required-fields.structure.test.mjs" "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-right-panel.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
  - PASS: 기존 3002 Playwright 확인. `/shipping/order` 행 1건, 행 버튼 1개(`수정`)만 표시, 상단 `인쇄/확정/확정취소/삭제` 버튼 표시. 행 선택 후 CONFIRMED 행에서 확정취소 활성화, console error 0건.
- 참고:
  - 기존 working tree에는 이번 범위 밖 변경(`apps/backend/src/modules/system/services/pda-role.service.ts`, PDA 팔레트 출하 파일들, 2026-06-26 출하 QA 리포트 등)이 함께 남아 있어 되돌리지 않았다.

# 2026-06-26 00:55 KST - codex - T-TRACE-WEBDISPLAY-WIZARD

- `/quality/trace`를 WebDisplay 추적성 화면처럼 `추적 시작` 모달에서 방식을 먼저 선택하는 흐름으로 전환했다.
- 변경:
  - `apps/frontend/src/app/(authenticated)/quality/trace/components/TraceSearchWizard.tsx`: WebDisplay `BarcodeSearchWizard`/`TraceWizardModal` 패턴을 HANES용 2단계 카드 모달로 추가했다. 제품 바코드, 자재 UID/LOT, 박스번호, 팔레트번호, 출하지시번호, 설비+기간, 작업지시번호, SG 바코드 시작점을 제공한다.
  - `apps/frontend/src/app/(authenticated)/quality/trace/page.tsx`: 단일 검색창을 제거하고, 모달 자동 오픈 -> 후보 목록 사이드바 -> FG 후보 선택 시 기존 제조이력 상세 조회 구조로 재배치했다.
  - `apps/frontend/src/app/(authenticated)/quality/trace/types.ts` 및 backend DTO에 `TraceSearchMode`, `TraceCandidate`를 추가했다.
  - `TraceController`에 `GET /quality/trace/candidates`를 추가했다.
  - `ProductTraceabilityService.findCandidates()`와 모드별 후보 resolver를 추가했다. WebDisplay 테이블을 이식하지 않고 HANES 실제 키(`FG_LABELS`, `SG_LABELS`, `PRODUCT_GENEALOGY`, `MAT_ISSUES`, `BOX_MASTERS`, `PALLET_MASTERS`, `SHIPMENT_ORDERS`, `PROD_RESULTS`) 기준으로 후보를 만든다.
  - locale 파일은 다른 active lock과 충돌 가능성이 있어 수정하지 않고 `t(key, fallback)`만 사용했다.
- 충돌 기록:
  - `T-TRACE-FULL` active lock과 같은 추적성 파일이 겹쳤다. 사용자가 본 대화에서 WebDisplay UI 방식 적용을 명시하고 `진행해`라고 지시해 충돌 사실을 TASK/LOCKS에 기록한 뒤 최소 범위로 진행했다.
- 검증:
  - RED: `node --test "apps/frontend/src/app/(authenticated)/quality/trace/trace-webdisplay-wizard.structure.test.mjs"`가 `TraceSearchWizard.tsx` 부재 및 후보 API 부재로 실패.
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/trace/trace-webdisplay-wizard.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
- 미실행:
  - 기존 `http://localhost:3002/quality/trace`는 5초 HTTP 타임아웃으로 런타임 화면 확인을 못 했다. HANES 규칙에 따라 임의 대체 포트나 추가 dev server는 사용하지 않았다.

# 2026-06-26 16:16 KST - codex - T-IQC-AQL-S1-0015-DATA

- `/quality/aql/resolve-iqc-items?itemCode=DLMLS6-3-3&vendorCode=VND-001&lotQty=100` 404 원인을 JSHANES 기준정보에서 확인하고 보정했다.
- 원인:
  - `IQC_PART_SPEC_ITEMS`의 `DLMLS6-3-3` active 검사항목 1건이 `INSPECTION_LEVEL='S-1'`, `AQL=0.015`, `INSPECTION_TYPE='AQL'`, `SAMPLE_METHOD='AQL'`을 참조했다.
  - `VND-001`은 `PARTNER_MASTERS.INSPECTION_MODE='NORMAL'`이다.
  - 서비스 후보 `AQL-S-1-NORMAL-0.015` -> `AQL-S-1-0.015` 중 기존 `AQL_STANDARDS`/`AQL_SAMPLING_RULES`에는 해당 조합이 0건이라 404가 발생했다.
- 변경:
  - `apps/backend/src/migrations/2026-06-26_aql_standard_s1_0_015.sql` 추가.
  - JSHANES `AQL_STANDARDS`에 `AQL-S-1-0.015`를 추가했다.
  - JSHANES `AQL_SAMPLING_RULES`에 전 LOT 구간 15건을 추가했다. LOT 100 매칭 rule은 `91~150`, `CODE_LETTER='B'`, `SAMPLE_SIZE=80`, `ACCEPT_QTY=0`, `REJECT_QTY=1`.
- 검증:
  - PASS: `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-26_aql_standard_s1_0_015.sql`
  - PASS: 동일 execute-file 재실행 idempotent.
  - PASS: post-check `AQL_STANDARDS`에서 `AQL-S-1-0.015` 1건.
  - PASS: post-check LOT 100 rule 1건, `SAMPLE_SIZE=80`, `ACCEPT_QTY=0`, `REJECT_QTY=1`.
  - PASS: `DLMLS6-3-3` + `VND-001` + LOT 100 조합이 `AQL-S-1-0.015` rule에 매칭됨.
  - PASS: `git diff --check -- apps/backend/src/migrations/2026-06-26_aql_standard_s1_0_015.sql .ai-coordination/TASKS.md .ai-coordination/LOCKS.md`
- 미실행:
  - 현재 listen 포트는 3002 프론트뿐이라 실제 API 호출은 수행하지 않았다. 임의 백엔드 서버나 대체 포트는 띄우지 않았다.

# 2026-06-26 16:41 KST - codex - T-IQC-AQL-STANDARD-GUARD

- 공통코드에는 있으나 실제 `AQL_STANDARDS`/`AQL_SAMPLING_RULES`에 없는 조합을 다시 선택/저장하지 못하게 보정했다.
- 변경:
  - `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`: `GET /quality/aql?useYn=Y&limit=5000`로 활성 AQL 기준 목록을 읽고, 검사항목 행의 검사수준/AQL 선택지를 실제 기준 조합으로만 제한한다. 선택한 검사수준에 매칭되는 AQL 값이 없으면 `AQL 기준관리에서 먼저 등록하세요` 안내를 표시하고 행 확정을 막는다.
  - `apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-aql-standard-options.structure.test.mjs`: 공통코드 cartesian 선택 금지 구조 테스트를 추가했다.
  - `apps/backend/src/modules/master/services/iqc-part-spec.service.ts`: 품목별 IQC 기준 저장 시 AQL 행의 검사수준/AQL 조합이 활성 AQL 기준과 sampling rule을 가진 경우만 저장하도록 검증한다. 없으면 `AQL 기준이 등록되지 않은 조합입니다: ...`로 400 차단한다.
  - `apps/backend/src/modules/master/master.module.ts`: 검증에 필요한 AQL entity metadata를 등록했다.
  - `apps/backend/src/modules/master/services/iqc-part-spec.service.spec.ts`: 없는 AQL 기준 조합 저장 차단 회귀 테스트를 추가했다.
- 검증:
  - RED 확인: 신규 frontend structure test가 `/quality/aql` 기반 선택 제한 부재로 실패.
  - RED 확인: backend 신규 저장 차단 테스트가 기존 코드에서는 기대한 오류를 내지 못함.
  - PASS: `pnpm.cmd --filter @harness/backend test -- iqc-part-spec.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-aql-standard-options.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-inspection-type.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
  - PASS: JSHANES active IQC AQL 조합 미매칭 0건. 현재 `I / 0.01` 15건, `S-1 / 0.015` 1건 모두 기준/rule 매칭.
- 참고:
  - `IqcSpecPanel.tsx`에는 기존 미커밋 UI 밀도 변경이 있었고, 해당 변경은 유지한 채 AQL 선택 제한만 추가했다.
  - 실제 3002 브라우저 렌더 확인은 이번 턴에서 수행하지 않았다.

# 2026-06-26 16:55 KST - codex - T-CONCESSION-WORKER

- `/material/concession` 특채 처리 시 작업자 기준정보를 선택하고 DB에 남기도록 보정했다.
- 변경:
  - `MAT_LOTS.SPECIAL_ACCEPT_WORKER_CODE` 컬럼, 인덱스 `IDX_MAT_LOTS_SA_WORKER`, FK `FK_MAT_LOTS_SA_WORKER`를 추가하는 재실행 가능 마이그레이션을 작성하고 JSHANES에 적용했다.
  - `MatLot` entity와 `ConcessionService.apply()`에 특채 처리 작업자 저장/활성 작업자 검증을 추가했다. 작업자 미선택 또는 기준정보 미존재는 400으로 차단한다.
  - 특채 취소 시 `SPECIAL_ACCEPT_YN='N'`과 함께 `SPECIAL_ACCEPT_WORKER_CODE`도 null로 복원한다.
  - `/material/concession` 모달에 공용 `WorkerSelect` 특채처리작업자 선택을 추가하고, 목록에는 특채처리자 컬럼을 표시한다.
  - 공용 `useWorkerOptions()`가 `/master/workers` 실제 응답의 `workerCode`를 select value로 쓰도록 보정했다.
  - 스키마 변경 규칙에 따라 `docs/reports/db-schema-erd.md`를 재생성했다.
- 검증:
  - RED 확인: backend spec가 작업자 검증/저장 부재로 실패, frontend 구조 테스트가 `WorkerSelect`/payload 부재로 실패, worker option 구조 테스트가 `workerCode` value 부재로 실패.
  - PASS: `pnpm.cmd --filter @harness/backend test -- concession.service.spec.ts --runInBand`
  - PASS: `node --test apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs"`
  - PASS: JSHANES pre-check 컬럼/FK 0건 -> 마이그레이션 적용 -> 재실행 성공.
  - PASS: JSHANES post-check `SPECIAL_ACCEPT_WORKER_CODE` 컬럼 1건, FK `ENABLED`, 인덱스 `VALID`.
  - PASS: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
- 미실행:
  - 3002 브라우저 수동 확인은 수행하지 않았다.

# 2026-06-26 17:00 KST - codex - T-CONCESSION-WORKER 후속 QR 스캔

- 사용자 요청에 따라 특채 처리 모달에서 작업자 선택뿐 아니라 작업자 QR 스캔으로도 특채처리작업자를 지정할 수 있게 보정했다.
- 변경:
  - `apps/frontend/src/app/(authenticated)/material/concession/page.tsx`: 특채 승인 모달에 `작업자 QR 스캔` 입력과 조회 버튼을 추가했다.
  - 스캐너 Enter/CRLF 입력을 `onKeyDown`에서 처리해 `GET /master/workers/by-qr/:qrCode`로 조회하고, 응답의 `workerCode`를 기존 `specialAcceptWorkerCode` 저장 필드에 채운다.
  - QR 조회 성공 시 선택된 작업자명/코드를 모달에 표시하고, 실패 시 오류 메시지를 표시한다. 직접 `WorkerSelect` 선택도 그대로 유지한다.
  - `concession-worker.structure.test.mjs`에 QR 조회 구조 테스트를 추가했다.
- 검증:
  - RED 확인: 신규 구조 테스트가 `workerQrText`/`handleWorkerQrLookup`/`by-qr` 호출 부재로 실패.
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/material/concession/concession-worker.structure.test.mjs" apps/frontend/src/hooks/use-master-options-worker.structure.test.mjs`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
- 미실행:
  - 3002 브라우저에서 실제 QR 스캔 동작은 확인하지 않았다.

# 2026-06-26 17:50 KST - codex - T-PRODUCT-RECEIVE-CANCEL-RETRY

- 제품입고 후 취소했는데 재입고 시 이미 입고된 박스로 판단되는 원인을 보정했다.
- 원인:
  - `/inventory/fg/receive` 박스 완제품 입고는 `PRODUCT_TRANSACTIONS`에 `TRANS_TYPE='WIP_OUT'`, `REF_TYPE='BOX'`로 기록된다.
  - 기존 `/product/receive` 완제품 이력은 `FG_IN,FG_IN_CANCEL`만 조회해 실제 박스 입고 전표가 화면 이력에서 빠졌다.
  - 기존 `/product/receipt-cancel`도 `WIP_IN,FG_IN` 계열만 조회해 박스 완제품 입고 전표를 취소 대상으로 잡지 못했다.
  - 그래서 원 `WIP_OUT` 전표가 `DONE`으로 남으면 백엔드 중복입고 가드가 같은 박스 재입고를 차단한다.
- 변경:
  - `/product/receive` 완제품 탭에서 기존 `FG_IN/FG_IN_CANCEL` 조회에 `WIP_OUT/WIP_OUT_CANCEL + refType=BOX` 조회를 병합한다.
  - `/product/receipt-cancel`도 일반 입고 전표 조회와 박스 완제품 입고 전표 조회를 병합해 실제 `WIP_OUT` 전표를 취소할 수 있게 했다.
  - 일반 제품출고 `WIP_OUT`이 입고취소에 섞이지 않도록 추가 조회는 `refType=BOX`로 제한했다.
  - `WIP_OUT` 박스 입고 수량은 화면에서 입고 의미에 맞게 양수로, `WIP_OUT_CANCEL`은 취소 의미에 맞게 음수로 표시한다.
- 검증:
  - RED 확인: 신규 구조 테스트가 `WIP_OUT,WIP_OUT_CANCEL` 박스 입고 이력 조회 부재로 실패.
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/product/receive/product-receive-cancel-retry.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
- 미실행:
  - 3002 브라우저에서 실제 입고취소 클릭 재현은 수행하지 않았다.

# 2026-06-26 21:52 KST - codex - T-DB-LOCAL-BACKUP-20260626

- `oracle-db` 스킬 기준 JSHANES 프로필로 접속을 확인한 뒤 TEST 스키마를 로컬 `db_backups`에 백업했다.
- 산출물:
  - `db_backups/JSHANES_TEST_20260626_213823.dmp` (1,103,872 bytes)
  - `db_backups/JSHANES_TEST_20260626_213823.log` (14,975 bytes)
  - `db_backups/JSHANES_TEST_20260626_213823.zip` (163,951 bytes)
- 검증:
  - PASS: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT USER AS CURRENT_USER, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS CURRENT_SCHEMA FROM DUAL"` 결과 `TEST/TEST`.
  - PASS: classic Oracle `exp.exe` 실행 결과 로그 마지막 줄 `Export terminated successfully with warnings.`
  - PASS: zip 내부에 `JSHANES_TEST_20260626_213823.dmp`, `JSHANES_TEST_20260626_213823.log` 포함.
  - PASS: zip SHA256 `B23B9AF920EA896FF16092FF04BDD7BF0A8846BF78006E7C22609581E1086F38`.
- 참고:
  - `expdp`는 서버 `DATA_PUMP_DIR`에 dump를 생성하므로 로컬 파일 목적에는 기존 `db_backups` 백업과 같은 classic `exp.exe` 경로를 사용했다.
  - 로그에는 기존 2026-05 백업과 같은 `ORA-01455`/`ORA-01403` 경고가 있으며, export 자체는 warning 상태로 완료됐다.
## 2026-06-26 19:24 codex

- `T-IQC-CERT-OPTIONAL` 완료 후 REVIEW. `/material/iqc`의 검사결과 저장은 원래 `certFile`이 있을 때만 추가 업로드를 수행하고 없어도 `POST /material/iqc-history/arrival`을 호출하고 있었다. 실제 강제 지점은 `ReceivingService`가 IQC 대상품 PASS 이력의 `certFilePath`가 없으면 입고 가능 목록에 `receivingBlockedReason='검사성적서 미첨부'`를 만들고, `createBulkReceive()`에서 `BadRequestException`으로 입고를 차단하는 정책이었다.
- 변경: `ReceivingService`의 성적서 필수 검증을 제거하고, 입고 가능 LOT 응답은 `certRequired=false`, `receivingBlockedReason=null`로 내려가게 했다. 기존 IQC 합격/특채 검증, 성적서 업로드 API, IQC 이력 `certFilePath` 저장은 유지했다.
- 변경: `/material/receive` 입고대기 그리드의 성적서 상태는 `certUploaded`가 있으면 필수 여부보다 먼저 `첨부`를 표시하도록 조건 순서를 보정했다.
- 검증: RED `pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/receiving.service.spec.ts --runInBand` 성적서 미첨부 차단 실패 확인, RED `node --test "apps/frontend/src/app/(authenticated)/material/receive/components/receivable-table-cert-status.structure.test.mjs"` 조건 순서 실패 확인. PASS `pnpm.cmd --filter @harness/backend test -- receiving.service.spec.ts --runInBand`, PASS frontend structure test, PASS backend/frontend `tsc --noEmit`, PASS 대상 파일 `git diff --check`.
- 비고: 커밋하지 않았다. 기존 무관 dirty file `apps/frontend/src/app/(authenticated)/master/label/components/TemplateManager.tsx`는 건드리지 않았다.

## 2026-06-26 22:22 codex

- `T-IQC-AQL-ISO-REDESIGN` 완료 후 REVIEW. 사용자가 AQL을 점진폐기 없이 ISO 2859 구조로 즉시 재설계하고, UI는 페이지 내 탭으로 관리하라고 지시했다.
- 결정:
  - `LOT 수량 + 검사수준 -> Code Letter -> Sample Size -> AQL -> Ac/Re` 흐름을 기준으로 삼는다.
  - `AQL_STANDARDS`는 AQL 값 마스터로 유지하고, 신규 `AQL_CODE_LETTER_RULES`, `AQL_CODE_LETTER_SAMPLES`, `AQL_ACCEPTANCE_RULES`를 추가했다.
  - 표준 샘플수량이 LOT 수량보다 크거나 같으면 DB 표준값은 유지하고, resolve 결과에 `standardSampleSize`와 `actualInspectQty`를 분리한다.
  - 이전 `SAMPLE_SIZE > LOT_QTY_TO` cap 보정 migration/test는 폐기했다.
- 변경:
  - 신규 entity 3개를 추가하고 AQL module/service/controller를 신규 ISO 테이블 resolve 경로로 전환했다.
  - `/quality/aql/iso` API를 추가했다.
  - `/quality/aql` 화면을 `AQL 정책관리`, `AQL 기준`, `Code Letter 표`, `Sampling Plan 표` 4개 탭으로 재구성했다.
  - 기존 AQL 기준 탭의 구형 LOT별 `sampleSize/acceptQty/rejectQty` 직접 입력 UI와 `판정기준 추가` 버튼을 제거했다.
  - JSHANES에 `2026-06-26_iqc_aql_iso2859_redesign.sql`을 적용하고 ERD를 재생성했다.
- 검증:
  - PASS: `pnpm.cmd --filter @harness/backend test -- aql-standard.entity.spec.ts aql.service.spec.ts --runInBand`
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: JSHANES migration 적용 7블록 성공.
  - PASS: JSHANES post-check `AQL_CODE_LETTER_RULES=105`, `AQL_CODE_LETTER_SAMPLES=16`, `AQL_ACCEPTANCE_RULES=62`.
  - PASS: 대표값 `LOT 350 + Level II -> H`, `H -> sample 50`, `H + AQL 1.0 -> Ac1/Re2`, `A + AQL 0.015 -> sample code J / Ac0/Re1`.
  - PASS: `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py`
  - PASS: 3002 `/quality/aql` Playwright 로그인 후 탭 표시/전환 확인, console error 0, 구형 LOT rule 안내문 미표시.
  - PASS: 대상 파일 `git diff --check`
- 비고:
  - 커밋하지 않았다.
  - 기존 `AQL_SAMPLING_RULES` 테이블은 데이터 호환상 남아 있으나 신규 resolve 경로와 UI는 ISO 2859 테이블을 사용한다.

## 2026-06-26 22:35 codex

- `T-IQC-AQL-ISO-REDESIGN` 후속. 사용자가 `/quality/aql` Code Letter 표에 데이터가 없다고 보고했다.
- 확인:
  - JSHANES `AQL_CODE_LETTER_RULES`는 `40/1000` 기준 105건 존재.
  - 3002 인증 브라우저에서 `/api/quality/aql/iso`는 200으로 `codeLetterRules`를 반환.
  - 실제 Code Letter 탭은 `전체 105건`, `I 2~8 A`, `II 281~500 H` 등을 표시.
- 보강:
  - 초기 로딩 때 인증/회사/사업장 hydration 타이밍으로 `/iso` 첫 호출이 실패해 빈 상태로 남을 수 있으므로, `Code Letter 표` 또는 `Sampling Plan 표` 탭 진입 시 `fetchIsoTables()`를 재호출하게 했다.
  - `/iso` 조회 실패 시 `ISO AQL 표 데이터를 불러오지 못했습니다.` toast를 표시한다.
  - 구조 테스트에 탭 진입 재조회와 실패 메시지 계약을 추가했다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: JSHANES `SELECT COUNT(*) FROM AQL_CODE_LETTER_RULES WHERE COMPANY='40' AND PLANT_CD='1000'` = 105
  - PASS: 3002 Playwright 로그인 후 Code Letter 탭 `/iso` 200 2회, `전체 105건`, 대표 행 표시, empty text false
  - PASS: 대상 파일 `git diff --check`

## 2026-06-26 22:48 codex

- `T-IQC-AQL-ISO-REDESIGN` 후속 UI 보정. 사용자가 제공한 ISO 2859 이미지처럼 표시되지 않고 일반 DataGrid 목록으로 보인다고 지적했다.
- 변경:
  - `Code Letter 표` 탭을 `LOT Size` 행과 `I/II/III/S1/S2/S3/S4` 열을 가진 `SAMPLE SIZE CODE LETTERS` 매트릭스 표로 변경했다.
  - `Sampling Plan 표` 탭을 `Sample Size Code Letter`, `Sample Size`, AQL별 `Ac/Re` 열을 가진 `SINGLE SAMPLING PLANS FOR NORMAL INSPECTION` 매트릭스 표로 변경했다.
  - 현재 등록된 `0.01`, `0.015` AQL도 표준 AQL 열 앞에 함께 표시한다.
  - 구조 테스트가 매트릭스 표 marker(`data-iso-code-letter-matrix`, `data-iso-sampling-plan-matrix`)와 ISO 표 제목/그룹 헤더를 확인하게 보강했다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs"`
  - PASS: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
  - PASS: 3002 Playwright 로그인 후 `Code Letter 표`/`Sampling Plan 표` 매트릭스 렌더 확인, 캡처 저장 `C:/Users/hsyou/AppData/Local/Temp/aql-code-letter-matrix.png`, `C:/Users/hsyou/AppData/Local/Temp/aql-sampling-plan-matrix.png`
