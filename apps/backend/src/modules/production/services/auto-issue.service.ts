/**
 * @file services/auto-issue.service.ts
 * @description BOM 기반 자재 자동차감(Auto-Issue) 서비스
 *
 * 초보자 가이드:
 * 1. 생산실적 등록/완료 시 호출되어 BOM 자재를 FIFO로 자동 차감합니다.
 * 2. SysConfig 설정(MAT_AUTO_ISSUE_TIMING)으로 차감 시점을 제어합니다.
 * 3. BOM의 qtyPer × (goodQty + defectQty)로 소요량을 계산합니다.
 * 4. MatLot → MatIssue → StockTransaction → MatStock 순으로 처리합니다.
 * 5. 외부 트랜잭션(queryRunner)이 전달되면 그것을 공유하고,
 *    없으면 자체 트랜잭션을 생성합니다.
 *
 * 호출 예시:
 *   await autoIssueService.execute('ON_CREATE', 101, 'JO-20260305-0001', 50);
 */
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';

import { BomMaster } from '../../../entities/bom-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumRuleService } from '../../num-rule/num-rule.service';

/** 자동차감 결과 인터페이스 */
export interface AutoIssueResult {
  issued: { matUid: string; itemCode: string; issueQty: number }[];
  warnings: string[];
  skipped: boolean;
}

type IssueTiming = 'ON_CREATE' | 'ON_COMPLETE';

@Injectable()
export class AutoIssueService {
  private readonly logger = new Logger(AutoIssueService.name);

