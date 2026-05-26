# IQC005 자재 입하관리 정렬 Phase A — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/material/arrival`를 IQC005 목업과 채번규칙 PDF 기준으로 재구조화하고, 시리얼(MAT_LOT) 자동 채번 + 라벨 미리보기 흐름을 도입한다.

**Architecture:** 기존 `NumberingService` + Oracle `PKG_SEQ_GENERATOR` 인프라를 그대로 활용. SEQ_RULES의 MAT_UID/ARRIVAL 룰만 PDF 포맷으로 정정. 입하 등록 시 PO 1라인 단위로 시리얼 N건 발급(LOT_UNIT_QTY 기준), 동일 ARRIVAL_NO로 그룹핑. 프론트는 modal-driven→page-driven으로 전환.

**Tech Stack:** NestJS + TypeORM + Oracle 12c+ / Next.js + React + TanStack Table + Tailwind / pnpm + Turborepo

**Spec:** `docs/superpowers/specs/2026-05-26-iqc005-alignment-phase-a-design.md`

**Reference:** `docs/standards/numbering-rules.md`

---

## Task 1: PKG_SEQ_GENERATOR 동작 확인 (선결 조사)

**Files:**
- Read-only: Oracle JSHANES `SYS.DBA_SOURCE` / `USER_SOURCE`

- [ ] **Step 1: oracle-db로 PKG_SEQ_GENERATOR 본문 추출**

oracle-db 스킬 또는 직접 SQL 실행:
```sql
SELECT LINE, TEXT FROM USER_SOURCE
WHERE NAME = 'PKG_SEQ_GENERATOR' AND TYPE IN ('PACKAGE', 'PACKAGE BODY')
ORDER BY TYPE, LINE;
```

- [ ] **Step 2: 일별 리셋 처리 패턴 파악**

본문에서 다음 항목 확인:
- `DATE_FORMAT`이 있을 때 어떻게 처리하는지
- SEQUENCE 호출이 단순 NEXTVAL인지, 날짜 기반 카운터 테이블 조작이 있는지
- 결과 문자열 조립 패턴 (PREFIX + DATE_FORMAT + SEPARATOR + PAD(SEQ))

- [ ] **Step 3: 결과 기록**

결과를 `.ai-coordination/JOURNAL.md`에 한 단락으로 추가:
- 패키지가 일별 리셋을 처리한다 → Task 4의 DBMS_SCHEDULER 잡 마이그레이션을 **스킵**
- 패키지가 처리하지 않는다 → Task 4 진행

이 task는 코드 변경 없음. 커밋도 없음 (JOURNAL 갱신만, 후속 task와 함께 커밋).

---

## Task 2: 마이그레이션 — MAT_LOTS.MFG_PARTNER_CODE 컬럼 추가

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_mat_lots_mfg_code.sql`
- Modify: `apps/backend/src/entities/mat-lot.entity.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`apps/backend/src/migrations/2026-05-26_iqc005_mat_lots_mfg_code.sql`:
```sql
-- 2026-05-26: IQC005 Phase A — MAT_LOTS에 제조사 코드 컬럼 추가
-- 제조사 데이터는 PARTNER_MASTERS.PARTNER_TYPE='MFG' row를 참조
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE MAT_LOTS ADD (MFG_PARTNER_CODE VARCHAR2(50))';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1430 THEN NULL; -- ORA-01430: column being added already exists
    ELSE RAISE;
    END IF;
END;
/

COMMENT ON COLUMN MAT_LOTS.MFG_PARTNER_CODE IS '제조사 거래처코드 (PARTNER_MASTERS.PARTNER_CODE, PARTNER_TYPE=MFG)';

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_MAT_LOTS_MFG ON MAT_LOTS(MFG_PARTNER_CODE)';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN NULL; -- ORA-00955: name already used
    ELSE RAISE;
    END IF;
END;
/
```

- [ ] **Step 2: JSHANES에 마이그레이션 적용**

oracle-db 스킬로 사이트 JSHANES에 위 SQL 실행. 적용 후 확인:
```sql
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH FROM USER_TAB_COLUMNS
WHERE TABLE_NAME = 'MAT_LOTS' AND COLUMN_NAME = 'MFG_PARTNER_CODE';
-- 예상: MFG_PARTNER_CODE VARCHAR2 50

SELECT INDEX_NAME FROM USER_INDEXES WHERE INDEX_NAME = 'IX_MAT_LOTS_MFG';
-- 예상: IX_MAT_LOTS_MFG
```

- [ ] **Step 3: 엔티티 컬럼 추가**

`apps/backend/src/entities/mat-lot.entity.ts`의 `MatLot` 클래스에 컬럼 추가 (기존 `VENDOR` 컬럼 정의 다음):
```ts
  @Column({ type: 'varchar2', name: 'MFG_PARTNER_CODE', length: 50, nullable: true })
  mfgPartnerCode: string | null;
```

- [ ] **Step 4: 백엔드 빌드 확인**

```bash
cd C:/Project/HANES && pnpm --filter @hanes/backend build
```
Expected: 0 error.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-26_iqc005_mat_lots_mfg_code.sql apps/backend/src/entities/mat-lot.entity.ts
git commit -m "feat(material): add MFG_PARTNER_CODE to MAT_LOTS (T-011 Phase A)"
```

---

## Task 3: 마이그레이션 — 채번 SEQUENCE 생성

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_serial_sequences.sql`

- [ ] **Step 1: SQL 작성**

```sql
-- 2026-05-26: IQC005 Phase A — 자재 시리얼 & 입하실적코드 일별 시퀀스
BEGIN
  EXECUTE IMMEDIATE q'[CREATE SEQUENCE SEQ_MAT_SERIAL_DAILY
    START WITH 1 INCREMENT BY 1 MAXVALUE 99999 NOCYCLE NOCACHE ORDER]';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN NULL; -- ORA-00955
    ELSE RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[CREATE SEQUENCE SEQ_ARRIVAL_NO_DAILY
    START WITH 1 INCREMENT BY 1 MAXVALUE 99999 NOCYCLE NOCACHE ORDER]';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/
```

- [ ] **Step 2: JSHANES 적용 + 확인**

```sql
SELECT SEQUENCE_NAME, MAX_VALUE, CACHE_SIZE, ORDER_FLAG
FROM USER_SEQUENCES
WHERE SEQUENCE_NAME IN ('SEQ_MAT_SERIAL_DAILY', 'SEQ_ARRIVAL_NO_DAILY');
-- 예상: 2건, MAX_VALUE=99999, CACHE_SIZE=0, ORDER_FLAG=Y
```

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-26_iqc005_serial_sequences.sql
git commit -m "feat(numbering): add SEQ_MAT_SERIAL_DAILY, SEQ_ARRIVAL_NO_DAILY (T-011)"
```

---

## Task 4: (조건부) 마이그레이션 — 일별 리셋 DBMS_SCHEDULER 잡

> Task 1 결과에 따라 PKG_SEQ_GENERATOR가 일별 리셋을 처리하지 않을 때만 진행. 처리하면 이 task 스킵하고 다음으로.

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_daily_reset_jobs.sql`

- [ ] **Step 1: SQL 작성**

```sql
-- 2026-05-26: IQC005 Phase A — 자정 시퀀스 리셋 (Oracle 12.2+ ALTER SEQUENCE RESTART)
BEGIN
  BEGIN DBMS_SCHEDULER.DROP_JOB('JOB_RESET_MAT_SERIAL_DAILY', force => TRUE); EXCEPTION WHEN OTHERS THEN NULL; END;
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_RESET_MAT_SERIAL_DAILY',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN EXECUTE IMMEDIATE ''ALTER SEQUENCE SEQ_MAT_SERIAL_DAILY RESTART START WITH 1''; END;',
    start_date      => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled         => TRUE,
    comments        => 'IQC005 Phase A — 자재 시리얼 일별 리셋'
  );

  BEGIN DBMS_SCHEDULER.DROP_JOB('JOB_RESET_ARRIVAL_NO_DAILY', force => TRUE); EXCEPTION WHEN OTHERS THEN NULL; END;
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_RESET_ARRIVAL_NO_DAILY',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN EXECUTE IMMEDIATE ''ALTER SEQUENCE SEQ_ARRIVAL_NO_DAILY RESTART START WITH 1''; END;',
    start_date      => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled         => TRUE,
    comments        => 'IQC005 Phase A — 입하실적코드 일별 리셋'
  );
END;
/
```

- [ ] **Step 2: JSHANES 적용 + 확인**

```sql
SELECT JOB_NAME, ENABLED, REPEAT_INTERVAL FROM USER_SCHEDULER_JOBS
WHERE JOB_NAME LIKE 'JOB_RESET_%_DAILY';
-- 예상: 2건, ENABLED=TRUE
```

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-26_iqc005_daily_reset_jobs.sql
git commit -m "feat(numbering): add daily reset jobs for serial sequences (T-011)"
```

---

## Task 5: 마이그레이션 — SEQ_RULES 룰 정정 (MAT_UID, ARRIVAL)

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_seq_rules.sql`

- [ ] **Step 1: 현재 SEQ_RULES 확인 (oracle-db로 select)**

```sql
SELECT DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, SEPARATOR, USE_YN
FROM SEQ_RULES
WHERE DOC_TYPE IN ('MAT_UID', 'ARRIVAL');
```
결과를 JOURNAL에 백업.

- [ ] **Step 2: 마이그레이션 SQL 작성**

