# Phase 1 — SG_LABELS · PRODUCT_GENEALOGY 스키마 추가 (비파괴)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`로 task별 구현. 모든 step은 체크박스(`- [ ]`). 이 Phase는 **비파괴 추가만** — 기존 흐름/데이터 변경 없음.

**Goal:** 반제품 묶음 추적라벨(`SG_LABELS`)과 생산 genealogy(`PRODUCT_GENEALOGY`) 테이블·시퀀스·엔티티·채번을 추가한다. 기존 코드 경로는 건드리지 않는다.

**Architecture:** 마스터 계획(`2026-06-19-harness-production-flow-renewal.md`) §0/§1 LOCKED 설계 기준. SG_LABELS=반제품 묶음 시리얼(잔량 보유), PRODUCT_GENEALOGY=재귀 genealogy(FG→SG, SG→MAT_LOT). 채번은 application-format 채널(전역 시퀀스, `nextBoxNo` 패턴).

**Tech Stack:** Oracle(JSHANES, `oracle-db` 스킬), TypeORM 엔티티, NestJS, jest 단위테스트.

**전제 확인:** TypeORM `synchronize=false`(프로젝트는 마이그레이션 사용). 신규 `.entity.ts`는 entities glob으로 인식되며 자동 DDL 안 함 — DDL은 `oracle-db` 스킬로 직접 적용.

---

### Task 1: 마이그레이션 DDL 파일 작성

**Files:**
- Create: `apps/backend/src/migrations/2026-06-19_sg_labels_genealogy.sql`

- [ ] **Step 1: DDL 파일 작성** (idempotent DECLARE/EXECUTE IMMEDIATE)

```sql
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM USER_SEQUENCES WHERE SEQUENCE_NAME = 'SEQ_SG_LABEL';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_SG_LABEL START WITH 1 INCREMENT BY 1 NOCACHE';
  END IF;

  SELECT COUNT(*) INTO v_count FROM USER_SEQUENCES WHERE SEQUENCE_NAME = 'SEQ_PROD_GENEALOGY';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_PROD_GENEALOGY START WITH 1 INCREMENT BY 1 NOCACHE';
  END IF;

  SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'SG_LABELS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE SG_LABELS (
        SG_BARCODE VARCHAR2(30) NOT NULL,
        ITEM_CODE VARCHAR2(50) NOT NULL,
        ORDER_NO VARCHAR2(50),
        ISSUE_PROCESS_CODE VARCHAR2(50),
        CURRENT_PROCESS_CODE VARCHAR2(50),
        MOUNTED_EQUIP_CODE VARCHAR2(50),
        WAREHOUSE_CODE VARCHAR2(50),
        INIT_QTY NUMBER DEFAULT 0 NOT NULL,
        REMAIN_QTY NUMBER DEFAULT 0 NOT NULL,
        STATUS VARCHAR2(20) DEFAULT ''IN_STOCK'' NOT NULL,
        WORKER_ID VARCHAR2(50),
        ISSUED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        COMPANY VARCHAR2(50) NOT NULL,
        PLANT_CD VARCHAR2(50) NOT NULL,
        CREATED_BY VARCHAR2(50),
        UPDATED_BY VARCHAR2(50),
        CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT PK_SG_LABELS PRIMARY KEY (SG_BARCODE),
        CONSTRAINT CK_SG_LABELS_STATUS CHECK (STATUS IN (''IN_STOCK'',''MOUNTED'',''CONSUMED'',''DEFECT''))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_SG_LABELS_ITEM ON SG_LABELS (ITEM_CODE)';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_SG_LABELS_ORDER ON SG_LABELS (ORDER_NO)';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_SG_LABELS_STATUS ON SG_LABELS (STATUS)';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_SG_LABELS_EQUIP ON SG_LABELS (MOUNTED_EQUIP_CODE)';
  END IF;

  SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'PRODUCT_GENEALOGY';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE PRODUCT_GENEALOGY (
        GENEALOGY_ID NUMBER NOT NULL,
        PARENT_TYPE VARCHAR2(20) NOT NULL,
        PARENT_KEY VARCHAR2(50) NOT NULL,
        CHILD_TYPE VARCHAR2(20) NOT NULL,
        CHILD_KEY VARCHAR2(100) NOT NULL,
        ITEM_CODE VARCHAR2(50),
        QTY NUMBER DEFAULT 1 NOT NULL,
        PROCESS_CODE VARCHAR2(50),
        CIRCUIT_NO VARCHAR2(50),
        COMPANY VARCHAR2(50) NOT NULL,
        PLANT_CD VARCHAR2(50) NOT NULL,
        CREATED_BY VARCHAR2(50),
        CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT PK_PRODUCT_GENEALOGY PRIMARY KEY (GENEALOGY_ID),
        CONSTRAINT CK_PROD_GENEALOGY_PT CHECK (PARENT_TYPE IN (''FG'',''SG'')),
        CONSTRAINT CK_PROD_GENEALOGY_CT CHECK (CHILD_TYPE IN (''SG'',''MAT_LOT''))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_PROD_GENEALOGY_PARENT ON PRODUCT_GENEALOGY (PARENT_KEY)';
    EXECUTE IMMEDIATE 'CREATE INDEX IX_PROD_GENEALOGY_CHILD ON PRODUCT_GENEALOGY (CHILD_KEY)';
  END IF;

  EXECUTE IMMEDIATE q'[COMMENT ON TABLE SG_LABELS IS '반제품 묶음 추적라벨(잔량 가닥수 보유)']';
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN SG_LABELS.INIT_QTY IS '최초 가닥수']';
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN SG_LABELS.REMAIN_QTY IS '잔여 가닥수']';
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN SG_LABELS.MOUNTED_EQUIP_CODE IS '장착 설비(NULL=미장착)']';
  EXECUTE IMMEDIATE q'[COMMENT ON TABLE PRODUCT_GENEALOGY IS '생산 genealogy(제품→묶음→원자재 lot 재귀)']';
END;
/
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/migrations/2026-06-19_sg_labels_genealogy.sql
git commit -F <tmpfile>   # "feat(db): SG_LABELS·PRODUCT_GENEALOGY 스키마 DDL (비파괴)"
```

