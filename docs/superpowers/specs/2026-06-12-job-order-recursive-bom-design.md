# 작업지시 BOM 기반 전체 계층 자동생성 설계

**날짜:** 2026-06-12  
**범위:** 작업지시(JobOrder) 생성 시 BOM 전 계층 반제품 작업지시 재귀 자동생성 + 공정/설비/루트 컬럼 추가

---

## 문제 정의

현재 `createChildOrders()` / `createChildOrdersFromPlan()` 두 메서드가 BOM 1단계 자식만 생성하고 재귀 호출이 없어, 반제품의 반제품(2단계 이상)은 자동 생성되지 않는다. 또한 작업지시에 공정 코드·설비 코드 컬럼이 없어 어느 공정·설비에서 작업할지 저장할 수 없다.

---

## 요구사항

1. BOM 기반 반제품 작업지시를 **전 계층(모든 레벨)** 재귀 생성한다.
2. 동시 생성된 하위 작업지시는 모두 최상위 ORDER_NO를 `ROOT_ORDER_NO`로 참조한다.
3. 작업지시에 대표 공정(`PROCESS_CODE`)과 설비(`EQUIP_CODE`) 컬럼을 추가한다.
   - `PROCESS_CODE`: 해당 품목의 라우팅 첫 번째 SEQ 공정에서 자동 상속
   - `EQUIP_CODE`: 생성 시 null, 이후 수동 배정

---

## 데이터 모델 변경

### JOB_ORDERS 테이블 — 컬럼 3개 추가

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---|---|---|
| `ROOT_ORDER_NO` | VARCHAR2(50) | O | null | 동시생성 그룹의 최상위 ORDER_NO. 최상위 자신은 null |
| `PROCESS_CODE` | VARCHAR2(50) | O | null | 대표 공정 코드. 라우팅 첫 SEQ에서 자동 상속 |
| `EQUIP_CODE` | VARCHAR2(50) | O | null | 작업 설비 코드. 생성 후 수동 배정 |

### 예시 데이터

```
ORDER_NO       PARENT_ID  ROOT_ORDER_NO  PROCESS_CODE  EQUIP_CODE
W001           null       null           P-PRESS        null      ← 최상위(완제품)
W001-01        W001.id    W001           P-WELD         null      ← 반제품 1단계
W001-01-01     W001-01.id W001           P-CUT          null      ← 반제품 2단계
W001-01-02     W001-01.id W001           P-GRIND        null      ← 반제품 2단계(형제)
W001-02        W001.id    W001           P-ASM          null      ← 반제품 1단계(형제)
```

- `PARENT_ID`: 직계 부모 FK (기존 컬럼, 변경 없음)
- `ROOT_ORDER_NO`: 모든 하위 작업지시가 동일한 최상위 번호를 공유

---

## 마이그레이션 SQL

```sql
-- 파일: apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql
ALTER TABLE JOB_ORDERS ADD (
  ROOT_ORDER_NO VARCHAR2(50),
  PROCESS_CODE  VARCHAR2(50),
  EQUIP_CODE    VARCHAR2(50)
);
```

---

## TypeORM 엔티티 변경 (job-order.entity.ts)

```typescript
@Column({ name: 'ROOT_ORDER_NO', type: 'varchar2', length: 50, nullable: true })
rootOrderNo: string | null;

@Column({ name: 'PROCESS_CODE', type: 'varchar2', length: 50, nullable: true })
processCode: string | null;

@Column({ name: 'EQUIP_CODE', type: 'varchar2', length: 50, nullable: true })
equipCode: string | null;
```

---

## 재귀 생성 로직

### 핵심 알고리즘

```
createChildOrdersRecursive(queryRunner, parent, rootOrderNo, depth=0, maxDepth=5):

  1. depth >= maxDepth → return  (무한루프 방지)

  2. BOM에서 parent.itemCode의 직계 자식 조회
     WHERE parentItemCode = parent.itemCode AND useYn = 'Y'
     ORDER BY seq ASC

  3. 자식 품목 중 itemType = 'SEMI_PRODUCT' 필터링
     (원자재, 구매품 등은 작업지시 불필요)

  4. 각 반제품에 대해:
     a. 해당 품목의 routingCode 조회 (ITEM_MASTERS → routing 매핑)
     b. 라우팅의 첫 번째 SEQ(ROUTING_PROCESSES ORDER BY seq ASC LIMIT 1) 조회
     c. JobOrder 생성:
          orderNo      = parent.orderNo + '-' + String(i+1).padStart(2,'0')
          itemCode     = bom.childItemCode
          planQty      = Math.ceil(parent.planQty * bom.qtyPer)
          planDate     = parent.planDate
          parentId     = parent.id          ← 직계 부모 PK
          rootOrderNo  = rootOrderNo        ← 항상 최상위 ORDER_NO
          routingCode  = 조회된 routingCode
          processCode  = 첫 SEQ의 processCode (없으면 null)
          equipCode    = null
          status       = WAITING
          company, plant 상속
     d. queryRunner.manager.save(child)
     e. 재귀: createChildOrdersRecursive(queryRunner, child, rootOrderNo, depth+1, maxDepth)

  5. 반제품이 없으면 즉시 return
```

### 최상위 작업지시 생성 시 호출 시점

```typescript
// job-order.service.ts — create() 내부
const saved = await queryRunner.manager.save(jobOrder);

if (dto.autoCreateChildren) {
  await this.createChildOrdersRecursive(
    queryRunner,
    saved,
    saved.orderNo,   // 최상위 자신의 orderNo가 rootOrderNo
    0,
    5,
  );
}
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|---|---|
| `apps/backend/src/entities/job-order.entity.ts` | 컬럼 3개 추가 |
| `apps/backend/src/modules/production/services/job-order.service.ts` | `createChildOrders` → `createChildOrdersRecursive`로 교체 |
| `apps/backend/src/modules/production/services/prod-plan.service.ts` | `createChildOrdersFromPlan` → 동일하게 재귀 버전으로 교체 |
| `apps/backend/src/modules/production/dto/job-order.dto.ts` | `processCode`, `equipCode` 필드 추가 (선택) |
| `apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql` | 신규 마이그레이션 파일 |

---

## 설계 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 재귀 최대 깊이 | 5 | 실 제조 BOM은 통상 2~4단계, 안전 여유 포함 |
| PROCESS_CODE 출처 | 라우팅 첫 번째 SEQ | 대표 공정 = 첫 공정으로 통일 |
| EQUIP_CODE 초기값 | null | 생성 시점에 특정 설비를 결정하기 어려움, 별도 배정 단계 필요 |
| ROOT_ORDER_NO (최상위) | null | 자기 자신이 루트이므로 null로 구분 |
| ORDER_NO 패턴 | `W001-01-01` | 기존 패턴(W001-01) 확장, 접두사 체인 |
| 두 서비스 중복 | 각각 재귀 메서드 유지 | 범위 내 최소 변경 원칙 |

---

## 범위 외 (이번 작업에서 다루지 않음)

- 프론트엔드 작업지시 목록/상세 화면에 새 컬럼 표시
- EQUIP_CODE 수동 배정 UI
- 기존 작업지시 데이터 마이그레이션(ROOT_ORDER_NO 역산)
