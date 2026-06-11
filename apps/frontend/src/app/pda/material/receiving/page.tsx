"use client";

/**
 * @file src/app/pda/material/receiving/page.tsx
 * @description 자재입고 PDA 페이지 (웹과 워크플로우 통일)
 *
 * 초보자 가이드:
 * 1. 작업자 스캔(WorkerBar): 작업자 QR을 스캔해 등록해야 입고 가능 (누가 작업했는지 기록)
 * 2. ScanInput: 자재 시리얼(matUid) 바코드 스캔 → 입고가능 LOT 조회
 * 3. WarehouseSelect: 입고창고 선택 (기본창고 자동선택)
 * 4. 수량 입력(기본=잔량) 후 입고확인 → 사전 게이트 검증 통과 시 공통 입고 API(items[], workerId)로 확정
 * 5. 오류는 전역 시스템 모달 대신 사용자용 PdaErrorDialog로 표시하고, 닫으면 입고창을 클리어
 */
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import WarehouseSelect from "@/components/shared/WarehouseSelect";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { PackageCheck } from "lucide-react";
import {
  useMatReceivingScan,
  type ScanResult,
} from "@/hooks/pda/useMatReceivingScan";
import { ReceivingHistoryRow, WorkerBar, PdaErrorDialog } from "./components";

/** 작업자 QR 조회 응답 (ResponseUtil envelope의 data) */
interface WorkerByQrResponse {
  id?: number;
  workerCode: string;
  workerName: string;
  dept?: string;
}

