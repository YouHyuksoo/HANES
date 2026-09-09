import type { TourHelpEntry, TourHelpResources } from './types';
export function resolveTourHelp(key: string, language: string, resources: Record<string, TourHelpResources>, fallbackLabel: string, fallbackDescription?: string): TourHelpEntry {
  const entries = [language.split('-')[0], 'ko'].map((lang) => resources[lang]?.[key]).filter(Boolean) as TourHelpEntry[];
  const pick = (field: keyof TourHelpEntry) => entries.map((entry) => entry[field]).find((value) => typeof value === 'string' && value.trim());
  return { title: (pick('title') as string | undefined)?.trim() || fallbackLabel, description: (pick('description') as string | undefined)?.trim() || fallbackDescription || `${fallbackLabel} 항목의 현재 값을 표시합니다.`, usage: (pick('usage') as string | undefined)?.trim() || undefined, warning: (pick('warning') as string | undefined)?.trim() || undefined, related: entries.find((entry) => entry.related?.length)?.related };
}
