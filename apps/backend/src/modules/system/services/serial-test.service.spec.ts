/**
 * @file src/modules/system/services/serial-test.service.spec.ts
 * @description SerialTestService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT)
 * - serialport 패키지는 동적 import이므로 모킹 필요
 * - 실행: `pnpm test -- -t "SerialTestService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SerialTestService } from './serial-test.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SerialTestService', () => {
  let target: SerialTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SerialTestService],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SerialTestService>(SerialTestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ─── listPorts ───
  describe('listPorts', () => {
    it('should return a list of serial ports', async () => {
      // Act
      const result = await target.listPorts();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      // Each port should have 'path' property
      for (const port of result) {
        expect(port).toHaveProperty('path');
      }
    });
  });
});
