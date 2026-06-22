# 작업지시 BOM 전계층 재귀 자동생성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작업지시 생성 시 BOM 기반 반제품 작업지시를 전 계층 재귀 자동생성하고, `ROOT_ORDER_NO` / `PROCESS_CODE` / `EQUIP_CODE` 컬럼을 추가한다.

**Architecture:** `createChildOrders` (job-order.service.ts)와 `createChildOrdersFromPlan` (prod-plan.service.ts) 두 메서드를 재귀 버전으로 교체한다. 각 자식 생성 후 즉시 재귀 호출해 BOM 깊이 N까지 반제품 작업지시를 생성한다. 동시 생성된 모든 하위 작업지시는 `ROOT_ORDER_NO`로 최상위 ORDER_NO를 공유하고, `PROCESS_CODE`는 해당 품목 라우팅의 첫 번째 SEQ 공정에서 자동 상속한다.

**Tech Stack:** NestJS, TypeORM, Oracle DB, TypeScript

---

## 파일 변경 목록

| 파일 | 작업 |
|---|---|
| `apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql` | 신규 생성 |
| `apps/backend/src/entities/job-order.entity.ts` | 컬럼 3개 추가 (62~68행 이후) |
| `apps/backend/src/modules/production/dto/job-order.dto.ts` | `processCode`, `equipCode` 필드 추가 |
| `apps/backend/src/modules/production/services/job-order.service.ts` | 최상위 create에 3컬럼 추가 + `createChildOrders` → 재귀 버전 |
| `apps/backend/src/modules/production/services/prod-plan.service.ts` | `RoutingProcess` 주입 + `createChildOrdersFromPlan` → 재귀 버전 |

> `production.module.ts`는 이미 `RoutingProcess`가 `TypeOrmModule.forFeature`에 등록되어 있어 수정 불필요.

---

### Task 1: DB 마이그레이션 SQL 생성 및 실행

**Files:**
- Create: `apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

`apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql` 파일을 다음 내용으로 생성:

```sql
-- 작업지시 테이블에 루트 참조·공정·설비 컬럼 추가
ALTER TABLE JOB_ORDERS ADD (
  ROOT_ORDER_NO VARCHAR2(50),
  PROCESS_CODE  VARCHAR2(50),
  EQUIP_CODE    VARCHAR2(50)
);
```

- [ ] **Step 2: `oracle-db` 스킬로 JSHANES 사이트에 SQL 실행**

`oracle-db` 스킬을 호출하고 위 파일을 JSHANES 사이트에 실행한다.

- [ ] **Step 3: 컬럼 추가 확인**

Oracle에서 다음 쿼리로 3개 컬럼 존재 확인:

```sql
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
FROM USER_TAB_COLUMNS
WHERE TABLE_NAME = 'JOB_ORDERS'
  AND COLUMN_NAME IN ('ROOT_ORDER_NO', 'PROCESS_CODE', 'EQUIP_CODE')
ORDER BY COLUMN_ID;
```

예상 결과: 3행 반환, 각 NULLABLE = 'Y'

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/migrations/2026-06-12_job_order_add_columns.sql
git commit -m "chore(migration): JOB_ORDERS에 ROOT_ORDER_NO·PROCESS_CODE·EQUIP_CODE 컬럼 추가"
```

---

### Task 2: JobOrder 엔티티 컬럼 3개 추가

**Files:**
- Modify: `apps/backend/src/entities/job-order.entity.ts`

- [ ] **Step 1: 엔티티 파일에 3개 컬럼 추가**

`job-order.entity.ts`의 `routingCode` 컬럼 선언 블록(63~68행) 바로 아래에 삽입:

**변경 전 (63~68행):**
```typescript
  /** 라우팅 코드 - 품목 기반 자동 조회 */
  @Column({ type: 'varchar2', name: 'ROUTING_CODE', length: 50, nullable: true })
  routingCode: string | null;

  @ManyToOne(() => RoutingGroup, { nullable: true })
  @JoinColumn({ name: 'ROUTING_CODE' })
  routing: RoutingGroup | null;
```

**변경 후:**
```typescript
  /** 라우팅 코드 - 품목 기반 자동 조회 */
  @Column({ type: 'varchar2', name: 'ROUTING_CODE', length: 50, nullable: true })
  routingCode: string | null;

  @ManyToOne(() => RoutingGroup, { nullable: true })
  @JoinColumn({ name: 'ROUTING_CODE' })
  routing: RoutingGroup | null;

  /** 동시생성 그룹의 최상위 ORDER_NO. 최상위 자신은 null */
  @Column({ type: 'varchar2', name: 'ROOT_ORDER_NO', length: 50, nullable: true })
  rootOrderNo: string | null;

  /** 대표 공정 코드 - 라우팅 첫 번째 SEQ에서 자동 상속 */
  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  /** 작업 설비 코드 - 생성 시 null, 이후 수동 배정 */
  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit
```

