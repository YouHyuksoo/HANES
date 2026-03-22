/**
 * @file src/modules/master/services/work-calendar.service.ts
 * @description 생산월력(Work Calendar) 비즈니스 로직 — 캘린더 CRUD, 일별 근무 관리,
 *              연간 자동 생성, 복사, 확정/취소, 요약 통계 기능을 제공한다.
 *
 * 초보자 가이드:
 * 1. 캘린더 헤더(WORK_CALENDARS) CRUD
 * 2. 일별 근무(WORK_CALENDAR_DAYS) 조회/일괄 저장
 * 3. generateYear: 연간 365/366일 자동 생성 (주말·공휴일 휴무 적용)
 * 4. copyFrom: 기존 캘린더 일정을 다른 캘린더로 복사
 * 5. confirm/unconfirm: 확정 상태 관리 — 확정 후에는 수정 불가
 * 6. getSummary: 월별/연간 근무일수·시간 요약 통계
 */
import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import {
  CreateWorkCalendarDto, UpdateWorkCalendarDto, WorkCalendarQueryDto,
  BulkUpdateDaysDto, GenerateCalendarDto,
} from '../dto/work-calendar.dto';

/** 한국 고정 공휴일 [월, 일] */
const KOREAN_FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], [3, 1], [5, 5], [6, 6], [8, 15], [10, 3], [10, 9], [12, 25],
];

@Injectable()
export class WorkCalendarService {
  constructor(
    @InjectRepository(WorkCalendar)
    private readonly calendarRepo: Repository<WorkCalendar>,
    @InjectRepository(WorkCalendarDay)
    private readonly dayRepo: Repository<WorkCalendarDay>,
    @InjectRepository(ShiftPattern)
    private readonly shiftRepo: Repository<ShiftPattern>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 캘린더 CRUD ───

  /** 캘린더 목록 (페이징 + 필터) */
  async findAll(query: WorkCalendarQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, calendarYear, processCd, status, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.calendarRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (calendarYear) qb.andWhere('c.calendarYear = :calendarYear', { calendarYear });
    if (processCd) qb.andWhere('c.processCd = :processCd', { processCd });
    if (status) qb.andWhere('c.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(UPPER(c.calendarId) LIKE UPPER(:s) OR UPPER(c.remark) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('c.calendarYear', 'DESC')
      .addOrderBy('c.calendarId', 'ASC')
      .skip(skip).take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /** 캘린더 상세 조회 */
  async findById(calendarId: string) {
    const calendar = await this.calendarRepo.findOne({ where: { calendarId } });
    if (!calendar) throw new NotFoundException(`캘린더를 찾을 수 없습니다: ${calendarId}`);
    return calendar;
  }

  /** 캘린더 생성 (중복 체크) */
  async create(dto: CreateWorkCalendarDto, company?: string, plant?: string) {
    const existing = await this.calendarRepo.findOne({ where: { calendarId: dto.calendarId } });
    if (existing) throw new ConflictException(`이미 존재하는 캘린더: ${dto.calendarId}`);

    const entity = this.calendarRepo.create({
      ...dto,
      status: 'DRAFT',
      company,
      plant,
    });
    return this.calendarRepo.save(entity);
  }

  /** 캘린더 수정 (확정 상태 시 불가) */
  async update(calendarId: string, dto: UpdateWorkCalendarDto) {
    const calendar = await this.findById(calendarId);
    this.ensureNotConfirmed(calendar);

    const { calendarId: _id, ...updateData } = dto;
    await this.calendarRepo.update({ calendarId }, updateData);
    return this.findById(calendarId);
  }

  /** 캘린더 삭제 (확정 상태 시 불가, 하위 일자 포함) */
  async delete(calendarId: string) {
    const calendar = await this.findById(calendarId);
    this.ensureNotConfirmed(calendar);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(WorkCalendarDay, { calendarId });
      await manager.delete(WorkCalendar, { calendarId });
    });
    return { calendarId };
  }

  // ─── 일별 근무 조회/수정 ───

  /** 특정 월의 일별 근무 조회 (month: 'YYYY-MM') */
  async findDaysByMonth(calendarId: string, month: string) {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);
    const lastDay = new Date(year, mon, 0).getDate();
    const start = `${yearStr}-${monthStr}-01`;
    const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    return this.dayRepo.createQueryBuilder('d')
      .where('d.calendarId = :calendarId', { calendarId })
      .andWhere("d.workDate BETWEEN TO_DATE(:start, 'YYYY-MM-DD') AND TO_DATE(:end, 'YYYY-MM-DD')", { start, end })
      .orderBy('d.workDate', 'ASC')
      .getMany();
  }