```sql
-- 2026-05-26: IQC005 Phase A — SEQ_RULES 정정 (PDF 채번규칙 반영)

MERGE INTO SEQ_RULES r
USING (SELECT 'MAT_UID' AS DOC_TYPE FROM DUAL) s
ON (r.DOC_TYPE = s.DOC_TYPE)
WHEN MATCHED THEN UPDATE SET
  PREFIX = 'VH1-RM',
  SEQ_NAME = 'SEQ_MAT_SERIAL_DAILY',
  PAD_LENGTH = 5,
  DATE_FORMAT = 'YYMMDD',
  SEPARATOR = '-',
  USE_YN = 'Y',
  DESCRIPTION = '자재 시리얼 (PDF 채번규칙 2026-05-19)'
WHEN NOT MATCHED THEN INSERT
  (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, SEPARATOR, USE_YN, DESCRIPTION, COMPANY, PLANT_CD)
VALUES
  ('MAT_UID', 'VH1-RM', 'SEQ_MAT_SERIAL_DAILY', 5, 'YYMMDD', '-', 'Y',
   '자재 시리얼 (PDF 채번규칙 2026-05-19)', '40', '1000');

MERGE INTO SEQ_RULES r
USING (SELECT 'ARRIVAL' AS DOC_TYPE FROM DUAL) s
ON (r.DOC_TYPE = s.DOC_TYPE)
WHEN MATCHED THEN UPDATE SET
  PREFIX = 'R',
  SEQ_NAME = 'SEQ_ARRIVAL_NO_DAILY',
  PAD_LENGTH = 5,
  DATE_FORMAT = 'YYMMDD',
  SEPARATOR = '',
  USE_YN = 'Y',
  DESCRIPTION = '입하실적코드 (PDF 채번규칙 2026-05-19)'
WHEN NOT MATCHED THEN INSERT
  (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, SEPARATOR, USE_YN, DESCRIPTION, COMPANY, PLANT_CD)
VALUES
  ('ARRIVAL', 'R', 'SEQ_ARRIVAL_NO_DAILY', 5, 'YYMMDD', '', 'Y',
   '입하실적코드 (PDF 채번규칙 2026-05-19)', '40', '1000');

COMMIT;
```

- [ ] **Step 3: JSHANES 적용 + 채번 동작 확인**

```sql
-- 적용 후 룰 재확인
SELECT * FROM SEQ_RULES WHERE DOC_TYPE IN ('MAT_UID', 'ARRIVAL');

-- 실제 채번 호출 (Date 2026-05-26 가정)
SELECT PKG_SEQ_GENERATOR.GET_NO('MAT_UID') FROM DUAL;
-- 예상: 'VH1-RM260526-00001' 형식

SELECT PKG_SEQ_GENERATOR.GET_NO('ARRIVAL') FROM DUAL;
-- 예상: 'R26052600001' 형식
```

> 호출 결과가 예상 형식과 다르면 Task 1로 돌아가 PKG_SEQ_GENERATOR 본문 재확인. 패키지가 SEPARATOR/DATE_FORMAT을 어떻게 조합하는지에 따라 룰 컬럼 의미가 다를 수 있음.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-26_iqc005_seq_rules.sql
git commit -m "feat(numbering): align MAT_UID/ARRIVAL seq rules with PDF spec (T-011)"
```

---

## Task 6: 시드 마이그레이션 — 제조사 거래처 + LOT_UNIT_QTY 보강

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_seed_mfg_partners.sql`

- [ ] **Step 1: 현재 ITEM_MASTERS RM의 LOT_UNIT_QTY 상태 확인**

```sql
SELECT COUNT(*) AS TOTAL,
       SUM(CASE WHEN LOT_UNIT_QTY IS NULL THEN 1 ELSE 0 END) AS NULL_CNT
FROM ITEM_MASTERS
WHERE COMPANY = '40' AND ITEM_TYPE = 'RM';
```

- [ ] **Step 2: SQL 작성**

```sql
-- 2026-05-26: IQC005 Phase A — 제조사 거래처 시드 + RM LOT_UNIT_QTY 보강

-- 제조사 5건 (PARTNER_TYPE='MFG')
MERGE INTO PARTNER_MASTERS p
USING (
  SELECT 'M001' AS PARTNER_CODE, '한성정밀' AS PARTNER_NAME FROM DUAL UNION ALL
  SELECT 'M002', '비나마이크로' FROM DUAL UNION ALL
  SELECT 'M003', 'ABC Industries' FROM DUAL UNION ALL
  SELECT 'M004', '대성하이텍' FROM DUAL UNION ALL
  SELECT 'M005', 'KH Vietnam' FROM DUAL
) s ON (p.PARTNER_CODE = s.PARTNER_CODE)
WHEN MATCHED THEN UPDATE SET PARTNER_NAME = s.PARTNER_NAME, PARTNER_TYPE = 'MFG', USE_YN = 'Y'
WHEN NOT MATCHED THEN INSERT
  (PARTNER_CODE, PARTNER_NAME, PARTNER_TYPE, USE_YN, COMPANY, PLANT_CD, CREATED_BY)
VALUES
  (s.PARTNER_CODE, s.PARTNER_NAME, 'MFG', 'Y', '40', '1000', 'SYSTEM');

-- RM ITEM_MASTERS LOT_UNIT_QTY 보강 (NULL인 행에만 기본 50 적용)
UPDATE ITEM_MASTERS
SET LOT_UNIT_QTY = 50
WHERE COMPANY = '40'
  AND ITEM_TYPE = 'RM'
  AND LOT_UNIT_QTY IS NULL;

COMMIT;
```

- [ ] **Step 3: JSHANES 적용 + 확인**

```sql
SELECT COUNT(*) FROM PARTNER_MASTERS WHERE PARTNER_TYPE = 'MFG';
-- 예상: >= 5

SELECT COUNT(*) FROM ITEM_MASTERS
WHERE COMPANY = '40' AND ITEM_TYPE = 'RM' AND LOT_UNIT_QTY IS NULL;
-- 예상: 0
```

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-26_iqc005_seed_mfg_partners.sql
git commit -m "chore(seed): MFG partners and LOT_UNIT_QTY backfill for RM (T-011)"
```

---

## Task 6.5: 마이그레이션 — PURCHASE_ORDER 라인 메타 컬럼 신설 (LINE_NO/REV_NO/LINE_STATUS/USE_TYPE)

> 사용자 결정 B: 목업 L/N, R/N, 사용구분, 라인 상태를 위해 PO 스키마 확장.

**Files:**
- Create: `apps/backend/src/migrations/2026-05-26_iqc005_po_line_meta.sql`
- Modify: `apps/backend/src/entities/purchase-order-item.entity.ts`
- Modify: `apps/backend/src/entities/purchase-order.entity.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 2026-05-26: IQC005 Phase A — PO 라인 메타 컬럼 신설 (L/N, R/N, 라인 상태, 사용구분)

-- 1) PURCHASE_ORDER_ITEMS에 LINE_NO, REV_NO, LINE_STATUS
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE PURCHASE_ORDER_ITEMS ADD (LINE_NO NUMBER)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -1430 THEN NULL; ELSE RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE PURCHASE_ORDER_ITEMS ADD (REV_NO NUMBER DEFAULT 1)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -1430 THEN NULL; ELSE RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE q'[ALTER TABLE PURCHASE_ORDER_ITEMS ADD (LINE_STATUS VARCHAR2(20) DEFAULT 'OPEN')]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -1430 THEN NULL; ELSE RAISE; END IF; END;
/

-- 2) PURCHASE_ORDERS에 USE_TYPE
BEGIN
  EXECUTE IMMEDIATE q'[ALTER TABLE PURCHASE_ORDERS ADD (USE_TYPE VARCHAR2(20) DEFAULT 'PROD')]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -1430 THEN NULL; ELSE RAISE; END IF; END;
/

-- 3) 백필 — LINE_NO=SEQ, REV_NO=1, LINE_STATUS=계산
UPDATE PURCHASE_ORDER_ITEMS SET LINE_NO = SEQ WHERE LINE_NO IS NULL;
UPDATE PURCHASE_ORDER_ITEMS SET REV_NO = 1 WHERE REV_NO IS NULL;
UPDATE PURCHASE_ORDER_ITEMS
SET LINE_STATUS = CASE
  WHEN RECEIVED_QTY >= ORDER_QTY THEN 'CLOSE'
  WHEN RECEIVED_QTY > 0 THEN 'PARTIAL'
  ELSE 'OPEN'
END
WHERE LINE_STATUS IS NULL OR LINE_STATUS = 'OPEN';

UPDATE PURCHASE_ORDERS SET USE_TYPE = 'PROD' WHERE USE_TYPE IS NULL;

COMMIT;

COMMENT ON COLUMN PURCHASE_ORDER_ITEMS.LINE_NO IS '발주 라인 번호 (목업 L/N)';
COMMENT ON COLUMN PURCHASE_ORDER_ITEMS.REV_NO IS '발주 라인 리비전 번호 (목업 R/N, 기본 1)';
COMMENT ON COLUMN PURCHASE_ORDER_ITEMS.LINE_STATUS IS '라인 상태: OPEN | PARTIAL | CLOSE';
COMMENT ON COLUMN PURCHASE_ORDERS.USE_TYPE IS '사용 구분: PROD(양산) | DEV(개발) | SAMPLE 등';
```

- [ ] **Step 2: JSHANES 적용 + 확인**

```sql
SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
WHERE TABLE_NAME='PURCHASE_ORDER_ITEMS' AND COLUMN_NAME IN ('LINE_NO','REV_NO','LINE_STATUS');
-- 예상: 3건

SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
WHERE TABLE_NAME='PURCHASE_ORDERS' AND COLUMN_NAME='USE_TYPE';
-- 예상: 1건

SELECT COUNT(*) AS NULL_LINE_NO FROM PURCHASE_ORDER_ITEMS WHERE LINE_NO IS NULL;
-- 예상: 0
```

- [ ] **Step 3: 엔티티 컬럼 추가**

`purchase-order-item.entity.ts`에 추가:
```ts
  @Column({ name: 'LINE_NO', type: 'int', nullable: true })
  lineNo: number | null;

  @Column({ name: 'REV_NO', type: 'int', default: 1 })
  revNo: number;

  @Column({ name: 'LINE_STATUS', length: 20, default: 'OPEN' })
  lineStatus: string;
```

`purchase-order.entity.ts`에 추가:
```ts
  @Column({ name: 'USE_TYPE', length: 20, default: 'PROD' })
  useType: string;
```

- [ ] **Step 4: 백엔드 빌드 + 커밋**

```bash
pnpm --filter @hanes/backend build
git add apps/backend/src/migrations/2026-05-26_iqc005_po_line_meta.sql \
        apps/backend/src/entities/purchase-order-item.entity.ts \
        apps/backend/src/entities/purchase-order.entity.ts
