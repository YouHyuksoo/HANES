"use client";

/**
 * @file src/components/layout/LanguageSwitcher.tsx
 * @description 언어 전환 드롭다운 컴포넌트
 *
 * 초보자 가이드:
 * 1. **supportedLanguages**: 지원 언어 목록 (ko, en, zh)
 * 2. **i18n.changeLanguage**: 언어 전환 시 호출
 * 3. **드롭다운**: 클릭 시 언어 목록 표시, 외부 클릭 시 닫힘
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { supportedLanguages } from "@/lib/i18n";

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0];

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-2 rounded-md hover:bg-background transition-colors"
        aria-label={currentLang.name}
      >
        <Globe className="w-5 h-5 text-text-muted" />
        <span className="hidden sm:block text-xs font-medium text-text-muted">
          {currentLang.flag}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="
              absolute right-0 top-full mt-2 z-20
              w-40 py-1
              bg-surface border border-border rounded-[var(--radius)]
              shadow-lg animate-slide-down
            "
          >
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={`
                  w-full px-4 py-2 text-left text-sm
                  flex items-center gap-2
                  transition-colors
                  ${
                    i18n.language === lang.code
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-text hover:bg-background"
                  }
                `}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default LanguageSwitcher;
