/**
 * @file equip-master.service.spec.ts
 * @description EquipMasterService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipMasterService } from './equip-master.service';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ProdLineMaster } from '../../../entities/prod-line-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipMasterService', () => {
  let target: EquipMasterService;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockLineRepo: DeepMocked<Repository<ProdLineMaster>>;
  let mockProcessRepo: DeepMocked<Repository<ProcessMaster>>;

  beforeEach(async () => {
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockLineRepo = createMock<Repository<ProdLineMaster>>();
    mockProcessRepo = createMock<Repository<ProcessMaster>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipMasterService,
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: getRepositoryToken(ProdLineMaster), useValue: mockLineRepo },
        { provide: getRepositoryToken(ProcessMaster), useValue: mockProcessRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<EquipMasterService>(EquipMasterService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('생산투입 화면 작업지시 배정 URL에서 사용할 id로 equipCode를 함께 반환한다', async () => {
      const rows = [
        { equipCode: 'EQ-001', equipName: 'Cutting 1', processCode: 'CUT' },
      ] as any;
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(),
        clone: jest.fn(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
        getCount: jest.fn().mockResolvedValue(1),
      };
      qb.clone.mockReturnValue(qb);
      mockEquipRepo.createQueryBuilder.mockReturnValue(qb);
      mockProcessRepo.find.mockResolvedValue([{ processCode: 'CUT', processName: 'Cutting' }] as any);

      const result = await target.findAll({ page: 1, limit: 20 } as any);

      expect(result.data[0]).toEqual(expect.objectContaining({
        id: 'EQ-001',
        equipCode: 'EQ-001',
        processName: 'Cutting',
      }));
    });
  });

  describe('findById', () => {
    it('should return equip', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001' } as any);
      expect((await target.findById('EQ-001')).equipCode).toBe('EQ-001');
    });
    it('should find equip by id within tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);

      await target.findById('EQ-001', 'CO', 'P01');

      expect(mockEquipRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
      });
    });
    it('should throw NotFoundException', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create equip', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      const saved = { equipCode: 'EQ-001' } as any;
      mockEquipRepo.create.mockReturnValue(saved);
      mockEquipRepo.save.mockResolvedValue(saved);
      const r = await target.create({ equipCode: 'EQ-001', equipName: 'Test' } as any);
      expect(r.equipCode).toBe('EQ-001');
    });
    it('should check duplicate and create equip within tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      const saved = { equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any;
      mockEquipRepo.create.mockReturnValue(saved);
      mockEquipRepo.save.mockResolvedValue(saved);

      await target.create({ equipCode: 'EQ-001', equipName: 'Test' } as any, 'CO', 'P01');

      expect(mockEquipRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
      });
      expect(mockEquipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' }),
      );
    });
    it('should throw ConflictException', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001' } as any);
      await expect(target.create({ equipCode: 'EQ-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete equip', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001' } as any);
      mockEquipRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('EQ-001');
      expect(r.deleted).toBe(true);
    });
    it('should delete equip within tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      mockEquipRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('EQ-001', 'CO', 'P01');

      expect(mockEquipRepo.delete).toHaveBeenCalledWith({
        equipCode: 'EQ-001',
        company: 'CO',
        plant: 'P01',
      });
    });
  });

  describe('assignJobOrder', () => {
    it('should throw when equip status is INTERLOCK', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', status: 'INTERLOCK' } as any);
      await expect(target.assignJobOrder('EQ-001', { orderNo: 'JO-001' } as any)).rejects.toThrow(ConflictException);
    });
    it('should assign job order within tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', status: 'NORMAL', company: 'CO', plant: 'P01' } as any);
      mockEquipRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.assignJobOrder('EQ-001', { orderNo: 'JO-001' } as any, 'CO', 'P01');

      expect(mockEquipRepo.update).toHaveBeenCalledWith(
        { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
        { currentJobOrderId: 'JO-001' },
      );
    });
  });
});
