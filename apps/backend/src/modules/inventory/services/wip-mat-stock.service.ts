/**
 * @file src/modules/inventory/services/wip-mat-stock.service.ts
 * @description 공정재고 단일 책임 서비스 - WIP_MAT_STOCKS / WIP_MAT_TRANSACTIONS 전담
 *
 * 초보자 가이드:
 * - 설비(EQUIP_CODE) 단위 공정재고의 가산/차감/복원/조회를 모두 이 서비스로 일원화한다.
 * - 원자재재고(MAT_STOCKS)·원자재 수불(STOCK_TRANSACTIONS)과 완전 분리.
 * - 모든 변경 메서드는 외부 트랜잭션(QueryRunner)을 받아 그 안에서 동작한다(결번 없는 채번).
 * - 채번은 NumberingService.nextInTx(qr, 'WIP_TX') 사용 → WTXYYMMDD-NNNNN.
 *
 * 호출부(다음 Task):
 * - R3 mat-issue 출고이동: addStockInTx(transType:'WIP_IN', refType:'MAT_ISSUE')
 * - R4 mat-issue 이동취소: restoreInTx(mode:'DEDUCT_BACK', cancelTransType:'WIP_IN_CANCEL')
 * - R5 auto-issue 소비:    deductStockInTx(transType:'PROD_CONSUME', refType:'PROD_RESULT')
 * - R6 소비취소:           restoreInTx(mode:'ADD_BACK', cancelTransType:'PROD_CONSUME_CANCEL')
 * - R9 조회:               findByEquip(equipCode?, company, plant, search?)
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, EntityManager } from 'typeorm';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { WipMatTransaction } from '../../../entities/wip-mat-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';

/** 공정재고 가산 파라미터 */
export interface AddWipStockParams {
  equipCode: string;
  itemCode: string;
  matUid: string;
  qty: number;
  transType: string; // 'WIP_IN' 등
  fromWarehouseId?: string | null;
  orderNo?: string | null;
  refType: string;
  refId: string;
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
}

/** 공정재고 차감 파라미터 */
export interface DeductWipStockParams {
  equipCode: string;
  itemCode: string;
  qty: number;
  transType: string; // 'PROD_CONSUME' 등
  refType: string;
  refId: string;
  orderNo?: string | null;
  /** 스캔/지정 LOT 우선 차감 */
  scannedMatUids?: string[];
  /** 가용 부족 시 정책: BLOCK(예외) | WARN(가용분만+경고) */
  stockPolicy: 'BLOCK' | 'WARN';
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
  /** WARN 정책일 때 경고 메시지를 누적할 배열(호출부 제공) */
  warnings?: string[];
}

/** 차감 결과 LOT 단위 */
export interface DeductedLot {
  matUid: string;
  qty: number;
}

/** 취소 복원 파라미터 — 원본 거래(refType/refId)를 찾아 대칭 복원 */
export interface RestoreWipStockParams {
  /** ADD_BACK: 공정재고 가산(소비취소) / DEDUCT_BACK: 공정재고 차감(출고취소) */
  mode: 'ADD_BACK' | 'DEDUCT_BACK';
  refType: string;
  refId: string;
  /** 복원 거래 유형 (예: 'WIP_IN_CANCEL', 'PROD_CONSUME_CANCEL') */
  cancelTransType: string;
  /** 복원 대상 원본 거래유형(미지정 시 *_CANCEL 이 아닌 모든 원본 사용) */
  originTransType?: string;
  orderNo?: string | null;
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
}

/** 복원 결과 LOT 단위 */
export interface RestoredLot {
  matUid: string;
  qty: number;
  cancelRefId: string;
}

/** findByEquip 조회 결과 행 (설비+품목 집계) */
export interface WipStockRow {
  equipCode: string;
  equipName: string | null;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  availableQty: number;
  reservedQty: number;
  lotCount: number;
}

