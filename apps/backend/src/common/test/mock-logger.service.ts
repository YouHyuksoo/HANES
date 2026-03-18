/**
 * @file src/common/test/mock-logger.service.ts
 * @description 테스트용 Mock Logger - NestJS LoggerService 구현체
 *
 * 초보자 가이드:
 * - 테스트 모듈 생성 시 `.setLogger(new MockLoggerService())`로 사용
 * - 실제 콘솔 출력 없이 로그 메시지를 무시합니다
 */
import { LoggerService } from '@nestjs/common';

export class MockLoggerService implements LoggerService {
  log(_message: string): void {}
  error(_message: string, _trace?: string): void {}
  warn(_message: string): void {}
  debug(_message: string): void {}
  verbose(_message: string): void {}
}
