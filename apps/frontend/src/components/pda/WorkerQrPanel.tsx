"use client";

/**
 * @file src/components/pda/WorkerQrPanel.tsx
 * @description PDA 작업자 QR 전환 드롭다운 패널
 *
 * 초보자 가이드:
 * 1. QrCode 버튼 클릭 시 열리는 드롭다운
 * 2. ScanInput으로 작업자 QR 스캔
 * 3. GET /api/v1/master/workers/by-qr/{qrCode} 호출
 * 4. 성공 → authStore.setCurrentWorker 호출 + 성공 메시지
 * 5. 실패 → 에러 메시지 표시
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { QrCode, CheckCircle, XCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import ScanInput from "@/components/pda/ScanInput";

/** 작업자 QR 조회 API 응답 타입 */
interface WorkerByQrResponse {
  id: number;
  name: string;
  workerCode: string;
}

/** 전환 상태 */
type SwitchStatus = "idle" | "loading" | "success" | "error";

export default function WorkerQrPanel() {
  const { t } = useTranslation();
  const { setCurrentWorker } = useAuthStore();
  const { playSuccess, playError } = useSoundFeedback();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SwitchStatus>("idle");
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  /** 외부 클릭 시 닫기 */
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setStatus("idle");
        setMessage("");
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const handleScan = useCallback(
    async (qrCode: string) => {
      if (!qrCode.trim()) return;
      setStatus("loading");
      setMessage("");
      try {
        const res = await api.get<WorkerByQrResponse>(
          `/master/workers/by-qr/${encodeURIComponent(qrCode.trim())}`
        );
        const w = res.data;
        setCurrentWorker({ id: w.id, name: w.name, workerCode: w.workerCode });
        playSuccess();
        setStatus("success");
        setMessage(`${w.name} ${t("pda.worker.switched")}`);
        setTimeout(() => {
          setOpen(false);
          setStatus("idle");
          setMessage("");
        }, 1500);
      } catch {
        playError();
        setStatus("error");
        setMessage(t("common.error"));
      }
    },
    [setCurrentWorker, playSuccess, playError, t]
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((v) => !v); setStatus("idle"); setMessage(""); }}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors"
        aria-label={t("pda.worker.switch")}
      >
        <QrCode className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("pda.worker.switch")}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {t("pda.worker.scanQr")}
            </p>
          </div>

          <ScanInput
            onScan={handleScan}
            placeholderKey="pda.worker.scanQr"
            isLoading={status === "loading"}
            disabled={status === "loading" || status === "success"}
          />

          {message && (
            <div
              className={`flex items-center gap-2 px-4 pb-3 text-sm font-medium ${
                status === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {status === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
