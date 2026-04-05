/**
 * @file services/sensor-monitor.service.ts
 * @description 센서 데이터 수신 및 조건 감시 서비스 — 예지보전(CBM) 핵심 로직
 *
 * 초보자 가이드:
 * 1. receiveSensorData(): 센서 데이터 저장 + 규칙 평가 + 자동 조치
 * 2. checkConditionRules(): 임계치 비교 → ALERT / AUTO_WO / INTERLOCK
 * 3. Condition Rule CRUD: 설비별 임계치 규칙 관리
 * 4. Sensor Data Query: 센서 데이터 이력 조회
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorDataLog } from '../../../entities/sensor-data-log.entity';
import { EquipConditionRule } from '../../../entities/equip-condition-rule.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { PmPlan } from '../../../entities/pm-plan.entity';
import { PmWorkOrder } from '../../../entities/pm-work-order.entity';
import {
  PostSensorDataDto,
  SensorDataQueryDto,
  CreateConditionRuleDto,
  UpdateConditionRuleDto,
  ConditionRuleQueryDto,
} from '../dto/sensor-monitor.dto';

@Injectable()
export class SensorMonitorService {
  private readonly logger = new Logger(SensorMonitorService.name);

  constructor(
    @InjectRepository(SensorDataLog)
    private readonly sensorDataRepo: Repository<SensorDataLog>,
    @InjectRepository(EquipConditionRule)
    private readonly ruleRepo: Repository<EquipConditionRule>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepo: Repository<EquipMaster>,
    @InjectRepository(PmPlan)
    private readonly pmPlanRepo: Repository<PmPlan>,
    @InjectRepository(PmWorkOrder)
    private readonly pmWorkOrderRepo: Repository<PmWorkOrder>,
  ) {}

  // ─── 센서 데이터 수신 ────────────────────────────────────

  /** 센서 데이터 일괄 수신 + 규칙 평가 + USAGE_BASED 업데이트 */
  async receiveSensorData(dto: PostSensorDataDto, company?: string, plant?: string) {
    const { items } = dto;

    // 1. 센서 데이터 저장
    const logs = items.map((item) =>
      this.sensorDataRepo.create({
        equipCode: item.equipCode,
        sensorType: item.sensorType,
        value: item.value,
        unit: item.unit ?? null,
        measuredAt: item.measuredAt ? new Date(item.measuredAt) : new Date(),
        company: company ?? null,
        plant: plant ?? null,
      }),
    );
    await this.sensorDataRepo.save(logs);

    // 2. 규칙 평가
    let alerts = 0;
    let warnings = 0;
    let autoWoCreated = 0;
    let interlocked = 0;

    // 고유 (equipCode, sensorType) 조합 추출
    const uniqueKeys = new Map<string, { equipCode: string; sensorType: string; value: number }>();
    for (const item of items) {
      const key = `${item.equipCode}::${item.sensorType}`;
      // 같은 키의 마지막 값 사용
      uniqueKeys.set(key, { equipCode: item.equipCode, sensorType: item.sensorType, value: item.value });
    }

    // 모든 관련 규칙을 한 번에 조회 (N+1 방지)
    const equipCodes = [...new Set(items.map((i) => i.equipCode))];
    const sensorTypes = [...new Set(items.map((i) => i.sensorType))];

    const allRules = equipCodes.length > 0
      ? await this.ruleRepo
          .createQueryBuilder('r')
          .where('r.equipCode IN (:...equipCodes)', { equipCodes })
          .andWhere('r.sensorType IN (:...sensorTypes)', { sensorTypes })
          .andWhere('r.useYn = :yn', { yn: 'Y' })
          .getMany()
      : [];

    // 규칙을 키별로 그룹핑
    const ruleMap = new Map<string, EquipConditionRule[]>();
    for (const rule of allRules) {
      const key = `${rule.equipCode}::${rule.sensorType}`;
      const list = ruleMap.get(key) || [];
      list.push(rule);
      ruleMap.set(key, list);
    }

    for (const [key, { equipCode, sensorType, value }] of uniqueKeys) {
      const rules = ruleMap.get(key) || [];

      for (const rule of rules) {
        // WARNING 체크
        if (rule.warningValue != null && this.isTriggered(value, rule.warningValue, rule.compareOp)) {
          warnings++;
          this.logger.warn(
            `[WARNING] ${equipCode}/${sensorType}: ${value} ${rule.compareOp} ${rule.warningValue}`,
          );
        }

        // CRITICAL 체크
        if (rule.criticalValue != null && this.isTriggered(value, rule.criticalValue, rule.compareOp)) {
          alerts++;
          this.logger.error(
            `[CRITICAL] ${equipCode}/${sensorType}: ${value} ${rule.compareOp} ${rule.criticalValue}`,
          );

          // 조치 실행
          if (rule.actionType === 'AUTO_WO' && rule.pmPlanCode) {
            try {
              const workOrderNo = await this.generateWoNumber();
              const wo = this.pmWorkOrderRepo.create({
                workOrderNo,
                pmPlanCode: rule.pmPlanCode,
                equipCode: rule.equipCode,
                woType: 'PREDICTIVE',
                scheduledDate: new Date(),
                dueDate: new Date(),
                status: 'PLANNED',
                priority: 'HIGH',
                remark: `자동생성: ${rule.sensorType} ${value} ${rule.compareOp} ${rule.criticalValue}`,
                company: rule.company,
                plant: rule.plant,
              });
              await this.pmWorkOrderRepo.save(wo);
              autoWoCreated++;
            } catch (error: unknown) {
              this.logger.error(`AUTO_WO 생성 실패: ${error instanceof Error ? error.message : error}`);
            }
          }

          if (rule.actionType === 'INTERLOCK') {
            try {
              await this.equipMasterRepo.update(
                { equipCode: rule.equipCode },
                { status: 'INTERLOCK' },
              );
              interlocked++;
              this.logger.warn(`[INTERLOCK] 설비 ${rule.equipCode} 정지`);
            } catch (error: unknown) {
              this.logger.error(`INTERLOCK 실패: ${error instanceof Error ? error.message : error}`);
            }
          }
        }
      }

      // 3. USAGE_BASED PM 계획 업데이트
      const usagePlans = await this.pmPlanRepo.find({
        where: { equipCode, pmType: 'USAGE_BASED', usageField: sensorType, useYn: 'Y' },
      });
      for (const plan of usagePlans) {
        await this.pmPlanRepo.update(
          { planCode: plan.planCode },
          { currentUsage: value },
        );
      }
    }

    return { saved: items.length, alerts, warnings, autoWoCreated, interlocked };
  }

  // ─── 센서 데이터 조회 ────────────────────────────────────

  /** 센서 데이터 이력 조회 */
  async querySensorData(query: SensorDataQueryDto) {
    const { equipCode, sensorType, from, to, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const qb = this.sensorDataRepo.createQueryBuilder('s');

    if (equipCode) qb.andWhere('s.equipCode = :equipCode', { equipCode });
    if (sensorType) qb.andWhere('s.sensorType = :sensorType', { sensorType });
    if (from) qb.andWhere('s.measuredAt >= :from', { from: new Date(from) });
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('s.measuredAt <= :to', { to: toDate });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('s.measuredAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  // ─── 조건 규칙 CRUD ────────────────────────────────────

  /** 규칙 목록 조회 */
  async findAllRules(query: ConditionRuleQueryDto) {
    const { equipCode, sensorType, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const qb = this.ruleRepo.createQueryBuilder('r');

    if (equipCode) qb.andWhere('r.equipCode = :equipCode', { equipCode });
    if (sensorType) qb.andWhere('r.sensorType = :sensorType', { sensorType });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /** 규칙 생성 */
  async createRule(dto: CreateConditionRuleDto, company?: string, plant?: string) {
    const rule = this.ruleRepo.create({
      equipCode: dto.equipCode,
      sensorType: dto.sensorType,
      warningValue: dto.warningValue ?? null,
      criticalValue: dto.criticalValue ?? null,
      compareOp: dto.compareOp || 'GT',
      actionType: dto.actionType || 'ALERT',
      pmPlanCode: dto.pmPlanCode ?? null,
      company: company ?? null,
      plant: plant ?? null,
    });
    return this.ruleRepo.save(rule);
  }

  /** 규칙 수정 */
  async updateRule(ruleId: number, dto: UpdateConditionRuleDto) {
    const rule = await this.ruleRepo.findOne({ where: { ruleId } });
    if (!rule) throw new NotFoundException(`규칙을 찾을 수 없습니다: ${ruleId}`);

    if (dto.warningValue !== undefined) rule.warningValue = dto.warningValue;
    if (dto.criticalValue !== undefined) rule.criticalValue = dto.criticalValue;
    if (dto.compareOp !== undefined) rule.compareOp = dto.compareOp;
    if (dto.actionType !== undefined) rule.actionType = dto.actionType;
    if (dto.pmPlanCode !== undefined) rule.pmPlanCode = dto.pmPlanCode;
    if (dto.useYn !== undefined) rule.useYn = dto.useYn;

    return this.ruleRepo.save(rule);
  }

  /** 규칙 삭제 */
  async deleteRule(ruleId: number) {
    const rule = await this.ruleRepo.findOne({ where: { ruleId } });
    if (!rule) throw new NotFoundException(`규칙을 찾을 수 없습니다: ${ruleId}`);
    await this.ruleRepo.delete({ ruleId });
    return { ruleId, deleted: true };
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────

  /** 임계치 비교 */
  private isTriggered(value: number, threshold: number, op: string): boolean {
    switch (op) {
      case 'GT': return value > threshold;
      case 'GTE': return value >= threshold;
      case 'LT': return value < threshold;
      case 'LTE': return value <= threshold;
      default: return value > threshold;
    }
  }

  /** CBM WO 번호 채번: CBM-YYYYMMDD-NNN */
  private async generateWoNumber(): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `CBM-${dateStr}-`;

    const lastWo = await this.pmWorkOrderRepo
      .createQueryBuilder('wo')
      .where('wo.workOrderNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('wo.workOrderNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastWo) {
      const lastSeq = parseInt(lastWo.workOrderNo.substring(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
