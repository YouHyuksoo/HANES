"use client";

/**
 * @file src/components/layout/LanguageSwitcher.tsx
 * @description 언어 전환은 공용 UI 패키지(@jisheng/ui)로 옮겨졌다.
 * 로그인·PDA 로그인·랜딩처럼 앱 틀 밖에서 쓰는 화면을 위해 HANES 언어 목록을 넘기는 래퍼.
 */
import { LanguageSwitcher as SharedLanguageSwitcher } from "@jisheng/ui";
import { I18N_LANGUAGE_STORAGE_KEY, supportedLanguages } from "@/lib/i18n";

export default function LanguageSwitcher() {
  return <SharedLanguageSwitcher languages={supportedLanguages} storageKey={I18N_LANGUAGE_STORAGE_KEY} />;
}
