/**
 * @file src/components/layout/PrintAgentIndicator.tsx
 * @description Header 우측 라벨 프린트 에이전트 연결 상태 + 다운로드/설정 드롭다운
 *
 * 동작:
 * 1. 프린터 아이콘 — 연결 시 녹색, 미연결 시 회색
 * 2. 마운트 시 1회 + 드롭다운 열 때마다 /health로 연결 상태 확인(폴링 없음 → 콘솔 노이즈 최소화)
 * 3. 미연결: 다운로드 버튼 + 실행 3단계 안내 + [상태 다시 확인]
 *    (브라우저는 exe 자동 실행이 불가하므로 사용자가 1회 직접 실행해야 한다)
 * 4. 연결: 에이전트 설정 화면 열기 + [상태 다시 확인]
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer, Download, RefreshCw, Settings } from "lucide-react";
import {
  checkPrintAgent,
  PRINT_AGENT_BASE_URL,
  PRINT_AGENT_DOWNLOAD_URL,
} from "@/services/print-agent";

type AgentStatus = "checking" | "connected" | "disconnected";

export default function PrintAgentIndicator() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus>("checking");
  const checkedOnce = useRef(false);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const health = await checkPrintAgent();
      setStatus(health?.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    if (!checkedOnce.current) {
      checkedOnce.current = true;
      check();
    }
  }, [check]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) check(); // 열 때 최신 상태 재확인
      return next;
    });
  };

  const connected = status === "connected";
  const statusLabel = connected
    ? t("printAgent.connected", "연결됨")
    : status === "checking"
      ? t("printAgent.checking", "확인 중…")
      : t("printAgent.disconnected", "연결 안 됨");

  return (
    <div className="relative">
      {/* 트리거 아이콘 */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-md hover:bg-background transition-colors"
        aria-label={t("printAgent.title", "라벨 프린트 에이전트")}
        title={`${t("printAgent.title", "라벨 프린트 에이전트")} · ${statusLabel}`}
      >
        <Printer
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
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-surface border border-border rounded-[var(--radius)] shadow-lg animate-slide-down">
            {/* 연결 상태 헤더 */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    connected
                      ? "bg-green-500"
                      : status === "checking"
                        ? "bg-amber-400"
                        : "bg-gray-400"
                  }`}
                />
                <span className="text-sm font-medium text-text">{statusLabel}</span>
              </div>
              <p className="text-xs text-text-muted mt-1 font-mono">{PRINT_AGENT_BASE_URL}</p>
            </div>

            {connected ? (
              /* 연결됨 — 설정 열기 + 재확인 */
              <div className="py-1">
                <a
                  href={`${PRINT_AGENT_BASE_URL}/settings`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full px-4 py-2 text-left text-sm text-text hover:bg-background flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {t("printAgent.openSettings", "에이전트 설정 열기")}
                </a>
                <button
                  onClick={check}
                  className="w-full px-4 py-2 text-left text-sm text-text hover:bg-background flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("printAgent.recheck", "상태 다시 확인")}
                </button>
              </div>
            ) : (
              /* 미연결 — 안내 + 다운로드 + 재확인 */
              <>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-text-muted leading-relaxed">
                    {t(
                      "printAgent.guide",
                      "라벨을 출력하려면 이 PC에서 Print Agent가 실행 중이어야 합니다. 아래에서 내려받아 실행한 뒤 [상태 다시 확인]을 누르세요.",
                    )}
                  </p>
                  <ol className="mt-2 text-xs text-text-muted list-decimal list-inside space-y-0.5">
                    <li>{t("printAgent.step1", "설치 파일 다운로드")}</li>
                    <li>{t("printAgent.step2", "받은 파일 실행 (트레이에 상주)")}</li>
                    <li>{t("printAgent.step3", "[상태 다시 확인] 클릭")}</li>
                  </ol>
                </div>
                <div className="py-1">
                  <a
                    href={PRINT_AGENT_DOWNLOAD_URL}
                    download
                    className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-background flex items-center gap-2 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    {t("printAgent.download", "Print Agent 다운로드")}
                  </a>
                  <button
                    onClick={check}
                    className="w-full px-4 py-2 text-left text-sm text-text hover:bg-background flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("printAgent.recheck", "상태 다시 확인")}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
