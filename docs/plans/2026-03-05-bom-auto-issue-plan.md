# BOM 기반 자재 자동차감 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 생산실적 등록/완료 시 BOM 기반으로 자재를 FIFO 자동차감하는 기능 구현

**Architecture:** ProdResultService의 create/complete 시점에서 AutoIssueService를 호출하여, BOM 조회 → FIFO LOT 선택 → 분할차감 → MatIssue/StockTransaction 생성을 수행. SysConfig로 차감 시점(ON_CREATE/ON_COMPLETE/OFF)과 재고 부족 시 동작(WARN/BLOCK) 제어.

**Tech Stack:** NestJS, TypeORM, Oracle DB, pnpm monorepo

**설계 문서:** `docs/plans/2026-03-05-bom-auto-issue-design.md`

---

## Task 1: SysConfig 시드 추가

**Files:**
- Modify: `scripts/seed-sys-configs.sql`

**Step 1: 시드 SQL에 설정 2개 추가**

기존 MATERIAL 그룹 마지막(IQC_AUTO_RECEIVE 아래)에 추가:

```sql
-- 자재 자동차감 시점 (ON_CREATE: 실적등록시, ON_COMPLETE: 실적완료시, OFF: 수동)
INSERT INTO SYS_CONFIGS (ID, CONFIG_GROUP, CONFIG_KEY, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE)
VALUES (SYS_GUID(), 'MATERIAL', 'MAT_AUTO_ISSUE_TIMING', 'OFF', 'SELECT', '자재 자동차감 시점', 'BOM 기반 자재 자동차감 실행 시점 설정', '[{"value":"OFF","label":"수동(사용안함)"},{"value":"ON_CREATE","label":"실적 등록 시"},{"value":"ON_COMPLETE","label":"실적 완료 시"}]', 9, 'Y');

-- 자재 자동차감 재고부족 처리 (WARN: 경고후진행, BLOCK: 차단)
INSERT INTO SYS_CONFIGS (ID, CONFIG_GROUP, CONFIG_KEY, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE)
VALUES (SYS_GUID(), 'MATERIAL', 'MAT_ISSUE_STOCK_CHECK', 'WARN', 'SELECT', '재고부족 시 처리', '자동차감 시 재고 부족 시 처리 방법', '[{"value":"WARN","label":"경고 후 진행"},{"value":"BLOCK","label":"차단(실적등록 불가)"}]', 10, 'Y');
```

**Step 2: Oracle에 직접 실행하여 시드 적용**

```bash
# oracle-db 스킬로 실행하거나, 수동 실행
```

**Step 3: 커밋**

```bash
git add scripts/seed-sys-configs.sql
git commit -m "feat: 자재 자동차감 SysConfig 시드 추가 (MAT_AUTO_ISSUE_TIMING, MAT_ISSUE_STOCK_CHECK)"
```

---

## Task 2: AutoIssueService 생성 (핵심 로직)

**Files:**
- Create: `apps/backend/src/modules/production/services/auto-issue.service.ts`

**Step 1: AutoIssueService 파일 생성**

이 서비스는 다음을 수행:
1. SysConfig 확인 (OFF면 즉시 리턴)
2. BOM 조회 (유효 BOM의 자품목 목록)
3. 자품목별 소요량 계산 (qtyPer × 생산수량)
4. FIFO LOT 선택 (createdAt ASC, currentQty > 0)
5. 재고 부족 체크 (WARN/BLOCK)
6. MatIssue + StockTransaction 생성 + LOT/Stock 차감

