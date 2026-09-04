/**
 * @file hv-spc.service.ts
 * @description 고전압 하네스 SPC 관리도 서비스 — 소스 선택(MOCK|DB) + 관리대상 목록/상세 조립.
 *
 * 초보자 가이드:
 * 1. 소스는 시스템 설정 `SPC_HV_SOURCE` 로 고른다. `MOCK`(기본, 키 없음 포함) → MockSpcSource, `DB` → DbSpcSource.
 *    그 외 값은 오류다 — 어떤 데이터를 보고 있는지 모호해지면 안 되므로 조용히 기본으로 돌리지 않는다.
 * 2. DB 소스에 데이터가 없으면 빈 결과를 그대로 준다. 목업으로 몰래 바꾸지 않는다.
 * 3. 응답 형태(`SpcTargetsResponse`/`SpcTargetData`)는 원본 webdisplay `/api/hanes/spc` 와 동일하다.
 */
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { buildTargetData, type SpcDataSource, type SpcTargetData, type SpcTargetsResponse } from './hv-spc-source';
import { MockSpcSource } from './hv-spc-mock.source';
import { DbSpcSource } from './hv-spc-db.source';
import { dateRange } from './hv-spc-date';

/** 시스템 설정 키 — SYS_CONFIGS.CONFIG_KEY */
export const SPC_HV_SOURCE_CONFIG_KEY = 'SPC_HV_SOURCE';
export type SpcHvSourceSetting = 'MOCK' | 'DB';

export interface HvSpcQuery {
  days: number;
  kLimit: number;
}

@Injectable()
export class HvSpcService {
  constructor(
    @InjectRepository(SpcChart) private readonly chartRepo: Repository<SpcChart>,
    @InjectRepository(SpcData) private readonly dataRepo: Repository<SpcData>,
    @InjectRepository(ProcessMaster) private readonly processRepo: Repository<ProcessMaster>,
    @InjectRepository(ItemMaster) private readonly itemRepo: Repository<ItemMaster>,
    private readonly sysConfig: SysConfigService,
  ) {}

  /** 시스템 설정을 읽어 소스 종류를 정한다. 미설정=MOCK. */
  async resolveSourceSetting(): Promise<SpcHvSourceSetting> {
    const raw = (await this.sysConfig.getValue(SPC_HV_SOURCE_CONFIG_KEY))?.trim().toUpperCase() ?? '';
    if (raw === '' || raw === 'MOCK') return 'MOCK';
    if (raw === 'DB') return 'DB';
    throw new InternalServerErrorException(
      `시스템 설정 ${SPC_HV_SOURCE_CONFIG_KEY} 값이 올바르지 않습니다: '${raw}' (허용: MOCK, DB)`,
    );
  }

  /** 요청 스코프에 맞는 소스 인스턴스 */
  async resolveSource(company: string, plant: string): Promise<SpcDataSource> {
    const setting = await this.resolveSourceSetting();
    if (setting === 'DB') {
      return new DbSpcSource(
        { chartRepo: this.chartRepo, dataRepo: this.dataRepo, processRepo: this.processRepo, itemRepo: this.itemRepo },
        { company, plant },
      );
    }
    return new MockSpcSource();
  }

  /** 관리대상 목록 + 요약 (원본 `?mode=targets`) */
  async getTargets(company: string, plant: string, query: HvSpcQuery): Promise<SpcTargetsResponse> {
    const source = await this.resolveSource(company, plant);
    const range = dateRange(query.days);
    const targets = await source.listTargets();
    const subgroupsById = await source.fetchSubgroupsMany(targets, query.days);
    const rows = targets.map(
      (t) => buildTargetData(t, subgroupsById.get(t.id) ?? [], { kLimit: query.kLimit }, range, source.kind).target,
    );
    return { sourceKind: source.kind, ...range, targets: rows };
  }

  /** 관리대상 상세 (원본 `?targetId=`) — 없으면 404 */
  async getTarget(company: string, plant: string, targetId: string, query: HvSpcQuery): Promise<SpcTargetData> {
    const source = await this.resolveSource(company, plant);
    const range = dateRange(query.days);
    const target = (await source.listTargets()).find((t) => t.id === targetId);
    if (!target) {
      throw new NotFoundException(`알 수 없는 관리대상입니다: ${targetId}`);
    }
    const raw = await source.fetchSubgroups(target, query.days);
    return buildTargetData(target, raw, { kLimit: query.kLimit }, range, source.kind);
  }
}
