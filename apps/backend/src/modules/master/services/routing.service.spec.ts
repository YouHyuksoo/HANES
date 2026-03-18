/**
 * @file src/modules/master/services/routing.service.spec.ts
 * @description RoutingService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "RoutingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoutingService } from './routing.service';
import { ProcessMap } from '../../../entities/process-map.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('RoutingService', () => {
  let target: RoutingService;
  let mockRoutingRepo: DeepMocked<Repository<ProcessMap>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockRoutingRepo = createMock<Repository<ProcessMap>>();
    mockPartRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: getRepositoryToken(ProcessMap), useValue: mockRoutingRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<RoutingService>(RoutingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByKey ───
  describe('findByKey', () => {
    it('should return routing with itemName when found', async () => {
      // Arrange
      const routing = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01' } as ProcessMap;
      mockRoutingRepo.findOne.mockResolvedValue(routing);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', itemName: 'Part1' } as PartMaster);

      // Act
      const result = await target.findByKey('ITEM01', 10);

      // Assert
      expect(result.itemName).toBe('Part1');
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRoutingRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByKey('ITEM01', 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new routing', async () => {
      // Arrange
      const dto = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01' } as any;
      const created = { ...dto, useYn: 'Y' } as ProcessMap;
      mockRoutingRepo.findOne.mockResolvedValue(null);
      mockRoutingRepo.create.mockReturnValue(created);
      mockRoutingRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when routing exists', async () => {
      // Arrange
      const dto = { itemCode: 'ITEM01', seq: 10 } as any;
      mockRoutingRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01' } as ProcessMap);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update routing excluding PK fields', async () => {
      // Arrange
      const existing = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01' } as ProcessMap;
      mockRoutingRepo.findOne.mockResolvedValue(existing);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', itemName: 'Part1' } as PartMaster);
      mockRoutingRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('ITEM01', 10, { processName: 'Updated' } as any);

      // Assert
      expect(mockRoutingRepo.update).toHaveBeenCalledWith(
        { itemCode: 'ITEM01', seq: 10 },
        expect.objectContaining({ processName: 'Updated' }),
      );
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return composite key', async () => {
      // Arrange
      const existing = { itemCode: 'ITEM01', seq: 10 } as ProcessMap;
      mockRoutingRepo.findOne.mockResolvedValue(existing);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockRoutingRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('ITEM01', 10);

      // Assert
      expect(result).toEqual({ itemCode: 'ITEM01', seq: 10 });
    });
  });
});
