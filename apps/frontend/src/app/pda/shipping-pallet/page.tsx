"use client";

/**
 * @file src/app/pda/shipping-pallet/page.tsx
 * @description 팔레트 구성 PDA 페이지 — 출하지시 스캔 → 팔레트 생성 → 박스 스캔 적재 → 마감
 *   (출하는 별도 화면 /pda/pallet-ship 에서 마감된 팔레트를 스캔해 처리한다)
 *
 * SCAN_ORDER → SCAN_WORKER → BUILD_PALLET(팔레트 생성/이어서 + 박스 스캔 적재 + 마감)
 */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Truck, UserCheck } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { usePalletShipScan, type PalletShipHistoryItem } from "@/hooks/pda/usePalletShipScan";
import { PalletBuildPanel } from "./components/PalletBuildPanel";

export default function PalletBuildPage() {
  const { t } = useTranslation();
  const {
    phase, order, worker, pallet, isScanning, isBusy, error, history,
    handleScanOrder, handleScanWorker, handleCreatePallet,
    handleScanBox, handleRemoveBox, handleClosePallet, handleReset,
  } = usePalletShipScan();

  const onScan = useCallback(async (barcode: string) => {
    if (phase === "SCAN_ORDER") await handleScanOrder(barcode);
    else if (phase === "SCAN_WORKER") await handleScanWorker(barcode);
    else if (phase === "BUILD_PALLET") await handleScanBox(barcode);
  }, [phase, handleScanOrder, handleScanWorker, handleScanBox]);

  useBarcodeDetector({ onScan });

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    switch (error) {
      case "ORDER_NOT_FOUND": return t("pda.palletBuild.orderNotFound", "출하지시를 찾을 수 없습니다.");
      case "NOT_CONFIRMED": return t("pda.palletBuild.notConfirmed", "확정(CONFIRMED) 출하지시만 가능합니다.");
      case "WORKER_NOT_FOUND": return t("pda.palletBuild.workerNotFound", "작업자를 찾을 수 없습니다.");
      case "DUPLICATE": return t("pda.palletBuild.duplicate", "이미 적재된 박스입니다.");
      case "BOX_NOT_LOADABLE": return t("pda.palletBuild.boxNotLoadable", "적재 가능한 박스가 아닙니다(마감·OQC합격·미할당 확인).");
      case "PALLET_NOT_OPEN": return t("pda.palletBuild.palletNotOpen", "구성 중(OPEN) 팔레트가 아닙니다.");
      case "EMPTY_PALLET": return t("pda.palletBuild.emptyPallet", "박스가 없는 팔레트는 마감할 수 없습니다.");
      default: return error;
    }
  }, [error, t]);

  const scanPlaceholderKey = useMemo(() => {
    switch (phase) {
      case "SCAN_ORDER": return "pda.palletBuild.scanOrder";
      case "SCAN_WORKER": return "pda.palletBuild.scanWorker";
      case "BUILD_PALLET": return "pda.palletBuild.scanBox";
    }
  }, [phase]);

  const orderFields: ScanResultField[] = useMemo(() => {
    if (!order) return [];
    return [
      { label: t("pda.palletBuild.shipOrderNo", "출하지시"), value: order.shipOrderNo, highlight: true },
      { label: t("pda.palletBuild.customer", "고객"), value: order.customerName ?? "-" },
      { label: t("pda.palletBuild.orderQty", "지시수량"), value: order.orderQty },
      { label: t("pda.palletBuild.shippedQty", "기출하"), value: order.shippedQty },
    ];
  }, [order, t]);

  const renderHistoryItem = useCallback((item: PalletShipHistoryItem) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.shipOrderNo}</p>
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.palletNo}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{item.boxCount} / {item.totalQty}</p>
        <p className="text-xs text-slate-400">{item.timestamp}</p>
      </div>
    </div>
  ), []);

  const noPallet = !pallet;
  const isOpenPallet = pallet?.status === "OPEN";
  const isClosedPallet = pallet?.status === "CLOSED";

  return (
    <>
      <PdaHeader titleKey="pda.palletBuild.title" backPath="/pda/menu" />

      {phase !== "SCAN_ORDER" && (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Truck className="h-3 w-3" /><span>{order?.shipOrderNo}</span>
          </div>
          {phase === "BUILD_PALLET" && worker && (
            <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <UserCheck className="h-3 w-3" /><span>{worker.workerName}</span>
            </div>
          )}
        </div>
      )}

      <ScanInput onScan={onScan} placeholderKey={scanPlaceholderKey} isLoading={isScanning} />

      {errorMessage && <ScanResultCard fields={[]} errorMessage={errorMessage} />}

      {phase === "SCAN_ORDER" && !error && !isScanning && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900">
          <Boxes className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("pda.palletBuild.scanOrder", "출하지시를 스캔하세요")}</p>
        </div>
      )}

      {phase === "SCAN_WORKER" && !error && !isScanning && (
        <>
          <ScanResultCard fields={orderFields} variant="success" title={t("pda.palletBuild.orderLoaded", "출하지시 확인")} />
          <div className="mx-4 mt-3 rounded-2xl border-2 border-dashed border-blue-300 bg-white p-6 text-center dark:border-blue-700 dark:bg-slate-900">
            <UserCheck className="mx-auto mb-2 h-10 w-10 text-blue-400 dark:text-blue-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("pda.palletBuild.scanWorker", "작업자 QR을 스캔하세요")}</p>
          </div>
        </>
      )}

      {phase === "BUILD_PALLET" && (
        <>
          <ScanResultCard fields={orderFields} variant="success" title={t("pda.palletBuild.orderLoaded", "출하지시 확인")} />
          {pallet ? (
            <PalletBuildPanel pallet={pallet} onRemoveBox={handleRemoveBox} disabled={isBusy} />
          ) : (
            <div className="mx-4 mt-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-6 text-center dark:border-emerald-700 dark:bg-slate-900">
              <Boxes className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("pda.palletBuild.noPalletHint", "새 팔레트를 생성하세요")}</p>
            </div>
          )}
          {isClosedPallet && (
            <div className="mx-4 mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
              {t("pda.palletBuild.closedHint", "마감 완료 — 출하는 ‘팔레트 출하’ 화면에서 처리하세요.")}
            </div>
          )}
        </>
      )}

      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.palletNo}-${idx}`}
      />

      {phase === "BUILD_PALLET" && (
        <PdaActionButton
          buttons={[
            ...(noPallet ? [{
              label: t("pda.palletBuild.createPallet", "새 팔레트"),
              onClick: handleCreatePallet,
              variant: "primary" as const,
              isLoading: isBusy,
            }] : []),
            ...(isOpenPallet ? [{
              label: t("pda.palletBuild.closePallet", "팔레트 마감"),
              onClick: handleClosePallet,
              variant: "primary" as const,
              isLoading: isBusy,
              disabled: (pallet?.boxes.length ?? 0) === 0,
              disabledReason: (pallet?.boxes.length ?? 0) === 0 ? t("pda.palletBuild.emptyPallet", "박스가 없는 팔레트는 마감할 수 없습니다.") : undefined,
            }] : []),
            { label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" as const },
          ]}
        />
      )}

      {phase === "SCAN_WORKER" && (
        <PdaActionButton buttons={[{ label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" }]} />
      )}
    </>
  );
}
