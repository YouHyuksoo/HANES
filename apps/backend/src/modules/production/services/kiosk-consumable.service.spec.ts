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
});
