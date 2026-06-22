# DECISIONS

Record durable technical or operational decisions here.

Format:

```md
## D-000 Short title
Status: Accepted | Proposed | Rejected
Decision:
- Decision text
Reason:
- Reason text
```

## D-20260618-HARNESS-DRAWING-REVISION
Status: Accepted
Decision:
- 제품 도면관리는 기존 작업지도서/문서관리 확장이 아니라 `HARNESS_DRAWING_MASTERS` -> `HARNESS_DRAWING_REVISIONS` -> `HARNESS_CIRCUIT_SPECS` 전용 구조로 둔다.
- 승인된 Revision은 회로 사양을 직접 수정하지 않고, `Rev 생성`으로 새 DRAFT Revision을 만들며 기존 회로를 복제해 편집한다.
- 신규 키 채번은 Oracle `SEQUENCE.NEXTVAL`만 사용한다.
Reason:
- 하네스 도면은 품목별 Header, Revision, 회로별 stripping/crimping 사양이 함께 버전 관리되어야 하므로 단순 첨부문서나 작업지도서 본문으로 흡수하면 회로 단위 조회/변경 추적이 어렵다.
- 승인본 불변성과 초안 편집 흐름을 분리해야 현장 작업 기준서의 감사 추적이 유지된다.

## D-20260620-CODE-VALUE-SELECT-STANDARD
Status: Accepted
Decision:
- HANES 화면에서 코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 방식을 우선한다.
- 검사수준, AQL, 검사구분, 단위, 상태, 라인, 설비, 공정, 품목, 거래처처럼 관리 기준이 있는 값은 `Input` 직접입력으로 만들지 않는다.
- 필요한 공통코드/기준정보가 없으면 임시 자유입력으로 우회하지 않고 기준 데이터를 먼저 추가한다.
- 단, 기본시료수처럼 코드가 아니라 사용자가 수량 기준값을 입력해야 하는 항목은 숫자 입력을 허용하며 소수점도 저장 가능해야 한다.
Reason:
- 사용자가 `/master/part` 검사 관련 항목을 입력방식이 아닌 선택방식으로 바꾸고, 이 원칙을 항상 지킬 개발표준으로 명시하라고 요청했다.
- 코드성 값의 자유입력은 오탈자와 기준 불일치를 만들어 MES/QMS 판정, 집계, 조회 조건 정합성을 깨뜨린다.

## D-20260620-IQC-DEFECT-GRADE-AQL
Status: Accepted
Decision:
- IQC 불량코드는 반드시 `CRITICAL`, `MAJOR`, `MINOR` 중 하나의 등급을 가진다.
- 등급은 기존 `COM_CODES.ATTR1`이 아니라 전용 컬럼 `COM_CODES.DEFECT_GRADE`로 관리한다.
- IQC 판정 입력은 Critical/Major/Minor 수량 직접입력이 아니라 `DEFECT_TYPE` 불량코드와 수량을 입력받고, 서버가 코드 등급으로 집계한다.
- Critical 수량이 1건 이상이면 AQL 계산과 관계없이 즉시 LOT FAIL 처리한다.
- Major와 Minor는 각각 품목별 AQL 기준으로 Ac/Re를 독립 계산하며, 어느 한 등급이라도 불합격이면 LOT는 FAIL 처리한다.
Reason:
- `ATTR1`은 기존 `DEFECT_TYPE`에서 색상 또는 영문 설명으로 이미 사용 중이라 불량등급 저장소로 재사용하면 기존 UI/표시 의미가 깨진다.
- 등급별 AQL 판정은 Critical, Major, Minor의 허용수량 기준이 다르므로 합산하거나 한 규칙으로 처리하면 LOT 판정이 틀어진다.
- 사용자가 불량코드 등급 필수와 Major/Minor 독립 Ac/Re 판정을 명시했다.

## D-20260621-ITEM-MODEL-NAME
Status: Accepted
Decision:
- 자동차용 MES의 품목 관리 특성인 차종은 `ITEM_MASTERS.MODEL_NAME` nullable 문자열 컬럼으로 관리한다.
- `/master/part` 목록, 검색, 등록, 수정 DTO/API는 `modelName` 필드로 같은 값을 전달한다.
Reason:
- 차종은 품목/제품군과 함께 운영자가 품목을 식별하고 검색해야 하는 자동차 하네스 MES 기준정보 특성이다.
- 현재 범위에서는 별도 차종 마스터나 공통코드 기준이 없어, 기존 품목 기본정보 텍스트 특성과 같은 방식으로 추가하는 것이 가장 낮은 위험이다.

