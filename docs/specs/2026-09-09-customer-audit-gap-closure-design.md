# 고객 감사지적 갭 보완 설계 (인터록·FIFO·출고요청 IQC·선행 마스터)

작성일: 2026-09-09
근거: 고객 감사 자료 17개 지적 항목을 현재 코드로 실측 리뷰한 결과(같은 날 대화). 사용자 결정 사항을 반영한다.

## 0. 사용자 결정

| 결정 | 값 |
|---|---|
| FIFO 위반 시 서버 동작 | 설정형 `FIFO_ACTION` (BLOCK/WARN), 기본 BLOCK |
| 설비점검 인터록 서버 게이트 기본값 | `EQUIP_INSPECT_INTERLOCK` = Y |
| 김종현 책임 확인 항목 선행 구조 | 계측기 수치 수신, 단자별 압착규격 마스터, 검사보조구(한도견본·홀더) 마스터, IQC 성적서 인쇄 4건 전부. 값은 비워두고 옵션으로 켜고 끈다 |

## 1. 실적 등록 설비점검 서버 게이트 (감사 10P)

현재: 키오스크 프론트만 `dailyInspectDone`/`workerInspectDone`으로 저장 버튼을 막는다. 서버 `ProdResultService.create()`에는 게이트가 없어 다른 실적 화면·API 직접 호출로 우회된다.

설계:
- sys-config 신규 키 `EQUIP_INSPECT_INTERLOCK` (그룹 PRODUCTION, BOOLEAN, 기본 Y).
- `ProdResultService.create()`에서 `assertSelfInspectGates()` 직후 `assertEquipInspectGate(dto, company, plant)` 호출.
  - `dto.equipCode` 없음 또는 설정 N → 통과.
  - `EQUIP_INSPECT_ITEM_POOL`에 해당 설비의 `INSPECT_TYPE='DAILY'`, `USE_YN='Y'` 항목이 하나도 없으면 통과(점검 대상이 아닌 설비).
  - 항목이 있으면 `EquipInspectService.checkAlreadyInspected(equipCode, today, 'DAILY')`가 false일 때 `BadRequestException('설비 일상점검을 완료해야 실적을 등록할 수 있습니다: {equipCode}')`.
  - WORKER 유형도 동일 규칙으로 `orderNo` 기준 검사(풀에 WORKER 항목이 있을 때만).
- `ProductionModule`이 `EquipmentModule`을 import해 `EquipInspectService`를 주입한다. 순환 참조가 나면 `forwardRef`.
- 조업일 판정은 `EquipInspectService.getInspectionStatus`의 operational window 로직을 그대로 쓴다(키오스크와 동일 기준).

## 2. FIFO 강제와 유효기간 차단 (감사 8P)

현재: 가용재고 조회가 입고일 오름차순 정렬 + 화면 ⭐ 권고만. `FIFO_ENABLED`, `FIFO_CRITERIA` 시드는 있으나 읽는 코드가 없다. 만료 LOT 출고 차단 없음.

설계:
- sys-config 키: `FIFO_ENABLED`(기존, Y), `FIFO_CRITERIA`(기존, RECEIVE_DATE|MFG_DATE), 신규 `FIFO_ACTION`(그룹 MATERIAL, SELECT BLOCK|WARN, 기본 BLOCK), 신규 `EXPIRED_ISSUE_BLOCK`(그룹 MATERIAL, BOOLEAN, 기본 Y).
- 순수 규칙 `apps/backend/src/modules/material/rules/fifo.rules.ts`
  - `findOlderIssuableLot(candidate, others, criteria)`: 같은 품목(+같은 창고)의 출고가능 LOT 중 기준일이 candidate보다 빠른 LOT를 반환. 기준일이 null인 LOT는 비교 대상에서 제외(입고일 미상은 순서를 만들지 않는다).
  - `isLotExpired(lot, today)`: `EXPIRE_DATE < today`.
