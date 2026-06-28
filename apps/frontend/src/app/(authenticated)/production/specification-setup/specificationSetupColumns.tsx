"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export type RevisionStatus = "DRAFT" | "APPROVED" | "OBSOLETE";

export interface HarnessCircuitSpec {
  circuitId?: number;
  circuitNo: string;
  wireItemCode?: string;
  wireSpec?: string;
  wireSize?: string;
  colorCode?: string;
  colorName?: string;
  lengthMm?: number | "";
  stripA?: number | "";
  stripB?: number | "";
  endAHousing?: string;
  endATerminal?: string;
  connectionSymbol?: string;
  endBTerminal?: string;
  endBHousing?: string;
  tubeSpec?: string;
  subNo?: string;
  remark?: string;
}

export interface HarnessDrawingRevision {
  revisionId: number;
  drawingId: number;
  revisionCode: string;
  status: RevisionStatus;
  changeReason?: string | null;
  circuits?: HarnessCircuitSpec[];
}

export interface HarnessDrawing {
  drawingId: number;
  drawingNo: string;
  itemCode: string;
  itemName?: string | null;
  erpItemNo?: string | null;
  customerPartNo?: string | null;
  remark?: string | null;
  revisions?: HarnessDrawingRevision[];
  revision?: HarnessDrawingRevision;
}

interface CreateSpecificationSetupGridColumnsOptions {
  t: TFunction;
}

export function createSpecificationSetupGridColumns({
  t,
}: CreateSpecificationSetupGridColumnsOptions): ColumnDef<HarnessDrawing>[] {
  return [
    { accessorKey: "drawingNo", header: t("production.specSetup.drawingNo", "도면번호"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "erpItemNo", header: t("production.specSetup.erpItemNo", "ERP 품번"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
  ];
}
