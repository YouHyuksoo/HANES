/**
 * @file src/modules/equipment/services/equip-inspect.service.ts
 * @description 설비 점검 비즈니스 로직 서비스 (일상/정기 점검 공용) (TypeORM)
 *
 * 초보자 가이드:
 * 1. **CRUD**: 점검 결과 생성/조회/수정/삭제
 * 2. **inspectType**: 'DAILY'(일상), 'PERIODIC'(정기)로 구분
 * 3. EquipInspectLog 테이블 사용
 * 4. **인터락**: 점검 결과가 FAIL이면 해당 설비의 STATUS를 'INTERLOCK'으로 자동 변경
 * 5. **복합키**: equipCode + inspectType + inspectDate
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectLog)
    private readonly equipInspectLogRepository: Repository<EquipInspectLog>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(EquipInspectItemMaster)
    private readonly inspectItemRepository: Repository<EquipInspectItemMaster>,
  ) {}

  /** 오늘 해당 설비의 점검 완료 여부 확인 */
  async checkAlreadyInspected(
    equipCode: string,
    inspectDate: string,
    inspectType: string,
  ): Promise<boolean> {
    const count = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.equipCode = :equipCode', { equipCode })
      .andWhere('log.inspectType = :inspectType', { inspectType })
      .andWhere('TRUNC(log.inspectDate) = TO_DATE(:inspectDate, \'YYYY-MM-DD\')', { inspectDate })
      .getCount();
    return count > 0;
  }

  /** 점검 목록 조회 */
  async findAll(query: EquipInspectQueryDto, company?: string, plant?: string) {
    const {
      page = 1, limit = 10, equipCode, inspectType,
      overallResult, search, inspectDateFrom, inspectDateTo,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect(EquipMaster, 'equip', 'log.equipCode = equip.equipCode')
      .select([
        'log',
        'equip.equipCode AS equip_code',
        'equip.equipName AS equip_name',
        'equip.lineCode AS equip_lineCode',
      ]);

    if (company) {
      queryBuilder.andWhere('log.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('log.plant = :plant', { plant });
    }
    if (equipCode) {
      queryBuilder.andWhere('log.equipCode = :equipCode', { equipCode });
    }
    if (inspectType) {
      queryBuilder.andWhere('log.inspectType = :inspectType', { inspectType });
    }
    if (overallResult) {
      queryBuilder.andWhere('log.overallResult = :overallResult', { overallResult });
    }
    if (inspectDateFrom) {
      queryBuilder.andWhere('log.inspectDate >= :inspectDateFrom', { inspectDateFrom: new Date(inspectDateFrom) });
    }
    if (inspectDateTo) {
      queryBuilder.andWhere('log.inspectDate <= :inspectDateTo', { inspectDateTo: new Date(inspectDateTo) });
    }
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(log.inspectorName) LIKE LOWER(:search) OR LOWER(equip.equipCode) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    const [logs, total] = await Promise.all([
      queryBuilder
        .orderBy('log.inspectDate', 'DESC')
        .skip(skip)
        .take(limit)
        .getRawMany(),
      queryBuilder.getCount(),
    ]);

    const data = logs.map((log) => ({
      ...log.log,
      equip: {
        equipCode: log.equip_code,
        equipName: log.equip_name,
        lineCode: log.equip_lineCode,
      },
    }));

    return { data, total, page, limit };
  }

  /** 점검 단건 조회 (복합키) */
  async findByKey(equipCode: string, inspectType: string, inspectDate: string) {
    const log = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.equipCode = :equipCode', { equipCode })
      .andWhere('log.inspectType = :inspectType', { inspectType })
      .andWhere('TRUNC(log.inspectDate) = TO_DATE(:inspectDate, \'YYYY-MM-DD\')', { inspectDate })
      .getOne();

    if (!log) {
      throw new NotFoundException(
        `점검 기록을 찾을 수 없습니다: ${equipCode}/${inspectType}/${inspectDate}`,
      );
    }

    const equip = await this.equipMasterRepository.findOne({
      where: { equipCode: log.equipCode },
      select: ['equipCode', 'equipName', 'lineCode'],
    });

    return {
      ...log,
      equip: equip || null,
    };
  }

  /** 점검 결과 등록 */
  async create(
    dto: CreateEquipInspectDto,
    context?: { company: string; plant: string },
  ) {
    const equip = await this.equipMasterRepository.findOne({
      where: { equipCode: dto.equipCode },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);

    const log = this.equipInspectLogRepository.create({
      equipCode: dto.equipCode,
      inspectType: dto.inspectType,
      inspectDate: new Date(dto.inspectDate),
      inspectorName: dto.inspectorName,
      overallResult: dto.overallResult ?? 'PASS',
      details: dto.details ? JSON.stringify(dto.details) : null,
      remark: dto.remark,
      company: context?.company || equip.company,
      plant: context?.plant || equip.plant,
    });

    const saved = await this.equipInspectLogRepository.save(log);

    if (saved.overallResult && saved.overallResult.toUpperCase().includes('FAIL')) {
      await this.equipMasterRepository.update(
        { equipCode: equip.equipCode },
        { status: 'INTERLOCK' },
      );
    }

    return {
      ...saved,
      equip: {
        equipCode: equip.equipCode,
        equipName: equip.equipName,
        lineCode: equip.lineCode,
      },
    };
  }

  /** 점검 결과 수정 (복합키) */
  async update(equipCode: string, inspectType: string, inspectDate: string, dto: UpdateEquipInspectDto) {
    const log = await this.findByKey(equipCode, inspectType, inspectDate);

    const updateData: Partial<EquipInspectLog> = {};

    if (dto.inspectorName !== undefined) updateData.inspectorName = dto.inspectorName;
    if (dto.overallResult !== undefined) updateData.overallResult = dto.overallResult;
    if (dto.details !== undefined) updateData.details = dto.details ? JSON.stringify(dto.details) : null;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.equipInspectLogRepository
      .createQueryBuilder()
      .update(EquipInspectLog)
      .set(updateData)
      .where('equipCode = :equipCode', { equipCode })
      .andWhere('inspectType = :inspectType', { inspectType })
      .andWhere('TRUNC(inspectDate) = TO_DATE(:inspectDate, \'YYYY-MM-DD\')', { inspectDate })
      .execute();

    const equip = await this.equipMasterRepository.findOne({
      where: { equipCode },
      select: ['equipCode', 'equipName', 'lineCode'],
    });

    const updated = await this.findByKey(equipCode, inspectType, inspectDate);

    const finalResult = updated?.overallResult ?? '';
    if (finalResult.toUpperCase().includes('FAIL')) {
      await this.equipMasterRepository.update(
        { equipCode },
        { status: 'INTERLOCK' },
      );
    }

    return {
      ...updated,
      equip: equip || null,
    };
  }

  /** 점검 결과 삭제 (복합키) */
  async deleteByKey(equipCode: string, inspectType: string, inspectDate: string) {
    await this.findByKey(equipCode, inspectType, inspectDate);
    await this.equipInspectLogRepository
      .createQueryBuilder()
      .delete()
      .from(EquipInspectLog)
      .where('equipCode = :equipCode', { equipCode })
      .andWhere('inspectType = :inspectType', { inspectType })
      .andWhere('TRUNC(inspectDate) = TO_DATE(:inspectDate, \'YYYY-MM-DD\')', { inspectDate })
      .execute();
    return { equipCode, inspectType, inspectDate, deleted: true };
  }

  /**
   * cycle에 따라 해당 날짜가 점검 대상인지 판정
   * DAILY → 매일, WEEKLY → 월요일(dayOfWeek===1), MONTHLY → 매월 1일
   */
  private isDue(cycle: string | null, date: Date): boolean {
    const c = (cycle || 'DAILY').toUpperCase();
    if (c === 'DAILY') return true;
    if (c === 'WEEKLY') return date.getDay() === 1;
    if (c === 'MONTHLY') return date.getDate() === 1;
    return true;
  }

  /** 캘린더 월별 요약 조회 */
  async getCalendarSummary(year: number, month: number, processCode?: string, inspectType: string = 'DAILY') {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59);

    const equipWhere: Record<string, unknown> = { useYn: 'Y' };
    if (processCode) equipWhere.processCode = processCode;
    const equips = await this.equipMasterRepository.find({ where: equipWhere, select: ['equipCode', 'lineCode'] });
    const equipIds = equips.map((e) => e.equipCode);
    if (equipIds.length === 0) {
      return Array.from({ length: daysInMonth }, (_, i) => ({
        date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        total: 0, completed: 0, pass: 0, fail: 0, status: 'NONE',
      }));
    }

    const allItems = await this.inspectItemRepository
      .createQueryBuilder('item')
      .where('item.inspectType = :type', { type: inspectType })
      .andWhere('item.useYn = :yn', { yn: 'Y' })
      .andWhere('item.equipCode IN (:...equipCodes)', { equipCodes: equipIds })
      .getMany();

    const itemsByEquip = new Map<string, EquipInspectItemMaster[]>();
    for (const item of allItems) {
      const list = itemsByEquip.get(item.equipCode) || [];
      list.push(item);
      itemsByEquip.set(item.equipCode, list);
    }

    const logs = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.inspectType = :type', { type: inspectType })
      .andWhere('log.inspectDate BETWEEN :start AND :end', {
        start: startDate, end: endDate,
      })
      .andWhere('log.equipCode IN (:...equipCodes)', { equipCodes: equipIds })
      .getMany();

    const logsByDate = new Map<string, EquipInspectLog[]>();
    for (const log of logs) {
      const d = new Date(log.inspectDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = logsByDate.get(key) || [];
      list.push(log);
      logsByDate.set(key, list);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      let totalEquips = 0;
      for (const [, items] of itemsByEquip) {
        const hasDue = items.some((item) => this.isDue(item.cycle, dateObj));
        if (hasDue) totalEquips++;
      }

      const dayLogs = logsByDate.get(dateStr) || [];
      const completedEquipIds = new Set(dayLogs.map((l) => l.equipCode));
      const completed = completedEquipIds.size;
      const pass = dayLogs.filter((l) => l.overallResult === 'PASS').length;
      const fail = dayLogs.filter((l) => l.overallResult !== 'PASS').length;

      let status = 'NONE';
      if (totalEquips === 0) {
        status = 'NONE';
      } else if (completed >= totalEquips && fail === 0) {
        status = 'ALL_PASS';
      } else if (fail > 0) {
        status = 'HAS_FAIL';
      } else if (completed > 0 && completed < totalEquips) {
        status = 'IN_PROGRESS';
      } else if (completed === 0) {
        status = dateObj < today ? 'OVERDUE' : 'NOT_STARTED';
      }

      result.push({ date: dateStr, total: totalEquips, completed, pass, fail, status });
    }

    return result;
  }

  /** 캘린더 일별 설비 점검 스케줄 조회 */
  async getDaySchedule(date: string, processCode?: string, inspectType: string = 'DAILY') {
    const dateObj = new Date(date);

    const equipWhere: Record<string, unknown> = { useYn: 'Y' };
    if (processCode) equipWhere.processCode = processCode;
    const equips = await this.equipMasterRepository.find({
      where: equipWhere,
      select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
    });
    if (equips.length === 0) return [];

    const equipIds = equips.map((e) => e.equipCode);

    const allItems = await this.inspectItemRepository
      .createQueryBuilder('item')
      .where('item.inspectType = :type', { type: inspectType })
      .andWhere('item.useYn = :yn', { yn: 'Y' })
      .andWhere('item.equipCode IN (:...equipCodes)', { equipCodes: equipIds })
      .orderBy('item.seq', 'ASC')
      .getMany();

    const itemsByEquip = new Map<string, EquipInspectItemMaster[]>();
    for (const item of allItems) {
      const list = itemsByEquip.get(item.equipCode) || [];
      list.push(item);
      itemsByEquip.set(item.equipCode, list);
    }

    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const logs = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.inspectType = :type', { type: inspectType })
      .andWhere('log.inspectDate BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
      .andWhere('log.equipCode IN (:...equipCodes)', { equipCodes: equipIds })
      .getMany();

    const logByEquip = new Map<string, EquipInspectLog>();
    for (const log of logs) {
      logByEquip.set(log.equipCode, log);
    }

    const result = [];
    for (const equip of equips) {
      const items = itemsByEquip.get(equip.equipCode) || [];
      const dueItems = items.filter((item) => this.isDue(item.cycle, dateObj));
      if (dueItems.length === 0) continue;

      const log = logByEquip.get(equip.equipCode);
      let details: { items?: Array<{ itemId: number; seq: number; itemName: string; result: string; remark: string }> } | null = null;
      if (log?.details) {
        try { details = JSON.parse(log.details); } catch { details = null; }
      }

      const itemResults = dueItems.map((item) => {
        const detailItem = details?.items?.find((d) => d.seq === item.seq || d.itemName === item.itemName);
        return {
          itemId: `${item.equipCode}_${item.inspectType}_${item.seq}`,
          seq: item.seq,
          itemName: item.itemName,
          criteria: item.criteria,
          cycle: item.cycle || 'DAILY',
          result: detailItem?.result || null,
          remark: detailItem?.remark || '',
        };
      });

      result.push({
        equipCode: equip.equipCode,
        equipName: equip.equipName,
        lineCode: equip.lineCode,
        equipType: equip.equipType,
        inspected: !!log,
        overallResult: log?.overallResult || null,
        inspectorName: log?.inspectorName || null,
        items: itemResults,
      });
    }

    return result;
  }

  /** 점검 통계 요약 */
  async getSummary(inspectType?: string) {
    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log');

    if (inspectType) {
      queryBuilder.where('log.inspectType = :inspectType', { inspectType });
    }

    const total = await queryBuilder.getCount();

    const byResult = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .select('log.overallResult', 'result')
      .addSelect('COUNT(*)', 'count')
      .where(inspectType ? 'log.inspectType = :inspectType' : '1=1', inspectType ? { inspectType } : {})
      .groupBy('log.overallResult')
      .getRawMany();

    return {
      total,
      byResult: byResult.map((r) => ({ result: r.result, count: parseInt(r.count, 10) })),
    };
  }
}
