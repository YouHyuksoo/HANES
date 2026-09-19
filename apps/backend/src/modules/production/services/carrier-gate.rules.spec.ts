import { BadRequestException } from '@nestjs/common';
import { assertCarrierGate } from './carrier-gate.rules';

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
