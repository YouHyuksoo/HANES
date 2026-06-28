"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 계측기 데이터 타입 */
export interface Gauge {
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  serialNo: string;
  manufacturer: string;
  calibrationCycle: number;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  status: string;
  location: string;
}

interface CreateMsaGridColumnsOptions {
  t: TFunction;
  onSelectGauge: (gauge: Gauge) => void;
}

export function createMsaGridColumns({
  t,
  onSelectGauge,
}: CreateMsaGridColumnsOptions): ColumnDef<Gauge>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onSelectGauge(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("quality.msa.viewCalibration", "교정이력")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "gaugeCode", header: t("master.gauge.gaugeCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    { accessorKey: "gaugeName", header: t("master.gauge.gaugeName"), size: 180,
      meta: { filterType: "text" as const } },
    { accessorKey: "gaugeType", header: () => <StatusHeaderHelp label={t("master.gauge.gaugeType")} codeType="GAUGE_TYPE" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_TYPE" code={getValue() as string} />
      ),
    },
    { accessorKey: "calibrationCycle", header: t("master.gauge.calibrationCycle"), size: 90,
      cell: ({ getValue }) => `${getValue()}${t("master.gauge.months")}` },
    { accessorKey: "lastCalibrationDate", header: t("quality.msa.lastCalibration"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "nextCalibrationDate", header: t("quality.msa.nextCalibration"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="GAUGE_STATUS" align="center" />, size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_STATUS" code={getValue() as string} />
      ),
    },
    { accessorKey: "location", header: t("master.gauge.location"), size: 110 },
  ];
}