export default function MaterialReceivingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const { currentWorker, setCurrentWorker } = useAuthStore();
  const {
    scannedData,
    isScanning,
    isConfirming,
    error,
    history,
    handleScan,
    handleConfirm,
    handleReset,
  } = useMatReceivingScan();

  const [receivedQty, setReceivedQty] = useState<string>("");
  const [warehouseCode, setWarehouseCode] = useState<string>("");

  // 작업자 스캔 상태
  const [workerScanOpen, setWorkerScanOpen] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  // 사전 게이트 검증 실패 메시지 (백엔드 호출 전 사용자용 안내)
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  /** 작업자 QR 스캔 → 등록 (게이트형 입력) */
  const onWorkerScan = useCallback(
    async (qr: string) => {
      const code = qr.trim();
      if (!code) return;
      setWorkerLoading(true);
      setWorkerError(null);
      try {
        const res = await api.get<{ data?: WorkerByQrResponse } | WorkerByQrResponse>(
          `/master/workers/by-qr/${encodeURIComponent(code)}`,
          { suppressErrorModal: true },
        );
        // ResponseUtil envelope({data}) 또는 raw 모두 대응
        const w = ((res.data as { data?: WorkerByQrResponse })?.data ?? res.data) as WorkerByQrResponse;
        if (!w?.workerCode) {
          setWorkerError(t("pda.receiving.workerNotFound", "작업자를 찾을 수 없습니다"));
          playError();
          return;
        }
        setCurrentWorker({ id: w.id ?? 0, name: w.workerName ?? w.workerCode, workerCode: w.workerCode });
        setWorkerScanOpen(false);
        playSuccess();
      } catch {
        setWorkerError(t("pda.receiving.workerNotFound", "작업자를 찾을 수 없습니다"));
        playError();
      } finally {
        setWorkerLoading(false);
      }
    },
    [t, setCurrentWorker, playSuccess, playError],
  );

  /** 자재 바코드 스캔 → 입고가능 LOT 조회 (작업자 등록 후에만) */
  const onScan = useCallback(
    async (barcode: string) => {
      if (!currentWorker) {
        setGateMessage(t("pda.receiving.workerRequired", "작업자를 먼저 스캔해 주세요"));
        playError();
        return;
      }
      const result: ScanResult = await handleScan(barcode);
      if (result !== "ok") playError();
    },
    [currentWorker, handleScan, playError, t],
  );

  /** 하드웨어 스캐너 감지 (작업자 등록·미스캔·작업자패널 닫힘 시에만 자재 스캔) */
  useBarcodeDetector({
    onScan,
    enabled: !scannedData && !workerScanOpen && !!currentWorker,
  });

  /** 스캔 결과 필드 구성 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedData) return [];
    if (receivedQty === "" && scannedData.remainingQty) {
      setReceivedQty(String(scannedData.remainingQty));
    }
    return [
      { label: t("material.col.matUid"), value: scannedData.matUid, highlight: true },
      { label: t("pda.receiving.partCode"), value: scannedData.itemCode },
      { label: t("pda.receiving.partName"), value: scannedData.part?.itemName ?? "" },
      {
        label: t("pda.receiving.orderQty"),
        value: `${scannedData.remainingQty} ${scannedData.part?.unit ?? "EA"}`,
      },
      { label: t("pda.receiving.supplier"), value: scannedData.vendor ?? "-" },
    ];
  }, [scannedData, receivedQty, t]);

  // 다이얼로그 메시지: 사전검증(gateMessage) 우선, 없으면 백엔드 오류(error)
  const dialogMessage = gateMessage ?? error ?? null;

  /** 입고 확인 — 백엔드 호출 전 사전 게이트 검증 */
  const onConfirm = useCallback(async () => {
    if (!currentWorker) {
      setGateMessage(t("pda.receiving.workerRequired", "작업자를 먼저 스캔해 주세요"));
      playError();
      return;
    }
    if (!scannedData) return;
    const qty = Number(receivedQty);
    if (!receivedQty || Number.isNaN(qty) || qty <= 0) {
      setGateMessage(t("pda.receiving.qtyMin", "입고수량은 1 이상이어야 합니다."));
      playError();
      return;
    }
    if (qty > scannedData.remainingQty) {
      setGateMessage(
        t("pda.receiving.qtyOverRemaining", "입고수량({{qty}})이 잔량({{remaining}})을 초과합니다.")
          .replace("{{qty}}", String(qty))
          .replace("{{remaining}}", String(scannedData.remainingQty)),
      );
      playError();
      return;
    }
    if (!warehouseCode) {
      setGateMessage(t("pda.receiving.warehouseRequired", "입고 창고를 선택해 주세요."));
      playError();
      return;
    }
    const success = await handleConfirm(qty, warehouseCode, currentWorker.workerCode, currentWorker.name);
    if (success) {
      playSuccess();
      setReceivedQty("");
    } else {
      playError();
    }
  }, [currentWorker, scannedData, receivedQty, warehouseCode, handleConfirm, playSuccess, playError, t]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setReceivedQty("");
  }, [handleReset]);

  /** 에러 다이얼로그 닫기 → 입고창 클리어 (자재/확정 오류 한정) */
  const onCloseDialog = useCallback(() => {
    setGateMessage(null);
    handleReset();
    setReceivedQty("");
  }, [handleReset]);

  const receiveDisabledReason = useMemo(() => {
    if (!currentWorker) return t("pda.receiving.workerRequired", "작업자를 먼저 스캔해 주세요");
    const qty = Number(receivedQty);
    if (!receivedQty || Number.isNaN(qty) || qty <= 0) {
      return t("pda.receiving.qtyMin", "입고수량은 1 이상이어야 합니다.");
    }
    if (!warehouseCode) {
      return t("pda.receiving.warehouseRequired", "입고 창고를 선택해 주세요.");
    }
    return undefined;
  }, [currentWorker, receivedQty, warehouseCode, t]);

  return (
    <>
      <PdaHeader titleKey="pda.receiving.title" backPath="/pda/material/menu" />

      {/* 작업자 스캔/등록 바 */}
      <WorkerBar
        worker={currentWorker}
        open={workerScanOpen}
        onToggle={() => {
          setWorkerScanOpen((v) => !v);
          setWorkerError(null);
        }}
        onScan={onWorkerScan}
        isLoading={workerLoading}
        error={workerError}
      />

      {/* 시리얼 바코드 스캔 (작업자 등록 후 활성화) */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.receiving.scanBarcode"
        disabled={!!scannedData || !currentWorker || workerScanOpen}
        isLoading={isScanning}
      />

      {/* 스캔 결과 (성공만; 오류는 다이얼로그) */}
      {scannedData && (
        <ScanResultCard
          fields={resultFields}
          variant="success"
          title={t("pda.scan.success")}
        />
      )}

      {/* 특채 안내 */}
      {scannedData?.isConcession && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg border border-amber-500 text-amber-600 text-xs font-medium">
          {t("material.concession.accepted", "특채")}
        </div>
      )}

      {/* 스캔 전 안내 */}
      {!scannedData && !isScanning && currentWorker && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.receiving.scanBarcode")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.receiving.title")}
            </p>
          </div>
        </div>
      )}

      {/* 입고수량 / 창고 입력 */}
      {scannedData && (
        <div className="px-4 mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.receivedQty")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white"
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.warehouse")}
            </label>
            <WarehouseSelect
              value={warehouseCode}
              onChange={(v) => setWarehouseCode(v)}
              warehouseType="RAW"
              autoSelectDefault
              fullWidth
            />
          </div>
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={(item) => <ReceivingHistoryRow item={item} />}
        keyExtractor={(item, idx) => `${item.matUid}-${idx}`}
      />

      {/* 하단 버튼 */}
      {scannedData && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.receiving.confirmReceive"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isConfirming,
              disabled: !receivedQty || Number(receivedQty) <= 0 || !warehouseCode || !currentWorker,
              disabledReason: receiveDisabledReason,
            },
            {
              label: t("pda.scan.nextScan"),
              onClick: onNextScan,
              variant: "secondary",
            },
          ]}
        />
      )}

      {/* 사용자용 오류 다이얼로그 (닫으면 입고창 클리어) */}
      <PdaErrorDialog open={!!dialogMessage} message={dialogMessage} onClose={onCloseDialog} />
    </>
  );
}
