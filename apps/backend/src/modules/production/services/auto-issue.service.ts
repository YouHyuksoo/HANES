/**
 * @file services/auto-issue.service.ts
 * @description BOM 기반 자재 자동차감(Auto-Issue) 서비스
 *
 * 초보자 가이드:
 * 1. 생산실적 등록/완료 시 호출되어 BOM 자재를 소비(차감)합니다.
 * 2. SysConfig 설정(MAT_AUTO_ISSUE_TIMING)으로 차감 시점을 제어합니다.
 * 3. BOM의 qtyPer × (goodQty + defectQty)로 소요량을 계산합니다.
 * 4. 설비(equipCode) 배정 시: 공정재고(WIP_MAT_STOCKS)에서 소비.
 *    - WipMatStockService.deductStockInTx 위임 → WIP_MAT_TRANSACTIONS(PROD_CONSUME) 기록.
 *    - 원자재재고(MAT_STOCKS)는 절대 건드리지 않는다(이중차감 방지).
 * 5. 설비 미배정(fallback): 기존 원자재창고 FIFO 차감(MAT_OUT + MatIssue PROD_AUTO).
 * 6. 외부 트랜잭션(queryRunner)이 전달되면 그것을 공유하고,
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
import { Repository, QueryRunner, In } from 'typeorm';

import { BomMaster } from '../../../entities/bom-master.entity';
import { JobMaterialLot } from '../../../entities/job-material-lot.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';

/** 자동차감 결과 인터페이스 */
export interface AutoIssueResult {
  issued: { matUid: string; itemCode: string; issueQty: number }[];
  warnings: string[];
  skipped: boolean;
}

interface BomComponentRow {
  parentItemCode: string;
  childItemCode: string;
  qtyPer: number;
  seq: number;
  bomGrp: string | null;
  processCode: string | null;
  side: string | null;
  ecoNo: string | null;
  validFrom: Date | string | null;
  validTo: Date | string | null;
  useYn: string;
}

