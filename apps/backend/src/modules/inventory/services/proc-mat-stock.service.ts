/**
 * @file src/modules/inventory/services/proc-mat-stock.service.ts
 * @description 공정재고(장착 대기) 단일 책임 서비스 - PROC_MAT_STOCKS / PROC_MAT_TRANSACTIONS 전담 (ADR 0002)
 *
 * 초보자 가이드:
 * - 공정(PROCESS_CODE) 단위 공정재고의 가산/차감/복원/조회를 이 서비스로 일원화한다(작업지시 무관 공용).
 * - 설비재고(WIP_MAT_STOCKS)·원자재재고(MAT_STOCKS)와 분리. 위치=공정.
 * - 모든 변경 메서드는 외부 트랜잭션(QueryRunner)을 받아 그 안에서 동작한다(결번 없는 채번).
 * - 채번은 NumberingService.nextInTx(qr, 'WIP_TX') 재사용 → 거래번호 전역 유일.
 *
 * 흐름(ADR 0002):
 * - 출고 입고:   addStockInTx(transType:'PROC_IN', refType:'MAT_ISSUE')
 * - 출고 취소:   restoreInTx(mode:'DEDUCT_BACK', cancelTransType:'PROC_IN_CANCEL', originTransType:'PROC_IN')
 * - 설비 장착:   deductStockInTx(transType:'PROC_MOUNT', refType:'EQUIP_MOUNT')  → 설비재고로 이동
 * - 장착 해제:   addStockInTx(transType:'PROC_UNMOUNT', refType:'EQUIP_MOUNT')   ← 설비재고에서 복원
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, EntityManager } from 'typeorm';
import { ProcMatStock } from '../../../entities/proc-mat-stock.entity';
import { ProcMatTransaction } from '../../../entities/proc-mat-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';

/** 공정재고 가산 파라미터 */
export interface AddProcStockParams {
  processCode: string;
  itemCode: string;
  matUid: string;
  qty: number;
  transType: string;
  fromWarehouseId?: string | null;
  equipCode?: string | null;
  orderNo?: string | null;
  refType: string;
  refId: string;
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
}

/** 공정재고 차감 파라미터 */
export interface DeductProcStockParams {
  processCode: string;
  itemCode: string;
  qty: number;
  transType: string;
  refType: string;
  refId: string;
  equipCode?: string | null;
  orderNo?: string | null;
  /** 스캔/지정 LOT 우선 차감 */
  scannedMatUids?: string[];
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
}

/** 차감 결과 LOT 단위 */
export interface DeductedProcLot {
  matUid: string;
  itemCode: string;
  qty: number;
}

/** 취소 복원 파라미터 — 원본 거래(refType/refId)를 찾아 대칭 복원 */
export interface RestoreProcStockParams {
  /** ADD_BACK: 공정재고 가산 / DEDUCT_BACK: 공정재고 차감 */
  mode: 'ADD_BACK' | 'DEDUCT_BACK';
  refType: string;
  refId: string;
  cancelTransType: string;
  originTransType?: string;
  orderNo?: string | null;
  workerId?: string | null;
  remark?: string | null;
  company: string;
  plant: string;
}

/** 복원 결과 LOT 단위 */
export interface RestoredProcLot {
  matUid: string;
  qty: number;
  cancelRefId: string;
}

@Injectable()
export class ProcMatStockService {
  private readonly logger = new Logger(ProcMatStockService.name);

