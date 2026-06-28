"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import type { ProductionJobOrderRow } from "@harness/shared";

type JobOrderItem = ProductionJobOrderRow;

const getProgress = (row: JobOrderItem) => {
  if (row.planQty === 0) return 0;
  return Math.round((row.goodQty / row.planQty) * 100);
};

export interface CreateProductionOrderGridColumnsOptions {
  t: TFunction;
  onEdit: (row: JobOrderItem) => void;
  onDelete: (row: JobOrderItem) => void;
}

export function createProductionOrderGridColumns({
  t,
  onEdit,
  onDelete,
}: CreateProductionOrderGridColumnsOptions): ColumnDef<JobOrderItem & { _depth: number }>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}
            className="p-1 rounded hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
            title={t("common.edit")}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(row.original); }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-muted hover:text-red-500 transition-colors"
            title={t("common.delete")}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "planDate", header: t("production.order.planDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? String(v).slice(0, 10) : "-";
      },
    },
    {
      accessorKey: "priority", header: t("production.order.priority"), size: 80,
      meta: { filterType: "number" as const, align: "center" as const },
      cell: ({ getValue }) => {
        const p = (getValue() as number) ?? 5;
        // 1~3 높음(강조), 4~6 보통, 7~10 낮음 — 파스텔 배경 대신 테두리/텍스트색으로 구분
        const cls = p <= 3
          ? "border-red-400 text-red-600 dark:text-red-400 font-bold"
          : p <= 6
            ? "border-border text-text"
            : "border-border text-text-muted";
        return (
          <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 text-xs rounded border ${cls}`}>
            {p}
          </span>
        );
      },
    },
    {
      accessorKey: "orderNo", header: t("production.order.orderNo"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const depth = row.original._depth;
        return (
          <span className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && <ChevronRight className="w-3 h-3 text-text-muted" />}
            {row.original.children?.length ? <ChevronDown className="w-3 h-3 text-primary" /> : null}
            <span className="font-mono text-sm">{row.original.orderNo}</span>
          </span>
        );
      },
    },
    {
      id: "orderKind", header: t("production.order.orderKind", "구분"), size: 90,
      meta: { filterType: "multi" as const, align: "center" as const },
      accessorFn: (row) => row.orderKind || "ITEM",
      cell: ({ row, getValue }) => {
        const kind = getValue() as string;
        const routingSeq = row.original.routingSeq;
        const cls = kind === "OPERATION"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300";
        const label = kind === "OPERATION" ? t("production.order.orderKindOperation", "공정") : t("production.order.orderKindItem", "품목");
        return (
          <span className={`inline-flex min-w-14 items-center justify-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {routingSeq ? `${label} ${routingSeq}` : label}
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemCode || "",
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemName || "",
    },
    {
      id: "partType", header: t("production.order.partType"), size: 70,
      meta: { filterType: "multi" as const },
      accessorFn: (row) => row.part?.itemType || "",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return "-";
        const cls = v === "FINISHED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : v === "SEMI_PRODUCT" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        const label = v === "FINISHED" ? t("production.order.itemTypeFG", "완제품")
          : v === "SEMI_PRODUCT" ? t("production.order.itemTypeWIP", "반제품")
          : v;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: "lineCode", header: t("monthlyPlan.lineCode"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "processCode", header: t("production.order.process"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "equipCode", header: t("production.order.equip"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "custPoNo", header: t("production.order.custPoNo"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "planQty", header: t("production.order.planQty"), size: 80,
      cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "goodQty", header: t("production.order.prodQty"), size: 80,
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      id: "progress", header: t("production.order.progress"), size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const p = getProgress(row.original);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="JOB_ORDER_STATUS" align="center" />,
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
    },
  ];
}
