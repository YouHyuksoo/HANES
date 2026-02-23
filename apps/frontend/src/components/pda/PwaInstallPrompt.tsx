"use client";

/**
 * @file src/components/pda/PwaInstallPrompt.tsx
 * @description PWA 설치 유도 배너 - "홈 화면에 추가" 프롬프트
 *
 * 초보자 가이드:
 * 1. **beforeinstallprompt**: 브라우저가 PWA 설치 가능할 때 발생하는 이벤트
 * 2. **display-mode: standalone**: 이미 PWA로 실행 중이면 배너 숨김
 * 3. **24시간 재표시 방지**: 닫기 후 24시간 내 재표시 안 함 (localStorage)
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";

export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div className="mx-4 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
      <Download className="w-5 h-5 text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {t("pda.pwa.installTitle")}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
          {t("pda.pwa.installDesc")}
        </p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors"
      >
        {t("pda.pwa.install")}
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 text-blue-400 hover:text-blue-600 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