  constructor(
    @InjectRepository(ProcMatStock)
    private readonly procStockRepo: Repository<ProcMatStock>,
    @InjectRepository(ProcMatTransaction)
    private readonly procTxRepo: Repository<ProcMatTransaction>,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * 공정재고 가산 (출고 입고·장착 해제 복원 공용).
   * - PROC_MAT_STOCKS 복합키 upsert: 없으면 생성, 있으면 qty/availableQty += qty.
   * - PROC_MAT_TRANSACTIONS 1건(+qty) 기록.
   */
  async addStockInTx(qr: QueryRunner, p: AddProcStockParams): Promise<void> {
    if (p.qty <= 0) {
      throw new BadRequestException(`공정재고 가산 수량이 올바르지 않습니다: ${p.qty}`);
    }
    const manager = qr.manager;
    await this.upsertAdd(manager, {
      company: p.company, plant: p.plant, processCode: p.processCode,
      itemCode: p.itemCode, matUid: p.matUid, addQty: p.qty,
    });

    const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
    await manager.save(
      ProcMatTransaction,
      manager.create(ProcMatTransaction, {
        transNo,
        transType: p.transType,
        processCode: p.processCode,
        itemCode: p.itemCode,
        matUid: p.matUid,
        qty: p.qty,
        fromWarehouseId: p.fromWarehouseId ?? null,
        equipCode: p.equipCode ?? null,
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
   * 공정재고 차감 (설비 장착 이동).
   * - (company,plant,processCode,itemCode)의 PROC_MAT_STOCKS 행을 FIFO 차감(scannedMatUids 우선).
   * - 가용 부족 시 예외(fail loud — 공정재고가 없으면 출고가 먼저 되어야 함).
   * - LOT 차감마다 PROC_MAT_TRANSACTIONS(-deductQty) 기록.
   * @returns 실제 차감된 LOT/수량 목록
   */
  async deductStockInTx(qr: QueryRunner, p: DeductProcStockParams): Promise<DeductedProcLot[]> {
    if (p.qty <= 0) {
      throw new BadRequestException(`공정재고 차감 수량이 올바르지 않습니다: ${p.qty}`);
    }
    const manager = qr.manager;
    const rows = await manager.find(ProcMatStock, {
      where: {
        company: p.company, plant: p.plant,
        processCode: p.processCode, itemCode: p.itemCode,
      },
    });

    const ordered = this.orderLotsForDeduct(rows, p.scannedMatUids);
    const totalAvailable = ordered.reduce((sum, r) => sum + (r.availableQty ?? 0), 0);

    if (totalAvailable < p.qty) {
      throw new BadRequestException(
        `공정재고 부족: 설비 장착 전 자재 출고(공정 입고) 필요 (공정=${p.processCode}, 품목=${p.itemCode}, 가용=${totalAvailable}, 요청=${p.qty})`,
      );
    }

    let remaining = p.qty;
    const deducted: DeductedProcLot[] = [];

    for (const row of ordered) {
      if (remaining <= 0) break;
      const avail = row.availableQty ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);

      await manager.update(
        ProcMatStock,
        {
          company: p.company, plant: p.plant, processCode: p.processCode,
          itemCode: p.itemCode, matUid: row.matUid,
        },
        {
          qty: (row.qty ?? 0) - take,
          availableQty: avail - take,
        },
      );

      const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
      await manager.save(
        ProcMatTransaction,
        manager.create(ProcMatTransaction, {
          transNo,
          transType: p.transType,
          processCode: p.processCode,
          itemCode: p.itemCode,
          matUid: row.matUid,
          qty: -take,
          fromWarehouseId: null,
          equipCode: p.equipCode ?? null,
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

      deducted.push({ matUid: row.matUid, itemCode: p.itemCode, qty: take });
      remaining -= take;
    }

    return deducted;
  }

  /**
   * 취소 복원 — 원본 거래(refType/refId)를 PROC_MAT_TRANSACTIONS에서 조회해 대칭 복원한다.
   * - DEDUCT_BACK: 원본 가산(+qty)을 차감(-) + *_CANCEL 기록.
   * - ADD_BACK: 원본 차감(-qty)을 가산(+) + *_CANCEL 기록.
   */
  async restoreInTx(qr: QueryRunner, p: RestoreProcStockParams): Promise<RestoredProcLot[]> {
    const manager = qr.manager;
    const where: Record<string, unknown> = {
      company: p.company, plant: p.plant,
      refType: p.refType, refId: p.refId, status: 'DONE',
    };
    if (p.originTransType) where.transType = p.originTransType;

    const origins = await manager.find(ProcMatTransaction, { where });
    if (!origins.length) {
      this.logger.warn(
        `복원 대상 공정재고 거래 없음: refType=${p.refType} refId=${p.refId} (복원 생략)`,
      );
      return [];
    }

    const restored: RestoredProcLot[] = [];
    for (const origin of origins) {
      if (origin.transType.endsWith('_CANCEL')) continue;
      const absQty = Math.abs(origin.qty ?? 0);
      if (absQty <= 0) continue;

      if (p.mode === 'ADD_BACK') {
        await this.upsertAdd(manager, {
          company: p.company, plant: p.plant, processCode: origin.processCode,
          itemCode: origin.itemCode, matUid: origin.matUid, addQty: absQty,
        });
      } else {
        await this.deductOneLot(manager, {
          company: p.company, plant: p.plant, processCode: origin.processCode,
          itemCode: origin.itemCode, matUid: origin.matUid, deductQty: absQty,
        });
      }

      const signedQty = p.mode === 'ADD_BACK' ? absQty : -absQty;
      const transNo = await this.numbering.nextInTx(qr, 'WIP_TX');
      await manager.save(
        ProcMatTransaction,
        manager.create(ProcMatTransaction, {
          transNo,
          transType: p.cancelTransType,
          processCode: origin.processCode,
          itemCode: origin.itemCode,
          matUid: origin.matUid,
          qty: signedQty,
          fromWarehouseId: origin.fromWarehouseId ?? null,
          equipCode: origin.equipCode ?? null,
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

  /** 특정 공정+품목의 LOT별 재고 상세 (availableQty > 0인 행만) */
  async findLotsByProcessItem(
    processCode: string,
    itemCode: string,
    company: string,
    plant: string,
  ): Promise<{ matUid: string; qty: number; availableQty: number }[]> {
    const rows = await this.procStockRepo.find({
      where: { company, plant, processCode, itemCode },
    });
    return rows
      .filter((r) => (r.availableQty ?? 0) > 0)
      .map((r) => ({ matUid: r.matUid, qty: r.qty ?? 0, availableQty: r.availableQty ?? 0 }));
  }

  /** 특정 공정의 장착 대기 공정재고 목록 (availableQty > 0) — 설비 장착 화면용 */
  async listWaitingByProcess(
    processCode: string,
    company: string,
    plant: string,
  ): Promise<{ matUid: string; itemCode: string; qty: number; availableQty: number }[]> {
    const rows = await this.procStockRepo.find({
      where: { company, plant, processCode },
    });
    return rows
      .filter((r) => (r.availableQty ?? 0) > 0)
      .map((r) => ({
        matUid: r.matUid,
        itemCode: r.itemCode,
        qty: r.qty ?? 0,
        availableQty: r.availableQty ?? 0,
      }));
  }

  /** 특정 공정의 단일 LOT(matUid) 가용 재고 조회 — 장착 시 itemCode/잔량 확인용 */
  async findLot(
    processCode: string,
    matUid: string,
    company: string,
    plant: string,
  ): Promise<ProcMatStock | null> {
    return this.procStockRepo.findOne({
      where: { company, plant, processCode, matUid },
    });
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────

  private async upsertAdd(
    manager: EntityManager,
    p: { company: string; plant: string; processCode: string; itemCode: string; matUid: string; addQty: number },
  ): Promise<void> {
    const key = {
      company: p.company, plant: p.plant, processCode: p.processCode,
      itemCode: p.itemCode, matUid: p.matUid,
    };
    const existing = await manager.findOne(ProcMatStock, { where: key });
    if (existing) {
      await manager.update(ProcMatStock, key, {
        qty: (existing.qty ?? 0) + p.addQty,
        availableQty: (existing.availableQty ?? 0) + p.addQty,
      });
    } else {
      await manager.save(
        ProcMatStock,
        manager.create(ProcMatStock, { ...key, qty: p.addQty, availableQty: p.addQty, reservedQty: 0 }),
      );
    }
  }

  private async deductOneLot(
    manager: EntityManager,
    p: { company: string; plant: string; processCode: string; itemCode: string; matUid: string; deductQty: number },
  ): Promise<void> {
    const key = {
      company: p.company, plant: p.plant, processCode: p.processCode,
      itemCode: p.itemCode, matUid: p.matUid,
    };
    const existing = await manager.findOne(ProcMatStock, { where: key });
    if (!existing) {
      this.logger.warn(
        `복원-차감 대상 공정재고 없음: ${p.processCode}/${p.itemCode}/${p.matUid} (0 처리)`,
      );
      return;
    }
    const nextQty = Math.max(0, (existing.qty ?? 0) - p.deductQty);
    const nextAvail = Math.max(0, (existing.availableQty ?? 0) - p.deductQty);
    await manager.update(ProcMatStock, key, { qty: nextQty, availableQty: nextAvail });
  }

  private orderLotsForDeduct(rows: ProcMatStock[], scannedMatUids?: string[]): ProcMatStock[] {
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
