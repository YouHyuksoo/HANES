import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { AutoPlanService } from './auto-plan.service';

describe('AutoPlanService', () => {
  let service: AutoPlanService;
  let partRepo: DeepMocked<Repository<ItemMaster>>;
  let orderItemRepo: DeepMocked<Repository<CustomerOrderItem>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    partRepo = createMock<Repository<ItemMaster>>();
    orderItemRepo = createMock<Repository<CustomerOrderItem>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoPlanService,
        { provide: getRepositoryToken(ProdPlan), useValue: createMock<Repository<ProdPlan>>() },
        { provide: getRepositoryToken(CustomerOrder), useValue: createMock<Repository<CustomerOrder>>() },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: orderItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(AutoPlanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('imports selected orders through TransactionService', async () => {
    jest.spyOn(service, 'search').mockResolvedValue({
      items: [
        {
          itemCode: 'FG-001',
          itemName: 'Finished Good',
          customerId: 'CUST-1',
          customerName: 'Customer',
          orderNo: 'CO-001',
          dueDate: '2026-05-23',
          demandQty: 10,
          planQty: 10,
        },
      ],
      workDays: 0,
      existingDraftCount: 0,
      warnings: [],
    });
    partRepo.find.mockResolvedValue([{ itemCode: 'FG-001', itemType: 'FINISHED' } as ItemMaster]);
    const planRepo = createMock<Repository<ProdPlan>>();
    planRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    queryRunner.manager.getRepository.mockReturnValue(planRepo);
    (queryRunner.manager.create as jest.Mock).mockReturnValue({ planNo: 'PP-202605-001' } as ProdPlan);
    (queryRunner.manager.save as jest.Mock).mockResolvedValue({ planNo: 'PP-202605-001' } as ProdPlan);

    const result = await service.importOrders({ month: '2026-05' } as any, 'C1', 'P1');

    expect(result.created).toBe(1);
    expect(partRepo.find).toHaveBeenCalledWith({
      where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
    });
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('throws before opening a transaction when there are no target orders', async () => {
    jest.spyOn(service, 'search').mockResolvedValue({
      items: [],
      workDays: 0,
      existingDraftCount: 0,
      warnings: ['empty'],
    });

    await expect(service.importOrders({ month: '2026-05' } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(tx.run).not.toHaveBeenCalled();
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('search joins order items to orders by tenant-scoped order key', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    orderItemRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.search({ month: '2026-05' } as any, 'C1', 'P1');

    expect(qb.innerJoin).toHaveBeenCalledWith(
      CustomerOrder,
      'co',
      'co.orderNo = ci.orderNo AND co.company = ci.company AND co.plant = ci.plant',
    );
  });
});
