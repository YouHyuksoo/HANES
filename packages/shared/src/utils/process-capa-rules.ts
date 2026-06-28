/**
 * @file packages/shared/src/utils/process-capa-rules.ts
 * @description 공정 CAPA 공통 업무 규칙 (프론트/백엔드 단일 출처)
 *
 * 라운딩 정책은 호출부에 위임한다(현행 동작 보존):
 * - stdUph: 프론트는 정수 반올림, 백엔드는 소수 2자리 반올림.
 * - 폴백(미입력 기본값)도 호출부에서 적용한다(백엔드 balanceEff 미입력 시 85 등).
 */

/** 일 가동시간(시간) */
export const CAPA_WORK_HOURS_PER_DAY = 8;

/** 택트타임(초) 기준 UPH 원시값. 라운딩은 호출부에서 수행한다. */
export function calcStdUphFromTactTime(stdTactTime: number): number {
  return 3600 / stdTactTime;
}

/**
 * 일일 CAPA 산정의 수량 배수.
 * 설비 수 우선, 없으면 작업자 수, 둘 다 0이면 1.
 */
export function capaMultiplier(equipCnt: number, workerCnt: number): number {
  return equipCnt > 0 ? equipCnt : workerCnt > 0 ? workerCnt : 1;
}

export interface DailyCapaInput {
  /** 시간당 생산수량(UPH) */
  stdUph: number;
  /** 설비 수 */
  equipCnt: number;
  /** 작업자 수 */
  workerCnt: number;
  /** 밸런싱 효율(%) — 백분율 값(예: 85) */
  balanceEffPct: number;
}

/**
 * 일 생산능력(dailyCapa) 자동 계산.
 * 산식: UPH x 가동시간(8h) x (설비/작업자 배수) x 밸런싱효율, 내림(Math.floor).
 */
export function calcDailyCapa({ stdUph, equipCnt, workerCnt, balanceEffPct }: DailyCapaInput): number {
  const eff = balanceEffPct / 100;
  const multiplier = capaMultiplier(equipCnt, workerCnt);
  return Math.floor(stdUph * CAPA_WORK_HOURS_PER_DAY * multiplier * eff);
}
