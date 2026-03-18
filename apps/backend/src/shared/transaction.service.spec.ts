/**
 * @file src/shared/transaction.service.spec.ts
 * @description TransactionService 단위 테스트 - 트랜잭션 래핑 로직 검증
 *
 * 초보자 가이드:
 * - commit/rollback/release 호출 순서 검증
 * - 실행: `pnpm test -- -t "TransactionService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner } from 'typeorm';
import { TransactionService } from './transaction.service';
import { MockLoggerService } from '../common/test/mock-logger.service';

describe('TransactionService', () => {
  let target: TransactionService;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should commit on success and return result', async () => {
      // Arrange
      const expectedResult = { id: 1, name: 'test' };

      // Act
      const result = await target.run(async (qr) => {
        return expectedResult;
      });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback on error and re-throw', async () => {
      // Arrange
      const error = new Error('DB error');

      // Act & Assert
      await expect(
        target.run(async () => { throw error; }),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should always release QueryRunner even on rollback error', async () => {
      // Arrange
      mockQueryRunner.rollbackTransaction.mockRejectedValue(new Error('rollback failed'));

      // Act & Assert
      await expect(
        target.run(async () => { throw new Error('original error'); }),
      ).rejects.toThrow();

      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should pass QueryRunner to callback', async () => {
      // Act
      await target.run(async (qr) => {
        // Assert — callback에서 받은 qr이 모킹된 것과 동일
        expect(qr).toBe(mockQueryRunner);
      });
    });
  });
});
