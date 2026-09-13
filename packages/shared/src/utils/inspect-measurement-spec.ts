/**
 * @file inspect-measurement-spec.ts
 * @description 통합검사 리크/내전압/토크 실측값을 품목 스펙과 대조한다.
 *              스펙이 없으면 null을 반환해 작업자 합/불을 유지한다.
 */
export type InspectMeasurementType = 'LEAK' | 'HIPOT' | 'TORQUE';

export interface InspectItemSpecValues {
  inspectType: string;
  chargeBar?: number | null;
  chargeTolBar?: number | null;
  measureBar?: number | null;
  measureTolBar?: number | null;
  holdSeconds?: number | null;
  minHoldBar?: number | null;
  testVoltageKv?: number | null;
  testSeconds?: number | null;
  maxCurrentMa?: number | null;
  torqueLsl?: number | null;
  torqueUsl?: number | null;
}

export interface InspectMeasuredValues {
  chargeBar?: number | null;
  holdBar?: number | null;
  holdSeconds?: number | null;
  voltageKv?: number | null;
  currentMa?: number | null;
  testSeconds?: number | null;
  torque?: number | null;
}

export interface InspectJudgeResult {
  passYn: 'Y' | 'N';
  reason?: string;
}

function inRange(value: number, target: number, tol: number): boolean {
  return value >= target - tol && value <= target + tol;
}

function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Number(v);
}

export function judgeInspectMeasurement(
  spec: InspectItemSpecValues | null | undefined,
  measured: InspectMeasuredValues | null | undefined,
): InspectJudgeResult | null {
  if (!spec) return null;
  const type = (spec.inspectType || '').toUpperCase();
  const m = measured ?? {};

  if (type === 'LEAK') {
    const holdBar = num(m.holdBar);
    const minHold = num(spec.minHoldBar);
    if (holdBar === null) {
      return { passYn: 'N', reason: '리크 측정압이 없습니다.' };
    }
    if (minHold !== null && holdBar < minHold) {
      return { passYn: 'N', reason: `측정압 ${holdBar} bar < 하한 ${minHold} bar` };
    }
    const charge = num(m.chargeBar);
    const chargeTarget = num(spec.chargeBar);
    const chargeTol = num(spec.chargeTolBar) ?? 0;
    if (charge !== null && chargeTarget !== null && !inRange(charge, chargeTarget, chargeTol)) {
      return { passYn: 'N', reason: `주입압 ${charge} bar가 ${chargeTarget}±${chargeTol} 밖` };
    }
    const holdSec = num(m.holdSeconds);
    const specHold = num(spec.holdSeconds);
    if (holdSec !== null && specHold !== null && holdSec < specHold) {
      return { passYn: 'N', reason: `유지시간 ${holdSec}s < ${specHold}s` };
    }
    return { passYn: 'Y' };
  }

  if (type === 'HIPOT') {
    const current = num(m.currentMa);
    const maxMa = num(spec.maxCurrentMa);
    if (current === null) {
      return { passYn: 'N', reason: '내전압 전류가 없습니다.' };
    }
    if (maxMa !== null && current > maxMa) {
      return { passYn: 'N', reason: `전류 ${current} mA > 허용 ${maxMa} mA` };
    }
    const kv = num(m.voltageKv);
    const specKv = num(spec.testVoltageKv);
    if (kv !== null && specKv !== null && Math.abs(kv - specKv) > 0.05) {
      return { passYn: 'N', reason: `전압 ${kv} kV ≠ 스펙 ${specKv} kV` };
    }
    const sec = num(m.testSeconds);
    const specSec = num(spec.testSeconds);
    if (sec !== null && specSec !== null && sec < specSec) {
      return { passYn: 'N', reason: `인가시간 ${sec}s < ${specSec}s` };
    }
    return { passYn: 'Y' };
  }

  if (type === 'TORQUE') {
    const torque = num(m.torque);
    if (torque === null) {
      return { passYn: 'N', reason: '토크 측정값이 없습니다.' };
    }
    const lsl = num(spec.torqueLsl);
    const usl = num(spec.torqueUsl);
    if (lsl !== null && torque < lsl) {
      return { passYn: 'N', reason: `토크 ${torque} < 하한 ${lsl}` };
    }
    if (usl !== null && torque > usl) {
      return { passYn: 'N', reason: `토크 ${torque} > 상한 ${usl}` };
    }
    return { passYn: 'Y' };
  }

  return null;
}
