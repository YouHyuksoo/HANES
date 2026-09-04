/**
 * @file hv-spc-math.spec.ts
 * @description X̄-R 관리한계·Cp/Cpk 순수 계산 테스트
 */
import { computeSpcStats, limitSubgroups, xbarRConstants } from './hv-spc-math';

const sg = (id: number, xbar: number, range: number) => ({ id, xbar, range });

describe('hv-spc-math', () => {
  describe('computeSpcStats', () => {
    it('관리한계: X̄̄ ± A2·R̄, R 상한 D4·R̄ (n=5 원본 상수)', () => {
      const rows = [sg(1, 10, 2), sg(2, 12, 4), sg(3, 11, 3)];
      const s = computeSpcStats(rows, { lsl: null, target: null, usl: null }, 3, 0);
      expect(s.xbarBar).toBe(11);
      expect(s.rBar).toBe(3);
      expect(s.xbarUCL).toBeCloseTo(11 + 0.577 * 3, 4);
      expect(s.xbarLCL).toBeCloseTo(11 - 0.577 * 3, 4);
      expect(s.rUCL).toBeCloseTo(2.114 * 3, 4);
      expect(s.rLCL).toBe(0);
      expect(s.sigmaEst).toBeCloseTo(3 / 2.326, 4);
      expect(s.sampleSize).toBe(5);
      expect(s.subgroupCount).toBe(3);
    });

    it('규격 없으면 Cp/Cpk 는 null (0 아님)', () => {
      const s = computeSpcStats([sg(1, 10, 2), sg(2, 12, 4)], { lsl: 8, target: null, usl: null }, 2, 0);
      expect(s.cp).toBeNull();
      expect(s.cpk).toBeNull();
    });

    it('양측 규격이면 Cp=(USL-LSL)/6σ, Cpk=min(상/하)', () => {
      const rows = [sg(1, 10, 2.326), sg(2, 10, 2.326)];
      // R̄=2.326 → σ=1
      const s = computeSpcStats(rows, { lsl: 7, target: 10, usl: 16 }, 2, 0);
      expect(s.sigmaEst).toBeCloseTo(1, 3);
      expect(s.cp).toBeCloseTo(9 / 6, 3);
      expect(s.cpk).toBeCloseTo(3 / 3, 3); // 하한 쪽이 더 가깝다
    });

    it('oocPoints: 관리한계 밖 서브그룹 id', () => {
      const rows = [sg(1, 10, 5), sg(2, 10, 5), sg(3, 10, 5), sg(4, 20, 5)]; // X̄̄=12.5, R̄=5 → 한계 9.615~15.385
      const s = computeSpcStats(rows, { lsl: null, target: null, usl: null }, 4, 0);
      expect(s.oocPoints).toEqual([4]);
    });

    it('서브그룹 크기별 상수: n=3 은 A2=1.023', () => {
      const s = computeSpcStats([sg(1, 10, 1), sg(2, 10, 1)], { lsl: null, target: null, usl: null }, 2, 0, 3);
      expect(s.xbarUCL).toBeCloseTo(11.023, 3);
      expect(s.sampleSize).toBe(3);
    });

    it('지원하지 않는 서브그룹 크기는 예외', () => {
      expect(() => xbarRConstants(11)).toThrow();
    });
  });

  describe('limitSubgroups', () => {
    it('최근 k개만 남기고 id 를 1..k 로 재부여', () => {
      const rows = [sg(1, 1, 1), sg(2, 2, 2), sg(3, 3, 3)];
      const out = limitSubgroups(rows, 2);
      expect(out.map((r) => r.id)).toEqual([1, 2]);
      expect(out.map((r) => r.xbar)).toEqual([2, 3]);
    });
    it('k<=0 또는 k>=n 이면 그대로', () => {
      const rows = [sg(1, 1, 1), sg(2, 2, 2)];
      expect(limitSubgroups(rows, 0)).toBe(rows);
      expect(limitSubgroups(rows, 5)).toBe(rows);
    });
  });
});
