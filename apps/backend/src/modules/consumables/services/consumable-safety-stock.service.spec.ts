import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { ConsumableSafetyStockService } from './consumable-safety-stock.service';

describe('ConsumableSafetyStockService', () => {
  let target: ConsumableSafetyStockService;
  let masterRepo: DeepMocked<Repository<ConsumableMaster>>;
  let stockRepo: DeepMocked<Repository<ConsumableStock>>;
  let sysConfig: DeepMocked<SysConfigService>;
  let masterQb: Record<string, jest.Mock>;
  let aggQb: Record<string, jest.Mock>;

  const master = (over: Partial<ConsumableMaster>) => ({
    consumableCode: 'C1',
    consumableName: '소모품1',
    category: 'APPL',
    safetyStock: 10,
    location: null,
    vendor: null,
    ...over,
  }) as ConsumableMaster;

  beforeEach(async () => {
    masterRepo = createMock<Repository<ConsumableMaster>>();
    stockRepo = createMock<Repository<ConsumableStock>>();
    sysConfig = createMock<SysConfigService>();
    sysConfig.getValue.mockResolvedValue(null);

    masterQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    aggQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    masterRepo.createQueryBuilder.mockReturnValue(masterQb as never);
    stockRepo.createQueryBuilder.mockReturnValue(aggQb as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumableSafetyStockService,
        { provide: getRepositoryToken(ConsumableMaster), useValue: masterRepo },
        { provide: getRepositoryToken(ConsumableStock), useValue: stockRepo },
        { provide: SysConfigService, useValue: sysConfig },
      ],
    }).compile();
    target = module.get(ConsumableSafetyStockService);
  });

  it('장착 교체임박 수량을 빼고 판정한다 — 재고만 세면 여유가 있어 보인다', async () => {
    masterQb.getMany.mockResolvedValue([master({ safetyStock: 10 })]);
    aggQb.getRawMany.mockResolvedValue([
      { consumableCode: 'C1', availableQty: '15', wornOutQty: '0', replacingQty: '4' },
    ]);

    const { data } = await target.findSafetyLevels('40', '1000');

    expect(data[0].effectiveQty).toBe(11);
    expect(data[0].level).toBe('PRE_ALERT');
  });

  it('수명이 끝난 ACTIVE는 가용에서 빠진다 — 집계 SQL이 REPLACE를 분리한다', async () => {
    masterQb.getMany.mockResolvedValue([master({})]);
    aggQb.getRawMany.mockResolvedValue([
      { consumableCode: 'C1', availableQty: '5', wornOutQty: '3', replacingQty: '0' },
    ]);

    const { data } = await target.findSafetyLevels('40', '1000');

    expect(data[0].availableQty).toBe(5);
    expect(data[0].wornOutQty).toBe(3);
    expect(data[0].level).toBe('SHORTAGE');
    // 가용/수명소진 분리가 SQL에서 이뤄지는지 — 프론트에서 다시 세지 않는다
    const selects = aggQb.addSelect.mock.calls.map((c) => String(c[0]));
    expect(selects.some((s) => s.includes("s.lifeStatus <> 'REPLACE'"))).toBe(true);
    expect(selects.some((s) => s.includes("s.status = 'MOUNTED'"))).toBe(true);
  });

  it('재고 인스턴스가 하나도 없는 품목도 빠뜨리지 않는다', async () => {
    masterQb.getMany.mockResolvedValue([master({ consumableCode: 'C-NONE' })]);
    aggQb.getRawMany.mockResolvedValue([]);

    const { data } = await target.findSafetyLevels('40', '1000');

    expect(data).toHaveLength(1);
    expect(data[0].effectiveQty).toBe(0);
    expect(data[0].level).toBe('SHORTAGE');
    expect(data[0].shortageQty).toBe(10);
  });

  it('onlyActionNeeded는 부족·사전경고만 남긴다', async () => {
    masterQb.getMany.mockResolvedValue([
      master({ consumableCode: 'C-SHORT', safetyStock: 10 }),
      master({ consumableCode: 'C-OK', safetyStock: 1 }),
      master({ consumableCode: 'C-NOTSET', safetyStock: 0 }),
    ]);
    aggQb.getRawMany.mockResolvedValue([
      { consumableCode: 'C-SHORT', availableQty: '2', wornOutQty: '0', replacingQty: '0' },
      { consumableCode: 'C-OK', availableQty: '50', wornOutQty: '0', replacingQty: '0' },
      { consumableCode: 'C-NOTSET', availableQty: '0', wornOutQty: '0', replacingQty: '0' },
    ]);

    const { data } = await target.findSafetyLevels('40', '1000', { onlyActionNeeded: true });

    expect(data.map((r) => r.consumableCode)).toEqual(['C-SHORT']);
  });

  it('부족이 사전경고보다 먼저, 모자란 양이 큰 순으로 정렬한다', async () => {
    masterQb.getMany.mockResolvedValue([
      master({ consumableCode: 'B-PRE', safetyStock: 10 }),
      master({ consumableCode: 'A-SHORT-SMALL', safetyStock: 10 }),
      master({ consumableCode: 'C-SHORT-BIG', safetyStock: 10 }),
    ]);
    aggQb.getRawMany.mockResolvedValue([
      { consumableCode: 'B-PRE', availableQty: '11', wornOutQty: '0', replacingQty: '0' },
      { consumableCode: 'A-SHORT-SMALL', availableQty: '9', wornOutQty: '0', replacingQty: '0' },
      { consumableCode: 'C-SHORT-BIG', availableQty: '1', wornOutQty: '0', replacingQty: '0' },
    ]);

    const { data } = await target.findSafetyLevels('40', '1000');

    expect(data.map((r) => r.consumableCode)).toEqual(['C-SHORT-BIG', 'A-SHORT-SMALL', 'B-PRE']);
  });

  it('임계 배수는 SYS_CONFIG에서 읽고 테넌트 범위로 조회한다', async () => {
    sysConfig.getValue.mockResolvedValue('2');
    masterQb.getMany.mockResolvedValue([master({ safetyStock: 10 })]);
    aggQb.getRawMany.mockResolvedValue([
      { consumableCode: 'C1', availableQty: '19', wornOutQty: '0', replacingQty: '0' },
    ]);

    const { ratio, data } = await target.findSafetyLevels('40', '1000');

    expect(sysConfig.getValue).toHaveBeenCalledWith('CONSUMABLE_PRE_ALERT_RATIO', '40', '1000');
    expect(ratio).toBe(2);
    // 기본값 1.2였다면 정상이었을 수량이 임계 2배에서는 사전경고다
    expect(data[0].level).toBe('PRE_ALERT');
  });

  it('집계와 마스터 조회 모두 요청 테넌트로 제한한다', async () => {
    masterQb.getMany.mockResolvedValue([master({})]);
    await target.findSafetyLevels('40', '1000');

    expect(masterQb.andWhere).toHaveBeenCalledWith('m.company = :company', { company: '40' });
    expect(masterQb.andWhere).toHaveBeenCalledWith('m.plant = :plant', { plant: '1000' });
    expect(aggQb.andWhere).toHaveBeenCalledWith('s.company = :company', { company: '40' });
    expect(aggQb.andWhere).toHaveBeenCalledWith('s.plantCd = :plant', { plant: '1000' });
  });
});
