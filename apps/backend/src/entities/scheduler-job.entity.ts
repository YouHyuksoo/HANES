/**
 * @file entities/scheduler-job.entity.ts
 * @description 스케줄러 작업 엔티티 - 정기 실행 작업(Job)의 메타 정보를 관리한다.
 *              복합키: COMPANY + PLANT_CD + JOB_CODE.
 *
 * 초보자 가이드:
 * 1. 복합 PK: company(회사) + plantCd(공장) + jobCode(작업코드)
 * 2. execType: 실행 유형 (SERVICE / PROCEDURE / SQL / HTTP / SCRIPT) — ComCode SCHED_EXEC_TYPE
 * 3. jobGroup: 작업 그룹 — ComCode SCHED_GROUP (INTERFACE / RETRY / MAINTENANCE)
 * 4. cronExpr: cron 표현식 (예: '0 *\/10 * * * *' = 10분마다)
 * 5. isActive: 'Y' 활성 / 'N' 비활성 — 비활성 작업은 스케줄러가 무시
 * 6. maxRetry: 실패 시 최대 재시도 횟수 (0이면 재시도 안 함)
 * 7. timeoutSec: 실행 제한 시간(초), 초과 시 TIMEOUT 처리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'SCHEDULER_JOBS' })
export class SchedulerJob {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  @PrimaryColumn({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  @Column({ name: 'JOB_NAME', type: 'nvarchar2', length: 100 })
  jobName: string;

  /** 작업 그룹 — ComCode SCHED_GROUP */
  @Column({ name: 'JOB_GROUP', type: 'varchar2', length: 20 })
  jobGroup: string;

  /** 실행 유형 — ComCode SCHED_EXEC_TYPE */
  @Column({ name: 'EXEC_TYPE', type: 'varchar2', length: 20 })
  execType: string;

  /** 실행 대상 (서비스 메소드명, SQL문, URL 등) */
  @Column({ name: 'EXEC_TARGET', type: 'nvarchar2', length: 500 })
  execTarget: string;

  /** 실행 파라미터 (JSON 문자열) */
  @Column({ name: 'EXEC_PARAMS', type: 'nvarchar2', length: 2000, nullable: true })
  execParams: string | null;

  /** cron 표현식 */
  @Column({ name: 'CRON_EXPR', type: 'varchar2', length: 50 })
  cronExpr: string;

  /** 활성 여부 ('Y' / 'N') */
  @Column({ name: 'IS_ACTIVE', type: 'char', length: 1, default: "'N'" })
  isActive: string;

  /** 최대 재시도 횟수 */
  @Column({ name: 'MAX_RETRY', type: 'number', default: 0 })
  maxRetry: number;

  /** 실행 제한 시간(초) */
  @Column({ name: 'TIMEOUT_SEC', type: 'number', default: 300 })
  timeoutSec: number;

  /** 작업 설명 */
  @Column({ name: 'DESCRIPTION', type: 'nvarchar2', length: 500, nullable: true })
  description: string | null;

  /** 마지막 실행 시각 */
  @Column({ name: 'LAST_RUN_AT', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  /** 마지막 실행 상태 — ComCode SCHED_STATUS */
  @Column({ name: 'LAST_STATUS', type: 'varchar2', length: 20, nullable: true })
  lastStatus: string | null;

  /** 마지막 에러 발생 시각 */
  @Column({ name: 'LAST_ERROR_AT', type: 'timestamp', nullable: true })
  lastErrorAt: Date | null;

  /** 다음 실행 예정 시각 */
  @Column({ name: 'NEXT_RUN_AT', type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
