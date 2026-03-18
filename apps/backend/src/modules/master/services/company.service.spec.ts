/**
 * @file src/modules/master/services/company.service.spec.ts
 * @description CompanyService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "CompanyService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CompanyService } from './company.service';
import { CompanyMaster } from '../../../entities/company-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('CompanyService', () => {
  let target: CompanyService;
  let mockRepo: DeepMocked<Repository<CompanyMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<CompanyMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: getRepositoryToken(CompanyMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<CompanyService>(CompanyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return company when found (composite key)', async () => {
      // Arrange
      const company = { companyCode: 'C01', plant: 'P01' } as CompanyMaster;
      mockRepo.findOne.mockResolvedValue(company);

      // Act
      const result = await target.findById('C01::P01');

      // Assert
      expect(result).toEqual(company);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { companyCode: 'C01', plant: 'P01' },
      });
    });

    it('should use default plant "-" when not in id', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('C01')).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { companyCode: 'C01', plant: '-' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('C01::P01')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findPlantsByCompany ───
  describe('findPlantsByCompany', () => {
    it('should return plants mapped to plantCode/plantName', async () => {
      // Arrange
      const rows = [
        { plant: 'P01', companyName: 'Company1' },
        { plant: 'P02', companyName: 'Company1' },
        { plant: null, companyName: 'Company1' },
      ] as CompanyMaster[];
      mockRepo.find.mockResolvedValue(rows);

      // Act
      const result = await target.findPlantsByCompany('C01');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ plantCode: 'P01', plantName: 'P01' });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new company', async () => {
      // Arrange
      const dto = { companyCode: 'C01', companyName: 'TestCo' } as any;
      const created = { ...dto, useYn: 'Y' } as CompanyMaster;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when company code exists', async () => {
      // Arrange
      const dto = { companyCode: 'C01', companyName: 'TestCo' } as any;
      mockRepo.findOne.mockResolvedValue({ companyCode: 'C01' } as CompanyMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return company', async () => {
      // Arrange
      const existing = { companyCode: 'C01', plant: 'P01' } as CompanyMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('C01::P01', { companyName: 'Updated' } as any);

      // Assert
      expect(result).toEqual(existing);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return id', async () => {
      // Arrange
      const existing = { companyCode: 'C01', plant: 'P01' } as CompanyMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('C01::P01');

      // Assert
      expect(result).toEqual({ id: 'C01::P01' });
    });
  });
});
