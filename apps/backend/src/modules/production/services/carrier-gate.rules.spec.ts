import { BadRequestException } from '@nestjs/common';
import { assertCarrierGate, isKioskCarrierGateApplicable } from './carrier-gate.rules';

describe('assertCarrierGate', () => {
  it('플래그 Y + 대차 없음 → 400', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, undefined)).toThrow(BadRequestException);
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, '  ')).toThrow(/출력 대차/);
  });
  it('플래그 Y + 대차 있음 → 통과', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, 'CR-001')).not.toThrow();
  });
  it('플래그 N/없음 → 대차 유무와 무관하게 통과', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'N' }, undefined)).not.toThrow();
    expect(() => assertCarrierGate(null, 'CR-001')).not.toThrow();
  });
});

describe('isKioskCarrierGateApplicable', () => {
  it('SG/BUNDLE 발행 공정만 실적 대차 게이트 대상이다', () => {
    expect(isKioskCarrierGateApplicable({ issueLabelType: 'SG' })).toBe(true);
    expect(isKioskCarrierGateApplicable({ issueLabelType: 'BUNDLE' })).toBe(true);
  });
  it('FG 발행 공정은 실적 경로가 라벨을 안 찍으므로 게이트 대상이 아니다', () => {
    expect(isKioskCarrierGateApplicable({ issueLabelType: 'FG' })).toBe(false);
  });
  it('NONE/null은 게이트 대상이 아니다', () => {
    expect(isKioskCarrierGateApplicable({ issueLabelType: 'NONE' })).toBe(false);
    expect(isKioskCarrierGateApplicable(null)).toBe(false);
  });
});
