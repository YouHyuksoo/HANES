/**
 * @file src/modules/production/services/equip-material.service.ts
 * @description 설비 자재 장착/해제 서비스 (ADR 0002)
 *
 * 초보자 가이드:
 * - 자재 흐름: 원자재창고 → [출고] → 공정재고(PROC_MAT_STOCKS=장착 대기) → [장착] → 설비재고(WIP_MAT_STOCKS=장착됨).
 * - 장착(mount): 설비의 공정(EquipMaster.processCode)의 공정재고에서 LOT 잔량을 차감 → 설비재고로 가산.
 * - 해제(unmount): 설비재고 현재 잔량만 차감 거래로 기록 → 공정재고로 복원.
 * - MAT_LOTS는 출고 단계에서 이미 차감되었으므로 여기서 건드리지 않는다.
 * - 모든 변경은 단일 트랜잭션(this.tx.run) 안에서 수행하고, company/plant 스코프를 적용한다.
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';

/** 장착된 자재 행 */
export interface MountedRow {
  equipCode: string;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  availableQty: number;
}

@Injectable()
export class EquipMaterialService {
  private readonly logger = new Logger(EquipMaterialService.name);

  constructor(
    @InjectRepository(WipMatStock)
    private readonly wipStockRepo: Repository<WipMatStock>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepo: Repository<ItemMaster>,
    private readonly wipMatStockService: WipMatStockService,
    private readonly procMatStockService: ProcMatStockService,
    private readonly tx: TransactionService,
  ) {}

  /**
   * 공정재고(장착 대기) LOT를 설비에 장착한다.
   * - 설비의 공정(EquipMaster.processCode)의 공정재고에서 해당 LOT 가용 전량을 차감 → 설비재고로 이동.
   * - 공정재고가 없으면(출고 미이행) BadRequest. 동일 설비에 동일 matUid 중복 장착 시 BadRequest.
   */
  async mount(
    equipCode: string,
    matUid: string,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<MountedRow> {
    return this.tx.run(async (qr) => {
      // 1. 설비 → 공정 도출 (설비 1:1 공정, ADR 0003)
      const equip = await qr.manager.findOne(EquipMaster, {
        where: { equipCode, company, plant },
      });
      if (!equip?.processCode) {
        throw new BadRequestException(`설비에 공정이 지정되지 않았습니다: ${equipCode}`);
      }
      const processCode = equip.processCode;

      // 2. 공정재고(장착 대기)에서 해당 LOT 조회
      const procLot = await this.procMatStockService.findLot(processCode, matUid, company, plant);
      if (!procLot || (procLot.availableQty ?? 0) <= 0) {
        throw new BadRequestException(
          `장착할 공정재고가 없습니다: matUid=${matUid} (공정=${processCode}). 자재 출고(공정 입고)가 먼저 필요합니다.`,
        );
      }
      const itemCode = procLot.itemCode;
      const qty = procLot.availableQty;

      // 3. 동일 설비에 동일 matUid 중복 장착 확인
      const existing = await qr.manager.findOne(WipMatStock, {
        where: { company, plant, equipCode, itemCode, matUid },
      });
      if (existing && (existing.qty ?? 0) > 0) {
        throw new BadRequestException(
          `이미 해당 설비에 장착된 자재 LOT입니다: ${matUid} (설비=${equipCode})`,
        );
      }

      // 4. 공정재고 차감 (장착 대기 → 이동)
      await this.procMatStockService.deductStockInTx(qr, {
        processCode,
        itemCode,
        qty,
        scannedMatUids: [matUid],
        transType: 'PROC_MOUNT',
        refType: 'EQUIP_MOUNT',
        refId: matUid,
        equipCode,
        workerId: workerId ?? null,
        company,
        plant,
      });

      // 5. 설비재고 가산 (장착됨)
      await this.wipMatStockService.addStockInTx(qr, {
        equipCode,
        itemCode,
        matUid,
        qty,
        transType: 'WIP_IN',
        refType: 'EQUIP_MOUNT',
        refId: matUid,
        fromWarehouseId: null,
        orderNo: null,
        workerId: workerId ?? null,
        remark: null,
        company,
        plant,
      });

      // 6. 품목명 조회(Best-effort)
      const part = await this.itemMasterRepo.findOne({
        where: { itemCode },
        select: ['itemCode', 'itemName'],
      });

      this.logger.log(
        `설비 자재 장착: equipCode=${equipCode} matUid=${matUid} qty=${qty} (공정=${processCode})`,
      );

      return { equipCode, itemCode, itemName: part?.itemName ?? null, matUid, qty, availableQty: qty };
    });
  }

  /**
   * 설비에 장착된 자재 목록을 조회한다(availableQty>0 행만).
   * - WIP_MAT_STOCKS를 equipCode로 조회 후 ITEM_MASTERS 일괄 매핑(N+1 금지).
   */
  async listMounted(
    equipCode: string,
    company: string,
    plant: string,
  ): Promise<MountedRow[]> {
    const stocks = await this.wipStockRepo.find({
      where: { company, plant, equipCode },
    });

    const positive = stocks.filter((s) => (s.availableQty ?? 0) > 0);
    if (positive.length === 0) return [];

    const itemCodes = [...new Set(positive.map((s) => s.itemCode))];
    const parts = await this.itemMasterRepo.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName'],
    });
    const nameMap = new Map(parts.map((p) => [p.itemCode, p.itemName]));