```typescript
/**
 * @file auto-issue.service.ts
 * @description BOM 기반 자재 자동차감 서비스
 *
 * 초보자 가이드:
 * 1. 생산실적 등록/완료 시 BOM을 조회하여 소요 자재를 자동 차감
 * 2. FIFO(선입선출)로 LOT을 선택, 하나의 LOT으로 부족하면 다음 LOT에서 차감
 * 3. SysConfig로 차감 시점(ON_CREATE/ON_COMPLETE/OFF)과 재고부족 처리(WARN/BLOCK) 제어
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumRuleService } from '../../num-rule/num-rule.service';

export interface AutoIssueResult {
  issued: { matUid: string; itemCode: string; issueQty: number }[];
  warnings: string[];
  skipped: boolean;
}

@Injectable()
export class AutoIssueService {
  private readonly logger = new Logger(AutoIssueService.name);

  constructor(
    @InjectRepository(BomMaster)
    private readonly bomRepository: Repository<BomMaster>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepository: Repository<StockTransaction>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly sysConfigService: SysConfigService,
    private readonly numRuleService: NumRuleService,
  ) {}

  /**
   * 생산실적에 대한 BOM 기반 자재 자동차감
   * @param timing 호출 시점 ('ON_CREATE' | 'ON_COMPLETE')
   * @param prodResultId 생산실적 ID
   * @param orderNo 작업지시 번호
   * @param qty 생산수량 (goodQty + defectQty)
   * @param queryRunner 트랜잭션 공유 (complete에서 전달)
   */
  async execute(
    timing: 'ON_CREATE' | 'ON_COMPLETE',
    prodResultId: number,
    orderNo: string,
    qty: number,
    queryRunner?: QueryRunner,
  ): Promise<AutoIssueResult> {
    const result: AutoIssueResult = { issued: [], warnings: [], skipped: false };

    // 1. SysConfig 확인
    const configTiming = await this.sysConfigService.getValue('MAT_AUTO_ISSUE_TIMING');
    if (!configTiming || configTiming === 'OFF' || configTiming !== timing) {
      result.skipped = true;
      return result;
    }

    const stockCheck = await this.sysConfigService.getValue('MAT_ISSUE_STOCK_CHECK') || 'WARN';

    // 2. 작업지시에서 생산 품목 확인
    const mgr = queryRunner?.manager ?? this.jobOrderRepository.manager;
    const jobOrder = await mgr.findOne(JobOrder, { where: { orderNo } });
    if (!jobOrder) return result;

    // 3. BOM 조회 (유효 자품목)
    const bomItems = await this.bomRepository.createQueryBuilder('bom')
      .where('bom.parentItemCode = :parentItemCode', { parentItemCode: jobOrder.itemCode })
      .andWhere('bom.useYn = :useYn', { useYn: 'Y' })
      .andWhere('(bom.validFrom IS NULL OR bom.validFrom <= CURRENT_DATE)')
      .andWhere('(bom.validTo IS NULL OR bom.validTo >= CURRENT_DATE)')
      .orderBy('bom.seq', 'ASC')
      .getMany();

    if (bomItems.length === 0) {
      this.logger.warn(`BOM 미등록: ${jobOrder.itemCode} (작업지시: ${orderNo})`);
      return result;
    }

    // 4. 자품목별 FIFO 차감
    const ownQr = queryRunner == null;
    const qr = queryRunner ?? mgr.connection.createQueryRunner();
    if (ownQr) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      const issueNo = await this.numRuleService.nextNumberInTx(qr, 'MAT_ISSUE');

      for (const bom of bomItems) {
        const requiredQty = bom.qtyPer * qty;
        if (requiredQty <= 0) continue;

        // FIFO LOT 선택
        const lots = await qr.manager
          .createQueryBuilder(MatLot, 'lot')
          .where('lot.itemCode = :itemCode', { itemCode: bom.childItemCode })
          .andWhere('lot.currentQty > 0')
          .andWhere('lot.iqcStatus = :iqcStatus', { iqcStatus: 'PASS' })
          .andWhere('lot.status IN (:...statuses)', { statuses: ['NORMAL'] })
          .orderBy('lot.createdAt', 'ASC')
          .getMany();

        const totalAvailable = lots.reduce((sum, l) => sum + l.currentQty, 0);

        // 재고 부족 체크
        if (totalAvailable < requiredQty) {
          const msg = `재고 부족: ${bom.childItemCode} (필요: ${requiredQty}, 가용: ${totalAvailable})`;
          if (stockCheck === 'BLOCK') {
            throw new BadRequestException(msg);
          }
          result.warnings.push(msg);
          this.logger.warn(msg);
        }

        // 분할 차감
        let remaining = Math.min(requiredQty, totalAvailable);
        for (const lot of lots) {
          if (remaining <= 0) break;

          const issueQty = Math.min(remaining, lot.currentQty);
          remaining -= issueQty;

          // MatIssue 생성
          const issue = qr.manager.create(MatIssue, {
            issueNo,
            orderNo,
            prodResultId,
            matUid: lot.matUid,
            issueQty,
            issueType: 'PROD_AUTO',
            remark: `BOM 자동차감 (${bom.parentItemCode} → ${bom.childItemCode})`,
            status: 'DONE',
          });
          const savedIssue = await qr.manager.save(issue);

          // StockTransaction 생성
          const transNo = await this.numRuleService.nextNumberInTx(qr, 'STOCK_TX');
          const stockTx = qr.manager.create(StockTransaction, {
            transNo,
            transType: 'MAT_OUT',
            itemCode: lot.itemCode,
            matUid: lot.matUid,
            qty: -issueQty,
            remark: `자동차감: ${lot.matUid} (실적#${prodResultId})`,
            refType: 'MAT_ISSUE',
            refId: String(savedIssue.id),
            status: 'DONE',
          });
          await qr.manager.save(stockTx);

          // LOT 재고 차감
          const newQty = lot.currentQty - issueQty;
          await qr.manager.update(MatLot, lot.matUid, {
            currentQty: newQty,
            status: newQty === 0 ? 'DEPLETED' : lot.status,
          });

          // MatStock 차감 (모든 창고에서 해당 LOT 재고 감소)
          const stocks = await qr.manager.find(MatStock, {
            where: { itemCode: lot.itemCode, matUid: lot.matUid },
          });
          let stockRemaining = issueQty;
          for (const stock of stocks) {
            if (stockRemaining <= 0) break;
            const deduct = Math.min(stockRemaining, stock.qty);
            stockRemaining -= deduct;
            await qr.manager.update(
              MatStock,
              { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
              { qty: stock.qty - deduct, availableQty: Math.max(0, stock.availableQty - deduct) },
            );
          }

          result.issued.push({ matUid: lot.matUid, itemCode: lot.itemCode, issueQty });
        }
      }

      if (ownQr) await qr.commitTransaction();
    } catch (err) {
      if (ownQr) await qr.rollbackTransaction();
      throw err;
    } finally {
      if (ownQr) await qr.release();
    }

    if (result.issued.length > 0) {
      this.logger.log(`자동차감 완료: 실적#${prodResultId}, ${result.issued.length}건`);
    }
    return result;
  }
}
```

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/auto-issue.service.ts
git commit -m "feat: AutoIssueService 생성 - BOM 기반 FIFO 자동차감 핵심 로직"
```