git commit -m "feat(po): add LINE_NO/REV_NO/LINE_STATUS/USE_TYPE columns for IQC005 (T-011)"
```

---

## Task 7: 백엔드 DTO — `PoLineReceiptDto`

**Files:**
- Modify: `apps/backend/src/modules/material/dto/arrival.dto.ts`

- [ ] **Step 1: 기존 DTO 파일 확인**

```bash
cat apps/backend/src/modules/material/dto/arrival.dto.ts | head -40
```
Existing class들과 import 스타일 파악.

- [ ] **Step 2: DTO 추가**

`arrival.dto.ts` 파일 끝에 추가:
```ts
/**
 * IQC005 Phase A — PO 1라인 입하 등록 DTO
 *
 * 초보자 가이드:
 * - poItemId: PO_ITEMS의 자연키
 * - receivedQty: 입하 수량 (PO 잔량 이하)
 * - mfgPartnerCode: 제조사 거래처코드 (PARTNER_MASTERS PARTNER_TYPE='MFG', 필수)
 * - receivedDate: 입하일 (오늘 이하)
 */
export class PoLineReceiptDto {
  @IsString()
  @IsNotEmpty()
  poNo!: string;

  @IsInt()
  @Min(1)
  poSeq!: number;

  @IsInt()
  @Min(1)
  receivedQty!: number;

  @IsString()
  @IsNotEmpty()
  mfgPartnerCode!: string;

  @IsDateString()
  receivedDate!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsString()
  @IsNotEmpty()
  warehouseCode!: string;
}
```

필요 import 추가:
```ts
import { IsString, IsNotEmpty, IsInt, Min, IsDateString, IsOptional } from 'class-validator';
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @hanes/backend build
```
Expected: 0 error.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/material/dto/arrival.dto.ts
git commit -m "feat(material): add PoLineReceiptDto for IQC005 (T-011)"
```

---

## Task 8: 백엔드 서비스 — `arrival.service.receivePoLine`

**Files:**
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
- Create: `apps/backend/src/modules/material/services/arrival.service.po-line.spec.ts`

- [ ] **Step 1: 실패하는 spec 작성**

`apps/backend/src/modules/material/services/arrival.service.po-line.spec.ts`:
```ts
/**
 * @file arrival.service.po-line.spec.ts
 * @description PoLineReceipt: PO 1라인 단위 입하 등록 (IQC005 Phase A)
 *
 * 시나리오:
 * 1. receivedQty 200, LOT_UNIT_QTY 50 → MAT_LOT 4건 생성 (각 50)
 * 2. receivedQty 220, LOT_UNIT_QTY 50 → MAT_LOT 5건 (50,50,50,50,20)
 * 3. LOT_UNIT_QTY NULL → 단일 MAT_LOT 1건 (receivedQty 그대로)
 * 4. receivedQty > 잔량 → BadRequest
 * 5. mfgPartnerCode가 PARTNER_TYPE='MFG' 아님 → BadRequest
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ArrivalService } from './arrival.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { DataSource } from 'typeorm';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { BadRequestException } from '@nestjs/common';

describe('ArrivalService.receivePoLine (IQC005 Phase A)', () => {
  let service: ArrivalService;
  let mockManager: any;
  let mockNumbering: any;
  let mockTx: any;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((cls, data) => ({ ...data })),
    };
    mockNumbering = {
      nextMatUid: jest.fn(),
      nextArrivalNo: jest.fn().mockResolvedValue('R26052600001'),
    };
    mockTx = {
      runInTransaction: jest.fn(async (fn) => fn(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArrivalService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: {} },
        { provide: getRepositoryToken(MatLot), useValue: {} },
        { provide: getRepositoryToken(MatStock), useValue: {} },
        { provide: getRepositoryToken(MatArrival), useValue: {} },
        { provide: getRepositoryToken(StockTransaction), useValue: {} },
        { provide: getRepositoryToken(PartMaster), useValue: {} },
        { provide: getRepositoryToken(Warehouse), useValue: {} },
        { provide: getRepositoryToken(VendorBarcodeMapping), useValue: {} },
        { provide: getRepositoryToken(IqcLog), useValue: {} },
        { provide: DataSource, useValue: { manager: mockManager } },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).compile();

    service = module.get<ArrivalService>(ArrivalService);
  });

  const setupBasicMocks = (overrides: Partial<{
    lotUnitQty: number | null;
    orderQty: number;
    receivedQty: number;
    mfgFound: boolean;
  }> = {}) => {
    const cfg = { lotUnitQty: 50, orderQty: 1000, receivedQty: 300, mfgFound: true, ...overrides };
    mockManager.findOne.mockImplementation((entity: any, opts: any) => {
      if (entity === PurchaseOrderItem) {
        return Promise.resolve({
          poNo: 'PO-26-001',
          seq: 1,
          itemCode: 'TMN-0001',
          orderQty: cfg.orderQty,
          receivedQty: cfg.receivedQty,
          lineNo: 1,
          revNo: 1,
          lineStatus: 'PARTIAL',
        });
      }
      if (entity === PurchaseOrder) {
        return Promise.resolve({
          poNo: 'PO-26-001',
          partnerId: 'V001',
          partnerName: '행성사김천',
          useType: 'PROD',
          status: 'CONFIRMED',
        });
      }
      if (entity === PartMaster) {
        return Promise.resolve({ itemCode: 'TMN-0001', lotUnitQty: cfg.lotUnitQty });
      }
      if (entity === PartnerMaster) {
        return Promise.resolve(cfg.mfgFound ? { partnerCode: 'M001', partnerType: 'MFG' } : null);
      }
      return Promise.resolve(null);
    });
  };

  it('case 1: receivedQty 200 / LOT_UNIT_QTY 50 → MAT_LOT 4건 (각 50)', async () => {
    setupBasicMocks({ lotUnitQty: 50, orderQty: 1000, receivedQty: 300 });
    mockNumbering.nextMatUid
      .mockResolvedValueOnce('VH1-RM260526-00001')
      .mockResolvedValueOnce('VH1-RM260526-00002')
      .mockResolvedValueOnce('VH1-RM260526-00003')
      .mockResolvedValueOnce('VH1-RM260526-00004');

    const result = await service.receivePoLine({
      poNo: 'PO-26-001', poSeq: 1, receivedQty: 200, mfgPartnerCode: 'M001',
      receivedDate: '2026-05-26', warehouseCode: 'W01',
    }, { username: 'tester', company: '40', plant: '1000' } as any);

    expect(result.arrivalNo).toBe('R26052600001');
    expect(result.serials).toHaveLength(4);
    expect(result.serials.every((s) => s.initQty === 50)).toBe(true);
  });

  it('case 2: receivedQty 220 / LOT_UNIT_QTY 50 → MAT_LOT 5건 (50,50,50,50,20)', async () => {
    setupBasicMocks({ lotUnitQty: 50, orderQty: 1000, receivedQty: 0 });
    mockNumbering.nextMatUid.mockImplementation(() => Promise.resolve(`VH1-RM260526-${String(Math.random()).slice(2, 7)}`));

    const result = await service.receivePoLine({
      poNo: 'PO-26-001', poSeq: 1, receivedQty: 220, mfgPartnerCode: 'M001',
      receivedDate: '2026-05-26', warehouseCode: 'W01',
    }, { username: 'tester', company: '40', plant: '1000' } as any);

    expect(result.serials).toHaveLength(5);
    expect(result.serials.map((s) => s.initQty)).toEqual([50, 50, 50, 50, 20]);
  });

  it('case 3: LOT_UNIT_QTY NULL → 단일 MAT_LOT 1건', async () => {
    setupBasicMocks({ lotUnitQty: null, orderQty: 1000, receivedQty: 0 });
    mockNumbering.nextMatUid.mockResolvedValueOnce('VH1-RM260526-00010');

    const result = await service.receivePoLine({
      poNo: 'PO-26-001', poSeq: 1, receivedQty: 200, mfgPartnerCode: 'M001',
      receivedDate: '2026-05-26', warehouseCode: 'W01',
    }, { username: 'tester', company: '40', plant: '1000' } as any);

    expect(result.serials).toHaveLength(1);
    expect(result.serials[0].initQty).toBe(200);
  });

  it('case 4: receivedQty가 잔량 초과 → BadRequest', async () => {
    setupBasicMocks({ lotUnitQty: 50, orderQty: 100, receivedQty: 50 });
    await expect(service.receivePoLine({
      poNo: 'PO-26-001', poSeq: 1, receivedQty: 200, mfgPartnerCode: 'M001',
      receivedDate: '2026-05-26', warehouseCode: 'W01',
    }, { username: 'tester', company: '40', plant: '1000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('case 5: mfgPartnerCode가 MFG 타입 아님 → BadRequest', async () => {
    setupBasicMocks({ mfgFound: false });
    await expect(service.receivePoLine({
      poNo: 'PO-26-001', poSeq: 1, receivedQty: 100, mfgPartnerCode: 'X999', // not MFG
      receivedDate: '2026-05-26', warehouseCode: 'W01',
    }, { username: 'tester', company: '40', plant: '1000' } as any)).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: spec 실행 → 실패 확인**

```bash
pnpm --filter @hanes/backend test -- arrival.service.po-line
```
Expected: 5 tests FAIL with "receivePoLine is not a function" or similar.

- [ ] **Step 3: `arrival.service.ts`에 메서드 + repository 의존성 추가**

`arrival.service.ts`의 imports에 추가:
```ts
import { PartnerMaster } from '../../../entities/partner-master.entity';
```

생성자에 PartnerMaster repository 추가 (의존성 등록을 위해 모듈에서도 InjectRepository 처리 필요 — Task 9 module에서 같이 처리):
```ts
@InjectRepository(PartnerMaster)
private readonly partnerMasterRepository: Repository<PartnerMaster>,
```

클래스에 메서드 추가:
```ts
  /**
   * IQC005 Phase A — PO 1라인 입하 등록 (시리얼 N건 발급)
   *
   * 흐름:
   * 1. PO 라인 조회 + 잔량 검증
   * 2. 제조사 검증 (PARTNER_TYPE='MFG')
   * 3. ITEM_MASTERS.LOT_UNIT_QTY로 시리얼 개수 산정 (자투리 포함)
   * 4. 채번: ARRIVAL_NO 1건, MAT_UID N건
   * 5. MAT_LOTS N건 insert (동일 ARRIVAL_NO, 시리얼별 INIT_QTY)
   * 6. PO 잔량 갱신, MAT_STOCK 갱신, STOCK_TRANSACTION N건 기록
   */
  async receivePoLine(
    dto: PoLineReceiptDto,
    user: { username: string; company?: string | null; plant?: string | null },
  ): Promise<{ arrivalNo: string; serials: MatLot[] }> {
    return this.tx.runInTransaction(async (manager) => {
      // 1. PO 라인 (복합 PK)
      const poItem = await manager.findOne(PurchaseOrderItem, {
        where: { poNo: dto.poNo, seq: dto.poSeq },
      });
      if (!poItem) throw new NotFoundException(`PO 라인 없음: ${dto.poNo}#${dto.poSeq}`);

      const po = await manager.findOne(PurchaseOrder, { where: { poNo: dto.poNo } });
      if (!po) throw new NotFoundException(`PO 헤더 없음: ${dto.poNo}`);

      const remaining = poItem.orderQty - poItem.receivedQty;
      if (dto.receivedQty > remaining) {
        throw new BadRequestException(
          `입하 수량(${dto.receivedQty})이 PO 잔량(${remaining}) 초과`,
        );
      }

      // 2. 제조사
      const mfg = await manager.findOne(PartnerMaster, {
        where: { partnerCode: dto.mfgPartnerCode, partnerType: 'MFG' },
      });
      if (!mfg) {
        throw new BadRequestException(`제조사 없음 또는 MFG 타입 아님: ${dto.mfgPartnerCode}`);
      }

      // 3. 시리얼 개수
      const item = await manager.findOne(PartMaster, { where: { itemCode: poItem.itemCode } });
      if (!item) throw new NotFoundException(`품목 없음: ${poItem.itemCode}`);
      const unit = item.lotUnitQty && item.lotUnitQty > 0 ? item.lotUnitQty : dto.receivedQty;
      const serialCount = Math.ceil(dto.receivedQty / unit);

      // 4. 채번
      const arrivalNo = await this.numbering.nextArrivalNo();
      const serialNos: string[] = [];
      for (let i = 0; i < serialCount; i++) {
        serialNos.push(await this.numbering.nextMatUid());
      }

      // 5. MAT_LOTS 생성
      const recvDate = new Date(dto.receivedDate);
      const lots: MatLot[] = [];
      let qtyLeft = dto.receivedQty;
      for (let i = 0; i < serialCount; i++) {
        const qty = Math.min(unit, qtyLeft);
        qtyLeft -= qty;
        const lot = manager.create(MatLot, {
          matUid: serialNos[i],
          itemCode: poItem.itemCode,
          initQty: qty,
          recvDate,
          manufactureDate: null,
          expireDate: null,
          arrivalNo,
          arrivalSeq: i + 1,
          origin: serialNos[i], // root_serial 자기 자신 (Phase D 분할에서 활용)
          vendor: po.partnerId ?? '',
          invoiceNo: '',
          poNo: po.poNo,
          mfgPartnerCode: dto.mfgPartnerCode,
          iqcStatus: 'PENDING',
          status: 'NORMAL',
          company: user.company ?? null,
          plant: user.plant ?? null,
          createdBy: user.username,
        });
        lots.push(lot);
      }
      const savedLots = await manager.save(MatLot, lots);

      // 6. PO 라인 잔량 + 상태 갱신
      poItem.receivedQty += dto.receivedQty;
      if (poItem.receivedQty >= poItem.orderQty) poItem.lineStatus = 'CLOSE';
      else poItem.lineStatus = 'PARTIAL';
      await manager.save(PurchaseOrderItem, poItem);

      // 7. MAT_STOCK upsert + STOCK_TRANSACTION 기록은 기존 패턴 재사용
      //    (legacy 입하 메서드의 stock upsert / transaction insert helper를 호출)
      for (const lot of savedLots) {
        await this.recordStockArrival(manager, lot, dto.warehouseCode, user);
      }

      // 8. MAT_ARRIVALS 헤더 기록 (호환)
      let seq = 1;
      for (const lot of savedLots) {
        await manager.save(MatArrival, manager.create(MatArrival, {
          arrivalNo, seq: seq++,
          invoiceNo: '',
          poId: po.poNo,
          poItemId: `${po.poNo}#${poItem.seq}`,
          poNo: po.poNo,
          vendorId: po.partnerId ?? '',
          vendorName: '', // 채워주기 - vendor 조회 캐싱 필요시 추후
          itemCode: lot.itemCode,
          qty: lot.initQty,
          warehouseCode: dto.warehouseCode,
          arrivalDate: recvDate,
          arrivalType: 'PO',
          workerId: user.username,
          remark: dto.remark ?? null,
          iqcStatus: 'PENDING',
          supUid: lot.matUid,
          status: 'DONE',
          company: user.company ?? null,
          plant: user.plant ?? null,
          createdBy: user.username,
        }));
      }

      return { arrivalNo, serials: savedLots };
    });
  }

  /**
   * MAT_STOCK upsert + STOCK_TRANSACTION(MAT_IN) 1건 기록.
   * 기존 createPoArrival의 헬퍼 패턴 추출.
   */
  private async recordStockArrival(
    manager: EntityManager,
    lot: MatLot,
    warehouseCode: string,
    user: { username: string; company?: string | null; plant?: string | null },
  ): Promise<void> {
    // upsert MAT_STOCK
    let stock = await manager.findOne(MatStock, {
      where: { matUid: lot.matUid },
    });
    if (!stock) {
      stock = manager.create(MatStock, {
        matUid: lot.matUid,
        itemCode: lot.itemCode,
        warehouseCode,
        qty: lot.initQty,
        company: user.company ?? null,
        plant: user.plant ?? null,
        createdBy: user.username,
      });
    } else {
      stock.qty = (stock.qty ?? 0) + lot.initQty;
      stock.updatedBy = user.username;
    }
    await manager.save(MatStock, stock);

    // STOCK_TRANSACTION (MAT_IN) — 1 시리얼당 1건
    const transNo = await this.numbering.next('STOCK_TX');
    await manager.save(StockTransaction, manager.create(StockTransaction, {
      transNo,
      transType: 'MAT_IN',
      transDate: new Date(),
      matUid: lot.matUid,
      itemCode: lot.itemCode,
      qty: lot.initQty,
      toWarehouseCode: warehouseCode,
      refType: 'ARRIVAL',
      refId: lot.arrivalNo,
      status: 'DONE',
      company: user.company ?? null,
      plant: user.plant ?? null,
      createdBy: user.username,
    }));
  }
