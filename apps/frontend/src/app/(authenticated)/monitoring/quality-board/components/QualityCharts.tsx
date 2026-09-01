"use client";

/**
 * @file src/app/(authenticated)/monitoring/quality-board/components/QualityCharts.tsx
 * @description 품질 보드 차트 모음 — 공정별 불량률 바차트 + 최근 7일 불량률 추이 라인차트
 */
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { ProcessDefect, DailyDefectPoint } from "./types";

const DEFECT_COLOR = "#ef4444";
const RATE_COLOR = "#f59e0b";
const TOTAL_COLOR = "#3b82f6";

export function ProcessDefectChart({ byProcess }: { byProcess: ProcessDefect[] }) {
  const { t } = useTranslation();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byProcess} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="processCode" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip formatter={(value, name) => [Number(value ?? 0).toLocaleString(), String(name)]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="totalQty" name={t("monitoring.board.quality.totalQty")} fill={TOTAL_COLOR} />
        <Bar dataKey="defectQty" name={t("monitoring.board.defect")} fill={DEFECT_COLOR} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyTrendChart({ dailyTrend }: { dailyTrend: DailyDefectPoint[] }) {
  const { t } = useTranslation();
  const data = dailyTrend.map((d) => ({ ...d, label: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} unit="%" />
        <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, t("monitoring.board.quality.defectRate")]} />
        <Line type="monotone" dataKey="defectRate" stroke={RATE_COLOR} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
