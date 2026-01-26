/**
 * @file src/components/charts/LineChart.tsx
 * @description SVG 기반 라인 차트 - 생산 추이, 트렌드 시각화
 */
import { useMemo } from 'react';

export interface LineChartData {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartData[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showArea?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  className?: string;
}

function LineChart({
  data,
  height = 200,
  color = '#3b82f6',
  showDots = true,
  showArea = true,
  showGrid = true,
  showLabels = true,
  className = '',
}: LineChartProps) {
  const chartConfig = useMemo(() => {
    if (data.length === 0) return null;

    const width = 400;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map((d) => d.value));
    const minValue = Math.min(...data.map((d) => d.value));
    const valueRange = maxValue - minValue || 1;

    const yTicks = 5;
    const yTickValues = Array.from({ length: yTicks }, (_, i) => {
      return Math.round(minValue + (valueRange * i) / (yTicks - 1));
    });

    const points = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
      ...d,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaPath = `
      ${linePath}
      L ${points[points.length - 1].x} ${padding.top + chartHeight}
      L ${points[0].x} ${padding.top + chartHeight}
      Z
    `;

    return { width, height, padding, chartWidth, chartHeight, points, linePath, areaPath, yTickValues, maxValue, minValue };
  }, [data, height]);

  if (!chartConfig || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-text-muted ${className}`} style={{ height }}>
        데이터가 없습니다
      </div>
    );
  }

  const gradientId = `lineGradient-${Math.random().toString(36).slice(2)}`;

  return (
    <div className={`w-full ${className}`}>
      <svg viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`} className="w-full h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {showGrid && chartConfig.yTickValues.map((tick, i) => {
          const y = chartConfig.padding.top + chartConfig.chartHeight - ((tick - chartConfig.minValue) / (chartConfig.maxValue - chartConfig.minValue || 1)) * chartConfig.chartHeight;
          return (
            <g key={i}>
              <line x1={chartConfig.padding.left} y1={y} x2={chartConfig.padding.left + chartConfig.chartWidth} y2={y} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" className="text-border" />
              <text x={chartConfig.padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="text-[10px] fill-text-muted">{tick.toLocaleString()}</text>
            </g>
          );
        })}

        {showArea && <path d={chartConfig.areaPath} fill={`url(#${gradientId})`} />}
        <path d={chartConfig.linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {showDots && chartConfig.points.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="4" fill="white" stroke={color} strokeWidth="2" className="dark:fill-slate-800">
            <title>{point.label}: {point.value.toLocaleString()}</title>
          </circle>
        ))}

        {showLabels && chartConfig.points.map((point, i) => {
          const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
          if (!showLabel) return null;
          return <text key={i} x={point.x} y={chartConfig.height - 10} textAnchor="middle" className="text-[10px] fill-text-muted">{point.label}</text>;
        })}
      </svg>
    </div>
  );
}

export default LineChart;