```

`PoLineReceiptDto` import 추가:
```ts
import { ..., PoLineReceiptDto } from '../dto/arrival.dto';
```

- [ ] **Step 4: ArrivalModule에 PartnerMaster repository 등록**

`apps/backend/src/modules/material/material.module.ts` (또는 arrival module) 에서 `TypeOrmModule.forFeature([... , PartnerMaster])` 배열에 `PartnerMaster` 추가.

- [ ] **Step 5: spec 실행 → 통과 확인**

```bash
pnpm --filter @hanes/backend test -- arrival.service.po-line
```
Expected: 5 tests PASS.

> 통과 안 하면: 1) StockTransaction 엔티티의 컬럼명 (transType vs trans_type 등) 확인. 2) mock manager.save가 배열을 받는 케이스 처리 확인 (실제 TypeORM은 단건/배열 모두 허용).

- [ ] **Step 6: 빌드 + 전체 테스트 회귀**

```bash
pnpm --filter @hanes/backend build
pnpm --filter @hanes/backend test
```
Expected: build 0 error, 전체 test 0 fail.

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/material/services/arrival.service.ts \
        apps/backend/src/modules/material/services/arrival.service.po-line.spec.ts \
        apps/backend/src/modules/material/material.module.ts
git commit -m "feat(material): add receivePoLine for IQC005 serial issuance (T-011)"
```

---

## Task 9: 백엔드 컨트롤러 — `/material/arrivals/po-lines` (GET) + `/po-line` (POST)

**Files:**
- Modify: `apps/backend/src/modules/material/controllers/arrival.controller.ts`
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts` (`listPoLines` 메서드 추가)

- [ ] **Step 1: 서비스에 `listPoLines` 추가**

`arrival.service.ts`에 메서드:
```ts
  /**
   * IQC005 메인 그리드용 PO 라인 목록.
   * status, itemCode, poNo로 필터링.
   */
  async listPoLines(query: {
    status?: 'OPEN' | 'CLOSE' | 'PARTIAL';
    itemCode?: string;
    poNo?: string;
    company?: string | null;
    plant?: string | null;
  }): Promise<Array<{
    poNo: string;
    poSeq: number;
    lineNo: number;
    revNo: number;
    itemCode: string;
    itemName: string;
    orderQty: number;
    receivedQty: number;
    remainingQty: number;
    orderDate: string | null;
    partnerName: string;
    useType: string;
    lineStatus: 'OPEN' | 'PARTIAL' | 'CLOSE';
  }>> {
    const qb = this.purchaseOrderItemRepository
      .createQueryBuilder('pi')
      .innerJoin(PurchaseOrder, 'po', 'po.poNo = pi.poNo')
      .leftJoin(PartMaster, 'item', 'item.itemCode = pi.itemCode')
      .select([
        'pi.poNo AS "poNo"',
        'pi.seq AS "poSeq"',
        'NVL(pi.lineNo, pi.seq) AS "lineNo"',
        'NVL(pi.revNo, 1) AS "revNo"',
        'pi.itemCode AS "itemCode"',
        'item.itemName AS "itemName"',
        'pi.orderQty AS "orderQty"',
        'pi.receivedQty AS "receivedQty"',
        '(pi.orderQty - pi.receivedQty) AS "remainingQty"',
        'po.orderDate AS "orderDate"',
        'po.partnerName AS "partnerName"',
        "NVL(po.useType, 'PROD') AS \"useType\"",
        "NVL(pi.lineStatus, 'OPEN') AS \"lineStatus\"",
      ]);

    if (query.status) {
      qb.where('NVL(pi.lineStatus, \'OPEN\') = :st', { st: query.status });
    }
    if (query.itemCode) qb.andWhere('pi.itemCode = :ic', { ic: query.itemCode });
    if (query.poNo) qb.andWhere('pi.poNo LIKE :pno', { pno: `%${query.poNo}%` });
    if (query.company) qb.andWhere('pi.company = :co', { co: query.company });
    if (query.plant) qb.andWhere('pi.plant = :pl', { pl: query.plant });

    qb.orderBy('po.orderDate', 'DESC').addOrderBy('NVL(pi.lineNo, pi.seq)', 'ASC');

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      poNo: r.poNo,
      poSeq: Number(r.poSeq),
      lineNo: Number(r.lineNo),
      revNo: Number(r.revNo),
      itemCode: r.itemCode,
      itemName: r.itemName ?? '',
      orderQty: Number(r.orderQty),
      receivedQty: Number(r.receivedQty),
      remainingQty: Number(r.remainingQty),
      orderDate: r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : null,
      partnerName: r.partnerName ?? '',
      useType: r.useType ?? 'PROD',
      lineStatus: (r.lineStatus === 'CLOSE' ? 'CLOSE' : r.lineStatus === 'PARTIAL' ? 'PARTIAL' : 'OPEN'),
    }));
  }
