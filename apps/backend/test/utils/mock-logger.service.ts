/**
 * @file test/utils/mock-logger.service.ts
 * @description 테스트용 Mock Logger - NestJS LoggerService 구현체
 */
import { LoggerService } from '@nestjs/common';

export class MockLoggerService implements LoggerService {
  log(_message: string): void {}
  error(_message: string, _trace?: string): void {}
  warn(_message: string): void {}
  debug(_message: string): void {}
  verbose(_message: string): void {}
}
