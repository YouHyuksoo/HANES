/**
 * @file src/modules/scheduler/services/scheduler-log.service.ts
 * @description 스케줄러 실행 로그 서비스 - 작업 실행 이력 CRUD 및 통계를 관리한다.
 *
 * 초보자 가이드:
 * 1. **generateLogId()**: company + plantCd 범위 내에서 MAX(LOG_ID)+1 채번
 * 2. **createLog()**: RUNNING 상태로 로그 생성 (실행 시작 시 호출)
 * 3. **updateLog()**: 실행 완료 후 상태/종료시각/소요시간 등 갱신
 * 4. **findAll()**: 페이지네이션 + 필터(작업코드, 상태, 날짜범위) 목록 조회
 * 5. **getSummary()**: 대시보드용 통계 (오늘 실행건수, 성공률, 일별 추이, 작업별 비율, 최근 실패)
 * 6. **recoverStaleRunning()**: 서버 재시작 시 RUNNING/RETRYING → FAIL 처리
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulerLog } from '../../../entities/scheduler-log.entity';
import { SchedulerLogFilterDto } from '../dto/scheduler-log.dto';

/** 일별 추이 항목 타입 */
export interface DailyTrendItem {
  date: string;
  total: number;
  success: number;
  fail: number;
}

/** 작업별 비율 항목 타입 */
export interface JobRatioItem {
  jobCode: string;
  total: number;
  success: number;
  fail: number;
}

/** 대시보드 요약 타입 */
export interface LogSummary {
  todayTotal: number;
  todaySuccess: number;
  todayFail: number;
  successRate: number;
  dailyTrend: DailyTrendItem[];
  jobRatio: JobRatioItem[];
  recentFails: SchedulerLog[];
}

@Injectable()
export class SchedulerLogService {
  private readonly logger = new Logger(SchedulerLogService.name);

  constructor(
    @InjectRepository(SchedulerLog)
    private readonly logRepo: Repository<SchedulerLog>,
    private readonly dataSource: DataSource,
  ) {}

  // =============================================
  // 채번
  // =============================================

