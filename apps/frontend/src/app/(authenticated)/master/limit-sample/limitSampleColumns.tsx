"use client";

/**
 * @file src/app/(authenticated)/master/limit-sample/limitSampleColumns.tsx
 * @description 양불마스터(양품/불량 한도견본) DataGrid 컬럼 팩토리 + 유효기간 만료/임박 배지
 *
 * 초보자 가이드:
 * 1. 유효기간 배지는 서버가 내려준 expiryState(EXPIRED/EXPIRING/VALID/NONE)를 그대로 표시한다(프론트 재계산 없음).
 * 2. 배지는 텍스트/테두리로 구분한다 — 파스텔 배경색 금지.
 * 3. 썸네일은 대표 사진(primaryImageUrl) 1장만 쓰고, 총 장수는 별도 컬럼으로 보여준다.
 */
import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import InspectItemImage from "@/components/shared/InspectItemImage";

export type LimitSampleType = "OK" | "NG";
export type LimitSampleStatus = "ACTIVE" | "EXPIRED" | "RETIRED";
export type LimitSampleExpiryState = "EXPIRED" | "EXPIRING" | "VALID" | "NONE";

/** 견본 사진 1장 (API /master/limit-samples 응답의 images 요소) */
export interface LimitSampleImageRow {
  seqNo: number;
  imageUrl: string;
  caption: string | null;
  isPrimary: string;
  sortOrder: number;
}

/** 양불마스터 행 (API /master/limit-samples) */
export interface LimitSampleRow {
  sampleCode: string;
  sampleType: LimitSampleType;
  sampleName: string;
  itemCode: string | null;
  processCode: string | null;
  defectCode: string | null;
  /** 적용 검사유형 — null이면 전 검사유형 공통 */
  inspectType: string | null;
  location: string | null;
  validFrom: string | null;
  validTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  status: LimitSampleStatus;
  /** 검사 전 대조 필수 여부 */
  requiredYn: string;
  /** 대조 모달 표시 순서 */
  sortOrder: number;
  remark: string | null;
  useYn: string;
  images: LimitSampleImageRow[];
  primaryImageUrl: string | null;
  expiryState: LimitSampleExpiryState;
  daysToExpiry: number | null;
  updatedAt: string;
}

/** 유효기간 만료/임박 배지 — 텍스트+테두리 (배경 없음) */
export function ExpiryBadge({ t, row }: { t: TFunction; row: LimitSampleRow }) {
  if (row.expiryState === "EXPIRED") {
    return (
      <span className="inline-flex items-center rounded border border-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 dark:border-red-400 dark:text-red-400">
        {t("master.limitSample.expired")} ({Math.abs(row.daysToExpiry ?? 0)}{t("master.limitSample.daysAgoSuffix")})
      </span>
    );
  }
  if (row.expiryState === "EXPIRING") {
    return (
      <span className="inline-flex items-center rounded border border-amber-600 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400 dark:text-amber-300">
        {t("master.limitSample.expiring")} (D-{row.daysToExpiry ?? 0})
      </span>
    );
  }
  if (row.expiryState === "VALID") {
    return <span className="text-text-muted">{t("master.limitSample.valid")}</span>;
  }
  return <span className="text-text-muted">-</span>;
}

interface CreateLimitSampleGridColumnsOptions {
  t: TFunction;
  onEditSample: (row: LimitSampleRow) => void;
  onDeleteSample: (row: LimitSampleRow) => void;
}

export function createLimitSampleGridColumns({
  t,
  onEditSample,
  onDeleteSample,
}: CreateLimitSampleGridColumnsOptions): ColumnDef<LimitSampleRow>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => onEditSample(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button type="button" onClick={() => onDeleteSample(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      id: "image", header: t("master.limitSample.images"), size: 64,
      meta: { align: "center" as const },
      cell: ({ row }) => <InspectItemImage imageUrl={row.original.primaryImageUrl} alt={row.original.sampleName} size={36} />,
    },
    {
      id: "imageCount", header: t("master.limitSample.imageCount"), size: 70,
      meta: { align: "right" as const },
      cell: ({ row }) => <span className="tabular-nums">{row.original.images?.length ?? 0}</span>,
    },
    {
      accessorKey: "sampleCode", header: t("master.limitSample.sampleCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "sampleType",
      header: () => <StatusHeaderHelp label={t("master.limitSample.sampleType")} codeType="LIMIT_SAMPLE_TYPE" align="center" />,
      size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="LIMIT_SAMPLE_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "sampleName", header: t("master.limitSample.sampleName"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "inspectType",
      header: () => <StatusHeaderHelp label={t("master.limitSample.inspectType")} codeType="INSPECT_TYPE" align="center" />,
      size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const code = getValue() as string | null;
        if (!code) return <span className="text-text-muted">{t("master.limitSample.inspectTypeAll")}</span>;
        return <ComCodeBadge groupCode="INSPECT_TYPE" code={code} />;
      },
    },
    {
      accessorKey: "requiredYn", header: t("master.limitSample.requiredYn"), size: 90,
      meta: { align: "center" as const, filterType: "multi" as const },
      cell: ({ getValue }) => (getValue() === "Y"
        ? (
          <span className="inline-flex items-center rounded border border-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            {t("master.limitSample.required")}
          </span>
        )
        : <span className="text-text-muted">-</span>),
    },
    {
      accessorKey: "sortOrder", header: t("master.limitSample.sortOrder"), size: 80,
      meta: { align: "right" as const },
      cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number) ?? 0}</span>,
    },
    {
      accessorKey: "itemCode", header: t("master.limitSample.itemCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "processCode", header: t("master.limitSample.processCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "defectCode", header: t("master.limitSample.defectCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "validTo", header: t("master.limitSample.validTo"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      id: "expiry", header: t("master.limitSample.expiry"), size: 130,
      meta: { align: "center" as const },
      cell: ({ row }) => <ExpiryBadge t={t} row={row.original} />,
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="LIMIT_SAMPLE_STATUS" align="center" />,
      size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="LIMIT_SAMPLE_STATUS" code={getValue() as string} />,
    },
    { accessorKey: "location", header: t("master.limitSample.location"), size: 130 },
    {
      accessorKey: "approvedBy", header: t("master.limitSample.approvedBy"), size: 100,
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
