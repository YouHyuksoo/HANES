# HANES MES 재고 관리 시스템 설계

## 1. 핵심 원칙

### 1.1 수불 원칙
- **입고**: 재고 증가 (+)
- **입고취소**: 재고 감소 (-) - 삭제가 아닌 음수 이력
- **출고**: 재고 감소 (-)
- **출고취소**: 재고 증가 (+) - 삭제가 아닌 음수 이력

### 1.2 트랜잭션 규칙
- 모든 수불은 이력으로 남김 (삭제 금지)
- 취소 시 원 트랜잭션 참조 + 음수 수량
- 재고 = SUM(트랜잭션 수량)

## 2. 창고 구조

### 2.1 창고 유형
| 창고유형 | 코드 | 설명 |
|---------|------|------|
| 원자재 창고 | RAW | 원자재/부자재 보관 |
| 반제품 창고 | WIP | 반제품 보관 |
| 완제품 창고 | FG | 완제품 보관 |
| 공정재공 | FLOOR | 생산 현장 재공 |
| 불량창고 | DEFECT | 불량품 격리 |
| 폐기창고 | SCRAP | 폐기 대기 |

### 2.2 재고 위치
- 창고 > 구역 > 랙 > 셀 (선택적)
- 공정재공: 라인 > 공정

## 3. 재고 흐름

### 3.1 원자재 흐름
```
[입고] 원자재창고 (+)
  ↓
[생산투입 출고] 원자재창고 (-) → 공정재공 (+)
  ↓
[공정완료 실적] 공정재공(원자재) (-) → 공정재공(반제품) (+)
```

### 3.2 반제품 흐름
```
[공정완료 실적] 공정재공(반제품) (+)
  ↓
[반제품창고 입고] 공정재공 (-) → 반제품창고 (+)
  ↓
[다음공정 출고] 반제품창고 (-) → 공정재공 (+)
```

### 3.3 완제품 흐름
```
[최종공정 실적] 공정재공(완제품) (+)
  ↓
[완제품창고 입고] 공정재공 (-) → 완제품창고 (+)
  ↓
[출하] 완제품창고 (-)
```

### 3.4 외주 흐름
```
[자재지급 출고] 원자재창고 (-) → 외주처 (+)
  ↓
[외주입고] 외주처 (-) → 반제품창고/완제품창고 (+)
```

## 4. 트랜잭션 유형

### 4.1 입고 유형 (IN)
| 코드 | 설명 | From | To |
|------|------|------|-----|
| MAT_IN | 원자재 입고 | - | 원자재창고 |
| MAT_IN_CANCEL | 원자재 입고취소 | 원자재창고 | - |
| WIP_IN | 반제품 창고입고 | 공정재공 | 반제품창고 |
| WIP_IN_CANCEL | 반제품 입고취소 | 반제품창고 | 공정재공 |
| FG_IN | 완제품 창고입고 | 공정재공 | 완제품창고 |
| FG_IN_CANCEL | 완제품 입고취소 | 완제품창고 | 공정재공 |
| SUBCON_IN | 외주 입고 | 외주처 | 창고 |
| SUBCON_IN_CANCEL | 외주 입고취소 | 창고 | 외주처 |

### 4.2 출고 유형 (OUT)
| 코드 | 설명 | From | To |
|------|------|------|-----|
| MAT_OUT | 생산투입 출고 | 원자재창고 | 공정재공 |
| MAT_OUT_CANCEL | 투입 출고취소 | 공정재공 | 원자재창고 |
| WIP_OUT | 반제품 출고 | 반제품창고 | 공정재공 |
| WIP_OUT_CANCEL | 반제품 출고취소 | 공정재공 | 반제품창고 |
| FG_OUT | 출하 | 완제품창고 | - |
| FG_OUT_CANCEL | 출하취소 | - | 완제품창고 |
| SUBCON_OUT | 외주 지급 | 원자재창고 | 외주처 |
| SUBCON_OUT_CANCEL | 외주 지급취소 | 외주처 | 원자재창고 |

### 4.3 공정 유형 (PROD)
| 코드 | 설명 | From | To |
|------|------|------|-----|
| PROD_CONSUME | 공정 소모 | 공정재공(원자재) | - |
| PROD_OUTPUT | 공정 산출 | - | 공정재공(반제품/완제품) |
| PROD_CANCEL | 실적 취소 | - | - |

### 4.4 기타 유형 (ADJ)
| 코드 | 설명 |
|------|------|
| ADJ_PLUS | 재고 조정 (+) |
| ADJ_MINUS | 재고 조정 (-) |
| SCRAP | 폐기 |
| TRANSFER | 창고간 이동 |

## 5. 테이블 구조

### 5.1 Warehouse (창고 마스터)
- warehouseCode: 창고 코드
- warehouseName: 창고명
- warehouseType: 창고 유형 (RAW, WIP, FG, FLOOR, DEFECT, SCRAP)
- plantCode: 공장 코드
- lineCode: 라인 코드 (공정재공용)
- processCode: 공정 코드 (공정재공용)

### 5.2 Stock (현재고)
- warehouseId: 창고 ID
- partId: 품목 ID
- lotId: LOT ID (선택)
- qty: 현재 수량
- reservedQty: 예약 수량
- availableQty: 가용 수량

### 5.3 StockTransaction (수불 이력)
- transNo: 트랜잭션 번호
- transType: 트랜잭션 유형
- transDate: 트랜잭션 일시
- fromWarehouseId: 출고 창고
- toWarehouseId: 입고 창고
- partId: 품목 ID
- lotId: LOT ID
- qty: 수량 (취소 시 음수)
- refType: 참조 유형 (JOB_ORDER, SUBCON, SHIPMENT 등)
- refId: 참조 ID
- cancelRefId: 취소 참조 ID (취소 시 원 트랜잭션 ID)
- status: 상태 (DONE, CANCELED)

## 6. API 설계

### 6.1 공통 수불 서비스
```typescript
// 입고
receiveStock(warehouseId, partId, lotId, qty, transType, refType, refId)

// 출고
issueStock(warehouseId, partId, lotId, qty, transType, refType, refId)

// 이동
transferStock(fromWarehouseId, toWarehouseId, partId, lotId, qty, transType, refType, refId)

// 입고취소
cancelReceive(transactionId)

// 출고취소
cancelIssue(transactionId)
```

### 6.2 재고 조회
```typescript
// 현재고 조회
getStock(warehouseId?, partId?, lotId?)

// 수불 이력 조회
getTransactions(warehouseId?, partId?, dateFrom?, dateTo?, transType?)

// 재고 집계
getStockSummary(partType?, warehouseType?)
```
