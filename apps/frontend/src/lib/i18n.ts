/**
 * @file src/lib/i18n.ts
 * @description i18next 다국어 설정 파일 - 한국어, 영어, 중국어, 베트남어 지원
 *
 * 초보자 가이드:
 * 1. **i18next**: 다국어 지원 라이브러리
 * 2. **react-i18next**: React용 i18next 바인딩
 * 3. **초기 언어**: SSR hydration 일치를 위해 `ko`로 시작 후 클라이언트에서 감지
 *
 * 사용 방법:
 * ```tsx
 * import { useTranslation } from 'react-i18next';
 * const { t } = useTranslation();
 * <span>{t('common.save')}</span>
 * ```
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import vi from "@/locales/vi.json";

export const I18N_LANGUAGE_STORAGE_KEY = "i18nextLng";
export const DEFAULT_LANGUAGE_CODE = "ko";

/** 지원하는 언어 목록 */
export const supportedLanguages = [
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
] as const;

/** 언어 코드 타입 */
export type LanguageCode = (typeof supportedLanguages)[number]["code"];

export function normalizeLanguageCode(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;

  const normalized = value.toLowerCase().split("-")[0];
  return supportedLanguages.some((lang) => lang.code === normalized)
    ? (normalized as LanguageCode)
    : null;
}

/** i18next 리소스 */
const resources = {
  ko: { translation: ko },
  en: { translation: en },
  zh: { translation: zh },
  vi: { translation: vi },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE_CODE,
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    supportedLngs: supportedLanguages.map((lang) => lang.code),
    nonExplicitSupportedLngs: true,
    defaultNS: "translation",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
