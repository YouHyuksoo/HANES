"use client";

/**
 * @file components/shared/DateRangeFilter.tsx
 * @description 조회기간(시작일~종료일) 공통 범위 필터.
 *  - controlled: 기존 dateFrom/dateTo 두 state를 그대로 연결한다.
 *  - 프리셋(오늘/최근7일/이번달) 클릭 시 from·to를 함께 갱신.
 *  - 시작일 > 종료일 입력 시 자동 보정.
 */
import { useTranslation } from "react-i18next";
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

  const applyRange = (r: DateRange) => {
    onFromChange(r.from);
    onToChange(r.to);
  };

  const handleFrom = (v: string) => {
    onFromChange(v);
    if (to && v > to) onToChange(v);
  };
  const handleTo = (v: string) => {
    onToChange(v);
    if (from && v < from) onFromChange(v);
  };

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
        <div className="flex items-center gap-1 ml-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyRange({ from: getTodayLocal(), to: getTodayLocal() })}
          >
            {t("common.dateFilter.today", "오늘")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyRange(getRecentDaysRange(7))}>
            {t("common.dateFilter.recent7", "최근 7일")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyRange(getThisMonthRange())}>
            {t("common.dateFilter.thisMonth", "이번 달")}
          </Button>
        </div>
      )}
    </div>
  );
}
