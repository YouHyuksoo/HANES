/**
 * @file src/modules/scheduler/scheduler.module.ts
 * @description 스케줄러 모듈 - 정기 작업 실행, 로그, 알림을 통합 관리한다.
 *
 * 초보자 가이드:
 * 1. **ScheduleModule.forRoot()**: @nestjs/schedule의 CronJob 인프라 초기화
 * 2. **TypeOrmModule.forFeature()**: SchedulerJob/Log/Notification 엔티티 등록
 * 3. **컨트롤러**: Job(CRUD), Log(조회/통계), Noti(알림) API
 * 4. **서비스**: JobService(CRUD+Cron), LogService(로그), NotiService(알림), RunnerService(실행엔진)
 * 5. **Executor**: 5가지 실행기(Service/Procedure/SQL/HTTP/Script) + Factory
 * 6. **exports**: SchedulerNotiService — 헤더 알림 벨에서 사용
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerJob } from '../../entities/scheduler-job.entity';
import { SchedulerLog } from '../../entities/scheduler-log.entity';
import { SchedulerNotification } from '../../entities/scheduler-notification.entity';
import { User } from '../../entities/user.entity';

// 컨트롤러
import { SchedulerJobController } from './controllers/scheduler-job.controller';
import { SchedulerLogController } from './controllers/scheduler-log.controller';
import { SchedulerNotiController } from './controllers/scheduler-noti.controller';

// 서비스
import { SchedulerJobService } from './services/scheduler-job.service';
import { SchedulerLogService } from './services/scheduler-log.service';
import { SchedulerNotiService } from './services/scheduler-noti.service';
import { SchedulerRunnerService } from './services/scheduler-runner.service';

// Executor
import { ExecutorFactory } from './executors/executor.factory';
import { ServiceExecutor } from './executors/service.executor';
import { ProcedureExecutor } from './executors/procedure.executor';
import { SqlExecutor } from './executors/sql.executor';
import { HttpExecutor } from './executors/http.executor';
import { ScriptExecutor } from './executors/script.executor';
import { DbBackupService } from './services/db-backup.service';
import { SERVICE_CLASS_MAP } from './config/scheduler-security.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([SchedulerJob, SchedulerLog, SchedulerNotification, User]),
  ],
  controllers: [
    SchedulerJobController,
    SchedulerLogController,
    SchedulerNotiController,
  ],
  providers: [
    SchedulerJobService,
    SchedulerLogService,
    SchedulerNotiService,
    SchedulerRunnerService,
    ExecutorFactory,
    ServiceExecutor,
    ProcedureExecutor,
    SqlExecutor,
    HttpExecutor,
    ScriptExecutor,
    DbBackupService,
  ],
  exports: [SchedulerNotiService],
})
export class SchedulerModule implements OnModuleInit {
  /** 모듈 초기화 시 SERVICE_CLASS_MAP에 서비스 클래스 등록 */
  onModuleInit(): void {
    SERVICE_CLASS_MAP.set('DbBackupService', DbBackupService);
  }
}
