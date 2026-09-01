/**
 * @file src/modules/monitoring/services/inventory-board.service.ts
 * @description 재고 모니터링 보드 집계 서비스 — 유형별 KPI/안전재고 미달/창고별 분포/금일 입출고
 *
 * 초보자 가이드:
 * 1. 자재 = MAT_STOCKS, 반제품·완제품 = PRODUCT_STOCKS(GOOD 만) — 테이블이 분리되어 있다
 * 2. 안전재고 미달 = ITEM_MASTERS.SAFETY_STOCK > 0 인 품목의 SUM(QTY) < SAFETY_STOCK
 * 3. 금일 입출고 = STOCK_TRANSACTIONS 의 TRANS_TYPE 접미사(_IN/_OUT) + PROD_CONSUME(출고성)
 *    LIKE 의 '_' 는 와일드카드이므로 ESCAPE 처리 필수
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';

interface SumRaw {
  qty: string | number;
  items: string | number;
}

interface ProductKpiRaw {
  itemType: string;
  qty: string | number;
  items: string | number;
}

interface ShortageRaw {
  itemCode: string;
  itemName: string | null;
  qty: string | number;
  safetyStock: string | number;
}

interface WarehouseRaw {
  warehouseCode: string;
  itemCount: string | number;
  qty: string | number;
}

interface InOutRaw {
  inCount: string | number;
  inQty: string | number;
  outCount: string | number;
  outQty: string | number;
}

@Injectable()
export class InventoryBoardService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(ProductStock)
    private readonly productStockRepository: Repository<ProductStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepository: Repository<StockTransaction>,
  ) {}

  async getBoard(company?: string, plant?: string) {
    const [material, product, shortages, matWarehouse, prodWarehouse, todayInOut] =
      await Promise.all([
        this.getMaterialKpi(company, plant),
        this.getProductKpi(company, plant),
        this.getShortages(company, plant),
        this.getMatByWarehouse(company, plant),
        this.getProductByWarehouse(company, plant),
        this.getTodayInOut(company, plant),
      ]);

    const semi = product.find((p) => p.itemType === 'SEMI_PRODUCT');
    const finished = product.find((p) => p.itemType === 'FINISHED');

    return {
      kpi: {
        materialQty: material.qty,
        materialItems: material.items,
        semiQty: semi?.qty ?? 0,
        semiItems: semi?.items ?? 0,
        finishedQty: finished?.qty ?? 0,
        finishedItems: finished?.items ?? 0,
      },
      shortages,
      byWarehouse: [
        ...matWarehouse.map((w) => ({ ...w, stockKind: 'MATERIAL' as const })),
        ...prodWarehouse.map((w) => ({ ...w, stockKind: 'PRODUCT' as const })),
      ],
      todayInOut,
    };
  }

  private async getMaterialKpi(company?: string, plant?: string) {
    const qb = this.matStockRepository
      .createQueryBuilder('ms')
      .select(['SUM(ms.qty) AS "qty"', 'COUNT(DISTINCT ms.itemCode) AS "items"']);
    if (company) qb.andWhere('ms.company = :company', { company });
    if (plant) qb.andWhere('ms.plant = :plant', { plant });

    const row = await qb.getRawOne<SumRaw>();
    return { qty: Number(row?.qty ?? 0), items: Number(row?.items ?? 0) };
  }

  private async getProductKpi(company?: string, plant?: string) {
    const qb = this.productStockRepository
      .createQueryBuilder('ps')
      .select([
        'ps.itemType AS "itemType"',
        'SUM(ps.qty) AS "qty"',
        'COUNT(DISTINCT ps.itemCode) AS "items"',
      ])
      .where("ps.qualityStatus = 'GOOD'")
      .groupBy('ps.itemType');
    if (company) qb.andWhere('ps.company = :company', { company });
    if (plant) qb.andWhere('ps.plant = :plant', { plant });

    const rows = await qb.getRawMany<ProductKpiRaw>();
    return rows.map((r) => ({
      itemType: r.itemType,
      qty: Number(r.qty ?? 0),
      items: Number(r.items ?? 0),
    }));
  }

  /** 안전재고 미달 자재 (SAFETY_STOCK > 0 품목만) */
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

  private async getMatByWarehouse(company?: string, plant?: string) {
    const qb = this.matStockRepository
      .createQueryBuilder('ms')
      .select([
        'ms.warehouseCode AS "warehouseCode"',
        'COUNT(DISTINCT ms.itemCode) AS "itemCount"',
        'SUM(ms.qty) AS "qty"',
      ])
      .groupBy('ms.warehouseCode')
      .orderBy('"qty"', 'DESC');
    if (company) qb.andWhere('ms.company = :company', { company });
    if (plant) qb.andWhere('ms.plant = :plant', { plant });

    const rows = await qb.getRawMany<WarehouseRaw>();
    return rows.map((r) => ({
      warehouseCode: r.warehouseCode,
      itemCount: Number(r.itemCount ?? 0),
      qty: Number(r.qty ?? 0),
    }));
  }

  private async getProductByWarehouse(company?: string, plant?: string) {
    const qb = this.productStockRepository
      .createQueryBuilder('ps')
      .select([
        'ps.warehouseCode AS "warehouseCode"',
        'COUNT(DISTINCT ps.itemCode) AS "itemCount"',
        'SUM(ps.qty) AS "qty"',
      ])
      .where("ps.qualityStatus = 'GOOD'")
      .groupBy('ps.warehouseCode')
      .orderBy('"qty"', 'DESC');
    if (company) qb.andWhere('ps.company = :company', { company });
    if (plant) qb.andWhere('ps.plant = :plant', { plant });

    const rows = await qb.getRawMany<WarehouseRaw>();
    return rows.map((r) => ({
      warehouseCode: r.warehouseCode,
      itemCount: Number(r.itemCount ?? 0),
      qty: Number(r.qty ?? 0),
    }));
  }

  /** 금일 입출고 — TRANS_TYPE 접미사 기반 조건부 집계 1쿼리 */
  private async getTodayInOut(company?: string, plant?: string) {
    const inCond = "tx.transType LIKE '%\\_IN' ESCAPE '\\'";
    const outCond = "(tx.transType LIKE '%\\_OUT' ESCAPE '\\' OR tx.transType = 'PROD_CONSUME')";
    const qb = this.stockTxRepository
      .createQueryBuilder('tx')
      .select([
        `SUM(CASE WHEN ${inCond} THEN 1 ELSE 0 END) AS "inCount"`,
        `SUM(CASE WHEN ${inCond} THEN tx.qty ELSE 0 END) AS "inQty"`,
        `SUM(CASE WHEN ${outCond} THEN 1 ELSE 0 END) AS "outCount"`,
        `SUM(CASE WHEN ${outCond} THEN tx.qty ELSE 0 END) AS "outQty"`,
      ])
      .where('tx.transDate >= TRUNC(SYSDATE)')
      .andWhere('tx.transDate < TRUNC(SYSDATE) + 1');

    if (company) qb.andWhere('tx.company = :company', { company });
    if (plant) qb.andWhere('tx.plant = :plant', { plant });

    const row = await qb.getRawOne<InOutRaw>();
    return {
      inCount: Number(row?.inCount ?? 0),
      inQty: Number(row?.inQty ?? 0),
      outCount: Number(row?.outCount ?? 0),
      outQty: Number(row?.outQty ?? 0),
    };
  }
}