/** findTransactions 조회 파라미터 */
export interface WipTransactionQuery {
  equipCode?: string;
  itemCode?: string;
  search?: string;
  transType?: string;
  fromDate?: string;
  toDate?: string;
}

/** findTransactions 조회 결과 행 */
export interface WipTransactionRow {
  transNo: string;
  transType: string;
  equipCode: string;
  equipName: string | null;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  fromWarehouseId: string | null;
  orderNo: string | null;
  refType: string | null;
  refId: string | null;
  cancelRefId: string | null;
  status: string;
  remark: string | null;
  workerId: string | null;
  createdAt: Date | null;
}

@Injectable()
export class WipMatStockService {
  private readonly logger = new Logger(WipMatStockService.name);

  constructor(
    @InjectRepository(WipMatStock)
    private readonly wipStockRepo: Repository<WipMatStock>,
    @InjectRepository(WipMatTransaction)
    private readonly wipTxRepo: Repository<WipMatTransaction>,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * 공정재고 가산 (출고이동·복원 가산 공용).
   * - WIP_MAT_STOCKS 복합키 upsert: 없으면 생성(reservedQty=0), 있으면 qty/availableQty += qty.
   * - WIP_MAT_TRANSACTIONS 1건(+qty) 기록.
   */
  async addStockInTx(qr: QueryRunner, p: AddWipStockParams): Promise<void> {
    if (p.qty <= 0) {
      throw new BadRequestException(`공정재고 가산 수량이 올바르지 않습니다: ${p.qty}`);
    }
    const manager = qr.manager;
    await this.upsertAdd(manager, {
      company: p.company, plant: p.plant, equipCode: p.equipCode,
      itemCode: p.itemCode, matUid: p.matUid, addQty: p.qty,
    });

    const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
    await manager.save(
      WipMatTransaction,
      manager.create(WipMatTransaction, {
        transNo,
        transType: p.transType,
        equipCode: p.equipCode,
        itemCode: p.itemCode,
        matUid: p.matUid,
        qty: p.qty,
        fromWarehouseId: p.fromWarehouseId ?? null,
        orderNo: p.orderNo ?? null,
        refType: p.refType,
        refId: p.refId,
        cancelRefId: null,
        status: 'DONE',
        remark: p.remark ?? null,
        workerId: p.workerId ?? null,
        company: p.company,
        plant: p.plant,
      }),
    );
  }

  /**
   * 공정재고 차감 (생산소비).
   * - (company,plant,equipCode,itemCode)의 WIP_MAT_STOCKS 행을 FIFO(matUid/createdAt) 차감.
   *   scannedMatUids 지정 시 해당 LOT 우선.
   * - 가용 부족: BLOCK → 예외 / WARN → 가용분만 차감 + warnings 누적.
   * - LOT 차감마다 WIP_MAT_TRANSACTIONS(-deductQty) 기록.
   * @returns 실제 차감된 LOT/수량 목록
   */
  async deductStockInTx(qr: QueryRunner, p: DeductWipStockParams): Promise<DeductedLot[]> {
    if (p.qty <= 0) {
      throw new BadRequestException(`공정재고 차감 수량이 올바르지 않습니다: ${p.qty}`);
    }
    const manager = qr.manager;
    const rows = await manager.find(WipMatStock, {
      where: {
        company: p.company, plant: p.plant,
        equipCode: p.equipCode, itemCode: p.itemCode,
      },
    });

    const ordered = this.orderLotsForDeduct(rows, p.scannedMatUids);
    const totalAvailable = ordered.reduce((sum, r) => sum + (r.availableQty ?? 0), 0);

    if (totalAvailable < p.qty && p.stockPolicy === 'BLOCK') {
      throw new BadRequestException(
        `공정재고 부족: 자재 준비 출고 필요 (${p.itemCode})`,
      );
    }

    let remaining = p.qty;
    const deducted: DeductedLot[] = [];

    for (const row of ordered) {
      if (remaining <= 0) break;
      const avail = row.availableQty ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);

      await manager.update(
        WipMatStock,
        {
          company: p.company, plant: p.plant, equipCode: p.equipCode,
          itemCode: p.itemCode, matUid: row.matUid,
        },
        {
          qty: (row.qty ?? 0) - take,
          availableQty: avail - take,
        },
      );

      const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
      await manager.save(
        WipMatTransaction,
        manager.create(WipMatTransaction, {
          transNo,
          transType: p.transType,
          equipCode: p.equipCode,
          itemCode: p.itemCode,
          matUid: row.matUid,
          qty: -take,
          fromWarehouseId: null,
          orderNo: p.orderNo ?? null,
          refType: p.refType,
          refId: p.refId,
          cancelRefId: null,
          status: 'DONE',
          remark: p.remark ?? null,
          workerId: p.workerId ?? null,
          company: p.company,
          plant: p.plant,
        }),
      );

      deducted.push({ matUid: row.matUid, qty: take });
      remaining -= take;
    }

    if (remaining > 0 && p.stockPolicy === 'WARN') {
      const msg = `공정재고 부족(가용분만 차감): ${p.itemCode} 부족수량 ${remaining}`;
      this.logger.warn(msg);
      if (p.warnings) p.warnings.push(msg);
    }

    return deducted;
  }

