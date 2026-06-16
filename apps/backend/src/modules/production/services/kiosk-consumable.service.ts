/**
 * @file services/kiosk-consumable.service.ts
 * @description 키오스크 소모품 — 매핑 조회 + conUid 롯트 스캔 장착
 *
 * 초보자 가이드:
 * - 작업지시(모델 itemCode + 설비 equipCode) → CONSUMABLE_USAGE_MAP에서 필요 소모품 조회
 * - 바코드(conUid) 스캔 → 해당 소모품 롯트(CONSUMABLE_STOCKS)를 설비에 장착(MOUNTED)
 * - 실제 사용횟수 차감(누적)은 생산실적 완료 시 prod-result.service에서 처리한다.
 * - 소모품은 자재가 아니므로 재고 차감/수불을 일으키지 않는다.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';

export interface KioskConsumableRow {
  consumableCode: string;
  name: string;
  usagePerUnit: number;
  expectedLife: number | null;
  warningCount: number | null;
  mountedConUid: string | null;
  currentCount: number | null;
  lotStatus: string | null;
}

@Injectable()
export class KioskConsumableService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(ConsumableUsageMap)
    private readonly mapRepo: Repository<ConsumableUsageMap>,
    @InjectRepository(ConsumableStock)
    private readonly stockRepo: Repository<ConsumableStock>,
    @InjectRepository(ConsumableMaster)
    private readonly masterRepo: Repository<ConsumableMaster>,
  ) {}

  /** 작업지시(모델+설비)에 매핑된 소모품 목록 + 현재 장착 롯트 현황 */
  async findByJobOrder(orderNo: string, company?: string, plant?: string): Promise<KioskConsumableRow[]> {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!jobOrder?.equipCode || !jobOrder.itemCode) return [];

    const maps = await this.mapRepo.find({
      where: {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
        productItemCode: jobOrder.itemCode,
        equipCode: jobOrder.equipCode,
        useYn: 'Y',
      },
    });
    if (maps.length === 0) return [];

    const codes = maps.map(m => m.consumableCode);
    const masters = await this.masterRepo.find({
      where: { consumableCode: In(codes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    const masterMap = new Map(masters.map(m => [m.consumableCode, m]));

    const mounted = await this.stockRepo.find({
      where: {
        consumableCode: In(codes),
        mountedEquipCode: jobOrder.equipCode,
        status: 'MOUNTED',
        ...(company ? { company } : {}),
        ...(plant ? { plantCd: plant } : {}),
      },
    });
    const mountedMap = new Map(mounted.map(s => [s.consumableCode, s]));

    return maps.map(m => {
      const master = masterMap.get(m.consumableCode);
      const lot = mountedMap.get(m.consumableCode);
      return {
        consumableCode: m.consumableCode,
        name: master?.consumableName ?? m.consumableCode,
        usagePerUnit: m.usagePerUnit,
        expectedLife: master?.expectedLife ?? null,
        warningCount: master?.warningCount ?? null,
        mountedConUid: lot?.conUid ?? null,
        currentCount: lot?.currentCount ?? null,
        lotStatus: lot?.status ?? null,
      };
    });
  }

  /** 바코드(conUid) 스캔 → 소모품 롯트를 작업지시 설비에 장착 */
  async scanMount(orderNo: string, conUid: string, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!jobOrder?.equipCode) {
      throw new BadRequestException('작업지시에 설비가 지정되지 않았습니다.');
    }

    const stock = await this.stockRepo.findOne({
      where: { conUid, ...(company ? { company } : {}), ...(plant ? { plantCd: plant } : {}) },
    });
    if (!stock) {
      throw new NotFoundException(`소모품 롯트를 찾을 수 없습니다: ${conUid}`);
    }

    const map = await this.mapRepo.findOne({
      where: {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
        productItemCode: jobOrder.itemCode,
        equipCode: jobOrder.equipCode,
        consumableCode: stock.consumableCode,
        useYn: 'Y',
      },
    });
    if (!map) {
      throw new BadRequestException(`오장착: 이 모델/설비에 사용하지 않는 소모품입니다 (${stock.consumableCode})`);
    }

    stock.mountedEquipCode = jobOrder.equipCode;
    stock.status = 'MOUNTED';
    const saved = await this.stockRepo.save(stock);

    return {
      conUid: saved.conUid,
      consumableCode: saved.consumableCode,
      equipCode: jobOrder.equipCode,
      status: saved.status,
      currentCount: saved.currentCount,
    };
  }

  /** 장착 해제 (창고 복귀) */
  async unmount(conUid: string, company?: string, plant?: string): Promise<void> {
    const stock = await this.stockRepo.findOne({
      where: { conUid, ...(company ? { company } : {}), ...(plant ? { plantCd: plant } : {}) },
    });
    if (!stock) return;
    stock.mountedEquipCode = null;
    stock.status = 'ACTIVE';
    await this.stockRepo.save(stock);
  }
}
