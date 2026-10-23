import { distributeQtyToOrders, splitRequestQtyByOrder, sortOrdersByPlan } from './issue-request-order-split';

describe('issue-request-order-split', () => {
  it('계획일 빠른 순 → 작업지시번호 순으로 정렬하고 계획일 없는 지시는 맨 뒤로 보낸다', () => {
    const sorted = sortOrdersByPlan([
      { orderNo: 'WO-3', planDate: null },
      { orderNo: 'WO-2', planDate: '2026-10-02' },
      { orderNo: 'WO-1', planDate: '2026-10-02' },
      { orderNo: 'WO-0', planDate: '2026-10-01' },
    ]);
    expect(sorted.map((o) => o.orderNo)).toEqual(['WO-0', 'WO-1', 'WO-2', 'WO-3']);
  });

  describe('splitRequestQtyByOrder', () => {
    it('작업지시 1건이면 기존 1:1 산식(ceil(필요-현장재고), 0 하한)과 같다', () => {
      expect(splitRequestQtyByOrder([{ orderNo: 'WO-1', needQty: 10.2 }], 3)).toEqual([{ orderNo: 'WO-1', requestQty: 8 }]);
      expect(splitRequestQtyByOrder([{ orderNo: 'WO-1', needQty: 5 }], 9)).toEqual([{ orderNo: 'WO-1', requestQty: 0 }]);
    });

    it('현장재고는 품목당 한 번만, 빠른 작업지시부터 덮는다', () => {
      const result = splitRequestQtyByOrder([
        { orderNo: 'WO-B', planDate: '2026-10-02', needQty: 100 },
        { orderNo: 'WO-A', planDate: '2026-10-01', needQty: 50 },
      ], 70);
      // WO-A 50 전부 현장재고, WO-B 는 20 덮이고 80 요청. 합계 = 150 - 70 = 80
      expect(result).toEqual([
        { orderNo: 'WO-A', requestQty: 0 },
        { orderNo: 'WO-B', requestQty: 80 },
      ]);
    });

    it('소수 소요량은 누적 올림 차이로 정수화해 합계가 ceil(전체)와 같다', () => {
      const result = splitRequestQtyByOrder([
        { orderNo: 'WO-1', planDate: '2026-10-01', needQty: 0.4 },
        { orderNo: 'WO-2', planDate: '2026-10-02', needQty: 0.4 },
        { orderNo: 'WO-3', planDate: '2026-10-03', needQty: 0.4 },
      ], 0);
      expect(result.map((r) => r.requestQty)).toEqual([1, 0, 1]);
      expect(result.reduce((sum, r) => sum + r.requestQty, 0)).toBe(Math.ceil(1.2));
    });

    it('부동소수 오차로 정수 소요량이 1 더 올라가지 않는다', () => {
      const result = splitRequestQtyByOrder([
        { orderNo: 'WO-1', needQty: 0.1 + 0.2 },
        { orderNo: 'WO-2', needQty: 0.7 },
      ], 0);
      expect(result.reduce((sum, r) => sum + r.requestQty, 0)).toBe(1);
    });
  });

  describe('distributeQtyToOrders', () => {
    const rows = [
      { orderNo: 'WO-B', planDate: '2026-10-02', requestQty: 120, issuedQty: 0 },
      { orderNo: 'WO-A', planDate: '2026-10-01', requestQty: 100, issuedQty: 30 },
    ];

    it('계획일 빠른 작업지시의 잔여부터 채운다(LOT 하나가 두 작업지시에 걸칠 수 있다)', () => {
      expect(distributeQtyToOrders(rows, 100)).toEqual([
        { orderNo: 'WO-A', qty: 70 },
        { orderNo: 'WO-B', qty: 30 },
      ]);
    });

    it('포장단위 올림 초과분은 마지막 작업지시에 얹어 합계를 보존한다', () => {
      const takes = distributeQtyToOrders(rows, 200);
      expect(takes).toEqual([
        { orderNo: 'WO-A', qty: 70 },
        { orderNo: 'WO-B', qty: 130 },
      ]);
      expect(takes.reduce((sum, t) => sum + t.qty, 0)).toBe(200);
    });

    it('모두 채워진 뒤의 추가 출고는 마지막 작업지시로 간다', () => {
      expect(distributeQtyToOrders([
        { orderNo: 'WO-A', planDate: '2026-10-01', requestQty: 10, issuedQty: 10 },
        { orderNo: 'WO-B', planDate: '2026-10-02', requestQty: 10, issuedQty: 10 },
      ], 5)).toEqual([{ orderNo: 'WO-B', qty: 5 }]);
    });

    it('preferOrderNo 가 있으면 그 작업지시를 먼저 채우고 나머지는 계획일 순으로 이어간다', () => {
      expect(distributeQtyToOrders(rows, 150, 'WO-B')).toEqual([
        { orderNo: 'WO-B', qty: 120 },
        { orderNo: 'WO-A', qty: 30 },
      ]);
    });

    it('수량 0 이하이거나 행이 없으면 배분하지 않는다', () => {
      expect(distributeQtyToOrders(rows, 0)).toEqual([]);
      expect(distributeQtyToOrders([], 10)).toEqual([]);
    });
  });
});