## D-20260621-HARNESS-WIRE-SPEC-SEPARATION
Status: Accepted
Decision:
- 전선 절단 길이와 Strip A/B는 품목마스터 속성이 아니라 `HARNESS_CIRCUIT_SPECS` 회로별 제조 사양으로 관리한다.
- `HARNESS_CIRCUIT_SPECS.WIRE_ITEM_CODE`는 BOM 자재 품목을 참조하고, 저장 시 도면 품목의 활성 BOM child인지 검증한다.
- `ROUTING_MATERIALS.CIRCUIT_ID`는 공정 투입 자재를 회로 사양과 연결하는 선택 링크로 둔다.
Reason:
- 같은 전선 원자재가 제품/회로별로 다른 절단 길이를 가지므로 `ITEM_MASTERS`에 길이/스트리핑 값을 두면 품목코드 폭발 또는 잘못된 마스터 값이 발생한다.
- BOM은 자재 소요량 기준, 회로스펙은 제조 조건 기준, 라우팅은 공정 배치 기준으로 분리해야 운영 데이터 정합성이 유지된다.

## D-20260621-IQC-AQL-POLICY-CODE
Status: Accepted
Decision:
- `ITEM_MASTERS`는 AQL 검사수준/Critical/Major/Minor 개별 값을 직접 보유하지 않고 `IQC_AQL_POLICY_CODE`만 보유한다.
- AQL 정책 조합은 신규 `IQC_AQL_POLICIES` 기준정보에서 `INSPECTION_LEVEL`, `MAJOR_AQL_CODE`, `MINOR_AQL_CODE`, `CRITICAL_MODE`로 관리한다.
## D-20260621-DEFECT-CODE-MASTER
Status: Accepted
Decision:
- 불량코드는 `COM_CODES.DEFECT_TYPE`가 아니라 `DEFECT_CATEGORY_MASTERS`/`DEFECT_CODE_MASTERS`/`DEFECT_CODE_PRODUCT_TYPES` 전용 기준정보로 관리한다.
- 분류는 3레벨이며 실제 불량코드는 3레벨 leaf category만 참조한다.
- IQC AQL 불량코드 등급 조회와 IQC 모달 선택 목록은 전용 테이블/API를 사용한다.
Reason:
- 불량코드는 외관/기능/원자재/제품/공정/모델구분별 적용까지 관리해야 하므로 공통코드 단일 그룹으로는 운영 분류와 검증을 감당하기 어렵다.

## D-20260622-DEFECT-MODEL-GROUP
Status: Accepted
Decision:
- 불량코드 분류 1레벨은 검사단계 `IQC/LQC/OQC`, 2레벨은 품목의 불량 모델구분 `DEFECT_MODEL_GROUP`, 3레벨은 불량유형 `FUNCTION/APPEARANCE/ETC`로 둔다.
- `DEFECT_MODEL_GROUP` 기본 코드는 `LV`=저전압, `HV`=고전압이다.
- 품목마스터는 `ITEM_MASTERS.DEFECT_MODEL_GROUP`을 보유하고, IQC 불량코드 옵션 조회는 선택 품목의 모델구분으로 필터링한다.
- 기존 `DEFECT_CODE_PRODUCT_TYPES.PRODUCT_TYPE` 컬럼명과 API `productType` 파라미터는 호환을 위해 유지하되 의미는 모델구분 코드로 해석한다.
Reason:
- 사용자가 2레벨은 제품류가 아니라 모델 구분(예: 저전압/고전압)이라고 정정했고, 다른 모델의 불량코드가 검사 화면에 섞이면 안 된다고 명시했다.
- 품목별 모델구분을 품목마스터에 두어 검사 대상 품목 기준으로 불량코드 적용 범위를 안정적으로 제한할 수 있다.

