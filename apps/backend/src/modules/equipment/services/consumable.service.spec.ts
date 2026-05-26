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

  it('allocates CONSUMABLE_LOGS seq from Oracle sequence inside a transaction', async () => {
    // createLog는 SEQ 채번 + 로그 INSERT + (SCRAP이면) 마스터 UPDATE를 단일 tx로 묶어야 한다.
    masterRepo.findOne.mockResolvedValue({
      consumableCode: 'CON-1',
      company: 'COMP',
      plant: 'PLANT',
    } as ConsumableMaster);
    const manager = {
      create: jest.fn().mockImplementation((_entity: unknown, payload: unknown) => payload),
      save: jest.fn().mockImplementation(async (_entity: unknown, payload: unknown) => payload),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
    };
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.createLog({ consumableId: 'CON-1', logType: 'IN', qty: 1 } as any, 'COMP', 'PLANT');

    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });

  it('SCRAP 로그는 같은 트랜잭션에서 마스터 useYn을 N으로 업데이트해야 한다', async () => {
    // partial commit 회귀 방지: 로그만 남고 마스터 폐기 누락되는 시나리오 차단.
    masterRepo.findOne.mockResolvedValue({
      consumableCode: 'CON-1',
      company: 'COMP',
      plant: 'PLANT',
    } as ConsumableMaster);
    const manager = {
      create: jest.fn().mockImplementation((_entity: unknown, payload: unknown) => payload),
      save: jest.fn().mockImplementation(async (_entity: unknown, payload: unknown) => payload),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
    };
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.createLog(
      { consumableId: 'CON-1', logType: 'SCRAP', qty: 1 } as any,
      'COMP',
      'PLANT',
    );

    expect(manager.update).toHaveBeenCalledWith(
      ConsumableMaster,
      expect.objectContaining({ consumableCode: 'CON-1', company: 'COMP', plant: 'PLANT' }),
      { useYn: 'N' },
    );
    // 마스터 update는 트랜잭션 안의 manager로만 호출되어야 한다.
    expect(masterRepo.update).not.toHaveBeenCalled();
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
