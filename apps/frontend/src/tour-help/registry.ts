import type { TourHelpEntry, TourHelpResources } from './types';
export function resolveTourHelp(key: string, language: string, resources: Record<string, TourHelpResources>, fallbackLabel: string, fallbackDescription?: string): TourHelpEntry {
  const entries = [language.split('-')[0], 'ko'].map((lang) => resources[lang]?.[key]).filter(Boolean) as TourHelpEntry[];
  const pick = (field: keyof TourHelpEntry) => entries.map((entry) => entry[field]).find((value) => typeof value === 'string' && value.trim());
  return { title: (pick('title') as string | undefined)?.trim() || fallbackLabel, description: (pick('description') as string | undefined)?.trim() || fallbackDescription || `${fallbackLabel} 항목의 현재 값을 표시합니다.`, usage: (pick('usage') as string | undefined)?.trim() || undefined, warning: (pick('warning') as string | undefined)?.trim() || undefined, related: entries.find((entry) => entry.related?.length)?.related };
}

export function operationalFallback(key: string, label: string, supplied?: string): string {
  if (supplied) return supplied;
  const action: Record<string, string> = {
    저장: '입력한 기준정보를 검증한 뒤 서버에 신규 등록하거나 기존 값을 갱신합니다.',
    검색: '입력한 조회조건으로 기준정보 목록을 다시 조회합니다.',
    조회: '현재 조회조건에 해당하는 기준정보를 불러옵니다.',
    추가: '새 기준정보를 입력할 수 있는 등록 화면을 엽니다. 저장하기 전에는 데이터가 생성되지 않습니다.',
    등록: '입력한 기준정보를 신규 데이터로 저장합니다.',
    수정: '선택한 기준정보를 편집한 뒤 변경 내용을 저장합니다.',
    삭제: '선택한 기준정보를 삭제합니다. 다른 업무에서 참조 중이면 삭제가 거부될 수 있습니다.',
    새로고침: '현재 조건을 유지한 채 서버의 최신 기준정보를 다시 불러옵니다.',
    취소: '현재 입력 중인 변경을 버리고 등록·수정 화면을 닫습니다.',
  };
  if (action[label]) return action[label];
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/master')) {
    if (key.startsWith('common.fields.')) return `${label}은(는) 기준정보를 조회하거나 등록할 때 사용하는 값입니다. 목록을 좁히려면 조회조건으로 입력하고, 등록·수정 시에는 해당 기준값의 형식에 맞게 입력하세요.`;
    return `${label}은(는) 기준정보 목록에서 업무에 사용하는 등록값을 확인하는 항목입니다. 행을 선택하면 상세값을 확인하거나 수정할 수 있습니다.`;
  }
  return `${label} 항목의 현재 값을 확인합니다. 화면에서 제공하는 정렬·필터·입력 규칙에 따라 사용하세요.`;
}