```

> Task 6.5에서 LINE_NO/REV_NO/LINE_STATUS/USE_TYPE 컬럼이 추가된 후 본 task 진행. PurchaseOrderItem entity에 po 관계가 없어서 `innerJoin(PurchaseOrder, 'po', 'po.poNo = pi.poNo')` 명시적 join 사용.

- [ ] **Step 2: 컨트롤러 엔드포인트 2개 추가**

`arrival.controller.ts`에:
```ts
  @Get('po-lines')
  async listPoLines(
    @Query('status') status?: 'OPEN' | 'PARTIAL' | 'CLOSE',
    @Query('itemCode') itemCode?: string,
    @Query('poNo') poNo?: string,
    @Req() req?: any,
  ) {
    const user = req?.user ?? {};
    return {
      data: await this.arrivalService.listPoLines({
        status, itemCode, poNo,
        company: user.company, plant: user.plant,
      }),
    };
  }

  @Post('po-line')
  async receivePoLine(@Body() dto: PoLineReceiptDto, @Req() req?: any) {
    const user = req?.user ?? { username: 'SYSTEM' };
    return { data: await this.arrivalService.receivePoLine(dto, user) };
  }
```

import 추가:
```ts
import { Get, Post, Body, Query, Req } from '@nestjs/common';
import { PoLineReceiptDto } from '../dto/arrival.dto';
```

- [ ] **Step 3: 빌드 + 수동 호출 확인**

```bash
pnpm --filter @hanes/backend build
pnpm --filter @hanes/backend dev    # 서버 띄움 (사용자가 이미 띄웠으면 skip)
```

별도 터미널:
```bash
curl http://localhost:3001/material/arrivals/po-lines?status=OPEN
# 예상: { "data": [ {poItemId, poNo, ...}, ... ] }
```

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/material/controllers/arrival.controller.ts \
        apps/backend/src/modules/material/services/arrival.service.ts
git commit -m "feat(material): add GET po-lines, POST po-line endpoints (T-011)"
```

---

## Task 10: 프론트 DataGrid — `meta.rowClassName` 옵션 확장

> 4단계 행 배경을 위해 DataGrid가 row 단위 className 콜백을 받도록 확장. 이미 지원하면 본 Task 스킵.

**Files:**
- Read: `apps/frontend/src/components/data-grid/DataGrid.tsx`
- (조건부) Modify: 위 파일

- [ ] **Step 1: 현재 DataGrid가 row className 콜백을 받는지 확인**

```bash
grep -n "rowClassName\|getRowProps\|trClassName\|rowClass" apps/frontend/src/components/data-grid/DataGrid.tsx | head
```

- [ ] **Step 2: 미지원이면 prop 추가**

`DataGrid.tsx`의 Props에:
```ts
rowClassName?: (row: TData) => string | undefined;
```

`<tr>` 렌더 시 적용:
```tsx
<tr
  key={row.id}
  className={[baseTrClass, props.rowClassName?.(row.original) ?? ''].filter(Boolean).join(' ')}
  onClick={...}
>
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/components/data-grid/DataGrid.tsx
git commit -m "feat(data-grid): add rowClassName prop for conditional row styling"
```

---

## Task 11: 프론트 공통 — `MfgPartnerSelect` 컴포넌트

**Files:**
- Create: `apps/frontend/src/components/shared/MfgPartnerSelect.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

/**
 * @file components/shared/MfgPartnerSelect.tsx
 * @description 제조사(PARTNER_TYPE='MFG') 선택 드롭다운
 *
 * 초보자 가이드:
 * - GET /master/partners?type=MFG&useYn=Y 결과를 캐싱하여 옵션으로 표시
 * - 필수 입력 강조 시 className에 'border-red-500' 추가 권장
 */

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui';
import api from '@/services/api';

interface MfgPartner {
  partnerCode: string;
  partnerName: string;
}

interface MfgPartnerSelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

let cachedOptions: MfgPartner[] | null = null;

export default function MfgPartnerSelect({
  value, onChange, placeholder = '제조사 선택', required, disabled, fullWidth,
}: MfgPartnerSelectProps) {
  const [options, setOptions] = useState<MfgPartner[]>(cachedOptions ?? []);
  const [loading, setLoading] = useState(!cachedOptions);

  useEffect(() => {
    if (cachedOptions) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get('/master/partners', { params: { type: 'MFG', useYn: 'Y' } });
        const data: MfgPartner[] = (res.data?.data ?? []).map((p: any) => ({
          partnerCode: p.partnerCode,
          partnerName: p.partnerName,
        }));
        if (active) {
          cachedOptions = data;
          setOptions(data);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={loading ? '로딩중...' : placeholder}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      options={options.map((p) => ({
        value: p.partnerCode,
        label: `${p.partnerCode} · ${p.partnerName}`,
      }))}
      className={required && !value ? 'border-red-500 focus:border-red-500' : ''}
    />
  );
}
```

> 가정: 기존 `@/components/ui` `Select`가 `options/value/onChange/placeholder/disabled/fullWidth/className` props를 받음. 다르면 시그니처 맞춰 조정.
> 가정: `GET /master/partners?type=MFG` 엔드포인트 존재. 없으면 Task 9 후 별도 task로 추가.

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/components/shared/MfgPartnerSelect.tsx
git commit -m "feat(shared): add MfgPartnerSelect for PARTNER_TYPE=MFG (T-011)"
```

---

## Task 12: 프론트 — `PoLineGrid` 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineGrid.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/material/arrival/components/types.ts`

- [ ] **Step 1: types.ts에 타입 추가**

```ts
/** IQC005 메인 그리드 행 */
export interface PoLineRow {
  poNo: string;
  poSeq: number;
  lineNo: number;
  revNo: number;
  itemCode: string;
  itemName: string;
  orderQty: number;
  receivedQty: number;
  remainingQty: number;
  orderDate: string | null;
  partnerName: string;
  useType: string;
  lineStatus: 'OPEN' | 'PARTIAL' | 'CLOSE';
}

/** PO 라인 입하 등록 입력 */
export interface PoLineReceiptInput {
  poNo: string;
  poSeq: number;
  receivedQty: number;
  mfgPartnerCode: string;
  receivedDate: string;
  remark?: string;
  warehouseCode: string;
}

/** PO 라인 입하 등록 응답 */
export interface PoLineReceiptResponse {
  arrivalNo: string;
  serials: Array<{
    matUid: string;
    initQty: number;
    arrivalSeq: number;
    itemCode: string;
  }>;
}
```

- [ ] **Step 2: PoLineGrid.tsx 작성**

```tsx
"use client";

/**
 * @file PoLineGrid.tsx
 * @description IQC005 PO 라인 단위 메인 그리드
 *
 * 초보자 가이드:
 * 1. 행 클릭 또는 [자재입하] 버튼 → onSelectLine 콜백
 * 2. 4단계 행 배경: 미입하(흰) / 일부입하(yellow-50) / 잔량0(blue-50) / CLOSE(gray-100)
 * 3. 잔량 = text-blue-700 font-bold (RoyalBlue 근사)
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import ComCodeBadge from '@/components/shared/ComCodeBadge';
import type { PoLineRow } from './types';

interface PoLineGridProps {
  data: PoLineRow[];
  isLoading?: boolean;
  toolbarLeft?: ReactNode;
  onSelectLine: (row: PoLineRow) => void;
}

const rowClass = (row: PoLineRow) => {
  if (row.lineStatus === 'CLOSE') return 'bg-gray-100 text-gray-500';
  if (row.remainingQty === 0) return 'bg-blue-50/60';
  if (row.receivedQty > 0) return 'bg-yellow-50/60';
  return '';
};

export default function PoLineGrid({ data, isLoading, toolbarLeft, onSelectLine }: PoLineGridProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<PoLineRow>[]>(() => [
    {
      id: 'action',
      header: '',
      size: 110,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const r = row.original;
        const disabled = r.lineStatus === 'CLOSE' || r.remainingQty === 0;
        return (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onSelectLine(r); }}
            className={`px-3 py-1 rounded text-xs font-semibold text-white ${
              disabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700'
            }`}
          >
            {t('material.arrival.action.receive')}
          </button>
        );
      },
    },
    { accessorKey: 'poNo', header: t('material.arrival.col.poNo'), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span> },
    { accessorKey: 'lineNo', header: 'L/N', size: 50, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-center">{getValue() as number}</div> },
    { accessorKey: 'revNo', header: 'R/N', size: 50, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-center">R{getValue() as number}</div> },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 110, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span> },
    { accessorKey: 'itemName', header: t('common.partName'), meta: { filterType: "text" as const } },
    { accessorKey: 'orderQty', header: t('material.arrival.col.orderQty'), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-right">{(getValue() as number).toLocaleString()}</div> },
    { accessorKey: 'receivedQty', header: t('material.arrival.col.accReceived'), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-right">{(getValue() as number).toLocaleString()}</div> },
    {
      accessorKey: 'remainingQty',
      header: t('material.arrival.col.remainingQty'),
      size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <div className="text-right text-blue-700 font-bold">{(getValue() as number).toLocaleString()}</div>,
    },
    { accessorKey: 'orderDate', header: t('material.arrival.col.orderDate'), size: 110, meta: { filterType: "date" as const }, cell: ({ getValue }) => <div className="text-center">{(getValue() as string) ?? '-'}</div> },
    { accessorKey: 'partnerName', header: t('material.arrival.col.vendor'), size: 130, meta: { filterType: "text" as const } },
    {
      accessorKey: 'useType',
      header: t('material.arrival.col.useType'),
      size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PO_USE_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: 'lineStatus',
      header: t('common.status'),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PO_LINE_STATUS" code={getValue() as string} />,
    },
  ], [t, onSelectLine]);

  return (
    <DataGrid
      data={data}
      columns={columns}
      isLoading={isLoading}
      enableColumnFilter
      enableExport
      exportFileName="iqc005_po_lines"
      toolbarLeft={toolbarLeft}
      rowClassName={rowClass}
      onRowClick={(row) => {
        if (row.lineStatus !== 'CLOSE' && row.remainingQty > 0) onSelectLine(row);
      }}
    />
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/material/arrival/components/PoLineGrid.tsx \
        apps/frontend/src/app/\(authenticated\)/material/arrival/components/types.ts
git commit -m "feat(material): add PoLineGrid for IQC005 main grid (T-011)"
```

