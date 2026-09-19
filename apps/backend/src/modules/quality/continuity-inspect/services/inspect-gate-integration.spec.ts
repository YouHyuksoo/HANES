import { BadRequestException } from '@nestjs/common';
import { ContinuityInspectService } from './continuity-inspect.service';

type GateArgs = { equipCode?: string | null; orderNo?: string | null; inspectType?: string | null; itemCode?: string | null; workerId?: string | null };

function buildService(
  gate: unknown,
  sample: unknown,
  equipRepo: unknown = { findOne: jest.fn().mockResolvedValue({ equipCode: 'EQ-1', currentWorkerCodes: 'W-100,W-200' }) },
  equipStop: unknown = { findOpenStop: jest.fn().mockResolvedValue(null) },
): ContinuityInspectService & {
  assertInspectPrepGate: (dto: GateArgs, company?: string, plant?: string) => Promise<void>;
} {
  const service = Object.create(ContinuityInspectService.prototype) as ContinuityInspectService;
  Object.assign(service, { equipInspectGateService: gate, inspectSampleCheckService: sample, equipMasterRepo: equipRepo, equipStopService: equipStop });
  return service as ContinuityInspectService & {
    assertInspectPrepGate: (dto: GateArgs, company?: string, plant?: string) => Promise<void>;
  };
}

describe('ContinuityInspectService 검사 등록 게이트', () => {
  const dto: GateArgs & { workerId?: string | null } = { workerId: "W-100", equipCode: 'EQ-1', orderNo: 'W1', inspectType: 'CONTINUITY', itemCode: 'ITEM-1' };

  it('설비가 정지 중이면 작업자·점검·대조를 보지 않고 가장 먼저 차단한다', async () => {
    const gate = { assertGate: jest.fn() };
    const sample = { assertReady: jest.fn() };
    const equipRepo = { findOne: jest.fn() };
    const equipStop = { findOpenStop: jest.fn().mockResolvedValue({ stopId: 7, equipCode: 'EQ-1', status: 'OPEN' }) };
    const service = buildService(gate, sample, equipRepo, equipStop);

    await expect(service.assertInspectPrepGate(dto, 'C1', 'P1'))
      .rejects.toThrow('설비가 정지 중입니다. 정지를 해제한 뒤 검사를 등록하세요. (설비 EQ-1)');
    expect(equipStop.findOpenStop).toHaveBeenCalledWith('EQ-1', 'C1', 'P1');
    expect(equipRepo.findOne).not.toHaveBeenCalled();
    expect(gate.assertGate).not.toHaveBeenCalled();
    expect(sample.assertReady).not.toHaveBeenCalled();
  });

  it('설비점검 게이트가 막으면 양불 대조를 확인하지 않고 차단한다', async () => {
    const gate = {
      assertGate: jest.fn().mockRejectedValue(
        new BadRequestException('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1'),
      ),
    };
    const sample = { assertReady: jest.fn() };
    const service = buildService(gate, sample);

    await expect(service.assertInspectPrepGate(dto, 'C1', 'P1'))
      .rejects.toThrow('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1');
    expect(sample.assertReady).not.toHaveBeenCalled();
  });

  it('설비점검이 통과하면 양불 대조까지 확인한다', async () => {
    const gate = { assertGate: jest.fn().mockResolvedValue(undefined) };
    const sample = {
      assertReady: jest.fn().mockRejectedValue(
        new BadRequestException('양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: EQ-1 (2026-09-15 DAY)'),
      ),
    };
    const service = buildService(gate, sample);

    await expect(service.assertInspectPrepGate(dto, 'C1', 'P1')).rejects.toThrow(/양불마스터 대조를 완료해야/);
    expect(gate.assertGate).toHaveBeenCalledWith(
      { equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' },
      { company: 'C1', plant: 'P1' },
      '검사',
    );
  });

  it('둘 다 통과하면 예외 없이 끝난다', async () => {
    const gate = { assertGate: jest.fn().mockResolvedValue(undefined) };
    const sample = { assertReady: jest.fn().mockResolvedValue(undefined) };
    const service = buildService(gate, sample);

    await expect(service.assertInspectPrepGate(dto, 'C1', 'P1')).resolves.toBeUndefined();
    expect(sample.assertReady).toHaveBeenCalledWith(
      { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' },
      { company: 'C1', plant: 'P1' },
    );
  });

  it('현재 작업자가 없으면 작업자 선택을 요구한다', async () => {
    const gate = { assertGate: jest.fn() };
    const sample = { assertReady: jest.fn() };
    const equipRepo = { findOne: jest.fn().mockResolvedValue({ equipCode: 'EQ-1', currentWorkerCodes: null }) };
    const service = buildService(gate, sample, equipRepo);

    await expect(service.assertInspectPrepGate({ ...dto, workerId: 'W-100' }, 'C1', 'P1'))
      .rejects.toThrow('작업자를 1명 이상 선택해야 검사를 등록할 수 있습니다: EQ-1');
    expect(gate.assertGate).not.toHaveBeenCalled();
  });

  it('현재 작업자가 아닌 작업자로 검사하면 거부한다', async () => {
    const gate = { assertGate: jest.fn() };
    const sample = { assertReady: jest.fn() };
    const service = buildService(gate, sample);

    await expect(service.assertInspectPrepGate({ ...dto, workerId: 'W-999' }, 'C1', 'P1'))
      .rejects.toThrow('선택된 작업자가 검사기의 현재 작업자가 아닙니다: W-999');
  });

  it('equipCode가 없으면 게이트를 호출하지 않는다', async () => {
    const gate = { assertGate: jest.fn() };
    const sample = { assertReady: jest.fn() };
    const service = buildService(gate, sample);

    await service.assertInspectPrepGate({ ...dto, equipCode: null }, 'C1', 'P1');
    expect(gate.assertGate).not.toHaveBeenCalled();
    expect(sample.assertReady).not.toHaveBeenCalled();
  });

  it('품목코드가 없으면 설비점검만 확인한다', async () => {
    const gate = { assertGate: jest.fn().mockResolvedValue(undefined) };
    const sample = { assertReady: jest.fn() };
    const service = buildService(gate, sample);

    await service.assertInspectPrepGate({ ...dto, itemCode: null }, 'C1', 'P1');
    expect(gate.assertGate).toHaveBeenCalled();
    expect(sample.assertReady).not.toHaveBeenCalled();
  });
});
