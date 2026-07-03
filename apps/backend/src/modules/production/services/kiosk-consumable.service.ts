/**
 * @file services/kiosk-consumable.service.ts
 * @description 키오스크 소모품 — 매핑 조회 + conUid 롯트 스캔 장착
 *
 * 초보자 가이드:
 * - 작업지시(모델 itemCode + 설비 equipCode) → CONSUMABLE_USAGE_MAP에서 필요 소모품 조회
 * - 바코드(conUid) 스캔 → 공정대기(PROC_WAIT) 롯트만 설비에 장착(MOUNTED)
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

  /**
   * 작업지시(모델+설비)에 매핑된 소모품 목록 + 현재 장착 롯트 현황
   * @param equipCodeOverride 지정 시 작업지시 설비 대신 이 설비 기준으로 조회(검사 화면 검사기 선택용)
   * @param includeMountedOnEquip true면 (현재 품목 매핑에 없더라도) 해당 설비에 장착된 소모품도 포함한다.
   *   소모품은 설비에 귀속 장착되므로, 작업지시(품목)가 바뀌어도 그 설비에 장착된 소모품이 계속 표시되게 한다.
   */
  async findByJobOrder(
    orderNo: string,
    company?: string,
    plant?: string,
    equipCodeOverride?: string,
    includeMountedOnEquip = false,
  ): Promise<KioskConsumableRow[]> {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    const effectiveEquip = equipCodeOverride ?? jobOrder?.equipCode;
    if (!effectiveEquip || !jobOrder?.itemCode) return [];

    const maps = await this.mapRepo.find({
      where: {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
        productItemCode: jobOrder.itemCode,
        equipCode: effectiveEquip,
        useYn: 'Y',
      },
    });
    const mapByCode = new Map(maps.map(m => [m.consumableCode, m]));
    const mappedCodes = maps.map(m => m.consumableCode);

    // 설비에 현재 장착된 모든 롯트(소모품은 설비 귀속 → 작업지시가 바뀌어도 유지)
    const mounted = await this.stockRepo.find({
      where: {
        mountedEquipCode: effectiveEquip,
        status: 'MOUNTED',
        ...(company ? { company } : {}),
        ...(plant ? { plantCd: plant } : {}),
      },
    });
    const mountedMap = new Map(mounted.map(s => [s.consumableCode, s]));

    // 표시 대상 = 매핑(필수) ∪ (옵션) 설비에 장착된 소모품
    const extraMountedCodes = includeMountedOnEquip
      ? mounted.map(s => s.consumableCode).filter(c => !mapByCode.has(c))
      : [];
    const allCodes = Array.from(new Set([...mappedCodes, ...extraMountedCodes]));
    if (allCodes.length === 0) return [];

    const masters = await this.masterRepo.find({
      where: { consumableCode: In(allCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    const masterMap = new Map(masters.map(m => [m.consumableCode, m]));

    return allCodes.map(code => {
      const m = mapByCode.get(code);
      const master = masterMap.get(code);
      const lot = mountedMap.get(code);
      return {
        consumableCode: code,
        name: master?.consumableName ?? code,
        usagePerUnit: m?.usagePerUnit ?? 0,
        expectedLife: master?.expectedLife ?? null,
        warningCount: master?.warningCount ?? null,
        mountedConUid: lot?.conUid ?? null,
        currentCount: lot?.currentCount ?? null,
        lotStatus: lot?.status ?? null,
      };
    });
  }

  /**
   * 바코드(conUid) 스캔 → 소모품 롯트를 설비에 장착
   * @param equipCodeOverride 지정 시 작업지시 설비 대신 이 설비에 장착(검사 화면 검사기 선택용)
   */
  async scanMount(orderNo: string, conUid: string, company?: string, plant?: string, equipCodeOverride?: string) {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    const effectiveEquip = equipCodeOverride ?? jobOrder?.equipCode;
    if (!jobOrder?.itemCode) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }
    if (!effectiveEquip) {
      throw new BadRequestException('장착 대상 설비가 지정되지 않았습니다. (검사기 선택 또는 작업지시 설비 필요)');
    }
    if (!jobOrder.processCode) {
      throw new BadRequestException('장착 대상 공정이 지정되지 않았습니다. 작업지시 공정을 확인하세요.');
    }

    const stock = await this.stockRepo.findOne({
      where: { conUid, ...(company ? { company } : {}), ...(plant ? { plantCd: plant } : {}) },
    });
    if (!stock) {
      throw new NotFoundException(`소모품 롯트를 찾을 수 없습니다: ${conUid}`);
    }
    if (stock.status !== 'PROC_WAIT') {
      throw new BadRequestException(`소모품은 공정대기 상태만 장착할 수 있습니다. (${stock.status})`);
    }
    if (stock.processCode !== jobOrder.processCode) {
      throw new BadRequestException(
        `소모품 출고 공정과 장착 공정이 다릅니다. (출고=${stock.processCode ?? '-'}, 장착=${jobOrder.processCode})`,
      );
    }

    const map = await this.mapRepo.findOne({
      where: {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
        productItemCode: jobOrder.itemCode,
        equipCode: effectiveEquip,
        consumableCode: stock.consumableCode,
        useYn: 'Y',
      },
    });
    if (!map) {
      throw new BadRequestException(`오장착: 이 모델/설비에 사용하지 않는 소모품입니다 (${stock.consumableCode})`);
    }

    // 같은 설비에 이미 장착된 동일 소모품의 다른 롯트는 해제(교체) — 설비당 1롯트 불변식
    const prevMounted = await this.stockRepo.find({
      where: {
        consumableCode: stock.consumableCode,
        mountedEquipCode: effectiveEquip,
        status: 'MOUNTED',
        ...(company ? { company } : {}),
        ...(plant ? { plantCd: plant } : {}),
      },
    });
    for (const prev of prevMounted) {
      if (prev.conUid !== stock.conUid) {
        prev.status = 'PROC_WAIT';
        prev.processCode = jobOrder.processCode;
        prev.mountedEquipCode = null;
        await this.stockRepo.save(prev);
      }
    }

    stock.mountedEquipCode = effectiveEquip;
    stock.status = 'MOUNTED';
    const saved = await this.stockRepo.save(stock);

    return {
      conUid: saved.conUid,
      consumableCode: saved.consumableCode,
      equipCode: effectiveEquip,
      status: saved.status,
      currentCount: saved.currentCount,
    };
  }

  /** 장착 해제 (공정대기 복귀) */
  async unmount(conUid: string, company?: string, plant?: string): Promise<void> {
    const stock = await this.stockRepo.findOne({
      where: { conUid, ...(company ? { company } : {}), ...(plant ? { plantCd: plant } : {}) },
    });
    if (!stock) return;
    stock.mountedEquipCode = null;
    stock.status = 'PROC_WAIT';
    await this.stockRepo.save(stock);
  }
}
