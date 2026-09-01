"use client";

/**
 * @file src/app/(authenticated)/monitoring/production-board/components/HourlyTrendChart.tsx
 * @description 시간대별 실적 추이 바차트 — 00~23시 전체 축, 양품/불량 스택
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { HourlyPoint } from "./types";

const GOOD_COLOR = "#3b82f6";
const DEFECT_COLOR = "#ef4444";

export default function HourlyTrendChart({ hourly }: { hourly: HourlyPoint[] }) {
  const { t } = useTranslation();

  // 00~23시 전체 축 생성 (없는 시간대는 0)
  const data = useMemo(() => {
    const map = new Map(hourly.map((h) => [h.hour, h]));
    return Array.from({ length: 24 }, (_, i) => {
      const hour = String(i).padStart(2, "0");
      const p = map.get(hour);
      return { hour: `${hour}시`, good: p?.goodQty ?? 0, defect: p?.defectQty ?? 0 };
    });
  }, [hourly]);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 13 }} interval={1} />
          <YAxis tick={{ fontSize: 13 }} allowDecimals={false} />
          <Tooltip formatter={(value, name) => [Number(value ?? 0).toLocaleString(), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 14 }} />
          <Bar dataKey="good" name={t("monitoring.board.good")} stackId="qty" fill={GOOD_COLOR} />
          <Bar dataKey="defect" name={t("monitoring.board.defect")} stackId="qty" fill={DEFECT_COLOR} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
