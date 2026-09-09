/**
 * @file protocol-parser.spec.ts
 * @description parseProtocolData 수치 추출(valueIndex) 단위 테스트
 */
import { parseMeasuredToken, parseProtocolData } from './protocol-parser';

const baseRule = {
  delimiter: ',',
  resultIndex: 1,
  passValue: 'PASS',
  errorIndex: 2,
  dataStartChar: null,
  dataEndChar: null,
  valueIndex: null,
};

describe('parseProtocolData', () => {
  it('valueIndex 토큰을 숫자로 변환해 measuredValue로 돌려준다', () => {
    const parsed = parseProtocolData('W001,PASS,,12.34', { ...baseRule, valueIndex: 3 });
    expect(parsed).toEqual({ passYn: 'Y', errorCode: null, measuredValue: 12.34 });
  });

  it('valueIndex 토큰이 숫자가 아니면 measuredValue는 null이다', () => {
    const parsed = parseProtocolData('W001,FAIL,E01,abc', { ...baseRule, valueIndex: 3 });
    expect(parsed.passYn).toBe('N');
    expect(parsed.errorCode).toBe('E01');
    expect(parsed.measuredValue).toBeNull();
  });

  it('valueIndex가 토큰 범위를 벗어나면 measuredValue는 null이다', () => {
    const parsed = parseProtocolData('W001,PASS', { ...baseRule, valueIndex: 7 });
    expect(parsed.measuredValue).toBeNull();
  });

  it('valueIndex가 없으면(null/undefined) 수치를 추출하지 않는다', () => {
    expect(parseProtocolData('W001,PASS,,12.34', baseRule).measuredValue).toBeNull();
    const { valueIndex: _omit, ...withoutValueIndex } = baseRule;
    expect(parseProtocolData('W001,PASS,,12.34', withoutValueIndex).measuredValue).toBeNull();
  });

  it('시작/종료 문자를 잘라낸 뒤 토큰을 분해한다', () => {
    const parsed = parseProtocolData('STX;W001;PASS;;0.55ETX', {
      ...baseRule,
      delimiter: ';',
      dataStartChar: 'STX;',
      dataEndChar: 'ETX',
      valueIndex: 3,
    });
    expect(parsed).toEqual({ passYn: 'Y', errorCode: null, measuredValue: 0.55 });
  });

  it('기존 PASS/FAIL 판정과 errorCode 동작은 그대로다', () => {
    expect(parseProtocolData('W001,pass', baseRule)).toEqual({ passYn: 'Y', errorCode: null, measuredValue: null });
    expect(parseProtocolData('W001,NG,E77', baseRule)).toEqual({ passYn: 'N', errorCode: 'E77', measuredValue: null });
  });
});

describe('parseMeasuredToken', () => {
  it.each([
    ['12.5', 12.5],
    [' -3 ', -3],
    ['0', 0],
    ['', null],
    ['   ', null],
    ['1.2.3', null],
    ['Infinity', null],
    [undefined, null],
  ])('%p → %p', (token, expected) => {
    expect(parseMeasuredToken(token)).toBe(expected);
  });
});
