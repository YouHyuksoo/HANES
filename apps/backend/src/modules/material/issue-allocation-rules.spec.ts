/**
 * @file src/modules/material/issue-allocation-rules.spec.ts
 * @description 자재출고 FIFO 배분 규칙(@harness/shared issue-allocation-rules) 진리표.
 * 출고 모달의 자동배분과 분할 대상 판정이 모두 이 함수를 본다.
 */
import { allocateFifo, roundUpToPack, type FifoLot } from '@harness/shared';

describe('roundUpToPack', () => {
  it('포장단위 배수로 올림한다', () => {
    expect(roundUpToPack(900, 100)).toBe(900);
    expect(roundUpToPack(901, 100)).toBe(1000);
  });

  it('포장단위가 0 이하이면 원값을 그대로 돌려준다', () => {
    expect(roundUpToPack(901, 0)).toBe(901);
    expect(roundUpToPack(901, -5)).toBe(901);
  });

  it('수량이 0 이하이면 원값을 그대로 돌려준다', () => {
    expect(roundUpToPack(0, 100)).toBe(0);
    expect(roundUpToPack(-3, 100)).toBe(-3);
  });
});

describe('allocateFifo', () => {
  const lots = (...pairs: Array<[string, number]>): FifoLot[] =>
    pairs.map(([matUid, availableQty]) => ({ matUid, availableQty }));

  it('첫 롯트로 정확히 채워지면 조각이 1개다', () => {
    const result = allocateFifo(200, lots(['A', 200], ['B', 1000]));
    expect(result.slices).toEqual([{ matUid: 'A', qty: 200 }]);
    expect(result.allocatedQty).toBe(200);
    expect(result.shortageQty).toBe(0);
  });

  it('첫 롯트가 부족하면 다음 롯트로 넘어가 분할한다 (200 + 700 = 900)', () => {
    const result = allocateFifo(900, lots(['A', 200], ['B', 1000]));
    expect(result.slices).toEqual([
      { matUid: 'A', qty: 200 },
      { matUid: 'B', qty: 700 },
    ]);
    expect(result.allocatedQty).toBe(900);
    expect(result.shortageQty).toBe(0);
  });

  it('전 롯트를 써도 모자라면 가용 전량을 배분하고 부족분을 돌려준다', () => {
    const result = allocateFifo(900, lots(['A', 200], ['B', 300]));
    expect(result.slices).toEqual([
      { matUid: 'A', qty: 200 },
      { matUid: 'B', qty: 300 },
    ]);
    expect(result.allocatedQty).toBe(500);
    expect(result.shortageQty).toBe(400);
  });

  it('가용 0인 롯트는 건너뛰고 qty=0 조각을 만들지 않는다', () => {
    const result = allocateFifo(100, lots(['A', 0], ['B', 100], ['C', 500]));
    expect(result.slices).toEqual([{ matUid: 'B', qty: 100 }]);
  });

  it('롯트가 없으면 전량 부족이다', () => {
    const result = allocateFifo(900, []);
    expect(result.slices).toEqual([]);
    expect(result.allocatedQty).toBe(0);
    expect(result.shortageQty).toBe(900);
  });

  it('총량이 0 이하면 아무것도 배분하지 않는다', () => {
    expect(allocateFifo(0, lots(['A', 100]))).toEqual({
      slices: [], allocatedQty: 0, shortageQty: 0,
    });
  });

  it('배열 순서만을 FIFO 로 신뢰한다 — availableQty 나 matUid 로 재정렬하지 않는다', () => {
    // 선입 롯트가 더 크고 matUid 도 뒤 순서인 픽스처 — 재정렬 오구현이면 A 부터 채워 실패한다
    const result = allocateFifo(300, lots(['Z', 1000], ['A', 100]));
    expect(result.slices).toEqual([{ matUid: 'Z', qty: 300 }]);
    expect(result.shortageQty).toBe(0);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const input = lots(['A', 200], ['B', 1000]);
    const snapshot = JSON.parse(JSON.stringify(input));
    allocateFifo(900, input);
    expect(input).toEqual(snapshot);
  });
});
