"use client";

/**
 * @file src/app/pda/product/receiving/page.tsx
 * @description 제품 박스 입고 PDA 페이지 - 박스 스캔 → 창고 선택 → 입고 / 입고취소
 *
 * 워크플로우:
 * 1. 박스번호 스캔 → GET /shipping/boxes/box-no/{boxNo}
 * 2. CLOSED 상태 박스만 입고 가능 (SHIPPED=이미출하, OPEN=미마감 거부, 세션 중복입고 차단)
 * 3. 완제품 창고(FG) 선택 후 입고확인 → POST /inventory/fg/receive (반제품은 wip/receive)
 *    → PRODUCT_STOCKS 제품재고 증가, 응답 transNo 보관
 * 4. 입고 이력에서 입고취소 → POST /inventory/cancel {source:'product', transactionId:transNo}
 *    → 재고 역증가(차감). 데스크톱(제품입고관리)과 동일 백엔드 사용.
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
import { PackageCheck, RotateCcw, Loader2 } from "lucide-react";
import api from "@/services/api";

interface BoxData {
  boxNo: string;
  itemCode: string;
  qty: number;
  status: string;
  part?: { itemCode: string; itemName: string; itemType: string; unit: string } | null;
}

interface ReceiptItem {
  transNo: string;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  warehouseCode: string;
  canceled: boolean;
}

function errOf(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function ProductReceivingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();

  const [box, setBox] = useState<BoxData | null>(null);
  const [warehouseCode, setWarehouseCode] = useState("");
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cancelingNo, setCancelingNo] = useState("");
  const [history, setHistory] = useState<ReceiptItem[]>([]);

  const itemType = box?.part?.itemType ?? "FINISHED";
  const warehouseType = itemType === "SEMI_PRODUCT" ? "WIP" : "FG";
  const isFinished = itemType !== "SEMI_PRODUCT";

  const handleReset = useCallback(() => {
    setBox(null);
    setWarehouseCode("");
    setError("");
  }, []);

  /** 박스 스캔/조회 */
  const handleScan = useCallback(async (code: string) => {
    const v = code.trim();
    if (!v) return;
    setIsScanning(true);
    setError("");
    setBox(null);
    try {
      const res = await api.get(`/shipping/boxes/box-no/${encodeURIComponent(v)}`);
      const b = res.data?.data as BoxData | undefined;
      if (!b) {
        setError(t("pda.productReceiving.notFound"));
        playError();
        return;
      }
      if (b.status === "SHIPPED") {
        setError(t("pda.productReceiving.alreadyShipped"));
        playError();
        return;
      }
      if (b.status !== "CLOSED") {
        setError(t("pda.productReceiving.notClosed"));
        playError();
        return;
      }
      if (history.some((h) => h.boxNo === b.boxNo && !h.canceled)) {
        setError(t("pda.productReceiving.alreadyReceived"));
        playError();
        return;
      }
      setBox(b);
      playSuccess();
    } catch (e) {
      setError(errOf(e, t("common.error")));
      playError();
    } finally {
      setIsScanning(false);
    }
  }, [t, history, playSuccess, playError]);

  /** 하드웨어 스캐너 (박스 미선택 시에만) */
  useBarcodeDetector({ onScan: handleScan, enabled: !box });

  /** 입고 확인 */
  const handleReceive = useCallback(async () => {
    if (!box) return;
    if (!isFinished && !warehouseCode) return;
    setIsSaving(true);
    setError("");
    try {
      const endpoint = itemType === "SEMI_PRODUCT" ? "/inventory/wip/receive" : "/inventory/fg/receive";
      const res = await api.post(endpoint, {
        warehouseId: warehouseCode,
        itemCode: box.itemCode,
        qty: box.qty,
        refType: "BOX",
        refId: box.boxNo,
        remark: `PDA 박스입고:${box.boxNo}`,
      });
      const transNo = res.data?.data?.transNo as string;
      setHistory((prev) => [
        {
          transNo,
          boxNo: box.boxNo,
          itemCode: box.itemCode,
          itemName: box.part?.itemName ?? box.itemCode,
          qty: box.qty,
          warehouseCode,
          canceled: false,
        },
        ...prev,
      ]);
      playSuccess();
      handleReset();
    } catch (e) {
      setError(errOf(e, t("pda.productReceiving.receiveError")));
      playError();
    } finally {
      setIsSaving(false);
    }
  }, [box, warehouseCode, itemType, isFinished, t, playSuccess, playError, handleReset]);

  /** 입고 취소 */
  const handleCancel = useCallback(async (item: ReceiptItem) => {
    if (!item.transNo) return;
    setCancelingNo(item.transNo);
    setError("");
    try {
      await api.post("/inventory/cancel", {
        source: "product",
        transactionId: item.transNo,
        remark: `PDA 입고취소:${item.boxNo}`,
      });
      setHistory((prev) => prev.map((h) => (h.transNo === item.transNo ? { ...h, canceled: true } : h)));
      playSuccess();
    } catch (e) {
      setError(errOf(e, t("pda.productReceiving.cancelError")));
      playError();
    } finally {
      setCancelingNo("");
    }
  }, [t, playSuccess, playError]);

  const resultFields: ScanResultField[] = useMemo(() => {
    if (!box) return [];
    return [
      { label: t("pda.productReceiving.boxNo"), value: box.boxNo, highlight: true },
      { label: t("common.partCode"), value: box.part?.itemCode ?? box.itemCode },
      { label: t("common.partName"), value: box.part?.itemName ?? "-" },
      { label: t("pda.productReceiving.qty"), value: `${box.qty.toLocaleString()} ${box.part?.unit ?? ""}` },
    ];
  }, [box, t]);

  const receiveDisabledReason = useMemo(() => {
    if (!isFinished && !warehouseCode) return t("pda.productReceiving.selectWarehouse");
    return undefined;
  }, [isFinished, warehouseCode, t]);

  return (
    <>
      <PdaHeader titleKey="pda.productReceiving.title" backPath="/pda/menu" />

      {/* 박스 바코드 스캔 */}
      <ScanInput
        onScan={handleScan}
        placeholderKey="pda.productReceiving.scanBox"
        disabled={!!box}
        isLoading={isScanning}
      />

      {/* 스캔 결과 / 에러 */}
      {(box || error) && (
        <ScanResultCard
          fields={resultFields}
          variant={error ? "error" : "success"}
          title={error ? undefined : t("pda.scan.success")}
          errorMessage={error || undefined}
        />
      )}

      {/* 스캔 전 안내 */}
      {!box && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.productReceiving.scanBox")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.productReceiving.title")}
            </p>
          </div>
        </div>
      )}

      {/* 입고 창고 선택 */}
      {box && (
        <div className="px-4 mt-3 space-y-3">
          {isFinished ? (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-300">
              {t(
                "pda.productReceiving.fgAutoWarehouse",
                "완제품은 양품창고(FG 기본창고)로 자동 입고됩니다.",
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t("pda.productReceiving.warehouse")}
              </label>
              <WarehouseSelect
                value={warehouseCode}
                onChange={(v) => setWarehouseCode(v)}
                warehouseType={warehouseType}
                fullWidth
              />
            </div>
          )}
        </div>
      )}

      {/* 입고 이력 (입고취소 가능) */}
      <ScanHistoryList
        items={history}
        renderItem={(item) => (
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.boxNo}
                {item.canceled && (
                  <span className="ml-2 text-xs font-normal text-red-500">{t("pda.productReceiving.canceled")}</span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {item.itemName} · {item.qty.toLocaleString()} · {item.warehouseCode}
              </p>
            </div>
            {!item.canceled && (
              <button
                type="button"
                onClick={() => handleCancel(item)}
                disabled={cancelingNo === item.transNo}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                {cancelingNo === item.transNo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {t("pda.productReceiving.cancel")}
              </button>
            )}
          </div>
        )}
        keyExtractor={(item, idx) => `${item.transNo}-${idx}`}
      />

      {/* 하단 버튼 */}
      {box && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.productReceiving.confirmReceive"),
              onClick: handleReceive,
              variant: "primary",
              isLoading: isSaving,
              disabled: !isFinished && !warehouseCode,
              disabledReason: receiveDisabledReason,
            },
            {
              label: t("pda.scan.nextScan"),
              onClick: handleReset,
              variant: "secondary",
            },
          ]}
        />
      )}
    </>
  );
}
