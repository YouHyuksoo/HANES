import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KioskConsumableService } from './kiosk-consumable.service';
import { JobOrder } from '../../../entities/job-order.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('KioskConsumableService', () => {
  let target: KioskConsumableService;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mapRepo: DeepMocked<Repository<ConsumableUsageMap>>;
  let stockRepo: DeepMocked<Repository<ConsumableStock>>;

  beforeEach(async () => {
    jobOrderRepo = createMock<Repository<JobOrder>>();
    mapRepo = createMock<Repository<ConsumableUsageMap>>();
    stockRepo = createMock<Repository<ConsumableStock>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KioskConsumableService,
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(ConsumableUsageMap), useValue: mapRepo },
        { provide: getRepositoryToken(ConsumableStock), useValue: stockRepo },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        {
          provide: TransactionService,
          // 트랜잭션 안의 manager 는 롯트 저장소 mock 을 그대로 쓴다(잠금 쿼리는 빈 결과)
          useValue: {
            run: (cb: (qr: unknown) => unknown) => cb({
              manager: { findOne: stockRepo.findOne, find: stockRepo.find, save: stockRepo.save },
              query: jest.fn().mockResolvedValue([]),
            }),
          },
        },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<KioskConsumableService>(KioskConsumableService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should mount only consumables that are waiting in the same process', async () => {
    const stock = {
      conUid: 'CON001',
      consumableCode: 'C001',
      status: 'PROC_WAIT',
      processCode: 'PROC-A',
      mountedEquipCode: null,
      currentCount: 3,
    } as ConsumableStock;
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      equipCode: 'EQ-001',
      processCode: 'PROC-A',
    } as JobOrder);
    stockRepo.findOne.mockResolvedValue(stock);
    mapRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableUsageMap);
    stockRepo.find.mockResolvedValue([]);
    stockRepo.save.mockImplementation(async (entity) => entity as ConsumableStock);

    const result = await target.scanMount('JO-001', 'CON001', 'COMP', 'PLANT');

    expect(stock.status).toBe('MOUNTED');
    expect(stock.mountedEquipCode).toBe('EQ-001');
    expect((stock as any).processCode).toBe('PROC-A');
    expect(result.status).toBe('MOUNTED');
  });

  it('should reject mounting a warehouse active consumable before process issue', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      equipCode: 'EQ-001',
      processCode: 'PROC-A',
    } as JobOrder);
    stockRepo.findOne.mockResolvedValue({
      conUid: 'CON001',
      consumableCode: 'C001',
      status: 'ACTIVE',
      processCode: null,
    } as ConsumableStock);
    mapRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableUsageMap);

    await expect(target.scanMount('JO-001', 'CON001', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
    expect(stockRepo.save).not.toHaveBeenCalled();
  });

  it('should reject mounting a consumable issued to a different process', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      equipCode: 'EQ-001',
      processCode: 'PROC-A',
    } as JobOrder);
    stockRepo.findOne.mockResolvedValue({
      conUid: 'CON001',
      consumableCode: 'C001',
      status: 'PROC_WAIT',
      processCode: 'PROC-B',
    } as ConsumableStock);
    mapRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableUsageMap);

    await expect(target.scanMount('JO-001', 'CON001', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
    expect(stockRepo.save).not.toHaveBeenCalled();
  });

  it('should return unmounted consumables to process waiting stock', async () => {
    const stock = {
      conUid: 'CON001',
      consumableCode: 'C001',
      status: 'MOUNTED',
      processCode: 'PROC-A',
      mountedEquipCode: 'EQ-001',
    } as ConsumableStock;
    stockRepo.findOne.mockResolvedValue(stock);
    stockRepo.save.mockImplementation(async (entity) => entity as ConsumableStock);

    await target.unmount('CON001', 'COMP', 'PLANT');

    expect(stock.status).toBe('PROC_WAIT');
    expect(stock.processCode).toBe('PROC-A');
    expect(stock.mountedEquipCode).toBeNull();
    expect(stockRepo.save).toHaveBeenCalledWith(stock);
  });

  it('locks the consumable master row before the lot row when mounting', async () => {
    const queries: string[] = [];
    const tx = (target as any).tx as { run: (cb: (qr: unknown) => unknown) => unknown };
    const originalRun = tx.run;
    tx.run = (cb) => originalRun((qr: any) => cb({ ...qr, query: jest.fn(async (sql: string) => { queries.push(sql); return []; }) }));
    const stock = {
      conUid: 'CON001', consumableCode: 'C001', status: 'PROC_WAIT', processCode: 'PROC-A',
      mountedEquipCode: null, currentCount: 0, company: 'COMP', plantCd: 'PLANT',
    } as unknown as ConsumableStock;
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'ITEM-001', equipCode: 'EQ-001', processCode: 'PROC-A' } as JobOrder);
    stockRepo.findOne.mockResolvedValue(stock);
    mapRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableUsageMap);
    stockRepo.find.mockResolvedValue([]);
    stockRepo.save.mockImplementation(async (entity) => entity as ConsumableStock);

    await target.scanMount('JO-001', 'CON001', 'COMP', 'PLANT');

    expect(queries[0]).toContain('FROM CONSUMABLE_MASTERS');
    expect(queries[1]).toContain('FROM CONSUMABLE_STOCKS');
  });
});
