/**
 * @file src/modules/master/services/vendor-barcode-mapping.service.spec.ts
 * @description VendorBarcodeMappingService 단위 테스트 - 바코드 매칭 로직(EXACT/PREFIX/REGEX) 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "VendorBarcodeMappingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VendorBarcodeMappingService } from './vendor-barcode-mapping.service';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('VendorBarcodeMappingService', () => {
  let target: VendorBarcodeMappingService;
  let mockRepo: DeepMocked<Repository<VendorBarcodeMapping>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<VendorBarcodeMapping>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorBarcodeMappingService,
        { provide: getRepositoryToken(VendorBarcodeMapping), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<VendorBarcodeMappingService>(VendorBarcodeMappingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByBarcode ───
  describe('findByBarcode', () => {
    it('should return mapping when found', async () => {
      // Arrange
      const mapping = { vendorBarcode: 'BC01', itemCode: 'ITEM01' } as VendorBarcodeMapping;
      mockRepo.findOne.mockResolvedValue(mapping);

      // Act
      const result = await target.findByBarcode('BC01');

      // Assert
      expect(result).toEqual(mapping);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByBarcode('BC99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new mapping', async () => {
      // Arrange
      const dto = { vendorBarcode: 'BC01', itemCode: 'ITEM01' } as any;
      const created = { ...dto, matchType: 'EXACT', useYn: 'Y' } as VendorBarcodeMapping;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when barcode already exists', async () => {
      // Arrange
      const dto = { vendorBarcode: 'BC01' } as any;
      mockRepo.findOne.mockResolvedValue({ vendorBarcode: 'BC01' } as VendorBarcodeMapping);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── resolveBarcode ───
  describe('resolveBarcode', () => {
    it('should match EXACT barcode', async () => {
      // Arrange
      const mapping = { vendorBarcode: 'ABC123', matchType: 'EXACT', useYn: 'Y' } as VendorBarcodeMapping;
      mockRepo.findOne.mockResolvedValue(mapping);

      // Act
      const result = await target.resolveBarcode('ABC123');

      // Assert
      expect(result.matched).toBe(true);
      expect(result.matchMethod).toBe('EXACT');
    });

    it('should match PREFIX barcode when EXACT fails', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null); // EXACT fails
      const prefixMapping = { vendorBarcode: 'ABC', matchType: 'PREFIX', useYn: 'Y' } as VendorBarcodeMapping;
      mockRepo.find
        .mockResolvedValueOnce([prefixMapping]) // PREFIX mappings
        .mockResolvedValueOnce([]); // REGEX mappings (not reached)

      // Act
      const result = await target.resolveBarcode('ABC123');

      // Assert
      expect(result.matched).toBe(true);
      expect(result.matchMethod).toBe('PREFIX');
    });

    it('should match REGEX barcode when EXACT and PREFIX fail', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null); // EXACT fails
      const regexMapping = { vendorBarcode: '^ABC\\d+$', matchType: 'REGEX', useYn: 'Y' } as VendorBarcodeMapping;
      mockRepo.find
        .mockResolvedValueOnce([]) // no PREFIX matches
        .mockResolvedValueOnce([regexMapping]); // REGEX mappings

      // Act
      const result = await target.resolveBarcode('ABC123');

      // Assert
      expect(result.matched).toBe(true);
      expect(result.matchMethod).toBe('REGEX');
    });

    it('should return not matched when no match found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.resolveBarcode('UNKNOWN');

      // Assert
      expect(result.matched).toBe(false);
      expect(result.mapping).toBeNull();
      expect(result.matchMethod).toBeNull();
    });

    it('should skip invalid regex patterns gracefully', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);
      const badRegex = { vendorBarcode: '[invalid', matchType: 'REGEX', useYn: 'Y' } as VendorBarcodeMapping;
      mockRepo.find
        .mockResolvedValueOnce([]) // PREFIX
        .mockResolvedValueOnce([badRegex]); // REGEX

      // Act
      const result = await target.resolveBarcode('test');

      // Assert
      expect(result.matched).toBe(false);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return mapping', async () => {
      // Arrange
      const existing = { vendorBarcode: 'BC01', itemCode: 'ITEM01' } as VendorBarcodeMapping;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('BC01', { itemCode: 'ITEM02' } as any);

      // Assert
      expect(mockRepo.update).toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return vendorBarcode', async () => {
      // Arrange
      const existing = { vendorBarcode: 'BC01' } as VendorBarcodeMapping;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('BC01');

      // Assert
      expect(result).toEqual({ vendorBarcode: 'BC01' });
    });
  });
});
