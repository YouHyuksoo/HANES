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

  const buildTxManager = (
    consumable: Partial<ConsumableMaster> = {
      consumableCode: 'CON-1',
      company: 'COMP',
      plant: 'PLANT',
    },
  ) => ({
    findOne: jest.fn().mockResolvedValue(consumable as ConsumableMaster),
    create: jest.fn().mockImplementation((_entity: unknown, payload: unknown) => payload),
    save: jest.fn().mockImplementation(async (_entity: unknown, payload: unknown) => payload),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
  });

  it('allocates CONSUMABLE_LOGS seq from Oracle sequence inside a transaction', async () => {
    // createLog는 검증 + SEQ 채번 + 로그 INSERT + (SCRAP이면) 마스터 UPDATE를 단일 tx로 묶어야 한다.
    const manager = buildTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.createLog({ consumableId: 'CON-1', logType: 'IN', qty: 1 } as any, 'COMP', 'PLANT');

    expect(tx.run).toHaveBeenCalledTimes(1);
    // findById 가 tx 안에서 실행되어야 한다 (이전엔 tx 밖이라 race window 가 있었다).
    expect(manager.findOne).toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });

  it('SCRAP 로그는 같은 트랜잭션에서 마스터 useYn을 N으로 업데이트해야 한다', async () => {
    // partial commit 회귀 방지: 로그만 남고 마스터 폐기 누락되는 시나리오 차단.
    const manager = buildTxManager();
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
    expect(masterRepo.update).not.toHaveBeenCalled();
  });

  it('SCRAP 시 호출자가 tenant 헤더를 빠뜨려도 다른 테넌트의 마스터까지 비활성화되지 않는다', async () => {
    // cross-tenant SCRAP 회귀 방지: createLog 가 company/plant 인자 없이 호출되어도
    // 마스터 update 는 트랜잭션 안에서 읽은 row 의 tenant 로 강제 한정되어야 한다.
    const manager = buildTxManager({
      consumableCode: 'CON-1',
      company: 'TENANT-A',
      plant: 'PLANT-A',
    });
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.createLog(
      { consumableId: 'CON-1', logType: 'SCRAP', qty: 1 } as any,
      undefined,
      undefined,
    );

    expect(manager.update).toHaveBeenCalledWith(
      ConsumableMaster,
      {
        consumableCode: 'CON-1',
        company: 'TENANT-A',
        plant: 'PLANT-A',
      },
      { useYn: 'N' },
    );
  });

  it('createLog 의 worker 조회가 실패해도 본 트랜잭션 결과를 클라이언트에게 그대로 응답한다', async () => {
    // post-commit lookup throw → 500 응답 → 사용자 재시도 → 중복 SCRAP 로그 회귀 방지.
    const manager = buildTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));
    userRepo.findOne.mockRejectedValue(new Error('pool exhausted'));

    const result = await service.createLog(
      { consumableId: 'CON-1', logType: 'IN', qty: 1, workerId: 'w@x.com' } as any,
      'COMP',
      'PLANT',
    );

    expect(result).toBeDefined();
    expect((result as { worker: unknown }).worker).toBeNull();
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
