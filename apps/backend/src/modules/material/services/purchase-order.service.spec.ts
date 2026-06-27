/**
 * @file src/modules/material/services/purchase-order.service.spec.ts
 * @description PurchaseOrderService 단위 테스트 - PO CRUD, 확정, 마감
 *
 * 초보자 가이드:
 * - PO 생성은 트랜잭션(QueryRunner) 사용
 * - 상태 흐름: DRAFT -> CONFIRMED -> PARTIAL/RECEIVED -> CLOSED
 * - 실행: `npx jest --testPathPattern="purchase-order.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

describe('PurchaseOrderService', () => {
  let target: PurchaseOrderService;
  let mockPoRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPoItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const createPo = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder =>
    ({
      poNo: 'PO-001',
      partnerCode: 'V-001',
      partnerName: 'VENDOR-A',
      status: 'DRAFT',
      orderDate: new Date(),
      totalAmount: 10000,
      createdAt: new Date(),
      ...overrides,
    }) as PurchaseOrder;

  beforeEach(async () => {
    mockPoRepo = createMock<Repository<PurchaseOrder>>();
    mockPoItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerRepo = createMock<Repository<PartnerMaster>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockNumbering = createMock<NumberingService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPoRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPoItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PurchaseOrderService>(PurchaseOrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 PO 품목 원본 itemCode는 유지한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createPo()]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockPoRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockPoItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 100 } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0].items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          spec: null,
          unit: null,
        }),
      );
    });

    it('입하 모달 poId로 사용할 id에 poNo를 함께 반환한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createPo({ poNo: 'PO-001' })]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockPoRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'PO-001', poNo: 'PO-001' }));
    });

    it('PO 목록 품목과 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createPo({ company: 'C1', plant: 'P1' })]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockPoRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockPoItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 } as any, 'C1', 'P1');

      expect(mockPoItemRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('PO를 poNo로 찾아 반환한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findById('PO-001');

      expect(result.poNo).toBe('PO-001');
    });

    it('존재하지 않는 PO이면 NotFoundException', async () => {
      mockPoRepo.findOne.mockResolvedValue(null);

      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });

    it('품목 마스터가 누락되어도 PO 상세 품목 원본 itemCode는 유지한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());
      mockPoItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 100 } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findById('PO-001');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          spec: null,
          unit: null,
        }),
      );
    });

    it('PO 상세 품목과 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ company: 'C1', plant: 'P1' }));
      mockPoItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findById('PO-001', 'C1', 'P1');

      expect(mockPoRepo.findOne).toHaveBeenCalledWith({
        where: { poNo: 'PO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockPoItemRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('이미 존재하는 PO 번호이면 ConflictException', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());

      await expect(
        target.create({ poNo: 'PO-001', items: [] } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('새 PO를 생성한다', async () => {
      const po = createPo();
      mockPoRepo.findOne.mockResolvedValue(null);
      (mockQueryRunner.manager.create as jest.Mock).mockReturnValue(po);
      (mockQueryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce(po) // PO 저장
        .mockResolvedValueOnce([]); // 품목 저장
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.create({
        poNo: 'PO-001',
        partnerCode: 'V-001',
        partnerName: 'VENDOR-A',
        items: [{ itemCode: 'ITEM-001', orderQty: 100 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('품목 마스터가 누락되어도 생성 응답의 PO 품목 원본 itemCode는 유지한다', async () => {
      const po = createPo();
      const savedItems = [
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 100 } as PurchaseOrderItem,
      ];
      mockPoRepo.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation((_entity, value) => value as any);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(po)
        .mockResolvedValueOnce(savedItems);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.create({
        poNo: 'PO-001',
        partnerCode: 'V-001',
        partnerName: 'VENDOR-A',
        items: [{ itemCode: 'ITEM-MISSING', orderQty: 100 }],
      } as any);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          spec: null,
          unit: null,
        }),
      );
    });

    it('PO 생성 응답 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const po = createPo({ company: 'C1', plant: 'P1' });
      const savedItems = [
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ];
      mockPoRepo.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation((_entity, value) => value as any);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(po)
        .mockResolvedValueOnce(savedItems);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.create({
        poNo: 'PO-001',
        partnerCode: 'V-001',
        partnerName: 'VENDOR-A',
        items: [{ itemCode: 'ITEM-001', orderQty: 100 }],
      } as any, 'C1', 'P1');

      expect(mockPoRepo.findOne).toHaveBeenCalledWith({
        where: { poNo: 'PO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── update ───
  describe('update', () => {
    it('품목 변경이 있는 PO 수정은 TransactionService로 PO와 품목을 함께 저장한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.create.mockImplementation((_entity, value) => value as any);
      mockQueryRunner.manager.save.mockResolvedValue([] as any);

      await target.update('PO-001', {
        orderDate: '2026-05-23',
        items: [{ itemCode: 'ITEM-001', orderQty: 2, unitPrice: 1000 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(PurchaseOrderItem, { poNo: 'PO-001' });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        PurchaseOrder,
        { poNo: 'PO-001' },
        expect.objectContaining({ totalAmount: 2000 }),
      );
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('PO 수정은 헤더와 품목 교체를 요청 테넌트 범위로 제한한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ company: 'C1', plant: 'P1' }));
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.create.mockImplementation((_entity, value) => value as any);
      mockQueryRunner.manager.save.mockResolvedValue([] as any);

      await target.update('PO-001', {
        items: [{ itemCode: 'ITEM-001', orderQty: 2, unitPrice: 1000 }],
      } as any, 'C1', 'P1');

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(PurchaseOrderItem, {
        poNo: 'PO-001',
        company: 'C1',
        plant: 'P1',
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        PurchaseOrder,
        { poNo: 'PO-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ totalAmount: 2000 }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(PurchaseOrderItem, expect.objectContaining({
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  // ─── confirm ───
  describe('confirm', () => {
    it('DRAFT 상태 PO를 확정한다', async () => {
      const po = createPo({ status: 'DRAFT' });
      mockPoRepo.findOne.mockResolvedValue(po);
      mockPoRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.confirm('PO-001', 'C1', 'P1');

      expect(mockPoRepo.findOne).toHaveBeenCalledWith({
        where: { poNo: 'PO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockPoRepo.update).toHaveBeenCalledWith(
        { poNo: 'PO-001', company: 'C1', plant: 'P1' },
        { status: 'CONFIRMED' },
      );
    });

    it('DRAFT가 아닌 상태이면 BadRequestException', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ status: 'CONFIRMED' }));

      await expect(target.confirm('PO-001')).rejects.toThrow(BadRequestException);
    });

    it('존재하지 않는 PO이면 NotFoundException', async () => {
      mockPoRepo.findOne.mockResolvedValue(null);

      await expect(target.confirm('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── close ───
  describe('close', () => {
    it('RECEIVED 상태 PO를 마감한다', async () => {
      const po = createPo({ status: 'RECEIVED' });
      mockPoRepo.findOne.mockResolvedValue(po);
      mockPoRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.close('PO-001', 'C1', 'P1');

      expect(mockPoRepo.findOne).toHaveBeenCalledWith({
        where: { poNo: 'PO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockPoRepo.update).toHaveBeenCalledWith(
        { poNo: 'PO-001', company: 'C1', plant: 'P1' },
        { status: 'CLOSED' },
      );
    });

    it('마감 불가 상태이면 BadRequestException', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ status: 'DRAFT' }));

      await expect(target.close('PO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('PO를 삭제한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([]);
      mockPoRepo.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await target.delete('PO-001', 'C1', 'P1');

      expect(result.poNo).toBe('PO-001');
      expect(mockMatArrivalRepo.find).toHaveBeenCalledWith({
        where: { poNo: 'PO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockPoRepo.delete).toHaveBeenCalledWith({ poNo: 'PO-001', company: 'C1', plant: 'P1' });
    });

    it('DRAFT가 아니면 PO 삭제를 차단한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ status: 'CONFIRMED' }));
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await expect(target.delete('PO-001')).rejects.toThrow(BadRequestException);
      expect(mockPoRepo.delete).not.toHaveBeenCalled();
    });

    it('입하 이력이 있으면 PO 삭제를 차단한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo({ status: 'DRAFT' }));
      mockPoItemRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([
        { poNo: 'PO-001', arrivalNo: 'ARR-001', seq: 1 } as MatArrival,
      ]);

      await expect(target.delete('PO-001')).rejects.toThrow(BadRequestException);
      expect(mockPoRepo.delete).not.toHaveBeenCalled();
    });
  });
});
