/**
 * @file src/common/utils/csv-list.util.ts
 * @description 쿼리스트링 복수 선택 값(쉼표 구분) 파싱 유틸
 *
 * 초보자 가이드:
 * 1. 프론트 복수 선택 필터는 `?processCode=CUT,CRIMP` 처럼 쉼표로 이어 보낸다.
 * 2. 공백/빈 항목/중복은 제거하고, 값이 없으면 빈 배열을 돌려준다.
 * 3. 서비스에서는 길이 1이면 `=`, 2 이상이면 `IN (:...list)` 로 분기한다.
 */
export function parseCsvList(raw: string | string[] | undefined | null): string[] {
  if (raw === undefined || raw === null) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set<string>();
  for (const part of parts) {
    const v = part.trim();
    if (v) seen.add(v);
  }
  return [...seen];
}