  /**
   * 취소 복원 — 원본 거래(refType/refId)를 WIP_MAT_TRANSACTIONS에서 조회해 대칭 복원한다.
   * - DEDUCT_BACK(출고취소): 원본 WIP_IN(+qty)을 차감(-) + WIP_IN_CANCEL 기록.
   * - ADD_BACK(소비취소): 원본 PROD_CONSUME(-qty)을 가산(+) + PROD_CONSUME_CANCEL 기록.
   * - 각 복원 거래에 원본 transNo를 cancelRefId로 기록.
   * @returns 복원된 LOT/수량 목록
   */
  async restoreInTx(qr: QueryRunner, p: RestoreWipStockParams): Promise<RestoredLot[]> {
    const manager = qr.manager;
    const where: Record<string, unknown> = {
      company: p.company, plant: p.plant,
      refType: p.refType, refId: p.refId, status: 'DONE',
    };
    if (p.originTransType) where.transType = p.originTransType;

    const origins = await manager.find(WipMatTransaction, { where });
    if (!origins.length) {
      this.logger.warn(
        `복원 대상 공정 거래 없음: refType=${p.refType} refId=${p.refId} (복원 생략)`,
      );
      return [];
    }

    const restored: RestoredLot[] = [];
    for (const origin of origins) {
      // *_CANCEL 거래는 복원 대상에서 제외(중복 복원 방지)
      if (origin.transType.endsWith('_CANCEL')) continue;
      const absQty = Math.abs(origin.qty ?? 0);
      if (absQty <= 0) continue;

      if (p.mode === 'ADD_BACK') {
        await this.upsertAdd(manager, {
          company: p.company, plant: p.plant, equipCode: origin.equipCode,
          itemCode: origin.itemCode, matUid: origin.matUid, addQty: absQty,
        });
      } else {
        await this.deductOneLot(manager, {
          company: p.company, plant: p.plant, equipCode: origin.equipCode,
          itemCode: origin.itemCode, matUid: origin.matUid, deductQty: absQty,
        });
      }

      const signedQty = p.mode === 'ADD_BACK' ? absQty : -absQty;
      const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
      await manager.save(
        WipMatTransaction,
        manager.create(WipMatTransaction, {
          transNo,
          transType: p.cancelTransType,
          equipCode: origin.equipCode,
          itemCode: origin.itemCode,
          matUid: origin.matUid,
          qty: signedQty,
          fromWarehouseId: origin.fromWarehouseId ?? null,
          orderNo: p.orderNo ?? origin.orderNo ?? null,
          refType: p.refType,
          refId: p.refId,
          cancelRefId: origin.transNo,
          status: 'DONE',
          remark: p.remark ?? null,
          workerId: p.workerId ?? null,
          company: p.company,
          plant: p.plant,
        }),
      );

      restored.push({ matUid: origin.matUid, qty: absQty, cancelRefId: origin.transNo });
    }

    return restored;
  }