---

### Task 2: JSHANES에 DDL 적용·검증

**도구:** `oracle-db` 스킬 (사이트 `JSHANES`). 비파괴(IF NOT EXISTS 패턴)라 운영 중단 불필요.

- [ ] **Step 1: DDL 실행** — `oracle-db` 스킬로 `2026-06-19_sg_labels_genealogy.sql` 전체 블록 실행(JSHANES).

- [ ] **Step 2: 생성 검증**

```sql
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME IN ('SG_LABELS','PRODUCT_GENEALOGY');
SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME IN ('SEQ_SG_LABEL','SEQ_PROD_GENEALOGY');
```
Expected: 테이블 2건, 시퀀스 2건.

- [ ] **Step 3: 의존 PL/SQL 영향 없음 확인** (신규 테이블이라 무영향)

```sql
SELECT OBJECT_NAME, STATUS FROM USER_OBJECTS WHERE STATUS = 'INVALID';
```
Expected: 신규로 인한 INVALID 없음.

---

### Task 3: SgLabel 엔티티

**Files:**
- Create: `apps/backend/src/entities/sg-label.entity.ts`

- [ ] **Step 1: 엔티티 작성** (nullable 컬럼은 `type` 명시 — Oracle 크래시 방지)

```typescript
/**
 * @file sg-label.entity.ts
 * @description 반제품 묶음 추적라벨(SgLabel) — 최초 공정 1회 발행, 서브공정에서 가닥 단위 소비.
 *              잔량(REMAIN_QTY)을 시리얼에 보유한다. 재고 수량은 PRODUCT_STOCKS(품목코드)에서 별도 집계.
 * STATUS: IN_STOCK → MOUNTED → CONSUMED / DEFECT
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SG_LABELS' })
@Index(['itemCode'])
@Index(['orderNo'])
@Index(['status'])
@Index(['mountedEquipCode'])
export class SgLabel {
  @PrimaryColumn({ name: 'SG_BARCODE', length: 30 })
  sgBarcode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ type: 'varchar2', name: 'ISSUE_PROCESS_CODE', length: 50, nullable: true })
  issueProcessCode: string | null;

  @Column({ type: 'varchar2', name: 'CURRENT_PROCESS_CODE', length: 50, nullable: true })
  currentProcessCode: string | null;

  @Column({ type: 'varchar2', name: 'MOUNTED_EQUIP_CODE', length: 50, nullable: true })
  mountedEquipCode: string | null;

  @Column({ type: 'varchar2', name: 'WAREHOUSE_CODE', length: 50, nullable: true })
  warehouseCode: string | null;

  @Column({ name: 'INIT_QTY', type: 'int', default: 0 })
  initQty: number;

  @Column({ name: 'REMAIN_QTY', type: 'int', default: 0 })
  remainQty: number;

  @Column({ name: 'STATUS', length: 20, default: 'IN_STOCK' })
  status: string;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'ISSUED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
Expected: 신규 파일 관련 에러 0.

---

### Task 4: ProductGenealogy 엔티티

**Files:**
- Create: `apps/backend/src/entities/product-genealogy.entity.ts`

- [ ] **Step 1: 엔티티 작성** (NUMBER PK는 서비스에서 `SEQ_PROD_GENEALOGY.NEXTVAL`로 채움 — `@PrimaryGeneratedColumn` 사용 안 함)

```typescript
/**
 * @file product-genealogy.entity.ts
 * @description 생산 genealogy — 부모 시리얼 ← 자식 소스 링크(재귀).
 *              FG→SG(키팅), SG→MAT_LOT(반제품 생산), FG→MAT_LOT(서브공정 직접 원자재).
 *              GENEALOGY_ID는 SEQ_PROD_GENEALOGY.NEXTVAL로 채운다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PRODUCT_GENEALOGY' })
@Index(['parentKey'])
@Index(['childKey'])
export class ProductGenealogy {
  @PrimaryColumn({ name: 'GENEALOGY_ID', type: 'int' })
  genealogyId: number;

  /** 'FG' | 'SG' */
  @Column({ name: 'PARENT_TYPE', length: 20 })
  parentType: string;

  @Column({ name: 'PARENT_KEY', length: 50 })
  parentKey: string;

  /** 'SG' | 'MAT_LOT' */
  @Column({ name: 'CHILD_TYPE', length: 20 })
  childType: string;

  @Column({ name: 'CHILD_KEY', length: 100 })
  childKey: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'CIRCUIT_NO', length: 50, nullable: true })
  circuitNo: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
