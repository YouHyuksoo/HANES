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
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ShipHistoryService', () => {
  let target: ShipHistoryService;
  let mockShipmentOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockShipmentOrderItemRepo: DeepMocked<Repository<ShipmentOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockShipmentOrderRepo = createMock<Repository<ShipmentOrder>>();
    mockShipmentOrderItemRepo = createMock<Repository<ShipmentOrderItem>>();
    mockPartRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipHistoryService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockShipmentOrderRepo },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: mockShipmentOrderItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ShipHistoryService>(ShipHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return paginated ship history with items', async () => {
      const order = { shipOrderNo: 'SO-001' } as ShipmentOrder;
      mockShipmentOrderRepo.find.mockResolvedValue([order]);
      mockShipmentOrderRepo.count.mockResolvedValue(1);
      mockShipmentOrderItemRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should return empty data when no orders', async () => {
      mockShipmentOrderRepo.find.mockResolvedValue([]);
      mockShipmentOrderRepo.count.mockResolvedValue(0);

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
