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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto } from '../dto/equip-inspect.dto';

type InspectType = 'DAILY' | 'PERIODIC' | 'WORKER';

interface InspectionStatusQuery {
  equipCode: string;
  inspectType?: string;
  inspectDate?: string;
  orderNo?: string;
  at?: Date;
}

interface TenantContext {
  company?: string;
  plant?: string;
}

interface OperationalWindow {
  workDate: string;
  windowStart: Date;
  windowEnd: Date;
  startTime: string;
}

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectLog)
    private readonly equipInspectLogRepository: Repository<EquipInspectLog>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(EquipInspectItemPool)
    private readonly inspectItemRepository: Repository<EquipInspectItemPool>,
    @InjectRepository(WorkCalendar)
    private readonly calendarRepository: Repository<WorkCalendar>,
    @InjectRepository(WorkCalendarDay)
    private readonly calendarDayRepository: Repository<WorkCalendarDay>,
    @InjectRepository(ShiftPattern)
    private readonly shiftPatternRepository: Repository<ShiftPattern>,
  ) {}

  /**
   * 오늘 해당 설비의 점검 "기록 존재" 여부만 확인한다.
   *
   * 주의: 종합판정(OVERALL_RESULT)을 보지 않으므로 NG로 점검된 설비도 true를 반환한다.
   * 생산 인터록처럼 "진행 가능한가"를 판정하는 용도로 쓰면 안 된다 —
   * 그 경우 `getInspectionStatus().inspectPassed`(기록 존재 + 판정 PASS)를 사용한다.
   * 재점검 안내처럼 "기록이 있는가"를 묻는 용도에만 쓴다.
   */
  async checkAlreadyInspected(
    equipCode: string,
    inspectDate: string,
    inspectType: string,
    company?: string,
    plant?: string,
  ): Promise<boolean> {
    const status = await this.getInspectionStatus(
      { equipCode, inspectType, inspectDate },
      { company, plant },
    );
    return status.alreadyInspected;
  }

  async getInspectionStatus(query: InspectionStatusQuery, context?: TenantContext) {
    const inspectType = this.normalizeInspectType(query.inspectType);
    if (inspectType === 'WORKER' && !query.orderNo) {
      throw new BadRequestException('작업자설비점검 완료 여부 확인에는 작업지시번호가 필요합니다.');
    }

    const equip = await this.findEquipment(query.equipCode, context);
    const operationalWindow = inspectType === 'WORKER'
      ? null
      : await this.resolveOperationalWindow(equip, query.at ?? this.resolveReferenceTime(query.inspectDate));

    const queryBuilder = this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.equipCode = :equipCode', { equipCode: query.equipCode })
      .andWhere('log.inspectType = :inspectType', { inspectType });
    if (context?.company) queryBuilder.andWhere('log.company = :company', { company: context.company });
    if (context?.plant) queryBuilder.andWhere('log.plant = :plant', { plant: context.plant });

    if (inspectType === 'WORKER') {
      queryBuilder.andWhere('log.orderNo = :orderNo', { orderNo: query.orderNo });
    } else if (operationalWindow) {
      queryBuilder.andWhere('log.workDate = TO_DATE(:workDate, \'YYYY-MM-DD\')', {
        workDate: operationalWindow.workDate,
      });
    }

    // 최신 점검 로그 1건을 조회해 완료 여부와 점검 시각(INSPECT_AT)을 함께 반환한다.
    const latestLog = await queryBuilder
      .orderBy('log.inspectAt', 'DESC')
      .addOrderBy('log.createdAt', 'DESC')
      .getOne();
    const inspectedAtSource = latestLog?.inspectAt ?? latestLog?.createdAt ?? null;
    // 종합판정(OVERALL_RESULT)은 alreadyInspected와 분리해 내려준다.
    // alreadyInspected = "기록이 있다"(NG여도 true). 재점검 안내·PDA 경고가 이 의미에 의존한다.
    // inspectPassed  = "기록이 있고 종합판정이 PASS"(생산 인터록 판정용).
    // PASS 화이트리스트로 판정한다 — CONDITIONAL/NULL/공백이 조용히 통과하면 안 된다.
    const overallResult = latestLog?.overallResult ?? null;

    return {
      alreadyInspected: !!latestLog,
      overallResult,
      inspectPassed: !!latestLog && String(overallResult ?? '').toUpperCase() === 'PASS',
      inspectedAt: inspectedAtSource ? this.formatDateTime(inspectedAtSource) : null,
      inspectorName: latestLog?.inspectorName ?? null,
      equipCode: query.equipCode,
      inspectType,
      orderNo: query.orderNo ?? null,
      workDate: operationalWindow?.workDate ?? null,
      windowStart: operationalWindow ? this.formatDateTime(operationalWindow.windowStart) : null,
      windowEnd: operationalWindow ? this.formatDateTime(operationalWindow.windowEnd) : null,
      operationStartTime: operationalWindow?.startTime ?? null,
    };
  }

  /** 점검 목록 조회 */
  async findAll(query: EquipInspectQueryDto, company?: string, plant?: string) {
    const {
      page = 1, limit = 10, equipCode, inspectType, equipType,
      overallResult, search, inspectDateFrom, inspectDateTo, orderNo,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect(
        EquipMaster,
        'equip',
        'log.equipCode = equip.equipCode AND log.company = equip.company AND log.plant = equip.plant',
      )
      .select([
        'log',
        'equip.equipCode AS equip_code',
        'equip.equipName AS equip_name',
        'equip.equipType AS equip_type',
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
    if (equipType) {
      queryBuilder.andWhere('equip.equipType = :equipType', { equipType });
    }
    if (inspectType) {
      queryBuilder.andWhere('log.inspectType = :inspectType', { inspectType });
    }
    if (orderNo) {
      queryBuilder.andWhere('log.orderNo = :orderNo', { orderNo });
    }
    if (overallResult) {
      queryBuilder.andWhere('log.overallResult = :overallResult', { overallResult });
    }
    if (inspectDateFrom) {
      queryBuilder.andWhere("log.inspectDate >= TO_DATE(:inspectDateFrom, 'YYYY-MM-DD')", { inspectDateFrom });
    }
    if (inspectDateTo) {
      queryBuilder.andWhere("log.inspectDate < TO_DATE(:inspectDateTo, 'YYYY-MM-DD') + 1", { inspectDateTo });
    }
    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(log.inspectorName LIKE :searchRaw OR equip.equipCode LIKE :search)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }

    const [logs, total] = await Promise.all([
      queryBuilder
        .orderBy('log.inspectDate', 'DESC')
        .offset(skip)
        .limit(limit)
        .getRawMany(),
      queryBuilder.getCount(),
    ]);

    const rawValue = (row: Record<string, unknown>, ...keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined) return row[key];
      }
      return undefined;
    };

    const data = logs.map((log) => {
      const equipCode = log.log_EQUIP_CODE;
      const inspectType = log.log_INSPECT_TYPE;
      const inspectDate = log.log_INSPECT_DATE;
      const equipName = rawValue(log, 'equip_name', 'EQUIP_NAME') ?? null;
      const equipType = rawValue(log, 'equip_type', 'EQUIP_TYPE') ?? null;
      const lineCode = rawValue(log, 'equip_lineCode', 'EQUIP_LINECODE', 'EQUIP_LINE_CODE') ?? null;

      return {
        id: `${equipCode}::${inspectType}::${inspectDate instanceof Date ? inspectDate.toISOString() : inspectDate}`,
        equipCode,
        inspectType,
        inspectDate,
        orderNo: log.log_ORDER_NO ?? null,
        workDate: log.log_WORK_DATE ?? null,
        inspectAt: log.log_INSPECT_AT ?? null,
        opWindowStartAt: log.log_OP_WINDOW_START_AT ?? null,
        opWindowEndAt: log.log_OP_WINDOW_END_AT ?? null,
        inspectorName: log.log_INSPECTOR_NAME ?? null,
        overallResult: log.log_OVERALL_RESULT ?? null,
        details: log.log_DETAILS ?? null,
        remark: log.log_REMARK ?? null,
        company: log.log_COMPANY,
        plant: log.log_PLANT_CD,
        createdBy: log.log_CREATED_BY ?? null,
        updatedBy: log.log_UPDATED_BY ?? null,
        createdAt: log.log_CREATED_AT,
        updatedAt: log.log_UPDATED_AT,
        equipName,
        equipType,
        lineCode,
        equip: {
          equipCode: rawValue(log, 'equip_code', 'EQUIP_CODE') ?? equipCode,
          equipName,
          equipType,
          lineCode,
        },
      };
    });

    return { data, total, page, limit };
  }

  /** YYYY-MM-DD 가 아니면 400 (DB 변환 오류 500 방지) */
  private assertYmd(value: string, label: string): void {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    const ok = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getMonth() === Number(m[2]) - 1;
    if (!ok) throw new BadRequestException(`${label} 형식이 올바르지 않습니다(YYYY-MM-DD): ${value}`);
  }

  /** 상세(details) 항목 중 FAIL 이 있는지, 있으면 사유코드가 모두 있는지 확인한다. FAIL 항목이 있으면 true */
  private checkFailItems(details: unknown): boolean {
    const items = details && Array.isArray((details as { items?: unknown }).items)
      ? (details as { items: Array<{ result?: string; reasonCode?: string }> }).items
      : [];
    const failItems = items.filter((item) => item.result === 'FAIL');
    if (failItems.some((item) => !item.reasonCode?.trim())) {
      throw new BadRequestException('FAIL 점검 항목에는 불량 사유코드가 필요합니다.');
    }
    return failItems.length > 0;
  }

  /** 점검 단건 조회 (복합키) */
  async findByKey(
    equipCode: string,
    inspectType: string,
    inspectDate: string,
    company?: string,
    plant?: string,
  ) {
    this.assertYmd(inspectDate, '점검일');
    const log = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.equipCode = :equipCode', { equipCode })
      .andWhere('log.inspectType = :inspectType', { inspectType });
    if (inspectType === 'DAILY') {
      log.andWhere(
        "(log.workDate = TO_DATE(:inspectDate, 'YYYY-MM-DD') OR (log.workDate IS NULL AND log.inspectDate >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND log.inspectDate < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1))",
        { inspectDate },
      );
    } else {
      log.andWhere('log.inspectDate >= TO_DATE(:inspectDate, \'YYYY-MM-DD\') AND log.inspectDate < TO_DATE(:inspectDate, \'YYYY-MM-DD\') + 1', { inspectDate });
    }
    if (company) log.andWhere('log.company = :company', { company });
    if (plant) log.andWhere('log.plant = :plant', { plant });
    // 같은 키에 재점검이 쌓이면 최신 것을 단건으로 돌려준다.
    log.orderBy('log.inspectAt', 'DESC').addOrderBy('log.createdAt', 'DESC');
    const foundLog = await log.getOne();

    if (!foundLog) {
      throw new NotFoundException(
        `점검 기록을 찾을 수 없습니다: ${equipCode}/${inspectType}/${inspectDate}`,
      );
    }

    const equip = await this.equipMasterRepository.findOne({
      where: {
        equipCode: foundLog.equipCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['equipCode', 'equipName', 'lineCode'],
    });

    return {
      ...foundLog,
      equip: equip || null,
    };
  }

  /** 점검 결과 등록 */
  async create(
    dto: CreateEquipInspectDto,
    context?: { company: string; plant: string },
  ) {
    const equip = await this.findEquipment(dto.equipCode, context);
    const inspectType = this.normalizeInspectType(dto.inspectType);
    if (inspectType === 'WORKER' && !dto.orderNo) {
      throw new BadRequestException('작업자설비점검 저장에는 작업지시번호가 필요합니다.');
    }
    const inspectAt = dto.inspectAt ? new Date(dto.inspectAt) : new Date();
    const operationalWindow = await this.resolveOperationalWindow(
      equip,
      inspectType === 'WORKER'
        ? inspectAt
        : dto.inspectDate ? this.resolveReferenceTime(dto.inspectDate) : inspectAt,
    );
    // 이력은 동일 조업일/작업지시에서도 재점검할 수 있어 실제 점검시각을 PK 값으로 보존한다.
    // 완료 여부는 WORK_DATE/ORDER_NO 기준 최신 로그로 별도 판정한다.
    const inspectDate = inspectAt;

    // PDA 상세 결과에서 FAIL 항목은 원인 추적을 위해 사유코드를 필수로 받는다. 항목 중 FAIL 이 있으면 종합이 PASS 로 와도 FAIL 로 본다.
    const hasFailItem = this.checkFailItems(dto.details);
    let overallResult = dto.overallResult ?? 'PASS';
    if (hasFailItem && !overallResult.toUpperCase().includes('FAIL')) overallResult = 'FAIL';

    const logData = {
      equipCode: dto.equipCode,
      inspectType,
      inspectDate,
      orderNo: dto.orderNo ?? null,
      workDate: this.parseYmdLocal(operationalWindow.workDate),
      inspectAt,
      opWindowStartAt: operationalWindow.windowStart,
      opWindowEndAt: operationalWindow.windowEnd,
      inspectorName: dto.inspectorName,
      overallResult,
      details: dto.details ? JSON.stringify(dto.details) : null,
      remark: dto.remark,
      company: context?.company ?? equip.company,
      plant: context?.plant ?? equip.plant,
    };

    // 모든 점검 유형이 같은 경로로 저장된다. repository.save()는 INSPECT_DATE(Oracle DATE, TypeORM 'date')의
    // 시각을 잘라 00:00:00으로 넣어 설비·유형당 하루 1건만 허용하는 PK 충돌(ORA-00001 → 409)을 만든다.
    const saved = await this.insertInspectLog(logData);

    if (saved.overallResult && saved.overallResult.toUpperCase().includes('FAIL')) {
      await this.equipMasterRepository.update(
        {
          equipCode: equip.equipCode,
          ...(context?.company ? { company: context.company } : {}),
          ...(context?.plant ? { plant: context.plant } : {}),
        },
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

  private async insertInspectLog(log: Partial<EquipInspectLog>): Promise<EquipInspectLog> {
    // TypeORM Oracle DATE binding can persist date-only values; explicit TO_DATE keeps the PK time part.
    await this.equipInspectLogRepository.query(
      `INSERT INTO EQUIP_INSPECT_LOGS (
        EQUIP_CODE,
        INSPECT_TYPE,
        INSPECT_DATE,
        ORDER_NO,
        WORK_DATE,
        INSPECT_AT,
        OP_WINDOW_START_AT,
        OP_WINDOW_END_AT,
        INSPECTOR_NAME,
        OVERALL_RESULT,
        DETAILS,
        REMARK,
        COMPANY,
        PLANT_CD
      ) VALUES (
        :1,
        :2,
        TO_DATE(:3, 'YYYY-MM-DD HH24:MI:SS'),
        :4,
        TO_DATE(:5, 'YYYY-MM-DD'),
        TO_TIMESTAMP(:6, 'YYYY-MM-DD HH24:MI:SS.FF3'),
        TO_TIMESTAMP(:7, 'YYYY-MM-DD HH24:MI:SS.FF3'),
        TO_TIMESTAMP(:8, 'YYYY-MM-DD HH24:MI:SS.FF3'),
        :9,
        :10,
        :11,
        :12,
        :13,
        :14
      )`,
      [
        log.equipCode,
        log.inspectType,
        this.formatDateTime(log.inspectDate as Date),
        log.orderNo,
        this.formatYmdLocal(log.workDate as Date),
        this.formatDateTimeMillis(log.inspectAt as Date),
        this.formatDateTimeMillis(log.opWindowStartAt as Date),
        this.formatDateTimeMillis(log.opWindowEndAt as Date),
        log.inspectorName ?? null,
        log.overallResult ?? 'PASS',
        log.details ?? null,
        log.remark ?? null,
        log.company,
        log.plant,
      ],
    );

    const now = log.inspectAt instanceof Date ? log.inspectAt : new Date();
    return {
      ...log,
      createdAt: now,
      updatedAt: now,
    } as EquipInspectLog;
  }

  private assertTenantMatchesEquipment(
    context: { company: string; plant: string } | undefined,
    equip: EquipMaster,
  ): void {
    if (context?.company && context.company !== equip.company) {
      throw new BadRequestException(
        `요청 회사와 설비 회사가 일치하지 않습니다. request=${context.company}, equipment=${equip.company}`,
      );
    }
    if (context?.plant && context.plant !== equip.plant) {
      throw new BadRequestException(
        `요청 사업장과 설비 사업장이 일치하지 않습니다. request=${context.plant}, equipment=${equip.plant}`,
      );
    }
  }

  private async findEquipment(equipCode: string, context?: TenantContext): Promise<EquipMaster> {
    const equip = await this.equipMasterRepository.findOne({
      where: {
        equipCode,
        ...(context?.company ? { company: context.company } : {}),
        ...(context?.plant ? { plant: context.plant } : {}),
      },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    this.assertTenantMatchesEquipment(
      context?.company && context?.plant ? { company: context.company, plant: context.plant } : undefined,
      equip,
    );
    return equip;
  }

  private normalizeInspectType(value?: string): InspectType {
    if (value === 'WORKER') return 'WORKER';
    if (value === 'PERIODIC') return 'PERIODIC';
    return 'DAILY';
  }

  private resolveReferenceTime(inspectDate?: string): Date {
    if (!inspectDate) return new Date();
    const [year, month, day] = inspectDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  private async resolveOperationalWindow(equip: EquipMaster, at: Date): Promise<OperationalWindow> {
    const currentDate = this.formatYmdLocal(at);
    const currentStartTime = await this.resolveOperationStartTime(equip, currentDate);
    const currentStart = this.combineYmdTime(currentDate, currentStartTime);
    const workDate = at < currentStart ? this.addDaysYmd(currentDate, -1) : currentDate;
    const startTime = await this.resolveOperationStartTime(equip, workDate);
    const nextDate = this.addDaysYmd(workDate, 1);
    const nextStartTime = await this.resolveOperationStartTime(equip, nextDate);

    return {
      workDate,
      startTime,
      windowStart: this.combineYmdTime(workDate, startTime),
      windowEnd: this.combineYmdTime(nextDate, nextStartTime),
    };
  }

  private async resolveOperationStartTime(equip: EquipMaster, workDate: string): Promise<string> {
    const company = equip.company;
    const plant = equip.plant;
    if (!company || !plant) return '08:00';

    const calendar = await this.findCalendarForDate(company, plant, equip.processCode, workDate);
    if (!calendar) return '08:00';

    const day = await this.calendarDayRepository.findOne({
      where: {
        calendarId: calendar.calendarId,
        workDate: this.parseYmdLocal(workDate) as any,
        company,
        plant,
      },
    });
    const shifts = (day?.shifts ?? calendar.defaultShifts ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
    const firstShiftCode = shifts[0];
    if (!firstShiftCode) return '08:00';

    const shift = await this.shiftPatternRepository.findOne({
      where: { company, plant, shiftCode: firstShiftCode, useYn: 'Y' },
    });
    return shift?.startTime ?? '08:00';
  }

  private async findCalendarForDate(
    company: string,
    plant: string,
    processCode: string | null,
    workDate: string,
  ): Promise<WorkCalendar | null> {
    const year = workDate.slice(0, 4);
    const byProcess = processCode
      ? await this.findCalendar(company, plant, year, processCode)
      : null;
    return byProcess ?? this.findCalendar(company, plant, year, null);
  }

  private async findCalendar(
    company: string,
    plant: string,
    year: string,
    processCode: string | null,
  ): Promise<WorkCalendar | null> {
    const qb = this.calendarRepository.createQueryBuilder('calendar')
      .where('calendar.company = :company', { company })
      .andWhere('calendar.plant = :plant', { plant })
      .andWhere('calendar.calendarYear = :year', { year });
    if (processCode) {
      qb.andWhere('calendar.processCd = :processCode', { processCode });
    } else {
      qb.andWhere('calendar.processCd IS NULL');
    }
    return qb
      .orderBy("CASE WHEN calendar.status IN ('CONFIRMED', 'ACTIVE') THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('calendar.calendarId', 'ASC')
      .getOne();
  }

  private formatYmdLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseYmdLocal(ymd: string): Date {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private addDaysYmd(ymd: string, days: number): string {
    const date = this.parseYmdLocal(ymd);
    date.setDate(date.getDate() + days);
    return this.formatYmdLocal(date);
  }

  private combineYmdTime(ymd: string, hhmm: string): Date {
    const [year, month, day] = ymd.split('-').map(Number);
    const [hour, minute] = hhmm.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0);
  }

  private formatDateTime(date: Date): string {
    return `${this.formatYmdLocal(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  }

  private formatDateTimeMillis(date: Date): string {
    return `${this.formatDateTime(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  }

  /**
   * 같은 조업일에 재점검이 쌓이면 날짜 구간 조건은 그날의 모든 로그를 가리킨다.
   * 수정·삭제는 조회(findByKey)와 같은 대상, 즉 그날의 최신 1건만 건드려야 하므로
   * INSPECT_DATE(시각 포함)가 그날 최대인 행으로 좁힌다.
   */
  private latestOfDayPredicate(inspectType: string, company?: string, plant?: string): string {
    const tenant = `${company ? ' AND l2.COMPANY = :company' : ''}${plant ? ' AND l2.PLANT_CD = :plant' : ''}`;
    // 조회(findByKey)와 같은 규칙: DAILY 는 조업일(WORK_DATE, 없으면 점검일 하루 구간), 그 밖은 점검일 하루 구간. 그 안에서 점검시각이 가장 늦은 한 건.
    const keyRule = inspectType === 'DAILY'
      ? `(l2.WORK_DATE = TO_DATE(:inspectDate, 'YYYY-MM-DD') OR (l2.WORK_DATE IS NULL AND l2.INSPECT_DATE >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND l2.INSPECT_DATE < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1))`
      : `(l2.INSPECT_DATE >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND l2.INSPECT_DATE < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1)`;
    return `inspectAt = (
      SELECT MAX(l2.INSPECT_AT) FROM EQUIP_INSPECT_LOGS l2
      WHERE l2.EQUIP_CODE = :equipCode
        AND l2.INSPECT_TYPE = :inspectType
        AND ${keyRule}${tenant}
    )`;
  }

  /** 수정·삭제의 키 조건(property 이름): 조회와 같은 규칙 */
  private keyRule(inspectType: string): string {
    return inspectType === 'DAILY'
      ? "(workDate = TO_DATE(:inspectDate, 'YYYY-MM-DD') OR (workDate IS NULL AND inspectDate >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND inspectDate < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1))"
      : "(inspectDate >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND inspectDate < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1)";
  }

  /** 점검 결과 수정 (복합키) */
  async update(
    equipCode: string,
    inspectType: string,
    inspectDate: string,
    dto: UpdateEquipInspectDto,
    company?: string,
    plant?: string,
  ) {
    const log = await this.findByKey(equipCode, inspectType, inspectDate, company, plant);

    const updateData: Partial<EquipInspectLog> = {};

    if (dto.inspectorName !== undefined) updateData.inspectorName = dto.inspectorName;
    if (dto.overallResult !== undefined) updateData.overallResult = dto.overallResult;
    if (dto.details !== undefined) {
      updateData.details = dto.details ? JSON.stringify(dto.details) : null;
      // 등록과 같은 규칙: FAIL 항목에는 사유코드가 필요하고, FAIL 항목이 있으면 종합이 PASS 여도 FAIL 로 본다
      if (this.checkFailItems(dto.details)) {
        const effective = String(dto.overallResult ?? log.overallResult ?? '');
        if (!effective.toUpperCase().includes('FAIL')) updateData.overallResult = 'FAIL';
      }
    }
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    const updateBuilder = this.equipInspectLogRepository
      .createQueryBuilder()
      .update(EquipInspectLog)
      .set(updateData)
      .where('equipCode = :equipCode', { equipCode })
      .andWhere('inspectType = :inspectType', { inspectType })
      .andWhere(this.keyRule(inspectType), { inspectDate })
      .andWhere(this.latestOfDayPredicate(inspectType, company, plant), { equipCode, inspectType, inspectDate });
    if (company) updateBuilder.andWhere('company = :company', { company });
    if (plant) updateBuilder.andWhere('plant = :plant', { plant });
    await updateBuilder.execute();

    const equip = await this.equipMasterRepository.findOne({
      where: {
        equipCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['equipCode', 'equipName', 'lineCode'],
    });

    const updated = await this.findByKey(equipCode, inspectType, inspectDate, company, plant);

    const finalResult = updated?.overallResult ?? '';
    if (finalResult.toUpperCase().includes('FAIL')) {
      await this.equipMasterRepository.update(
        {
          equipCode,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        { status: 'INTERLOCK' },
      );
    }

    return {
      ...updated,
      equip: equip || null,
    };
  }

  /** 점검 결과 삭제 (복합키) */
  async deleteByKey(
    equipCode: string,
    inspectType: string,
    inspectDate: string,
    company?: string,
    plant?: string,
  ) {
    await this.findByKey(equipCode, inspectType, inspectDate, company, plant);
    const deleteBuilder = this.equipInspectLogRepository
      .createQueryBuilder()
      .delete()
      .from(EquipInspectLog)
      .where('equipCode = :equipCode', { equipCode })
      .andWhere('inspectType = :inspectType', { inspectType })
      .andWhere(this.keyRule(inspectType), { inspectDate })
      .andWhere(this.latestOfDayPredicate(inspectType, company, plant), { equipCode, inspectType, inspectDate });
    if (company) deleteBuilder.andWhere('company = :company', { company });
    if (plant) deleteBuilder.andWhere('plant = :plant', { plant });
    await deleteBuilder.execute();
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
  async getCalendarSummary(
    year: number,
    month: number,
    processCode?: string,
    inspectType: string = 'DAILY',
    company?: string,
    plant?: string,
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59);

    const equipWhere: Record<string, unknown> = { useYn: 'Y' };
    if (processCode) equipWhere.processCode = processCode;
    if (company) equipWhere.company = company;
    if (plant) equipWhere.plant = plant;
    const equips = await this.equipMasterRepository.find({ where: equipWhere, select: ['equipCode', 'lineCode'] });
    const equipIds = equips.map((e) => e.equipCode);
    if (equipIds.length === 0) {
      return Array.from({ length: daysInMonth }, (_, i) => ({
        date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        total: 0, completed: 0, pass: 0, fail: 0, status: 'NONE',
      }));
    }

    const foundItems = await this.fetchItemsWithDetails(equipIds, inspectType, company, plant);

    const itemsByEquip = new Map<string, typeof foundItems>();
    for (const item of foundItems) {
      const list = itemsByEquip.get(item.equipCode) || [];
      list.push(item);
      itemsByEquip.set(item.equipCode, list);
    }

    // 점검 여부는 조업일(WORK_DATE, 없으면 점검일) 기준이고, 설비·날짜당 점검시각이 가장 늦은 한 건만 센다
    // (재점검이 쌓이면 불합격 이력까지 합쳐 센 탓에 합격으로 끝낸 날도 불합격으로 표시됐고, 새벽 점검이 다음 날로 잡혔다)
    const logs = this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.inspectType = :type', { type: inspectType })
      .andWhere('COALESCE(log.workDate, TRUNC(log.inspectDate)) BETWEEN :start AND :end', {
        start: startDate, end: endDate,
      })
      .andWhere('log.equipCode IN (:...equipCodes)', { equipCodes: equipIds });
    if (company) logs.andWhere('log.company = :company', { company });
    if (plant) logs.andWhere('log.plant = :plant', { plant });
    const foundLogs = this.latestPerEquipDay(await logs.orderBy('log.inspectAt', 'DESC').addOrderBy('log.createdAt', 'DESC').getMany());

    const logsByDate = new Map<string, EquipInspectLog[]>();
    for (const log of foundLogs) {
      const key = this.logDayKey(log);
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
  async getDaySchedule(
    date: string,
    processCode?: string,
    inspectType: string = 'DAILY',
    company?: string,
    plant?: string,
  ) {
    this.assertYmd(date.substring(0, 10), '날짜');
    const dateObj = new Date(date);

    const equipWhere: Record<string, unknown> = { useYn: 'Y' };
    if (processCode) equipWhere.processCode = processCode;
    if (company) equipWhere.company = company;
    if (plant) equipWhere.plant = plant;
    const equips = await this.equipMasterRepository.find({
      where: equipWhere,
      select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
    });
    if (equips.length === 0) return [];

    const equipIds = equips.map((e) => e.equipCode);

    const foundItems = await this.fetchItemsWithDetails(equipIds, inspectType, company, plant);

    const itemsByEquip = new Map<string, typeof foundItems>();
    for (const item of foundItems) {
      const list = itemsByEquip.get(item.equipCode) || [];
      list.push(item);
      itemsByEquip.set(item.equipCode, list);
    }

    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const logs = this.equipInspectLogRepository
      .createQueryBuilder('log')
      .where('log.inspectType = :type', { type: inspectType })
      .andWhere('COALESCE(log.workDate, TRUNC(log.inspectDate)) BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
      .andWhere('log.equipCode IN (:...equipCodes)', { equipCodes: equipIds });
    if (company) logs.andWhere('log.company = :company', { company });
    if (plant) logs.andWhere('log.plant = :plant', { plant });
    const foundLogs = this.latestPerEquipDay(await logs.orderBy('log.inspectAt', 'DESC').addOrderBy('log.createdAt', 'DESC').getMany());

    const logByEquip = new Map<string, EquipInspectLog>();
    for (const log of foundLogs) {
      logByEquip.set(log.equipCode, log);
    }

    const result = [];
    for (const equip of equips) {
      const items = itemsByEquip.get(equip.equipCode) || [];
      const dueItems = items.filter((item) => this.isDue(item.cycle, dateObj));
      if (dueItems.length === 0) continue;

      const log = logByEquip.get(equip.equipCode);
      let details: { items?: Array<{ itemCode: string; itemName: string; result: string; remark: string }> } | null = null;
      if (log?.details) {
        try { details = JSON.parse(log.details); } catch { details = null; }
      }

      const detailByItemCode = new Map(
        (details?.items ?? []).map((d) => [d.itemCode, d] as const),
      );
      const detailByName = new Map(
        (details?.items ?? []).map((d) => [d.itemName, d] as const),
      );
      const itemResults = dueItems.map((item) => {
        const detailItem = detailByItemCode.get(item.itemCode) ?? detailByName.get(item.itemName ?? '') ?? null;
        return {
          itemId: `${item.equipCode}_${item.inspectType}_${item.itemCode}`,
          itemCode: item.itemCode,
          itemName: item.itemName,
          criteria: item.criteria,
          imageUrl: item.imageUrl,
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

  /** 로그가 속한 날(조업일, 없으면 점검일)의 YYYY-MM-DD */
  private logDayKey(log: EquipInspectLog): string {
    const d = new Date(log.workDate ?? log.inspectDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** 점검시각 최신순으로 정렬돼 온 로그에서 설비·날짜마다 맨 앞(최신) 한 건만 남긴다 */
  private latestPerEquipDay(logs: EquipInspectLog[]): EquipInspectLog[] {
    const seen = new Set<string>();
    return logs.filter((log) => {
      const key = `${log.equipCode}::${this.logDayKey(log)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async fetchItemsWithDetails(
    equipIds: string[],
    inspectType: string,
    company?: string,
    plant?: string,
  ): Promise<Array<{ equipCode: string; itemCode: string; inspectType: string; sortSeq: number | null; itemName: string | null; criteria: string | null; imageUrl: string | null; cycle: string | null }>> {
    const qb = this.inspectItemRepository
      .createQueryBuilder('pool')
      .leftJoin(
        EquipInspectItemMaster,
        'master',
        'pool.company = master.company AND pool.plant = master.plant AND pool.itemCode = master.itemCode',
      )
      .select('pool.equipCode', 'equipCode')
      .addSelect('pool.itemCode', 'itemCode')
      .addSelect('pool.inspectType', 'inspectType')
      .addSelect('pool.sortSeq', 'sortSeq')
      .addSelect('master.itemName', 'itemName')
      .addSelect('master.criteria', 'criteria')
      .addSelect('master.imageUrl', 'imageUrl')
      .addSelect('master.cycle', 'cycle')
      .where('pool.inspectType = :type', { type: inspectType })
      .andWhere('pool.useYn = :yn', { yn: 'Y' })
      .andWhere('pool.equipCode IN (:...equipCodes)', { equipCodes: equipIds })
      .orderBy('pool.sortSeq', 'ASC');
    if (company) qb.andWhere('pool.company = :company', { company });
    if (plant) qb.andWhere('pool.plant = :plant', { plant });
    return qb.getRawMany();
  }

  /** 점검 통계 요약 */
  async getSummary(inspectType?: string, company?: string, plant?: string) {
    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log');

    if (inspectType) {
      queryBuilder.where('log.inspectType = :inspectType', { inspectType });
    }
    if (company) {
      queryBuilder.andWhere('log.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('log.plant = :plant', { plant });
    }

    const total = await queryBuilder.getCount();

    const byResultQuery = this.equipInspectLogRepository
      .createQueryBuilder('log')
      .select('log.overallResult', 'result')
      .addSelect('COUNT(*)', 'count')
      .where(inspectType ? 'log.inspectType = :inspectType' : '1=1', inspectType ? { inspectType } : {});
    if (company) {
      byResultQuery.andWhere('log.company = :company', { company });
    }
    if (plant) {
      byResultQuery.andWhere('log.plant = :plant', { plant });
    }

    const byResult = await byResultQuery
      .groupBy('log.overallResult')
      .getRawMany();

    return {
      total,
      byResult: byResult.map((r) => ({ result: r.result, count: parseInt(r.count, 10) })),
    };
  }
}