---

## Task 3: ProductionModule에 AutoIssueService 등록

**Files:**
- Modify: `apps/backend/src/modules/production/production.module.ts`

**Step 1: AutoIssueService를 providers와 exports에 추가**

```typescript
// imports 섹션에 추가 (SystemModule, NumRuleModule이 필요)
import { AutoIssueService } from './services/auto-issue.service';

// Module 데코레이터 수정:
// imports 배열에 추가 (SystemModule이 아직 없다면):
//   SystemModule,
//   NumRuleModule,
// providers 배열에 추가:
//   AutoIssueService,
// exports 배열에 추가:
//   AutoIssueService,
```

- `production.module.ts`의 imports에 `SystemModule`, `NumRuleModule` 추가 (기존에 없다면)
- providers에 `AutoIssueService` 추가
- exports에 `AutoIssueService` 추가

**Step 2: 타입체크**

```bash
cd apps/backend && npx tsc --noEmit
```

**Step 3: 커밋**

```bash
git add apps/backend/src/modules/production/production.module.ts
git commit -m "feat: ProductionModule에 AutoIssueService 등록"
```

---

## Task 4: ProdResultService.create()에 자동차감 연동

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts` (라인 319-397 create 메서드)

**Step 1: AutoIssueService 주입 추가**

constructor에 `private readonly autoIssueService: AutoIssueService` 추가

**Step 2: create() 메서드에 자동차감 호출 추가**

현재 create()는 트랜잭션 없이 `prodResultRepository.save()`만 수행.
ON_CREATE + BLOCK 모드를 위해 트랜잭션으로 감싸야 함.

```typescript
async create(dto: CreateProdResultDto) {
  // ... 기존 검증 로직 유지 (작업지시 확인, 수량 초과 체크, 인터락 체크) ...

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 기존 save 로직을 queryRunner 내부로 이동
    const prodResult = queryRunner.manager.create(ProdResult, { ... });
    const saved = await queryRunner.manager.save(prodResult);

    // 자동차감 호출 (ON_CREATE 시점)
    const totalQty = (dto.goodQty ?? 0) + (dto.defectQty ?? 0);
    if (totalQty > 0) {
      await this.autoIssueService.execute(
        'ON_CREATE',
        saved.id,
        dto.orderNo,
        totalQty,
        queryRunner,
      );
    }

    await queryRunner.commitTransaction();
    return this.prodResultRepository.findOne({ where: { id: saved.id }, relations: [...] });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

주의: 기존 create() 뒤에 있던 `findOne` 재조회는 트랜잭션 밖에서 수행 (커밋 후).

**Step 3: 커밋**

```bash
git add apps/backend/src/modules/production/services/prod-result.service.ts
git commit -m "feat: ProdResult.create()에 ON_CREATE 자동차감 연동"
```

---

## Task 5: ProdResultService.complete()에 자동차감 연동

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts` (라인 464-558 complete 메서드)

**Step 1: complete() 트랜잭션 내에 자동차감 호출 추가**

complete()는 이미 queryRunner 사용 중. 기존 트랜잭션 내에 추가:

```typescript
// 기존 complete() 트랜잭션 내부, 금형 타수 처리 후에 추가:

// 자동차감 (ON_COMPLETE 시점)
const totalQty = result.goodQty + result.defectQty;
if (totalQty > 0) {
  await this.autoIssueService.execute(
    'ON_COMPLETE',
    result.id,
    result.orderNo,
    totalQty,
    queryRunner,
  );
}
```

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/prod-result.service.ts
git commit -m "feat: ProdResult.complete()에 ON_COMPLETE 자동차감 연동"
```

---

## Task 6: 실적 취소 시 자동차감 역분개

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts` (cancel 메서드)

**Step 1: cancel() 메서드에 PROD_AUTO MatIssue 역분개 추가**

기존 cancel() 트랜잭션 내에서, 해당 prodResultId로 연결된 PROD_AUTO MatIssue를 조회하고 역분개 처리:

```typescript
// cancel() 트랜잭션 내부에 추가:

// PROD_AUTO 자동차감 역분개
const autoIssues = await queryRunner.manager.find(MatIssue, {
  where: { prodResultId: +id, issueType: 'PROD_AUTO', status: 'DONE' },
});
for (const issue of autoIssues) {
  // MatIssue 상태 → CANCELED
  await queryRunner.manager.update(MatIssue, issue.id, { status: 'CANCELED' });

  // LOT 재고 복구
  const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid: issue.matUid } });
  if (lot) {
    const newQty = lot.currentQty + issue.issueQty;
    await queryRunner.manager.update(MatLot, lot.matUid, {
      currentQty: newQty,
      status: newQty > 0 ? 'NORMAL' : lot.status,
    });
  }

  // 역분개 StockTransaction 생성
  const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
  const reverseTx = queryRunner.manager.create(StockTransaction, {
    transNo,
    transType: 'MAT_OUT',
    itemCode: lot?.itemCode,
    matUid: issue.matUid,
    qty: issue.issueQty, // 양수 (복구)
    remark: `자동차감 역분개 (실적#${id} 취소)`,
    refType: 'MAT_ISSUE',
    refId: String(issue.id),
    status: 'DONE',
  });
  await queryRunner.manager.save(reverseTx);

  // MatStock 복구
  const stocks = await queryRunner.manager.find(MatStock, {
    where: { itemCode: lot?.itemCode, matUid: issue.matUid },
  });
  if (stocks.length > 0) {
    const stock = stocks[0];
    await queryRunner.manager.update(
      MatStock,
      { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
      { qty: stock.qty + issue.issueQty, availableQty: stock.availableQty + issue.issueQty },
    );
  }
}
```

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/prod-result.service.ts
git commit -m "feat: 실적 취소 시 PROD_AUTO 자동차감 역분개"
```

---

## Task 7: 빌드 검증 및 최종 확인

**Step 1: 타입체크**

```bash
cd apps/backend && npx tsc --noEmit
```

에러 0개 확인.

**Step 2: 전체 빌드**

```bash
pnpm build
```

**Step 3: 최종 커밋 (필요시)**

```bash
git add -A
git commit -m "fix: 타입체크 에러 수정"
```

---

## 체크리스트

- [ ] SysConfig 시드 2개 적용 (MAT_AUTO_ISSUE_TIMING, MAT_ISSUE_STOCK_CHECK)
- [ ] AutoIssueService 생성 (BOM 조회 → FIFO LOT → 분할차감)
- [ ] ProductionModule에 등록
- [ ] ProdResultService.create() → ON_CREATE 연동
- [ ] ProdResultService.complete() → ON_COMPLETE 연동
- [ ] 실적 취소 시 PROD_AUTO 역분개
- [ ] 타입체크 통과
- [ ] SysConfig 'OFF'일 때 기존 동작 변경 없음 확인
