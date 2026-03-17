/**
 * @file entities/scheduler-log.entity.ts
 * @description 스케줄러 실행 로그 엔티티 - 각 작업 실행 이력을 기록한다.
 *              복합키: COMPANY + PLANT_CD + LOG_ID (PKG_SEQ_GENERATOR 채번).
 *
 * 초보자 가이드:
 * 1. 복합 PK: company(회사) + plantCd(공장) + logId(로그 일련번호)
 * 2. logId: PKG_SEQ_GENERATOR로 채번 (자동증가 아님)
 * 3. status: 실행 상태 — ComCode SCHED_STATUS (SUCCESS/FAIL/RUNNING/RETRYING/TIMEOUT/SKIPPED)
 * 4. durationMs: 실행 소요 시간(밀리초)
 * 5. job: SchedulerJob과 ManyToOne 관계 (company + plantCd + jobCode 복합 FK)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SchedulerJob } from './scheduler-job.entity';

@Entity({ name: 'SCHEDULER_LOGS' })
@Index('IDX_SCHED_LOGS_SEARCH', ['company', 'plantCd', 'startTime', 'status'])
export class SchedulerLog {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  /** PKG_SEQ_GENERATOR로 채번 */
  @PrimaryColumn({ name: 'LOG_ID', type: 'number' })
  logId: number;

  @Column({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  /** 스케줄러 작업 (복합 FK) */
  @ManyToOne(() => SchedulerJob)
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plantCd' },
    { name: 'JOB_CODE', referencedColumnName: 'jobCode' },
  ])
  job: SchedulerJob;

  /** 실행 시작 시각 */
  @Column({ name: 'START_TIME', type: 'timestamp' })
  startTime: Date;

  /** 실행 종료 시각 */
  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endTime: Date | null;

  /** 실행 소요 시간(밀리초) */
  @Column({ name: 'DURATION_MS', type: 'number', nullable: true })
  durationMs: number | null;

  /** 실행 상태 — ComCode SCHED_STATUS */
  @Column({ name: 'STATUS', type: 'varchar2', length: 20 })
  status: string;

  /** 실행 결과 메시지 */
  @Column({ name: 'RESULT_MSG', type: 'nvarchar2', length: 2000, nullable: true })
  resultMsg: string | null;

  /** 에러 메시지 */
  @Column({ name: 'ERROR_MSG', type: 'nvarchar2', length: 4000, nullable: true })
  errorMsg: string | null;

  /** 재시도 횟수 */
  @Column({ name: 'RETRY_COUNT', type: 'number', default: 0 })
  retryCount: number;

  /** 영향받은 행 수 */
  @Column({ name: 'AFFECTED_ROWS', type: 'number', nullable: true })
  affectedRows: number | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
