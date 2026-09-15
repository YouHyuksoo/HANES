/**
 * @file equip-inspect-gate.service.ts
 * @description 설비점검(DAILY/WORKER) 인터락 판정 단일 출처 — 생산실적과 검사가 같은 함수를 호출한다.
 *
 * 초보자 가이드:
 * 1. equipCode가 없거나 sys-config EQUIP_INSPECT_INTERLOCK='N' 이면 통과
 * 2. EQUIP_INSPECT_ITEM_POOL 에 해당 설비의 DAILY/WORKER 항목이 없으면 점검 대상이 아니므로 통과
 * 3. DAILY는 조업일 window, WORKER는 작업지시(orderNo) 기준으로 완료 여부를 본다
 * 4. 기록이 있어도 종합판정이 PASS가 아니면 차단한다 (재점검으로 PASS가 되어야 진행)
 * 5. subject는 오류 문구의 대상어다. 생산실적='실적', 검사='검사'
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectService } from './equip-inspect.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { formatYmdLocal } from '../../../shared/date.util';

/** 설비점검 인터록 sys-config 키. 값이 없으면(null) 켜진 것으로 본다(기본 Y). 'N'일 때만 끈다. */
const EQUIP_INSPECT_INTERLOCK_KEY = 'EQUIP_INSPECT_INTERLOCK';

export type InspectGateScope = 'ASSEMBLY' | 'SUBASSEMBLY' | 'INSPECTION';

const SCOPE_CONFIG_KEYS: Record<InspectGateScope, { daily: string; worker: string }> = {
  ASSEMBLY: { daily: 'ASSEMBLY_DAILY_INSPECT_REQUIRED', worker: 'ASSEMBLY_WORKER_INSPECT_REQUIRED' },
  SUBASSEMBLY: { daily: 'SUBASSEMBLY_DAILY_INSPECT_REQUIRED', worker: 'SUBASSEMBLY_WORKER_INSPECT_REQUIRED' },
  INSPECTION: { daily: 'INSPECT_DAILY_INSPECT_REQUIRED', worker: 'INSPECT_WORKER_INSPECT_REQUIRED' },
};

