"use client";

import type { TFunction } from "i18next";
import { Upload, ExternalLink, Eye, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import type { IqcDetailRecord } from "./IqcDetailModal";

export interface IqcHistoryItem {
  id: string;
  matUid?: string;
  arrivalNo?: string | null;
  itemCode?: string;
  itemName?: string;
  unit?: string;
  vendorCode?: string | null;
  vendorName?: string | null;
  inspectType: string;
  result: string;
  status: string;
  inspectorName?: string;
  inspectDate: string;
  seq?: number;
  remark?: string;
  received?: boolean;
  certFilePath?: string | null;
  sampleBarcode?: string | null;
  details?: string | null;
}

export function getCertFileUrl(certFilePath: string | null | undefined): string | null {
  if (!certFilePath) return null;
  const filename = certFilePath.replace(/\\/g, '/').split('/').pop();
  return filename ? `/uploads/iqc-certs/${filename}` : null;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const getLotNoDisplay = (record: Pick<IqcHistoryItem, "matUid" | "sampleBarcode">) =>
  record.matUid || record.sampleBarcode || "-";

interface CreateIqcHistoryGridColumnsOptions {
  t: TFunction;
  uploadingKey: string | null;
  onViewDetail: (record: IqcDetailRecord) => void;
  onCancel: (record: IqcHistoryItem) => void;
  onCertUpload: (record: IqcHistoryItem, file: File | null) => void;
}

export function createIqcHistoryGridColumns({
  t,
  uploadingKey,
  onViewDetail,
  onCancel,
  onCertUpload,
}: CreateIqcHistoryGridColumnsOptions): ColumnDef<IqcHistoryItem>[] {
  return [
    {
      id: "actions",
      header: t("common.actions"),
      size: 140,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const record = row.original;
        const uploadKey = `${record.inspectDate}:${record.seq}`;
        const certUrl = getCertFileUrl(record.certFilePath);
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-primary"
              title={t("material.iqcHistory.viewDetail", "검사 상세보기")}
              onClick={(e) => { e.stopPropagation(); onViewDetail(record as IqcDetailRecord); }}
            >
              <Eye className="w-4 h-4" />
            </button>
            {certUrl && (
              <a
                href={certUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-blue-600 hover:bg-surface hover:text-blue-800"
                title={t("material.iqcHistory.viewCert", "검사성적서 열람")}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {record.status === "DONE" && record.result === "PASS" && (
              <label
                className={`inline-flex h-8 w-8 items-center justify-center rounded cursor-pointer hover:bg-surface ${
                  record.certFilePath ? "text-green-600" : "text-primary"
                } ${uploadingKey === uploadKey ? "opacity-50 pointer-events-none" : ""}`}
                title={record.certFilePath ? t("material.iqcHistory.reuploadCert", "검사성적서 재업로드") : t("material.iqcHistory.uploadCert", "검사성적서 업로드")}
                onClick={(e) => e.stopPropagation()}
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    onCertUpload(record, e.target.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            )}
            {record.status === "DONE" && !record.received && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onCancel(record); }}
                className="text-red-500 hover:text-red-700"
                title={t("material.iqcHistory.cancelAction")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "inspectDate", header: t("material.iqcHistory.inspectDate"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return formatDateTime(d);
      },
    },
    {
      accessorKey: "certFilePath",
      header: t("material.iqcHistory.cert", "성적서"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const url = getCertFileUrl(getValue() as string | null);
        return url
          ? (
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 cursor-pointer">
              {t("material.iqcHistory.attached", "첨부")}
            </a>
          )
          : <span className="text-xs text-text-muted">{t("material.iqcHistory.notAttached", "미첨부")}</span>;
      },
    },
    {
      accessorKey: "arrivalNo",
      header: t("material.iqcHistory.arrivalNo", "입하번호"),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      id: "lotNo", accessorFn: getLotNoDisplay, header: "LOT No.", size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const lotNo = getLotNoDisplay(row.original);
        return <span className="font-mono text-sm">{lotNo}</span>;
      },
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "vendorName", header: t("material.arrivalResult.supplier", "공급사"), size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || "-",
    },
    {
      accessorKey: "inspectType", header: () => <StatusHeaderHelp label={t("material.iqcHistory.inspectType")} codeType="IQC_INSPECT_TYPE" align="center" />, size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="IQC_INSPECT_TYPE" value={getValue() as string} />,
    },
    {
      accessorKey: "result", header: () => <StatusHeaderHelp label={t("material.iqcHistory.result")} codeType="INSPECT_RESULT" align="center" />, size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="INSPECT_RESULT" value={getValue() as string} />,
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        const isCanceled = s === "CANCELED";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isCanceled
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          }`}>
            {isCanceled ? t("material.iqcHistory.statusCanceled") : t("material.iqcHistory.statusDone")}
          </span>
        );
      },
    },
    {
      accessorKey: "inspectorName", header: t("material.iqcHistory.inspector"), size: 90, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ];
}
