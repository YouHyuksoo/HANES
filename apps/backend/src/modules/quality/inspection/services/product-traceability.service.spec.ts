/**
 * @file src/modules/quality/inspection/services/product-traceability.service.spec.ts
 * @description ProductTraceabilityService.findCandidates 단위 테스트
 *
 * 초보자 가이드:
 * - 설비/작업자 + 기간 조회는 과거엔 take(500)로 자른 뒤 메모리에서 기간을 걸러
 *   최근 500건 밖에 있는 과거 기간 실적이 응답에서 누락될 수 있었다.
 * - 이 테스트는 기간 조건이 DB WHERE 절(QueryBuilder)로 내려가는지만 검증한다
 *   (메모리 filter로 되돌아가는 회귀를 막기 위함).
 * - 실행: `npx jest --testPathPattern="product-traceability.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTraceabilityService } from './product-traceability.service';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { SgLabel } from '../../../../entities/sg-label.entity';
import { ProductGenealogy } from '../../../../entities/product-genealogy.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { MatIssue } from '../../../../entities/mat-issue.entity';
import { MatLot } from '../../../../entities/mat-lot.entity';
import { PurchaseOrder } from '../../../../entities/purchase-order.entity';
import { MatArrival } from '../../../../entities/mat-arrival.entity';
import { IqcLog } from '../../../../entities/iqc-log.entity';
import { MatReceiving } from '../../../../entities/mat-receiving.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { PalletMaster } from '../../../../entities/pallet-master.entity';
import { EquipMaster } from '../../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { PartnerMaster } from '../../../../entities/partner-master.entity';
import { ShipmentOrder } from '../../../../entities/shipment-order.entity';
import { StockTransaction } from '../../../../entities/stock-transaction.entity';
import { EquipInspectLog } from '../../../../entities/equip-inspect-log.entity';
import { ConsumableMountLog } from '../../../../entities/consumable-mount-log.entity';
import { ConsumableMaster } from '../../../../entities/consumable-master.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { RepairOrder } from '../../../../entities/repair-order.entity';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { Warehouse } from '../../../../entities/warehouse.entity';
import { MockLoggerService } from '@test/mock-logger.service';

/** 체이닝 가능한 QueryBuilder mock — where/andWhere 호출을 기록한다 */
function createQbMock(rows: ProdResult[]) {
  const whereCalls: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const qb = {
    whereCalls,
    where: jest.fn((sql: string, params?: Record<string, unknown>) => { whereCalls.push({ sql, params }); return qb; }),
    andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => { whereCalls.push({ sql, params }); return qb; }),
    orderBy: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
}

describe('ProductTraceabilityService', () => {
  let target: ProductTraceabilityService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;

  const entities = [
    FgLabel, SgLabel, ProductGenealogy, ProdResult, JobOrder, InspectResult, TraceLog,
    MatIssue, MatLot, PurchaseOrder, MatArrival, IqcLog, MatReceiving, ItemMaster,
    BoxMaster, PalletMaster, EquipMaster, WorkerMaster, ProcessMaster, PartnerMaster,
    ShipmentOrder, StockTransaction, EquipInspectLog, ConsumableMountLog, ConsumableMaster,
    DefectLog, RepairOrder, ReworkOrder, Warehouse,
  ];

  beforeEach(async () => {
    const providers = entities.map((entity) => ({
      provide: getRepositoryToken(entity),
      useValue: createMock<Repository<unknown>>(),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductTraceabilityService, ...providers],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProductTraceabilityService>(ProductTraceabilityService);
    mockProdResultRepo = module.get(getRepositoryToken(ProdResult));
    mockFgLabelRepo = module.get(getRepositoryToken(FgLabel));
    mockItemMasterRepo = module.get(getRepositoryToken(ItemMaster));

    mockFgLabelRepo.find.mockResolvedValue([]);
    mockItemMasterRepo.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCandidates(equipment)', () => {
    it('설비 + 기간 조회는 기간 조건을 take(500) 이전 DB WHERE 절로 적용한다 (메모리 filter 금지)', async () => {
      const qb = createQbMock([
        { orderNo: 'WO-001', equipCode: 'EQ-1', company: '40', plant: '1000' } as ProdResult,
      ]);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<Repository<ProdResult>['createQueryBuilder']>,
      );

      await target.findCandidates(
        'equipment',
        { equipCode: 'EQ-1', dateFrom: '2026-01-01', dateTo: '2026-01-31' },
        '40',
        '1000',
      );

      // take는 DB where 절 적용 이후에만 잘라야 한다 — where/andWhere가 먼저 호출됐는지 확인
      expect(qb.where).toHaveBeenCalled();
      const whereSql = qb.whereCalls.map((c) => c.sql).join(' | ');
      expect(whereSql).toContain('pr.equipCode = :equipCode');
      // 기간 조건이 메모리 filter가 아니라 DB WHERE(COALESCE startAt/createdAt)로 내려가야 한다
      expect(whereSql).toContain('COALESCE(pr.startAt, pr.createdAt) >= :fromTime');
      expect(whereSql).toContain('COALESCE(pr.startAt, pr.createdAt) <= :toTime');
      expect(qb.take).toHaveBeenCalledWith(500);

      // fromTime/toTime 파라미터가 실제 dateFrom/dateTo에서 파생됐는지 확인
      const fromCall = qb.whereCalls.find((c) => c.sql.includes('>= :fromTime'));
      const toCall = qb.whereCalls.find((c) => c.sql.includes('<= :toTime'));
      expect(fromCall?.params?.fromTime).toEqual(new Date('2026-01-01T00:00:00'));
      expect(toCall?.params?.toTime).toEqual(new Date('2026-01-31T23:59:59'));
    });

    it('기간 미지정 시 기간 WHERE 절을 추가하지 않는다', async () => {
      const qb = createQbMock([]);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<Repository<ProdResult>['createQueryBuilder']>,
      );

      await target.findCandidates('equipment', { equipCode: 'EQ-1', dateFrom: '', dateTo: '' }, '40', '1000');

      const whereSql = qb.whereCalls.map((c) => c.sql).join(' | ');
      expect(whereSql).not.toContain('fromTime');
      expect(whereSql).not.toContain('toTime');
    });
  });

  describe('findCandidates(operator)', () => {
    it('작업자 + 기간 조회도 기간 조건을 DB WHERE 절로 적용한다', async () => {
      const qb = createQbMock([
        { orderNo: 'WO-002', workerId: 'W-1', company: '40', plant: '1000' } as ProdResult,
      ]);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<Repository<ProdResult>['createQueryBuilder']>,
      );

      await target.findCandidates(
        'operator',
        { value: 'W-1', dateFrom: '2026-02-01', dateTo: '2026-02-28' },
        '40',
        '1000',
      );

      const whereSql = qb.whereCalls.map((c) => c.sql).join(' | ');
      expect(whereSql).toContain('pr.workerId = :workerCode');
      expect(whereSql).toContain('COALESCE(pr.startAt, pr.createdAt) >= :fromTime');
      expect(whereSql).toContain('COALESCE(pr.startAt, pr.createdAt) <= :toTime');
    });
  });
});
