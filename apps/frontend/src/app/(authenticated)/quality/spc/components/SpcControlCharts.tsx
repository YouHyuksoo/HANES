/**
 * @file quality/spc/components/SpcControlCharts.tsx
 * @description Xbar-R 관리도 차트 컴포넌트 (recharts 기반)
 *
 * 초보자 가이드:
 * 1. Xbar Chart: 서브그룹 평균값을 선 그래프로 표시, UCL/LCL/CL 참조선 포함
 * 2. R Chart: 서브그룹 범위값을 선 그래프로 표시
 * 3. 이탈(outOfControl) 데이터 포인트는 빨간색으로 강조
 * 4. 다크 모드 호환: CSS 변수 + 조건부 색상 사용
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";

/** 차트 데이터 포인트 */
interface ChartDataPoint {
  subgroupNo: number;
  mean: number | null;
  range: number | null;
  outOfControl: boolean;
}

/** 관리한계 */
interface ControlLimits {
  ucl?: number | null;
  lcl?: number | null;
  cl?: number | null;
}

interface Props {
  data: ChartDataPoint[];
  limits: ControlLimits;
}

/** 다크 모드 감지 헬퍼 */
const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Xbar 차트용 커스텀 dot — 이탈 포인트 강조 */
function XbarDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartDataPoint };
  if (cx == null || cy == null) return null;
  const color = payload?.outOfControl ? "#ef4444" : "#3b82f6";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />;
}

export default function SpcControlCharts({ data, limits }: Props) {
  const { t } = useTranslation();

  /** recharts용 데이터 변환 */
  const chartData = useMemo(() =>
    data
      .filter(d => d.mean != null)
      .sort((a, b) => a.subgroupNo - b.subgroupNo)
      .map(d => ({
        subgroupNo: d.subgroupNo,
        mean: d.mean != null ? Number(d.mean) : null,
        range: d.range != null ? Number(d.range) : null,
        outOfControl: d.outOfControl,
      })),
    [data],
  );

  if (chartData.length === 0) return null;

  /** Y축 domain: 데이터 + UCL/LCL 모두 포함되도록 계산 */
  const xbarDomain = useMemo(() => {
    const means = chartData.map(d => d.mean).filter((v): v is number => v != null);
    const vals = [...means];
    if (limits.ucl != null) vals.push(limits.ucl);
    if (limits.lcl != null) vals.push(limits.lcl);
    if (limits.cl != null) vals.push(limits.cl);
    if (vals.length === 0) return ["auto", "auto"] as const;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = (max - min) * 0.15 || 0.001;
    return [min - padding, max + padding] as [number, number];
  }, [chartData, limits]);

  const dark = isDark();
  const gridColor = dark ? "#334155" : "#e2e8f0";
  const textColor = dark ? "#94a3b8" : "#64748b";

  return (
    <div className="flex flex-col gap-3">
      {/* Xbar Chart */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted mb-1 px-1">
          {t("quality.spc.xbarChart")}
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="subgroupNo" tick={{ fontSize: 10, fill: textColor }}
              label={{ value: "#", position: "insideBottomRight", offset: -4, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10, fill: textColor }} domain={xbarDomain}
              tickFormatter={(v: number) => v.toFixed(3)} width={58} />
            <Tooltip contentStyle={{ fontSize: 11, background: dark ? "#1e293b" : "#fff", border: `1px solid ${gridColor}`, color: dark ? "#e2e8f0" : "#1e293b" }}
              formatter={(v: unknown) => [Number(v).toFixed(4), "X\u0304"]}
              labelFormatter={(l: unknown) => `#${l}`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {limits.ucl != null && (
              <ReferenceLine y={limits.ucl} stroke="#ef4444" strokeDasharray="6 3"
                label={{ value: "UCL", position: "right", fontSize: 9, fill: "#ef4444" }} />
            )}
            {limits.cl != null && (
              <ReferenceLine y={limits.cl} stroke="#22c55e" strokeWidth={1.5}
                label={{ value: "CL", position: "right", fontSize: 9, fill: "#22c55e" }} />
            )}
            {limits.lcl != null && (
              <ReferenceLine y={limits.lcl} stroke="#ef4444" strokeDasharray="6 3"
                label={{ value: "LCL", position: "right", fontSize: 9, fill: "#ef4444" }} />
            )}
            <Line type="monotone" dataKey="mean" name="X\u0304" stroke="#3b82f6"
              strokeWidth={1.5} dot={<XbarDot />} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* R Chart */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted mb-1 px-1">
          {t("quality.spc.rChart")}
        </h4>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="subgroupNo" tick={{ fontSize: 10, fill: textColor }}
              label={{ value: "#", position: "insideBottomRight", offset: -4, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10, fill: textColor }} domain={[0, "auto"]}
              tickFormatter={(v: number) => v.toFixed(3)} width={58} />
            <Tooltip contentStyle={{ fontSize: 11, background: dark ? "#1e293b" : "#fff", border: `1px solid ${gridColor}`, color: dark ? "#e2e8f0" : "#1e293b" }}
              formatter={(v: unknown) => [Number(v).toFixed(4), "R"]}
              labelFormatter={(l: unknown) => `#${l}`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="range" name="R" stroke="#f59e0b"
              strokeWidth={1.5} dot={{ r: 3, fill: "#f59e0b" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