  /**
   * 공정재고 조회 — EQUIP_MASTERS 조인으로 설비명 포함.
   * - equipCode 미지정 시 전체(설비별). search는 품목/LOT/설비명 부분일치.
   */
  async findByEquip(
    equipCode: string | undefined,
    company: string,
    plant: string,
    search?: string,
  ): Promise<WipStockRow[]> {
    const qb = this.wipStockRepo
      .createQueryBuilder('s')
      .leftJoin('EQUIP_MASTERS', 'e', 'e.EQUIP_CODE = s.EQUIP_CODE AND e.COMPANY = s.COMPANY AND e.PLANT_CD = s.PLANT_CD')
      .leftJoin('ITEM_MASTERS', 'im', 'im.ITEM_CODE = s.ITEM_CODE')
      .where('s.COMPANY = :company', { company })
      .andWhere('s.PLANT_CD = :plant', { plant })
      .select('s.EQUIP_CODE', 'equipCode')
      .addSelect('e.EQUIP_NAME', 'equipName')
      .addSelect('s.ITEM_CODE', 'itemCode')
      .addSelect('im.ITEM_NAME', 'itemName')
      .addSelect('SUM(s.QTY)', 'qty')
      .addSelect('SUM(s.AVAILABLE_QTY)', 'availableQty')
      .addSelect('SUM(s.RESERVED_QTY)', 'reservedQty')
      .addSelect('COUNT(DISTINCT s.MAT_UID)', 'lotCount')
      .groupBy('s.EQUIP_CODE')
      .addGroupBy('e.EQUIP_NAME')
      .addGroupBy('s.ITEM_CODE')
      .addGroupBy('im.ITEM_NAME')
      .orderBy('s.EQUIP_CODE', 'ASC')
      .addOrderBy('s.ITEM_CODE', 'ASC');

    if (equipCode) {
      qb.andWhere('s.EQUIP_CODE = :equipCode', { equipCode });
    }
    if (search) {
      qb.andWhere(
        '(s.ITEM_CODE LIKE :kw OR im.ITEM_NAME LIKE :kw OR e.EQUIP_NAME LIKE :kw)',
        { kw: `%${search}%` },
      );
    }

    const raw = await qb.getRawMany<{
      equipCode: string; equipName: string | null; itemCode: string;
      itemName: string | null; qty: number; availableQty: number;
      reservedQty: number; lotCount: number;
    }>();

    return raw.map((r) => ({
      equipCode: r.equipCode,
      equipName: r.equipName ?? null,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      matUid: '',
      qty: Number(r.qty ?? 0),
      availableQty: Number(r.availableQty ?? 0),
      reservedQty: Number(r.reservedQty ?? 0),
      lotCount: Number(r.lotCount ?? 0),
    }));
  }

  /** 특정 설비+품목의 LOT별 재고 상세 (qty > 0인 행만) */
  async findLotsByEquipItem(
    equipCode: string,
    itemCode: string,
    company: string,
    plant: string,
  ): Promise<{ matUid: string; qty: number; availableQty: number; reservedQty: number }[]> {
    const raw = await this.wipStockRepo
      .createQueryBuilder('s')
      .where('s.COMPANY = :company', { company })
      .andWhere('s.PLANT_CD = :plant', { plant })
      .andWhere('s.EQUIP_CODE = :equipCode', { equipCode })
      .andWhere('s.ITEM_CODE = :itemCode', { itemCode })
      .andWhere('s.QTY > 0')
      .select('s.MAT_UID', 'matUid')
      .addSelect('s.QTY', 'qty')
      .addSelect('s.AVAILABLE_QTY', 'availableQty')
      .addSelect('s.RESERVED_QTY', 'reservedQty')
      .orderBy('s.MAT_UID', 'ASC')
      .getRawMany<{ matUid: string; qty: number; availableQty: number; reservedQty: number }>();

    return raw.map((r) => ({
      matUid: r.matUid,
      qty: Number(r.qty ?? 0),
      availableQty: Number(r.availableQty ?? 0),
      reservedQty: Number(r.reservedQty ?? 0),
    }));
  }

