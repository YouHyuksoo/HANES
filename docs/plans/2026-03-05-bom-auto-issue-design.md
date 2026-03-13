# BOM 기반 자재 자동차감 설계

## 배경

HANES MES의 원자재는 전선롤(M 단위)이며, 절단 공정을 거쳐 반제품(EA)이 되고, 조립하여 완제품(EA)이 된다.
현재 생산실적 등록 시 BOM 기반 자재 자동차감이 미구현이며, 수동 출고만 가능하다.

## 시나리오

```
A (완제품, unit=EA)
 └─ BOM: B 10EA 필요 (qtyPer=10)

B (반제품, unit=EA)
 └─ BOM: C 10M 필요 (qtyPer=10, per 1EA of B)

C (원자재 전선롤, unit=M)
```

- A 5EA 생산 → B 50EA 차감 (5 × 10)
- B 10EA 생산 → C 100M 차감 (10 × 10)

## 단위 규칙

- BOM `qtyPer`는 **부모 1개 생산 시 자식 품목의 기준단위(unit) 기준 소요량**
- 별도 환산단위 없음. 품목의 `unit` 필드만 사용
- 자동차감 계산: `소요량 = qtyPer × (goodQty + defectQty)`

## 설정 (SysConfig)

| 키 | 값 | 설명 |
|---|---|---|
| `MAT_AUTO_ISSUE_TIMING` | `ON_CREATE` / `ON_COMPLETE` / `OFF` | 자동차감 시점 |
| `MAT_ISSUE_STOCK_CHECK` | `WARN` / `BLOCK` | 재고 부족 시 동작 |

## 자동차감 핵심 흐름

```
생산실적 등록/완료 (설정에 따라)
  │
  ├─ 1. 작업지시에서 itemCode(생산품목) 확인
  ├─ 2. BomService.findByParentId(itemCode) → BOM 자재 목록
  ├─ 3. 자재 소요량 계산: qtyPer × (goodQty + defectQty)
  ├─ 4. FIFO LOT 선택 (createdAt ASC, currentQty > 0)
  ├─ 5. 재고 부족 체크 (SysConfig에 따라 WARN/BLOCK)
  └─ 6. MatIssue 생성 (issueType: PROD_AUTO)
        → LOT 차감 + StockTransaction 생성
```

## FIFO 분할 차감

하나의 LOT으로 소요량 충족 불가 시 다음 LOT에서 나머지 차감:

```
예: C 20M 필요
LOT-001 (8M)  → 전량 8M 차감 → DEPLETED
LOT-002 (30M) → 12M 차감    → 잔량 18M
합계: 20M 차감 완료
```

LOT별로 MatIssue 레코드를 각각 생성한다.

## 재고 부족 처리

- **WARN**: 가용재고 < 소요량이면 경고 로그, 있는 만큼만 차감. 실적 등록 허용
- **BLOCK**: 가용재고 < 소요량이면 BadRequestException. 실적 등록 차단

## 실적 취소 시 역분개

ProdResult 취소 → 연결된 PROD_AUTO MatIssue 모두 역분개 (기존 cancel 로직 재사용)

## 수정 대상

| 파일 | 변경 |
|------|------|
| `prod-result.service.ts` | create/complete에 자동차감 호출 추가 |
| **신규** `auto-issue.service.ts` | BOM 조회 → FIFO LOT → 분할차감 전담 |
| `mat-issue.service.ts` | PROD_AUTO issueType 지원 |
| `mat-issue.entity.ts` | issueType에 PROD_AUTO 추가 |
| `seeds/seed-sys-config.ts` | 설정 2개 시드 |

## 변경하지 않는 것

- PartMaster 엔티티/UI (기존 unit 필드 활용)
- BomMaster 엔티티/UI (기존 qtyPer 활용)
- 기존 수동 출고 기능 (유지)
