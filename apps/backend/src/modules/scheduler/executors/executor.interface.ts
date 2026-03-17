/**
 * @file src/modules/scheduler/executors/executor.interface.ts
 * @description 스케줄러 작업 실행기(Executor) 인터페이스 정의
 *
 * 초보자 가이드:
 * 1. **IJobExecutor**: 모든 실행기가 구현해야 하는 공통 인터페이스
 * 2. **ExecutorResult**: 실행 결과 객체 (성공여부, 영향행수, 메시지)
 * 3. 각 실행 유형(SERVICE, PROCEDURE, SQL, HTTP, SCRIPT)마다 별도 클래스가 이 인터페이스를 구현
 */

import { SchedulerJob } from '../../../entities/scheduler-job.entity';

/** 작업 실행 결과 */
export interface ExecutorResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 영향받은 행 수 (SQL/PROCEDURE 등에서 사용) */
  affectedRows?: number;
  /** 실행 결과 메시지 */
  message?: string;
}

/** 작업 실행기 인터페이스 - 모든 Executor가 구현해야 함 */
export interface IJobExecutor {
  /**
   * 스케줄러 작업을 실행한다.
   * @param job 실행할 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  execute(job: SchedulerJob): Promise<ExecutorResult>;
}
