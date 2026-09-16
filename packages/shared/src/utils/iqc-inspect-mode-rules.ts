/**
 * @file packages/shared/src/utils/iqc-inspect-mode-rules.ts
 * @description IQC 검사 단위 모드(SYS_CONFIGS.IQC_INSPECT_LOT_MODE) 공통 규칙 — 단일 출처.
 *
 * 이 모드는 "수입검사를 어떤 단위로 하는가"를 정한다.
 * - ARRIVAL: 입하번호+품목 단위로 검사한다. 검사의뢰 LOT 구성은 쓰지 않는다.
 * - REQUEST: 검사의뢰 LOT(여러 입하 행을 한 모집단으로 묶은 단위)으로 검사한다.
 *
 * 프론트(의뢰 구성 화면 차단 안내)와 백엔드(의뢰 생성 가드)가 같은 판단을 해야 하므로
 * 키와 판정 함수를 여기 한 곳에 둔다. 양쪽에 조건을 복사하지 말 것.
 */

export const IQC_INSPECT_LOT_MODE_KEY = 'IQC_INSPECT_LOT_MODE';

export const IQC_INSPECT_LOT_MODES = ['ARRIVAL', 'REQUEST'] as const;
export type IqcInspectLotMode = typeof IQC_INSPECT_LOT_MODES[number];

/** 설정 미등록/오타/공백은 기존 동작인 입하단위(ARRIVAL)로 본다. */
export function normalizeIqcInspectLotMode(raw: string | null | undefined): IqcInspectLotMode {
  const value = String(raw ?? '').trim().toUpperCase();
  return value === 'REQUEST' ? 'REQUEST' : 'ARRIVAL';
}

/**
 * 검사의뢰 LOT 구성을 쓸 수 있는 모드인가.
 * ARRIVAL 모드에서 의뢰를 만들면 검사대기 목록에 뜨지 않아 REQUESTED 상태로 영구 잔존한다.
 */
export function allowsIqcRequestLot(raw: string | null | undefined): boolean {
  return normalizeIqcInspectLotMode(raw) === 'REQUEST';
}
