/**
 * @file src/modules/master/services/partner.service.spec.ts
 * @description PartnerService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "PartnerService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PartnerService } from './partner.service';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PartnerService', () => {
  let target: PartnerService;
  let mockRepo: DeepMocked<Repository<PartnerMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<PartnerMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: getRepositoryToken(PartnerMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PartnerService>(PartnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return partner when found', async () => {
      // Arrange
      const partner = { partnerCode: 'P01', partnerName: 'Vendor1' } as PartnerMaster;
      mockRepo.findOne.mockResolvedValue(partner);

      // Act
      const result = await target.findById('P01');

      // Assert
      expect(result).toEqual(partner);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('P99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new partner', async () => {
      // Arrange
      const dto = { partnerCode: 'P01', partnerName: 'Vendor1', partnerType: 'SUPPLIER' } as any;
      const created = { ...dto, useYn: 'Y' } as PartnerMaster;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when partner code exists', async () => {
      // Arrange
      const dto = { partnerCode: 'P01', partnerName: 'Vendor1' } as any;
      mockRepo.findOne.mockResolvedValue({ partnerCode: 'P01' } as PartnerMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return partner', async () => {
      // Arrange
      const existing = { partnerCode: 'P01', partnerName: 'Old' } as PartnerMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('P01', { partnerName: 'New' } as any);

      // Assert
      expect(result).toEqual(existing);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return partnerCode', async () => {
      // Arrange
      const existing = { partnerCode: 'P01' } as PartnerMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('P01');

      // Assert
      expect(result).toEqual({ partnerCode: 'P01' });
    });
  });

  // ─── findByType ───
  describe('findByType', () => {
    it('should return active partners of given type', async () => {
      // Arrange
      const partners = [{ partnerCode: 'P01', partnerType: 'SUPPLIER' }] as PartnerMaster[];
      mockRepo.find.mockResolvedValue(partners);

      // Act
      const result = await target.findByType('SUPPLIER');

      // Assert
      expect(result).toEqual(partners);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { partnerType: 'SUPPLIER', useYn: 'Y' },
        order: { partnerCode: 'asc' },
      });
    });
  });

  // ─── getStatistics ───
  describe('getStatistics', () => {
    it('should return count statistics', async () => {
      // Arrange
      mockRepo.count
        .mockResolvedValueOnce(100) // totalCount
        .mockResolvedValueOnce(60)  // supplierCount
        .mockResolvedValueOnce(30)  // customerCount
        .mockResolvedValueOnce(80); // activeCount

      // Act
      const result = await target.getStatistics();

      // Assert
      expect(result).toEqual({
        totalCount: 100,
        supplierCount: 60,
        customerCount: 30,
        activeCount: 80,
      });
    });
  });
});