  /**
   * LOG_ID 채번: company + plantCd 범위 내 MAX+1
   * @param company 회사코드
   * @param plant 사업장코드
   * @returns 다음 LOG_ID
   */
  async generateLogId(company: string, plant: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT NVL(MAX("LOG_ID"), 0) + 1 AS "nextId"
         FROM "SCHEDULER_LOGS"
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2`,
      [company, plant],
    );
    return result[0].nextId;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 실행 로그 생성 (RUNNING 상태)
   * @param data 로그 데이터 (logId 자동 채번)
   * @returns 생성된 로그
   */
  async createLog(data: Partial<SchedulerLog>): Promise<SchedulerLog> {
    const company = data.company!;
    const plant = data.plantCd!;
    const logId = await this.generateLogId(company, plant);

    const log = this.logRepo.create({
      ...data,
      logId,
      status: 'RUNNING',
      startTime: new Date(),
      retryCount: data.retryCount ?? 0,
    });

    const saved = await this.logRepo.save(log);
    this.logger.log(`실행 로그 생성: company=${company}, logId=${logId}, jobCode=${data.jobCode}`);
    return saved;
  }

  /**
   * 실행 로그 갱신 (상태, 종료시각, 소요시간 등)
   * @param company 회사코드
   * @param plant 사업장코드
   * @param logId 로그ID
   * @param updates 갱신 데이터
   */
  async updateLog(
    company: string,
    plant: string,
    logId: number,
    updates: Partial<SchedulerLog>,
  ): Promise<void> {
    await this.logRepo.update(
      { company, plantCd: plant, logId },
      updates,
    );
  }

  /**
   * 실행 로그 목록 조회 (페이지네이션 + 필터)
   * @param filter 필터 조건
   * @param company 회사코드
   * @param plant 사업장코드
   */
  async findAll(
    filter: SchedulerLogFilterDto,
    company: string,
    plant: string,
  ) {
    const { page = 1, limit = 50, jobCode, status, startDate, endDate } = filter;

    const qb = this.logRepo.createQueryBuilder('l');
    qb.where('l.company = :company', { company });
    qb.andWhere('l.plantCd = :plant', { plant });

    if (jobCode) qb.andWhere('l.jobCode = :jobCode', { jobCode });
    if (status) qb.andWhere('l.status = :status', { status });
    if (startDate) {
      qb.andWhere('l.startTime >= TO_DATE(:startDate, \'YYYY-MM-DD\')', { startDate });
    }
    if (endDate) {
      qb.andWhere('l.startTime < TO_DATE(:endDate, \'YYYY-MM-DD\') + 1', { endDate });
    }

    qb.orderBy('l.startTime', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  // =============================================
  // 대시보드 통계
  // =============================================

  /**
   * 대시보드 요약 통계
   * @param company 회사코드
   * @param plant 사업장코드
   */
  async getSummary(company: string, plant: string): Promise<LogSummary> {
    // 오늘 실행 건수 (SUCCESS / FAIL / 전체)
    const todayRows: { status: string; cnt: string }[] = await this.dataSource.query(
      `SELECT "STATUS" AS "status", COUNT(*) AS "cnt"
         FROM "SCHEDULER_LOGS"
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2
          AND "START_TIME" >= TRUNC(SYSDATE)
        GROUP BY "STATUS"`,
      [company, plant],
    );

    let todayTotal = 0;
    let todaySuccess = 0;
    let todayFail = 0;
    for (const row of todayRows) {
      const cnt = Number(row.cnt);
      todayTotal += cnt;
      if (row.status === 'SUCCESS') todaySuccess = cnt;
      if (row.status === 'FAIL' || row.status === 'TIMEOUT') todayFail += cnt;
    }
    const successRate = todayTotal > 0
      ? parseFloat(((todaySuccess / todayTotal) * 100).toFixed(1))
      : 0;

    // 최근 7일 일별 추이
    const trendRows: { dt: string; status: string; cnt: string }[] = await this.dataSource.query(
      `SELECT TO_CHAR(TRUNC("START_TIME"), 'YYYY-MM-DD') AS "dt",
              "STATUS" AS "status",
              COUNT(*) AS "cnt"
         FROM "SCHEDULER_LOGS"
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2
          AND "START_TIME" >= TRUNC(SYSDATE) - 7
        GROUP BY TRUNC("START_TIME"), "STATUS"
        ORDER BY TRUNC("START_TIME")`,
      [company, plant],
    );

    const trendMap = new Map<string, DailyTrendItem>();
    for (const row of trendRows) {
      const existing = trendMap.get(row.dt) ?? { date: row.dt, total: 0, success: 0, fail: 0 };
      const cnt = Number(row.cnt);
      existing.total += cnt;
      if (row.status === 'SUCCESS') existing.success += cnt;
      if (row.status === 'FAIL' || row.status === 'TIMEOUT') existing.fail += cnt;
      trendMap.set(row.dt, existing);
    }
    const dailyTrend = Array.from(trendMap.values());

    // 작업별 비율
    const ratioRows: { jobCode: string; status: string; cnt: string }[] = await this.dataSource.query(
      `SELECT "JOB_CODE" AS "jobCode",
              "STATUS" AS "status",
              COUNT(*) AS "cnt"
         FROM "SCHEDULER_LOGS"
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2
          AND "START_TIME" >= TRUNC(SYSDATE) - 30
        GROUP BY "JOB_CODE", "STATUS"`,
      [company, plant],
    );

    const ratioMap = new Map<string, JobRatioItem>();
    for (const row of ratioRows) {
      const existing = ratioMap.get(row.jobCode) ?? { jobCode: row.jobCode, total: 0, success: 0, fail: 0 };
      const cnt = Number(row.cnt);
      existing.total += cnt;
      if (row.status === 'SUCCESS') existing.success += cnt;
      if (row.status === 'FAIL' || row.status === 'TIMEOUT') existing.fail += cnt;
      ratioMap.set(row.jobCode, existing);
    }
    const jobRatio = Array.from(ratioMap.values());

    // 최근 실패 5건
    const recentFails = await this.logRepo.find({
      where: { company, plantCd: plant },
      order: { startTime: 'DESC' },
      take: 5,
    });
    // TypeORM의 find에서 status IN 조건을 위해 queryBuilder 사용
    const recentFailsFiltered = await this.logRepo
      .createQueryBuilder('l')
      .where('l.company = :company', { company })
      .andWhere('l.plantCd = :plant', { plant })
      .andWhere('l.status IN (:...statuses)', { statuses: ['FAIL', 'TIMEOUT'] })
      .orderBy('l.startTime', 'DESC')
      .take(5)
      .getMany();

    return {
      todayTotal,
      todaySuccess,
      todayFail,
      successRate,
      dailyTrend,
      jobRatio,
      recentFails: recentFailsFiltered,
    };
  }

  // =============================================
  // 복구
  // =============================================

  /**
   * 서버 재시작 시 RUNNING/RETRYING 상태 로그를 FAIL로 복구
   * @param company 회사코드
   * @param plant 사업장코드
   * @returns 복구된 건수
   */
  async recoverStaleRunning(company: string, plant: string): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE "SCHEDULER_LOGS"
          SET "STATUS" = 'FAIL',
              "ERROR_MSG" = '서버 재시작으로 인한 자동 FAIL 처리',
              "END_TIME" = SYSTIMESTAMP
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2
          AND "STATUS" IN ('RUNNING', 'RETRYING')`,
      [company, plant],
    );
    const affected = result?.rowsAffected ?? 0;
    if (affected > 0) {
      this.logger.warn(`Stale 로그 ${affected}건 FAIL 처리 완료 (company=${company}, plant=${plant})`);
    }
    return affected;
  }
}
