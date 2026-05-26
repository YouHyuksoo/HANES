import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { User } from '../../../entities/user.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { ConsumableService } from './consumable.service';

describe('Equipment ConsumableService', () => {
  let service: ConsumableService;
  let masterRepo: DeepMocked<Repository<ConsumableMaster>>;
  let logRepo: DeepMocked<Repository<ConsumableLog>>;
  let mountLogRepo: DeepMocked<Repository<ConsumableMountLog>>;
  let userRepo: DeepMocked<Repository<User>>;
  let equipRepo: DeepMocked<Repository<EquipMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;

  beforeEach(() => {
    masterRepo = createMock<Repository<ConsumableMaster>>();
    logRepo = createMock<Repository<ConsumableLog>>();
    mountLogRepo = createMock<Repository<ConsumableMountLog>>();
    userRepo = createMock<Repository<User>>();
    equipRepo = createMock<Repository<EquipMaster>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();

    service = new ConsumableService(
      masterRepo,
      logRepo,
      mountLogRepo,
      userRepo,
      equipRepo,
      dataSource,
      tx,
    );
  });

  it('allocates CONSUMABLE_LOGS seq from Oracle sequence', async () => {
    masterRepo.findOne.mockResolvedValue({
      consumableCode: 'CON-1',
      company: 'COMP',
      plant: 'PLANT',
    } as ConsumableMaster);
    logRepo.create.mockImplementation((payload) => payload as ConsumableLog);
    logRepo.save.mockImplementation(async (payload) => payload as ConsumableLog);
    (dataSource.manager.query as jest.Mock).mockResolvedValue([{ nextSeq: 1 }]);

    await service.createLog({ consumableId: 'CON-1', logType: 'IN', qty: 1 } as any, 'COMP', 'PLANT');

    expect(dataSource.manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });

  it('allocates CONSUMABLE_MOUNT_LOGS seq from Oracle sequence', async () => {
    masterRepo.findOne.mockResolvedValue({
      consumableCode: 'CON-1',
      operStatus: 'WAREHOUSE',
      company: 'COMP',
      plant: 'PLANT',
    } as ConsumableMaster);
    const manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
    };
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.mountToEquip('CON-1', { equipCode: 'EQ-1' } as any, 'COMP', 'PLANT');

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });
});
