import { BadRequestException } from '@nestjs/common';
import { assertCanAutoInput, assertCanLoad, deriveCarrierStatus, type CarrierContentRow } from './carrier-flow.rules';

const sg = (over: Partial<CarrierContentRow> = {}): CarrierContentRow => ({
  kind: 'SG', barcode: 'SG260919-00001', itemCode: 'SFG-1', itemName: null, orderNo: 'W1',
  qty: 10, loadedAt: new Date(), slipNo: null, issueProcessCode: 'P10', ...over,
});
const mat = (over: Partial<CarrierContentRow> = {}): CarrierContentRow => ({
  kind: 'MAT', barcode: 'VH1-RM26091900001', itemCode: 'RM-1', itemName: null, orderNo: null,
  qty: 100, loadedAt: new Date(), slipNo: null, issueProcessCode: null, ...over,
});

describe('deriveCarrierStatus', () => {
  it('0건=EMPTY, 전표 없음=LOADING, 전표 있음=IN_TRANSIT', () => {
    expect(deriveCarrierStatus([])).toBe('EMPTY');
    expect(deriveCarrierStatus([sg()])).toBe('LOADING');
    expect(deriveCarrierStatus([sg({ slipNo: 'CS260919-00001' })])).toBe('IN_TRANSIT');
  });
});

describe('assertCanLoad', () => {
  const base = { kind: 'SG' as const, itemCode: 'SFG-1', orderNo: 'W1', addCount: 1, capacity: null };
  it('빈 대차는 담을 수 있다', () => {
    expect(() => assertCanLoad({ ...base, rows: [] })).not.toThrow();
  });
  it('전표 발행 대차는 추가 적재 불가', () => {
    expect(() => assertCanLoad({ ...base, rows: [sg({ slipNo: 'CS1' })] })).toThrow(/이동전표/);
  });
  it('생산 대차는 품목·작업지시가 같아야 한다', () => {
    expect(() => assertCanLoad({ ...base, rows: [sg({ itemCode: 'SFG-2' })] })).toThrow(/품목/);
    expect(() => assertCanLoad({ ...base, rows: [sg({ orderNo: 'W2' })] })).toThrow(/작업지시/);
  });
  it('원자재 대차는 품목이 섞여도 되지만 라벨과는 섞을 수 없다', () => {
    expect(() => assertCanLoad({ ...base, kind: 'MAT', itemCode: 'RM-9', orderNo: null, rows: [mat()] })).not.toThrow();
    expect(() => assertCanLoad({ ...base, kind: 'MAT', rows: [sg()] })).toThrow(/섞을/);
  });
  it('수용량 초과는 대차 교체 안내', () => {
    expect(() => assertCanLoad({ ...base, capacity: 2, addCount: 2, rows: [sg()] })).toThrow(/대차 교체/);
    expect(() => assertCanLoad({ ...base, capacity: 2, addCount: 1, rows: [sg()] })).not.toThrow();
  });
});

describe('assertCanAutoInput', () => {
  it('옵션 N이면 거부', () => {
    expect(() => assertCanAutoInput({ rows: [sg({ slipNo: 'CS1' })], autoInputYn: 'N' })).toThrow(/자동투입/);
  });
  it('빈 대차 거부', () => {
    expect(() => assertCanAutoInput({ rows: [], autoInputYn: 'Y' })).toThrow(/빈 대차/);
  });
  it('생산 대차는 전표 필수, 원자재 대차는 전표 없이 허용', () => {
    expect(() => assertCanAutoInput({ rows: [sg()], autoInputYn: 'Y' })).toThrow(/이동전표 미발행/);
    expect(() => assertCanAutoInput({ rows: [sg({ slipNo: 'CS1' })], autoInputYn: 'Y' })).not.toThrow();
    expect(() => assertCanAutoInput({ rows: [mat()], autoInputYn: 'Y' })).not.toThrow();
  });
});
