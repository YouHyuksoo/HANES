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
