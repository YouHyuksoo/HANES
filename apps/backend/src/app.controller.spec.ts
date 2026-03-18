/**
 * @file src/app.controller.spec.ts
 * @description AppController 단위 테스트
 *
 * 초보자 가이드:
 * - AppController는 헬스체크 및 Hello World 엔드포인트 제공
 * - DataSource, AppService 모두 모킹하여 독립 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MockLoggerService } from './common/test/mock-logger.service';

describe('AppController', () => {
  let target: AppController;
  let mockAppService: DeepMocked<AppService>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockAppService = createMock<AppService>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: mockAppService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return Hello World', () => {
      // Arrange
      mockAppService.getHello.mockReturnValue('Hello World!');

      // Act
      const result = target.getHello();

      // Assert
      expect(result).toBe('Hello World!');
    });
  });

  describe('getHealth', () => {
    it('should return ok status when DB is connected', async () => {
      // Arrange
      mockDataSource.isInitialized = true;
      mockDataSource.query.mockResolvedValue([{ '1': 1 }]);

      // Act
      const result = await target.getHealth();

      // Assert
      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('connected');
      expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded status when DB is not initialized', async () => {
      // Arrange
      mockDataSource.isInitialized = false;

      // Act
      const result = await target.getHealth();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('disconnected');
    });

    it('should return error status when DB query fails', async () => {
      // Arrange
      mockDataSource.isInitialized = true;
      mockDataSource.query.mockRejectedValue(new Error('ORA-12541'));

      // Act
      const result = await target.getHealth();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('error');
      expect(result.database.error).toBe('ORA-12541');
    });
  });
});