---

## Task 13: 프론트 — `PoLineReceiptModal` 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineReceiptModal.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

/**
 * @file PoLineReceiptModal.tsx
 * @description IQC005 PO 1라인 입하 등록 모달
 *
 * 초보자 가이드:
 * 1. 단일 라인 폼: 입하수량, 입하일, 제조사(필수), 시리얼수량단위(read-only), 예상시리얼수, 비고
 * 2. 저장 → onConfirm 호출 (부모에서 SerialIssueConfirmModal 띄움)
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '@/components/ui';
import MfgPartnerSelect from '@/components/shared/MfgPartnerSelect';
import { useWarehouseOptions } from '@/hooks/useMasterOptions';
import api from '@/services/api';
import type { PoLineRow, PoLineReceiptInput } from './types';

interface PoLineReceiptModalProps {
  isOpen: boolean;
  line: PoLineRow | null;
  onClose: () => void;
  onConfirm: (input: PoLineReceiptInput, expectedCount: number) => void;
}

export default function PoLineReceiptModal({ isOpen, line, onClose, onConfirm }: PoLineReceiptModalProps) {
  const { t } = useTranslation();
  const { options: warehouses } = useWarehouseOptions();

  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [mfgPartnerCode, setMfgPartnerCode] = useState('');
  const [receivedDate, setReceivedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [lotUnitQty, setLotUnitQty] = useState<number | null>(null);

  // 모달 열릴 때 초기값
  useEffect(() => {
    if (isOpen && line) {
      setReceivedQty(line.remainingQty);
      setMfgPartnerCode('');
      setReceivedDate(new Date().toISOString().slice(0, 10));
      setRemark('');
      setWarehouseCode(warehouses[0]?.value ?? '');
      // 품목 마스터 LOT_UNIT_QTY 조회
      api.get(`/master/parts/code/${encodeURIComponent(line.itemCode)}`)
        .then((res) => setLotUnitQty(res.data?.data?.lotUnitQty ?? null))
        .catch(() => setLotUnitQty(null));
    }
  }, [isOpen, line, warehouses]);

  const expectedCount = useMemo(() => {
    if (!receivedQty) return 0;
    if (!lotUnitQty || lotUnitQty <= 0) return 1;
    return Math.ceil(receivedQty / lotUnitQty);
  }, [receivedQty, lotUnitQty]);

  const today = new Date().toISOString().slice(0, 10);
  const canSave = !!line
    && receivedQty > 0
    && receivedQty <= line.remainingQty
    && !!mfgPartnerCode
    && !!warehouseCode
    && receivedDate <= today;

  const handleSave = () => {
    if (!canSave || !line) return;
    onConfirm({
      poNo: line.poNo,
      poSeq: line.poSeq,
      receivedQty,
      mfgPartnerCode,
      receivedDate,
      remark: remark || undefined,
      warehouseCode,
    }, expectedCount);
  };

  if (!line) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.modal.receiveTitle')} size="lg">
      <div className="flex flex-col gap-4">
        {/* PO 정보 */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <div className="font-semibold text-slate-800">
            {line.poNo} / L{line.lineNo} / R{line.revNo}
          </div>
          <div>
            <span className="font-bold text-slate-800">[{line.itemCode}]</span> {line.itemName}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {t('material.arrival.col.vendor')}: <b>{line.partnerName}</b>
          </div>
        </div>

        {/* 입하/발주/잔량 */}
        <div className="bg-gray-50 border border-gray-200 rounded p-3 flex items-center justify-end gap-2 text-sm">
          <span className="font-bold text-teal-600 text-base">{line.receivedQty.toLocaleString()}</span>
          <span className="text-slate-500">/</span>
          <span>{line.orderQty.toLocaleString()}</span>
          <span className="ml-4 text-blue-700 font-bold">
            {t('material.arrival.col.remainingQty')} {line.remainingQty.toLocaleString()}
          </span>
        </div>

        {/* 폼 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.receivedQty')} *</span>
            <Input
              type="number" min={1} max={line.remainingQty}
              value={receivedQty}
              onChange={(e) => setReceivedQty(Math.min(Number(e.target.value) || 0, line.remainingQty))}
              className="text-right font-semibold"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.receivedDate')} *</span>
            <Input
              type="date"
              max={today}
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.mfgPartner')} *</span>
            <MfgPartnerSelect
              value={mfgPartnerCode}
              onChange={setMfgPartnerCode}
              required
              fullWidth
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.warehouse')} *</span>
            <Select
              options={warehouses}
              value={warehouseCode}
              onChange={setWarehouseCode}
              placeholder={t('material.arrival.selectWarehouse')}
              fullWidth
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.serialUnitQty')}</span>
            <Input
              type="text"
              value={lotUnitQty === null ? t('material.arrival.singleLot') : String(lotUnitQty)}
              disabled
              className="text-right bg-gray-50 text-slate-600"
            />
            <span className="text-xs text-slate-500">
              {t('material.arrival.serialUnitNote')}
            </span>
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.expectedSerialCount')}</span>
            <div className="h-10 border border-gray-200 rounded px-3 flex items-center justify-between bg-white">
              <span className="text-xs text-slate-500">
                {receivedQty.toLocaleString()} ÷ {lotUnitQty ?? '-'} →
              </span>
              <span className="font-bold text-pink-600 text-lg">{expectedCount}개</span>
            </div>
          </label>
        </div>

        <label className="text-sm flex flex-col gap-1">
          <span>{t('common.remark')}</span>
          <textarea
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder={t('common.remarkOptional')}
          />
        </label>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-slate-600">
          <b className="text-yellow-700">⚠ {t('common.confirm')}</b> · {t('material.arrival.confirm.notice')}
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
        <span className="text-xs text-slate-500">{t('common.requiredMark')}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
```

> 가정: `GET /master/parts/:itemCode` 엔드포인트 존재. 없으면 useMasterOptions 또는 별도 컴포넌트로 변경.

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/material/arrival/components/PoLineReceiptModal.tsx
git commit -m "feat(material): add PoLineReceiptModal for IQC005 single line receipt (T-011)"
```

---

## Task 14: 프론트 — `SerialIssueConfirmModal`

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/material/arrival/components/SerialIssueConfirmModal.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

/**
 * @file SerialIssueConfirmModal.tsx
 * @description "n건의 시리얼을 발급합니다" 최종 확인 모달
 */

import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';

interface Props {
  isOpen: boolean;
  expectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function SerialIssueConfirmModal({ isOpen, expectedCount, onConfirm, onCancel, submitting }: Props) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={t('material.arrival.confirm.serialIssueTitle')} size="md">
      <p className="text-sm text-slate-700">
        {t('material.arrival.confirm.serialIssueBody', { count: expectedCount })}
      </p>
      <p className="text-xs text-slate-500 mt-2">{t('material.arrival.confirm.serialIssueNote')}</p>
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} disabled={submitting}>
          {submitting ? t('common.processing') : t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 빌드 + 커밋**

```bash
pnpm --filter @hanes/frontend build
git add apps/frontend/src/app/\(authenticated\)/material/arrival/components/SerialIssueConfirmModal.tsx
git commit -m "feat(material): add SerialIssueConfirmModal (T-011)"
```

---

## Task 15: 프론트 — `MatLabelPreviewModal` (jsbarcode)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx`
- Modify: `apps/frontend/package.json` (jsbarcode 의존성 추가)

- [ ] **Step 1: 의존성 추가**

```bash
cd C:/Project/HANES/apps/frontend && pnpm add jsbarcode
cd C:/Project/HANES && pnpm install
```

- [ ] **Step 2: 컴포넌트 작성**

```tsx
"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 발급된 시리얼 라벨 미리보기 (자재라벨) + window.print
 *
 * 초보자 가이드:
 * 1. 시리얼당 라벨 1장. CODE128 바코드 사용
 * 2. @media print CSS로 모달 외 영역 숨김
 * 3. 닫기 시 onClose 호출 → 부모에서 그리드 새로고침
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode';
import { Modal, Button } from '@/components/ui';
import type { PoLineReceiptResponse } from './types';

interface Props {
  isOpen: boolean;
  data: PoLineReceiptResponse | null;
  itemName?: string;
  mfgPartnerLabel?: string;
  receivedDate?: string;
  onClose: () => void;
}

export default function MatLabelPreviewModal({
  isOpen, data, itemName = '', mfgPartnerLabel = '', receivedDate = '', onClose,
}: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !data) return;
    // 바코드 렌더
    data.serials.forEach((s) => {
      const el = document.getElementById(`bc-${s.matUid}`);
      if (el) {
        try {
          JsBarcode(el, s.matUid, { format: 'CODE128', width: 1.5, height: 40, displayValue: false });
        } catch { /* 무시 */ }
      }
    });
  }, [isOpen, data]);

  const handlePrint = () => {
    if (!printRef.current) return;
    window.print();
  };

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={handlePrint}>🖨 {t('material.arrival.label.print')}</Button>
      </div>
      <div ref={printRef} className="grid grid-cols-2 gap-3" id="label-print-area">
        {data.serials.map((s) => (
          <div key={s.matUid} className="border border-gray-300 p-3 rounded text-sm bg-white">
            <div className="font-mono font-bold text-base text-slate-900">{s.matUid}</div>
            <div className="mt-1">{s.itemCode} / {itemName}</div>
            <div className="text-xs text-slate-600">
              {t('material.arrival.col.receivedDate')}: {receivedDate} · {s.initQty} EA
            </div>
            <div className="text-xs text-slate-600">
              {t('material.arrival.col.mfgPartner')}: {mfgPartnerLabel}
            </div>
            <svg id={`bc-${s.matUid}`} className="mt-1 w-full" />
          </div>
        ))}
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #label-print-area, #label-print-area * { visibility: visible; }
          #label-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
      <div className="flex justify-end pt-4 border-t border-gray-200 mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml \
        apps/frontend/src/app/\(authenticated\)/material/arrival/components/MatLabelPreviewModal.tsx
git commit -m "feat(material): add MatLabelPreviewModal with jsbarcode (T-011)"
```

---

## Task 16: 프론트 — `arrival/page.tsx` 전면 재작성

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/arrival/page.tsx`
- Delete: `apps/frontend/src/app/(authenticated)/material/arrival/components/PoArrivalModal.tsx`

- [ ] **Step 1: page.tsx 새 본문 작성**

```tsx
"use client";

/**
 * @file material/arrival/page.tsx
 * @description IQC005 — 자재 입하관리 (PO 라인 단위 메인 그리드)
 *
 * 초보자 가이드:
 * 1. PO 라인 그리드: 메인 영역. 행 클릭 또는 [자재입하] 버튼 → PoLineReceiptModal
 * 2. 저장 흐름: PoLineReceiptModal → SerialIssueConfirmModal → POST → MatLabelPreviewModal
 * 3. 4단계 행 배경: 미입하/일부입하/잔량0/CLOSE
 * 4. ManualArrivalModal은 유지 (별도 워크플로)
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, RefreshCw, Plus, Search } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import api from '@/services/api';
import PoLineGrid from './components/PoLineGrid';
import PoLineReceiptModal from './components/PoLineReceiptModal';
import SerialIssueConfirmModal from './components/SerialIssueConfirmModal';
import MatLabelPreviewModal from './components/MatLabelPreviewModal';
import ManualArrivalModal from './components/ManualArrivalModal';
import type { PoLineRow, PoLineReceiptInput, PoLineReceiptResponse } from './components/types';

export default function ArrivalPage() {
  const { t } = useTranslation();

  // 데이터
  const [rows, setRows] = useState<PoLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [poNo, setPoNo] = useState('');

  // 흐름 상태
  const [selectedLine, setSelectedLine] = useState<PoLineRow | null>(null);
  const [pendingInput, setPendingInput] = useState<{ input: PoLineReceiptInput; expectedCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labelData, setLabelData] = useState<PoLineReceiptResponse | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/arrivals/po-lines', {
        params: {
          ...(statusFilter && { status: statusFilter }),
          ...(itemCode && { itemCode }),
          ...(poNo && { poNo }),
        },
      });
      setRows(res.data?.data ?? []);
    } catch { setRows([]); }
    setLoading(false);
  }, [statusFilter, itemCode, poNo]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  const handleConfirmInput = (input: PoLineReceiptInput, expectedCount: number) => {
    setPendingInput({ input, expectedCount });
  };

  const handleSubmit = async () => {
    if (!pendingInput) return;
    setSubmitting(true);
    try {
      const res = await api.post('/material/arrivals/po-line', pendingInput.input);
      const data: PoLineReceiptResponse = res.data?.data;
      // 그리드 갱신
      fetchLines();
      // 라벨 모달 오픈
      setLabelData(data);
      // 입력/선택 정리
      setPendingInput(null);
      setSelectedLine(null);
    } catch (err) {
      console.error('PO 라인 입하 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            {t('material.arrival.iqc005Title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.arrival.iqc005Description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchLines}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsManualOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.manualArrival')}
          </Button>
        </div>
      </div>

      {/* 필터 카드 */}
      <Card padding="sm">
        <CardContent>
          <div className="grid items-center gap-2"
               style={{ display: 'grid', gridTemplateColumns: '160px 220px 1fr 110px' }}>
            <ComCodeSelect
              groupCode="PO_STATUS"
              labelPrefix={t('common.status')}
              value={statusFilter}
              onChange={setStatusFilter}
              fullWidth
            />
            <Input
              placeholder={t('common.partCode')}
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
            />
            <Input
              placeholder={t('material.arrival.col.poNo')}
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Button onClick={fetchLines}>🔍 {t('common.search')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* PO 라인 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <PoLineGrid
            data={rows}
            isLoading={loading}
            onSelectLine={setSelectedLine}
          />
        </CardContent>
      </Card>

      {/* 1라인 입하 모달 */}
      <PoLineReceiptModal
        isOpen={!!selectedLine}
        line={selectedLine}
        onClose={() => setSelectedLine(null)}
        onConfirm={handleConfirmInput}
      />

      {/* 시리얼 발급 확인 */}
      <SerialIssueConfirmModal
        isOpen={!!pendingInput}
        expectedCount={pendingInput?.expectedCount ?? 0}
        onConfirm={handleSubmit}
        onCancel={() => setPendingInput(null)}
        submitting={submitting}
      />

      {/* 라벨 미리보기 */}
      <MatLabelPreviewModal
        isOpen={!!labelData}
        data={labelData}
        itemName={selectedLine?.itemName}
        receivedDate={pendingInput?.input.receivedDate}
        onClose={() => setLabelData(null)}
      />

      {/* 수동 입하 */}
      <ManualArrivalModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onSuccess={() => { setIsManualOpen(false); fetchLines(); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 기존 PoArrivalModal 제거 + 사용처 검색**

```bash
grep -rn "PoArrivalModal" apps/frontend/src
```
사용처 없으면 파일 삭제:
```bash
rm apps/frontend/src/app/\(authenticated\)/material/arrival/components/PoArrivalModal.tsx
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @hanes/frontend build
```
Expected: 0 error (i18n 키 미정의는 빌드 통과지만 런타임 키만 노출됨 — 다음 Task에서 채움)

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/material/arrival/page.tsx
git add -u apps/frontend/src/app/\(authenticated\)/material/arrival/components/PoArrivalModal.tsx
git commit -m "feat(material): rewrite arrival page to PO-line-driven IQC005 layout (T-011)"
```

---

## Task 17: 기존 입하 이력 컴포넌트는 Phase B로 안전 이동 마킹

> Phase A에서는 `ArrivalHistoryTable`을 메인에서 사용하지 않지만, 파일은 남겨두고 Phase B에서 `/material/receive-history`로 이동. arrival.service의 기존 `createPoArrival` 메서드는 deprecate 주석만 추가.

**Files:**
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
- Modify: `apps/frontend/src/app/(authenticated)/material/arrival/components/ArrivalHistoryTable.tsx`

- [ ] **Step 1: 백엔드 deprecate 주석**

`arrival.service.ts`의 기존 `createPoArrival` (또는 multi-item 입하 메서드) 위에:
```ts
  /**
   * @deprecated IQC005 Phase A부터 `receivePoLine(dto, user)`를 사용. 본 메서드는 Phase B에서 제거 예정.
   */
  async createPoArrival(...) { /* 기존 본문 */ }
```

- [ ] **Step 2: 프론트 deprecate JSDoc**

`ArrivalHistoryTable.tsx` 상단에:
```ts
/**
 * @deprecated IQC005 Phase A부터 이 화면은 별도 페이지 `/material/receive-history` (Phase B)로 이동 예정.
 * 현재 사용처 없음.
 */
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
pnpm --filter @hanes/backend build
pnpm --filter @hanes/frontend build
git add apps/backend/src/modules/material/services/arrival.service.ts \
        apps/frontend/src/app/\(authenticated\)/material/arrival/components/ArrivalHistoryTable.tsx
git commit -m "chore(material): mark legacy arrival createPoArrival / ArrivalHistoryTable as deprecated (T-011)"
```

---

## Task 18: i18n — ko/en/zh/vi 4파일 동기화

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: 신규 키 정의 (영문 키 기준)**

`material.arrival` 네임스페이스 아래 추가:
```
iqc005Title
iqc005Description
action.receive
col.lineNo
col.revNo
col.accReceived
col.useType
col.mfgPartner
col.serialUnitQty
col.expectedSerialCount
col.receivedDate
modal.receiveTitle
singleLot
serialUnitNote
confirm.notice
confirm.serialIssueTitle
confirm.serialIssueBody
confirm.serialIssueNote
label.title
label.print
```

추가로 `common`:
```
requiredMark
remarkOptional
close
processing
```

- [ ] **Step 2: ko.json 추가**

```json
{
  "material": {
    "arrival": {
      "iqc005Title": "자재 입하관리",
      "iqc005Description": "PO를 조회하여 자재를 입하 등록합니다.",
      "action": { "receive": "자재입하" },
      "col": {
        "lineNo": "L/N",
        "revNo": "R/N",
        "accReceived": "누적입하",
        "useType": "사용",
        "mfgPartner": "제조사",
        "serialUnitQty": "시리얼수량단위",
        "expectedSerialCount": "예상 발급 시리얼수",
        "receivedDate": "입하일"
      },
      "modal": { "receiveTitle": "자재입하 등록" },
      "singleLot": "단일 LOT 발급",
      "serialUnitNote": "품목 마스터 LOT_UNIT_QTY 값. 수정 불가.",
      "confirm": {
        "notice": "저장 직전 잔량 재계산. 잔량 초과 시 거절. 저장 시 발급될 시리얼 수만큼 라벨이 발행됩니다.",
        "serialIssueTitle": "시리얼 발급 확인",
        "serialIssueBody": "{{count}}건의 시리얼을 발급합니다. 계속하시겠습니까?",
        "serialIssueNote": "발급 후 자동으로 라벨 미리보기가 표시됩니다."
      },
      "label": { "title": "자재 라벨 미리보기", "print": "인쇄" }
    }
  },
  "common": {
    "requiredMark": "* 표시는 필수",
    "remarkOptional": "비고 (선택)",
    "close": "닫기",
    "processing": "처리 중..."
  }
}
```

> 기존 ko.json에 같은 네임스페이스가 있으면 머지. 키 중복 시 새 값으로 덮어쓰지 말고 기존 키 유지 + 부족한 키만 추가.

- [ ] **Step 3: en.json 추가 (동일 구조, 영문)**

```json
{
  "material": {
    "arrival": {
      "iqc005Title": "Material Receiving",
      "iqc005Description": "Search POs and register material receipts.",
      "action": { "receive": "Receive" },
      "col": {
        "lineNo": "L/N", "revNo": "R/N",
        "accReceived": "Received (Acc.)",
        "useType": "Use", "mfgPartner": "Manufacturer",
        "serialUnitQty": "Serial Unit Qty",
        "expectedSerialCount": "Expected Serials",
        "receivedDate": "Receive Date"
      },
      "modal": { "receiveTitle": "Register Material Receipt" },
      "singleLot": "Single LOT",
      "serialUnitNote": "ITEM_MASTERS.LOT_UNIT_QTY (read-only).",
      "confirm": {
        "notice": "Remaining qty is re-checked on save. Excess will be rejected. Labels will be issued for each generated serial.",
        "serialIssueTitle": "Confirm Serial Issuance",
        "serialIssueBody": "{{count}} serials will be issued. Continue?",
        "serialIssueNote": "Label preview will open automatically after issuance."
      },
      "label": { "title": "Material Label Preview", "print": "Print" }
    }
  },
  "common": {
    "requiredMark": "* required",
    "remarkOptional": "Remark (optional)",
    "close": "Close",
    "processing": "Processing..."
  }
}
```

- [ ] **Step 4: zh.json 추가**

```json
{
  "material": {
    "arrival": {
      "iqc005Title": "材料入库管理",
      "iqc005Description": "查询采购订单并登记物料入库。",
      "action": { "receive": "入库" },
      "col": {
        "lineNo": "行号", "revNo": "版本",
        "accReceived": "累计入库",
        "useType": "用途", "mfgPartner": "制造商",
        "serialUnitQty": "序列号单位数量",
        "expectedSerialCount": "预计发行序列号",
        "receivedDate": "入库日期"
      },
      "modal": { "receiveTitle": "登记物料入库" },
      "singleLot": "单批次",
      "serialUnitNote": "ITEM_MASTERS.LOT_UNIT_QTY(只读)。",
      "confirm": {
        "notice": "保存时重新计算剩余数量,超出将被拒绝。每个序列号会生成对应标签。",
        "serialIssueTitle": "确认发行序列号",
        "serialIssueBody": "将发行 {{count}} 个序列号。继续吗?",
        "serialIssueNote": "发行后将自动打开标签预览。"
      },
      "label": { "title": "材料标签预览", "print": "打印" }
    }
  },
  "common": {
    "requiredMark": "* 必填",
    "remarkOptional": "备注 (可选)",
    "close": "关闭",
    "processing": "处理中..."
  }
}
```

- [ ] **Step 5: vi.json 추가**

```json
{
  "material": {
    "arrival": {
      "iqc005Title": "Quản lý nhập kho vật tư",
      "iqc005Description": "Tìm PO và đăng ký nhập vật tư.",
      "action": { "receive": "Nhập kho" },
      "col": {
        "lineNo": "Dòng", "revNo": "Rev",
        "accReceived": "Đã nhập (lũy kế)",
        "useType": "Sử dụng", "mfgPartner": "Nhà sản xuất",
        "serialUnitQty": "Đơn vị số serial",
        "expectedSerialCount": "Số serial dự kiến",
        "receivedDate": "Ngày nhập"
      },
      "modal": { "receiveTitle": "Đăng ký nhập vật tư" },
      "singleLot": "LOT đơn",
      "serialUnitNote": "ITEM_MASTERS.LOT_UNIT_QTY (chỉ đọc).",
      "confirm": {
        "notice": "Số lượng còn lại sẽ được tính lại khi lưu. Vượt quá sẽ bị từ chối. Mỗi serial sẽ in nhãn tương ứng.",
        "serialIssueTitle": "Xác nhận phát hành serial",
        "serialIssueBody": "Sẽ phát hành {{count}} serial. Tiếp tục?",
        "serialIssueNote": "Bản xem trước nhãn sẽ mở tự động sau khi phát hành."
      },
      "label": { "title": "Xem trước nhãn vật tư", "print": "In" }
    }
  },
  "common": {
    "requiredMark": "* bắt buộc",
    "remarkOptional": "Ghi chú (tùy chọn)",
    "close": "Đóng",
    "processing": "Đang xử lý..."
  }
}
```

- [ ] **Step 6: BOM 검증 + 4파일 키 일치 검증**

```bash
# BOM 검사 (UTF-8 BOM 절대 금지)
head -c 3 apps/frontend/src/locales/ko.json | xxd
head -c 3 apps/frontend/src/locales/en.json | xxd
head -c 3 apps/frontend/src/locales/zh.json | xxd
head -c 3 apps/frontend/src/locales/vi.json | xxd
# 예상: 첫 3바이트가 7b ... (개행/공백 아닌 `{`로 시작) — EF BB BF가 보이면 BOM. 즉시 제거.

# 키 일치 검증 (간단)
for f in ko en zh vi; do
  echo "=== $f ==="
  grep -E "iqc005Title|action.receive|col.lineNo|mfgPartner|serialUnitQty|expectedSerialCount|serialIssueTitle|label.title" \
    apps/frontend/src/locales/$f.json | wc -l
done
# 예상: 4 파일 모두 동일 개수
```

- [ ] **Step 7: 빌드 + 커밋**

```bash
pnpm --filter @hanes/frontend build
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json \
        apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "i18n(material): add IQC005 receive keys to ko/en/zh/vi (T-011)"
```

---

## Task 19: 통합 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 백엔드 빌드 + 테스트**

```bash
pnpm --filter @hanes/backend build
pnpm --filter @hanes/backend test
```
Expected: 0 error, 모든 spec PASS.

- [ ] **Step 2: 전체 프론트 빌드**

```bash
pnpm --filter @hanes/frontend build
```
Expected: 0 error.

- [ ] **Step 3: DB 적용 상태 재확인**

```sql
SELECT 'MAT_LOTS.MFG_PARTNER_CODE' AS check_, COUNT(*) AS exists_
FROM USER_TAB_COLUMNS WHERE TABLE_NAME='MAT_LOTS' AND COLUMN_NAME='MFG_PARTNER_CODE'
UNION ALL
SELECT 'SEQ_MAT_SERIAL_DAILY', COUNT(*) FROM USER_SEQUENCES WHERE SEQUENCE_NAME='SEQ_MAT_SERIAL_DAILY'
UNION ALL
SELECT 'SEQ_ARRIVAL_NO_DAILY', COUNT(*) FROM USER_SEQUENCES WHERE SEQUENCE_NAME='SEQ_ARRIVAL_NO_DAILY'
UNION ALL
SELECT 'SEQ_RULES.MAT_UID', COUNT(*) FROM SEQ_RULES WHERE DOC_TYPE='MAT_UID' AND PREFIX='VH1-RM'
UNION ALL
SELECT 'SEQ_RULES.ARRIVAL', COUNT(*) FROM SEQ_RULES WHERE DOC_TYPE='ARRIVAL' AND PREFIX='R'
UNION ALL
SELECT 'PARTNER MFG count', COUNT(*) FROM PARTNER_MASTERS WHERE PARTNER_TYPE='MFG'
UNION ALL
SELECT 'RM with NULL LOT_UNIT_QTY', COUNT(*) FROM ITEM_MASTERS WHERE ITEM_TYPE='RM' AND LOT_UNIT_QTY IS NULL AND COMPANY='40';
```
Expected: 모든 row의 exists_가 1 이상, 마지막은 0.

- [ ] **Step 4: 사용자 수동 시나리오 검증 안내**

사용자에게 다음 시나리오 요청:
1. `/material/arrival` 접속 → PO 라인 그리드 표시 확인
2. PARTIAL 상태 행 클릭 → PoLineReceiptModal 열림
3. 입하수량 200, 제조사 M001, 입하일=오늘, 창고 선택 → 저장
4. SerialIssueConfirmModal 표시 ("4건의 시리얼을 발급합니다") → 확인
5. MatLabelPreviewModal 표시, 시리얼 4건 + 바코드 표시 → 인쇄 버튼 동작
6. 모달 닫기 → 그리드 새로고침, 해당 행 누적입하 +200 / 잔량 -200
7. oracle-db로 확인:
   ```sql
   SELECT MAT_UID, INIT_QTY, ARRIVAL_NO, MFG_PARTNER_CODE FROM MAT_LOTS
   WHERE ARRIVAL_NO = '...' ORDER BY ARRIVAL_SEQ;
   -- 4건, 동일 ARRIVAL_NO, INIT_QTY=50, MFG_PARTNER_CODE='M001'
   ```

- [ ] **Step 5: JOURNAL.md 갱신 + 협업 보드 정리**

`.ai-coordination/JOURNAL.md`에 T-011 Phase A 완료 단락 추가:
- 적용 마이그레이션 5개
- 시리얼 발급 검증 결과
- Phase B/C/D 후속 항목

`.ai-coordination/TASKS.md`에서 T-011을 REVIEW 상태로 변경 + `ARCHIVE.md`에 한 줄.
`.ai-coordination/LOCKS.md`의 T-011 락을 released로 마킹.

- [ ] **Step 6: 최종 협업 보드 커밋**

```bash
git add .ai-coordination/JOURNAL.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/ARCHIVE.md
git commit -m "chore(ai-coordination): close T-011 Phase A board state"
```

---

## 변경 사항 (B 결정 반영 — 2026-05-26 16:50)

- Task 6.5 추가: PURCHASE_ORDER_ITEMS에 `LINE_NO/REV_NO/LINE_STATUS`, PURCHASE_ORDERS에 `USE_TYPE` 컬럼 신설
- Task 7 DTO: `poItemId` → `poNo + poSeq` 복합키
- Task 8 receivePoLine: 복합키 조회 + PO 헤더 별도 조회 (PurchaseOrderItem entity에 po 관계 없음)
- Task 9 listPoLines: 명시적 join 사용, lineStatus/useType 컬럼 활용
- Task 12 PoLineGrid: status → lineStatus 필드 사용, `PO_LINE_STATUS` 코드 그룹 사용 (시드 필요)
- Task 13 PoLineReceiptModal: 부모에 poNo/poSeq 전달, part API 경로 `/master/parts/code/:itemCode`

## 후속 (Phase A 외)

- **Phase B**: IQC006 입하실적조회 페이지 신규 (`/material/receive-history`), 시리얼 상세 그리드, 입하 취소 흐름 일원화, 자투리 별도 시리얼 정책 명확화
- **Phase C**: 라벨 백엔드 통합, 재인쇄 흐름 (자재 현황/생산 현황/박스포장 화면), 프린터 연동
- **Phase D**: 자재 분할/병합 화면, parent/root 트리 추적, 분할/병합 시 라벨 자동 재발행