  /** 일별 근무 일괄 저장 (확정 상태 시 불가) */
  async bulkUpdateDays(calendarId: string, dto: BulkUpdateDaysDto, company?: string, plant?: string) {
    const calendar = await this.findById(calendarId);
    this.ensureNotConfirmed(calendar);

    if (dto.days.length === 0) return [];

    const dates = dto.days.map((d) => d.workDate);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    return this.dataSource.transaction(async (manager) => {
      await manager.createQueryBuilder()
        .delete()
        .from(WorkCalendarDay)
        .where('calendarId = :calendarId', { calendarId })
        .andWhere(
          "workDate BETWEEN TO_DATE(:minDate, 'YYYY-MM-DD') AND TO_DATE(:maxDate, 'YYYY-MM-DD')",
          { minDate, maxDate },
        )
        .execute();

      const entities = dto.days.map((d) =>
        manager.create(WorkCalendarDay, {
          calendarId,
          workDate: d.workDate,
          dayType: d.dayType,
          offReason: d.offReason ?? null,
          shiftCount: d.shiftCount ?? calendar.defaultShiftCount,
          shifts: d.shifts ?? calendar.defaultShifts,
          workMinutes: d.workMinutes ?? 0,
          otMinutes: d.otMinutes ?? 0,
          remark: d.remark ?? null,
          company,
          plant,
        }),
      );
      return manager.save(WorkCalendarDay, entities);
    });
  }

  // ─── 연간 자동 생성 ───

  /** 연간 일정 자동 생성 (주말·공휴일 휴무 적용) */
  async generateYear(
    calendarId: string, dto: GenerateCalendarDto,
    company?: string, plant?: string,
  ) {
    const calendar = await this.findById(calendarId);
    this.ensureNotConfirmed(calendar);

    const year = parseInt(calendar.calendarYear, 10);
    const weekendOff = dto.weekendOff ?? true;
    const applyHolidays = dto.applyHolidays ?? true;

    /** 기본 교대 패턴의 총 근무 시간(분) 계산 */
    let defaultWorkMinutes = 0;
    if (calendar.defaultShifts && company && plant) {
      const shiftCodes = calendar.defaultShifts.split(',').map((s) => s.trim());
      const shifts = await this.shiftRepo.find({ where: { company, plant } });
      for (const code of shiftCodes) {
        const found = shifts.find((s) => s.shiftCode === code);
        if (found) defaultWorkMinutes += found.workMinutes;
      }
    }

    /** 공휴일 Set 생성 */
    const holidaySet = new Set<string>();
    if (applyHolidays) {
      for (const [m, d] of KOREAN_FIXED_HOLIDAYS) {
        holidaySet.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }

    /** 365/366일 생성 */
    const days: Partial<WorkCalendarDay>[] = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dow = d.getDay(); // 0=Sun, 6=Sat

      let dayType = 'WORK';
      let offReason: string | null = null;
      let workMin = defaultWorkMinutes;

      if (weekendOff && (dow === 0 || dow === 6)) {
        dayType = 'OFF';
        offReason = 'REGULAR';
        workMin = 0;
      } else if (holidaySet.has(dateStr)) {
        dayType = 'OFF';
        offReason = 'HOLIDAY';
        workMin = 0;
      }

      days.push({
        calendarId,
        workDate: dateStr,
        dayType,
        offReason,
        shiftCount: dayType === 'WORK' ? calendar.defaultShiftCount : 0,
        shifts: dayType === 'WORK' ? calendar.defaultShifts : null,
        workMinutes: workMin,
        otMinutes: 0,
        remark: null,
        company,
        plant,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(WorkCalendarDay, { calendarId });

      /** 배치 단위로 저장 (Oracle 제한 대응) */
      const BATCH_SIZE = 100;
      const saved: WorkCalendarDay[] = [];
      for (let i = 0; i < days.length; i += BATCH_SIZE) {
        const batch = days.slice(i, i + BATCH_SIZE).map((item) =>
          manager.create(WorkCalendarDay, item),
        );
        const result = await manager.save(WorkCalendarDay, batch);
        saved.push(...result);
      }
      return saved;
    });
  }

  // ─── 복사 ───

  /** 다른 캘린더의 일정을 복사 */
  async copyFrom(calendarId: string, sourceId: string, company?: string, plant?: string) {
    const target = await this.findById(calendarId);
    this.ensureNotConfirmed(target);

    const sourceDays = await this.dayRepo.find({ where: { calendarId: sourceId } });
    if (sourceDays.length === 0) {
      throw new NotFoundException(`복사 원본 캘린더에 일정이 없습니다: ${sourceId}`);
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(WorkCalendarDay, { calendarId });

      const BATCH_SIZE = 100;
      const saved: WorkCalendarDay[] = [];
      for (let i = 0; i < sourceDays.length; i += BATCH_SIZE) {
        const batch = sourceDays.slice(i, i + BATCH_SIZE).map((day) =>
          manager.create(WorkCalendarDay, {
            ...day,
            calendarId,
            company,
            plant,
          }),
        );
        const result = await manager.save(WorkCalendarDay, batch);
        saved.push(...result);
      }
      return saved;
    });
  }

