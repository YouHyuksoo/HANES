/**
 * @file src/modules/material/services/mat-lot.service.spec.ts
 * @description MatLotService 단위 테스트 - 자재LOT CRUD 및 품목 정보 평면화
 *
 * 초보자 가이드:
 * - MatLot PK는 matUid (자재 고유 식별자)
 * - ItemMaster 조인하여 itemName, unit 등 평면화
 * - 실행: `npx jest --testPathPattern="mat-lot.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MatLotService } from './mat-lot.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('MatLotService', () => {
  let target: MatLotService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;

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

  const createItemMaster = (overrides: Partial<ItemMaster> = {}): ItemMaster =>
    ({
      itemCode: 'ITEM-001',
      itemName: '커넥터A',
      unit: 'EA',
      ...overrides,
    }) as ItemMaster;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartnerMasterRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatLotService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
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
      const part = createItemMaster();
      mockMatLotRepo.find.mockResolvedValue([lot]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([part]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].itemName).toBe('커넥터A');
    });

    it('빈 목록을 반환한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([]);
      mockMatLotRepo.count.mockResolvedValue(0);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('필터 조건이 적용된다', async () => {
      mockMatLotRepo.find.mockResolvedValue([]);
      mockMatLotRepo.count.mockResolvedValue(0);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 20, itemCode: 'ITEM-001', iqcStatus: 'PASS' }, 'HANES', 'P01');

      expect(mockMatLotRepo.find).toHaveBeenCalled();
    });

    it('품목 마스터가 누락되어도 LOT 원본 itemCode는 유지한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([createMatLot({ itemCode: 'ITEM-MISSING' })]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('LOT 목록 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([createMatLot({ company: 'C1', plant: 'P1' })]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('LOT을 matUid로 찾아 반환한다', async () => {
      const lot = createMatLot();
      const part = createItemMaster();
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(part);

      const result = await target.findById('MAT-001');

      expect(result.matUid).toBe('MAT-001');
      expect(result.itemName).toBe('커넥터A');
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });

    it('품목 마스터가 누락되어도 LOT 상세의 원본 itemCode는 유지한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot({ itemCode: 'ITEM-MISSING' }));
      mockItemMasterRepo.findOne.mockResolvedValue(null);

      const result = await target.findById('MAT-001');

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('LOT 상세 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot({ company: 'C1', plant: 'P1' }));
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster({ company: 'C1', plant: 'P1' } as Partial<ItemMaster>));

      await target.findById('MAT-001', 'C1', 'P1');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── findByMatUid ───
  describe('findByMatUid', () => {
    it('LOT을 matUid로 찾아 반환한다', async () => {
      const lot = createMatLot();
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster());

      const result = await target.findByMatUid('MAT-001');

      expect(result.matUid).toBe('MAT-001');
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.findByMatUid('NONE')).rejects.toThrow(NotFoundException);
    });

    it('matUid 별칭 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot({ company: 'C1', plant: 'P1' }));
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster({ company: 'C1', plant: 'P1' } as Partial<ItemMaster>));

      await target.findByMatUid('MAT-001', 'C1', 'P1');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('새 LOT을 생성한다', async () => {
      const lot = createMatLot();
      const part = createItemMaster();
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.create.mockReturnValue(lot);
      mockMatLotRepo.save.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(part);

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

    it('품목 마스터가 누락되어도 생성된 LOT의 원본 itemCode는 유지한다', async () => {
      const lot = createMatLot({ itemCode: 'ITEM-MISSING' });
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.create.mockReturnValue(lot);
      mockMatLotRepo.save.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(null);

      const result = await target.create({
        matUid: 'MAT-001',
        itemCode: 'ITEM-MISSING',
        initQty: 100,
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('LOT 생성도 중복/품목 보강 조회를 요청 테넌트 범위로 제한하고 테넌트를 저장한다', async () => {
      const lot = createMatLot({ company: 'C1', plant: 'P1' });
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.create.mockReturnValue(lot);
      mockMatLotRepo.save.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster({ company: 'C1', plant: 'P1' } as Partial<ItemMaster>));

      await target.create({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        initQty: 100,
      } as any, 'C1', 'P1');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockMatLotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ matUid: 'MAT-001', company: 'C1', plant: 'P1' }),
      );
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── update ───
  describe('update', () => {
    it('LOT 정보를 업데이트한다', async () => {
      const lot = createMatLot();
      const part = createItemMaster();
      // findById 호출 시
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockMatLotRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockItemMasterRepo.findOne.mockResolvedValue(part);

      const result = await target.update('MAT-001', { iqcStatus: 'FAIL' } as any);

      expect(mockMatLotRepo.update).toHaveBeenCalled();
    });

    it('LOT 상태 직접 변경은 차단한다', async () => {
      const lot = createMatLot();
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster());

      await expect(target.update('MAT-001', { status: 'HOLD' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('LOT 수정도 요청 테넌트 범위로 제한한다', async () => {
      const lot = createMatLot({ company: 'C1', plant: 'P1' });
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockMatLotRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster({ company: 'C1', plant: 'P1' } as Partial<ItemMaster>));

      await target.update('MAT-001', { iqcStatus: 'FAIL' } as any, 'C1', 'P1');

      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        { iqcStatus: 'FAIL' },
      );
      expect(mockMatLotRepo.findOne).toHaveBeenLastCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('LOT을 삭제한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot());
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster());
      mockMatStockRepo.find.mockResolvedValue([]);
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockMatLotRepo.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await target.delete('MAT-001');

      expect(result.matUid).toBe('MAT-001');
      expect(mockMatLotRepo.delete).toHaveBeenCalledWith({ matUid: 'MAT-001' });
    });

    it('재고가 남아 있으면 LOT 삭제를 차단한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot());
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster());
      mockMatStockRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', qty: 1, availableQty: 1 } as MatStock,
      ]);

      await expect(target.delete('MAT-001')).rejects.toThrow(BadRequestException);
      expect(mockMatLotRepo.delete).not.toHaveBeenCalled();
    });

    it('자재출고 이력이 남아 있으면 LOT 삭제를 차단한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot());
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster());
      mockMatStockRepo.find.mockResolvedValue([]);
      mockMatIssueRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', issueNo: 'ISS-001', status: 'DONE' } as MatIssue,
      ]);

      await expect(target.delete('MAT-001')).rejects.toThrow(BadRequestException);
      expect(mockMatLotRepo.delete).not.toHaveBeenCalled();
    });

    it('LOT 삭제 전 재고/출고 이력 확인도 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(createMatLot({ company: 'C1', plant: 'P1' }));
      mockItemMasterRepo.findOne.mockResolvedValue(createItemMaster({ company: 'C1', plant: 'P1' } as Partial<ItemMaster>));
      mockMatStockRepo.find.mockResolvedValue([]);
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockMatLotRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('MAT-001', 'C1', 'P1');

      expect(mockMatStockRepo.find).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockMatIssueRepo.find).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', status: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockMatLotRepo.delete).toHaveBeenCalledWith({ matUid: 'MAT-001', company: 'C1', plant: 'P1' });
    });

    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(target.delete('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