type IssueTiming = 'ON_CREATE' | 'ON_COMPLETE';
type TenantContext = { company?: string | null; plant?: string | null };

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
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
    private readonly wipMatStockService: WipMatStockService,
  ) {}

  private tenantWhere(tenant: TenantContext) {
    return {
      ...(tenant.company ? { company: tenant.company } : {}),
      ...(tenant.plant ? { plant: tenant.plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    tenant: TenantContext,
    row: { company?: string | null; plant?: string | null },
  ) {
    if (tenant.company && row.company !== tenant.company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${tenant.company}, row=${row.company ?? 'NULL'}`);
    }
    if (tenant.plant && row.plant !== tenant.plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${tenant.plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  /**
   * BOM 기반 자재 자동차감 실행
   * @param timing  호출 시점 ('ON_CREATE' | 'ON_COMPLETE')
   * @param prodResultNo  생산실적 번호 (PK)
   * @param orderNo  작업지시 번호
   * @param qty  실적 수량 (goodQty + defectQty)
   * @param externalQR  외부 트랜잭션 QueryRunner (선택)
   */
  async execute(
    timing: IssueTiming,
    prodResultNo: string,
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

    if (externalQR) {
      await this.executeInTransaction(externalQR, result, prodResultNo, orderNo, qty);
    } else {
      await this.tx.run((qr) => this.executeInTransaction(qr, result, prodResultNo, orderNo, qty));
    }

    this.logger.log(
      `자동차감 완료 — orderNo: ${orderNo}, 품목 ${result.issued.length}건`,
    );
    return result;
  }

  private async executeInTransaction(
    qr: QueryRunner,
    result: AutoIssueResult,
    prodResultNo: string,
    orderNo: string,
    qty: number,
  ): Promise<void> {
    /* ── 3. 작업지시 → itemCode 조회 ──────────────── */
    const jobOrder = await qr.manager.findOne(JobOrder, {
      where: { orderNo },
    });
    if (!jobOrder) {
      throw new BadRequestException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }
    const tenant: TenantContext = { company: jobOrder.company, plant: jobOrder.plant };

    /* ── 4. BOM 조회 (유효 기간 & useYn) ──────────── */
    const today = new Date();
    const bomList = await this.findValidBom(qr, jobOrder.itemCode, today, tenant);
    if (bomList.length === 0) {
      this.logger.warn(`BOM 없음 — itemCode: ${jobOrder.itemCode}`);
      result.skipped = true;
      return;
    }

    /* ── 5. 재고 부족 정책 조회 ───────────────────── */
    const stockCheckPolicy =
      (await this.sysConfigService.getValue('MAT_ISSUE_STOCK_CHECK')) ?? 'BLOCK';

    /* ── 5-1. 소비 모델 결정 ─────────────────────
     * 공정재고 모델(R5): 출고이동이 원자재재고(MAT_STOCKS)→공정재고(WIP_MAT_STOCKS)로
     * 이미 적재했으므로, 소비(차감)는 공정재고에서만 한다(이중차감 방지).
     * - equipCode 있음: WipMatStockService.deductStockInTx 위임(WIP_MAT_TRANSACTIONS 기록).
     * - equipCode 없음(설비 미배정): 안전책으로 기존 원자재창고 FIFO(MAT_OUT) fallback + 경고. */
    const equipCode = jobOrder.equipCode;
    if (!equipCode) {
      const msg =
        `작업지시에 설비가 배정되지 않아 공정재고 소비를 적용할 수 없습니다. ` +
        `기존 원자재창고 차감으로 처리합니다. orderNo=${orderNo}`;
      this.logger.warn(msg);
      result.warnings.push(msg);
    }

    /* ── 5-2. 키오스크에서 스캔한 작업지시 자재 LOT (차감 우선순위 1순위) ── */
    const scannedLots = await qr.manager.find(JobMaterialLot, {
      where: { jobOrderNo: orderNo, ...this.tenantWhere(tenant) },
    });
    const bomChildItemCodes = new Set(bomList.map((bom) => bom.childItemCode));
    const invalidScannedLot = scannedLots.find((lot) => !bomChildItemCodes.has(lot.itemCode));
    if (invalidScannedLot) {
      throw new BadRequestException(
        `BOM에 없는 자재 LOT가 스캔되어 실적처리를 중단합니다. ` +
        `itemCode=${invalidScannedLot.itemCode}, matUid=${invalidScannedLot.matUid}`,
      );
    }
    if (scannedLots.length > 0) {
      const scannedMatUidsForValidation = scannedLots.map((lot) => lot.matUid);
      const scannedMatLots = await qr.manager.find(MatLot, {
        where: { matUid: In(scannedMatUidsForValidation), ...this.tenantWhere(tenant) },
      });
      const matLotByUid = new Map(scannedMatLots.map((lot) => [lot.matUid, lot]));
      for (const scannedLot of scannedLots) {
        const actualLot = matLotByUid.get(scannedLot.matUid);
        if (!actualLot) {
          throw new BadRequestException(
            `스캔 LOT를 찾을 수 없어 실적처리를 중단합니다. matUid=${scannedLot.matUid}`,
          );
        }
        this.assertSameTenant('스캔 LOT', tenant, actualLot);
        if (actualLot.itemCode !== scannedLot.itemCode || !bomChildItemCodes.has(actualLot.itemCode)) {
          throw new BadRequestException(
            `스캔 LOT의 실제 품목이 BOM 품목과 일치하지 않아 실적처리를 중단합니다. ` +
            `registeredItemCode=${scannedLot.itemCode}, actualItemCode=${actualLot.itemCode}, matUid=${scannedLot.matUid}`,
          );
        }
      }
    }
    const scannedMatUids = new Set(scannedLots.map((l) => l.matUid));

    /* ── 6. 자식 품목별 차감 (스캔 LOT 우선 → FIFO) ── */
    for (const bom of bomList) {
      const requiredQty = Number(bom.qtyPer) * qty;
      if (requiredQty <= 0) continue;

      if (equipCode) {
        /* 공정재고(WIP_MAT_STOCKS) 소비 — WipMatStockService에 위임.
         * WIP_MAT_TRANSACTIONS(PROD_CONSUME) 기록 + 스캔 LOT 우선 + 부족정책 처리는 서비스 내부 책임.
         * 원자재재고(MAT_STOCKS)는 일절 건드리지 않는다(이중차감 방지). */
        const deducted = await this.wipMatStockService.deductStockInTx(qr, {
          equipCode,
          itemCode: bom.childItemCode,
          qty: requiredQty,
          transType: 'PROD_CONSUME',
          refType: 'PROD_RESULT',
          refId: prodResultNo,
          orderNo,
          scannedMatUids: Array.from(scannedMatUids),
          stockPolicy: stockCheckPolicy === 'WARN' ? 'WARN' : 'BLOCK',
          company: jobOrder.company,
          plant: jobOrder.plant,
          warnings: result.warnings,
        });
        result.issued.push(
          ...deducted.map((d) => ({ matUid: d.matUid, itemCode: bom.childItemCode, issueQty: d.qty })),
        );
      } else {
        /* 설비 미배정 fallback — 기존 원자재창고 FIFO 차감(MAT_OUT + MatIssue PROD_AUTO) */
        const childResult = await this.issueFifo(
          qr, bom.childItemCode, requiredQty, orderNo,
          prodResultNo, stockCheckPolicy, result.warnings, tenant,
          scannedMatUids,
        );
        result.issued.push(...childResult);
      }
    }
  }

  /* ================================================================
   *  BOM 유효건 조회
   * ================================================================ */
  private async findValidBom(
    qr: QueryRunner,
    parentItemCode: string,
    today: Date,
    tenant: TenantContext,
  ): Promise<BomComponentRow[]> {
    const dateStr = today.toISOString().slice(0, 10);
    const tenantClauses: string[] = [];
    const params = [parentItemCode, dateStr, dateStr];
    if (tenant.company) {
      tenantClauses.push(`          AND b.COMPANY = :${params.length + 1}`);
      params.push(tenant.company);
    }
    if (tenant.plant) {
      tenantClauses.push(`          AND b.PLANT_CD = :${params.length + 1}`);
      params.push(tenant.plant);
    }
    const tenantSql = tenantClauses.length > 0 ? `${tenantClauses.join('\n')}\n` : '';
    // Raw SQL로 복합 PK 테이블 조회 (TypeORM QueryBuilder의 Oracle 복합PK 호환 문제 회피)
    const rows: BomComponentRow[] = await qr.manager.query(
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
${tenantSql}
        ORDER BY b.SEQ ASC`,
      params,
    );
    return rows;
  }

  /* ================================================================
   *  [Fallback 전용] 설비 미배정 작업지시의 원자재창고 FIFO 차감.
   *  공정재고(WIP) 소비는 WipMatStockService.deductStockInTx가 담당하며,
   *  이 메서드는 equipCode가 없는 예외 케이스에서만 호출된다.
   *  우선순위: ① 키오스크 스캔 LOT(JOB_MATERIAL_LOTS) → ② FIFO(createdAt)
   * ================================================================ */
  private async issueFifo(
    qr: QueryRunner,
    itemCode: string,
    requiredQty: number,
    orderNo: string,
    prodResultNo: string,
    stockCheckPolicy: string,
    warnings: string[],
    tenant: TenantContext,
    scannedMatUids: Set<string> = new Set(),
  ): Promise<{ matUid: string; itemCode: string; issueQty: number }[]> {
    const issued: { matUid: string; itemCode: string; issueQty: number }[] = [];
    const tenantWhere = this.tenantWhere(tenant);

    /* FIFO LOT 목록 (PASS & NORMAL & MatStock.qty > 0) — IN 배치로 N+1 방지 */
    const lotQb = qr.manager
      .createQueryBuilder(MatLot, 'l')
      .where('l.itemCode = :itemCode', { itemCode })
      .andWhere('l.iqcStatus = :iqc', { iqc: 'PASS' })
      .andWhere('l.status = :st', { st: 'NORMAL' });
    if (tenant.company) lotQb.andWhere('l.company = :company', { company: tenant.company });
    if (tenant.plant) lotQb.andWhere('l.plant = :plant', { plant: tenant.plant });
    const fifoLots = await lotQb.orderBy('l.createdAt', 'ASC').getMany();

    // 작업지시에 스캔 등록된 LOT을 차감 1순위로 — 스캔 추적(JOB_MATERIAL_LOTS)과 실제 차감 LOT 일치
    const candidateLots = scannedMatUids.size > 0
      ? [
          ...fifoLots.filter((l) => scannedMatUids.has(l.matUid)),
          ...fifoLots.filter((l) => !scannedMatUids.has(l.matUid)),
        ]
      : fifoLots;
    for (const lot of candidateLots) {
      this.assertSameTenant('자동차감 LOT', tenant, lot);
    }

    const candidateMatUids = candidateLots.map((l) => l.matUid);
    const allStocks = candidateMatUids.length > 0
      ? await qr.manager.find(MatStock, { where: { matUid: In(candidateMatUids), ...tenantWhere } })
      : [];
    for (const stock of allStocks) {
      this.assertSameTenant('자동차감 재고', tenant, stock);
    }

    // matUid별 재고수량 합산 Map
    const stockQtyByMatUid = new Map<string, number>();
    for (const s of allStocks) {
      stockQtyByMatUid.set(s.matUid, (stockQtyByMatUid.get(s.matUid) ?? 0) + s.qty);
    }

    const lotsWithStock: { lot: MatLot; stockQty: number }[] = [];
    for (const lot of candidateLots) {
      const totalStockQty = stockQtyByMatUid.get(lot.matUid) ?? 0;
      if (totalStockQty > 0) {
        lotsWithStock.push({ lot, stockQty: totalStockQty });
      }
    }

    const totalAvailable = lotsWithStock.reduce((sum, ls) => sum + ls.stockQty, 0);

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

    for (const { lot, stockQty } of lotsWithStock) {
      if (remaining <= 0) break;

      const issueQty = Math.min(remaining, stockQty);
      remaining -= issueQty;

      /* (a) MatIssue 생성 */
      const issueNo = await this.numbering.nextInTx(qr, 'MAT_ISSUE');
      const issueEntity = qr.manager.create(MatIssue, {
        issueNo,
        seq: 1,
        orderNo,
        prodResultNo,
        matUid: lot.matUid,
        issueQty,
        issueType: 'PROD_AUTO',
        status: 'DONE',
        company: lot.company,
        plant: lot.plant,
      });
      await qr.manager.save(MatIssue, issueEntity);

      /* (b) MatStock 차감 — LOT의 모든 창고에서 차감(원자재창고). 창고별 차감 내역 확보 */
      const deductions = await this.deductMatStock(qr, itemCode, lot.matUid, issueQty, tenant);

      /* (c) StockTransaction 생성 — 창고별로 FROM_WAREHOUSE_ID를 기록해야
       *     실적 취소(reverseAutoIssue) 시 원 창고로 재고 복원이 가능하다.
       *     설비 미배정 fallback 소비이므로 transType은 MAT_OUT. */
      for (const deduction of deductions) {
        const transNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
        const txEntity = qr.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_OUT',
          fromWarehouseId: deduction.warehouseCode,
          toWarehouseId: null,
          itemCode,
          matUid: lot.matUid,
          qty: -deduction.qty,
          refType: 'MAT_ISSUE',
          refId: `${issueNo}-1`,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
        });
        await qr.manager.save(StockTransaction, txEntity);
      }

      /* (d) MatStock.qty 합산 → 0이면 MatLot DEPLETED 처리. */
      const remainingStocks = await qr.manager.find(MatStock, {
        where: { matUid: lot.matUid, ...tenantWhere },
      });
      const remainingStockQty = remainingStocks.reduce((s, st) => s + st.qty, 0);
      if (remainingStockQty <= 0) {
        await qr.manager.update(MatLot, { matUid: lot.matUid, ...tenantWhere }, { status: 'DEPLETED' });
      }

      issued.push({ matUid: lot.matUid, itemCode, issueQty });
    }

    return issued;
  }

  /* ================================================================
   *  [공용] 단일 지정 LOT(matUid) 원자재창고 차감.
   *  - 서브공정 키팅 등 "스캔한 특정 LOT를 그대로 차감"하는 호출부에서 재사용.
   *  - issueFifo와 동일한 저수준 경로(MatIssue + deductMatStock + MAT_OUT StockTransaction
   *    + DEPLETED 처리)를 사용하되, FIFO 전개 없이 호출부가 지정한 LOT 1건만 차감한다.
   *  - 재고 부족/LOT 미존재면 BadRequest(트랜잭션 롤백 유도).
   *  @returns 실제 차감 수량
   * ================================================================ */
  async consumeMatLotInTx(
    qr: QueryRunner,
    p: {
      matUid: string;
      itemCode: string;
      qty: number;
      orderNo?: string | null;
      prodResultNo: string;
      refType: string;
      refId: string;
      workerId?: string | null;
      company: string;
      plant: string;
    },
  ): Promise<{ matUid: string; itemCode: string; issueQty: number }> {
    if (p.qty <= 0) {
      throw new BadRequestException(`자재 차감 수량이 올바르지 않습니다: ${p.qty}`);
    }
    const tenant: TenantContext = { company: p.company, plant: p.plant };
    const tenantWhere = this.tenantWhere(tenant);

    /* 지정 LOT 존재/품목/테넌트 검증 */
    const lot = await qr.manager.findOne(MatLot, {
      where: { matUid: p.matUid, ...tenantWhere },
    });
    if (!lot) {
      throw new BadRequestException(`자재 LOT를 찾을 수 없습니다: ${p.matUid}`);
    }
    this.assertSameTenant('키팅 LOT', tenant, lot);
    if (lot.itemCode !== p.itemCode) {
      throw new BadRequestException(
        `LOT 품목 불일치: matUid=${p.matUid} expected=${p.itemCode} actual=${lot.itemCode}`,
      );
    }

    /* 가용 재고 합산 */
    const stocks = await qr.manager.find(MatStock, {
      where: { itemCode: p.itemCode, matUid: p.matUid, ...tenantWhere },
    });
    const available = stocks.reduce((sum, s) => sum + (s.qty ?? 0), 0);
    if (available < p.qty) {
      throw new BadRequestException(
        `재고 부족 — LOT ${p.matUid}(${p.itemCode}): 필요 ${p.qty}, 가용 ${available}`,
      );
    }

    /* (a) MatIssue */
    const issueNo = await this.numbering.nextInTx(qr, 'MAT_ISSUE');
    await qr.manager.save(
      MatIssue,
      qr.manager.create(MatIssue, {
        issueNo,
        seq: 1,
        orderNo: p.orderNo ?? null,
        prodResultNo: p.prodResultNo,
        matUid: p.matUid,
        issueQty: p.qty,
        issueType: 'PROD_AUTO',
        status: 'DONE',
        workerId: p.workerId ?? null,
        company: lot.company,
        plant: lot.plant,
      }),
    );

    /* (b) MatStock 차감(창고별) */
    const deductions = await this.deductMatStock(qr, p.itemCode, p.matUid, p.qty, tenant);

    /* (c) 창고별 MAT_OUT StockTransaction (취소 복원용 FROM_WAREHOUSE_ID 기록) */
    for (const deduction of deductions) {
      const transNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
      await qr.manager.save(
        StockTransaction,
        qr.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_OUT',
          fromWarehouseId: deduction.warehouseCode,
          toWarehouseId: null,
          itemCode: p.itemCode,
          matUid: p.matUid,
          qty: -deduction.qty,
          refType: p.refType,
          refId: p.refId,
          workerId: p.workerId ?? null,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
        }),
      );
    }

    /* (d) 잔량 0이면 LOT DEPLETED */
    const remainingStocks = await qr.manager.find(MatStock, {
      where: { matUid: p.matUid, ...tenantWhere },
    });
    const remainingStockQty = remainingStocks.reduce((s, st) => s + (st.qty ?? 0), 0);
    if (remainingStockQty <= 0) {
      await qr.manager.update(MatLot, { matUid: p.matUid, ...tenantWhere }, { status: 'DEPLETED' });
    }

    return { matUid: p.matUid, itemCode: p.itemCode, issueQty: p.qty };
  }

  /* ================================================================
   *  MatStock 차감 — LOT 기준 모든 창고에서 차감, 창고별 차감 내역 반환
   * ================================================================ */
  private async deductMatStock(
    qr: QueryRunner,
    itemCode: string,
    matUid: string,
    totalDeduct: number,
    tenant: TenantContext,
  ): Promise<{ warehouseCode: string; qty: number }[]> {
    const tenantWhere = this.tenantWhere(tenant);
    const stocks = await qr.manager.find(MatStock, {
      where: { itemCode, matUid, ...tenantWhere },
      order: { createdAt: 'ASC' },
    });
    for (const stock of stocks) {
      this.assertSameTenant('자동차감 차감 재고', tenant, stock);
    }

    const deductions: { warehouseCode: string; qty: number }[] = [];
    let remaining = totalDeduct;
    for (const stock of stocks) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, stock.qty);
      if (deduct <= 0) continue;
      remaining -= deduct;

      await qr.manager.update(
        MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid, ...tenantWhere },
        {
          qty: stock.qty - deduct,
          availableQty: Math.max(0, stock.availableQty - deduct),
        },
      );
      deductions.push({ warehouseCode: stock.warehouseCode, qty: deduct });
    }
    return deductions;
  }
}
