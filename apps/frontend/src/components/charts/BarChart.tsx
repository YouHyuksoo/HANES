/**
 * @file src/components/charts/BarChart.tsx
 * @description SVG 기반 바 차트 - 공정별 실적, 비교 시각화
 */
import { useMemo } from 'react';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartData[];
  height?: number;
  barColor?: string;
  showValues?: boolean;
  showGrid?: boolean;
  horizontal?: boolean;
  className?: string;
}

function BarChart({
  data,
  height = 200,
  barColor = '#3b82f6',
  showValues = true,
  showGrid = true,
  horizontal = false,
  className = '',
}: BarChartProps) {
  const chartConfig = useMemo(() => {
    if (data.length === 0) return null;

    const width = 400;
    const padding = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map((d) => d.value));
    const barWidth = (horizontal ? chartHeight : chartWidth) / data.length * 0.7;
    const barGap = (horizontal ? chartHeight : chartWidth) / data.length * 0.3;

    const bars = data.map((d, i) => {
      const barLength = (d.value / maxValue) * (horizontal ? chartWidth : chartHeight);
      if (horizontal) {
        return {
          x: padding.left,
          y: padding.top + i * (barWidth + barGap) + barGap / 2,
          width: barLength,
          height: barWidth,
          ...d,
        };
      }
      return {
        x: padding.left + i * (barWidth + barGap) + barGap / 2,
        y: padding.top + chartHeight - barLength,
        width: barWidth,
        height: barLength,
        ...d,
      };
    });

    return { width, height, padding, chartWidth, chartHeight, maxValue, bars };
  }, [data, height, horizontal]);

  if (!chartConfig || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-text-muted ${className}`} style={{ height }}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <svg viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`} className="w-full h-auto">
        {showGrid && Array.from({ length: 5 }, (_, i) => {
          const value = (chartConfig.maxValue / 4) * i;
          const pos = horizontal
            ? chartConfig.padding.left + (value / chartConfig.maxValue) * chartConfig.chartWidth
            : chartConfig.padding.top + chartConfig.chartHeight - (value / chartConfig.maxValue) * chartConfig.chartHeight;
          return (
            <g key={i}>
              {horizontal ? (
                <line x1={pos} y1={chartConfig.padding.top} x2={pos} y2={chartConfig.padding.top + chartConfig.chartHeight} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" className="text-border" />
              ) : (
                <line x1={chartConfig.padding.left} y1={pos} x2={chartConfig.padding.left + chartConfig.chartWidth} y2={pos} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" className="text-border" />
              )}
            </g>
          );
        })}

        {chartConfig.bars.map((bar, i) => (
          <g key={i}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color || barColor} rx="4" className="transition-all duration-300 hover:opacity-80">
              <title>{bar.label}: {bar.value.toLocaleString()}</title>
            </rect>
            {showValues && (
              <text
                x={horizontal ? bar.x + bar.width + 5 : bar.x + bar.width / 2}
                y={horizontal ? bar.y + bar.height / 2 : bar.y - 5}
                textAnchor={horizontal ? 'start' : 'middle'}
                dominantBaseline={horizontal ? 'middle' : 'auto'}
                className="text-[10px] fill-text-muted"
              >
                {bar.value.toLocaleString()}
              </text>
            )}
            <text
              x={horizontal ? chartConfig.padding.left - 5 : bar.x + bar.width / 2}
              y={horizontal ? bar.y + bar.height / 2 : chartConfig.height - 10}
              textAnchor={horizontal ? 'end' : 'middle'}
              dominantBaseline={horizontal ? 'middle' : 'auto'}
              className="text-[10px] fill-text-muted"
            >
              {bar.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default BarChart;
