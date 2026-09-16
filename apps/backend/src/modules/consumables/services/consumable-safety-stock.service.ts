/**
 * @file consumable-safety-stock.service.ts
 * @description 소모품 안전재고 사전알림 집계.
 *
 * 품목별 가용/교체임박 수량을 SQL GROUP BY 한 번으로 집계하고, 판정은 @harness/shared 규칙에 맡긴다.
 * 판정 조건을 여기에 다시 적지 말 것 — 화면과 대시보드가 같은 규칙을 써야 한다.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CONSUMABLE_PRE_ALERT_RATIO_KEY,
  needsConsumableSafetyAction,
  resolveConsumablePreAlertRatio,
  resolveConsumableSafetyLevel,
  type ConsumableSafetyLevel,
} from '@harness/shared';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { SysConfigService } from '../../system/services/sys-config.service';

export interface ConsumableSafetyRow {
  consumableCode: string;
  name: string;
  category: string | null;
  safetyStock: number;
  /** 사용 가능한 인스턴스 수 (ACTIVE, 수명 남음) */
  availableQty: number;
  /** 장착중 + 수명 경고/교체 — 곧 재고를 먹는다 */
  replacingQty: number;
  /** 수명을 다해 가용에서 뺀 ACTIVE 인스턴스 수 (참고 표시용) */
  wornOutQty: number;
  effectiveQty: number;
  shortageQty: number;
  preAlertThreshold: number;
  level: ConsumableSafetyLevel;
  location: string | null;
  vendor: string | null;
}

@Injectable()
export class ConsumableSafetyStockService {
  constructor(
    @InjectRepository(ConsumableMaster)
    private readonly masterRepo: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableStock)
    private readonly stockRepo: Repository<ConsumableStock>,
    private readonly sysConfigService: SysConfigService,
  ) {}

  /**
   * 품목별 안전재고 수준 목록.
   *
   * @param onlyActionNeeded true면 부족/사전경고만 (목록 기본값·대시보드용)
   */
  async findSafetyLevels(
    company?: string,
    plant?: string,
    options?: { onlyActionNeeded?: boolean; category?: string; search?: string },
  ): Promise<{ ratio: number; data: ConsumableSafetyRow[] }> {
    const ratio = resolveConsumablePreAlertRatio(
      await this.sysConfigService.getValue(CONSUMABLE_PRE_ALERT_RATIO_KEY, company, plant),
    );

    const masterQb = this.masterRepo
      .createQueryBuilder('m')
      .where("m.useYn = 'Y'");
    if (company) masterQb.andWhere('m.company = :company', { company });
    if (plant) masterQb.andWhere('m.plant = :plant', { plant });
    if (options?.category) masterQb.andWhere('m.category = :category', { category: options.category });
    if (options?.search) {
      masterQb.andWhere('(m.consumableCode LIKE :search OR m.consumableName LIKE :search)', {
        search: `%${options.search}%`,
      });
    }
    masterQb.orderBy('m.consumableCode', 'ASC');
    const masters = await masterQb.getMany();
    if (masters.length === 0) return { ratio, data: [] };

    // 인스턴스 집계는 SQL 한 번으로 끝낸다(메모리 집계 금지).
    // 수명이 끝난 ACTIVE(LIFE_STATUS='REPLACE')는 쓸 수 없으므로 가용에서 뺀다.
    const aggQb = this.stockRepo
      .createQueryBuilder('s')
      .select('s.consumableCode', 'consumableCode')
      .addSelect("SUM(CASE WHEN s.status = 'ACTIVE' AND s.lifeStatus <> 'REPLACE' THEN 1 ELSE 0 END)", 'availableQty')
      .addSelect("SUM(CASE WHEN s.status = 'ACTIVE' AND s.lifeStatus = 'REPLACE' THEN 1 ELSE 0 END)", 'wornOutQty')
      .addSelect("SUM(CASE WHEN s.status = 'MOUNTED' AND s.lifeStatus IN ('WARNING', 'REPLACE') THEN 1 ELSE 0 END)", 'replacingQty')
      .groupBy('s.consumableCode');
    if (company) aggQb.andWhere('s.company = :company', { company });
    if (plant) aggQb.andWhere('s.plantCd = :plant', { plant });
    const agg = await aggQb.getRawMany<{
      consumableCode: string;
      availableQty: string;
      wornOutQty: string;
      replacingQty: string;
    }>();
    const byCode = new Map(agg.map((r) => [r.consumableCode, r]));

    const rows = masters.map((m) => {
      const a = byCode.get(m.consumableCode);
      const availableQty = Number(a?.availableQty) || 0;
      const replacingQty = Number(a?.replacingQty) || 0;
      const judged = resolveConsumableSafetyLevel(
        { availableQty, replacingQty, safetyStock: m.safetyStock },
        ratio,
      );
      return {
        consumableCode: m.consumableCode,
        name: m.consumableName,
        category: m.category ?? null,
        safetyStock: Number(m.safetyStock) || 0,
        availableQty,
        replacingQty,
        wornOutQty: Number(a?.wornOutQty) || 0,
        effectiveQty: judged.effectiveQty,
        shortageQty: judged.shortageQty,
        preAlertThreshold: judged.preAlertThreshold,
        level: judged.level,
        location: m.location ?? null,
        vendor: m.vendor ?? null,
      };
    });

    const data = options?.onlyActionNeeded ? rows.filter((r) => needsConsumableSafetyAction(r.level)) : rows;
    // 급한 것부터 — 부족 먼저, 같은 수준이면 모자란 양이 큰 순
    const order: Record<ConsumableSafetyLevel, number> = { SHORTAGE: 0, PRE_ALERT: 1, NORMAL: 2, NOT_MANAGED: 3 };
    data.sort((a, b) => order[a.level] - order[b.level]
      || b.shortageQty - a.shortageQty
      || a.effectiveQty - b.effectiveQty
      || a.consumableCode.localeCompare(b.consumableCode));
    return { ratio, data };
  }
}
