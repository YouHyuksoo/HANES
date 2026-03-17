/**
 * @file src/modules/scheduler/executors/http.executor.ts
 * @description HTTP 실행기 - 외부 API를 호출하여 작업을 수행한다.
 *
 * 초보자 가이드:
 * 1. execTarget 형식: 'METHOD URL' (예: 'POST https://api.example.com/webhook')
 * 2. execParams(JSON): HTTP 요청 body로 전달
 * 3. 보안: IP 주소 직접 접근 차단, getAllowedHosts() 화이트리스트만 허용
 * 4. 허용 호스트: 환경변수 SCHEDULER_ALLOWED_HOSTS에 콤마 구분으로 등록
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { getAllowedHosts } from '../config/scheduler-security.config';

/** IP 주소 패턴 (IPv4) */
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

/** 허용되는 HTTP 메서드 */
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

@Injectable()
export class HttpExecutor implements IJobExecutor {
  private readonly logger = new Logger(HttpExecutor.name);

  /**
   * HTTP 요청을 실행한다.
   * @param job 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams, timeoutSec } = job;

    // execTarget을 METHOD URL로 분리
    const spaceIndex = execTarget.indexOf(' ');
    if (spaceIndex === -1) {
      throw new BadRequestException(
        `잘못된 execTarget 형식입니다. 'METHOD URL' 형태여야 합니다: ${execTarget}`,
      );
    }

    const method = execTarget.substring(0, spaceIndex).toUpperCase();
    const urlStr = execTarget.substring(spaceIndex + 1).trim();

    // HTTP 메서드 검증
    if (!ALLOWED_METHODS.includes(method)) {
      throw new BadRequestException(
        `허용되지 않은 HTTP 메서드입니다: ${method}. 허용: ${ALLOWED_METHODS.join(', ')}`,
      );
    }

    // URL 유효성 검증
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      throw new BadRequestException(`잘못된 URL입니다: ${urlStr}`);
    }

    // IP 주소 직접 접근 차단 (호스트명만 허용)
    if (IP_PATTERN.test(url.hostname)) {
      throw new ForbiddenException(
        'IP 주소 직접 접근은 차단되어 있습니다. 호스트명을 사용하세요.',
      );
    }

    // 허용 호스트 검증
    const allowedHosts = getAllowedHosts();
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname)) {
      throw new ForbiddenException(
        `허용되지 않은 호스트입니다: ${url.hostname}. SCHEDULER_ALLOWED_HOSTS 환경변수에 등록하세요.`,
      );
    }

    // 요청 body 파싱
    let body: string | undefined;
    if (execParams) {
      try {
        JSON.parse(execParams); // JSON 유효성 검증
        body = execParams;
      } catch (error: unknown) {
        throw new BadRequestException(
          `execParams JSON 파싱 실패: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`HTTP 요청: ${method} ${urlStr}`);

    // fetch 실행 (타임아웃 적용)
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      (timeoutSec || 300) * 1000,
    );

    try {
      const response = await fetch(urlStr, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: method !== 'GET' ? body : undefined,
        signal: controller.signal,
      });

      const statusText = `${response.status} ${response.statusText}`;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(응답 읽기 실패)');
        return {
          success: false,
          message: `HTTP 요청 실패: ${statusText} - ${errorBody.substring(0, 500)}`,
        };
      }

      return {
        success: true,
        message: `HTTP 요청 완료: ${method} ${url.hostname} → ${statusText}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
