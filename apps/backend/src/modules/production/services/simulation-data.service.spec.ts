import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { ProcessCapa } from '../../../entities/process-capa.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { SimulationDataService } from './simulation-data.service';

describe('SimulationDataService', () => {
  let service: SimulationDataService;
  let capaRepo: DeepMocked<Repository<ProcessCapa>>;
  let processRepo: DeepMocked<Repository<ProcessMaster>>;
  let orderRepo: DeepMocked<Repository<CustomerOrder>>;

  beforeEach(async () => {
    capaRepo = createMock<Repository<ProcessCapa>>();
    processRepo = createMock<Repository<ProcessMaster>>();
    orderRepo = createMock<Repository<CustomerOrder>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationDataService,
        { provide: getRepositoryToken(ProcessCapa), useValue: capaRepo },
        { provide: getRepositoryToken(ProcessMaster), useValue: processRepo },
        { provide: getRepositoryToken(ProductStock), useValue: createMock<Repository<ProductStock>>() },
        { provide: getRepositoryToken(WorkCalendar), useValue: createMock<Repository<WorkCalendar>>() },
        { provide: getRepositoryToken(WorkCalendarDay), useValue: createMock<Repository<WorkCalendarDay>>() },
        { provide: getRepositoryToken(CustomerOrder), useValue: orderRepo },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: createMock<Repository<CustomerOrderItem>>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(SimulationDataService);
  });

  afterEach(() => jest.clearAllMocks());

  const queryBuilder = () => {
    const qb: any = {
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      groupBy: jest.fn(() => qb),
      getRawMany: jest.fn().mockResolvedValue([{ itemCode: 'FG-001', minCapa: 100 }]),
    };
    return qb;
  };

  it('loads bottleneck process names within tenant only', async () => {
    capaRepo.createQueryBuilder.mockReturnValue(queryBuilder());
    capaRepo.find.mockResolvedValue([
      { itemCode: 'FG-001', processCode: 'P01', dailyCapa: 100, company: 'C1', plant: 'P1' },
    ] as ProcessCapa[]);
    processRepo.find.mockResolvedValue([{ processCode: 'P01', processName: 'Cutting' }] as ProcessMaster[]);

    await service.loadBottleneckCapa(['FG-001'], 'C1', 'P1');

    expect(processRepo.find).toHaveBeenCalledWith({
      where: { processCode: expect.anything(), company: 'C1', plant: 'P1' },
    });
  });

  it('loads all process capa names within tenant only', async () => {
    capaRepo.find.mockResolvedValue([
      { itemCode: 'FG-001', processCode: 'P01', dailyCapa: 100, setupTime: 0, company: 'C1', plant: 'P1' },
    ] as ProcessCapa[]);
    processRepo.find.mockResolvedValue([{ processCode: 'P01', processName: 'Cutting', sortOrder: 1 }] as ProcessMaster[]);

    await service.loadAllProcessCapa(['FG-001'], 'C1', 'P1');

    expect(processRepo.find).toHaveBeenCalledWith({
      where: { processCode: expect.anything(), company: 'C1', plant: 'P1' },
    });
  });

  it('loads due dates by tenant-scoped order item join', async () => {
    const qb: any = {
      innerJoin: jest.fn(() => qb),
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      groupBy: jest.fn(() => qb),
      addGroupBy: jest.fn(() => qb),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    orderRepo.createQueryBuilder.mockReturnValue(qb);

    await service.loadDueDates(
      [{ planNo: 'PP-001', itemCode: 'FG-001', customer: 'CUST-1' } as any],
      '2026-05',
      'C1',
      'P1',
    );

    expect(qb.innerJoin).toHaveBeenCalledWith(
      CustomerOrderItem,
      'ci',
      'co.orderNo = ci.orderNo AND co.company = ci.company AND co.plant = ci.plant',
    );
  });
});
