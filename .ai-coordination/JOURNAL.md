# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

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
