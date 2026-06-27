/**
 * @file src/modules/material/services/po-status.service.spec.ts
 * @description PoStatusService 단위 테스트 - PO 현황 조회 + 입고율 계산
 *
 * 초보자 가이드:
 * - PO + PO품목 + ItemMaster 조인하여 입고율(receiveRate) 계산
 * - 실행: `npx jest --testPathPattern="po-status.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoStatusService } from './po-status.service';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('PoStatusService', () => {
  let target: PoStatusService;
  let mockPoRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPoItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;

  beforeEach(async () => {
    mockPoRepo = createMock<Repository<PurchaseOrder>>();
    mockPoItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoStatusService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPoRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPoItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PoStatusService>(PoStatusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('PO 현황 목록을 입고율과 함께 반환한다', async () => {
      const po = { poNo: 'PO-001', status: 'PARTIAL', orderDate: new Date() } as PurchaseOrder;
      const poItem = { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 50 } as PurchaseOrderItem;
      const part = { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', spec: 'S1' } as ItemMaster;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockItemMasterRepo.find.mockResolvedValue([part]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].receiveRate).toBe(50);
      expect(result.data[0].totalOrderQty).toBe(100);
      expect(result.data[0].totalReceivedQty).toBe(50);
    });

    it('빈 목록을 반환한다', async () => {
      mockPoRepo.find.mockResolvedValue([]);
      mockPoRepo.count.mockResolvedValue(0);
      mockPoItemRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
    });

    it('입고율이 0%인 경우를 처리한다', async () => {
      const po = { poNo: 'PO-002', status: 'CONFIRMED' } as PurchaseOrder;
      const poItem = { poNo: 'PO-002', seq: 1, itemCode: 'ITEM-002', orderQty: 200, receivedQty: 0 } as PurchaseOrderItem;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0].receiveRate).toBe(0);
    });

    it('품목 마스터가 누락되어도 PO 현황 품목 원본 itemCode는 유지한다', async () => {
      const po = { poNo: 'PO-003', status: 'CONFIRMED' } as PurchaseOrder;
      const poItem = {
        poNo: 'PO-003',
        seq: 1,
        itemCode: 'ITEM-MISSING',
        orderQty: 200,
        receivedQty: 0,
      } as PurchaseOrderItem;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0].items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          spec: null,
          unit: null,
          receiveRate: 0,
        }),
      );
    });

    it('PO 현황 품목과 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const po = { poNo: 'PO-004', status: 'CONFIRMED', company: 'C1', plant: 'P1' } as PurchaseOrder;
      const poItem = {
        poNo: 'PO-004',
        seq: 1,
        itemCode: 'ITEM-001',
        orderQty: 200,
        receivedQty: 0,
        company: 'C1',
        plant: 'P1',
      } as PurchaseOrderItem;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockPoItemRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });
});
