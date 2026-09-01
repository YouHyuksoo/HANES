/**
 * @file src/modules/monitoring/services/inventory-board.service.ts
 * @description 재고 모니터링 보드 집계 서비스 — "조치가 필요한 재고"만 보여준다.
 *              품목 단위가 제각각인 총수량 합계는 무의미하므로 집계하지 않는다.
 *
 * 구성:
 * 1. 안전재고 미달 (ITEM_MASTERS.SAFETY_STOCK 대비 부족 → 발주/보충 필요)
 * 2. 유효기한 초과/임박 LOT (MAT_LOTS.EXPIRE_DATE, 30일 이내 → 우선 소진/폐기)
 * 3. 보류/불량 재고 (MAT_LOTS HOLD·IQC FAIL + PRODUCT_STOCKS DEFECT/HOLD → 처리 필요)
 * 4. 금일 입출고 건수 (STOCK_TRANSACTIONS, 수량 합계가 아닌 건수만)
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';

/** 유효기한 임박 기준일 */
const NEAR_EXPIRY_DAYS = 30;

interface ShortageRaw {
  itemCode: string;
  itemName: string | null;
  qty: string | number;
  safetyStock: string | number;
}

interface ExpiryRaw {
  matUid: string;
  itemCode: string;
  itemName: string | null;
  qty: string | number;
  expireDate: string;
  daysLeft: string | number;
}

interface HoldLotRaw {
  matUid: string;
  itemCode: string;
  itemName: string | null;
  qty: string | number;
  lotStatus: string;
  iqcStatus: string;
}

interface HoldProductRaw {
  itemCode: string;
  itemName: string | null;
  qty: string | number;
  qualityStatus: string;
  stockStatus: string;
}

interface InOutRaw {
  inCount: string | number;
  outCount: string | number;
}

