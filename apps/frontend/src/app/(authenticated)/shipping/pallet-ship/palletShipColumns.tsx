"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";

/* ─── interfaces ─── */

/** Fulfillment API 응답 중 팔레트 */
export interface OrderPallet {
  palletNo: string;
  status: string;
  boxCount: number;
  totalQty: number;
  shipmentId?: string | null;
  shipOrderNo?: string | null;
  boxes?: Array<{ boxNo: string; itemCode: string; qty: number }>;
}

export interface OrderPalletRow extends OrderPallet {
  shipmentNo: string | null;
  shipmentNoText: string;
}

/* ─── helpers ─── */

export function canShip(p: OrderPallet): boolean {
  return p.status === "CLOSED" && !p.shipmentId;
}

const palletShipStatusHelpText = [
  "상태전이: OPEN -> CLOSED -> SHIPPED",
  "OPEN: 팔레트가 생성됐지만 아직 구성이 마감되지 않은 상태입니다. 팔레트출하 대상이 아닙니다.",
  "CLOSED: 팔레트 구성이 완료되어 출하 스캔 가능한 상태입니다. 출하번호는 아직 생성되지 않았습니다.",
  "LOADED: 일반 출하건에 적재된 상태입니다. 이 화면의 출하지시 팔레트출하는 보통 CLOSED에서 SHIPPED로 바로 처리됩니다.",
  "SHIPPED: 팔레트 출하확정이 완료된 상태입니다. 출하번호가 표시되어야 하며 제품재고와 출하이력이 반영됩니다.",
].join("\n");

function PalletShipStatusHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-1">
      <span>{t("common.status")}</span>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-primary"
        title={palletShipStatusHelpText}
        aria-label={palletShipStatusHelpText}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

/* ─── columns ─── */

export type CreatePalletShipGridColumnsOptions = Record<string, never>;

export function createPalletShipGridColumns(
  _options: CreatePalletShipGridColumnsOptions = {},
): ColumnDef<OrderPalletRow>[] {
  return [
    {
      id: "shippable", header: "", size: 36,
      cell: ({ row }) => {
        const p = row.original;
        return canShip(p)
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : <XCircle className="w-4 h-4 text-gray-300" />;
      },
    },
    { accessorKey: "palletNo", header: "팔레트번호", size: 170, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono font-medium">{getValue() as string}</span> },
    {
      accessorKey: "status", header: () => <PalletShipStatusHeader />, size: 100,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <BoxStatusBadge status={s as BoxStatus} />;
      },
    },
    { accessorKey: "boxCount", header: "박스수", size: 80, meta: { align: "center" as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "totalQty", header: "총수량", size: 100, meta: { align: "center" as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    {
      accessorKey: "shipmentNo", header: "출하번호", size: 160,
      cell: ({ row, getValue }) => {
        const value = getValue() as string | null | undefined;
        return value
          ? <span className="font-mono text-xs">{value}</span>
          : <span className="text-text-muted text-xs">{row.original.shipmentNoText}</span>;
      },
    },
  ];
}
