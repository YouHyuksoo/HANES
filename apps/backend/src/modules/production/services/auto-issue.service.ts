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
import { RoutingMaterial } from '../../../entities/routing-material.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
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
    processCode?: string | null,
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
      await this.executeInTransaction(externalQR, result, prodResultNo, orderNo, qty, processCode);
    } else {
      await this.tx.run((qr) => this.executeInTransaction(qr, result, prodResultNo, orderNo, qty, processCode));
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
    processCode?: string | null,
  ): Promise<void> {
    /* ── 3. 작업지시 → itemCode 조회 ──────────────── */
    const jobOrder = await qr.manager.findOne(JobOrder, {
      where: { orderNo },
    });
    if (!jobOrder) {
      throw new BadRequestException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }
    const tenant: TenantContext = { company: jobOrder.company, plant: jobOrder.plant };

    /* ── 4. BOM 조회 (작업지시 계획일 기준 유효 기간 & useYn) ──────────── */
    const bomEffectiveDate = this.resolveBomEffectiveDate(jobOrder);
    const fullBomList = await this.findValidBom(qr, jobOrder.itemCode, bomEffectiveDate, tenant);
    if (fullBomList.length === 0) {
      this.logger.warn(`BOM 없음 — itemCode: ${jobOrder.itemCode}`);
      result.skipped = true;
      return;
    }

    /* ── 4-1. 공정별 자재 차감 필터 (ROUTING_MATERIALS 배정 기반) ───────────
     * 라우팅에 ROUTING_MATERIALS 배정이 있으면: 현재 공정(processCode→seq)에 배정된 자재만 차감.
     * 배정이 없으면(미전환 라우팅): 기존대로 BOM 전체 일괄 차감. (점진 전환)
     * 차감량은 BOM.qtyPer 유지 — ROUTING_MATERIALS는 "어느 공정에서 차감할지" 필터 역할만. */
    let bomList = fullBomList;
    if (processCode && jobOrder.routingCode) {
      const routingMaterials = await qr.manager.find(RoutingMaterial, {
        where: { routingCode: jobOrder.routingCode, useYn: 'Y', ...this.tenantWhere(tenant) },
      });
      if (routingMaterials.length > 0) {
        const step = await qr.manager.findOne(RoutingProcess, {
          where: { routingCode: jobOrder.routingCode, processCode, ...this.tenantWhere(tenant) },
        });
        const assignedItems = new Set(
          routingMaterials.filter((rm) => rm.seq === step?.seq).map((rm) => rm.childItemCode),
        );
        bomList = fullBomList.filter((b) => assignedItems.has(b.childItemCode));
        this.logger.log(
          `공정별 자재 차감 — orderNo=${orderNo}, 공정=${processCode}(seq=${step?.seq}): ${bomList.length}/${fullBomList.length}건 대상`,
        );
        if (bomList.length === 0) {
          // 이 공정에 배정된 자재가 없음 — 정상(다른 공정에서 소비). 차감 없이 종료.
          result.skipped = true;
          return;
        }
      }
    }

    /* ── 5. 재고 부족 정책 조회 ───────────────────── */
    const stockCheckPolicy =
      (await this.sysConfigService.getValue('MAT_ISSUE_STOCK_CHECK')) ?? 'BLOCK';

    /* ── 5-1. 키오스크에서 스캔한 작업지시 자재 LOT (차감 우선순위 1순위) ── */
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

    /* ── 5-2. 소비 모델: 차감은 설비에 장착된 공정재고(WIP_MAT_STOCKS)에서만 한다.
     * 설비 미배정이면 예외 경로 배제(ADR 0002) — 원자재창고 우회 차감 없이 오류로 드러낸다. */
    const equipCode = jobOrder.equipCode;
    if (!equipCode) {
      throw new BadRequestException(
        `설비가 배정되지 않아 자재를 차감할 수 없습니다 — 차감은 장착된 설비 공정재고에서만 가능합니다. ` +
        `orderNo=${orderNo}, processCode=${processCode ?? '-'}`,
      );
    }

    /* ── 6. 자식 품목별 차감 (스캔 LOT 우선) ── */
    for (const bom of bomList) {
      const requiredQty = Number(bom.qtyPer) * qty;
      if (requiredQty <= 0) continue;

      /* 공정재고(설비 장착분, WIP_MAT_STOCKS) 소비 — WipMatStockService에 위임.
       * WIP_MAT_TRANSACTIONS(PROD_CONSUME) 기록 + 스캔 LOT 우선 + 부족정책 처리는 서비스 내부 책임.
       * 원자재재고(MAT_STOCKS)는 일절 건드리지 않는다. 장착된 재고가 부족하면 서비스가 오류로 막는다. */
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
    }
  }

  /* ================================================================
   *  BOM 유효건 조회
   * ================================================================ */
  private async findValidBom(
    qr: QueryRunner,
    parentItemCode: string,
    effectiveDate: Date,
    tenant: TenantContext,
  ): Promise<BomComponentRow[]> {
    const dateStr = this.formatDateOnly(effectiveDate);
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
          AND b.VALID_FROM <= TO_DATE(:2, 'YYYY-MM-DD')
          AND b.VALID_TO   >= TO_DATE(:3, 'YYYY-MM-DD')
${tenantSql}
        ORDER BY b.SEQ ASC`,
      params,
    );
    return rows;
  }

  private resolveBomEffectiveDate(jobOrder: JobOrder): Date {
    if (!jobOrder.planDate) {
      throw new BadRequestException(
        `작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }

    const date = new Date(jobOrder.planDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `작업지시 계획일이 올바르지 않아 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
