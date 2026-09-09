"use client";

/**
 * @file src/app/(authenticated)/master/terminal-crimp-spec/terminalCrimpSpecColumns.tsx
 * @description 단자별 압착 규격 마스터 DataGrid 컬럼 팩토리 — page.tsx는 상태·레이아웃만 담당한다
 */
import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import HelpTarget from "@/components/tour/HelpTarget";

/** 단자별 압착 규격 행 (API /master/terminal-crimp-specs) */
export interface TerminalCrimpSpecRow {
  specId: number;
  terminalItemCode: string;
  terminalType: string | null;
  wireSize: string;
  wireItemCode: string | null;
  crimpHeightLsl: number | null;
  crimpHeightUsl: number | null;
  crimpWidthLsl: number | null;
  crimpWidthUsl: number | null;
  insCrimpHeightLsl: number | null;
  insCrimpHeightUsl: number | null;
  pullForceMin: number | null;
  stripLengthMin: number | null;
  stripLengthMax: number | null;
  applicatorCode: string | null;
  remark: string | null;
  useYn: string;
  updatedAt: string;
}

/** LSL~USL 범위 문자열. 둘 다 없으면 "-" — 없는 규격을 임의값으로 채우지 않는다 */
export function formatRange(lsl: number | null, usl: number | null): string {
  if (lsl == null && usl == null) return "-";
  const fmt = (v: number | null) => (v == null ? "" : Number(v).toString());
  return `${fmt(lsl)} ~ ${fmt(usl)}`;
}

interface CreateTerminalCrimpSpecGridColumnsOptions {
  t: TFunction;
  onEditSpec: (row: TerminalCrimpSpecRow) => void;
  onDeleteSpec: (row: TerminalCrimpSpecRow) => void;
}

export function createTerminalCrimpSpecGridColumns({
  t,
  onEditSpec,
  onDeleteSpec,
}: CreateTerminalCrimpSpecGridColumnsOptions): ColumnDef<TerminalCrimpSpecRow>[] {
  const rangeCell = (lslKey: keyof TerminalCrimpSpecRow, uslKey: keyof TerminalCrimpSpecRow) =>
    ({ row }: { row: { original: TerminalCrimpSpecRow } }) => (
      <span className="font-mono text-right block">
        {formatRange(row.original[lslKey] as number | null, row.original[uslKey] as number | null)}
      </span>
    );

  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <HelpTarget helpKey="master.terminalCrimpSpec.actions.edit" label={t("common.edit")}
            fallbackDescription="선택한 단자·전선 조합의 압착 규격을 수정합니다. 저장 전에는 변경 내용이 서버에 반영되지 않습니다.">
            <button type="button" onClick={() => onEditSpec(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
          </HelpTarget>
          <HelpTarget helpKey="master.terminalCrimpSpec.actions.delete" label={t("common.delete")}
            fallbackDescription="선택한 압착 규격을 삭제합니다. 이후 해당 단자·전선 조합을 압착 기준 조회에서 사용할 수 없습니다.">
            <button type="button" onClick={() => onDeleteSpec(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </HelpTarget>
        </div>
      ),
    },
    {
      accessorKey: "terminalItemCode", header: t("master.terminalCrimpSpec.terminalItemCode"), size: 140,
      meta: { filterType: "text" as const, helpKey: "master.terminalCrimpSpec.columns.terminalItemCode" },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "terminalType",
      header: () => <StatusHeaderHelp label={t("master.terminalCrimpSpec.terminalType")} codeType="TERMINAL_TYPE" align="center" />,
      size: 110,
      meta: { filterType: "multi" as const, helpKey: "master.terminalCrimpSpec.columns.terminalType" },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="TERMINAL_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "wireSize", header: t("master.terminalCrimpSpec.wireSize"), size: 100,
      meta: { filterType: "text" as const, helpKey: "master.terminalCrimpSpec.columns.wireSize" },
    },
    {
      accessorKey: "wireItemCode", header: t("master.terminalCrimpSpec.wireItemCode"), size: 130,
      meta: { filterType: "text" as const, helpKey: "master.terminalCrimpSpec.columns.wireItemCode" },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      id: "crimpHeight", header: t("master.terminalCrimpSpec.crimpHeight"), size: 130,
      meta: { align: "right" as const, helpKey: "master.terminalCrimpSpec.columns.crimpHeight" },
      cell: rangeCell("crimpHeightLsl", "crimpHeightUsl"),
    },
    {
      id: "crimpWidth", header: t("master.terminalCrimpSpec.crimpWidth"), size: 130,
      meta: { align: "right" as const, helpKey: "master.terminalCrimpSpec.columns.crimpWidth" },
      cell: rangeCell("crimpWidthLsl", "crimpWidthUsl"),
    },
    {
      id: "insCrimpHeight", header: t("master.terminalCrimpSpec.insCrimpHeight"), size: 140,
      meta: { align: "right" as const, helpKey: "master.terminalCrimpSpec.columns.insCrimpHeight" },
      cell: rangeCell("insCrimpHeightLsl", "insCrimpHeightUsl"),
    },
    {
      accessorKey: "pullForceMin", header: t("master.terminalCrimpSpec.pullForceMin"), size: 110,
      meta: { align: "right" as const, helpKey: "master.terminalCrimpSpec.columns.pullForceMin" },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-right block">{v == null ? "-" : Number(v).toString()}</span>;
      },
    },
    {
      id: "stripLength", header: t("master.terminalCrimpSpec.stripLength"), size: 120,
      meta: { align: "right" as const, helpKey: "master.terminalCrimpSpec.columns.stripLength" },
      cell: rangeCell("stripLengthMin", "stripLengthMax"),
    },
    {
      accessorKey: "applicatorCode", header: t("master.terminalCrimpSpec.applicatorCode"), size: 120,
      meta: { filterType: "text" as const, helpKey: "master.terminalCrimpSpec.columns.applicatorCode" },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 70,
      meta: { align: "center" as const, filterType: "multi" as const, helpKey: "master.terminalCrimpSpec.columns.useYn" },
      cell: ({ getValue }) => (
        <span className={(getValue() as string) === "Y" ? "text-text" : "text-text-muted"}>
          {(getValue() as string) === "Y" ? t("common.useY") : t("common.useN")}
        </span>
      ),
    },
    { accessorKey: "remark", header: t("common.remark"), size: 160 },
  ];
}
