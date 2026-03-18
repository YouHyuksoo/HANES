/**
 * @file src/modules/customs/services/customs.service.spec.ts
 * @description CustomsService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "CustomsService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { CustomsService } from './customs.service';
import { CustomsEntry } from '../../../entities/customs-entry.entity';
import { CustomsLot } from '../../../entities/customs-lot.entity';
import { CustomsUsageReport } from '../../../entities/customs-usage-report.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('CustomsService', () => {
  let target: CustomsService;
  let mockEntryRepo: DeepMocked<Repository<CustomsEntry>>;
  let mockLotRepo: DeepMocked<Repository<CustomsLot>>;
  let mockUsageRepo: DeepMocked<Repository<CustomsUsageReport>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockEntryRepo = createMock<Repository<CustomsEntry>>();
    mockLotRepo = createMock<Repository<CustomsLot>>();
    mockUsageRepo = createMock<Repository<CustomsUsageReport>>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomsService,
        { provide: getRepositoryToken(CustomsEntry), useValue: mockEntryRepo },
        { provide: getRepositoryToken(CustomsLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(CustomsUsageReport), useValue: mockUsageRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<CustomsService>(CustomsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Entry CRUD ───
  describe('findEntryById', () => {
    it('should return entry with lots and reports', async () => {
      // Arrange
      const entry = { entryNo: 'E001' } as CustomsEntry;
      mockEntryRepo.findOne.mockResolvedValue(entry);
      mockLotRepo.find.mockResolvedValue([]);
      mockUsageRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findEntryById('E001');

      // Assert
      expect(result.entryNo).toBe('E001');
      expect(result.customsLots).toEqual([]);
    });

    it('should throw NotFoundException when entry not found', async () => {
      // Arrange
      mockEntryRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findEntryById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createEntry', () => {
    it('should create a new entry', async () => {
      // Arrange
      const dto = { entryNo: 'E001', blNo: 'BL001' } as any;
      mockEntryRepo.findOne.mockResolvedValue(null);
      mockEntryRepo.create.mockReturnValue(dto as CustomsEntry);
      mockEntryRepo.save.mockResolvedValue(dto as CustomsEntry);

      // Act
      const result = await target.createEntry(dto);

      // Assert
      expect(result).toEqual(dto);
    });

    it('should throw ConflictException when entryNo exists', async () => {
      // Arrange
      mockEntryRepo.findOne.mockResolvedValue({ entryNo: 'E001' } as CustomsEntry);

      // Act & Assert
      await expect(target.createEntry({ entryNo: 'E001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry', async () => {
      // Arrange
      mockEntryRepo.findOne.mockResolvedValue({ entryNo: 'E001' } as CustomsEntry);
      mockLotRepo.find.mockResolvedValue([]);
      mockUsageRepo.find.mockResolvedValue([]);
      mockEntryRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.deleteEntry('E001');

      // Assert
      expect(result).toEqual({ entryNo: 'E001' });
    });
  });

  // ─── Lot CRUD ───
  describe('findLotByKey', () => {
    it('should return lot with entry and reports', async () => {
      // Arrange
      const lot = { entryNo: 'E001', matUid: 'M001' } as CustomsLot;
      mockLotRepo.findOne.mockResolvedValue(lot);
      mockEntryRepo.findOne.mockResolvedValue({ entryNo: 'E001' } as CustomsEntry);
      mockUsageRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findLotByKey('E001', 'M001');

      // Assert
      expect(result.entryNo).toBe('E001');
    });

    it('should throw NotFoundException when lot not found', async () => {
      // Arrange
      mockLotRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findLotByKey('E001', 'NONE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createLot', () => {
    it('should create a new lot', async () => {
      // Arrange
      const dto = { entryNo: 'E001', matUid: 'M001', itemCode: 'ITEM1', qty: 100 } as any;
      mockLotRepo.findOne.mockResolvedValue(null);
      mockLotRepo.create.mockReturnValue(dto as CustomsLot);
      mockLotRepo.save.mockResolvedValue(dto as CustomsLot);

      // Act
      const result = await target.createLot(dto);

      // Assert
      expect(result).toEqual(dto);
    });

    it('should throw ConflictException when lot exists', async () => {
      // Arrange
      mockLotRepo.findOne.mockResolvedValue({ entryNo: 'E001', matUid: 'M001' } as CustomsLot);

      // Act & Assert
      await expect(target.createLot({ entryNo: 'E001', matUid: 'M001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── Usage Report ───
  describe('createUsageReport', () => {
    it('should throw BadRequestException when usage exceeds remainQty', async () => {
      // Arrange
      const lot = { entryNo: 'E001', matUid: 'M001', remainQty: 5, usedQty: 95, qty: 100 } as CustomsLot;
      mockLotRepo.findOne.mockResolvedValue(lot);
      mockEntryRepo.findOne.mockResolvedValue({ entryNo: 'E001' } as CustomsEntry);
      mockUsageRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(target.createUsageReport({
        lotEntryNo: 'E001',
        lotMatUid: 'M001',
        usageQty: 10,
      } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUsageReport', () => {
    it('should update usage report', async () => {
      // Arrange
      const report = { reportNo: 'USG001' } as CustomsUsageReport;
      mockUsageRepo.findOne.mockResolvedValue(report);
      mockUsageRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updateUsageReport('USG001', { status: 'REPORTED' } as any);

      // Assert
      expect(mockUsageRepo.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when report not found', async () => {
      // Arrange
      mockUsageRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.updateUsageReport('NONE', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Summary ───
  describe('getCustomsSummary', () => {
    it('should return summary counts', async () => {
      // Arrange
      mockEntryRepo.count.mockResolvedValue(10);
      mockLotRepo.count.mockResolvedValue(5);
      const qb = createMock<any>();
      qb.select.mockReturnThis();
      qb.where.mockReturnThis();
      qb.getRawOne.mockResolvedValue({ total: 100 });
      mockLotRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.getCustomsSummary();

      // Assert
      expect(result).toHaveProperty('totalEntries');
      expect(result).toHaveProperty('bondedLots');
    });
  });
});