  constructor(
    @InjectRepository(BomMaster)
    private readonly bomRepo: Repository<BomMaster>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepo: Repository<MatIssue>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    private readonly sysConfigService: SysConfigService,
    private readonly numRuleService: NumRuleService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * BOM 기반 자재 자동차감 실행
   * @param timing  호출 시점 ('ON_CREATE' | 'ON_COMPLETE')
   * @param prodResultId  생산실적 ID
   * @param orderNo  작업지시 번호
   * @param qty  실적 수량 (goodQty + defectQty)
   * @param externalQR  외부 트랜잭션 QueryRunner (선택)
   */
  async execute(
    timing: IssueTiming,
    prodResultId: number,
    orderNo: string,
    qty: number,
    externalQR?: QueryRunner,
  ): Promise<AutoIssueResult> {
    const result: AutoIssueResult = { issued: [], warnings: [], skipped: false };

    /* ── 1. SysConfig 타이밍 확인 ─────────────────────── */
    const cfgTiming = await this.sysConfigService.getValue('MAT_AUTO_ISSUE_TIMING');
    if (!cfgTiming || cfgTiming !== timing) {
      this.logger.log(`자동차감 skip — 설정: ${cfgTiming}, 호출: ${timing}`);
      result.skipped = true;
      return result;
    }

    /* ── 2. 트랜잭션 준비 ────────────────────────────── */
    const isOwnTx = !externalQR;
    const qr = externalQR ?? this.dataSource.createQueryRunner();
    if (isOwnTx) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      /* ── 3. 작업지시 → itemCode 조회 ──────────────── */
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo },
      });
      if (!jobOrder) {
        throw new BadRequestException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
      }

      /* ── 4. BOM 조회 (유효 기간 & useYn) ──────────── */
      const today = new Date();
      const bomList = await this.findValidBom(qr, jobOrder.itemCode, today);
      if (bomList.length === 0) {
        this.logger.warn(`BOM 없음 — itemCode: ${jobOrder.itemCode}`);
        result.skipped = true;
        if (isOwnTx) await qr.commitTransaction();
        return result;
      }

      /* ── 5. 재고 부족 정책 조회 ───────────────────── */
      const stockCheckPolicy =
        (await this.sysConfigService.getValue('MAT_ISSUE_STOCK_CHECK')) ?? 'BLOCK';

      /* ── 6. 자식 품목별 FIFO 차감 ─────────────────── */
      for (const bom of bomList) {
        const requiredQty = Number(bom.qtyPer) * qty;
        if (requiredQty <= 0) continue;

        const childResult = await this.issueFifo(
          qr, bom.childItemCode, requiredQty, orderNo,
          prodResultId, stockCheckPolicy, result.warnings,
        );
        result.issued.push(...childResult);
      }

      if (isOwnTx) await qr.commitTransaction();
    } catch (err) {
      if (isOwnTx) await qr.rollbackTransaction();
      throw err;
    } finally {
      if (isOwnTx) await qr.release();
    }

    this.logger.log(
      `자동차감 완료 — orderNo: ${orderNo}, 품목 ${result.issued.length}건`,
    );
    return result;
  }

  /* ================================================================
   *  BOM 유효건 조회
   * ================================================================ */
  private async findValidBom(
    qr: QueryRunner,
    parentItemCode: string,
    today: Date,
  ): Promise<BomMaster[]> {
    const dateStr = today.toISOString().slice(0, 10);
    // Raw SQL로 복합 PK 테이블 조회 (TypeORM QueryBuilder의 Oracle 복합PK 호환 문제 회피)
    const rows = await qr.manager.query(
      `SELECT b.PARENT_ITEM_CODE AS "parentItemCode",
              b.CHILD_ITEM_CODE  AS "childItemCode",
              b.REVISION         AS "revision",
              b.QTY_PER          AS "qtyPer",
              b.SEQ              AS "seq",
              b.BOM_GRP          AS "bomGrp",
              b.OPER             AS "processCode",
              b.SIDE             AS "side",
              b.ECO_NO           AS "ecoNo",
              b.VALID_FROM       AS "validFrom",
              b.VALID_TO         AS "validTo",
              b.USE_YN           AS "useYn"
         FROM BOM_MASTERS b
        WHERE b.PARENT_ITEM_CODE = :1
          AND b.USE_YN = 'Y'
          AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:2, 'YYYY-MM-DD'))
          AND (b.VALID_TO   IS NULL OR b.VALID_TO   >= TO_DATE(:3, 'YYYY-MM-DD'))
        ORDER BY b.SEQ ASC`,
      [parentItemCode, dateStr, dateStr],
    );
    return rows as BomMaster[];
  }

  /* ================================================================
   *  FIFO LOT 차감 (분할 차감 포함)
   * ================================================================ */
  private async issueFifo(
    qr: QueryRunner,
    itemCode: string,
    requiredQty: number,
    orderNo: string,
    prodResultId: number,
    stockCheckPolicy: string,
    warnings: string[],
  ): Promise<{ matUid: string; itemCode: string; issueQty: number }[]> {
    const issued: { matUid: string; itemCode: string; issueQty: number }[] = [];

    /* FIFO LOT 목록 (PASS & NORMAL & currentQty > 0) */
    const lots = await qr.manager
      .createQueryBuilder(MatLot, 'l')
      .where('l.itemCode = :itemCode', { itemCode })
      .andWhere('l.currentQty > 0')
      .andWhere('l.iqcStatus = :iqc', { iqc: 'PASS' })
      .andWhere('l.status = :st', { st: 'NORMAL' })
      .orderBy('l.createdAt', 'ASC')
      .getMany();

    const totalAvailable = lots.reduce((sum, l) => sum + l.currentQty, 0);

    /* 재고 부족 체크 */
    if (totalAvailable < requiredQty) {
      const msg =
        `재고 부족 — ${itemCode}: 필요 ${requiredQty}, 가용 ${totalAvailable}`;
      if (stockCheckPolicy === 'BLOCK') {
        throw new BadRequestException(msg);
      }
      // WARN: 가용분만 차감
      this.logger.warn(msg);
      warnings.push(msg);
    }

    let remaining = Math.min(requiredQty, totalAvailable);

    for (const lot of lots) {
      if (remaining <= 0) break;

      const issueQty = Math.min(remaining, lot.currentQty);
      remaining -= issueQty;

      /* (a) MatIssue 생성 */
      const issueNo = await this.numRuleService.nextNumberInTx(qr, 'MAT_ISSUE');
      const issueEntity = qr.manager.create(MatIssue, {
        issueNo,
        orderNo,
        prodResultId,
        matUid: lot.matUid,
        issueQty,
        issueType: 'PROD_AUTO',
        status: 'DONE',
        company: lot.company || '40',
        plant: lot.plant || '1000',
      });
      await qr.manager.save(MatIssue, issueEntity);

      /* (b) StockTransaction 생성 */
      const transNo = await this.numRuleService.nextNumberInTx(qr, 'STOCK_TX');
      const txEntity = qr.manager.create(StockTransaction, {
        transNo,
        transType: 'MAT_OUT',
        itemCode,
        matUid: lot.matUid,
        qty: -issueQty,
        refType: 'MAT_ISSUE',
        refId: issueNo,
        status: 'DONE',
        company: lot.company || '40',
        plant: lot.plant || '1000',
      });
      await qr.manager.save(StockTransaction, txEntity);

      /* (c) MatLot.currentQty 차감 + 상태 갱신 */
      const newQty = lot.currentQty - issueQty;
      await qr.manager.update(MatLot, { matUid: lot.matUid }, {
        currentQty: newQty,
        ...(newQty <= 0 ? { status: 'DEPLETED' } : {}),
      });

      /* (d) MatStock 차감 (해당 LOT의 모든 창고 재고) */
      await this.deductMatStock(qr, itemCode, lot.matUid, issueQty);

      issued.push({ matUid: lot.matUid, itemCode, issueQty });
    }

    return issued;
  }

  /* ================================================================
   *  MatStock 차감 — LOT 기준 모든 창고에서 차감
   * ================================================================ */
  private async deductMatStock(
    qr: QueryRunner,
    itemCode: string,
    matUid: string,
    totalDeduct: number,
  ): Promise<void> {
    const stocks = await qr.manager.find(MatStock, {
      where: { itemCode, matUid },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    let remaining = totalDeduct;
    for (const stock of stocks) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, stock.qty);
      remaining -= deduct;

      await qr.manager.update(
        MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid },
        {
          qty: stock.qty - deduct,
          availableQty: Math.max(0, stock.availableQty - deduct),
        },
      );
    }
  }
}
