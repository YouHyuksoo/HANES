"use client";

/**
 * @file components/shared/DateFilter.tsx
 * @description 단일 날짜 공통 조회 필터. controlled value + '오늘' 버튼.
 */
import { useTranslation } from "react-i18next";
import { Input, Button } from "@/components/ui";
import { getTodayLocal } from "@/utils/date";

export interface DateFilterProps {
  value: string;
  onChange: (v: string) => void;
  todayButton?: boolean;
  className?: string;
}

export default function DateFilter({
  value,
  onChange,
  todayButton = true,
  className = "",
}: DateFilterProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36"
      />
      {todayButton && (
        <Button size="sm" variant="ghost" onClick={() => onChange(getTodayLocal())}>
          {t("common.dateFilter.today", "오늘")}
        </Button>
      )}
    </div>
  );
}
