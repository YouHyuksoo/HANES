/**
 * @file src/components/layout/SerialIndicator.tsx
 * @description Header 우측에 표시되는 바코드 스캐너 연결 상태 아이콘
 *
 * 초보자 가이드:
 * 1. 연결 해제 상태 → 회색 USB 아이콘 (클릭 → 포트 선택 → 연결)
 * 2. 연결 상태 → 초록 아이콘 + 펄스 (클릭 → 연결 해제)
 * 3. 마지막 스캔 데이터가 있으면 툴팁으로 표시
 */
"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Usb } from "lucide-react";
import { useSerialStore } from "@/stores/serialStore";

export default function SerialIndicator() {
  const { t } = useTranslation();
  const { connected, lastScanned, error, connect, disconnect, autoConnect } = useSerialStore();
  const triedAutoConnect = useRef(false);

  /* 마운트 시 이전 승인 포트가 있으면 자동 연결 */
  useEffect(() => {
    if (!triedAutoConnect.current) {
      triedAutoConnect.current = true;
      autoConnect();
    }
  }, [autoConnect]);

  /* Web Serial API 미지원 브라우저면 아이콘 숨김 */
  if (typeof navigator === "undefined" || !(navigator as any).serial) {
    return null;
  }

  const handleClick = () => {
    if (connected) {
      disconnect();
    } else {
      connect();
    }
  };

  const tooltip = connected
    ? lastScanned
      ? `${t("serial.connected")} — ${t("serial.lastScan")}: ${lastScanned}`
      : t("serial.connected")
    : error
      ? `${t("serial.disconnected")} — ${error}`
      : t("serial.disconnected");

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-md hover:bg-background transition-colors"
      aria-label={connected ? t("serial.disconnect") : t("serial.connect")}
      title={tooltip}
    >
      <Usb
        className={`w-5 h-5 ${
          connected
            ? "text-green-500 dark:text-green-400"
            : "text-text-muted"
        }`}
      />
      {/* 연결 시 녹색 펄스 인디케이터 */}
      {connected && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}
