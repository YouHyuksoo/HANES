# JOURNAL

이 파일은 최근 진행과 검증의 짧은 기록만 유지한다. 과거 장문 상세는 이 파일의 git history에서 확인한다.

## 2026-06-29 06:07 KST - codex - coordination 기록 압축

- 사용자 요청으로 `.ai-coordination/HANDOFF/codex.md`와 `.ai-coordination/JOURNAL.md`의 장문 누적 내용을 압축했다.
- 보존 기준:
  - 다음 세션이 바로 이어받아야 하는 현재 상태만 handoff에 남긴다.
  - 완료 상세, 긴 검증 로그, 오래된 REVIEW 목록은 반복하지 않는다.
  - 오래된 세부 내용은 git history로 확인한다.
- 수정 파일:
  - `.ai-coordination/HANDOFF/codex.md`
  - `.ai-coordination/JOURNAL.md`
- 검증:
  - PASS `git diff --check -- .ai-coordination/HANDOFF/codex.md .ai-coordination/JOURNAL.md`

## 2026-06-29 06:03 KST - codex - T-ARCH-PAGE-RULE-REFORM 시작

- Coordination이 enabled 상태로 확인됐다.
- `T-ARCH-PAGE-RULE-REFORM`은 page.tsx 축소, 컬럼 분리, 업무 규칙 중앙화, 필드 영향 경로 표준화를 위한 작업이다.
- 산출물:
  - `docs/reports/architecture-improvement-candidates.md`
- 주의:
  - `master/*` 다수는 `T-MASTER-UNSAVED-GUARD` active lock과 겹친다.
  - 출하 서비스는 `T-SHIP-ORDER-CANCEL` active lock과 겹친다.
  - lock 해소 전 겹치는 소스 파일을 임의 수정하지 않는다.

## 2026-06-29 - codex - route code-map generator

- 커밋 완료:
  - `2f783199 Add route code map generator`
- 포함:
  - `tools/code-map/src/generate.mjs`
  - `tools/code-map/tests/pilot-code-map.test.mjs`
  - `.code-map/index.json`
  - `docs/reports/code-map.md`
  - `package.json`
  - `pnpm-lock.yaml`
- 기능:
  - 메뉴 route 기준으로 page/import graph/API/Controller/Service/Entity/Table을 추적한다.
  - API별 Service method 정의 라인과 method 내부 테이블 접근을 표시한다.
  - Entity 컬럼 요약과 PK/nullable 정보를 표시한다.
- 검증:
  - PASS `pnpm.cmd code-map:test`
  - PASS `pnpm.cmd code-map:generate`
  - PASS `git diff --cached --check`

## 현재 위험 / 참고

- 현재 작업트리는 code-map 커밋 이후에도 의도적으로 dirty 상태다.
- dirty application files는 다른 진행 작업일 수 있으므로 되돌리거나 한꺼번에 stage하지 않는다.
- `.ai-coordination/LOCKS.md`의 active/stale lock을 먼저 확인하고 다음 작업을 시작한다.

## 2026-06-29 06:11 KST - codex - T-ARCH-PAGE-RULE-REFORM system/department 컬럼 분리

- active lock이 없는 `/system/department` 화면부터 컬럼 분리를 적용했다.
- 변경:
  - `apps/frontend/src/app/(authenticated)/system/department/departmentColumns.tsx` 신규 추가. `createDepartmentGridColumns()`로 DataGrid 컬럼, 행 수정/삭제 버튼, 사용여부 배지를 분리했다.
  - `apps/frontend/src/app/(authenticated)/system/department/types.ts` 신규 추가. page와 form panel의 `Department` 타입 출처를 통일했다.
  - `apps/frontend/src/app/(authenticated)/system/department/page.tsx`는 인라인 `ColumnDef` 배열을 제거하고 `createDepartmentGridColumns()` 호출만 남겼다.
  - `apps/frontend/src/app/(authenticated)/system/department/components/DepartmentFormPanel.tsx`는 로컬 중복 타입 대신 `../types`를 사용한다.
  - `apps/frontend/src/app/(authenticated)/system/department/department-columns.structure.test.mjs` 신규 추가. page에 `ColumnDef`/`accessorKey`가 다시 들어가지 않도록 구조 가드를 추가했다.
