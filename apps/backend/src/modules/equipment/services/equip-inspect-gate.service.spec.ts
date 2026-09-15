import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { EquipInspectGateService } from './equip-inspect-gate.service';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { SysConfigService } from '../../system/services/sys-config.service';

describe('EquipInspectGateService', () => {
  let service: EquipInspectGateService;
  const poolRepo = { find: jest.fn() };
  const inspectService = { getInspectionStatus: jest.fn() };
  const sysConfig = { getValue: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    sysConfig.getValue.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquipInspectGateService,
        { provide: getRepositoryToken(EquipInspectItemPool), useValue: poolRepo },
        { provide: EquipInspectService, useValue: inspectService },
        { provide: SysConfigService, useValue: sysConfig },
      ],
    }).compile();
    service = moduleRef.get(EquipInspectGateService);
  });

  it('점검항목 매핑이 없으면 통과한다', async () => {
    poolRepo.find.mockResolvedValue([]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).resolves.toBeUndefined();
  });

  it('DAILY 항목이 있고 점검 기록이 없으면 검사를 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    inspectService.getInspectionStatus.mockResolvedValue({ alreadyInspected: false, inspectPassed: false, overallResult: null });
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1');
  });

  it('DAILY 종합판정이 NG면 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    inspectService.getInspectionStatus.mockResolvedValue({ alreadyInspected: true, inspectPassed: false, overallResult: 'NG' });
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow(/불합격\(NG\)/);
  });

  it('WORKER 항목이 있는데 orderNo가 없으면 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'WORKER' }]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow(/작업지시번호가 필요합니다/);
  });

  it('EQUIP_INSPECT_INTERLOCK=N 이면 통과한다', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) => (key === 'EQUIP_INSPECT_INTERLOCK' ? 'N' : null));
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).resolves.toBeUndefined();
  });

  it('스코프별 sys-config가 N이면 해당 점검을 요구하지 않는다', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) =>
      key === 'INSPECT_DAILY_INSPECT_REQUIRED' ? 'N' : null,
    );
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).resolves.toBeUndefined();
  });

  it('생산실적은 기존 문구(실적)를 그대로 쓴다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    inspectService.getInspectionStatus.mockResolvedValue({ alreadyInspected: false, inspectPassed: false, overallResult: null });
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'ASSEMBLY' }, { company: 'C1', plant: 'P1' }),
    ).rejects.toThrow('설비 일상점검을 완료해야 실적을 등록할 수 있습니다: EQ-1');
  });

  it('getGateStatus는 DAILY 완료·WORKER 미완료 상태를 그대로 보고한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }, { inspectType: 'WORKER' }]);
    inspectService.getInspectionStatus.mockImplementation(async ({ inspectType }: { inspectType: string }) =>
      inspectType === 'DAILY'
        ? { alreadyInspected: true, inspectPassed: true, overallResult: 'PASS', inspectedAt: '2026-09-15 08:00' }
        : { alreadyInspected: false, inspectPassed: false, overallResult: null, inspectedAt: null },
    );
    const status = await service.getGateStatus({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사');
    expect(status.dailyDone).toBe(true);
    expect(status.dailyInspectedAt).toBe('2026-09-15 08:00');
    expect(status.workerDone).toBe(false);
    expect(status.blocked).toBe(true);
  });

  it('equipCode가 없으면 판정 없이 통과 상태를 돌려준다', async () => {
    const status = await service.getGateStatus({ orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사');
    expect(status.blocked).toBe(false);
    expect(status.dailyRequired).toBe(false);
    expect(poolRepo.find).not.toHaveBeenCalled();
  });
});
