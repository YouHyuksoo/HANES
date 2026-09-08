/** 서버의 선택 가능 여부를 유지하면서 현재 재발행 불가 원인을 안내한다. */
export function getReprintHintKey(
  serials: { checkable: boolean; stockInYn: string; cancelYn: string }[],
  loading: boolean,
  selectedCount: number,
): string {
  const prefix = 'material.arrivalResult.reprintReasons.';
  if (loading) return prefix + 'loading';
  if (serials.length === 0) return prefix + 'empty';
  if (serials.some(serial => serial.checkable)) {
    return selectedCount > 0 ? prefix + 'ready' : prefix + 'select';
  }
  const received = serials.some(serial => serial.stockInYn === 'Y');
  const canceled = serials.some(serial => serial.cancelYn === 'Y');
  if (received && canceled) return prefix + 'receivedAndCanceled';
  if (canceled) return prefix + 'canceled';
  if (received) return prefix + 'received';
  return prefix + 'unavailable';
}
