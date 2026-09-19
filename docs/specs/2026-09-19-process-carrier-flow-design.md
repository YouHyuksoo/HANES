# 공정 대차 적재·이동전표·자동 투입 설계

- 작성일: 2026-09-19
- 상태: 승인 (구현 대기)
- 관련 화면: `/production/input-kiosk`(가공), `/production/subprocess-kitting`(서브조립), `/production/input-assembly`(조립), `/master/carrier`(신규), `/production/carrier-status`(신규), `/master/routing`(플래그 추가)

## 1. 배경과 문제

생산 실적이 발생하면 공정재고에 수량이 적재되고 끝난다. 실물은 대차·트레이·매거진에
담겨 후공정으로 이동하는데, 시스템에는 "어느 대차에 담겼는지"가 없다. 그래서
① 생산품이 지금 어느 대차에 있는지 실시간으로 알 수 없고, ② 후공정에서 라벨을
낱개로 다시 스캔해야 하며, ③ 대차가 어디로 가야 하는지 출력물이 없다.

코드·DB·i18n에 대차/매거진 개념은 없다(2026-09-19 실측). PALLET은 출하 포장 전용이다.

## 2. 결정 요약

| 항목 | 결정 |
|---|---|
| 옵션 단위 | 라우팅 공정(ROUTING_PROCESSES) 플래그 2개. 출력측 `CARRIER_LOAD_YN`, 입력측 `CARRIER_AUTO_INPUT_YN`. 중간 공정은 둘 다 Y |
| 대차 마스터 | 기준정보 신규 `CARRIER_MASTERS`. 유형은 공통코드 `CARRIER_TYPE`(CART/TRAY/MAGAZINE). 수용량은 선택 입력(NULL=무제한). 등록된 번호만 스캔 허용 |
| 적재 단위 | 라벨이 발행되는 공정만 대상. SG 라벨(SG_LABELS), FG 라벨(FG_LABELS). 수량만 기록되는 공정은 `CARRIER_LOAD_YN`을 켤 수 없다 |
| 혼적 | 대차 하나에 품목 하나, 작업지시 하나. 비워지면 다음 것을 담을 수 있다 |
| 미스캔 | `CARRIER_LOAD_YN=Y` 공정에서 출력 대차 없이 실적 저장 시 차단(400) |
| 자동 투입 | 후공정에서 대차 스캔 즉시 담긴 라벨 전부를 기존 처리기로 처리. 실패 건은 건너뛰고 요약 |
| 대차 순환 | 자동 투입으로 비워진 대차는 이전 공정으로 돌아간다. 현재 공정 출력 대차로 자동 지정하지 않는다 |
| 이동전표 | 후공정으로 보내기 전 발행. 전표번호를 채번해 담긴 라벨에 찍고, 발행 후 추가 적재를 막는다. 전표 있는 대차만 자동 투입 허용 |
| 이력 | 적재 이력 테이블을 두지 않는다. 라벨 테이블의 대차 컬럼이 현재 위치의 단일 출처, 실적의 대차 컬럼이 출발 대차 보존. 이벤트 이력이 필요해지면 기존 TRACE_LOG 확장 |

## 3. 데이터 모델

### 3-1. 신규 `CARRIER_MASTERS`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| COMPANY, PLANT_CD | VARCHAR2 | 멀티테넌시 스코프 (PK 일부) |
| CARRIER_NO | VARCHAR2(30) | 대차번호, 바코드 값 (PK 일부). 수동 입력, 접두어 강제 없음 |
| CARRIER_TYPE | VARCHAR2(20) | 공통코드 CARRIER_TYPE: CART / TRAY / MAGAZINE |
| CARRIER_NAME | VARCHAR2(100) | 표시명 |
| CAPACITY | NUMBER | 최대 라벨 수. NULL=무제한 |
| USE_YN | CHAR(1) | 사용여부 |
| REMARK | VARCHAR2(500) | 비고 |
| CREATED_AT/UPDATED_AT/CREATED_BY/UPDATED_BY | | 감사. 타임스탬프는 DEFAULT SYSTIMESTAMP |

상태 캐시 컬럼은 두지 않는다. 대차의 현재 상태는 라벨 테이블에서 도출한다.

- EMPTY: `CARRIER_NO = :no AND CARRIER_NO IS NOT NULL` 인 활성 라벨이 0건
- LOADING: 활성 라벨 있음, `CARRIER_SLIP_NO IS NULL`
- IN_TRANSIT: 활성 라벨 있음, `CARRIER_SLIP_NO IS NOT NULL`

### 3-2. 기존 테이블 컬럼 추가

