/**
 * @file src/modules/shipping/services/ship-history.service.spec.ts
 * @description ShipHistoryService 단위 테스트 - 출하이력 조회 전용
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ShipHistoryService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipHistoryService } from './ship-history.service';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ShipHistoryService', () => {
  let target: ShipHistoryService;
  let mockShipmentOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockShipmentOrderItemRepo: DeepMocked<Repository<ShipmentOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;

  beforeEach(async () => {
    mockShipmentOrderRepo = createMock<Repository<ShipmentOrder>>();
    mockShipmentOrderItemRepo = createMock<Repository<ShipmentOrderItem>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipHistoryService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockShipmentOrderRepo },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: mockShipmentOrderItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ShipHistoryService>(ShipHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    // findAll 은 createQueryBuilder를 두 번(getMany / getCount) 생성한다.
    const mockOrderListQb = (orders: any[], total: number) => {
      mockShipmentOrderRepo.createQueryBuilder
        .mockReturnValueOnce({
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue(orders),
        } as any)
        .mockReturnValueOnce({
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(total),
        } as any);
    };

    it('should return paginated ship history with items', async () => {
      const order = { shipOrderNo: 'SO-001' } as ShipmentOrder;
      mockOrderListQb([order], 1);
      mockShipmentOrderItemRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should enrich shipment items with part names within tenant only', async () => {
      const order = { shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' } as ShipmentOrder;
      mockOrderListQb([order], 1);
      mockShipmentOrderItemRepo.find.mockResolvedValue([
        { shipOrderNo: 'SO-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as ShipmentOrderItem,
      ]);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Part A' } as ItemMaster]);

      await target.findAll({ page: 1, limit: 10 } as any, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });

    it('should return empty data when no orders', async () => {
      mockOrderListQb([], 0);

      const result = await target.findAll({} as any);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return total and byStatus', async () => {
      mockShipmentOrderRepo.count.mockResolvedValue(5);
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ status: 'SHIPPED', count: '3' }]),
      };
      mockShipmentOrderRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.getSummary();

      expect(result.total).toBe(5);
      expect(result.byStatus).toEqual([{ status: 'SHIPPED', count: 3 }]);
    });
  });
});
