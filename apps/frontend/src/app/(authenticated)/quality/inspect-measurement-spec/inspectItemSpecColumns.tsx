"use client";
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface InspectItemSpecRow {
  specId: number;
  itemCode: string;
  inspectType: string;
  connectorKey: string;
  chargeBar: number | null;
  minHoldBar: number | null;
  holdSeconds: number | null;
  testVoltageKv: number | null;
  maxCurrentMa: number | null;
  torqueLsl: number | null;
  torqueUsl: number | null;
  useYn: string;
}

export function createInspectItemSpecGridColumns(t: TFunction): ColumnDef<InspectItemSpecRow>[] {
  return [
    { accessorKey: "itemCode", header: t("master.inspectItemSpec.itemCode"), size: 140 },
    { accessorKey: "inspectType", header: t("master.inspectItemSpec.inspectType"), size: 90 },
    { accessorKey: "connectorKey", header: t("master.inspectItemSpec.connectorKey"), size: 90 },
    { accessorKey: "minHoldBar", header: t("master.inspectItemSpec.minHoldBar"), size: 90 },
    { accessorKey: "testVoltageKv", header: t("master.inspectItemSpec.testVoltageKv"), size: 90 },
    { accessorKey: "maxCurrentMa", header: t("master.inspectItemSpec.maxCurrentMa"), size: 90 },
    { accessorKey: "torqueLsl", header: t("master.inspectItemSpec.torqueLsl"), size: 80 },
    { accessorKey: "torqueUsl", header: t("master.inspectItemSpec.torqueUsl"), size: 80 },
    { accessorKey: "useYn", header: t("common.useYn"), size: 70 },
  ];
}