| 테이블 | 컬럼 | 설명 |
|---|---|---|
| SG_LABELS | CARRIER_NO, CARRIER_LOADED_AT, CARRIER_SLIP_NO | 현재 담긴 대차. 소비되면 세 컬럼 모두 NULL |
| FG_LABELS | CARRIER_NO, CARRIER_LOADED_AT, CARRIER_SLIP_NO | 동일 |
| PROD_RESULTS | CARRIER_NO | 실적 시점 출력 대차. 라벨이 꺼내진 뒤에도 보존 |
| ROUTING_PROCESSES | CARRIER_LOAD_YN, CARRIER_AUTO_INPUT_YN | CHAR(1) DEFAULT 'N' |
| EQUIP_MASTERS | CUR_CARRIER_NO | 설비의 현재 출력 대차. 작업지시·작업자 복원과 같은 방식으로 재진입 시 복원 |

인덱스: SG_LABELS(COMPANY, PLANT_CD, CARRIER_NO), FG_LABELS(COMPANY, PLANT_CD, CARRIER_NO).

채번: 이동전표번호 `CARRIER_SLIP_NO`만 Oracle SEQUENCE(`docs/standards/numbering-rules.md`에 규칙 추가, 일별 리셋 없음). 대차번호는 마스터 수동 입력.

### 3-3. 라우팅 플래그 검증

- `CARRIER_LOAD_YN='Y'`는 `ISSUE_LABEL_TYPE`이 SG/BUNDLE/FG일 때만 저장 허용. NONE이면 400.
- `CARRIER_AUTO_INPUT_YN`은 제약 없음.

## 4. 출력측 흐름 (적재)

1. 세 화면 헤더에 공용 **출력 대차 슬롯**을 둔다. `CARRIER_LOAD_YN='Y'`인 공정의 설비를 선택했을 때만 보인다.
2. 대차 스캔 → `POST /production/carriers/:no/select { equipCode }`. 서버 검증 순서:
   - 마스터 존재, USE_YN='Y'
   - 전표 발행 상태(IN_TRANSIT)면 거부: "이동전표가 발행된 대차입니다"
   - 담긴 라벨이 있으면 품목·작업지시가 설비의 현재 작업지시와 같아야 한다
   - 수용량이 있으면 여유가 1 이상
   - 통과 시 `EQUIP_MASTERS.CUR_CARRIER_NO` 갱신
3. 실적 저장 요청에 `carrierNo`가 실린다. 서버(`ProdResultService.create`, `confirmSubKit`, `confirmAssembly`):
   - 라우팅 공정 `CARRIER_LOAD_YN='Y'`인데 `carrierNo` 없음 → 400 "출력 대차를 스캔하세요"
   - 같은 트랜잭션에서 2번 검증을 반복하고, 수용량은 `현재 적재수 + 발행 라벨 수 <= CAPACITY`로 검사. 초과 시 400 "대차 교체"
   - 발행되는 SG/FG 라벨에 `CARRIER_NO`, `CARRIER_LOADED_AT` 스탬프. 실적에 `CARRIER_NO` 저장
4. 수용량 초과 400을 받으면 화면은 슬롯을 비우고 교체를 안내한다.
5. 준비 안내 모달에 "출력 대차 스캔" 단계를 옵션 Y일 때만 추가한다.

## 5. 이동전표

- 출력 대차 슬롯의 **이동전표** 버튼 → `POST /production/carriers/:no/slip`.
- 서버: 담긴 활성 라벨이 0건이면 400. `CARRIER_SLIP_NO IS NULL`이면 SEQUENCE로 채번해 담긴 라벨 전부에 찍는다. 이미 있으면 같은 번호로 재발행(reprint). 응답은 전표 데이터.
- 전표 내용: 전표번호, 대차번호·유형·이름, 품목코드·품명, 작업지시번호, 출발 공정(라벨 ISSUE_PROCESS_CODE), 도착 공정(작업지시 라우팅에서 출발 공정 SEQ 다음의 `USE_YN='Y' AND EXECUTION_TYPE='IN_HOUSE'` 공정; 없으면 "최종"), 라벨 목록(바코드, 수량), 합계 수량·건수, 발행 일시·작업자, 재스캔용 대차 바코드.
- 인쇄는 `JobOrderPrintModal` 패턴(A4, window.print)의 공용 `CarrierSlipPrintModal`.
- 발행 후 그 대차에는 추가 적재를 막는다(4-2 검증). 설비의 `CUR_CARRIER_NO`는 발행 시 비운다.

## 6. 입력측 흐름 (자동 투입)

1. 화면의 기존 스캔 입력에 대차를 찍는다. 판별: 라벨 테이블에 없고 `CARRIER_MASTERS`에 있으면 대차.
2. `GET /production/carriers/:no/auto-input?equipCode=` 서버 검증:
   - 설비 공정의 `CARRIER_AUTO_INPUT_YN='N'` → 400 "이 공정은 대차 자동투입을 쓰지 않습니다"
   - 전표 미발행(LOADING) → 400 "이동전표 미발행 대차"
   - 활성 라벨 0건 → 400 "빈 대차"
   - 통과 시 담긴 라벨 목록(바코드, 라벨유형, 품목, 수량) 반환
