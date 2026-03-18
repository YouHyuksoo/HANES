/**
 * @file src/modules/master/services/bom.service.spec.ts
 * @description BomService 단위 테스트 - BOM CRUD, 계층 조회, 자기참조 방지 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "BomService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BomService } from './bom.service';
import { BomMaster } from '../../../entities/bom-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('BomService', () => {
  let target: BomService;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockPartRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomService,
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<BomService>(BomService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return bom with part info when found', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'P01', itemName: 'Parent' } as PartMaster,
        { itemCode: 'C01', itemName: 'Child' } as PartMaster,
      ]);

      // Act
      const result = await target.findById('P01::C01::A');

      // Assert
      expect(result.parentItemCode).toBe('P01');
      expect(result.parentPart).toEqual({ itemCode: 'P01', itemName: 'Parent' });
      expect(result.childPart).toEqual({ itemCode: 'C01', itemName: 'Child' });
    });

    it('should throw NotFoundException when bom not found', async () => {
      // Arrange
      mockBomRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('P01::C01::A')).rejects.toThrow(NotFoundException);
    });

    it('should default revision to A when not provided', async () => {
      // Arrange
      mockBomRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('P01::C01')).rejects.toThrow(NotFoundException);
      expect(mockBomRepo.findOne).toHaveBeenCalledWith({
        where: { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' },
      });
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return empty data when no boms found', async () => {
      // Arrange
      mockBomRepo.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10 });
    });

    it('should enrich bom items with part info', async () => {
      // Arrange
      const boms = [{ parentItemCode: 'P01', childItemCode: 'C01' }] as BomMaster[];
      mockBomRepo.findAndCount.mockResolvedValue([boms, 1]);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'P01', itemName: 'Parent' } as PartMaster,
        { itemCode: 'C01', itemName: 'Child' } as PartMaster,
      ]);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.data[0].parentPart).toEqual({ itemCode: 'P01', itemName: 'Parent' });
      expect(result.data[0].childPart).toEqual({ itemCode: 'C01', itemName: 'Child' });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should throw ConflictException when parent equals child', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'P01' } as any;

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when bom already exists', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'C01' } as any;
      mockBomRepo.findOne.mockResolvedValue({ parentItemCode: 'P01' } as BomMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should create bom successfully', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'C01', qtyPer: 2 } as any;
      const created = { ...dto, revision: 'A', useYn: 'Y' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(null);
      mockBomRepo.create.mockReturnValue(created);
      mockBomRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return bom', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([]);
      mockBomRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('P01::C01::A', { qtyPer: 5 } as any);

      // Assert
      expect(mockBomRepo.update).toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return id', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([]);
      mockBomRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('P01::C01::A');

      // Assert
      expect(result).toEqual({ id: 'P01::C01::A' });
    });
  });

  // ─── findParents ───
  describe('findParents', () => {
    it('should return parent items with bomCount parsed to int', async () => {
      // Arrange
      const rawRows = [
        { itemCode: 'P01', itemName: 'Parent', bomCount: '3', revisions: 'A,B' },
      ];
      mockBomRepo.query.mockResolvedValue(rawRows);

      // Act
      const result = await target.findParents();

      // Assert
      expect(result[0].bomCount).toBe(3);
      expect(result[0].revisions).toEqual(['A', 'B']);
    });

    it('should handle empty revisions', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([
        { itemCode: 'P01', bomCount: '1', revisions: null },
      ]);

      // Act
      const result = await target.findParents();

      // Assert
      expect(result[0].revisions).toEqual([]);
    });
  });

  // ─── findByParentId ───
  describe('findByParentId', () => {
    it('should return empty array when no children', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([]);

      // Act
      const result = await target.findByParentId('P01');

      // Assert
      expect(result).toEqual([]);
    });

    it('should enrich children with part info', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([
        { childItemCode: 'C01', parentItemCode: 'P01' },
      ]);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'C01', itemName: 'Child1' } as PartMaster,
      ]);

      // Act
      const result = await target.findByParentId('P01');

      // Assert
      expect(result[0].childPart).toEqual({ itemCode: 'C01', itemName: 'Child1' });
    });
  });
});
