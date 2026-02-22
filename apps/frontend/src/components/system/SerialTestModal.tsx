/**
 * @file src/components/system/SerialTestModal.tsx
 * @description 시리얼 통신 테스트 터미널 모달
 *
 * 초보자 가이드:
 * 1. **연결**: 브라우저 Web Serial API로 로컬 포트에 직접 연결
 * 2. **수신**: 연결 상태에서 실시간 데이터 표시 (RX = 녹색)
 * 3. **전송**: HEX 입력 후 전송 (TX = 노란색)
 * 4. **해제**: 포트 닫기
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Trash2, Plug, Unplug } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { CommConfig } from "@/hooks/system/useCommConfigData";
import { useSerialTest, type SerialLogEntry } from "@/hooks/system/useSerialTest";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: CommConfig | null;
}

type SendMode = "HEX" | "ASCII";
type LineEnding = "NONE" | "CR" | "LF" | "CRLF";

const LINE_ENDING_MAP: Record<LineEnding, string> = {
  NONE: "",
  CR: "\r",
  LF: "\n",
  CRLF: "\r\n",
};

export default function SerialTestModal({ isOpen, onClose, config }: Props) {
  const { t } = useTranslation();
  const { connected, logs, error, connect, sendHex, sendAscii, disconnect, clearLogs } =
    useSerialTest(config);
  const [sendInput, setSendInput] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("HEX");
  const [lineEnding, setLineEnding] = useState<LineEnding>("NONE");
  const logEndRef = useRef<HTMLDivElement>(null);

  // config의 lineEnding 설정값을 기본값으로 적용
  useEffect(() => {
    if (config?.lineEnding && ["NONE", "CR", "LF", "CRLF"].includes(config.lineEnding)) {
      setLineEnding(config.lineEnding as LineEnding);
    }
  }, [config]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (isOpen) setSendInput("");
  }, [isOpen]);

  const handleClose = useCallback(async () => {
    if (connected) await disconnect();
    clearLogs();
    onClose();
  }, [connected, disconnect, clearLogs, onClose]);

  const handleSend = useCallback(() => {
    if (!sendInput.trim()) return;
    if (sendMode === "HEX") {
      sendHex(sendInput.trim());
    } else {
      sendAscii(sendInput.trim() + LINE_ENDING_MAP[lineEnding]);
    }
    setSendInput("");
  }, [sendInput, sendMode, lineEnding, sendHex, sendAscii]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!config) return null;

  const parityShort = (config.parity || "NONE")[0];
  const infoLabel = `${config.portName || "-"} | ${config.baudRate || 9600}bps | ${config.dataBits || 8}-${parityShort}-${config.stopBits || 1} | Flow: ${config.flowControl || "NONE"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${t("serialTest.title")} - ${config.configName}`}
      size="xl"
    >
      <div className="space-y-3">
        {/* 설정 정보 + 연결 제어 */}
        <div className="flex items-center justify-between bg-surface rounded-[var(--radius)] px-3 py-2">
          <span className="text-xs font-mono text-text">{infoLabel}</span>
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {t("serialTest.connectedStatus")}
                </span>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  <Unplug className="w-3.5 h-3.5 mr-1" />
                  {t("serialTest.disconnectBtn")}
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs text-text-muted">
                  {t("serialTest.disconnectedStatus")}
                </span>
                <Button size="sm" onClick={connect}>
                  <Plug className="w-3.5 h-3.5 mr-1" />
                  {t("serialTest.connectBtn")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-[var(--radius)]">
            {error}
          </div>
        )}

        {/* 터미널 로그 */}
        <div className="bg-gray-950 rounded-[var(--radius)] p-3 h-80 overflow-y-auto font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-gray-600 text-center mt-24">
              {t("serialTest.logEmpty")}
            </p>
          ) : (
            logs.map((log) => <LogLine key={log.id} log={log} />)
          )}
          <div ref={logEndRef} />
        </div>

        {/* 전송 바 */}
        <div className="flex items-center gap-2">
          {/* HEX/ASCII 토글 */}
          <div className="flex shrink-0 rounded-[var(--radius)] border border-border overflow-hidden">
            {(["HEX", "ASCII"] as SendMode[]).map((mode) => (
              <button
                key={mode}
                className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  sendMode === mode
                    ? "bg-primary text-white"
                    : "bg-background text-text-muted hover:bg-surface"
                }`}
                onClick={() => setSendMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          {/* 라인엔딩 (ASCII 모드에서만 표시) */}
          {sendMode === "ASCII" && (
            <select
              className="shrink-0 h-9 px-1.5 text-xs font-mono rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-background text-text"
              value={lineEnding}
              onChange={(e) => setLineEnding(e.target.value as LineEnding)}
            >
              <option value="NONE">No CR/LF</option>
              <option value="CR">CR (\\r)</option>
              <option value="LF">LF (\\n)</option>
              <option value="CRLF">CR+LF</option>
            </select>
          )}
          <input
            className="flex-1 h-9 px-3 text-sm font-mono rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            value={sendInput}
            onChange={(e) => setSendInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sendMode === "HEX"
                ? t("serialTest.sendPlaceholderHex")
                : t("serialTest.sendPlaceholderAscii")
            }
            disabled={!connected}
          />
          <Button
            onClick={handleSend}
            disabled={!connected || !sendInput.trim()}
            className="shrink-0"
          >
            <Send className="w-4 h-4 mr-1" />
            {t("serialTest.sendBtn")}
          </Button>
          <Button variant="outline" onClick={clearLogs} className="shrink-0">
            <Trash2 className="w-4 h-4 mr-1" />
            {t("serialTest.clearBtn")}
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-4 mt-4 border-t border-border">
        <Button variant="secondary" onClick={handleClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

/** 로그 한 줄 표시 (RX=녹색, TX=노란색, SYS=파란색) */
function LogLine({ log }: { log: SerialLogEntry }) {
  const time = new Date(log.timestamp).toLocaleTimeString("ko-KR", {
    hour12: false,
    fractionalSecondDigits: 3,
  });

  const lineColor = {
    RX: "text-green-400",
    TX: "text-yellow-400",
    SYS: "text-blue-400",
  }[log.direction];

  const tagColor = {
    RX: "text-green-500",
    TX: "text-yellow-500",
    SYS: "text-blue-500",
  }[log.direction];

  return (
    <div className={`flex gap-2 py-0.5 ${lineColor}`}>
      <span className="text-gray-500 shrink-0">{time}</span>
      <span className={`shrink-0 w-8 text-center font-bold ${tagColor}`}>
        [{log.direction}]
      </span>
      {log.hex && <span className="break-all">{log.hex}</span>}
      {log.ascii && <span className="text-gray-500 ml-1">| {log.ascii}</span>}
    </div>
  );
}
