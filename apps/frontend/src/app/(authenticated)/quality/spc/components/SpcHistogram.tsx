"use client";

/**
 * @file quality/spc/components/SpcHistogram.tsx
 * @description SPC 히스토그램 — 측정값 분포 + USL/LSL/Target 규격선 표시
 *
 * 초보자 가이드:
 * 1. 전체 측정값을 구간(bin)으로 나누어 막대 그래프로 표시
 * 2. USL(상한), LSL(하한), Target(목표) 참조선으로 규격 범위 시각화
 * 3. 규격 밖 구간은 빨간색으로 강조
 * 4. recharts BarChart 사용, 다크 모드 호환
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  /** 모든 서브그룹의 개별 측정값 (JSON 파싱된 배열) */
  allValues: number[];
  usl?: number | null;
  lsl?: number | null;
  target?: number | null;
}

/** 다크 모드 감지 */
const isDark = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");

/** 측정값을 구간(bin)으로 분류 */
function buildBins(values: number[], binCount: number) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;
  const binWidth = range / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    label: (min + (i + 0.5) * binWidth).toFixed(3),
    count: 0,
  }));

  values.forEach((v) => {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  });

  return bins;
}

export default function SpcHistogram({ allValues, usl, lsl, target }: Props) {
  const { t } = useTranslation();

  const bins = useMemo(() => {
    const count = Math.max(8, Math.min(20, Math.ceil(Math.sqrt(allValues.length))));
    return buildBins(allValues, count);
  }, [allValues]);

  if (bins.length === 0) return null;

  const dark = isDark();
  const gridColor = dark ? "#334155" : "#e2e8f0";
  const textColor = dark ? "#94a3b8" : "#64748b";

  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted mb-1 px-1">
        {t("quality.spc.histogram", "히스토그램")} ({allValues.length}{t("common.count", "건")})
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={bins} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: textColor }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: textColor }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: dark ? "#1e293b" : "#fff",
              border: `1px solid ${gridColor}`,
              color: dark ? "#e2e8f0" : "#1e293b",
            }}
            formatter={(v: unknown) => [`${v}건`, "빈도"]}
            labelFormatter={(l: unknown) => `구간: ${l}`}
          />
          {usl != null && (
            <ReferenceLine
              x={bins.reduce((closest, b) =>
                Math.abs(Number(b.label) - usl) < Math.abs(Number(closest.label) - usl) ? b : closest
              ).label}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{ value: "USL", position: "top", fontSize: 9, fill: "#ef4444" }}
            />
          )}
          {lsl != null && (
            <ReferenceLine
              x={bins.reduce((closest, b) =>
                Math.abs(Number(b.label) - lsl) < Math.abs(Number(closest.label) - lsl) ? b : closest
              ).label}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{ value: "LSL", position: "top", fontSize: 9, fill: "#ef4444" }}
            />
          )}
          {target != null && (
            <ReferenceLine
              x={bins.reduce((closest, b) =>
                Math.abs(Number(b.label) - target) < Math.abs(Number(closest.label) - target) ? b : closest
              ).label}
              stroke="#22c55e"
              strokeWidth={2}
              label={{ value: "Target", position: "top", fontSize: 9, fill: "#22c55e" }}
            />
          )}
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((bin, idx) => {
              const outOfSpec =
                (usl != null && bin.binStart > usl) ||
                (lsl != null && bin.binEnd < lsl);
              return (
                <Cell
                  key={idx}
                  fill={outOfSpec
                    ? (dark ? "#dc2626" : "#fca5a5")
                    : (dark ? "#3b82f6" : "#60a5fa")
                  }
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
