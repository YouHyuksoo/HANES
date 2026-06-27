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
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('RoutingService', () => {
  let target: RoutingService;
  let mockRoutingRepo: DeepMocked<Repository<ProcessMap>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;

  beforeEach(async () => {
    mockRoutingRepo = createMock<Repository<ProcessMap>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: getRepositoryToken(ProcessMap), useValue: mockRoutingRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
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
    // findByKey 는 ItemMaster를 leftJoin한 쿼리빌더 + getRawAndEntities 로 itemName을 가져온다.
    const findByKeyQb = (
      entities: any[],
      raw: any[],
    ) => {
      const qb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities, raw }),
      };
      return qb;
    };

    it('should return routing with itemName when found', async () => {
      // Arrange
      const routing = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01' } as ProcessMap;
      mockRoutingRepo.createQueryBuilder.mockReturnValue(
        findByKeyQb([routing], [{ part_itemName: 'Part1' }]),
      );

      // Act
      const result = await target.findByKey('ITEM01', 10);

      // Assert
      expect(result.itemName).toBe('Part1');
    });

    it('should find routing and part name within tenant only', async () => {
      const routing = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01', company: 'C1', plant: 'P1' } as ProcessMap;
      const qb = findByKeyQb([routing], [{ part_itemName: 'Part1' }]);
      mockRoutingRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findByKey('ITEM01', 10, 'C1', 'P1');

      // 라우팅 키 + 테넌트 조건이 쿼리빌더에 적용되었는지 확인
      expect(qb.where).toHaveBeenCalledWith('routing.itemCode = :itemCode', { itemCode: 'ITEM01' });
      expect(qb.andWhere).toHaveBeenCalledWith('routing.seq = :seq', { seq: 10 });
      expect(qb.andWhere).toHaveBeenCalledWith('routing.company = :company', { company: 'C1' });
      expect(qb.andWhere).toHaveBeenCalledWith('routing.plant = :plant', { plant: 'P1' });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRoutingRepo.createQueryBuilder.mockReturnValue(findByKeyQb([], []));

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

    it('should create routing within tenant and check duplicates within tenant only', async () => {
      const dto = { itemCode: 'ITEM01', seq: 10, processCode: 'PROC01' } as any;
      const created = { ...dto, useYn: 'Y', company: 'C1', plant: 'P1' } as ProcessMap;
      mockRoutingRepo.findOne.mockResolvedValue(null);
      mockRoutingRepo.create.mockReturnValue(created);
      mockRoutingRepo.save.mockResolvedValue(created);

      await target.create(dto, 'C1', 'P1');

      expect(mockRoutingRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM01', seq: 10, company: 'C1', plant: 'P1' },
      });
      expect(mockRoutingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ itemCode: 'ITEM01', seq: 10, company: 'C1', plant: 'P1' }),
      );
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
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', itemName: 'Part1' } as ItemMaster);
      mockRoutingRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('ITEM01', 10, { processName: 'Updated' } as any, 'C1', 'P1');

      // Assert
      expect(mockRoutingRepo.update).toHaveBeenCalledWith(
        { itemCode: 'ITEM01', seq: 10, company: 'C1', plant: 'P1' },
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
      const result = await target.delete('ITEM01', 10, 'C1', 'P1');

      // Assert
      expect(result).toEqual({ itemCode: 'ITEM01', seq: 10 });
      expect(mockRoutingRepo.delete).toHaveBeenCalledWith({ itemCode: 'ITEM01', seq: 10, company: 'C1', plant: 'P1' });
    });
  });
});
