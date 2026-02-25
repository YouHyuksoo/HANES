# 품목코드 통일 및 UUID 제거 설계

## 개요

HANES MES 전체 시스템에서 품목코드 필드명을 `itemCode`로 통일하고, 모든 테이블의 UUID PK를 제거하여 자연키(마스터) + SEQUENCE(트랜잭션) 기반으로 전환한다.

## 배경

- 현재 `partCode`, `partId`, `itemCode`, `consumableCode` 등 품목 관련 필드명이 혼재
- Oracle DB 환경에서 UUID 관리가 불필요 (모든 데이터가 자체 유일키 보유)
- 개발 초기 단계로 운영 데이터 없음 → DROP & 재생성 가능

## 결정사항

| 항목 | 결정 |
|---|---|
| 통일 범위 | PartMaster 기준 (ConsumableMaster, EquipBomItem 제외) |
| 필드명 표준 | `partCode` → `itemCode`, `partId` → `itemCode` |
| PK 전략 | 마스터=자연키(String), 트랜잭션=SEQUENCE(Number) |
| UUID | 전체 제거 (82개 엔티티) |
| 마이그레이션 | DROP & 재생성 (데이터 없음) |
| 진행 방식 | 한 번에 전체 변경 |
| 접근 방식 | TypeORM Entity-First |

## 1. PK 전략 매핑

### 마스터 테이블 → 자연키 (String PK)

| 엔티티 | 테이블명 | 현재 PK | 새 PK |
|---|---|---|---|
| PartMaster | ITEM_MASTERS | `id` (UUID) | `itemCode` (string) |
| ProcessMaster | PROCESS_MASTERS | `id` (UUID) | `processCode` (string) |
| ProdLineMaster | PROD_LINE_MASTERS | `id` (UUID) | `lineCode` (string) |
| EquipMaster | EQUIP_MASTERS | `id` (UUID) | `equipCode` (string) |
| Warehouse | WAREHOUSES | `id` (UUID) | `warehouseCode` (string) |
| ConsumableMaster | CONSUMABLE_MASTERS | `id` (UUID) | `consumableCode` (string) |
| WorkerMaster | WORKER_MASTERS | `id` (UUID) | 기존 유니크 필드 |
| PartnerMaster | PARTNER_MASTERS | `id` (UUID) | 기존 유니크 필드 |
| ComCode | COM_CODES | `id` (UUID) | `(groupCode, detailCode)` 복합PK |
| Plant | PLANTS | `id` (UUID) | `(plantCode, shopCode, lineCode, cellCode)` 복합PK |
| User | USERS | `id` (UUID) | `email` (string) |
| Role | ROLES | `id` (increment) | `code` (string) |
| JobOrder | JOB_ORDERS | `id` (UUID) | `orderNo` (string, 자연키) |
| CustomerOrder | CUSTOMER_ORDERS | `id` (UUID) | `orderNo` (string) |
| PurchaseOrder | PURCHASE_ORDERS | `id` (UUID) | `poNo` (string) |
| ShipmentOrder | SHIPMENT_ORDERS | `id` (UUID) | `shipOrderNo` (string) |
| SubconOrder | SUBCON_ORDERS | `id` (UUID) | `orderNo` (string) |
| BoxMaster | BOX_MASTERS | `id` (UUID) | `boxNo` (string) |
| OqcRequest | OQC_REQUESTS | `id` (UUID) | `requestNo` (string) |
| MatLot | MAT_LOTS | `id` (UUID) | `lotNo` (string) |

### 트랜잭션/이력 테이블 → SEQUENCE (NUMBER PK)

| 엔티티 | 테이블명 | 새 PK |
|---|---|---|
| StockTransaction | STOCK_TRANSACTIONS | `id` (NUMBER, SEQUENCE) |
| ProductTransaction | PRODUCT_TRANSACTIONS | `id` (NUMBER, SEQUENCE) |
| ProdResult | PROD_RESULTS | `id` (NUMBER, SEQUENCE) |
| InspectResult | INSPECT_RESULTS | `id` (NUMBER, SEQUENCE) |
| MatReceiving | MAT_RECEIVINGS | `id` (NUMBER, SEQUENCE) |
| MatIssue | MAT_ISSUES | `id` (NUMBER, SEQUENCE) |
| IqcLog | IQC_LOGS | `id` (NUMBER, SEQUENCE) |
| DefectLog | DEFECT_LOGS | `id` (NUMBER, SEQUENCE) |
| ActivityLog | ACTIVITY_LOGS | `id` (NUMBER, SEQUENCE) |
| 기타 이력 테이블 | ... | `id` (NUMBER, SEQUENCE) |

### 복합 유니크 → 복합 PK 전환

