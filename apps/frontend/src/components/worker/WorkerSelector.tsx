/**
 * @file src/components/worker/WorkerSelector.tsx
 * @description 작업자 선택 공통 컴포넌트 - 텍스트 검색 + QR 스캔 입력
 *
 * 초보자 가이드:
 * 1. **작업자 검색**: 이름/코드로 텍스트 검색 → 드롭다운 결과
 * 2. **QR 스캔**: 바코드 스캐너로 qrCode 입력 → Enter → 자동 매칭
 * 3. **아바타**: 이름 첫 글자 이니셜 + 부서별 배경색 표시
 */
"use client";

import { useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, ScanLine, X } from "lucide-react";

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

/** Mock 작업자 데이터 (WorkerMaster 기준) */
export const mockWorkers: Worker[] = [
  { id: "1", workerCode: "W-001", workerName: "김작업", dept: "절단팀", qrCode: "QR-W001", photoUrl: null },
  { id: "2", workerCode: "W-002", workerName: "이압착", dept: "압착팀", qrCode: "QR-W002", photoUrl: null },
  { id: "3", workerCode: "W-003", workerName: "박조립", dept: "조립팀", qrCode: "QR-W003", photoUrl: null },
  { id: "4", workerCode: "W-004", workerName: "최검사", dept: "품질팀", qrCode: "QR-W004", photoUrl: null },
  { id: "5", workerCode: "W-005", workerName: "정포장", dept: "포장팀", photoUrl: null },
  { id: "6", workerCode: "W-006", workerName: "한절단", dept: "절단팀", qrCode: "QR-W006", photoUrl: null },
  { id: "7", workerCode: "W-007", workerName: "오압착", dept: "압착팀", qrCode: "QR-W007", photoUrl: null },
];

/** 부서별 아바타 배경색 */
const deptColors: Record<string, string> = {
  절단팀: "bg-orange-500",
  압착팀: "bg-blue-500",
  조립팀: "bg-green-500",
  품질팀: "bg-purple-500",
  포장팀: "bg-teal-500",
};

/** 이니셜 아바타 컴포넌트 (사진 있으면 사진 표시) */
export function WorkerAvatar({ name, dept, photoUrl, size = "md" }: { name: string; dept: string; photoUrl?: string | null; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";

  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0`} />
    );
  }

  const initial = name.charAt(0);
  const bgColor = deptColors[dept] || "bg-gray-500";
  return (
    <span className={`${sizeClass} ${bgColor} text-white rounded-full inline-flex items-center justify-center font-bold shrink-0`}>
      {initial}
    </span>
  );
}

function WorkerSelector({ value, onChange, label }: WorkerSelectorProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [qrText, setQrText] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "qr">("search");
  const searchRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);

  /** 검색 필터링된 작업자 목록 */
  const filteredWorkers = useMemo(() => {
    if (!searchText) return [];
    const s = searchText.toLowerCase();
    return mockWorkers.filter(
      (w) => w.workerName.toLowerCase().includes(s) || w.workerCode.toLowerCase().includes(s)
    );
  }, [searchText]);

  /** 작업자 선택 핸들러 */
  const handleSelect = (worker: Worker) => {
    onChange(worker);
    setSearchText("");
    setIsDropdownOpen(false);
  };

  /** QR 입력 → Enter → 자동 매칭 */
  const handleQrSubmit = () => {
    if (!qrText.trim()) return;
    const matched = mockWorkers.find((w) => w.qrCode === qrText.trim());
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
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                ref={qrRef}
                type="text"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleQrSubmit(); }}
                placeholder={t("production.result.qrPlaceholder")}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkerSelector;
