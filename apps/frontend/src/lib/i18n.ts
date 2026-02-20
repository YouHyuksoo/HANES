/**
 * @file src/lib/i18n.ts
 * @description i18next 다국어 설정 파일 - 한국어, 영어, 중국어, 베트남어 지원
 *
 * 초보자 가이드:
 * 1. **i18next**: 다국어 지원 라이브러리
 * 2. **react-i18next**: React용 i18next 바인딩
 * 3. **LanguageDetector**: 브라우저 언어 자동 감지
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
import LanguageDetector from "i18next-browser-languagedetector";

import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import vi from "@/locales/vi.json";

/** 지원하는 언어 목록 */
export const supportedLanguages = [
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
] as const;

/** 언어 코드 타입 */
export type LanguageCode = (typeof supportedLanguages)[number]["code"];

/** i18next 리소스 */
const resources = {
  ko: { translation: ko },
  en: { translation: en },
  zh: { translation: zh },
  vi: { translation: vi },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "ko",
    defaultNS: "translation",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
