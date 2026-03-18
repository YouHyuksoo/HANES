/**
 * @file src/modules/num-rule/num-rule.service.spec.ts
 * @description NumRuleService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "NumRuleService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NumRuleService } from './num-rule.service';
import { MockLoggerService } from '../../common/test/mock-logger.service';

describe('NumRuleService', () => {
  let target: NumRuleService;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumRuleService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<NumRuleService>(NumRuleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── nextNumber ───
  describe('nextNumber', () => {
    it('should generate number with pattern replacement', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn(),
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);

      // First call: SELECT FOR UPDATE
      mockQr.query.mockResolvedValueOnce([{
        PATTERN: '{PREFIX}{YYYY}{MM}{DD}-{SEQ}',
        PREFIX: 'ARR',
        SUFFIX: null,
        SEQ_LENGTH: 4,
        CURRENT_SEQ: 0,
        RESET_TYPE: 'DAILY',
        LAST_RESET: null,
      }]);
      // Second call: UPDATE
      mockQr.query.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await target.nextNumber('ARRIVAL');

      // Assert
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      expect(result).toBe(`ARR${yyyy}${mm}${dd}-0001`);
      expect(mockQr.commitTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when rule not found', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);

      // Act & Assert
      await expect(target.nextNumber('NONEXIST')).rejects.toThrow(InternalServerErrorException);
      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reset sequence when DAILY reset type and new day', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn(),
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockQr.query.mockResolvedValueOnce([{
        PATTERN: '{SEQ}',
        PREFIX: 'T',
        SUFFIX: null,
        SEQ_LENGTH: 3,
        CURRENT_SEQ: 99,
        RESET_TYPE: 'DAILY',
        LAST_RESET: yesterday,
      }]);
      mockQr.query.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await target.nextNumber('TEST');

      // Assert
      expect(result).toBe('T001'); // Reset to 1
    });

    it('should increment sequence when same day (no reset)', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn(),
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);

      mockQr.query.mockResolvedValueOnce([{
        PATTERN: '{SEQ}',
        PREFIX: null,
        SUFFIX: null,
        SEQ_LENGTH: 4,
        CURRENT_SEQ: 5,
        RESET_TYPE: 'DAILY',
        LAST_RESET: new Date(), // today
      }]);
      mockQr.query.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await target.nextNumber('TEST');

      // Assert
      expect(result).toBe('0006');
    });

    it('should handle NONE reset type (never reset)', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn(),
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);

      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      mockQr.query.mockResolvedValueOnce([{
        PATTERN: '{SEQ}',
        PREFIX: null,
        SUFFIX: 'S',
        SEQ_LENGTH: 5,
        CURRENT_SEQ: 999,
        RESET_TYPE: 'NONE',
        LAST_RESET: lastYear,
      }]);
      mockQr.query.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await target.nextNumber('TEST');

      // Assert
      expect(result).toBe('01000S'); // 999+1 = 1000, no reset
    });
  });

  // ─── nextNumberInTx ───
  describe('nextNumberInTx', () => {
    it('should generate number using provided query runner', async () => {
      // Arrange
      const mockQr = {
        query: jest.fn(),
      };

      mockQr.query.mockResolvedValueOnce([{
        PATTERN: '{PREFIX}{SEQ}',
        PREFIX: 'X',
        SUFFIX: null,
        SEQ_LENGTH: 3,
        CURRENT_SEQ: 0,
        RESET_TYPE: 'NONE',
        LAST_RESET: null,
      }]);
      mockQr.query.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await target.nextNumberInTx(mockQr as any, 'TEST');

      // Assert
      expect(result).toBe('X001');
    });
  });
});
