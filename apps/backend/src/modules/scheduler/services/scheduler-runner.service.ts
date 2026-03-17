/**
 * @file src/modules/scheduler/services/scheduler-runner.service.ts
 * @description 스케줄러 실행 엔진 - 작업을 실행하고, 재시도/타임아웃/알림을 관리한다.
 *
 * 초보자 가이드:
 * 1. **execute()**: 메인 실행 메서드 — 동시 실행 방지 → 로그 생성 → 실행 → 결과 처리
 * 2. **동시 실행 방지**: 같은 job이 이미 RUNNING 상태이면 SKIPPED 로그 생성 후 건너뜀
 * 3. **타임아웃**: job.timeoutSec 초과 시 TIMEOUT 처리
 * 4. **재시도**: 실패 시 maxRetry까지 지수 백오프(1분 × 2^retryCount)로 재시도
 * 5. **알림**: 최종 실패/타임아웃 시 ADMIN 사용자에게 알림 생성
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SchedulerLog } from '../../../entities/scheduler-log.entity';
import { ExecutorFactory } from '../executors/executor.factory';
import { ExecutorResult } from '../executors/executor.interface';
import { SchedulerLogService } from './scheduler-log.service';
import { SchedulerNotiService } from './scheduler-noti.service';

@Injectable()
export class SchedulerRunnerService {
  private readonly logger = new Logger(SchedulerRunnerService.name);

  constructor(
    private readonly executorFactory: ExecutorFactory,
    private readonly logService: SchedulerLogService,
    private readonly notiService: SchedulerNotiService,
    @InjectRepository(SchedulerJob)
    private readonly jobRepo: Repository<SchedulerJob>,
    @InjectRepository(SchedulerLog)
    private readonly logRepo: Repository<SchedulerLog>,
  ) {}

  // =============================================
  // 메인 실행
  // =============================================

  /**
   * 스케줄러 작업 실행
   * @param job 실행할 작업 엔티티
   */
  async execute(job: SchedulerJob): Promise<void> {
    const { company, plantCd, jobCode } = job;

    // 1. 동시 실행 방지: RUNNING/RETRYING 상태인 로그가 있으면 SKIP
    const runningCount = await this.logRepo
      .createQueryBuilder('l')
      .where('l.company = :company', { company })
      .andWhere('l.plantCd = :plant', { plant: plantCd })
      .andWhere('l.jobCode = :jobCode', { jobCode })
      .andWhere('l.status IN (:...statuses)', { statuses: ['RUNNING', 'RETRYING'] })
      .getCount();

    if (runningCount > 0) {
      await this.logService.createLog({
        company,
        plantCd,
        jobCode,
        status: 'SKIPPED',
        resultMsg: '이전 실행이 진행 중이므로 건너뜀',
      });
      this.logger.warn(`작업 건너뜀 (동시 실행 방지): ${jobCode}`);
      return;
    }

    // 2. RUNNING 로그 생성
    const log = await this.logService.createLog({
      company,
      plantCd,
      jobCode,
    });

    const startMs = Date.now();

    try {
      // 3. 타임아웃 프로미스와 실행 프로미스 경쟁
      const executor = this.executorFactory.get(job.execType);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), job.timeoutSec * 1000),
      );

      const result: ExecutorResult = await Promise.race([
        executor.execute(job),
        timeoutPromise,
      ]);

      // 4. 성공 처리
      const durationMs = Date.now() - startMs;
      await this.logService.updateLog(company, plantCd, log.logId, {
        status: 'SUCCESS',
        endTime: new Date(),
        durationMs,
        resultMsg: result.message ?? '실행 성공',
        affectedRows: result.affectedRows ?? null,
      });

      // job 상태 갱신
      await this.jobRepo.update(
        { company, plantCd, jobCode },
        {
          lastRunAt: new Date(),
          lastStatus: 'SUCCESS',
        },
      );

      this.logger.log(`작업 성공: ${jobCode} (${durationMs}ms)`);
    } catch (error: unknown) {
      const durationMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      const isTimeout = errMsg === 'TIMEOUT';

      if (isTimeout) {
        // 타임아웃 처리
        await this.handleTimeout(job, log, durationMs);
      } else {
        // 실패 처리 (재시도 가능 여부 확인)
        await this.handleFailure(job, log, durationMs, errMsg, 0);
      }
    }
  }

  // =============================================
  // 타임아웃 처리
  // =============================================

  /**
   * 타임아웃 처리: 로그 갱신 + 알림 생성
   */
  private async handleTimeout(
    job: SchedulerJob,
    log: SchedulerLog,
    durationMs: number,
  ): Promise<void> {
    const { company, plantCd, jobCode } = job;

    await this.logService.updateLog(company, plantCd, log.logId, {
      status: 'TIMEOUT',
      endTime: new Date(),
      durationMs,
      errorMsg: `실행 제한 시간(${job.timeoutSec}초) 초과`,
    });

    await this.jobRepo.update(
      { company, plantCd, jobCode },
      { lastStatus: 'TIMEOUT', lastErrorAt: new Date() },
    );

    // 관리자 알림
    await this.createAdminNotification(
      company,
      plantCd,
      jobCode,
      'TIMEOUT',
      `[${jobCode}] 작업이 ${job.timeoutSec}초 제한 시간을 초과했습니다.`,
    );

    this.logger.error(`작업 타임아웃: ${jobCode} (${durationMs}ms)`);
  }

  // =============================================
  // 실패 처리 + 재시도
  // =============================================

  /**
   * 실패 처리: 재시도 가능하면 스케줄, 아니면 최종 FAIL
   */
  private async handleFailure(
    job: SchedulerJob,
    log: SchedulerLog,
    durationMs: number,
    errorMsg: string,
    retryCount: number,
  ): Promise<void> {
    const { company, plantCd, jobCode } = job;

    if (retryCount < job.maxRetry) {
      // 재시도 스케줄
      await this.logService.updateLog(company, plantCd, log.logId, {
        status: 'RETRYING',
        errorMsg,
        retryCount,
      });

      this.scheduleRetry(job, company, plantCd, log.logId, retryCount);
      this.logger.warn(
        `작업 재시도 예약: ${jobCode} (retry=${retryCount + 1}/${job.maxRetry})`,
      );
    } else {
      // 최종 실패
      await this.logService.updateLog(company, plantCd, log.logId, {
        status: 'FAIL',
        endTime: new Date(),
        durationMs,
        errorMsg,
        retryCount,
      });

      await this.jobRepo.update(
        { company, plantCd, jobCode },
        { lastStatus: 'FAIL', lastErrorAt: new Date() },
      );

      // 관리자 알림
      await this.createAdminNotification(
        company,
        plantCd,
        jobCode,
        'FAIL',
        `[${jobCode}] 작업 실패 (재시도 ${retryCount}회 소진): ${errorMsg}`,
      );

      this.logger.error(`작업 최종 실패: ${jobCode} - ${errorMsg}`);
    }
  }

  /**
   * 재시도 스케줄 (지수 백오프: 1분 × 2^retryCount)
   */
  private scheduleRetry(
    job: SchedulerJob,
    logCompany: string,
    logPlant: string,
    logId: number,
    retryCount: number,
  ): void {
    const delayMs = 60000 * Math.pow(2, retryCount); // 1분, 2분, 4분...
    setTimeout(() => {
      this.executeRetry(job, logCompany, logPlant, logId, retryCount + 1)
        .catch((err: unknown) => {
          this.logger.error(
            `재시도 실행 중 오류: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }, delayMs);
  }

  /**
   * 재시도 실행
   */
  private async executeRetry(
    job: SchedulerJob,
    logCompany: string,
    logPlant: string,
    logId: number,
    retryCount: number,
  ): Promise<void> {
    const startMs = Date.now();

    try {
      const executor = this.executorFactory.get(job.execType);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), job.timeoutSec * 1000),
      );

      const result: ExecutorResult = await Promise.race([
        executor.execute(job),
        timeoutPromise,
      ]);

      // 재시도 성공
      const durationMs = Date.now() - startMs;
      await this.logService.updateLog(logCompany, logPlant, logId, {
        status: 'SUCCESS',
        endTime: new Date(),
        durationMs,
        resultMsg: result.message ?? `재시도 #${retryCount} 성공`,
        affectedRows: result.affectedRows ?? null,
        retryCount,
      });

      await this.jobRepo.update(
        { company: job.company, plantCd: job.plantCd, jobCode: job.jobCode },
        { lastRunAt: new Date(), lastStatus: 'SUCCESS' },
      );

      this.logger.log(`작업 재시도 성공: ${job.jobCode} (retry=${retryCount})`);
    } catch (error: unknown) {
      const durationMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';

      // 로그의 SchedulerLog을 참조용으로 생성
      const logRef = { logId } as SchedulerLog;
      await this.handleFailure(job, logRef, durationMs, errMsg, retryCount);
    }
  }

  // =============================================
  // 알림 생성
  // =============================================

  /**
   * ADMIN 사용자에게 알림 생성
   */
  private async createAdminNotification(
    company: string,
    plantCd: string,
    jobCode: string,
    notiType: string,
    message: string,
  ): Promise<void> {
    try {
      // ADMIN 역할 사용자 조회
      const admins: { email: string }[] = await this.logRepo.manager.query(
        `SELECT "EMAIL" AS "email" FROM "USERS"
          WHERE "COMPANY" = :1 AND "ROLE" = 'ADMIN' AND "STATUS" = 'ACTIVE'`,
        [company],
      );

      for (const admin of admins) {
        await this.notiService.createNotification({
          company,
          plantCd,
          jobCode,
          userId: admin.email,
          notiType,
          message,
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `알림 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