- `/master/part`는 `AQL 정책` 선택만 제공하고, `/quality/aql/resolve-iqc`는 품목의 정책 코드를 따라 sampling rule을 산출한다.
- `IQC_PART_SPEC_ITEMS`의 검사수준/AQL은 품목 정책을 대체하는 것이 아니라 검사항목별 override 기준으로 유지한다.
- 실제 IQC 검사 화면과 저장 판정은 검사항목별 판정 경로인 `resolveIqcPolicyByItem()`을 기준으로 맞춘다.
- IQC AQL 판정 대상 품목에 `IQC_AQL_POLICY_CODE`가 없으면 기본 PASS로 우회하지 않고 설정오류로 차단한다.
Reason:
- AQL 값은 품목 고유 속성이 아니라 검사 정책 기준정보이므로 품목마다 개별 값을 중복 저장하면 정책 변경과 품목 변경이 섞인다.
- 정책 코드를 참조하면 품목마스터 화면은 단순해지고, AQL 기준/샘플링 rule/품목 적용 사이의 출처가 분리되어 운영 변경 추적이 쉬워진다.
- 정책 미설정 상태에서 Major/Minor AQL rule이 `null`이면 불량이 있어도 PASS로 저장될 수 있으므로 운영상 검사불가로 보는 것이 맞다.

## D-20260617-PRINT-AGENT-OWNS-CONFIG
Status: Accepted
Decision:
- HANES Print Agent의 운영 설정 주인은 웹 MES 화면이 아니라 agent 자체로 둔다.
- Agent는 사용자 설정 파일 `HANES/print-agent/config.json`을 읽고 저장하며, `GET /settings` 로컬 설정관리 화면과 트레이 `설정` 메뉴를 제공한다.
- `listenAddress` 변경은 실행 중 포트를 즉시 바꾸지 않고 설정 파일에 저장한 뒤 `restartRequired=true`로 재시작 필요를 알린다.
Reason:
- Agent는 웹보다 먼저 실행되어야 하며 포트, 기본 프린터, 허용 Origin, token, 로그 경로는 agent 런타임 책임이다.
- 웹 화면 설정만으로 관리하면 agent 미실행/포트 변경/보안 token 같은 부트스트랩 설정을 안정적으로 다룰 수 없다.

## D-20260613-SQL-DEBUG-GLOBAL
Status: Accepted
Decision:
- 모든 `DataGrid.sqlQuery` 화면의 SQL 조회문은 페이지별 하드코딩 SQL을 보정하는 대신, TypeORM 실제 실행 SELECT를 요청 단위로 수집해 GET 응답 `meta.debugSql`에 붙이고 프론트 SQL 모달에서 같은 테이블의 최신 실제 SQL을 우선 표시한다.
- `getManyAndCount()`의 COUNT-only SELECT는 그리드 조회문 대표 SQL에서 후순위로 둔다.
Reason:
- SQL 조회문 사용처가 100개 이상이라 화면별 수동 배관은 누락 위험과 유지보수 비용이 크다. 전역 logger/interceptor/cache 방식은 모든 GET 조회에 실제 DB 실행 SQL과 parameters를 확보한다.
- trade-off는 같은 테이블을 여러 API가 연속 조회하는 특수 화면에서 최신 같은 테이블 SQL이 선택될 수 있다는 점이다. 정확도보다 전역 적용성과 실제 실행 SQL 확보를 우선했다.

## D-20260616-ITEM-CONSUMABLE-MOVE
Status: Accepted
Decision:
- JSHANES `ITEM_MASTERS`에 남아 있던 `ITEM_TYPE='CONSUMABLE'` 12건은 `CONSUMABLE_MASTERS`로 이동하고 `ITEM_MASTERS`에서는 제거한다.
- 기존 코드값은 `CONSUMABLE_CODE`로 유지한다.
- 분류는 현재 공통코드 `CONSUMABLE_CATEGORY`의 유효값에 맞춰 `JIGHD*`는 `JIG`, 그 외 `APPCT*`/`CUTBL*`는 `TOOL`로 매핑한다.
Reason:
- 품목마스터와 소모품마스터가 중복 기준정보를 보유하면 `/master/part`와 `/consumables/master`의 관리 경계가 흐려진다.
- 사전 실측에서 대상 12건은 `BOM_MASTERS`, `MAT_LOTS`, `MAT_STOCKS`, `PROD_PLANS` 참조가 0건이라 품목마스터 삭제로 현재 생산/BOM 흐름이 깨지지 않는다.

## D-20260616-CONSUMABLE-USAGE-MAP-IN-MASTER
Status: Accepted
Decision:
- `CONSUMABLE_USAGE_MAP` 관리는 별도 페이지를 만들지 않고 `/consumables/master`의 우측 고정 패널 안에서 선택 소모품 기준으로 처리한다.
- 제품/모델 + 설비 + 소모품 관계는 선택된 소모품의 하위 섹션으로 관리하며, 별도 좌측 메뉴는 추가하지 않는다.
Reason:
- 사용자가 별도 페이지를 만들지 말고 소모품마스터 페이지 우측 고정 섹션에서 매핑 처리하도록 명시했다.
- 운영자는 소모품 기준으로 어떤 제품/설비에 쓰이는지 관리하는 흐름이 자연스럽고, 기존 소모품 기본정보/이미지 편집 흐름과 같은 화면에서 처리하는 편이 이동 비용이 낮다.

