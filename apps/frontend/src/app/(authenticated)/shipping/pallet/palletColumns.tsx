"use client";

import type { TFunction } from "i18next";
import { Plus, Lock, LockOpen, Printer, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import { PalletStatusBadge } from "@/components/shipping";
import type { PalletStatus } from "@/components/shipping";

/** palletNo가 PK이므로 별도 id 불필요 */
export interface Pallet {
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: PalletStatus;
  shipmentId: string | null;
  createdAt: string;
  closeAt: string | null;
  shipOrderNo?: string | null;
  shippedAt?: string | null;
}

interface CreatePalletGridColumnsOptions {
  t: TFunction;
  saving: boolean;
  selectPallet: (pallet: Pallet) => void;
  setIsAssignModalOpen: (open: boolean) => void;
  fetchAvailableBoxes: () => void;
  handleClosePallet: (pallet: Pallet) => void;
  handleReopenPallet: (pallet: Pallet) => void;
  handleOpenLabel: (pallet: Pallet) => void;
  canDeleteEmptyPallet: (pallet: Pallet) => boolean;
  setDeletePalletTarget: (pallet: Pallet) => void;
}

export function createPalletGridColumns({
  t,
  saving,
  selectPallet,
  setIsAssignModalOpen,
  fetchAvailableBoxes,
  handleClosePallet,
  handleReopenPallet,
  handleOpenLabel,
  canDeleteEmptyPallet,
  setDeletePalletTarget,
}: CreatePalletGridColumnsOptions): ColumnDef<Pallet>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 164, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const pallet = row.original;
        const isOpen = pallet.status === "OPEN";
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" title={t("shipping.pallet.assignBox")} disabled={!isOpen || !pallet.shipOrderNo} onClick={() => { selectPallet(pallet); setIsAssignModalOpen(true); fetchAvailableBoxes(); }}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.closePallet")} disabled={!isOpen || !pallet.shipOrderNo} onClick={() => handleClosePallet(pallet)}>
              <Lock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.reopenPallet")} disabled={pallet.status !== "CLOSED"} onClick={() => handleReopenPallet(pallet)}>
              <LockOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.printLabel", "라벨 출력")} onClick={() => handleOpenLabel(pallet)}>
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.deleteEmptyPallet", "빈 팔레트 삭제")} disabled={!canDeleteEmptyPallet(pallet) || saving} onClick={() => setDeletePalletTarget(pallet)}>
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
    { accessorKey: "shipOrderNo", header: t("shipping.pallet.shipOrderNo", "출하지시번호"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span> },
    { accessorKey: "palletNo", header: t("shipping.pallet.palletNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "boxCount", header: t("shipping.pallet.boxCount"), size: 80, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 100, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PALLET_STATUS" align="center" />, size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <PalletStatusBadge status={getValue() as PalletStatus} /> },
    { accessorKey: "shipmentId", header: t("shipping.confirm.shipmentNo"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 140, meta: { filterType: "date" as const } },
  ];
}
