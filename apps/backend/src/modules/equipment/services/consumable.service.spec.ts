import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { User } from '../../../entities/user.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { ConsumableService } from './consumable.service';

describe('Equipment ConsumableService', () => {
  let service: ConsumableService;
  let masterRepo: DeepMocked<Repository<ConsumableMaster>>;
  let logRepo: DeepMocked<Repository<ConsumableLog>>;
  let mountLogRepo: DeepMocked<Repository<ConsumableMountLog>>;
  let stockRepo: DeepMocked<Repository<ConsumableStock>>;
  let userRepo: DeepMocked<Repository<User>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;

  beforeEach(() => {
    masterRepo = createMock<Repository<ConsumableMaster>>();
    logRepo = createMock<Repository<ConsumableLog>>();
    mountLogRepo = createMock<Repository<ConsumableMountLog>>();
    stockRepo = createMock<Repository<ConsumableStock>>();
    userRepo = createMock<Repository<User>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();

    service = new ConsumableService(
      masterRepo,
      logRepo,
      mountLogRepo,
      stockRepo,
      userRepo,
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

  it('updateWarningStatus 는 shared 수명 규칙을 쓴다 — 임계 초과 REPLACE, 수명 외 상태는 임계 미달이어도 덮어쓰지 않는다', async () => {
    // (1) 교체 임계 도달 → REPLACE 로 갱신
    masterRepo.findOne.mockResolvedValueOnce({
      consumableCode: 'CON-1', company: 'COMP', plant: 'PLANT',
      currentCount: 100, warningCount: 80, expectedLife: 100, status: 'WARNING', mountedEquipCode: null,
    } as ConsumableMaster);
    await service.updateWarningStatus('CON-1', 'COMP', 'PLANT');
    expect(masterRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ consumableCode: 'CON-1' }),
      { status: 'REPLACE' },
    );

    // (2) 수명 외 상태(예: 폐기)는 임계 미달이어도 NORMAL 로 되돌리지 않는다 (이전 구현은 무조건 NORMAL 부터 재계산했다)
    masterRepo.update.mockClear();
    masterRepo.findOne.mockResolvedValueOnce({
      consumableCode: 'CON-2', company: 'COMP', plant: 'PLANT',
      currentCount: 10, warningCount: 80, expectedLife: 100, status: 'DISCARDED', mountedEquipCode: null,
    } as ConsumableMaster);
    await service.updateWarningStatus('CON-2', 'COMP', 'PLANT');
    expect(masterRepo.update).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 실물 롯트(conUid) 단위 예외 창구 — 강제 해제 / 수리 전환 / 수리 완료
  // 2026-09 전환으로 마스터 장착(mountToEquip/unmountFromEquip)은 폐기됐고,
  // 장착(MOUNT)은 키오스크 스캔에서만 일어난다.
  // ------------------------------------------------------------------

  const buildStock = (overrides: Partial<ConsumableStock> = {}) =>
    ({
      conUid: 'C26091400001',
      consumableCode: 'CON-1',
      status: 'MOUNTED',
      mountedEquipCode: 'EQ-1',
      processCode: 'P10',
      company: 'COMP',
      plantCd: 'PLANT',
      ...overrides,
    }) as ConsumableStock;

  const buildMountTxManager = () => ({
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
  });

  it('forceUnmount 는 UNMOUNT 이력 SEQ 를 Oracle 시퀀스에서 채번한다', async () => {
    // 이력 SEQ 를 앱에서 MAX+1 로 계산하면 동시 해제 시 PK 충돌이 난다.
    stockRepo.findOne.mockResolvedValue(buildStock());
    const manager = buildMountTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.forceUnmount('C26091400001', { returnTo: 'PROC_WAIT' } as any, 'COMP', 'PLANT');

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
    expect(manager.save).toHaveBeenCalledWith(
      ConsumableMountLog,
      expect.objectContaining({
        conUid: 'C26091400001',
        consumableCode: 'CON-1',
        equipCode: 'EQ-1',
        action: 'UNMOUNT',
      }),
    );
  });

  it('forceUnmount 는 반환처에 따라 공정 배정을 유지/해제한다', async () => {
    // 공정대기 복귀는 공정 배정을 유지해야 하고, 창고 반납·수리는 유령 배정이 남으면 안 된다.
    stockRepo.findOne.mockResolvedValue(buildStock());

    const procWaitManager = buildMountTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager: procWaitManager } as any));
    await service.forceUnmount('C26091400001', { returnTo: 'PROC_WAIT' } as any, 'COMP', 'PLANT');
    expect(procWaitManager.update).toHaveBeenCalledWith(
      ConsumableStock,
      { conUid: 'C26091400001' },
      { status: 'PROC_WAIT', mountedEquipCode: null },
    );

    const activeManager = buildMountTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager: activeManager } as any));
    await service.forceUnmount('C26091400001', { returnTo: 'ACTIVE' } as any, 'COMP', 'PLANT');
    expect(activeManager.update).toHaveBeenCalledWith(
      ConsumableStock,
      { conUid: 'C26091400001' },
      { status: 'ACTIVE', mountedEquipCode: null, processCode: null },
    );
  });

  it('forceUnmount 는 장착 상태가 아니거나 허용되지 않은 반환처면 거부한다', async () => {
    // 상태 검증 없이 해제하면 창고 재고에 해제 이력만 남고 상태가 뒤집힌다.
    stockRepo.findOne.mockResolvedValueOnce(buildStock({ status: 'ACTIVE' }));
    await expect(
      service.forceUnmount('C26091400001', {} as any, 'COMP', 'PLANT'),
    ).rejects.toBeInstanceOf(BadRequestException);

    stockRepo.findOne.mockResolvedValueOnce(buildStock());
    await expect(
      service.forceUnmount('C26091400001', { returnTo: 'SCRAPPED' } as any, 'COMP', 'PLANT'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.run).not.toHaveBeenCalled();
  });

  it('없는 롯트를 해제하면 404 를 던진다', async () => {
    stockRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.forceUnmount('NOPE', {} as any, 'COMP', 'PLANT'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('setRepairStatus 는 장착 중이면 UNMOUNT 이력을 남기고 수리로 전환한다', async () => {
    // 이력 없이 상태만 바꾸면 설비에서 언제 내려왔는지 추적이 끊긴다.
    stockRepo.findOne.mockResolvedValue(buildStock());
    const manager = buildMountTxManager();
    tx.run.mockImplementationOnce(async (callback) => callback({ manager } as any));

    await service.setRepairStatus('C26091400001', {} as any, 'COMP', 'PLANT');

    expect(manager.save).toHaveBeenCalledWith(
      ConsumableMountLog,
      expect.objectContaining({ action: 'UNMOUNT', equipCode: 'EQ-1' }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      ConsumableStock,
      { conUid: 'C26091400001' },
      { status: 'REPAIR', mountedEquipCode: null, processCode: null },
    );
  });

  it('이미 수리중인 롯트는 중복 수리 전환을 거부한다', async () => {
    stockRepo.findOne.mockResolvedValueOnce(buildStock({ status: 'REPAIR' }));

    await expect(
      service.setRepairStatus('C26091400001', {} as any, 'COMP', 'PLANT'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('completeRepair 는 수리 상태만 ACTIVE 로 복귀시킨다', async () => {
    stockRepo.findOne.mockResolvedValue(buildStock({ status: 'REPAIR', mountedEquipCode: null }));

    await service.completeRepair('C26091400001', { remark: '날 교체' } as any, 'COMP', 'PLANT');
    expect(stockRepo.update).toHaveBeenCalledWith(
      { conUid: 'C26091400001' },
      { status: 'ACTIVE', remark: '날 교체' },
    );

    stockRepo.update.mockClear();
    stockRepo.findOne.mockResolvedValueOnce(buildStock());
    await expect(
      service.completeRepair('C26091400001', {} as any, 'COMP', 'PLANT'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stockRepo.update).not.toHaveBeenCalled();
  });
});