Expected: 에러 0.

- [ ] **Step 3: 커밋 (Task 3+4)**

```bash
git add apps/backend/src/entities/sg-label.entity.ts apps/backend/src/entities/product-genealogy.entity.ts
git commit -F <tmpfile>   # "feat(entity): SgLabel·ProductGenealogy 엔티티 추가"
```

---

### Task 5: production.module 등록

**Files:**
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] **Step 1: import 추가** (파일 상단 import 구역)

```typescript
import { SgLabel } from '../../entities/sg-label.entity';
import { ProductGenealogy } from '../../entities/product-genealogy.entity';
```

- [ ] **Step 2: `TypeOrmModule.forFeature([...])` 배열 끝에 추가**

기존 배열 마지막 항목(`HarnessCircuitSpec`) 뒤에 `, SgLabel, ProductGenealogy` 추가. (서비스 주입은 Phase 2에서)

- [ ] **Step 3: tsc 확인**

Run: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/production/production.module.ts
git commit -F <tmpfile>   # "feat(production): SG_LABELS·genealogy 엔티티 모듈 등록"
```

---

### Task 6: nextSgLabel 채번 (TDD)

**Files:**
- Modify: `apps/backend/src/shared/numbering.service.ts`
- Test: `apps/backend/src/shared/numbering.sg-label.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { NumberingService } from './numbering.service';

describe('NumberingService.nextSgLabel', () => {
  it('SG + YYMMDD + - + 5자리 포맷으로 채번한다', async () => {
    const dataSource: any = {
      manager: { query: jest.fn().mockResolvedValue([{ NEXT_SEQ: 7 }]) },
    };
    const svc = new NumberingService({} as any, {} as any, dataSource);
    const no = await svc.nextSgLabel();
    expect(no).toMatch(/^SG\d{6}-00007$/);
    expect(dataSource.manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_SG_LABEL.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @harness/backend exec jest src/shared/numbering.sg-label.spec.ts`
Expected: FAIL ("nextSgLabel is not a function").

- [ ] **Step 3: 메서드 구현** (`numbering.service.ts`의 `nextPalletNo` 메서드 바로 뒤에 추가)

```typescript
  /** 반제품 묶음 추적라벨 채번: SG + YYMMDD + '-' + 5자리(전역 시퀀스 SEQ_SG_LABEL). 날짜는 가독성용, 유일성은 시퀀스 보장. */
  async nextSgLabel(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_SG_LABEL.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `SG${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @harness/backend exec jest src/shared/numbering.sg-label.spec.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/shared/numbering.service.ts apps/backend/src/shared/numbering.sg-label.spec.ts
git commit -F <tmpfile>   # "feat(numbering): SG 묶음 추적라벨 채번(nextSgLabel)"
```

---

### Task 7: 최종 검증

- [ ] **Step 1: 백엔드 tsc 전체**

Run: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
Expected: 에러 0.

- [ ] **Step 2: 신규 spec 통과**

Run: `pnpm --filter @harness/backend exec jest src/shared/numbering.sg-label.spec.ts`
Expected: PASS.

- [ ] **Step 3: DB 검증 재확인** (Task 2 Step 2 쿼리 재실행, 테이블/시퀀스 존재)

---

## Self-Review
- 마스터 §2 "DB 신규 SG_LABELS/genealogy/시퀀스 + 엔티티" 전부 커버.
- 비파괴: 기존 테이블/서비스/흐름 미변경. forFeature 추가는 미사용 등록(무해).
- 명명: `SG_LABELS`(FG_LABELS 형제), 컬럼 nullable `type` 명시(Oracle 안전), NUMBER PK는 SEQ로(@PrimaryGeneratedColumn 회피).
- 채번 `nextSgLabel`은 `nextBoxNo`/`nextWipTx` 패턴과 일치(전역 시퀀스 application-format).
