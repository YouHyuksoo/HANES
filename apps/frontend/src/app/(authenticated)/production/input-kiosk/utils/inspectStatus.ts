/**
 * @file utils/inspectStatus.ts
 * @description 설비점검 완료/종합판정 표시 유틸 — 키오스크/조립/서브조립 공용
 *
 * 배경:
 * - `GET /equipment/daily-inspect/check`는 `alreadyInspected`(기록 존재)와
 *   `inspectPassed`(기록 존재 + 종합판정 PASS)를 구분해 내려준다.
 * - 인터록(작업 진행 가능 여부)은 `inspectPassed` 기준이다.
 *   점검을 완료했어도 종합판정이 불합격이면 진행할 수 없고, 재점검으로 합격이 되어야 풀린다.
 * - 완료 여부만으로는 합격/불합격을 구분할 수 없으므로 배지에 **판정을 항상 함께** 표시한다.
 *     합격: "완료(합격) 14:32"  → HeaderCheckItem doneDetail (초록)
 *     불합격: "완료(불합격) 14:32" → HeaderCheckItem notDoneDetail (빨강, done=false)
 *   불합격을 done=false로 두는 이유: 배지는 초록인데 버튼은 막히는 모순을 만들지 않기 위함.
 *
 * 판정 라벨은 공통코드 i18n `comCode.INSPECT_JUDGE.*`를 단일 출처로 쓴다
 * (화면별 사전을 새로 만들지 않는다).
 */

/** 종합판정이 불합격인지 — PASS만 합격으로 본다(CONDITIONAL·공백도 불합격 취급) */
export function isInspectNg(overallResult?: string | null): boolean {
  if (!overallResult) return false;
  return overallResult.trim().toUpperCase() !== 'PASS';
}

export interface InspectDetailLabels {
  /** '완료' */
  done: string;
  /** 판정코드 → 라벨 변환 (comCode.INSPECT_JUDGE.* 조회) */
  judge: (overallResult: string) => string;
}

/**
 * "완료(합격) 14:32" 형태의 상세 문구를 만든다.
 * 판정이 없으면(=점검 기록 없음) undefined → 호출부가 "완료"/"미완료" 기본 문구로 폴백한다.
 *
 * @param overallResult PASS / FAIL / CONDITIONAL
 * @param inspectedAt   "YYYY-MM-DD HH:mm:ss" (없으면 시각 생략)
 */
export function inspectStatusDetail(
  overallResult: string | null | undefined,
  inspectedAt: string | null | undefined,
  labels: InspectDetailLabels,
): string | undefined {
  if (!overallResult) return undefined;
  const judgeLabel = labels.judge(overallResult.trim().toUpperCase());
  const hhmm = inspectedAt ? (inspectedAt.split(' ')[1] ?? inspectedAt).slice(0, 5) : '';
  return `${labels.done}(${judgeLabel})${hhmm ? ` ${hhmm}` : ''}`;
}
