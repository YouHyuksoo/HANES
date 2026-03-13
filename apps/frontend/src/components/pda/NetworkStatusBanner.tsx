"use client";

/**
 * @file src/components/pda/NetworkStatusBanner.tsx
 * @description 네트워크 상태 표시 배너 — 오프라인 감지 + 복구 알림
 *
 * 초보자 가이드:
 * 1. **navigator.onLine**: 브라우저의 현재 네트워크 연결 상태 (boolean)
 * 2. **online / offline 이벤트**: 네트워크 상태가 바뀔 때 window에서 발생
 * 3. **오프라인 배너**: 연결 끊기면 빨간 배너를 상단에 고정 표시
 * 4. **온라인 복귀 배너**: 복구되면 초록 배너를 3초간 표시 후 자동 사라짐
 * 5. **처음부터 온라인**: 초기 온라인 상태면 배너 아예 숨김
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff, Wifi } from "lucide-react";

type BannerState = "hidden" | "offline" | "restored";

export default function NetworkStatusBanner() {
  const { t } = useTranslation();
  const [bannerState, setBannerState] = useState<BannerState>("hidden");

  useEffect(() => {
    // 초기 상태가 오프라인인 경우에만 배너 표시
    if (!navigator.onLine) {
      setBannerState("offline");
    }

    const handleOffline = () => {
      setBannerState("offline");
    };

    const handleOnline = () => {
      // 오프라인 상태에서 복구된 경우에만 초록 배너 표시
      setBannerState((prev) => {
        if (prev === "offline") return "restored";
        return "hidden";
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // 복구 배너 → 3초 후 자동 사라짐
  useEffect(() => {
    if (bannerState !== "restored") return;
    const timer = setTimeout(() => {
      setBannerState("hidden");
    }, 3000);
    return () => clearTimeout(timer);
  }, [bannerState]);

  if (bannerState === "hidden") return null;

  const isOffline = bannerState === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "w-full px-4 py-2.5",
        "flex items-center justify-center gap-2",
        "text-white text-sm font-medium",
        "transition-all duration-300",
        isOffline
          ? "bg-red-600 dark:bg-red-700"
          : "bg-green-600 dark:bg-green-700",
      ].join(" ")}
    >
      {isOffline ? (
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <Wifi className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {isOffline
          ? t("pda.network.offline")
          : t("pda.network.online")}
      </span>
    </div>
  );
}