@Injectable()
export class InventoryBoardService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ProductStock)
    private readonly productStockRepository: Repository<ProductStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepository: Repository<StockTransaction>,
  ) {}

  async getBoard(company?: string, plant?: string) {
    const [shortages, expiry, holds, todayInOut] = await Promise.all([
      this.getShortages(company, plant),
      this.getExpiryLots(company, plant),
      this.getHoldStocks(company, plant),
      this.getTodayInOut(company, plant),
    ]);

    return {
      kpi: {
        shortageCount: shortages.length,
        expiredCount: expiry.filter((e) => e.daysLeft < 0).length,
        nearExpiryCount: expiry.filter((e) => e.daysLeft >= 0).length,
        holdCount: holds.length,
        inCount: todayInOut.inCount,
        outCount: todayInOut.outCount,
      },
      shortages,
      expiry,
      holds,
    };
  }

  /** 안전재고 미달 자재 (SAFETY_STOCK > 0 품목만) — 부족량 큰 순 */
  private async getShortages(company?: string, plant?: string) {
    const joinConds = [
      'im.ITEM_CODE = ms.ITEM_CODE',
      'im.COMPANY = ms.COMPANY',
      'im.PLANT_CD = ms.PLANT_CD',
    ];
    const qb = this.matStockRepository
      .createQueryBuilder('ms')
      .innerJoin(ItemMaster, 'im', joinConds.join(' AND '))
      .select([
        'ms.itemCode AS "itemCode"',
        'MAX(im.ITEM_NAME) AS "itemName"',
        'SUM(ms.qty) AS "qty"',
        'MAX(im.SAFETY_STOCK) AS "safetyStock"',
      ])
      .where('im.SAFETY_STOCK > 0')
      .groupBy('ms.itemCode')
      .having('SUM(ms.qty) < MAX(im.SAFETY_STOCK)')
      .orderBy('MAX(im.SAFETY_STOCK) - SUM(ms.qty)', 'DESC');

    if (company) qb.andWhere('ms.company = :company', { company });
    if (plant) qb.andWhere('ms.plant = :plant', { plant });

    const rows = await qb.getRawMany<ShortageRaw>();
    return rows.map((r) => {
      const qty = Number(r.qty ?? 0);
      const safetyStock = Number(r.safetyStock ?? 0);
      return {
        itemCode: r.itemCode,
        itemName: r.itemName ?? null,
        qty,
        safetyStock,
        shortage: safetyStock - qty,
      };
    });
  }

  /** 유효기한 초과 + 임박(NEAR_EXPIRY_DAYS 이내) LOT — 잔량 있는 것만, 기한 빠른 순 */
  private async getExpiryLots(company?: string, plant?: string) {
    const joinConds = [
      'im.ITEM_CODE = ml.ITEM_CODE',
      'im.COMPANY = ml.COMPANY',
      'im.PLANT_CD = ml.PLANT_CD',
    ];
    const qb = this.matLotRepository
      .createQueryBuilder('ml')
      .leftJoin(ItemMaster, 'im', joinConds.join(' AND '))
      .select([
        'ml.matUid AS "matUid"',
        'ml.itemCode AS "itemCode"',
        'im.ITEM_NAME AS "itemName"',
        'ml.currentQty AS "qty"',
        "TO_CHAR(ml.expireDate, 'YYYY-MM-DD') AS \"expireDate\"",
        'TRUNC(ml.expireDate) - TRUNC(SYSDATE) AS "daysLeft"',
      ])
      .where('ml.currentQty > 0')
      .andWhere('ml.expireDate IS NOT NULL')
      .andWhere(`ml.expireDate < TRUNC(SYSDATE) + ${NEAR_EXPIRY_DAYS + 1}`)
      .andWhere("ml.status NOT IN ('DEPLETED', 'SPLIT', 'MERGED')")
      .orderBy('ml.expireDate', 'ASC')
      .limit(30);

    if (company) qb.andWhere('ml.company = :company', { company });
    if (plant) qb.andWhere('ml.plant = :plant', { plant });

    const rows = await qb.getRawMany<ExpiryRaw>();
    return rows.map((r) => ({
      matUid: r.matUid,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      qty: Number(r.qty ?? 0),
      expireDate: r.expireDate,
      daysLeft: Number(r.daysLeft ?? 0),
    }));
  }

  /** 보류/불량 재고 — 자재 LOT(HOLD·IQC FAIL/HOLD) + 제품(DEFECT/HOLD) 통합 목록 */
  private async getHoldStocks(company?: string, plant?: string) {
    const lotJoin = [
      'im.ITEM_CODE = ml.ITEM_CODE',
      'im.COMPANY = ml.COMPANY',
      'im.PLANT_CD = ml.PLANT_CD',
    ];
    const lotQb = this.matLotRepository
      .createQueryBuilder('ml')
      .leftJoin(ItemMaster, 'im', lotJoin.join(' AND '))
      .select([
        'ml.matUid AS "matUid"',
        'ml.itemCode AS "itemCode"',
        'im.ITEM_NAME AS "itemName"',
        'ml.currentQty AS "qty"',
        'ml.status AS "lotStatus"',
        'ml.iqcStatus AS "iqcStatus"',
      ])
      .where('ml.currentQty > 0')
      .andWhere("(ml.status = 'HOLD' OR ml.iqcStatus IN ('FAIL', 'HOLD'))")
      .orderBy('ml.currentQty', 'DESC')
      .limit(20);

    if (company) lotQb.andWhere('ml.company = :company', { company });
    if (plant) lotQb.andWhere('ml.plant = :plant', { plant });

    const prodJoin = [
      'im.ITEM_CODE = ps.ITEM_CODE',
      'im.COMPANY = ps.COMPANY',
      'im.PLANT_CD = ps.PLANT_CD',
    ];
    const prodQb = this.productStockRepository
      .createQueryBuilder('ps')
      .leftJoin(ItemMaster, 'im', prodJoin.join(' AND '))
      .select([
        'ps.itemCode AS "itemCode"',
        'MAX(im.ITEM_NAME) AS "itemName"',
        'SUM(ps.qty) AS "qty"',
        'ps.qualityStatus AS "qualityStatus"',
        'ps.status AS "stockStatus"',
      ])
      .where('ps.qty > 0')
      .andWhere("(ps.qualityStatus = 'DEFECT' OR ps.status = 'HOLD')")
      .groupBy('ps.itemCode')
      .addGroupBy('ps.qualityStatus')
      .addGroupBy('ps.status')
      .orderBy('SUM(ps.qty)', 'DESC');

    if (company) prodQb.andWhere('ps.company = :company', { company });
    if (plant) prodQb.andWhere('ps.plant = :plant', { plant });

    const [lots, products] = await Promise.all([
      lotQb.getRawMany<HoldLotRaw>(),
      prodQb.getRawMany<HoldProductRaw>(),
    ]);

    const lotItems = lots.map((r) => ({
      kind: 'MATERIAL' as const,
      ref: r.matUid,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      qty: Number(r.qty ?? 0),
      reason: r.lotStatus === 'HOLD' ? 'HOLD' : `IQC_${r.iqcStatus}`,
    }));
    const productItems = products.map((r) => ({
      kind: 'PRODUCT' as const,
      ref: r.itemCode,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      qty: Number(r.qty ?? 0),
      reason: r.qualityStatus === 'DEFECT' ? 'DEFECT' : 'HOLD',
    }));

    return [...lotItems, ...productItems].sort((a, b) => b.qty - a.qty);
  }

  /** 금일 입출고 건수 — TRANS_TYPE 접미사 기반 조건부 집계 1쿼리 (수량 합계는 무의미하므로 건수만) */
  private async getTodayInOut(company?: string, plant?: string) {
    const inCond = "tx.transType LIKE '%\\_IN' ESCAPE '\\'";
    const outCond = "(tx.transType LIKE '%\\_OUT' ESCAPE '\\' OR tx.transType = 'PROD_CONSUME')";
    const qb = this.stockTxRepository
      .createQueryBuilder('tx')
      .select([
        `SUM(CASE WHEN ${inCond} THEN 1 ELSE 0 END) AS "inCount"`,
        `SUM(CASE WHEN ${outCond} THEN 1 ELSE 0 END) AS "outCount"`,
      ])
      .where('tx.transDate >= TRUNC(SYSDATE)')
      .andWhere('tx.transDate < TRUNC(SYSDATE) + 1');

    if (company) qb.andWhere('tx.company = :company', { company });
    if (plant) qb.andWhere('tx.plant = :plant', { plant });

    const row = await qb.getRawOne<InOutRaw>();
    return {
      inCount: Number(row?.inCount ?? 0),
      outCount: Number(row?.outCount ?? 0),
    };
  }
}
