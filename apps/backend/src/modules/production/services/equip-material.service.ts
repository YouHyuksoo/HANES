/**
 * @file src/modules/production/services/equip-material.service.ts
 * @description 설비 자재 장착/해제 서비스
 *
 * 초보자 가이드:
 * - 자재 LOT(MAT_LOTS)를 설비 WIP 재고(WIP_MAT_STOCKS)에 장착하거나 해제한다.
 * - 장착(mount): MAT_LOTS 잔량 전량을 설비 WIP로 이동 + MatLot.currentQty=0.
 * - 목록(listMounted): 설비에 장착된 자재 목록 조회(availableQty>0만).
 * - 해제(unmount): 설비 WIP 잔량을 MAT_LOTS로 복원.
 * - 모든 변경은 단일 트랜잭션(this.tx.run) 안에서 수행한다.
 * - 모든 조회/저장에 company/plant 스코프를 적용한다.
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';

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
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepo: Repository<PartMaster>,
    private readonly wipMatStockService: WipMatStockService,
    private readonly tx: TransactionService,
  ) {}

  /**
   * 자재 LOT를 설비에 장착한다.
   * - MAT_LOTS 잔량(currentQty) 전량을 설비 WIP(WIP_MAT_STOCKS)로 이동.
   * - 동일 설비에 동일 matUid가 이미 장착(qty>0)되어 있으면 BadRequest.
   */
  async mount(
    equipCode: string,
    matUid: string,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<MountedRow> {
    return this.tx.run(async (qr) => {
      // 1. MAT_LOTS 조회
      const lot = await qr.manager.findOne(MatLot, {
        where: { matUid, company, plant },
      });
      if (!lot) {
        throw new NotFoundException(`자재 LOT를 찾을 수 없습니다: ${matUid}`);
      }
      if (lot.currentQty <= 0) {
        throw new BadRequestException(`자재 LOT 잔량이 없습니다: ${matUid} (잔량=${lot.currentQty})`);
      }

      // 2. 동일 설비에 동일 matUid 중복 장착 확인
      const existing = await qr.manager.findOne(WipMatStock, {
        where: { company, plant, equipCode, itemCode: lot.itemCode, matUid },
      });
      if (existing && (existing.qty ?? 0) > 0) {
        throw new BadRequestException(
          `이미 해당 설비에 장착된 자재 LOT입니다: ${matUid} (설비=${equipCode})`,
        );
      }

      const qty = lot.currentQty;

      // 3. 설비 WIP 적재
      await this.wipMatStockService.addStockInTx(qr, {
        equipCode,
        itemCode: lot.itemCode,
        matUid,
        qty,
        transType: 'WIP_IN',
        refType: 'EQUIP_MOUNT',
        refId: matUid,
        workerId: workerId ?? null,
        fromWarehouseId: null,
        orderNo: null,
        remark: null,
        company,
        plant,
      });

      // 4. MAT_LOTS 잔량 0으로 이동
      await qr.manager.update(MatLot, { matUid, company, plant }, { currentQty: 0 });

      // 5. 품목명 조회(Best-effort)
      const part = await this.partMasterRepo.findOne({
        where: { itemCode: lot.itemCode },
        select: ['itemCode', 'itemName'],
      });

      this.logger.log(`설비 자재 장착: equipCode=${equipCode} matUid=${matUid} qty=${qty}`);

      return {
        equipCode,
        itemCode: lot.itemCode,
        itemName: part?.itemName ?? null,
        matUid,
        qty,
        availableQty: qty,
      };
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

    // 품목명 일괄 조회(In)
    const itemCodes = [...new Set(positive.map((s) => s.itemCode))];
    const parts = await this.partMasterRepo.find({
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
   * 설비에 장착된 자재 LOT를 해제하고 원자재창고(MAT_LOTS)로 복원한다.
   * - RESERVED_QTY>0이면 BadRequest(진행 중인 작업 있음).
   * - restoreInTx로 WIP 차감 + MatLot.currentQty += 잔량.
   */
  async unmount(
    equipCode: string,
    matUid: string,
    company: string,
    plant: string,
  ): Promise<void> {
    return this.tx.run(async (qr) => {
      // 1. WIP_MAT_STOCKS 행 조회
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

      // 3. WIP 역분개(DEDUCT_BACK) — 실제 복원량은 반환값 합계 기준(스냅샷 아님)
      const restored = await this.wipMatStockService.restoreInTx(qr, {
        mode: 'DEDUCT_BACK',
        refType: 'EQUIP_MOUNT',
        refId: matUid,
        cancelTransType: 'WIP_IN_CANCEL',
        originTransType: 'WIP_IN',
        company,
        plant,
      });
      const restoreQty = restored.reduce((sum, r) => sum + r.qty, 0);

      // 4. MAT_LOTS 잔량 복원 (실제 WIP 역분개량만큼)
      const lot = await qr.manager.findOne(MatLot, { where: { matUid, company, plant } });
      if (lot) {
        await qr.manager.update(MatLot, { matUid, company, plant }, {
          currentQty: (lot.currentQty ?? 0) + restoreQty,
        });
      } else {
        this.logger.warn(`unmount: MAT_LOTS 행 없음 — matUid=${matUid} (복원 생략)`);
      }

      this.logger.log(`설비 자재 해제: equipCode=${equipCode} matUid=${matUid} qty=${restoreQty}`);
    });
  }
}
