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
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PurchaseOrderService', () => {
  let target: PurchaseOrderService;
  let mockPoRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPoItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const createPo = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder =>
    ({
      poNo: 'PO-001',
      partnerId: 'V-001',
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
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PurchaseOrderService>(PurchaseOrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('PO를 poNo로 찾아 반환한다', async () => {
      mockPoRepo.findOne.mockResolvedValue(createPo());
      mockPoItemRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findById('PO-001');

      expect(result.poNo).toBe('PO-001');
    });

    it('존재하지 않는 PO이면 NotFoundException', async () => {
      mockPoRepo.findOne.mockResolvedValue(null);

      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
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
      mockQueryRunner.manager.create.mockReturnValue(po);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(po) // PO 저장
        .mockResolvedValueOnce([]); // 품목 저장
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.create({
        poNo: 'PO-001',
        partnerId: 'V-001',
        partnerName: 'VENDOR-A',
        items: [{ itemCode: 'ITEM-001', orderQty: 100 }],
      } as any);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // ─── confirm ───
  describe('confirm', () => {
    it('DRAFT 상태 PO를 확정한다', async () => {
      const po = createPo({ status: 'DRAFT' });
      mockPoRepo.findOne.mockResolvedValue(po);
      mockPoRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockPoItemRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.confirm('PO-001');

      expect(mockPoRepo.update).toHaveBeenCalledWith('PO-001', { status: 'CONFIRMED' });
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
      mockPartMasterRepo.find.mockResolvedValue([]);

      await target.close('PO-001');

      expect(mockPoRepo.update).toHaveBeenCalledWith('PO-001', { status: 'CLOSED' });
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
      mockPartMasterRepo.find.mockResolvedValue([]);
      mockPoRepo.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await target.delete('PO-001');

      expect(result.poNo).toBe('PO-001');
    });
  });
});
