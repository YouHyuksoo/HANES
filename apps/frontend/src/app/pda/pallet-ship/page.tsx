"use client";

/**
 * @file src/app/pda/pallet-ship/page.tsx
 * @description 팔레트 출하 PDA 페이지 — 마감(CLOSED)된 팔레트를 스캔해 출하지시 단위로 출하
 *   (팔레트 구성은 /pda/shipping-pallet)
 *
 * SCAN_PALLET → SCAN_WORKER → READY([출하])
 */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, UserCheck } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { usePalletShipByScan, type PalletShipScanHistory } from "@/hooks/pda/usePalletShipByScan";

export default function PalletShipPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    phase, pallet, worker, isScanning, isBusy, error, history,
    handleScanPallet, handleScanWorker, handleShip, handleReset,
  } = usePalletShipByScan();

  const onScan = useCallback(async (barcode: string) => {
    if (phase === "SCAN_PALLET") await handleScanPallet(barcode);
    else if (phase === "SCAN_WORKER") await handleScanWorker(barcode);
  }, [phase, handleScanPallet, handleScanWorker]);

  useBarcodeDetector({ onScan });

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    switch (error) {
      case "PALLET_NOT_FOUND": return t("pda.palletShip.palletNotFound", "팔레트를 찾을 수 없습니다.");
      case "NOT_CLOSED": return t("pda.palletShip.notClosed", "마감(CLOSED)된 팔레트만 출하할 수 있습니다.");
      case "NO_ORDER": return t("pda.palletShip.noOrder", "출하지시에 연결되지 않은 팔레트입니다.");
      case "WORKER_NOT_FOUND": return t("pda.palletShip.workerNotFound", "작업자를 찾을 수 없습니다.");
      case "SHIP_FAILED": return t("pda.palletShip.shipFailed", "출하 처리에 실패했습니다.");
      default: return error;
    }
  }, [error, t]);

  const scanPlaceholderKey = phase === "SCAN_PALLET"
    ? "pda.palletShip.scanPallet"
    : "pda.palletShip.scanWorker";

  const palletFields: ScanResultField[] = useMemo(() => {
    if (!pallet) return [];
    return [
      { label: t("pda.palletShip.palletNo", "팔레트"), value: pallet.palletNo, highlight: true },
      { label: t("pda.palletShip.shipOrderNo", "출하지시"), value: pallet.shipOrderNo },
      { label: t("pda.palletShip.boxCount", "박스"), value: pallet.boxCount },
      { label: t("pda.palletShip.totalQty", "수량"), value: pallet.totalQty },
    ];
  }, [pallet, t]);

  const onShip = useCallback(async () => {
    const ok = await handleShip();
    if (ok) playSuccess(); else playError();
  }, [handleShip, playSuccess, playError]);

  const renderHistoryItem = useCallback((item: PalletShipScanHistory) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">{item.palletNo}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{item.shipOrderNo}</p>
      </div>
      <p className="text-xs text-slate-400">{item.timestamp}</p>
    </div>
  ), []);

  return (
    <>
      <PdaHeader titleKey="pda.palletShip.title" backPath="/pda/menu" />

      <ScanInput onScan={onScan} placeholderKey={scanPlaceholderKey} isLoading={isScanning} />

      {errorMessage && <ScanResultCard fields={[]} errorMessage={errorMessage} />}

      {phase === "SCAN_PALLET" && !error && !isScanning && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900">
          <Boxes className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("pda.palletShip.scanPallet", "마감된 팔레트를 스캔하세요")}</p>
        </div>
      )}

      {(phase === "SCAN_WORKER" || phase === "READY") && pallet && (
        <ScanResultCard fields={palletFields} variant="success" title={t("pda.palletShip.palletLoaded", "팔레트 확인")} />
      )}

      {phase === "SCAN_WORKER" && !error && !isScanning && (
        <div className="mx-4 mt-3 rounded-2xl border-2 border-dashed border-blue-300 bg-white p-6 text-center dark:border-blue-700 dark:bg-slate-900">
          <UserCheck className="mx-auto mb-2 h-10 w-10 text-blue-400 dark:text-blue-500" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("pda.palletShip.scanWorker", "작업자 QR을 스캔하세요")}</p>
        </div>
      )}

      {phase === "READY" && worker && (
        <div className="mx-4 mt-3 flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 w-fit">
          <UserCheck className="h-3 w-3" /><span>{worker.workerName}</span>
        </div>
      )}

      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.palletNo}-${idx}`}
      />

      {phase === "READY" && (
        <PdaActionButton
          buttons={[
            { label: t("pda.palletShip.ship", "출하"), onClick: onShip, variant: "primary", isLoading: isBusy },
            { label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" },
          ]}
        />
      )}
      {phase === "SCAN_WORKER" && (
        <PdaActionButton buttons={[{ label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" }]} />
      )}
    </>
  );
}