  // ─── 확정/취소 ───

  /** 캘린더 확정 */
  async confirm(calendarId: string) {
    await this.findById(calendarId);
    await this.calendarRepo.update({ calendarId }, { status: 'CONFIRMED' });
    return this.findById(calendarId);
  }

  /** 캘린더 확정 취소 */
  async unconfirm(calendarId: string) {
    await this.findById(calendarId);
    await this.calendarRepo.update({ calendarId }, { status: 'DRAFT' });
    return this.findById(calendarId);
  }

  // ─── 요약 통계 ───

  /** 월별/연간 근무 요약 통계 */
  async getSummary(calendarId: string) {
    await this.findById(calendarId);

    const days = await this.dayRepo.find({
      where: { calendarId },
      order: { workDate: 'ASC' },
    });

    /** 월별 그룹핑 */
    const monthlyMap = new Map<string, {
      workDays: number; offDays: number; halfDays: number; specialDays: number;
      workMinutes: number; otMinutes: number;
    }>();

    for (const day of days) {
      const dateStr = typeof day.workDate === 'string' ? day.workDate : String(day.workDate);
      const month = dateStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          workDays: 0, offDays: 0, halfDays: 0, specialDays: 0,
          workMinutes: 0, otMinutes: 0,
        });
      }
      const m = monthlyMap.get(month)!;

      switch (day.dayType) {
        case 'WORK': m.workDays++; break;
        case 'OFF': m.offDays++; break;
        case 'HALF': m.halfDays++; break;
        case 'SPECIAL': m.specialDays++; break;
      }
      m.workMinutes += day.workMinutes ?? 0;
      m.otMinutes += day.otMinutes ?? 0;
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, stats]) => ({ month, ...stats }));

    const yearly = {
      workDays: 0, offDays: 0, halfDays: 0, specialDays: 0,
      workMinutes: 0, otMinutes: 0,
    };
    for (const m of monthly) {
      yearly.workDays += m.workDays;
      yearly.offDays += m.offDays;
      yearly.halfDays += m.halfDays;
      yearly.specialDays += m.specialDays;
      yearly.workMinutes += m.workMinutes;
      yearly.otMinutes += m.otMinutes;
    }

    return { monthly, yearly };
  }

  // ─── Private Helpers ───

  /** 확정 상태인 캘린더의 수정을 차단 */
  private ensureNotConfirmed(calendar: WorkCalendar): void {
    if (calendar.status === 'CONFIRMED') {
      throw new BadRequestException('확정된 캘린더는 수정할 수 없습니다. 확정 취소 후 수정하세요.');
    }
  }
}