  /**
   * 공정 수불(거래원장) 조회 — WIP_MAT_TRANSACTIONS.
   * - 설비명(EQUIP_MASTERS)·품목명(ITEM_MASTERS) 조인 포함. 최신순(CREATED_AT DESC) 정렬.
   * - 필터: equipCode, itemCode, transType, search(품목코드/품목명/LOT/설비명 부분일치),
   *   fromDate/toDate(CREATED_AT 기준, dateTo는 해당일 종료까지 포함).
   * - 멀티테넌시(company/plant) 필수.
   */
  async findTransactions(
    params: WipTransactionQuery,
    company: string,
    plant: string,
  ): Promise<WipTransactionRow[]> {
    const qb = this.wipTxRepo
      .createQueryBuilder('tx')
      .leftJoin('EQUIP_MASTERS', 'e', 'e.EQUIP_CODE = tx.EQUIP_CODE')
      .leftJoin('ITEM_MASTERS', 'i', 'i.ITEM_CODE = tx.ITEM_CODE')
      .where('tx.COMPANY = :company', { company })
      .andWhere('tx.PLANT_CD = :plant', { plant })
      .select('tx.TRANS_NO', 'transNo')
      .addSelect('tx.TRANS_TYPE', 'transType')
      .addSelect('tx.EQUIP_CODE', 'equipCode')
      .addSelect('e.EQUIP_NAME', 'equipName')
      .addSelect('tx.ITEM_CODE', 'itemCode')
      .addSelect('i.ITEM_NAME', 'itemName')
      .addSelect('tx.MAT_UID', 'matUid')
      .addSelect('tx.QTY', 'qty')
      .addSelect('tx.FROM_WAREHOUSE_ID', 'fromWarehouseId')
      .addSelect('tx.ORDER_NO', 'orderNo')
      .addSelect('tx.REF_TYPE', 'refType')
      .addSelect('tx.REF_ID', 'refId')
      .addSelect('tx.CANCEL_REF_ID', 'cancelRefId')
      .addSelect('tx.STATUS', 'status')
      .addSelect('tx.REMARK', 'remark')
      .addSelect('tx.WORKER_CODE', 'workerId')
      .addSelect('tx.CREATED_AT', 'createdAt')
      .orderBy('tx.CREATED_AT', 'DESC')
      .addOrderBy('tx.TRANS_NO', 'DESC');

    if (params.equipCode) {
      qb.andWhere('tx.EQUIP_CODE = :equipCode', { equipCode: params.equipCode });
    }
    if (params.itemCode) {
      qb.andWhere('tx.ITEM_CODE = :itemCode', { itemCode: params.itemCode });
    }
    if (params.transType) {
      qb.andWhere('tx.TRANS_TYPE = :transType', { transType: params.transType });
    }
    if (params.search) {
      qb.andWhere(
        '(tx.ITEM_CODE LIKE :kw OR i.ITEM_NAME LIKE :kw OR tx.MAT_UID LIKE :kw OR e.EQUIP_NAME LIKE :kw)',
        { kw: `%${params.search}%` },
      );
    }
    if (params.fromDate) {
      qb.andWhere('tx.CREATED_AT >= TO_TIMESTAMP(:fromDate, :dateFmt)', {
        fromDate: `${params.fromDate} 00:00:00`,
        dateFmt: 'YYYY-MM-DD HH24:MI:SS',
      });
    }
    if (params.toDate) {
      qb.andWhere('tx.CREATED_AT <= TO_TIMESTAMP(:toDate, :dateFmt)', {
        toDate: `${params.toDate} 23:59:59`,
        dateFmt: 'YYYY-MM-DD HH24:MI:SS',
      });
    }

    const raw = await qb.getRawMany<{
      transNo: string; transType: string; equipCode: string; equipName: string | null;
      itemCode: string; itemName: string | null; matUid: string; qty: number;
      fromWarehouseId: string | null; orderNo: string | null; refType: string | null;
      refId: string | null; cancelRefId: string | null; status: string;
      remark: string | null; workerId: string | null; createdAt: Date | null;
    }>();

    return raw.map((r) => ({
      transNo: r.transNo,
      transType: r.transType,
      equipCode: r.equipCode,
      equipName: r.equipName ?? null,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      matUid: r.matUid,
      qty: Number(r.qty ?? 0),
      fromWarehouseId: r.fromWarehouseId ?? null,
      orderNo: r.orderNo ?? null,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      cancelRefId: r.cancelRefId ?? null,
      status: r.status,
      remark: r.remark ?? null,
      workerId: r.workerId ?? null,
      createdAt: r.createdAt ?? null,
    }));
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────

  /** WIP_MAT_STOCKS 가산 upsert (없으면 생성, 있으면 qty/availableQty 누적) */
  private async upsertAdd(
    manager: EntityManager,
    p: {
      company: string; plant: string; equipCode: string;
      itemCode: string; matUid: string; addQty: number;
    },
  ): Promise<void> {
    const key = {
      company: p.company, plant: p.plant, equipCode: p.equipCode,
      itemCode: p.itemCode, matUid: p.matUid,
    };
    const existing = await manager.findOne(WipMatStock, { where: key });
    if (existing) {
      await manager.update(WipMatStock, key, {
        qty: (existing.qty ?? 0) + p.addQty,
        availableQty: (existing.availableQty ?? 0) + p.addQty,
      });
    } else {
      await manager.save(
        WipMatStock,
        manager.create(WipMatStock, {
          ...key,
          qty: p.addQty,
          availableQty: p.addQty,
          reservedQty: 0,
        }),
      );
    }
  }

  /** WIP_MAT_STOCKS 단일 LOT 차감 (복원-차감용, 0 미만으로 떨어지지 않게 가드) */
  private async deductOneLot(
    manager: EntityManager,
    p: {
      company: string; plant: string; equipCode: string;
      itemCode: string; matUid: string; deductQty: number;
    },
  ): Promise<void> {
    const key = {
      company: p.company, plant: p.plant, equipCode: p.equipCode,
      itemCode: p.itemCode, matUid: p.matUid,
    };
    const existing = await manager.findOne(WipMatStock, { where: key });
    if (!existing) {
      this.logger.warn(
        `복원-차감 대상 공정재고 없음: ${p.equipCode}/${p.itemCode}/${p.matUid} (0 처리)`,
      );
      return;
    }
    const nextQty = Math.max(0, (existing.qty ?? 0) - p.deductQty);
    const nextAvail = Math.max(0, (existing.availableQty ?? 0) - p.deductQty);
    await manager.update(WipMatStock, key, { qty: nextQty, availableQty: nextAvail });
  }

  /** 차감 순서 정렬: scannedMatUids 우선 → FIFO(createdAt → matUid) */
  private orderLotsForDeduct(
    rows: WipMatStock[],
    scannedMatUids?: string[],
  ): WipMatStock[] {
    const scanned = new Set(scannedMatUids ?? []);
    return [...rows].sort((a, b) => {
      const aScan = scanned.has(a.matUid) ? 0 : 1;
      const bScan = scanned.has(b.matUid) ? 0 : 1;
      if (aScan !== bScan) return aScan - bScan;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (at !== bt) return at - bt;
      return a.matUid.localeCompare(b.matUid);
    });
  }
}
