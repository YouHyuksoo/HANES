/**
 * @file src/modules/quality/defects/defect-log-key.ts
 * @description 불량 로그의 화면 식별자(`발생시각ISO|순번`)를 조회 키로 바꾸는 공용 함수.
 *
 * 초보자 가이드:
 * - 화면 id 는 발생 시각(UTC ISO, 밀리초)과 순번을 `|` 로 이은 문자열이다. 재작업 지시의 연결 불량(defectLogId)도 같은 모양이다.
 * - 발생 시각은 [시각, 시각+1ms) 밀리초 범위로 찾는다
 *   (생산실적이 만든 불량은 시각이 마이크로초라 같음 비교로는 찾지 못하기 때문).
 */

/** 서버 로컬 기준 'YYYY-MM-DD HH24:MI:SS.FF3' (발생 시각 표기 형식) */
export function formatServerTs(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}`;
}

export interface DefectKey {
  /** 발생 시각(서버 로컬, 밀리초). 레거시 순번 단독 id 면 null */
  occurAt: string | null;
  seq: number;
  /** 화면 식별자(재작업 연결 확인·수리 이력 키로 쓴다) */
  logId: string;
  /** 저장용 식별자: 시각 표기를 밀리초 ISO(UTC)로 맞춘 `발생시각ISO|순번`. 순번 단독 id 면 그대로 */
  canonicalId: string;
}

/** 화면 식별자(`occurAtISO|seq`) 또는 레거시 seq 단독 값을 키로 푼다. 형식이 틀리면 null */
export function parseDefectLogId(id: string): DefectKey | null {
  if (id.includes('|')) {
    const sep = id.lastIndexOf('|');
    const date = new Date(id.slice(0, sep));
    const seq = Number(id.slice(sep + 1));
    if (Number.isNaN(date.getTime()) || !Number.isInteger(seq)) return null;
    return { occurAt: formatServerTs(date), seq, logId: id, canonicalId: `${date.toISOString()}|${seq}` };
  }
  const seq = Number(id);
  if (!Number.isInteger(seq)) return null;
  return { occurAt: null, seq, logId: id, canonicalId: id };
}