3. 화면은 바코드마다 **지금 쓰는 처리기를 그대로 반복 호출**한다. 새 투입 경로를 만들지 않는다.
   - 가공(input-kiosk): 설비 장착 `POST /production/equip-material/mount`
   - 서브조립(subprocess-kitting), 조립(input-assembly): SG 스캔 목록 추가(기존 `getSgLabel` 검증 경로)
   - 실패 건은 건너뛰고 "N건 투입, M건 실패(사유)" 토스트
4. 라벨의 대차 컬럼은 **소비되는 순간** NULL이 된다. 가공은 장착 시점(`EquipMaterialService.mount`), 서브조립·조립은 확정 시점(`confirmSubKit`, `confirmAssembly`). 대차 스캔이든 낱개 수동 스캔이든 같은 지점에서 비워진다. 조립 목록에 넣었다가 취소해도 대차 상태는 유지된다.
5. 활성 라벨이 모두 소비되면 대차는 EMPTY로 도출되어 다시 쓸 수 있다.

## 7. 되돌림

- 실적 취소로 SG/FG 라벨이 회수될 때(`reverseResultInTx`, `reverseProductStock`) 대차 컬럼 3개를 NULL로.
- 설비 탈착(unmount)으로 라벨이 공정재고로 돌아가도 대차에 다시 넣지 않는다.
- 이동전표는 취소 기능을 두지 않는다. 대차를 비우면(소비 또는 실적 취소) 전표도 자연히 소멸한다.

## 8. 화면·API·메뉴

### 백엔드
- `entities/carrier-master.entity.ts` 신규. SgLabel, FgLabel, ProdResult, RoutingProcess, EquipMaster 컬럼 추가(nullable union 컬럼은 type 명시).
- `modules/master`: `CarrierController/Service` `/master/carriers` CRUD(서버 페이징, 유형·사용여부 필터).
- `modules/production`: `CarrierFlowController/Service` `/production/carriers` — `GET /` 현황 목록(상태·공정·품목·바코드 검색, 서버 페이징), `GET /:no` 상태·내용·다음 공정, `POST /:no/select`, `POST /:no/slip`, `GET /:no/auto-input`.
- 기존 수정: `ProdResultService.create` 차단·스탬프·취소 해제, `SubprocessKittingService.confirmSubKit/confirmAssembly` 스탬프·소비 해제, `EquipMaterialService.mount` 소비 해제, 라우팅 DTO 플래그 검증.
- 마이그레이션 SQL 작성 후 oracle-db connector로 JSHANES 적용, 의존 PL/SQL 재컴파일, ERD 갱신(`ORACLE_SITE=JSHANES`).

### 프론트
- `components/shared/carrier/`: `OutputCarrierSlot`(스캔·현재 대차·적재수/수용량·이동전표 버튼), `CarrierSlipPrintModal`, `useCarrierAutoInput(flags, handleBarcode)`.
- 세 화면은 공용을 조립만 한다. 준비 안내 단계 추가.
- `/master/carrier`: 목록 + 우측 패널(기준정보 패널 표준, 액션 버튼 상단) + 대차 바코드 라벨 출력(`EquipLabelModal` 패턴).
- `/master/routing` 공정 폼 체크박스 2개 + `RoutingFieldHelp` 항목.
- `/production/carrier-status`: 대차 목록(상태·현재 공정·품목·지시·적재수·전표번호)과 상세 라벨 목록, 바코드로 대차 찾기. 기본 필터는 활성(EMPTY 제외) + 서버 페이징.
- 메뉴 2개(기준정보 > 대차관리 `MASTER_CARRIER`, 생산 > 대차현황 `PROD_CARRIER_STATUS`)를 menuConfig, menu-config.json, validator, DB MERGE 4곳 동시 반영. i18n ko/en/zh/vi.
- 공통코드 `CARRIER_TYPE` 시드(CART 대차 / TRAY 트레이 / MAGAZINE 매거진).

## 9. 테스트

- 구조 테스트(.mjs): `components/shared/carrier` 1, 세 화면 3, 마스터·현황 화면 2.
- 백엔드 spec: 대차 select 검증(존재·사용·전표 잠금·품목·지시·수용량), 실적 생성 차단, 수용량 초과, 소비 시 해제(mount/confirm), 실적 취소 해제, 전표 채번·재발행 멱등, auto-input 거부 3종, 라우팅 플래그 검증.
- typecheck 프론트·백엔드, focused test 우선.

## 10. 구현 단계