    return positive.map((s) => ({
      equipCode: s.equipCode,
      itemCode: s.itemCode,
      itemName: nameMap.get(s.itemCode) ?? null,
      matUid: s.matUid,
      qty: s.qty ?? 0,
      availableQty: s.availableQty ?? 0,
    }));
  }

  /**
   * 설비의 공정(EquipMaster.processCode)의 장착 대기 공정재고 목록을 조회한다.
   * - 설비 장착 화면에서 "스캔 없이 목록에서 선택 장착"을 지원한다.
   * - 설비에 공정이 없으면 빈 목록.
   */
  async listProcWaiting(
    equipCode: string,
    company: string,
    plant: string,
  ): Promise<MountedRow[]> {
    const equip = await this.wipStockRepo.manager.findOne(EquipMaster, {
      where: { equipCode, company, plant },
    });
    if (!equip?.processCode) return [];

    const rows = await this.procMatStockService.listWaitingByProcess(equip.processCode, company, plant);
    if (rows.length === 0) return [];

    const itemCodes = [...new Set(rows.map((r) => r.itemCode))];
    const parts = await this.itemMasterRepo.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName'],
    });
    const nameMap = new Map(parts.map((p) => [p.itemCode, p.itemName]));

    return rows.map((r) => ({
      equipCode,
      itemCode: r.itemCode,
      itemName: nameMap.get(r.itemCode) ?? null,
      matUid: r.matUid,
      qty: r.qty,
      availableQty: r.availableQty,
    }));
  }

  /**
   * 설비에 장착된 자재 LOT를 해제하고 현재 남은 잔량만 공정재고(장착 대기)로 복원한다.
   * - RESERVED_QTY>0이면 BadRequest(진행 중인 작업 있음).
   * - 원본 장착 수량이 아니라 WIP_MAT_STOCKS의 현재 availableQty를 기준으로 거래를 생성한다.
   */
  async unmount(
    equipCode: string,
    matUid: string,
    company: string,
    plant: string,
  ): Promise<void> {
    return this.tx.run(async (qr) => {
      // 1. 설비재고 행 조회
      const stock = await qr.manager.findOne(WipMatStock, {
        where: { company, plant, equipCode, matUid },
      });
      if (!stock || (stock.qty ?? 0) <= 0) {
        throw new NotFoundException(
          `장착된 자재를 찾을 수 없습니다: equipCode=${equipCode} matUid=${matUid}`,
        );
      }

      // 2. 예약(RESERVED) 확인
      if ((stock.reservedQty ?? 0) > 0) {
        throw new BadRequestException(
          `예약된 수량이 있어 해제할 수 없습니다: ${matUid} (예약=${stock.reservedQty})`,
        );
      }

      const restoreQty = stock.availableQty ?? stock.qty ?? 0;
      if (restoreQty <= 0) {
        throw new BadRequestException(`해제 가능한 잔량이 없습니다: ${matUid}`);
      }

      const equip = await qr.manager.findOne(EquipMaster, {
        where: { company, plant, equipCode },
      });
      if (!equip?.processCode) {
        throw new BadRequestException(`설비에 공정이 지정되지 않았습니다: ${equipCode}`);
      }
      const processCode = equip.processCode;

      // 3. 설비재고 현재 잔량 차감 — 장착됨 해제
      const deducted = await this.wipMatStockService.deductStockInTx(qr, {
        equipCode,
        itemCode: stock.itemCode,
        qty: restoreQty,
        scannedMatUids: [matUid],
        transType: 'WIP_IN_CANCEL',
        refType: 'EQUIP_UNMOUNT',
        refId: matUid,
        stockPolicy: 'BLOCK',
        company,
        plant,
      });
      const deductedQty = deducted.reduce((sum, r) => sum + r.qty, 0);

      // 4. 공정재고 가산 — 장착 대기로 되돌림
      await this.procMatStockService.addStockInTx(qr, {
        processCode,
        itemCode: stock.itemCode,
        matUid,
        qty: deductedQty,
        transType: 'PROC_UNMOUNT',
        refType: 'EQUIP_UNMOUNT',
        refId: matUid,
        equipCode,
        company,
        plant,
      });

      this.logger.log(
        `설비 자재 해제: equipCode=${equipCode} matUid=${matUid} qty=${deductedQty}`,
      );
    });
  }
}
