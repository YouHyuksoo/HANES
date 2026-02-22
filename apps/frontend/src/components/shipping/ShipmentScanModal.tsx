"use client";

/**
 * @file src/components/shipping/ShipmentScanModal.tsx
 * @description 출하 확정 전 팔레트 바코드 스캔 검증 모달
 *
 * 초보자 가이드:
 * 1. LOADED → SHIPPED 상태 전환 시 팔레트 바코드 스캔 검증
 * 2. 출하에 할당된 팔레트 목록 표시 + 스캔 시 체크
 * 3. 모든 팔레트 스캔 완료 시 출하 확정 버튼 활성화
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, ScanLine, Package, AlertTriangle } from "lucide-react";
import { Button, Modal, Input } from "@/components/ui";
import api from "@/services/api";

interface PalletInfo {
  id: string;
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string;
  shipmentNo: string;
  onConfirm: () => void;
}

export default function ShipmentScanModal({ isOpen, onClose, shipmentId, shipmentNo, onConfirm }: Props) {
  const { t } = useTranslation();
  const [pallets, setPallets] = useState<PalletInfo[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPallets = useCallback(async () => {
    if (!shipmentId) return;
    setLoading(true);
    try {
      const res = await api.get(`/shipping/shipments/${shipmentId}/pallets`);
      setPallets(res.data?.data ?? []);
    } catch {
      setPallets([]);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (isOpen) {
      fetchPallets();
      setVerifiedIds(new Set());
      setScanInput("");
      setScanResult(null);
    }
  }, [isOpen, fetchPallets]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, pallets]);

  const allVerified = useMemo(
    () => pallets.length > 0 && verifiedIds.size >= pallets.length,
    [pallets, verifiedIds],
  );

  const handleScan = useCallback(async () => {
    const barcode = scanInput.trim();
    if (!barcode) return;

    // 이미 검증된 팔레트인지 로컬 체크
    const existingPallet = pallets.find((p) => p.palletNo === barcode);
    if (existingPallet && verifiedIds.has(existingPallet.id)) {
      setScanResult({ ok: true, msg: t("shipping.scan.alreadyVerified", "이미 검증된 팔레트입니다.") });
      setScanInput("");
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await api.post(`/shipping/shipments/${shipmentId}/verify-pallet`, { palletNo: barcode });
      const result = res.data?.data;

      if (result?.verified) {
        setVerifiedIds((prev) => new Set([...prev, result.palletId]));
        setScanResult({ ok: true, msg: `${barcode} ✓ (${result.boxCount}${t("shipping.confirm.box", "박스")}, ${result.totalQty}${t("common.ea", "개")})` });
      } else {
        const reason = result?.reason === "NOT_FOUND"
          ? t("shipping.scan.palletNotFound", "등록되지 않은 팔레트입니다.")
          : t("shipping.scan.wrongShipment", "이 출하에 속하지 않는 팔레트입니다.");
        setScanResult({ ok: false, msg: `${barcode} - ${reason}` });
      }
    } catch {
      setScanResult({ ok: false, msg: t("shipping.scan.verifyFailed", "검증에 실패했습니다.") });
    }

    setScanInput("");
    inputRef.current?.focus();
  }, [scanInput, shipmentId, pallets, verifiedIds, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  const handleConfirmShipped = useCallback(async () => {
    setConfirming(true);
    try {
      await api.post(`/shipping/shipments/${shipmentId}/mark-shipped`);
      onConfirm();
      onClose();
    } catch {
      setScanResult({ ok: false, msg: t("shipping.scan.confirmFailed", "출하 확정에 실패했습니다.") });
    } finally {
      setConfirming(false);
    }
  }, [shipmentId, onConfirm, onClose, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`${shipmentNo} - ${t("shipping.scan.title", "출하 스캔 검증")}`} size="lg">

      {/* 스캔 입력 */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <Input ref={inputRef} placeholder={t("shipping.scan.scanPlaceholder", "팔레트 바코드를 스캔하세요...")}
            value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleKeyDown}
            leftIcon={<ScanLine className="w-4 h-4" />} fullWidth />
        </div>
        <Button onClick={handleScan} disabled={!scanInput.trim()}>
          {t("shipping.scan.verify", "검증")}
        </Button>
      </div>

      {/* 스캔 결과 피드백 */}
      {scanResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
          scanResult.ok
            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        }`}>
          {scanResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{scanResult.msg}</span>
        </div>
      )}

      {/* 진행상황 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text">
          {t("shipping.scan.progress", "검증 진행")}
        </span>
        <span className={`text-sm font-bold ${allVerified ? "text-green-600 dark:text-green-400" : "text-text-muted"}`}>
          {verifiedIds.size} / {pallets.length}
        </span>
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
        <div className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: pallets.length > 0 ? `${(verifiedIds.size / pallets.length) * 100}%` : "0%" }} />
      </div>

      {/* 팔레트 목록 */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {loading ? (
          <p className="text-center text-text-muted py-4">{t("common.loading")}</p>
        ) : pallets.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>{t("shipping.scan.noPallets", "이 출하에 할당된 팔레트가 없습니다.")}</span>
          </div>
        ) : (
          pallets.map((pallet) => {
            const verified = verifiedIds.has(pallet.id);
            return (
              <div key={pallet.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                verified
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
                  : "border-border bg-surface"
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  verified
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}>
                  {verified && <CheckCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-text">{pallet.palletNo}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {pallet.boxCount} {t("shipping.confirm.box", "박스")}
                    </span>
                    <span>{pallet.totalQty.toLocaleString()} {t("common.ea", "개")}</span>
                  </div>
                </div>
                {verified && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t("shipping.scan.verified", "검증완료")}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleConfirmShipped} disabled={!allVerified || confirming}>
          {confirming ? t("common.saving") : t("shipping.scan.confirmShip", "출하 확정")}
        </Button>
      </div>
    </Modal>
  );
}
