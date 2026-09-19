import { BadRequestException } from '@nestjs/common';
import { assertCarrierLoadFlag } from './routing-carrier-flag.rules';

describe('assertCarrierLoadFlag', () => {
  it('라벨 발행 공정(SG/BUNDLE/FG)은 Y 허용', () => {
    expect(() => assertCarrierLoadFlag('Y', 'SG')).not.toThrow();
    expect(() => assertCarrierLoadFlag('Y', 'BUNDLE')).not.toThrow();
    expect(() => assertCarrierLoadFlag('Y', 'FG')).not.toThrow();
  });
  it('라벨 없는 공정(NONE/null)에서 Y면 400', () => {
    expect(() => assertCarrierLoadFlag('Y', 'NONE')).toThrow(BadRequestException);
    expect(() => assertCarrierLoadFlag('Y', null)).toThrow(BadRequestException);
  });
  it('N이거나 미지정이면 라벨유형과 무관하게 통과', () => {
    expect(() => assertCarrierLoadFlag('N', 'NONE')).not.toThrow();
    expect(() => assertCarrierLoadFlag(undefined, null)).not.toThrow();
  });
});