- 검증:
  - PASS: `node --test "apps/frontend/src/app/(authenticated)/system/department/department-columns.structure.test.mjs"`
  - PASS: `& 'node_modules/.bin/tsc.CMD' -p apps/frontend/tsconfig.json --noEmit --pretty false`
  - PASS: 대상 파일 `git diff --check`
  - FAIL(환경): `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`는 `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]`로 중단됐다. 직접 `tsc`는 통과했다.

## 2026-06-29 06:1x KST — claude — T-MASTER-COLUMN-EXTRACT 기준정보 컬럼 분리 + 공정CAPA 규칙 공통화

- 범위: master/* 인라인 columns 8개 페이지(worker, company, gauge, partner, process-capa, vendor-barcode, work-instruction, equip-inspect-item)를 page별 `*Columns.tsx` 팩토리로 분리(part·worker 패턴). worker는 직접, 나머지 7개는 병렬 서브에이전트 처리 후 중앙 통합/검증.
- 동작 불변: 컬럼 header/size/meta/accessorKey/cell 렌더를 그대로 이동, page는 `useMemo(() => createXxxGridColumns({...}), [동일 deps])`로 소비. action 핸들러만 옵션 주입.
- 업무 규칙 승격: process-capa FE/BE 중복 CAPA 산식을 `packages/shared/src/utils/process-capa-rules.ts`로 단일화.
  - `calcStdUphFromTactTime`(3600/tact 원시값), `capaMultiplier`(설비>0?설비:작업자>0?작업자:1), `calcDailyCapa`(UPH×8×배수×효율, floor).
  - 동작 보존: stdUph 반올림(FE 정수, BE 소수2자리)·dailyCapa 폴백(BE `stdUph||0`,`balanceEff||85`)은 각 호출부 유지. 공유 함수는 순수 산식만.
- 발견(별도 보고): stdUph 자동계산 반올림 FE(정수)/BE(소수2자리) 불일치 — 잠재 버그. 동작 보존 우선이라 통일 안 하고 보고만.
- 미승격(판단): 필수값/`useYn='Y'`/comcode 허용값은 cross-cutting이라 page별 rules 부적절. work-instruction 복합키(`itemCode::processCode::revision`)·vendor-barcode match-type enum은 약한 후보로 보고만(사용자 결정 대기).
- 검증:
  - PASS: frontend `tsc --noEmit` → 0 errors
  - PASS: backend `tsc --noEmit` → 0 errors
  - PASS: `@harness/shared build`(dist 재빌드, 신규 export 반영)
  - PASS: 구조 테스트 24개(컬럼 8 + process-capa rules 3 + equip repoint 2 등) `node --test`
  - PASS: `jest process-capa.service.spec.ts` 5/5
  - 무관 기존 실패: routing-label-issue-flags(SFG vs SG i18n), part 2건 — 본 작업 전부터 실패(part 폴더 HEAD stash로 재현). 미수정(범위 밖).
- 겹침/조율: master page.tsx는 claude `T-MASTER-UNSAVED-GUARD`(동일 owner)와 파일 중복 — 컬럼 분리는 가산적. codex `T-ARCH-PAGE-RULE-REFORM`은 system/department 담당(master/* 미수정) → 실파일 충돌 없음. 사용자 승인 후 진행.
- 상태: 구현+검증 완료, 커밋 전 검토 대기(REVIEW). 미커밋.

## 2026-06-29 07:00 KST - codex - T-ARCH-PAGE-RULE-REFORM active-lock-free 컬럼 분리 확장

- active lock 없는 화면을 대상으로 `page.tsx` 인라인 DataGrid columns를 화면별 컬럼 팩토리로 분리했다.
- 완료 화면:
  - `/system/department`
  - `/production/pack-result`
  - `/equipment/mold`
  - `/production/progress`
  - `/quality/rework-inspect`
  - `/material/scrap`
  - `/production/result-summary`
  - `/equipment/calibration-history`
  - `/equipment/pm-result`
  - `/equipment/pm-plan`
  - `/equipment/inspect-history`
- codex slice는 총 11개 화면 컬럼 분리 완료 상태다.
- `page.tsx`는 데이터 로딩, 필터 상태, 화면 조립만 담당하고, 컬럼 헤더/셀 렌더/상태 배지/표시 색상은 각 `*Columns.tsx`로 이동했다.
- 필요한 화면은 행 타입을 `types.ts`로 분리했다.
- 각 화면에 `*-columns.structure.test.mjs`를 추가해 `page.tsx`로 `ColumnDef`/주요 `accessorKey`가 되돌아오는 것을 감지한다.
- 검증:
  - PASS `node --test "apps/frontend/src/app/(authenticated)/system/department/department-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/pack-result/pack-result-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/equipment/mold/mold-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/progress/progress-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/quality/rework-inspect/rework-inspect-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/material/scrap/scrap-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/result-summary/result-summary-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/equipment/calibration-history/calibration-history-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/equipment/pm-result/pm-result-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/equipment/pm-plan/pm-plan-columns.structure.test.mjs" "apps/frontend/src/app/(authenticated)/equipment/inspect-history/inspect-history-columns.structure.test.mjs"` → 22/22 pass
  - PASS `& 'node_modules/.bin/tsc.CMD' -p apps/frontend/tsconfig.json --noEmit --pretty false`
  - PASS 대상 파일 `git diff --check`

## 2026-06-29 07:55 KST - codex - T-ARCH-PAGE-RULE-REFORM active-lock-free 컬럼 분리 추가 및 커밋 준비

- active lock 없는 화면 7개를 추가로 컬럼 분리했다.
- 추가 완료 화면:
  - `/equipment/mold-mgmt`
  - `/inspection/history`
  - `/inspection/structure`
  - `/interface/log`
  - `/outsourcing/vendor`
  - `/outsourcing/order`
  - `/sales/customer-po`
- 누계:
  - codex slice 총 18개 화면 컬럼 분리 완료.
- 변경 방식:
  - 각 `page.tsx`의 인라인 `ColumnDef` 배열을 화면별 `*Columns.tsx` 팩토리로 이동했다.
  - 액션 셀은 `onEdit`, `onDelete`, `onShowDetail`, `onRetry` 같은 콜백 주입으로 기존 동작을 유지했다.
  - 필요한 화면은 행 타입을 `types.ts`로 분리했다.
  - 각 화면에 `*-columns.structure.test.mjs`를 추가해 컬럼이 다시 `page.tsx`로 들어오는 회귀를 감지한다.
- 검증:
  - PASS 각 추가 화면 구조 테스트.
  - PASS 추가 화면 대상 `git diff --check`.
  - FAIL(범위 밖): 전체 frontend `tsc`는 `quality/aql/page.tsx`의 `HelpHeader` 누락과 `quality/oqc-history/page.tsx`의 컬럼 import 누락으로 실패했다. 두 파일은 다른 세션/범위의 미완성 컬럼 분리 변경이라 수정하지 않았다.

## 2026-06-29 06:2x KST — claude — T-COLUMN-EXTRACT-BATCH2 inventory/consumables/customs/system 18개

- 사용자 "계속해" → 컬럼 분리 스윕 앱 전역 확장. codex T-ARCH(department/pack-result/mold/progress/rework-inspect/scrap/result-summary/calibration-history/pm-result)·hermes(quality/defect)·codex T-ALL-MENU-QA(customs/stock·outsourcing/receive 등)와 미겹치는 18개 선택. lock `T-COLUMN-EXTRACT-BATCH2` 등록.
- 대상 18(전부 병렬 서브에이전트): inventory(material-stock[grid 2]·transaction·stock·product-hold·material-physical-inv·-apply·-history·product-physical-inv·-history) + consumables(life·master·mount) + customs(entry·usage) + system(users·document·training·comm-config).
- 패턴: page 인라인 columns를 `create<Entity>GridColumns(options)` 팩토리로 verbatim 이동. read-only는 옵션 `{t}`(또는 라벨맵), 액션셀은 콜백 주입. useMemo deps 동일. 동작 불변.
- 검증: FE tsc **0 errors**(배치1+2 통합), 구조 테스트 **36/36 pass**(18×2). packages/shared·backend 무수정.
- 누계: master 8 + 본 배치 18 = claude 26개. codex slice 9개 별도.
- 상태: REVIEW 대기, 미커밋. 잔여 앱 페이지(production/quality/material/shipping/equipment/sales/product 등 다수)는 후속 배치 또는 codex 분담.

## 2026-06-29 06:35 KST — claude — T-COLUMN-EXTRACT-BATCH3 quality/* 17개 + 커밋

- quality/* 인라인 columns 17개를 *Columns.tsx 팩토리로 분리(병렬 서브에이전트). quality/defect(hermes)·rework-inspect(codex) 제외.
- 대상: aql(grid2)·audit·capa·change-control·complaint·control-plan·defect-code·fai·msa·oqc·oqc-history·ppap·request-inspect·rework·rework-history·self-inspect-history(grid2)·spc.
- 검증: FE tsc 0 errors, 구조 테스트 34/34. **커밋 cf047e9d**(51 files). batch1+2도 커밋 12b4b4e9(86 files).
- 누계 claude 43개(master 8 + batch2 18 + quality 17). 미푸시.

## 2026-06-29 06:40 KST — claude — T-COLUMN-EXTRACT-BATCH4 material/* 진행 시작

- material/* free 20개(adjustment·arrival-result·arrival-stock·arrival-transaction·concession·hold·iqc-history·lot·lot-merge·lot-split·misc-receipt·physical-inv·physical-inv-history·po·po-status·receipt-cancel·shelf-life·shelf-life-history·shelf-life-reinspect·stock) 컬럼 분리 착수.
- 완료: 20/20 병렬 분리. material/po poStatusMap 타입을 `Record<string, ComCodeItem>`(useComCodeMap 실타입)로 교정. 검증 FE tsc 0, 구조 테스트 40/40. **커밋 55bf02a1**(60 files). 누계 claude 63개.

## 2026-06-29 06:45 KST — claude — T-COLUMN-EXTRACT-BATCH5 production/shipping/product/inspection 착수

- 잔여 free 24개: inspection(integrated·protocol) + product(issue·issue-cancel·receipt-cancel·receive) + production(input-equip·input-inspect·order·repair·result·sample-inspect·specification-setup·wip-material-stock·wip-material-trans) + shipping(box-stock·confirm·customer-po·customer-po-status·history·order·pack·pallet·pallet-ship). 컬럼 분리 착수.
- 완료: 24/24 병렬 분리(box-stock·po-status 등 일부 grid 2개). 검증 FE tsc 0, 구조 테스트 48/48. **커밋 a66f4842**(72 files).

## 2026-06-29 07:00 KST — claude — T-COLUMN-EXTRACT 스윕 완료 요약

- claude slice 총 **87개 화면** 컬럼 분리 완료(master 8 + inventory/consumables/customs/system 18 + quality 17 + material 20 + production/shipping/product/inspection 24) + process-capa CAPA 규칙 @harness/shared 승격.
- 커밋 4개(미푸시): `12b4b4e9`(master+rules 86f), `cf047e9d`(quality 51f), `55bf02a1`(material 60f), `a66f4842`(production/shipping/product/inspection 72f).
- 검증: 매 배치 FE tsc 0, 구조 테스트 전수 pass(총 200+ 케이스). backend tsc 0(process-capa). jest process-capa 5/5.
- 잔여 인라인-컬럼 free 페이지 0. 남은 5개(customs/stock, outsourcing/receive — codex T-ALL-MENU-QA; quality/defect — hermes; sales/customer-po-status — codex; shipping/return — claude T-SHIP-ORDER-CANCEL)는 타 lock 소유라 미착수.
- codex slice(T-ARCH)도 별도로 ~18개 진행/커밋(department·pack-result·mold·progress·rework-inspect·scrap·result-summary·calibration-history·pm-result·pm-plan·inspect-history·mold-mgmt·inspection/history·structure·interface/log·outsourcing/order·vendor·sales/customer-po).
- 발견(미해결): process-capa stdUph 반올림 FE(정수)/BE(소수2자리) 불일치(잠재 버그) — 동작 보존 우선, 사용자 판단 대기.
