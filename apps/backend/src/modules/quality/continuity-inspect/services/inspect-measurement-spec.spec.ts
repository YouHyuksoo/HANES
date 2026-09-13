import { judgeInspectMeasurement } from '@harness/shared';

describe('judgeInspectMeasurement', () => {
  it('스펙이 없으면 작업자 합/불을 유지한다', () => {
    expect(judgeInspectMeasurement(null, { holdBar: 0.2 })).toBeNull();
  });

  it('THN 리크: 2초 후 0.3bar 미만이면 불합격', () => {
    const spec = {
      inspectType: 'LEAK',
      chargeBar: 0.7,
      chargeTolBar: 0.2,
      holdSeconds: 2,
      minHoldBar: 0.3,
    };
    expect(judgeInspectMeasurement(spec, { chargeBar: 0.7, holdBar: 0.35, holdSeconds: 2 })?.passYn).toBe('Y');
    expect(judgeInspectMeasurement(spec, { chargeBar: 0.7, holdBar: 0.2, holdSeconds: 2 })?.passYn).toBe('N');
  });

  it('내전압: 허용전류 초과면 불합격', () => {
    const spec = { inspectType: 'HIPOT', testVoltageKv: 3, testSeconds: 2, maxCurrentMa: 2 };
    expect(judgeInspectMeasurement(spec, { voltageKv: 3, currentMa: 1.5, testSeconds: 2 })?.passYn).toBe('Y');
    expect(judgeInspectMeasurement(spec, { voltageKv: 3, currentMa: 2.1, testSeconds: 2 })?.passYn).toBe('N');
  });

  it('토크: 스펙 구간 밖이면 불합격', () => {
    const spec = { inspectType: 'TORQUE', torqueLsl: 0.45, torqueUsl: 0.55 };
    expect(judgeInspectMeasurement(spec, { torque: 0.5 })?.passYn).toBe('Y');
    expect(judgeInspectMeasurement(spec, { torque: 0.4 })?.passYn).toBe('N');
  });
});
