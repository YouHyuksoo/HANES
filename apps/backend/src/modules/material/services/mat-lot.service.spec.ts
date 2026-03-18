/**
 * @file src/modules/material/services/mat-lot.service.spec.ts
 * @description MatLotService 단위 테스트 - 자재LOT CRUD 및 품목 정보 평면화
 *
 * 초보자 가이드:
 * - MatLot PK는 matUid (자재 고유 식별자)
 * - PartMaster 조인하여 itemName, unit 등 평면화
 * - 실행: `npx jest --testPathPattern="mat-lot.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MatLotService } from './mat-lot.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('MatLotService', () => {
  let target: MatLotService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;

  const createMatLot = (overrides: Partial<MatLot> = {}): MatLot =>
    ({
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 100,
      recvDate: new Date('2026-01-01'),
      expireDate: new Date('2027-01-01'),
      origin: 'KR',
      vendor: 'VENDOR-A',
      invoiceNo: 'INV-001',
      poNo: 'PO-001',
      iqcStatus: 'PASS',
      status: 'NORMAL',
      company: 'HANES',
      plant: 'P01',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as MatLot;

  const createPartMaster = (overrides: Partial<PartMaster> = {}): PartMaster =>
    ({
      itemCode: 'ITEM-001',
      itemName: '커넥터A',
      unit: 'EA',
      ...overrides,
    }) as PartMaster;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatLotService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<MatLotService>(MatLotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('페이지네이션과 함께 LOT 목록을 반환한다', async () => {
      const lot = createMatLot();
      const part = createPartMaster();
      mockMatLotRepo.find.mockResolvedValue([lot]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockPartMasterRepo.find.mockResolvedValue([part]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].itemName).toBe('커넥터A');
    });

    it('빈 목록을 반환한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([]);
      mockMatLotRepo.count.mockResolvedValue(0);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({});

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('필터 조건이 적용된다', async () => {
      mockMatLotRepo.find.mockResolvedValue([]);
      mockMatLotRepo.count.mockResolvedValue(0);
      mockPartMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ itemCode: 'ITEM-001', iqcStatus: 'PASS' }, 'HANES', 'P01');

      expect(mockMatLotRepo.find).toHaveBeenCalled();
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('LOT을 matUid로 찾아 반환한다', async () => {
      const lot = createMatLot();
      const part = createPartMaster();
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockPartMasterRepo.findOne.mockResolvedValue(part);

      const result = await target.findById('MAT-001');

      expect(result.matUid).toBe('MAT-001');
      expect(result.itemName).toBe('커넥터A');
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByMatUid ───
  describe('findByMatUid', () => {
    it('LOT을 matUid로 찾아 반환한다', async () => {
      const lot = createMatLot();
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockPartMasterRepo.findOne.mockResolvedValue(createPartMaster());

      const result = await target.findByMatUid('MAT-001');

      expect(result.matUid).toBe('MAT-001');
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.findByMatUid('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('새 LOT을 생성한다', async () => {
      const lot = createMatLot();
      const part = createPartMaster();
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.create.mockReturnValue(lot);
      mockMatLotRepo.save.mockResolvedValue(lot);
      mockPartMasterRepo.findOne.mockResolvedValue(part);

      const result = await target.create({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        initQty: 100,
      } as any);

      expect(result.matUid).toBe('MAT-001');
      expect(mockMatLotRepo.save).toHaveBeenCalled();
    });

    it('이미 존재하는 matUid이면 ConflictException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot());

      await expect(
        target.create({ matUid: 'MAT-001', itemCode: 'ITEM-001', initQty: 100 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('LOT 정보를 업데이트한다', async () => {
      const lot = createMatLot();
      const part = createPartMaster();
      // findById 호출 시
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockMatLotRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockPartMasterRepo.findOne.mockResolvedValue(part);

      const result = await target.update('MAT-001', { iqcStatus: 'FAIL' } as any);

      expect(mockMatLotRepo.update).toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('LOT을 삭제한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot());
      mockMatLotRepo.delete.mockResolvedValue({ affected: 1 } as any);
      mockPartMasterRepo.findOne.mockResolvedValue(createPartMaster());

      const result = await target.delete('MAT-001');

      expect(result.matUid).toBe('MAT-001');
      expect(mockMatLotRepo.delete).toHaveBeenCalledWith('MAT-001');
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.delete('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
