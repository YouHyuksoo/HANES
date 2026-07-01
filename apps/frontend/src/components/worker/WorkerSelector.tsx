/**
 * @file src/components/worker/WorkerSelector.tsx
 * @description 작업자 선택 공통 컴포넌트 - 텍스트 검색 + QR 스캔 입력 (실 API 연동)
 *
 * 초보자 가이드:
 * 1. **작업자 검색**: 이름/코드로 텍스트 검색 → 드롭다운 결과
 * 2. **QR 스캔**: 바코드 스캐너로 qrCode 입력 → Enter → 자동 매칭
 * 3. **아바타**: 이름 첫 글자 이니셜 + 부서별 배경색 표시
 */
"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Search, ScanLine, X } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import api from "@/services/api";
import { getWorkerDisplayName, getWorkerInitial } from "./workerAvatar";

/** 작업자 인터페이스 */
export interface Worker {
  id: string;
  workerCode: string;
  workerName: string;
  dept: string;
  qrCode?: string;
  photoUrl?: string | null;
}

interface WorkerSelectorProps {
  value: Worker | null;
  onChange: (worker: Worker | null) => void;
  label?: string;
}

/** 부서별 아바타 배경색 */
const deptColors: Record<string, string> = {
  생산1팀: "bg-orange-500",
  생산2팀: "bg-blue-500",
  품질팀: "bg-purple-500",
  절단팀: "bg-orange-500",
  압착팀: "bg-blue-500",
  조립팀: "bg-green-500",
  포장팀: "bg-teal-500",
};

/** 이니셜 아바타 컴포넌트 (사진 있으면 사진 표시) */
export function WorkerAvatar({ name, dept, photoUrl, size = "md" }: { name?: string | null; dept?: string | null; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  const displayName = getWorkerDisplayName(name);
  // 사진 로드 실패 시 이니셜 아바타로 fallback
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => { setPhotoError(false); }, [photoUrl]);

  if (photoUrl && !photoError) {
    return (
      <img src={photoUrl} alt={displayName} onError={() => setPhotoError(true)} className={`${sizeClass} rounded-full object-cover shrink-0`} />
    );
  }

  const initial = getWorkerInitial(name);
  const bgColor = dept ? deptColors[dept] || "bg-gray-500" : "bg-gray-500";
  return (
    <span className={`${sizeClass} ${bgColor} text-white rounded-full inline-flex items-center justify-center font-bold shrink-0`}>
      {initial}
    </span>
  );
}

/** 작업자 사진 — 사진 없음/로드 실패 시 fallback(이니셜 등)으로 대체. 커스텀 스타일이 필요한 곳에서 사용 */
export function WorkerPhoto({ src, alt, className, fallback }: { src?: string | null; alt: string; className: string; fallback: ReactNode }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);
  if (!src || errored) return <>{fallback}</>;
  return <img src={src} alt={alt} onError={() => setErrored(true)} className={className} />;
}

function WorkerSelector({ value, onChange, label }: WorkerSelectorProps) {
  const { t } = useTranslation();
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [searchText, setSearchText] = useState("");
  const [qrText, setQrText] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "qr">("search");
  const searchRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/master/workers', { params: { limit: 500, useYn: 'Y' } })
      .then(res => {
        setAllWorkers((res.data?.data ?? []).map((w: Record<string, unknown>) => ({
          id: w.workerCode as string,
          workerCode: w.workerCode as string,
          workerName: w.workerName as string,
          dept: (w.dept ?? '') as string,
          qrCode: w.qrCode as string | undefined,
          photoUrl: (w.photoUrl ?? null) as string | null,
        })));
      })
      .catch(() => {});
  }, []);

  /** 검색 필터링된 작업자 목록 */
  const filteredWorkers = searchText
    ? allWorkers.filter(
        (w) =>
          w.workerName.toLowerCase().includes(searchText.toLowerCase()) ||
          w.workerCode.toLowerCase().includes(searchText.toLowerCase())
      )
    : [];

  /** 작업자 선택 핸들러 */
  const handleSelect = (worker: Worker) => {
    onChange(worker);
    setSearchText("");
    setIsDropdownOpen(false);
  };

  /** QR 입력 → Enter → 자동 매칭 */
  const handleQrSubmit = (rawQrText?: string) => {
    const qrCode = (rawQrText ?? qrText).replace(/\r?\n|\r/g, "").trim();
    if (!qrCode) return;
    const matched = allWorkers.find((w) => w.qrCode === qrCode);
    if (matched) {
      onChange(matched);
      setQrText("");
      setMode("search");
    }
  };

  /** 선택 해제 */
  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}

      {/* 선택된 작업자 표시 */}
      {value ? (
        <div className="flex items-center gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <WorkerAvatar name={value.workerName} dept={value.dept} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text">{value.workerName}</div>
            <div className="text-xs text-text-muted">{value.dept} | {value.workerCode}</div>
          </div>
          <button onClick={handleClear} className="p-1 hover:bg-surface rounded text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 모드 전환 탭 */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => { setMode("search"); setTimeout(() => searchRef.current?.focus(), 50); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${mode === "search" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
            >
              <Search className="w-3 h-3 inline mr-1" />
              {t("production.result.workerSelect")}
            </button>
            <button
              onClick={() => { setMode("qr"); setTimeout(() => qrRef.current?.focus(), 50); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${mode === "qr" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
            >
              <ScanLine className="w-3 h-3 inline mr-1" />
              {t("production.result.qrScan")}
            </button>
          </div>

          {/* 검색 모드 */}
          {mode === "search" && (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
                  onFocus={() => searchText && setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  placeholder={t("production.result.workerSearchPlaceholder")}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {/* 드롭다운 결과 */}
              {isDropdownOpen && filteredWorkers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(worker)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-background transition-colors text-left"
                    >
                      <WorkerAvatar name={worker.workerName} dept={worker.dept} size="sm" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-text">{worker.workerName}</span>
                        <span className="text-xs text-text-muted ml-2">{worker.workerCode}</span>
                      </div>
                      <span className="text-xs text-text-muted">{worker.dept}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QR 스캔 모드 */}
          {mode === "qr" && (
            <div>
              <BarcodeScanInput
                ref={qrRef}
                value={qrText}
                onChange={setQrText}
                onScan={handleQrSubmit}
                placeholder={t("production.result.qrPlaceholder")}
                fullWidth
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkerSelector;
