"use client";

/**
 * @file src/components/charts/PieChart.tsx
 * @description SVG 기반 파이 차트 - 불량 유형별 비율 시각화
 */
import { useMemo } from 'react';

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface PieChartProps {
  data: PieChartData[];
  size?: number;
  innerRadius?: number;
  showLegend?: boolean;
  showValues?: boolean;
  className?: string;
}

function PieChart({
  data,
  size = 200,
  innerRadius = 0,
  showLegend = true,
  showValues = true,
  className = '',
}: PieChartProps) {
  const chartConfig = useMemo(() => {
    if (data.length === 0) return null;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    let currentAngle = -90;
    const slices = data.map((d) => {
      const percentage = (d.value / total) * 100;
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const innerX1 = centerX + innerRadius * Math.cos(startRad);
      const innerY1 = centerY + innerRadius * Math.sin(startRad);
      const innerX2 = centerX + innerRadius * Math.cos(endRad);
      const innerY2 = centerY + innerRadius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      let path: string;
      if (innerRadius > 0) {
        path = `
          M ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
          L ${innerX2} ${innerY2}
          A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX1} ${innerY1}
          Z
        `;
      } else {
        path = `
          M ${centerX} ${centerY}
          L ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
          Z
        `;
      }

      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelRadius = innerRadius > 0 ? (radius + innerRadius) / 2 : radius * 0.6;
      const labelX = centerX + labelRadius * Math.cos(midRad);
      const labelY = centerY + labelRadius * Math.sin(midRad);

      return { ...d, path, percentage, labelX, labelY };
    });

    return { size, centerX, centerY, radius, total, slices };
  }, [data, size, innerRadius]);

  if (!chartConfig || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-text-muted ${className}`} style={{ height: size }}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {chartConfig.slices.map((slice, i) => (
          <g key={i}>
            <path d={slice.path} fill={slice.color} className="transition-all duration-300 hover:opacity-80 cursor-pointer">
              <title>{slice.label}: {slice.value.toLocaleString()} ({slice.percentage.toFixed(1)}%)</title>
            </path>
            {showValues && slice.percentage > 5 && (
              <text x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="middle" className="text-[11px] font-medium fill-white pointer-events-none">
                {slice.percentage.toFixed(0)}%
              </text>
            )}
          </g>
        ))}
      </svg>

      {showLegend && (
        <div className="flex flex-col gap-2">
          {chartConfig.slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: slice.color }} />
              <span className="text-text">{slice.label}</span>
              <span className="text-text-muted">({slice.percentage.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PieChart;
