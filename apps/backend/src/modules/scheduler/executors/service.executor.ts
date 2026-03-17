/**
 * @file src/modules/scheduler/executors/service.executor.ts
 * @description SERVICE 실행기 - NestJS 서비스의 메서드를 호출하여 작업을 실행한다.
 *
 * 초보자 가이드:
 * 1. execTarget 형식: 'ServiceName.methodName' (예: 'InterfaceService.scheduledSyncBom')
 * 2. ALLOWED_SERVICE_METHODS 화이트리스트에 등록된 메서드만 호출 가능
 * 3. SERVICE_CLASS_MAP에서 서비스 이름 → 클래스 참조를 조회
 * 4. ModuleRef.get()으로 서비스 인스턴스를 가져와 메서드 호출
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import {
  ALLOWED_SERVICE_METHODS,
  SERVICE_CLASS_MAP,
} from '../config/scheduler-security.config';

@Injectable()
export class ServiceExecutor implements IJobExecutor {
  private readonly logger = new Logger(ServiceExecutor.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * 서비스 메서드를 호출하여 작업을 실행한다.
   * @param job 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;

    // execTarget을 ServiceName.methodName으로 분리
    const dotIndex = execTarget.indexOf('.');
    if (dotIndex === -1) {
      throw new BadRequestException(
        `잘못된 execTarget 형식입니다. 'ServiceName.methodName' 형태여야 합니다: ${execTarget}`,
      );
    }

    const serviceName = execTarget.substring(0, dotIndex);
    const methodName = execTarget.substring(dotIndex + 1);

    // 화이트리스트 검증
    if (!ALLOWED_SERVICE_METHODS.includes(execTarget)) {
      throw new BadRequestException(
        `허용되지 않은 서비스 메서드입니다: ${execTarget}`,
      );
    }

    // SERVICE_CLASS_MAP에서 클래스 참조 조회
    const classRef = SERVICE_CLASS_MAP.get(serviceName);
    if (!classRef) {
      throw new BadRequestException(
        `등록되지 않은 서비스입니다: ${serviceName}. SERVICE_CLASS_MAP에 등록이 필요합니다.`,
      );
    }

    // ModuleRef로 서비스 인스턴스 조회
    const serviceInstance = this.moduleRef.get(classRef, { strict: false });
    if (!serviceInstance) {
      throw new BadRequestException(
        `서비스 인스턴스를 찾을 수 없습니다: ${serviceName}`,
      );
    }

    // 메서드 존재 여부 확인
    const method = serviceInstance[methodName];
    if (typeof method !== 'function') {
      throw new BadRequestException(
        `메서드를 찾을 수 없습니다: ${serviceName}.${methodName}`,
      );
    }

    // 파라미터 파싱
    let params: Record<string, unknown> | undefined;
    if (execParams) {
      try {
        params = JSON.parse(execParams) as Record<string, unknown>;
      } catch (error: unknown) {
        throw new BadRequestException(
          `execParams JSON 파싱 실패: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`서비스 메서드 실행: ${execTarget}`);

    // 메서드 호출
    const result = await method.call(serviceInstance, params);

    // 결과에서 affectedRows 추출 (있으면)
    const affectedRows =
      typeof result === 'object' && result !== null && 'affectedRows' in result
        ? (result as { affectedRows: number }).affectedRows
        : undefined;

    return {
      success: true,
      affectedRows,
      message: `서비스 메서드 실행 완료: ${execTarget}`,
    };
  }
}