- `MatIssueService`
  - `createInTx` 항목 루프와 `scanIssue`에서 IQC·HOLD 검사 다음에 `evaluateIssuePolicy(lot, warehouseCode, manager)` 호출.
  - 후보 LOT 조회: `MAT_STOCKS`(qty>0, 같은 itemCode, warehouseCode 지정 시 동일 창고) JOIN `MAT_LOTS`(IQC PASS 또는 FAIL+특채, `isMatLotIssuable(status)`), 한 번의 쿼리.
  - 만료 LOT + `EXPIRED_ISSUE_BLOCK=Y` → 항상 차단(`유효기간이 만료된 LOT는 출고할 수 없습니다`).
  - FIFO 위반 + `FIFO_ACTION=BLOCK` → 차단 메시지에 먼저 내보낼 LOT(matUid, 기준일)를 포함.
  - FIFO 위반 + WARN → `warnings: string[]`를 결과에 실어 반환. 컨트롤러 응답 형태를 유지하고 `warnings` 필드만 추가한다.
- 프론트: 출고 응답에 `warnings`가 있으면 toast 경고로 표시(IssueFromRequestModal, BarcodeScanTab 공통 훅 지점 1곳).

## 3. 출고요청 승인 단계 IQC 가용재고 검증 (감사 6P 보강)

현재: 요청 생성·승인은 재고를 보지 않고, 실출고 시점에서만 IQC 차단이 걸린다.

설계:
- `IssueRequestService.getAvailableStockQtyMap()`를 `MAT_LOTS` JOIN으로 바꿔 품목별 `issuableQty`(IQC PASS 또는 FAIL+특채, 상태 issuable, availableQty 합)와 `pendingIqcQty`(IQC PENDING/HOLD 합)를 한 쿼리로 계산.
- 요청 상세(`findByRequestNo`, `flattenItems`) 항목에 `issuableQty`, `pendingIqcQty` 노출.
- `create()`: 차단하지 않는다(입고 후 IQC 전 요청은 정상 업무). 응답에 `warnings`로 "IQC 미검사 재고만 있음" 품목을 안내.
- `approve()`: 정책 `MAT_ISSUE_STOCK_CHECK`(기존, BLOCK|WARN, 기본 BLOCK). 품목별 `requestQty - issuedQty > issuableQty`이면 BLOCK → `BadRequestException`에 품목·부족수량·미검사수량 나열, WARN → 승인 후 `warnings` 반환.
- 프론트 출고요청 화면: 항목 그리드에 `가용(IQC합격)`·`미검사` 컬럼 추가, 승인 응답 `warnings` toast.

## 4. SPC Cpk/Ppk 분리 (감사 14P 결함)

현재 `SpcService.calculateCpk()`는 전체 개별값 표준편차로 계산한 값을 `cpk`로 반환하고 `ppk = cpk`로 복사한다. 이 값은 정의상 Ppk다.

설계:
- Cpk: 군내 산포 `σ_within = R̄ / d2(n)` (n = `chart.subgroupSize`, `SPC_DATA.RANGE_VAL` 평균). `hv/hv-spc-math.ts`의 `xbarRConstants`를 재사용.
- Ppk: 전체 개별값 표본표준편차(현재 계산식 유지).
- 반환 `{ cpk, ppk, cp, pp, mean, sigmaWithin, sigmaOverall }`. 기존 필드(`cpk`, `ppk`, `mean`, `sigma`)는 유지하고 `sigma`는 `sigmaOverall`과 같은 값.
- 같은 유형 의심(doubt): 서브그룹 저장 시 `SPC_DATA.CPK/PPK` 컬럼을 채우는 경로가 있으면 같은 정의로 맞춘다.

## 5. 계측기 수치 수신 진입점 (감사 11P·15P 선행)

현재: `EQUIP_PROTOCOLS` 파서가 PASS/FAIL 2치만 파싱. 수치 측정값을 받는 API 없음. SPC 데이터는 수기·엑셀만.

