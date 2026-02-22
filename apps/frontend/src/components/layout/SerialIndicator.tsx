/**
 * @file src/components/layout/SerialIndicator.tsx
 * @description Header 우측 바코드 스캐너 연결 상태 + 설정 선택 드롭다운
 *
 * 초보자 가이드:
 * 1. USB 아이콘 클릭 → 드롭다운 메뉴 열림
 * 2. DB에 등록된 SERIAL 설정 목록에서 선택 (PC별 localStorage 저장)
 * 3. 연결/해제/재접속 버튼 제공
 * 4. 현재 프로토콜 설정(baudRate) 표시
 * 5. 마지막 스캔 데이터 표시
 * 6. 마운트 시 이전 승인 포트 자동 연결 시도
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Usb, Plug, Unplug, RefreshCw, Barcode, ChevronDown } from "lucide-react";
import { useSerialStore } from "@/stores/serialStore";

export default function SerialIndicator() {
  const { t } = useTranslation();
  const {
    connected, lastScanned, error, protocol,
    configs, selectedConfigId,
    connect, disconnect, reconnect, autoConnect,
    fetchConfigs, setSelectedConfig,
  } = useSerialStore();
  const triedAutoConnect = useRef(false);
  const [open, setOpen] = useState(false);

  /* 마운트 시 설정 목록 로드 + 자동 연결 */
  useEffect(() => {
    if (!triedAutoConnect.current) {
      triedAutoConnect.current = true;
      fetchConfigs().then(() => autoConnect());
    }
  }, [fetchConfigs, autoConnect]);

  /* Web Serial API 미지원 브라우저면 아이콘 숨김 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof navigator === "undefined" || !(navigator as any).serial) {
    return null;
  }

  const handleConnect = () => { connect(); setOpen(false); };
  const handleDisconnect = () => { disconnect(); setOpen(false); };
  const handleReconnect = () => { reconnect(); setOpen(false); };

  /** 선택된 설정 이름 */
  const selectedConfig = configs.find((c) => c.id === selectedConfigId);

  return (
    <div className="relative">
      {/* 트리거 아이콘 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-background transition-colors"
        aria-label={t("serial.connect")}
      >
        <Usb
          className={`w-5 h-5 ${
            connected ? "text-green-500 dark:text-green-400" : "text-text-muted"
          }`}
        />
        {connected && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-surface border border-border rounded-[var(--radius)] shadow-lg animate-slide-down">
            {/* 연결 상태 헤더 */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-sm font-medium text-text">
                  {connected ? t("serial.connected") : t("serial.disconnected")}
                </span>
              </div>
              {connected && protocol && (
                <p className="text-xs text-text-muted mt-1">
                  {selectedConfig?.configName && (
                    <span className="font-medium">{selectedConfig.configName} &middot; </span>
                  )}
                  {protocol.baudRate} bps / {protocol.dataBits}-{protocol.parity === "none" ? "N" : protocol.parity[0].toUpperCase()}-{protocol.stopBits}
                </p>
              )}
            </div>

            {/* 설정 선택 (미연결 상태에서만) */}
            {!connected && (
              <div className="px-4 py-3 border-b border-border">
                <label className="text-xs font-medium text-text-muted mb-1.5 block">
                  {t("serial.selectConfig")}
                </label>
                {configs.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedConfigId || ""}
                      onChange={(e) => setSelectedConfig(e.target.value)}
                      className="w-full appearance-none bg-background border border-border rounded-md px-3 py-1.5 pr-8 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {configs.map((cfg) => (
                        <option key={cfg.id} value={cfg.id}>
                          {cfg.configName} ({cfg.baudRate} bps)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    {t("serial.noConfig")}
                    <br />
                    <span className="text-text-muted/70">{t("serial.defaultConfig")}</span>
                  </p>
                )}
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="py-1">
              {connected ? (
                <>
                  <button
                    onClick={handleReconnect}
                    className="w-full px-4 py-2 text-left text-sm text-text hover:bg-background flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("serial.reconnect")}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="w-full px-4 py-2 text-left text-sm text-error hover:bg-background flex items-center gap-2"
                  >
                    <Unplug className="w-4 h-4" />
                    {t("serial.disconnect")}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  className="w-full px-4 py-2 text-left text-sm text-text hover:bg-background flex items-center gap-2"
                >
                  <Plug className="w-4 h-4" />
                  {t("serial.connect")}
                </button>
              )}
            </div>

            {/* 에러 표시 */}
            {error && (
              <div className="px-4 py-2 border-t border-border">
                <p className="text-xs text-error">{error}</p>
              </div>
            )}

            {/* 마지막 스캔 표시 */}
            {lastScanned && (
              <div className="px-4 py-2 border-t border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <Barcode className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs text-text-muted">{t("serial.lastScan")}</span>
                </div>
                <p className="text-xs font-mono text-text bg-background px-2 py-1 rounded truncate">
                  {lastScanned}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
