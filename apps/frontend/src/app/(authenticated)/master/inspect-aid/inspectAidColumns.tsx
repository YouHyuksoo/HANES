"use client";

/**
 * @file src/app/(authenticated)/master/inspect-aid/inspectAidColumns.tsx
 * @description 검사보조구(한도견본·검사홀더) DataGrid 컬럼 팩토리 + 유효기간 만료/임박 배지
 *
 * 초보자 가이드:
 * 1. 유효기간 배지는 서버가 내려준 expiryState(EXPIRED/EXPIRING/VALID/NONE)를 그대로 표시한다(프론트 재계산 없음).
 * 2. 배지는 텍스트/테두리로 구분한다 — 파스텔 배경색 금지.
 * 3. 사진은 공용 InspectItemImage 썸네일(클릭 확대) 재사용.
 */
import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import InspectItemImage from "@/components/shared/InspectItemImage";

export type InspectAidType = "LIMIT_OK" | "LIMIT_NG" | "HOLDER";
export type InspectAidStatus = "ACTIVE" | "EXPIRED" | "RETIRED";
export type InspectAidExpiryState = "EXPIRED" | "EXPIRING" | "VALID" | "NONE";

/** 검사보조구 행 (API /master/inspect-aids) */
export interface InspectAidRow {
  aidCode: string;
  aidType: InspectAidType;
  aidName: string;
  itemCode: string | null;
  processCode: string | null;
  defectCode: string | null;
  imageUrl: string | null;
  location: string | null;
  validFrom: string | null;
  validTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  status: InspectAidStatus;
  remark: string | null;
  useYn: string;
  expiryState: InspectAidExpiryState;
  daysToExpiry: number | null;
  updatedAt: string;
}

/** 유효기간 만료/임박 배지 — 텍스트+테두리 (배경 없음) */
export function ExpiryBadge({ t, row }: { t: TFunction; row: InspectAidRow }) {
  if (row.expiryState === "EXPIRED") {
    return (
      <span className="inline-flex items-center rounded border border-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 dark:border-red-400 dark:text-red-400">
        {t("master.inspectAid.expired")} ({Math.abs(row.daysToExpiry ?? 0)}{t("master.inspectAid.daysAgoSuffix")})
      </span>
    );
  }
  if (row.expiryState === "EXPIRING") {
    return (
      <span className="inline-flex items-center rounded border border-amber-600 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400 dark:text-amber-300">
        {t("master.inspectAid.expiring")} (D-{row.daysToExpiry ?? 0})
      </span>
    );
  }
  if (row.expiryState === "VALID") {
    return <span className="text-text-muted">{t("master.inspectAid.valid")}</span>;
  }
  return <span className="text-text-muted">-</span>;
}

interface CreateInspectAidGridColumnsOptions {
  t: TFunction;
  onEditAid: (row: InspectAidRow) => void;
  onDeleteAid: (row: InspectAidRow) => void;
}

export function createInspectAidGridColumns({
  t,
  onEditAid,
  onDeleteAid,
}: CreateInspectAidGridColumnsOptions): ColumnDef<InspectAidRow>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => onEditAid(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button type="button" onClick={() => onDeleteAid(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      id: "image", header: t("master.inspectAid.image"), size: 64,
      meta: { align: "center" as const },
      cell: ({ row }) => <InspectItemImage imageUrl={row.original.imageUrl} alt={row.original.aidName} size={36} />,
    },
    {
      accessorKey: "aidCode", header: t("master.inspectAid.aidCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "aidType",
      header: () => <StatusHeaderHelp label={t("master.inspectAid.aidType")} codeType="INSPECT_AID_TYPE" align="center" />,
      size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_AID_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "aidName", header: t("master.inspectAid.aidName"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemCode", header: t("master.inspectAid.itemCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "processCode", header: t("master.inspectAid.processCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "defectCode", header: t("master.inspectAid.defectCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "validTo", header: t("master.inspectAid.validTo"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      id: "expiry", header: t("master.inspectAid.expiry"), size: 130,
      meta: { align: "center" as const },
      cell: ({ row }) => <ExpiryBadge t={t} row={row.original} />,
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="INSPECT_AID_STATUS" align="center" />,
      size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_AID_STATUS" code={getValue() as string} />,
    },
    { accessorKey: "location", header: t("master.inspectAid.location"), size: 130 },
    {
      accessorKey: "approvedBy", header: t("master.inspectAid.approvedBy"), size: 100,
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 70,
      meta: { align: "center" as const, filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className={(getValue() as string) === "Y" ? "text-text" : "text-text-muted"}>
          {(getValue() as string) === "Y" ? t("common.useY") : t("common.useN")}
        </span>
      ),
    },
  ];
}
