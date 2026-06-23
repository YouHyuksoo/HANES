"use client";

/**
 * @file components/shared/DateRangeFilter.tsx
 * @description 조회기간(시작일~종료일) 공통 범위 필터.
 *  - controlled: 기존 dateFrom/dateTo 두 state를 그대로 연결한다.
 *  - 프리셋(오늘/최근7일/이번달)은 공간 절약을 위해 아이콘 버튼 안에 접어두고,
 *    클릭 시 드롭다운으로 펼쳐 선택한다.
 *  - 시작일 > 종료일 입력 시 자동 보정.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CalendarRange } from "lucide-react";
import { Input, Button } from "@/components/ui";
import {
  getTodayLocal,
  getRecentDaysRange,
  getThisMonthRange,
  type DateRange,
} from "@/utils/date";

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  presets?: boolean;
  /** 범위 앞에 표시할 라벨(예: "발주일"). 생략 시 라벨 없음. */
  label?: string;
  className?: string;
}

export default function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  presets = true,
  label,
  className = "",
}: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // 부모가 빈 문자열로 초기화한 경우 마운트 시 당일로 보정
  useEffect(() => {
    const today = getTodayLocal();
    if (!from) onFromChange(today);
    if (!to) onToChange(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const applyRange = (r: DateRange) => {
    onFromChange(r.from);
    onToChange(r.to);
    setOpen(false);
  };

  const handleFrom = (v: string) => {
    onFromChange(v);
    if (to && v > to) onToChange(v);
  };
  const handleTo = (v: string) => {
    onToChange(v);
    if (from && v < from) onFromChange(v);
  };

  const presetItems = [
    { key: "today", label: t("common.dateFilter.today", "오늘"), range: { from: getTodayLocal(), to: getTodayLocal() } },
    { key: "recent7", label: t("common.dateFilter.recent7", "최근 7일"), range: getRecentDaysRange(7) },
    { key: "thisMonth", label: t("common.dateFilter.thisMonth", "이번 달"), range: getThisMonthRange() },
  ];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {label && (
        <span className="text-xs text-text-muted whitespace-nowrap mr-1">{label}</span>
      )}
      <Input
        type="date"
        value={from}
        onChange={(e) => handleFrom(e.target.value)}
        className="w-36"
      />
      <span className="text-text-muted">~</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => handleTo(e.target.value)}
        className="w-36"
      />
      {presets && (
        <div className="relative" ref={presetRef}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            aria-label={t("common.dateFilter.presets", "기간 선택")}
            title={t("common.dateFilter.presets", "기간 선택")}
          >
            <CalendarRange className="w-4 h-4" />
          </Button>
          {open && (
            <div className="absolute right-0 z-20 mt-1 flex min-w-[7rem] flex-col rounded-md border border-border bg-surface p-1 shadow-lg">
              {presetItems.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyRange(p.range)}
                  className="rounded px-2 py-1.5 text-left text-sm text-text hover:bg-primary/10"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