예상 결과: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/entities/job-order.entity.ts
git commit -m "feat(entity): JobOrder에 rootOrderNo·processCode·equipCode 컬럼 추가"
```

---

### Task 3: CreateJobOrderDto에 processCode · equipCode 필드 추가

**Files:**
- Modify: `apps/backend/src/modules/production/dto/job-order.dto.ts`

- [ ] **Step 1: DTO에 2개 필드 추가**

`CreateJobOrderDto`의 `autoCreateChildren` 필드(93~95행) 바로 아래에 삽입:

**변경 전 (93~96행):**
```typescript
  @ApiPropertyOptional({ description: 'BOM 기반 반제품 작업지시 자동생성 여부', default: false })
  @IsOptional()
  autoCreateChildren?: boolean;
}
```

**변경 후:**
```typescript
  @ApiPropertyOptional({ description: 'BOM 기반 반제품 작업지시 자동생성 여부', default: false })
  @IsOptional()
  autoCreateChildren?: boolean;

  @ApiPropertyOptional({ description: '대표 공정 코드 (미입력 시 라우팅 첫 SEQ에서 자동)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

  @ApiPropertyOptional({ description: '작업 설비 코드 (미입력 시 null, 추후 수동 배정)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit
```

예상 결과: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/modules/production/dto/job-order.dto.ts
git commit -m "feat(dto): CreateJobOrderDto에 processCode·equipCode 필드 추가"
```

---

### Task 4: JobOrderService — 최상위 작업지시에 신규 컬럼 저장 + 재귀 자동생성

**Files:**
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts`

- [ ] **Step 1: `resolveFirstProcessCode` 헬퍼 메서드 추가**

`resolveRoutingCodeByItem` 메서드(75~88행) 바로 아래에 삽입:

```typescript
  private async resolveFirstProcessCode(
    routingCode: string | null,
    company?: string | null,
    plant?: string | null,
  ): Promise<string | null> {
    if (!routingCode) return null;
    const firstStep = await this.routingProcessRepository.findOne({
      where: {
        routingCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    return firstStep?.processCode ?? null;
  }
```

- [ ] **Step 2: `create()` 메서드 내 `queryRunner.manager.create(JobOrder, {...})` 블록에 3개 컬럼 추가**

267~282행의 `queryRunner.manager.create(JobOrder, {...})` 블록을 다음으로 교체:

**변경 전 (267~282행):**
```typescript
      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo: dto.orderNo,
        itemCode: dto.itemCode,
        parentOrderNo: dto.parentId || null,
        lineCode: dto.lineCode,
        routingCode,
        planQty: dto.planQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        custPoNo: dto.custPoNo || null,
        remark: dto.remark,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
```

**변경 후:**
```typescript
      const processCode = dto.processCode ?? await this.resolveFirstProcessCode(routingCode, company, plant);

      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo: dto.orderNo,
        itemCode: dto.itemCode,
        parentOrderNo: dto.parentId || null,
        rootOrderNo: null,
        lineCode: dto.lineCode,
        routingCode,
        processCode,
        equipCode: dto.equipCode ?? null,
        planQty: dto.planQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        custPoNo: dto.custPoNo || null,
        remark: dto.remark,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
```

- [ ] **Step 3: `create()` 내 `autoCreateChildren` 호출부 수정**

285~287행을 다음으로 교체:

**변경 전:**
```typescript
      if (dto.autoCreateChildren) {
        await this.createChildOrders(queryRunner, saved, dto);
      }
```

**변경 후:**
```typescript
      if (dto.autoCreateChildren) {
        await this.createChildOrdersRecursive(queryRunner, saved, dto, saved.orderNo, 0);
      }
```

- [ ] **Step 4: `createChildOrders` 메서드 전체를 `createChildOrdersRecursive`로 교체**

296~347행(`createChildOrders` 메서드 전체)을 다음으로 교체:

```typescript
  /** BOM 기반 반제품 작업지시 재귀 자동생성 (최대 5단계) */
  private async createChildOrdersRecursive(
    queryRunner: QueryRunner,
    parent: JobOrder,
    dto: CreateJobOrderDto,
    rootOrderNo: string,
    depth: number,
  ): Promise<void> {
    if (depth >= 5) return;

    const bomItems = await this.bomMasterRepository.find({
      where: {
        parentItemCode: parent.itemCode,
        useYn: 'Y',
        ...(parent.company ? { company: parent.company } : {}),
        ...(parent.plant ? { plant: parent.plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.partMasterRepository
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'SEMI_PRODUCT' })
      .andWhere(parent.company ? 'p.company = :company' : '1=1', { company: parent.company })
      .andWhere(parent.plant ? 'p.plant = :plant' : '1=1', { plant: parent.plant })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));
    let childSeq = 0;

    for (const bom of bomItems) {
      if (!wipPartIds.has(bom.childItemCode)) continue;
      childSeq++;

      const childRoutingCode = await this.resolveRoutingCodeByItem(bom.childItemCode, parent.company, parent.plant);
      const childProcessCode = await this.resolveFirstProcessCode(childRoutingCode, parent.company, parent.plant);

      const child = await queryRunner.manager.save(
        queryRunner.manager.create(JobOrder, {
          orderNo: `${parent.orderNo}-${String(childSeq).padStart(2, '0')}`,
          itemCode: bom.childItemCode,
          parentOrderNo: parent.orderNo,
          rootOrderNo,
          lineCode: dto.lineCode,
          routingCode: childRoutingCode,
          processCode: childProcessCode,
          equipCode: null,
          planQty: Math.ceil(parent.planQty * Number(bom.qtyPer)),
          planDate: dto.planDate ? new Date(dto.planDate) : null,
          priority: dto.priority ?? 5,
          remark: `[자동생성] ${parent.orderNo}의 반제품`,
          status: 'WAITING',
          erpSyncYn: 'N',
          company: parent.company,
          plant: parent.plant,
        }),
      );

      await this.createChildOrdersRecursive(queryRunner, child, dto, rootOrderNo, depth + 1);
    }
  }
```

- [ ] **Step 5: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit
```

예상 결과: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/modules/production/services/job-order.service.ts
git commit -m "feat(job-order): BOM 반제품 작업지시 전계층 재귀 자동생성 + rootOrderNo·processCode 저장"
```

---

### Task 5: ProdPlanService — RoutingProcess 주입 + 재귀 버전

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-plan.service.ts`

- [ ] **Step 1: `RoutingProcess` import 추가**

파일 상단 import 목록(24행, `BomMaster` import 아래)에 추가:

**변경 전:**
```typescript
import { BomMaster } from '../../../entities/bom-master.entity';
```

**변경 후:**
```typescript
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
```

- [ ] **Step 2: 생성자에 `RoutingProcess` Repository 주입**

생성자의 `bomMasterRepo` 주입(49행) 바로 아래에 추가:

**변경 전:**
```typescript
    @InjectRepository(BomMaster)
    private readonly bomMasterRepo: Repository<BomMaster>,
    private readonly numbering: NumberingService,
```

**변경 후:**
```typescript
    @InjectRepository(BomMaster)
    private readonly bomMasterRepo: Repository<BomMaster>,
    @InjectRepository(RoutingProcess)
    private readonly routingProcessRepo: Repository<RoutingProcess>,
    private readonly numbering: NumberingService,
```

- [ ] **Step 3: `issueJobOrder()` 내 최상위 작업지시 create 블록에 신규 컬럼 추가**

`issueJobOrder()` 의 `queryRunner.manager.create(JobOrder, {...})` 블록(347~362행)을 다음으로 교체:

**변경 전 (347~362행):**
```typescript
      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo,
        planNo,
        itemCode: plan.itemCode,
        lineCode: dto.lineCode || plan.lineCode || null,
        routingCode,
        planQty: dto.issueQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? plan.priority,
        custPoNo: null,
        remark: dto.remark || `${plan.planNo}에서 발행`,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
```

**변경 후:**
```typescript
      const rootProcessCode = await this.resolveFirstProcessCode(routingCode, company, plant);

      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo,
        planNo,
        itemCode: plan.itemCode,
        rootOrderNo: null,
        lineCode: dto.lineCode || plan.lineCode || null,
        routingCode,
        processCode: rootProcessCode,
        equipCode: null,
        planQty: dto.issueQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? plan.priority,
        custPoNo: null,
        remark: dto.remark || `${plan.planNo}에서 발행`,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
```

- [ ] **Step 4: `issueJobOrder()` 내 `autoCreateChildren` 호출부 수정**

365~367행을 다음으로 교체:

**변경 전:**
```typescript
      if (dto.autoCreateChildren) {
        await this.createChildOrdersFromPlan(queryRunner, saved, company, plant);
      }
```

**변경 후:**
```typescript
      if (dto.autoCreateChildren) {
        await this.createChildOrdersFromPlanRecursive(queryRunner, saved, saved.orderNo, company, plant, 0);
      }
```

- [ ] **Step 5: `createChildOrdersFromPlan` 메서드 전체를 재귀 버전으로 교체**

387~442행(`createChildOrdersFromPlan` 메서드 전체)을 다음으로 교체:

```typescript
  /** BOM 기반 반제품 자식 작업지시 재귀 자동생성 (최대 5단계) */
  private async createChildOrdersFromPlanRecursive(
    queryRunner: import('typeorm').QueryRunner,
    parent: JobOrder,
    rootOrderNo: string,
    company?: string,
    plant?: string,
    depth: number = 0,
  ): Promise<void> {
    if (depth >= 5) return;

    const bomItems = await this.bomMasterRepo.find({
      where: {
        parentItemCode: parent.itemCode,
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.partRepo
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'SEMI_PRODUCT' })
      .andWhere(company ? 'p.company = :company' : '1=1', { company })
      .andWhere(plant ? 'p.plant = :plant' : '1=1', { plant })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));

    for (const bom of bomItems) {
      if (!wipPartIds.has(bom.childItemCode)) continue;

      const childRoutingCode = await this.resolveRoutingCodeByItem(bom.childItemCode, company, plant);
      const childProcessCode = await this.resolveFirstProcessCode(childRoutingCode, company, plant);
      const childOrderNo = await this.numbering.nextJobOrderNo(queryRunner);
      const childQty = Math.ceil(parent.planQty * Number(bom.qtyPer || 1));

      const child = await queryRunner.manager.save(
        queryRunner.manager.create(JobOrder, {
          orderNo: childOrderNo,
          parentOrderNo: parent.orderNo,
          rootOrderNo,
          planNo: parent.planNo,
          itemCode: bom.childItemCode,
          lineCode: parent.lineCode,
          routingCode: childRoutingCode,
          processCode: childProcessCode,
          equipCode: null,
          planQty: childQty,
          planDate: parent.planDate,
          priority: parent.priority,
          status: 'WAITING',
          erpSyncYn: 'N',
          company: company || null,
          plant: plant || null,
          remark: `${parent.orderNo} 하위 자동생성`,
        }),
      );

      await this.createChildOrdersFromPlanRecursive(queryRunner, child, rootOrderNo, company, plant, depth + 1);
    }
  }

  private async resolveFirstProcessCode(
    routingCode: string | null,
    company?: string | null,
    plant?: string | null,
  ): Promise<string | null> {
    if (!routingCode) return null;
    const firstStep = await this.routingProcessRepo.findOne({
      where: {
        routingCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    return firstStep?.processCode ?? null;
  }
```

- [ ] **Step 6: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit
```

예상 결과: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/production/services/prod-plan.service.ts
git commit -m "feat(prod-plan): BOM 반제품 작업지시 전계층 재귀 자동생성 + rootOrderNo·processCode 저장"
```

---

### Task 6: 최종 빌드 검증 및 DB 확인

- [ ] **Step 1: 전체 빌드 확인 (개발 서버가 떠 있지 않을 때만)**

```bash
pnpm --filter @harness/backend exec tsc --noEmit
```

예상 결과: 에러 없음

- [ ] **Step 2: 생성된 데이터 DB 확인**

작업지시 생성 API 호출 후 Oracle에서 다음 쿼리로 계층 확인:

```sql
SELECT ORDER_NO, PARENT_ID, ROOT_ORDER_NO, PROCESS_CODE, EQUIP_CODE, ITEM_CODE, PLAN_QTY
FROM JOB_ORDERS
WHERE ORDER_NO = :rootOrderNo
   OR ROOT_ORDER_NO = :rootOrderNo
ORDER BY ORDER_NO;
```

예상 결과:
- 최상위 작업지시: `ROOT_ORDER_NO = null`, `PROCESS_CODE` 채워짐
- 1단계 반제품: `ROOT_ORDER_NO = 최상위 ORDER_NO`, `PROCESS_CODE` 채워짐  
- 2단계 이상 반제품: 동일하게 `ROOT_ORDER_NO = 최상위 ORDER_NO`로 그룹화

- [ ] **Step 3: 완료 커밋**

```bash
git add -A
git commit -m "feat: 작업지시 BOM 전계층 재귀 자동생성 구현 완료"
```
