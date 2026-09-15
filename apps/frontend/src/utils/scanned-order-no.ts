/**
 * @file utils/scanned-order-no.ts
 * @description 스캔 입력에서 작업지시번호를 뽑아낸다.
 *
 * 초보자 가이드:
 * 1. 작업지시서 QR 은 작업지시번호 자체를 담는다(키오스크 스캔칸에 그대로 들어가야 하므로).
 * 2. 그런데 예전에 출력된 지시서의 QR 은 조회 URL(`…/production/order?orderNo=WO…`)이라
 *    그대로 찍으면 주소 전체가 입력돼 조회에 실패했다. 현장에 이미 뿌려진 출력물이 있으므로
 *    URL 이 들어와도 번호를 뽑아 준다.
 * 3. 그 외 입력은 공백만 정리해 그대로 돌려준다 — 임의 가공은 하지 않는다.
 */
export function normalizeScannedOrderNo(raw: string): string {
  const trimmed = raw.replace(/\r?\n|\r/g, '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const fromQuery = new URL(trimmed).searchParams.get('orderNo');
    return fromQuery?.trim() || trimmed;
  } catch {
    // URL 로 안 읽히면 원문을 그대로 넘겨 기존 동작(조회 실패 메시지)을 유지한다
    return trimmed;
  }
}
