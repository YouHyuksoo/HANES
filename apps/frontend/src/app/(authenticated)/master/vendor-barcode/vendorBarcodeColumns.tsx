"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { VENDOR_BARCODE_MATCH_TYPES, type VendorBarcodeMatchType } from "@harness/shared";
import { type VendorBarcodeMapping } from "./components/VendorBarcodeFormPanel";

/** 매칭유형 라벨(표시 전용). 값 집합은 @harness/shared 단일 출처. */
const MATCH_TYPE_LABELS: Record<VendorBarcodeMatchType, { labelKey: string; labelFallback: string }> = {
  EXACT: { labelKey: "master.vendorBarcode.matchExact", labelFallback: "정확 일치" },
  PREFIX: { labelKey: "master.vendorBarcode.matchPrefix", labelFallback: "접두사" },
  REGEX: { labelKey: "master.vendorBarcode.matchRegex", labelFallback: "정규식" },
};

export const MATCH_TYPE_OPTIONS = VENDOR_BARCODE_MATCH_TYPES.map((value) => ({
  value,
  ...MATCH_TYPE_LABELS[value],
}));

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PREFIX: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  REGEX: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

interface CreateVendorBarcodeGridColumnsOptions {
  t: TFunction;
  onEditMapping: (item: VendorBarcodeMapping) => void;
  onDeleteMapping: (item: VendorBarcodeMapping) => void;
}

export function createVendorBarcodeGridColumns({
  t,
  onEditMapping,
  onDeleteMapping,
}: CreateVendorBarcodeGridColumnsOptions): ColumnDef<VendorBarcodeMapping>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditMapping(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteMapping(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "vendorBarcode", header: t("master.vendorBarcode.vendorBarcode", "제조사 바코드"), size: 200,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{getValue() as string}</span>
      ),
    },
    { accessorKey: "itemCode", header: t("master.vendorBarcode.partCode", "품번"), size: 120 },
    { accessorKey: "itemName", header: t("master.vendorBarcode.partName", "품명"), size: 150 },
    { accessorKey: "vendorCode", header: t("master.vendorBarcode.vendorCode", "제조사코드"), size: 100 },
    { accessorKey: "vendorName", header: t("master.vendorBarcode.vendorName", "제조사명"), size: 120 },
    {
      accessorKey: "matchType", header: t("master.vendorBarcode.matchType", "매칭유형"), size: 90,
      meta: { filterType: "multi" as const, filterOptions: MATCH_TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey, o.labelFallback) })) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${MATCH_TYPE_COLORS[v] ?? ""}`}>{v}</span>;
      },
    },
    { accessorKey: "mappingRule", header: t("master.vendorBarcode.mappingRule", "매핑규칙"), size: 150 },
    {
      accessorKey: "useYn", header: t("master.vendorBarcode.useYn", "사용"), size: 50,
      meta: { filterType: "multi" as const, filterOptions: [{ value: "Y", label: "Y" }, { value: "N", label: "N" }] },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ];
}
