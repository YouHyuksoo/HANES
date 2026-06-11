"use client";

/**
 * @file src/app/pda/material/receiving/components.tsx
 * @description 자재입고 페이지 전용 하위 컴포넌트 — 입고 이력 / 작업자 바 / 에러 다이얼로그
 */
import { useTranslation } from "react-i18next";
import { AlertTriangle, UserCheck, UserPlus, X } from "lucide-react";
import ScanInput from "@/components/pda/ScanInput";
import type { ReceivingHistoryItem } from "@/hooks/pda/useMatReceivingScan";
import type { CurrentWorker } from "@/stores/authStore";

/** 입고 이력 한 행 */
export function ReceivingHistoryRow({ item }: { item: ReceivingHistoryItem }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {item.itemCode}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.itemName}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
          {item.matUid}
        </p>
        {item.workerName && (
          <p className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1 mt-0.5">
            <UserCheck className="w-3 h-3" />
            {item.workerName}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {item.receivedQty}
        </p>
        <p className="text-xs text-slate-400">{item.timestamp}</p>
      </div>
    </div>
  );
}

/** 작업자 스캔/등록 바 — 현재 작업자 표시 + 게이트형 QR 스캔 */
export function WorkerBar({
  worker,
  open,
  onToggle,
  onScan,
  isLoading,
  error,
}: {
  worker: CurrentWorker | null;
  open: boolean;
  onToggle: () => void;
  onScan: (qr: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-4 mt-3">
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 ${
          worker
            ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20"
            : "border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/20"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {worker ? (
            <UserCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <UserPlus className="w-5 h-5 text-amber-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            {worker ? (
              <>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {worker.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  {worker.workerCode}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {t("pda.receiving.workerRequired", "작업자를 먼저 스캔해 주세요")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            open
              ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {open
            ? t("common.cancel", "취소")
            : worker
              ? t("pda.receiving.changeWorker", "작업자 변경")
              : t("pda.receiving.scanWorker", "작업자 스캔")}
        </button>
      </div>

      {open && (
        <div className="mt-2">
          <ScanInput
            onScan={onScan}
            placeholderKey="pda.worker.scanQr"
            isLoading={isLoading}
            disabled={isLoading}
          />
          {error && (
            <p className="mt-1 px-1 text-xs font-medium text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** PDA 에러 다이얼로그 — 사용자용 메시지 표시, 닫으면 입고창 클리어 */
export function PdaErrorDialog({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open || !message) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {t("pda.receiving.cannotReceive", "입고할 수 없습니다")}
          </p>
        </div>
        <div className="px-4 py-5">
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">
            {message}
          </p>
        </div>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-base font-bold hover:bg-primary/90 active:bg-primary/80 transition-colors"
          >
            <X className="w-5 h-5" />
            {t("common.close", "닫기")}
          </button>
        </div>
      </div>
    </div>
  );
}
