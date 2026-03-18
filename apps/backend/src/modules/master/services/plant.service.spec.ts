/**
 * @file src/modules/master/services/plant.service.spec.ts
 * @description PlantService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "PlantService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PlantService } from './plant.service';
import { Plant } from '../../../entities/plant.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PlantService', () => {
  let target: PlantService;
  let mockRepo: DeepMocked<Repository<Plant>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<Plant>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantService,
        { provide: getRepositoryToken(Plant), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PlantService>(PlantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return plant when found with composite key', async () => {
      // Arrange
      const plant = { plantCode: 'PL01', shopCode: '-', lineCode: '-', cellCode: '-' } as Plant;
      mockRepo.findOne.mockResolvedValue(plant);

      // Act
      const result = await target.findById('PL01');

      // Assert
      expect(result).toEqual(plant);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { plantCode: 'PL01', shopCode: '-', lineCode: '-', cellCode: '-' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('PL99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findHierarchy ───
  describe('findHierarchy', () => {
    it('should return all plants when no plantCode given', async () => {
      // Arrange
      const plants = [{ plantCode: 'PL01' }] as Plant[];
      mockRepo.find.mockResolvedValue(plants);

      // Act
      const result = await target.findHierarchy();

      // Assert
      expect(result).toEqual(plants);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { sortOrder: 'asc' },
      });
    });

    it('should filter by plantCode when given', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);

      // Act
      await target.findHierarchy('PL01');

      // Assert
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { plantCode: 'PL01' },
        order: { sortOrder: 'asc' },
      });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new plant', async () => {
      // Arrange
      const dto = { plantCode: 'PL01', plantName: 'Plant1' } as any;
      const created = { ...dto, shopCode: '-', lineCode: '-', cellCode: '-', useYn: 'Y' } as Plant;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when plant exists', async () => {
      // Arrange
      const dto = { plantCode: 'PL01', plantName: 'Plant1' } as any;
      mockRepo.findOne.mockResolvedValue({ plantCode: 'PL01' } as Plant);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return plant', async () => {
      // Arrange
      const existing = { plantCode: 'PL01', shopCode: '-', lineCode: '-', cellCode: '-' } as Plant;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('PL01', { plantName: 'Updated' } as any);

      // Assert
      expect(result).toEqual(existing);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return composite key', async () => {
      // Arrange
      const existing = { plantCode: 'PL01', shopCode: '-', lineCode: '-', cellCode: '-' } as Plant;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('PL01');

      // Assert
      expect(result).toEqual({ plantCode: 'PL01', shopCode: '-', lineCode: '-', cellCode: '-' });
    });
  });

  // ─── findByType ───
  describe('findByType', () => {
    it('should return active plants of given type', async () => {
      // Arrange
      const plants = [{ plantCode: 'PL01', plantType: 'FACTORY' }] as Plant[];
      mockRepo.find.mockResolvedValue(plants);

      // Act
      const result = await target.findByType('FACTORY');

      // Assert
      expect(result).toEqual(plants);
    });
  });
});