설계:
- `EQUIP_PROTOCOLS`에 `VALUE_INDEX NUMBER NULL`, `VALUE_UNIT VARCHAR2(20) NULL` 추가. 엔티티·DTO·프로토콜 화면(`inspection/protocol`)에 필드 노출.
- 파서 `parseProtocolData()`가 `valueIndex`가 있으면 해당 토큰을 숫자로 변환해 `measuredValue`를 함께 반환(숫자 변환 실패 시 null).
- 신규 API `POST /quality/measurements` (모듈 `quality/spc`, `MeasurementController`/`MeasurementService`)
  - 본문: `{ itemCode, processCode, characteristicName, values: number[], equipCode?, orderNo?, sampleDate?, protocolId?, rawData? }`. `rawData`+`protocolId`가 오면 파서로 `values`를 만든다.
  - 활성 `SPC_CHARTS`(itemCode, processCode, characteristicName, STATUS ACTIVE)를 찾아 `SpcService.createData()`로 서브그룹을 적재. 차트 없으면 404 `해당 특성의 SPC 관리도가 없습니다`.
  - sys-config `MEASURE_RECEIVE_ENABLED`(그룹 QUALITY, BOOLEAN, 기본 N)가 N이면 403 `계측기 수신이 비활성화되어 있습니다`.
  - 수신 로그는 `SPC_DATA.REMARK`에 `source=DEVICE protocol={id} equip={code}` 스탬프로 남긴다(별도 테이블 없음, YAGNI).
- 이 API가 압착고·인장력 게이지 연동의 단일 진입점이다. 게이지 기종이 정해지면 `EQUIP_PROTOCOLS` 행과 `SPC_CHARTS` 행만 등록하면 된다.

## 6. 단자별 압착 규격 마스터 (감사 11P·12P 선행)

현재: 압착 높이·폭·인장력 상하한을 단자 종류·전선 사이즈별로 정의하는 마스터가 없다. `PROCESS_MAPS.CRIMP_HEIGHT`는 공정 조건값이고 `CONTROL_PLAN_ITEMS.SPECIFICATION`은 자유 텍스트다.

설계:
- 테이블 `TERMINAL_CRIMP_SPECS`
  - PK `SPEC_ID NUMBER` (시퀀스 `SEQ_TERMINAL_CRIMP_SPEC`), `COMPANY`, `PLANT_CD`
  - `TERMINAL_ITEM_CODE VARCHAR2(50) NOT NULL` (ITEM_MASTERS 참조), `TERMINAL_TYPE VARCHAR2(30) NULL` (공통코드 그룹 `TERMINAL_TYPE`), `WIRE_SIZE VARCHAR2(50) NOT NULL`, `WIRE_ITEM_CODE VARCHAR2(50) NULL`
  - `CRIMP_HEIGHT_LSL/USL`, `CRIMP_WIDTH_LSL/USL`, `INS_CRIMP_HEIGHT_LSL/USL`(절연부 압착고), `PULL_FORCE_MIN`(N), `STRIP_LENGTH_MIN/MAX` — 전부 `NUMBER(10,3) NULL`
  - `APPLICATOR_CODE VARCHAR2(50) NULL`, `REMARK VARCHAR2(500)`, `USE_YN CHAR(1) DEFAULT 'Y'`, 감사컬럼(CREATED_AT/UPDATED_AT DEFAULT SYSTIMESTAMP)
  - UNIQUE (`COMPANY`,`PLANT_CD`,`TERMINAL_ITEM_CODE`,`WIRE_SIZE`)
- 공통코드 그룹 `TERMINAL_TYPE` 신설. 초기 코드는 김종현 책임 확인 전이므로 `DISK`(디스크), `RING`(링), `FASTON`(파스톤), `PIN`(핀), `SOCKET`(소켓) 5개만 두고 화면에서 추가한다.
- API `master/terminal-crimp-specs` CRUD + `GET /resolve?terminalItemCode&wireSize` (자주검사·계측 판정에서 쓸 조회 지점).
- 화면 `/master/terminal-crimp-spec` (메뉴 `QC_TERMINAL_CRIMP_SPEC`, QUALITY 그룹, `QC_IQC_PART_SPEC` 다음). 좌 DataGrid + 우 패널(기준정보 패널 표준: 데이터 교체, `useUnsavedGuard`, 액션 버튼 상단). 단자 품목·전선 품목은 품목 선택 컴포넌트, 단자 종류는 `ComCodeSelect`.
- 자주검사 연동은 이번 범위 밖. `resolve` API만 열어 둔다.

## 7. 검사보조구 마스터: 한도견본·검사홀더 (감사 24P·25P 선행)

현재: 한도견본·검사홀더 개념이 없다(PPAP 제출 체크박스만).