## D-20260616-MAT-ARRIVAL-STOCK-SPLIT
Status: Accepted
Decision:
- 입하재고와 입고 이후 창고재고를 물리 테이블로 분리한다.
- 입하 현재고는 신규 `MAT_ARRIVAL_STOCKS`, 입하 수불원장은 신규 `MAT_ARRIVAL_TRANSACTIONS`에서 관리한다.
- 기존 `STOCK_TRANSACTIONS.MAT_IN` 계열 데이터는 새 입하원장으로 마이그레이션하고, 입하 후 미입고 잔량은 `MAT_ARRIVAL_STOCKS`로 분리한다.
- `/inventory/transaction`은 `STOCK_TRANSACTIONS` 기반의 입고 이후 창고재고 수불만 표시한다.
Reason:
- 현재는 입하(`MAT_IN`)와 입고(`RECEIVE`)가 같은 `STOCK_TRANSACTIONS`와 `MAT_STOCKS`에 섞여 화면과 재고 의미가 혼동된다.
- 사용자가 "입하 - 입하재고, 입고시 입하재고 감소 입고재고 증가" 모델과 테이블 분리를 명시적으로 승인했다.
- 기존 JSHANES 실측에서 `MAT_IN` 322,303과 `RECEIVE` 316,303 사이 미입고 후보 잔량이 있어, 일반 창고재고와 입하재고를 분리해야 한다.

## D-20260611-PDA-SHIPPING-BOX-ONLY
Status: Accepted
Decision:
- PDA 출하처리는 박스 단위(`POST /shipping/orders/:id/ship-box`)만 지원한다. 팔레트 바코드 스캔은 `PALLET_NOT_SUPPORTED`로 안내하고, 팔레트 단위 출하는 웹 출하확정(shipment mark-shipped) 경로를 사용한다.
- PDA 팔레트 단위 출하는 TODO로 남긴다(코드 마커 `TODO(T-PDA-PALLET-SHIP)`, `useShippingScan.ts`). 지원하려면 출하지시-팔레트 연계 백엔드 설계(shipment 자동 생성 또는 ship-pallet 엔드포인트)가 선행돼야 한다.
Reason:
- 백엔드 `ShipOrderService.shipBox()`는 이중 차감 방지를 위해 팔레트 적재 박스를 거부하므로, 기존 PDA의 "팔레트 → 하위 박스별 ship-box" 방식은 구조적으로 항상 실패한다. 별도 설계 없이 우회하면 재고 이중 차감 위험이 있다.

## D-20260612-SHIP-BOX-CANCEL
Status: Accepted
Decision:
- 출하지시 기반 박스 출하 역처리는 `POST /shipping/orders/:id/cancel-ship-box`로 처리한다. 이 API는 출하된 박스 1개를 대상으로 제품재고 `FG_OUT_CANCEL` 복원, 박스 `CLOSED`, FG 라벨 `PACKED`, 출하지시 품목 출하수량 차감, 출하지시 `CONFIRMED` 복원을 한 트랜잭션에서 수행한다.
Reason:
- 완료 출하 데이터를 직접 삭제하면 수불 감사 추적이 깨진다. 출하 역처리는 삭제가 아니라 출하 전 상태로 되돌리는 보상 거래가 맞고, 이미 `ship-box`가 박스 단건 출하 단위이므로 취소도 같은 단위가 가장 명확하다.

## D-20260609-MAT-RECEIVE-VENDOR-BARCODE
Status: Accepted
Decision:
- 자재입고 스캔 시 거래처/제조사 부착 바코드 원본은 `MAT_RECEIVINGS.VENDOR_BARCODE`에 입고 행 단위로 저장한다.
Reason:
- `VENDOR_BARCODE_MAPPINGS`는 기준정보 성격의 품목 매핑 테이블이고, 이번 요구는 실제 입고 시 스캔한 거래처 바코드와 자체 `matUid`의 실적 매핑을 남기는 것이므로 입고 이력에 직접 저장하는 편이 조회와 감사 추적에 맞다.
