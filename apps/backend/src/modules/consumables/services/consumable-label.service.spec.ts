/**
 * @file src/modules/consumables/services/consumable-label.service.spec.ts
 * @description ConsumableLabelService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ConsumableLabelService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ConsumableLabelService } from './consumable-label.service';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ConsumableLabelService', () => {
  let target: ConsumableLabelService;
  let mockMasterRepo: DeepMocked<Repository<ConsumableMaster>>;
  let mockStockRepo: DeepMocked<Repository<ConsumableStock>>;
  let mockLogRepo: DeepMocked<Repository<ConsumableLog>>;
  let mockPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;

  beforeEach(async () => {
    mockMasterRepo = createMock<Repository<ConsumableMaster>>();
    mockStockRepo = createMock<Repository<ConsumableStock>>();
    mockLogRepo = createMock<Repository<ConsumableLog>>();
    mockPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockDataSource = createMock<DataSource>();
    mockSeqGenerator = createMock<SeqGeneratorService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumableLabelService,
        { provide: getRepositoryToken(ConsumableMaster), useValue: mockMasterRepo },
        { provide: getRepositoryToken(ConsumableStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(ConsumableLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockPrintLogRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ConsumableLabelService>(ConsumableLabelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findLabelableConsumables ───
  describe('findLabelableConsumables', () => {
    it('should return masters with instance counts', async () => {
      // Arrange
      mockMasterRepo.find.mockResolvedValue([
        { consumableCode: 'C001', consumableName: 'Test', stockQty: 5, useYn: 'Y' },
      ] as ConsumableMaster[]);

      const qb = createMock<any>();
      qb.select.mockReturnThis();
      qb.addSelect.mockReturnThis();
      qb.groupBy.mockReturnThis();
      qb.getRawMany.mockResolvedValue([
        { consumableCode: 'C001', totalCount: '3', pendingCount: '1' },
      ]);
      mockStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findLabelableConsumables();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].instanceCount).toBe(3);
      expect(result[0].pendingCount).toBe(1);
    });
  });

  // ─── createConLabels ───
  describe('createConLabels', () => {
    it('should create labels with generated UIDs', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue({
        consumableCode: 'C001',
        consumableName: 'Test',
        unitPrice: 100,
      } as ConsumableMaster);

      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn().mockReturnValue({} as any),
          save: jest.fn().mockResolvedValue({} as any),
        },
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);
      mockSeqGenerator.nextConUid.mockResolvedValueOnce('CON001').mockResolvedValueOnce('CON002');

      // Act
      const result = await target.createConLabels(
        { consumableCode: 'C001', qty: 2 } as any,
        'COMP',
        'PLANT',
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].conUid).toBe('CON001');
      expect(result[1].conUid).toBe('CON002');
    });

    it('should throw NotFoundException when master not found', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.createConLabels({ consumableCode: 'NONE', qty: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findPendingStocks ───
  describe('findPendingStocks', () => {
    it('should return pending stocks with master info', async () => {
      // Arrange
      mockStockRepo.find.mockResolvedValue([
        { conUid: 'CON001', consumableCode: 'C001', status: 'PENDING' },
      ] as ConsumableStock[]);
      mockMasterRepo.find.mockResolvedValue([
        { consumableCode: 'C001', consumableName: 'Test' },
      ] as ConsumableMaster[]);

      // Act
      const result = await target.findPendingStocks();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].consumableName).toBe('Test');
    });
  });

  // ─── confirmReceiving ───
  describe('confirmReceiving', () => {
    it('should throw NotFoundException when stock not found', async () => {
      // Arrange
      mockStockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.confirmReceiving({ conUid: 'NONE' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already received', async () => {
      // Arrange
      mockStockRepo.findOne.mockResolvedValue({
        conUid: 'CON001',
        status: 'ACTIVE',
      } as ConsumableStock);

      // Act & Assert
      await expect(
        target.confirmReceiving({ conUid: 'CON001' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── bulkConfirmReceiving ───
  describe('bulkConfirmReceiving', () => {
    it('should process multiple confirmations', async () => {
      // Arrange
      const stock = {
        conUid: 'CON001',
        status: 'PENDING',
        consumableCode: 'C001',
      } as ConsumableStock;

      mockStockRepo.findOne.mockResolvedValue(stock);

      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn().mockResolvedValue(stock),
          increment: jest.fn().mockResolvedValue({} as any),
          create: jest.fn().mockReturnValue({} as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockDataSource.createQueryRunner.mockReturnValue(mockQr as any);
      mockMasterRepo.findOne.mockResolvedValue({ consumableCode: 'C001', consumableName: 'Test' } as ConsumableMaster);

      // Act
      const result = await target.bulkConfirmReceiving({
        conUids: ['CON001'],
      } as any);

      // Assert
      expect(result).toHaveLength(1);
    });
  });
});