설계:
- 테이블 `INSPECT_AIDS`
  - PK `AID_CODE VARCHAR2(50)`, `COMPANY`, `PLANT_CD`
  - `AID_TYPE VARCHAR2(30) NOT NULL` (공통코드 그룹 `INSPECT_AID_TYPE`: `LIMIT_OK` 양품 한도견본, `LIMIT_NG` 불량 한도견본, `HOLDER` 검사홀더/지그)
  - `AID_NAME VARCHAR2(200) NOT NULL`, `ITEM_CODE VARCHAR2(50) NULL`, `PROCESS_CODE VARCHAR2(50) NULL`, `DEFECT_CODE VARCHAR2(50) NULL`(불량 견본의 대표 불량코드)
  - `IMAGE_URL VARCHAR2(500) NULL`, `LOCATION VARCHAR2(200) NULL`, `VALID_FROM DATE NULL`, `VALID_TO DATE NULL`
  - `APPROVED_BY VARCHAR2(50) NULL`, `APPROVED_AT TIMESTAMP NULL`, `STATUS VARCHAR2(20) DEFAULT 'ACTIVE'` (ACTIVE/EXPIRED/RETIRED), `REMARK`, `USE_YN`, 감사컬럼
- 이미지 업로드는 설비점검항목과 같은 multer 패턴(`uploads/inspect-aids/`), 공용 `InspectItemImage` 썸네일 재사용.
- API `master/inspect-aids` CRUD + `POST :code/image` + `GET /expiring?days=30`.
- 화면 `/master/inspect-aid` (메뉴 `QC_INSPECT_AID`, QUALITY 그룹, `QC_TERMINAL_CRIMP_SPEC` 다음). 유형 필터 탭, 유효기간 만료·임박 배지(텍스트/테두리, 파스텔 배경 금지), 우 패널에 사진 업로드.
- 검사화면에서 한도견본을 참조하는 연동은 이번 범위 밖.

## 8. IQC 성적서 인쇄 (감사 5P)

현재: 거래처 COA 첨부·열람만 있고 MES가 생성하는 성적서가 없다. 항목별 측정값은 `IQC_LOGS.DETAILS` JSON에 시리얼별로 들어 있다.

설계:
- `material/iqc-history/IqcReportPrintModal.tsx`: `JobOrderPrintModal`과 같은 `window.print` + `@media print` A4 방식.
  - 머리: 성적서 제목, 품목코드/명, 입하번호, 거래처, LOT 수량, 검사일, 검사자, 검사구분, 판정.
  - AQL 요약: 검사수준, 시료수, Major/Minor AC·RE, 불량 수, 판정 근거.
  - 본문: 시리얼별 항목 표(검사항목, 규격/LSL/USL, 단위, 측정값, 판정).
  - 꼬리: 검사자 / 승인자 서명란, 출력일시.
- 진입: 이력 그리드 프린터 아이콘 + 상세 모달의 인쇄 버튼.
- 서버 변경 없음. DETAILS 파싱은 `IqcDetailModal`의 타입을 공용 파일로 빼서 공유.

## 9. 공통 사항

- 신규 sys-config 4키는 `apps/backend/src/migrations/2026-09-09_audit_gap_sys_configs.sql`에 INSERT(멱등 MERGE), JSHANES 적용.
- 메뉴 신규 2개는 4소스(`menuConfig.ts`, `menu-code-validator.ts`, `seeds/menu-config.json`, `pageRegistry.generated.ts` 재생성) + DB `MENU_CATEGORY_ITEMS`/`ROLE_MENU_PERMISSIONS` MERGE.
- i18n은 ko/en/zh/vi 4개 동시. 신규 화면 도움말 `public/help/user/ko/{MENU_CODE}.md`.
- DDL 후 `python tools/generate_db_schema_doc.py`(ORACLE_SITE=JSHANES)로 ERD 갱신.
- 테스트: 규칙 함수(jest), 서비스 게이트(jest, 저장소 mock), 프론트 구조 테스트(.mjs).

## 10. 범위 밖

- 자주검사가 압착규격 마스터를 참조해 자동 판정하는 연동
- 검사화면에서 한도견본 참조
- OQC 성적서(항목별 측정값 모델이 없어 양식 확보 후 별도 설계)
- 재고 일원화 Phase 4·7, 절압물 최종검사 전용 화면
