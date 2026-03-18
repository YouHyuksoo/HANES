/**
 * @file src/modules/material/services/po-status.service.spec.ts
 * @description PoStatusService 단위 테스트 - PO 현황 조회 + 입고율 계산
 *
 * 초보자 가이드:
 * - PO + PO품목 + PartMaster 조인하여 입고율(receiveRate) 계산
 * - 실행: `npx jest --testPathPattern="po-status.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoStatusService } from './po-status.service';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PoStatusService', () => {
  let target: PoStatusService;
  let mockPoRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPoItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockPoRepo = createMock<Repository<PurchaseOrder>>();
    mockPoItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoStatusService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPoRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPoItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
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
      const part = { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', spec: 'S1' } as PartMaster;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockPartMasterRepo.find.mockResolvedValue([part]);

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

      const result = await target.findAll({});

      expect(result.data).toHaveLength(0);
    });

    it('입고율이 0%인 경우를 처리한다', async () => {
      const po = { poNo: 'PO-002', status: 'CONFIRMED' } as PurchaseOrder;
      const poItem = { poNo: 'PO-002', seq: 1, itemCode: 'ITEM-002', orderQty: 200, receivedQty: 0 } as PurchaseOrderItem;

      mockPoRepo.find.mockResolvedValue([po]);
      mockPoRepo.count.mockResolvedValue(1);
      mockPoItemRepo.find.mockResolvedValue([poItem]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0].receiveRate).toBe(0);
    });
  });
});