| 엔티티 | 복합 PK |
|---|---|
| MatStock | `(warehouseCode, itemCode, lotNo)` |
| ProductStock | `(warehouseCode, itemCode, lotNo)` |
| BomMaster | `(parentItemCode, childItemCode, revision)` |

## 2. 품목코드 필드 통일

### PartMaster 리네이밍

| 현재 | 변경 후 | 컬럼명 |
|---|---|---|
| `partCode` | `itemCode` | `ITEM_CODE` |
| `partName` | `itemName` | `ITEM_NAME` |
| `partType` | `itemType` | `ITEM_TYPE` |
| 테이블명 `PART_MASTERS` | `ITEM_MASTERS` | - |

### 모든 참조 엔티티에서 `partId` → `itemCode` 변경

| 엔티티 | 현재 | 변경 후 |
|---|---|---|
| MatStock | `partId` (UUID) | `itemCode` (string) |
| ProductStock | `partId` (UUID) | `itemCode` (string) |
| MatLot | `partId` (UUID) | `itemCode` (string) |
| MatReceiving | `partId` (UUID) | `itemCode` (string) |
| StockTransaction | `partId` (UUID) | `itemCode` (string) |
| ProductTransaction | `partId` (UUID) | `itemCode` (string) |
| IqcLog | `partId` (UUID) | `itemCode` (string) |
| IqcItemMaster | `partId` (UUID) | `itemCode` (string) |
| IqcPartLink | `partId` (UUID) | `itemCode` (string) |
| JobOrder | `partId` (UUID, FK) | `itemCode` (string, FK) |
| OqcRequest | `partId` (UUID) | `itemCode` (string) |
| BoxMaster | `partId` (UUID) | `itemCode` (string) |
| PurchaseOrderItem | `partId` (UUID) | `itemCode` (string) |
| BomMaster | `parentPartId`/`childPartId` | `parentItemCode`/`childItemCode` |
| CustomerOrderItem | `partId` (UUID) | `itemCode` (string) |

### 충돌 해결

| 엔티티 | 현재 `itemCode` | 변경 후 | 이유 |
|---|---|---|---|
| IqcItemPool | `itemCode` (검사항목코드) | `inspItemCode` | 품목코드와 구분 |
| IqcItemPool | `itemName` | `inspItemName` | 일관성 |
| IqcGroupItem | `itemId` | `inspItemId` | 검사항목 참조 |
| EquipBomItem | `itemCode` (설비부품코드) | `bomItemCode` | 품목코드와 구분 |
| EquipBomItem | `itemName` | `bomItemName` | 일관성 |

## 3. 구현 순서

```
1. Entity 수정 (Backend - 핵심, 82개 엔티티)
   - PK 변경: UUID → 자연키/SEQUENCE
   - 품목 참조: partId → itemCode
   - 충돌 필드 리네이밍
   ↓
2. SQL DDL 스크립트 생성
   - DROP 기존 테이블 전체
   - CREATE TABLE (새 스키마)
   - CREATE SEQUENCE (트랜잭션 테이블용)
   ↓
3. DTO / Service / Controller 수정
   - partId 파라미터 → itemCode
   - UUID 비교 → 문자열 비교
   - Repository find 조건 변경
   ↓
4. Frontend 수정
   - API 요청/응답: partId → itemCode
   - DataGrid 컬럼 정의
   - 검색 필터
   - i18n (ko, en, zh, vi 4개 파일)
   ↓
5. Oracle DB 스키마 재생성
   - SQL 스크립트 실행
   ↓
6. 빌드 & 검증
   - pnpm build
   - 전체 동작 확인
```

## 4. TypeORM Entity 패턴

### 마스터 PK (자연키)

```typescript
// Before
@PrimaryGeneratedColumn('uuid', { name: 'ID' })
id: string;

@Column({ name: 'PART_CODE', unique: true })
partCode: string;

// After
@PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
itemCode: string;
```

### 트랜잭션 PK (SEQUENCE)

```typescript
// Before
@PrimaryGeneratedColumn('uuid', { name: 'ID' })
id: string;

// After
@PrimaryGeneratedColumn({ name: 'ID', type: 'number' })
id: number;
```

### FK 참조 변경

```typescript
// Before
@Column({ name: 'PART_ID', nullable: true })
partId: string;

// After
@Column({ name: 'ITEM_CODE', length: 50, nullable: true })
itemCode: string;
```

## 5. 리스크 및 주의사항

| 리스크 | 대응 |
|---|---|
| 82개 엔티티 수정 누락 | TypeScript 컴파일 에러로 감지 |
| IQC/EquipBom `itemCode` 충돌 | `inspItemCode`, `bomItemCode`로 리네이밍 |
| Frontend 변수명 누락 | `pnpm build`로 전체 검증 |
| Oracle SEQUENCE 미생성 | DDL 스크립트에 포함 |
| `synchronize: false` 유지 | Entity + SQL 동시 준비 후 한 번에 적용 |
