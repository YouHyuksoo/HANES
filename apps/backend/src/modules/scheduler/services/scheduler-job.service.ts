/**
 * @file src/modules/scheduler/services/scheduler-job.service.ts
 * @description 스케줄러 작업(Job) 서비스 - CRUD + CronJob 등록/해제 + 즉시실행을 관리한다.
 *
 * 초보자 가이드:
 * 1. **OnModuleInit**: 서버 시작 시 활성 작업을 CronJob으로 등록
 * 2. **findAll()**: 작업 목록 조회 (페이지네이션 + 필터)
 * 3. **create()/update()/remove()**: 작업 CRUD + CronJob 자동 등록/해제
 * 4. **toggle()**: 활성/비활성 토글 — CronJob 등록/해제
 * 5. **runNow()**: 즉시 실행 (cron 스케줄 무시)
 * 6. **registerCronJob()**: CronJob 생성 후 SchedulerRegistry에 등록
 * 7. **computeNextRun()**: cron-parser로 다음 실행 시각 계산
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CronJob } from 'cron';
import CronExpressionParser from 'cron-parser';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SchedulerRunnerService } from './scheduler-runner.service';
import { SchedulerLogService } from './scheduler-log.service';
import {
  CreateSchedulerJobDto,
  UpdateSchedulerJobDto,
  SchedulerJobFilterDto,
} from '../dto/scheduler-job.dto';

@Injectable()
export class SchedulerJobService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerJobService.name);

  constructor(
    @InjectRepository(SchedulerJob)
    private readonly jobRepo: Repository<SchedulerJob>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly runnerService: SchedulerRunnerService,
    private readonly logService: SchedulerLogService,
    private readonly dataSource: DataSource,
  ) {}

  // =============================================
  // 모듈 초기화
  // =============================================

  /**
   * 서버 시작 시 실행:
   * 1. Stale RUNNING/RETRYING 로그 복구
   * 2. 활성 작업 로드 후 CronJob 등록
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('스케줄러 모듈 초기화 시작...');

    try {
      // 모든 회사/공장 조합에 대해 stale 로그 복구
      const plants: { company: string; plantCd: string }[] =
        await this.dataSource.query(
          `SELECT DISTINCT "COMPANY" AS "company", "PLANT_CD" AS "plantCd"
             FROM "SCHEDULER_JOBS"
            WHERE "IS_ACTIVE" = 'Y'`,
        );

      for (const { company, plantCd } of plants) {
        await this.logService.recoverStaleRunning(company, plantCd);
      }

      // 활성 작업 로드 + CronJob 등록
      const activeJobs = await this.jobRepo.find({
        where: { isActive: 'Y' },
      });

      for (const job of activeJobs) {
        this.registerCronJob(job);
      }

      this.logger.log(`스케줄러 초기화 완료: ${activeJobs.length}개 작업 등록`);
    } catch (error: unknown) {
      this.logger.error(
        `스케줄러 초기화 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 작업 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(
    filter: SchedulerJobFilterDto,
    company: string,
    plant: string,
  ) {
    const { page = 1, limit = 50, jobGroup, execType, isActive, search } = filter;

    const qb = this.jobRepo.createQueryBuilder('j');
    qb.where('j.company = :company', { company });
    qb.andWhere('j.plantCd = :plant', { plant });

    if (jobGroup) qb.andWhere('j.jobGroup = :jobGroup', { jobGroup });
    if (execType) qb.andWhere('j.execType = :execType', { execType });
    if (isActive) qb.andWhere('j.isActive = :isActive', { isActive });
    if (search) {
      qb.andWhere(
        '(j.jobCode LIKE :search OR j.jobName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('j.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 작업 단건 조회
   */
  async findOne(
    jobCode: string,
    company: string,
    plant: string,
  ): Promise<SchedulerJob> {
    const job = await this.jobRepo.findOne({
      where: { company, plantCd: plant, jobCode },
    });
    if (!job) {
      throw new NotFoundException(`작업을 찾을 수 없습니다: ${jobCode}`);
    }
    return job;
  }

  /**
   * 작업 생성 + 활성이면 CronJob 등록
   */
  async create(
    dto: CreateSchedulerJobDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<SchedulerJob> {
    const nextRunAt = this.computeNextRun(dto.cronExpr);

    const entity = this.jobRepo.create({
      ...dto,
      company,
      plantCd: plant,
      isActive: 'N', // 생성 시 비활성 (수동 활성화 필요)
      nextRunAt,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.jobRepo.save(entity);
    this.logger.log(`작업 생성: ${dto.jobCode}`);
    return saved;
  }

  /**
   * 작업 수정 + CronJob 재등록
   */
  async update(
    jobCode: string,
    dto: UpdateSchedulerJobDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<SchedulerJob> {
    const job = await this.findOne(jobCode, company, plant);

    Object.assign(job, dto, { updatedBy: userId });

    // cron 표현식이 변경되었으면 nextRunAt 재계산
    if (dto.cronExpr) {
      job.nextRunAt = this.computeNextRun(dto.cronExpr);
    }

    const saved = await this.jobRepo.save(job);

    // CronJob 재등록 (활성 상태인 경우)
    this.unregisterCronJob(company, plant, jobCode);
    if (saved.isActive === 'Y') {
      this.registerCronJob(saved);
    }

    this.logger.log(`작업 수정: ${jobCode}`);
    return saved;
  }

  /**
   * 작업 삭제 + CronJob 해제
   */
  async remove(
    jobCode: string,
    company: string,
    plant: string,
  ): Promise<void> {
    const job = await this.findOne(jobCode, company, plant);
    this.unregisterCronJob(company, plant, jobCode);
    await this.jobRepo.remove(job);
    this.logger.log(`작업 삭제: ${jobCode}`);
  }

  /**
   * 활성/비활성 토글 + CronJob 등록/해제
   */
  async toggle(
    jobCode: string,
    company: string,
    plant: string,
    userId: string,
  ): Promise<SchedulerJob> {
    const job = await this.findOne(jobCode, company, plant);
    const newActive = job.isActive === 'Y' ? 'N' : 'Y';

    job.isActive = newActive;
    job.updatedBy = userId;

    if (newActive === 'Y') {
      job.nextRunAt = this.computeNextRun(job.cronExpr);
      this.registerCronJob(job);
    } else {
      job.nextRunAt = null;
      this.unregisterCronJob(company, plant, jobCode);
    }

    const saved = await this.jobRepo.save(job);
    this.logger.log(`작업 토글: ${jobCode} → ${newActive}`);
    return saved;
  }

  /**
   * 즉시 실행 (cron 스케줄 무시)
   */
  async runNow(
    jobCode: string,
    company: string,
    plant: string,
  ): Promise<void> {
    const job = await this.findOne(jobCode, company, plant);
    this.logger.log(`즉시 실행: ${jobCode}`);
    // 비동기로 실행 (응답을 기다리지 않음)
    this.runnerService.execute(job).catch((err: unknown) => {
      this.logger.error(
        `즉시 실행 오류: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  // =============================================
  // CronJob 관리
  // =============================================

  /**
   * CronJob 등록 — SchedulerRegistry에 추가 후 시작
   */
  private registerCronJob(job: SchedulerJob): void {
    const key = `${job.company}_${job.plantCd}_${job.jobCode}`;

    try {
      // 기존 등록이 있으면 먼저 해제
      this.unregisterCronJob(job.company, job.plantCd, job.jobCode);

      const cronJob = new CronJob(job.cronExpr, () => {
        this.runnerService.execute(job).catch((err: unknown) => {
          this.logger.error(
            `CronJob 실행 오류 [${key}]: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      });

      this.schedulerRegistry.addCronJob(key, cronJob);
      cronJob.start();

      this.logger.debug(`CronJob 등록: ${key} (${job.cronExpr})`);
    } catch (error: unknown) {
      this.logger.error(
        `CronJob 등록 실패 [${key}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * CronJob 해제 — SchedulerRegistry에서 삭제
   */
  private unregisterCronJob(
    company: string,
    plantCd: string,
    jobCode: string,
  ): void {
    const key = `${company}_${plantCd}_${jobCode}`;

    try {
      const existing = this.schedulerRegistry.getCronJob(key);
      if (existing) {
        existing.stop();
        this.schedulerRegistry.deleteCronJob(key);
        this.logger.debug(`CronJob 해제: ${key}`);
      }
    } catch {
      // getCronJob이 없으면 예외 발생 — 무시
    }
  }

  // =============================================
  // 유틸리티
  // =============================================

  /**
   * cron 표현식으로 다음 실행 시각 계산
   * @param cronExpr cron 표현식
   * @returns 다음 실행 Date (파싱 실패 시 null)
   */
  private computeNextRun(cronExpr: string): Date | null {
    try {
      const expression = CronExpressionParser.parse(cronExpr);
      return expression.next().toDate();
    } catch {
      this.logger.warn(`cron 표현식 파싱 실패: ${cronExpr}`);
      return null;
    }
  }
}
