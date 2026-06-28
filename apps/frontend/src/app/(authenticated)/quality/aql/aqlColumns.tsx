"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { HelpHeader } from "./components/AqlFieldHelp";

export interface AqlRule {
  lotQtyFrom: number;
  lotQtyTo: number;
  sampleSize: number;
  acceptQty: number;
  rejectQty: number;
  sortOrder?: number | null;
}

export interface AqlStandard {
  [key: string]: unknown;
  aqlCode: string;
  aqlName: string;
  inspectionLevel?: string | null;
  aqlValue?: number | null;
  useYn: string;
  remark?: string | null;
  rules?: AqlRule[];
}

export interface IqcAqlPolicy {
  [key: string]: unknown;
  policyCode: string;
  policyName: string;
  inspectionLevel?: string | null;
  majorAqlCode?: string | null;
  minorAqlCode?: string | null;
  criticalMode?: string | null;
  useYn: string;
  remark?: string | null;
}

interface CreateAqlGridColumnsOptions {
  t: TFunction;
}

export function createAqlGridColumns({
  t,
}: CreateAqlGridColumnsOptions): ColumnDef<AqlStandard>[] {
  return [
    {
      accessorKey: "aqlCode",
      header: () => <HelpHeader field="aqlCode" label={t("quality.aql.aqlCode", "AQL 코드")} />,
      size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-primary">{getValue() as string}</span>,
    },
    { accessorKey: "aqlName", header: () => <HelpHeader field="aqlName" label={t("quality.aql.aqlName", "AQL 명칭")} />, size: 160 },
    { accessorKey: "inspectionLevel", header: () => <HelpHeader field="inspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")} />, size: 90 },
    { accessorKey: "aqlValue", header: () => <HelpHeader field="aqlValue" label={t("quality.aql.aqlValue", "AQL 값")} />, size: 80, meta: { align: "right" as const } },
    {
      accessorKey: "useYn",
      header: () => <HelpHeader field="useYn" label={t("quality.aql.use", "사용")} />,
      size: 70,
      cell: ({ getValue }) => (
        <span className={getValue() === "Y" ? "text-emerald-600 font-semibold" : "text-text-muted"}>{getValue() as string}</span>
      ),
    },
  ];
}

interface CreateAqlPolicyGridColumnsOptions {
  t: TFunction;
}

export function createAqlPolicyGridColumns({
  t,
}: CreateAqlPolicyGridColumnsOptions): ColumnDef<IqcAqlPolicy>[] {
  return [
    {
      accessorKey: "policyCode",
      header: () => <HelpHeader field="policyCode" label={t("quality.aql.policyCode", "정책 코드")} />,
      size: 130,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-primary">{getValue() as string}</span>,
    },
    { accessorKey: "policyName", header: () => <HelpHeader field="policyName" label={t("quality.aql.policyName", "정책명")} />, size: 180 },
    { accessorKey: "inspectionLevel", header: () => <HelpHeader field="policyInspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")} />, size: 70 },
    { accessorKey: "majorAqlCode", header: () => <HelpHeader field="policyMajorAqlCode" label={t("quality.aql.major", "Major")} />, size: 110 },
    { accessorKey: "minorAqlCode", header: () => <HelpHeader field="policyMinorAqlCode" label={t("quality.aql.minor", "Minor")} />, size: 110 },
    { accessorKey: "useYn", header: () => <HelpHeader field="policyUseYn" label={t("quality.aql.use", "사용")} />, size: 60 },
  ];
}
