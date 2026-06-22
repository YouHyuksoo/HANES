/**
 * @file utils/qty.ts
 * @description 정수 수량 표시/파싱 유틸.
 *
 * `<input type="number">`는 천단위 구분기호(111,000)를 표시하지 못한다.
 * raw `<input>`(커스텀 스타일·DataGrid 셀·키오스크 등)에서 ui Input 래퍼인
 * `QtyInput`을 쓸 수 없을 때, `type="text" inputMode="numeric"`로 바꾸고
 * `value={formatQty(x)} onChange={(e)=>setX(parseQty(e.target.value))}` 형태로 적용한다.
 */

/** 숫자값을 천단위 콤마 문자열로. null/undefined/NaN은 빈 문자열, 0은 "0"으로 보존. */
export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString();
}

/** 입력 문자열에서 숫자만 추출해 정수로. 빈값은 0. */
export function parseQty(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}