| 단계 | 범위 | 커밋 |
|---|---|---|
| 1 | DB 마이그레이션·엔티티, 공통코드 시드, 대차 마스터 API·화면, 라우팅 플래그, 메뉴 | 1 |
| 2 | 출력측: 대차 select API, 실적·확정 스탬프·차단, 출력 대차 슬롯, 준비 안내 단계, 이동전표 API·인쇄 | 1 |
| 3 | 입력측: auto-input API, 소비 시 해제, 자동 투입 훅, 세 화면 적용, 실적 취소 해제, 대차현황 화면 | 1 |

## 11. 범위 밖

- 대차 이동 이벤트 이력 테이블, 이동전표 취소, 대차 위치 실시간 보드(전광판), PDA 대차 스캔 화면.

## 12. 보완 — 원자재 키팅 대차 (같은 날 설계 중 추가)

가공(input-kiosk)은 원자재만 투입하는 최초 공정이라 SG/FG 라벨을 투입하는 경로가 없다(실측: 설비 장착은 공정재고 원자재 LOT만 다룬다).
대신 자재창고가 키팅한 원자재 LOT을 대차에 담아 보내면 가공에서 대차 한 번 스캔으로 일괄 장착할 수 있다. 이 흐름은 **강제하지 않는다.**

| 항목 | 결정 |
|---|---|
| 담는 쪽 | 자재 출고 화면(`/material/issue`, 바코드 스캔 출고)의 대차 스캔은 선택. 대차 없이 출고해도 지금처럼 공정재고로 간다 |
| 저장 | `MAT_LOTS`에 CARRIER_NO, CARRIER_LOADED_AT 추가. 출고 요청에 carrierNo가 있으면 출고되는 LOT에 찍는다 |
| 대차 규칙 | 원자재 대차도 마스터 등록 대차만 허용. 품목·작업지시 단일 제한은 적용하지 않는다(키팅은 여러 품목을 한 대차에 담는 것이 목적). 수용량은 적용한다 |
| 꺼내는 쪽 | 가공 화면 자재 스캔 모달에서 대차를 찍으면 담긴 LOT 전부를 기존 장착 처리기(`POST /production/equip-material/mount`)로 반복 호출. 대차를 안 찍고 LOT 낱개 장착도 그대로 된다. 설비 공정의 `CARRIER_AUTO_INPUT_YN`이 Y일 때만 대차 스캔을 받는다 |
| 이동전표 | 원자재 대차는 전표 없이도 자동 장착을 허용한다. 전표 필수 규칙은 생산 공정 간 대차(SG/FG 라벨)에만 적용한다. 전표 발행 자체는 원자재 대차에도 가능하다 |
| 해제 | LOT이 설비에 장착되는 순간(`EquipMaterialService.mount`) MAT_LOTS의 대차 컬럼을 NULL로. 출고 취소(`MatIssueService.cancel`) 시에도 NULL로 |
| 상태 도출 | 대차 내용 조회는 SG_LABELS, FG_LABELS, MAT_LOTS 세 테이블을 UNION ALL 한다. 한 대차에 라벨과 원자재 LOT이 섞이는 것은 막는다(담을 때 종류 불일치면 400) |

세 화면 원칙은 유지된다. 가공 화면은 출력측(SG 라벨 적재·전표)과 입력측(원자재 대차 일괄 장착) 모두를 갖는다.

## 13. 보완 — 출하 포장도 소비 지점 (최종 리뷰)

FG 라벨은 박스 포장(`BoxService.closeBox`, FG_LABELS.STATUS='PACKED') 시점에 대차에서 꺼낸다.
포장이 대차 해제를 하지 않으면 조립 FG를 담은 대차가 영원히 IN_TRANSIT으로 남아 재사용되지 않는다.

| 항목 | 결정 |
|---|---|
| 해제 지점 | `closeBox`가 FG_LABELS를 PACKED로 올리는 같은 트랜잭션·같은 배치에서 `CarrierFlowService.clearInTx(qr, 'FG', batch, ...)` 호출 |
| 테넌트 | `box.company` / `box.plant`를 쓴다. `closeBox`의 company/plant 인자는 optional이라 undefined면 전 테넌트를 건드린다 |
| 조회 방어 | 대차 내용 조회(CONTENTS_SQL)와 현황 목록 집계의 FG 가지에 `STATUS NOT IN ('PACKED','SHIPPED')`를 건다. 과거 데이터나 해제 누락이 있어도 포장·출하된 FG는 대차에 남아 보이지 않는다 |
| 범위 밖 | `reopenBox`(PACKED→VISUAL_PASS 복원)와 출하 취소(SHIPPED→PACKED)는 대차로 되돌리지 않는다. 대차 적재는 생산 공정 간 이동 수단이지 출하 취소의 복구 대상이 아니다 |
