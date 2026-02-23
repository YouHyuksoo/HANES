"use client";

/**
 * @file src/app/(pda)/settings/page.tsx
 * @description PDA 설정 페이지 - 스캔 딜레이, 사운드, 키보드, 언어, 테마 설정
 *
 * 초보자 가이드:
 * 1. pdaStore: scanDelay(스캔 감지 딜레이), soundEnabled(사운드), keyboardVisible(키보드) 관리
 * 2. themeStore: theme(light/dark/system) 관리
 * 3. i18n.changeLanguage: 인터페이스 언어 변경 (ko/en/zh/vi)
 * 4. 각 설정은 카드 형태로 표시, 변경 시 즉시 반영 (persist 자동 저장)
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import { usePdaStore } from "@/stores/pdaStore";
import { useThemeStore, type Theme } from "@/stores/themeStore";

/** 언어 옵션 */
const LANGUAGE_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "vi", label: "Tiếng Việt" },
] as const;

/** 테마 옵션 */
const THEME_OPTIONS: { value: Theme; labelKey: string; icon: typeof Sun }[] = [
  { value: "light", labelKey: "pda.settings.themeLight", icon: Sun },
  { value: "dark", labelKey: "pda.settings.themeDark", icon: Moon },
  { value: "system", labelKey: "pda.settings.themeSystem", icon: Monitor },
];

export default function PdaSettingsPage() {
  const { t, i18n } = useTranslation();

  // PDA 스토어
  const { scanDelay, soundEnabled, keyboardVisible, setScanDelay, setSoundEnabled, setKeyboardVisible } =
    usePdaStore();

  // 테마 스토어
  const { theme, setTheme } = useThemeStore();

  /** 스캔 딜레이 변경 (50~200ms) */
  const handleDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(200, Math.max(50, Number(e.target.value)));
      setScanDelay(value);
    },
    [setScanDelay],
  );

  /** 언어 변경 */
  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      i18n.changeLanguage(e.target.value);
    },
    [i18n],
  );

  return (
    <>
      <PdaHeader titleKey="pda.settings.title" backPath="/pda/menu" />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 1. 스캔 감지 딜레이 */}
        <SettingCard
          title={t("pda.settings.scanDelay")}
          description={t("pda.settings.scanDelayDesc")}
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={scanDelay}
              onChange={handleDelayChange}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-600 accent-primary"
            />
            <span className="min-w-[3.5rem] text-right text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
              {scanDelay}{t("pda.settings.scanDelayUnit")}
            </span>
          </div>
        </SettingCard>

        {/* 2. 사운드 피드백 */}
        <SettingCard
          title={t("pda.settings.soundEnabled")}
          description={t("pda.settings.soundEnabledDesc")}
        >
          <ToggleSwitch
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />
        </SettingCard>

        {/* 3. 키보드 모드 */}
        <SettingCard
          title={t("pda.settings.keyboardMode")}
          description={t("pda.settings.keyboardModeDesc")}
        >
          <ToggleSwitch
            checked={keyboardVisible}
            onChange={setKeyboardVisible}
          />
        </SettingCard>

        {/* 4. 언어 설정 */}
        <SettingCard
          title={t("pda.settings.language")}
          description={t("pda.settings.languageDesc")}
        >
          <select
            value={i18n.language}
            onChange={handleLanguageChange}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingCard>

        {/* 5. 테마 */}
        <SettingCard
          title={t("pda.settings.theme")}
          description={t("pda.settings.themeDesc")}
        >
          <div className="flex gap-1.5">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </SettingCard>

        {/* 6. 버전 정보 */}
        <SettingCard
          title={t("pda.settings.version")}
          description={t("pda.settings.versionDesc")}
        >
          <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
            HARNESS MES PDA v1.0
          </span>
        </SettingCard>
      </div>
    </>
  );
}

/** 설정 카드 컴포넌트 */
function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2.5">
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-end">{children}</div>
    </div>
  );
}

/** 토글 스위치 컴포넌트 */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
