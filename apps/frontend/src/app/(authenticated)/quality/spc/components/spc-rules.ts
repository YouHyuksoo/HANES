/**
 * @file src/app/(authenticated)/quality/spc/components/spc-rules.ts
 * @description 규칙 위반 목록 → 서브그룹별 플래그(OOC/WARN) 변환. 순수 함수.
 *
 * 초보자 가이드:
 * - 원본: WebDisplay `src/lib/hanes/spc-rules.ts` 의 `flagBySubgroup` 만 가져왔다.
 *   규칙 평가(evaluateSpcRules) 자체는 백엔드가 하고 `violations` 로 내려준다.
 * - R1/RR1 은 관리한계 이탈(OOC)이라 해당 점만, R2~R4 는 패턴이라 구성 점 전부 WARN 으로 칠한다.
 */
import type { SpcPointFlag, SpcRuleCode, SpcRuleViolation } from "../types";

/** 관리한계 이탈 규칙 (점 단위 사건) */
export const OOC_RULES: readonly SpcRuleCode[] = ["R1", "RR1"];

export function isOocRule(rule: SpcRuleCode): boolean {
  return OOC_RULES.includes(rule);
}

export function flagBySubgroup(violations: SpcRuleViolation[]): Map<number, SpcPointFlag> {
  const map = new Map<number, SpcPointFlag>();
  for (const v of violations) {
    const ooc = isOocRule(v.rule);
    const ids = ooc ? [v.subgroupId] : v.members;
    for (const id of ids) {
      const cur = map.get(id);
      if (ooc) map.set(id, "OOC");
      else if (cur !== "OOC") map.set(id, "WARN");
    }
  }
  return map;
}
