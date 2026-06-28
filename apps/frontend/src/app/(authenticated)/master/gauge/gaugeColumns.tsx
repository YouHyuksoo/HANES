"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 계측기 데이터 타입 */
export interface Gauge {
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  resolution: number;
  measureRange: string;
  calibrationCycle: number;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  status: string;
  location: string;
  responsiblePerson: string;
  createdAt: string;
}

interface CreateGaugeGridColumnsOptions {
  t: TFunction;
  onEditGauge: (gauge: Gauge) => void;
  onDeleteGauge: (gauge: Gauge) => void;
}

export function createGaugeGridColumns({
  t,
  onEditGauge,
  onDeleteGauge,
}: CreateGaugeGridColumnsOptions): ColumnDef<Gauge>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => onEditGauge(row.original)}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => onDeleteGauge(row.original)}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "gaugeCode", header: t("master.gauge.gaugeCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "gaugeName", header: t("master.gauge.gaugeName"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "gaugeType", header: () => <StatusHeaderHelp label={t("master.gauge.gaugeType")} codeType="GAUGE_TYPE" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "manufacturer", header: t("master.gauge.manufacturer"), size: 120,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "serialNo", header: t("master.gauge.serialNo"), size: 130 },
    { accessorKey: "measureRange", header: t("master.gauge.measureRange"), size: 110 },
    {
      accessorKey: "calibrationCycle", header: t("master.gauge.calibrationCycle"), size: 90,
      cell: ({ getValue }) => (
        <span className="font-mono text-right block">
          {getValue() as number}{t("master.gauge.months")}
        </span>
      ),
    },
    {
      accessorKey: "nextCalibrationDate", header: t("master.gauge.nextCalibrationDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-",
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="GAUGE_STATUS" align="center" />, size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_STATUS" code={getValue() as string} />
      ),
    },
    { accessorKey: "location", header: t("master.gauge.location"), size: 120 },
  ];
}
