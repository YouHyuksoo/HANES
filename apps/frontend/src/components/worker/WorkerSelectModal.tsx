/**
 * @file src/components/worker/WorkerSelectModal.tsx
 * @description 작업자 선택 모달 (터치스크린 최적화)
 *
 * 초보자 가이드:
 * 1. **터치 최적화**: 모든 터치 타겟 최소 48px, 큰 글꼴/아이콘
 * 2. **2단계 플로우**: 바코드 스캔 or 작업자 목록 선택 → 사진 확인 → 완료
 * 3. **전체 목록 표시**: 드롭다운 대신 스크롤 리스트로 작업자 전체 표시
 */
"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, ArrowLeft, UserCheck, Search, ScanLine, X } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { mockWorkers, WorkerAvatar } from "./WorkerSelector";
import type { Worker } from "./WorkerSelector";

/** 부서별 배경색 (터치 리스트용) */
const deptBadgeColors: Record<string, string> = {
  절단팀: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  압착팀: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  조립팀: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  품질팀: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  포장팀: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

interface WorkerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (worker: Worker) => void;
}

function WorkerSelectModal({ isOpen, onClose, onConfirm }: WorkerSelectModalProps) {
  const { t } = useTranslation();
  const [tempWorker, setTempWorker] = useState<Worker | null>(null);
  const [mode, setMode] = useState<"search" | "qr">("search");
  const [searchText, setSearchText] = useState("");
  const [qrText, setQrText] = useState("");
  const qrRef = useRef<HTMLInputElement>(null);

  /** 모달 열릴 때 상태 초기화 */
  useEffect(() => {
    if (isOpen) {
      setTempWorker(null);
      setSearchText("");
      setQrText("");
      setMode("search");
    }
  }, [isOpen]);

  /** QR 모드 전환 시 자동 포커스 */
  useEffect(() => {
    if (mode === "qr" && isOpen) {
      setTimeout(() => qrRef.current?.focus(), 100);
    }
  }, [mode, isOpen]);

  /** 검색 필터링 - 빈 검색어면 전체 표시 */
  const filteredWorkers = useMemo(() => {
    if (!searchText.trim()) return mockWorkers;
    const s = searchText.toLowerCase();
    return mockWorkers.filter(
      (w) => w.workerName.toLowerCase().includes(s) || w.workerCode.toLowerCase().includes(s)
    );
  }, [searchText]);

  /** QR 입력 → Enter → 자동 매칭 */
  const handleQrSubmit = useCallback(() => {
    if (!qrText.trim()) return;
    const matched = mockWorkers.find((w) => w.qrCode === qrText.trim());
    if (matched) setTempWorker(matched);
    setQrText("");
  }, [qrText]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!tempWorker) return;
    onConfirm(tempWorker);
  }, [tempWorker, onConfirm]);

  const handleBack = useCallback(() => {
    setTempWorker(null);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("production.inputManual.workerSelectTitle")}
      size="lg"
    >
      {!tempWorker ? (
        /* ── Step 1: 검색/스캔 ── */
        <div className="space-y-4">
          {/* 모드 전환 탭 - 큰 터치 타겟 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("search")}
              className={`flex items-center justify-center gap-2 py-4 rounded-xl text-base font-semibold transition-all
                ${mode === "search"
                  ? "bg-primary text-white shadow-md"
                  : "bg-background text-text-muted border border-border active:bg-surface"
                }`}
            >
              <Search className="w-5 h-5" />
              {t("production.result.workerSelect")}
            </button>
            <button
              onClick={() => setMode("qr")}
              className={`flex items-center justify-center gap-2 py-4 rounded-xl text-base font-semibold transition-all
                ${mode === "qr"
                  ? "bg-primary text-white shadow-md"
                  : "bg-background text-text-muted border border-border active:bg-surface"
                }`}
            >
              <ScanLine className="w-5 h-5" />
              {t("production.result.qrScan")}
            </button>
          </div>

          {mode === "search" ? (
            <>
              {/* 검색 입력 - 큰 입력창 */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t("production.result.workerSearchPlaceholder")}
                  className="w-full pl-12 pr-10 py-4 text-base border-2 border-border rounded-xl bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {searchText && (
                  <button
                    onClick={() => setSearchText("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-background active:bg-border"
                  >
                    <X className="w-5 h-5 text-text-muted" />
                  </button>
                )}
              </div>

              {/* 작업자 리스트 - 큰 터치 아이템 */}
              <div className="max-h-[40vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
                {filteredWorkers.length > 0 ? (
                  filteredWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onClick={() => setTempWorker(worker)}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-border bg-surface hover:bg-background active:bg-primary/10 active:border-primary/30 transition-colors text-left"
                    >
                      {/* 아바타 - 큰 사이즈 */}
                      {worker.photoUrl ? (
                        <img src={worker.photoUrl} alt={worker.workerName} className="w-12 h-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-lg font-bold text-primary">{worker.workerName.charAt(0)}</span>
                        </div>
                      )}
                      {/* 이름 + 코드 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold text-text">{worker.workerName}</div>
                        <div className="text-sm text-text-muted mt-0.5">{worker.workerCode}</div>
                      </div>
                      {/* 부서 뱃지 */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${deptBadgeColors[worker.dept] ?? "bg-gray-100 text-gray-700"}`}>
                        {worker.dept}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                    <Search className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-base">{t("production.inputManual.noWorkerFound")}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* QR/바코드 스캔 모드 */
            <div className="flex flex-col items-center space-y-6 py-6">
              {/* 스캔 아이콘 */}
              <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ScanLine className="w-12 h-12 text-primary" />
              </div>
              <p className="text-base text-text-muted text-center">{t("production.inputManual.scanInstruction")}</p>
              {/* 바코드 입력창 */}
              <div className="relative w-full">
                <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  ref={qrRef}
                  type="text"
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleQrSubmit(); }}
                  placeholder={t("production.result.qrPlaceholder")}
                  className="w-full pl-12 pr-4 py-4 text-lg text-center border-2 border-primary/30 rounded-xl bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoComplete="off"
                />
              </div>
              {/* 수동 확인 버튼 */}
              <Button onClick={handleQrSubmit} className="w-full py-4 text-base" disabled={!qrText.trim()}>
                <CheckCircle className="w-5 h-5 mr-2" />
                {t("production.inputManual.workerConfirm")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ── Step 2: 사진 확인 ── */
        <div className="flex flex-col items-center py-8 space-y-6">
          {/* 큰 사진/아바타 */}
          <div className="relative">
            {tempWorker.photoUrl ? (
              <img
                src={tempWorker.photoUrl}
                alt={tempWorker.workerName}
                className="w-36 h-36 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />
            ) : (
              <div className="w-36 h-36 rounded-full bg-primary/10 border-4 border-primary/20 shadow-lg flex items-center justify-center">
                <span className="text-5xl font-bold text-primary">
                  {tempWorker.workerName.charAt(0)}
                </span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-3 border-white dark:border-gray-800 shadow-md">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* 작업자 정보 */}
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-text">{tempWorker.workerName}</h3>
            <p className="text-base text-text-muted">{tempWorker.workerCode}</p>
            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${deptBadgeColors[tempWorker.dept] ?? "bg-gray-100 text-gray-700"}`}>
              {tempWorker.dept}
            </span>
          </div>

          {/* 확인 메시지 */}
          <p className="text-base text-text-muted text-center">
            {t("production.inputManual.workerConfirmMsg")}
          </p>

          {/* 큰 버튼 */}
          <div className="flex gap-3 w-full pt-2">
            <Button variant="secondary" onClick={handleBack} className="flex-1 py-4 text-base">
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t("production.inputManual.workerReselect")}
            </Button>
            <Button onClick={handleConfirm} className="flex-1 py-4 text-base">
              <CheckCircle className="w-5 h-5 mr-2" />
              {t("production.inputManual.workerConfirm")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default WorkerSelectModal;