/** 한국어 목적격 조사 — 받침이 있으면 '을', 없으면 '를' (실적을 / 검사를) */
function withObjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinalConsonant ? '을' : '를'}`;
}

export interface InspectGateStatus {
  dailyRequired: boolean;
  dailyDone: boolean;
  dailyResult: string | null;
  dailyInspectedAt: string | null;
  workerRequired: boolean;
  workerDone: boolean;
  workerResult: string | null;
  workerInspectedAt: string | null;
  blocked: boolean;
  blockReason: string | null;
}

export interface InspectGateArgs {
  equipCode?: string | null;
  orderNo?: string | null;
  scope?: InspectGateScope;
}

export interface InspectGateTenant {
  company?: string;
  plant?: string;
}

@Injectable()
export class EquipInspectGateService {
  constructor(
    @InjectRepository(EquipInspectItemPool)
    private readonly poolRepository: Repository<EquipInspectItemPool>,
    private readonly equipInspectService: EquipInspectService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  /** 점검 대상이 아니거나 인터록이 꺼진 상태 — 통과로 본다. */
  private passThrough(): InspectGateStatus {
    return {
      dailyRequired: false,
      dailyDone: true,
      dailyResult: null,
      dailyInspectedAt: null,
      workerRequired: false,
      workerDone: true,
      workerResult: null,
      workerInspectedAt: null,
      blocked: false,
      blockReason: null,
    };
  }

  async getGateStatus(
    args: InspectGateArgs,
    tenant: InspectGateTenant,
    subject = '실적',
  ): Promise<InspectGateStatus> {
    const equipCode = args.equipCode?.trim();
    if (!equipCode) return this.passThrough();

    const configValue = await this.sysConfigService.getValue(
      EQUIP_INSPECT_INTERLOCK_KEY,
      tenant.company,
      tenant.plant,
    );
    if (typeof configValue === 'string' && configValue.trim().toUpperCase() === 'N') {
      return this.passThrough();
    }

    const requiredKeys = args.scope ? SCOPE_CONFIG_KEYS[args.scope] : undefined;
    const [dailyValue, workerValue] = requiredKeys
      ? await Promise.all([
        this.sysConfigService.getValue(requiredKeys.daily, tenant.company, tenant.plant),
        this.sysConfigService.getValue(requiredKeys.worker, tenant.company, tenant.plant),
      ])
      : [null, null];
    const dailyEnabled = !requiredKeys || dailyValue == null || dailyValue.trim().toUpperCase() !== 'N';
    const workerEnabled = !requiredKeys || workerValue == null || workerValue.trim().toUpperCase() !== 'N';

    const poolItems = await this.poolRepository.find({
      where: {
        equipCode,
        useYn: 'Y',
        inspectType: In(['DAILY', 'WORKER']),
        ...(tenant.company ? { company: tenant.company } : {}),
        ...(tenant.plant ? { plant: tenant.plant } : {}),
      },
    });
    const dailyRequired = dailyEnabled && poolItems.some((item) => item.inspectType === 'DAILY');
    const workerRequired = workerEnabled && poolItems.some((item) => item.inspectType === 'WORKER');
    if (!dailyRequired && !workerRequired) return this.passThrough();

    const today = formatYmdLocal(new Date());
    const subjectPhrase = withObjectParticle(subject);
    const status: InspectGateStatus = { ...this.passThrough(), dailyRequired, workerRequired };
    if (dailyRequired) status.dailyDone = false;
    if (workerRequired) status.workerDone = false;

    if (dailyRequired) {
      const daily = await this.equipInspectService.getInspectionStatus(
        { equipCode, inspectType: 'DAILY', inspectDate: today },
        { company: tenant.company, plant: tenant.plant },
      );
      status.dailyResult = daily.overallResult ?? null;
      status.dailyInspectedAt = daily.inspectedAt ?? null;
      status.dailyDone = Boolean(daily.alreadyInspected && daily.inspectPassed);
      if (!daily.alreadyInspected) {
        status.blocked = true;
        status.blockReason = `설비 일상점검을 완료해야 ${subjectPhrase} 등록할 수 있습니다: ${equipCode}`;
        return status;
      }
      // 완료됐어도 종합판정이 PASS가 아니면 차단한다 (재점검으로 PASS가 되어야 진행).
      if (!daily.inspectPassed) {
        status.blocked = true;
        status.blockReason = `설비 일상점검 종합판정이 불합격(${daily.overallResult ?? '미판정'})이므로 ${subjectPhrase} 등록할 수 없습니다: ${equipCode} — 조치 후 재점검하세요.`;
        return status;
      }
    }

    if (workerRequired) {
      if (!args.orderNo) {
        status.blocked = true;
        status.blockReason = `작업자 설비점검 확인에는 작업지시번호가 필요합니다: ${equipCode}`;
        return status;
      }
      const worker = await this.equipInspectService.getInspectionStatus(
        { equipCode, inspectType: 'WORKER', inspectDate: today, orderNo: args.orderNo },
        { company: tenant.company, plant: tenant.plant },
      );
      status.workerResult = worker.overallResult ?? null;
      status.workerInspectedAt = worker.inspectedAt ?? null;
      status.workerDone = Boolean(worker.alreadyInspected && worker.inspectPassed);
      if (!worker.alreadyInspected) {
        status.blocked = true;
        status.blockReason = `작업자 설비점검을 완료해야 ${subjectPhrase} 등록할 수 있습니다: ${equipCode} (작업지시 ${args.orderNo})`;
        return status;
      }
      if (!worker.inspectPassed) {
        status.blocked = true;
        status.blockReason = `작업자 설비점검 종합판정이 불합격(${worker.overallResult ?? '미판정'})이므로 ${subjectPhrase} 등록할 수 없습니다: ${equipCode} (작업지시 ${args.orderNo}) — 조치 후 재점검하세요.`;
        return status;
      }
    }

    return status;
  }

  /** 미완료·NG면 BadRequestException. 화면 우회 호출도 같은 규칙으로 막는다. */
  async assertGate(args: InspectGateArgs, tenant: InspectGateTenant, subject = '실적'): Promise<void> {
    const status = await this.getGateStatus(args, tenant, subject);
    if (status.blocked && status.blockReason) {
      throw new BadRequestException(status.blockReason);
    }
  }
}
