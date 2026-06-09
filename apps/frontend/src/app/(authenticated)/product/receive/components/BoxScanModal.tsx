"use client";

/**
 * @file components/BoxScanModal.tsx
 * @description 박스 스캔 누적 → 일괄 입고 모달 (Method B)
 *
 * 초보자 가이드:
 * 1. 박스번호를 스캔/입력하면 목록에 누적
 * 2. CLOSED 상태 + 현재 탭 품목유형과 일치하는 박스만 추가
 * 3. 입고창고 지정 후 일괄입고
 * 4. 부분 실패 시 실패 박스를 명확히 표시
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine, Trash2, PackageCheck, AlertTriangle, X } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import { receiveBoxes, type ReceiveCandidate } from "./useBoxReceive";

interface BoxScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemType: "SEMI_PRODUCT" | "FINISHED";
}

interface ScannedBoxApi {
  boxNo: string;
  itemCode: string;
  qty: number;
  status: string;
  part?: { itemCode: string; itemName: string; itemType: string; unit: string } | null;
}

export default function BoxScanModal({ isOpen, onClose, onSuccess, itemType }: BoxScanModalProps) {
  const { t } = useTranslation();

  const warehouseType = itemType === "SEMI_PRODUCT" ? "WIP" : "FG";
  const { options: whOptions } = useWarehouseOptions(warehouseType);

  const [boxNo, setBoxNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [scanned, setScanned] = useState<ReceiveCandidate[]>([]);
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<{ boxNo: string; reason: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 모달 열릴 때 상태 초기화 + 포커스
  useEffect(() => {
    if (isOpen) {
      setBoxNo("");
      setScanned([]);
      setError("");
      setFailed([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleScan = useCallback(async () => {
    const code = boxNo.trim();
    if (!code) return;
    if (scanned.some((s) => s.boxNo === code)) {
      setError(t("productMgmt.receive.scanModal.alreadyAdded", { boxNo: code }));
      setBoxNo("");
      return;
    }
    setLooking(true);
    setError("");
    try {
      const res = await api.get(`/shipping/boxes/box-no/${encodeURIComponent(code)}`);
      const box = res.data?.data as ScannedBoxApi;
      const boxItemType = box.part?.itemType ?? "FINISHED";
      if (box.status !== "CLOSED") {
        setError(t("productMgmt.receive.boxScan.notClosed"));
      } else if (boxItemType !== itemType) {
        setError(t("productMgmt.receive.scanModal.typeMismatch"));
      } else {
        setScanned((prev) => [
          {
            boxNo: box.boxNo,
            itemCode: box.itemCode,
            itemName: box.part?.itemName ?? null,
            itemType: boxItemType,
            qty: Number(box.qty) || 0,
            status: box.status,
          },
          ...prev,
        ]);
        setBoxNo("");
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setLooking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [boxNo, scanned, itemType, t]);

  const removeOne = useCallback((code: string) => {
    setScanned((prev) => prev.filter((s) => s.boxNo !== code));
  }, []);

  const totalQty = scanned.reduce((s, c) => s + c.qty, 0);

  const handleReceive = useCallback(async () => {
    if (!warehouseId || scanned.length === 0) return;
    setSaving(true);
    setFailed([]);
    try {
      const result = await receiveBoxes(scanned, warehouseId);
      setFailed(result.failed);
      // 성공분 제거, 실패분만 유지
      const failedSet = new Set(result.failed.map((f) => f.boxNo));
      setScanned((prev) => prev.filter((s) => failedSet.has(s.boxNo)));
      onSuccess();
      if (result.failed.length === 0) onClose();
    } finally {
      setSaving(false);
    }
  }, [warehouseId, scanned, onSuccess, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("productMgmt.receive.scanModal.title")} size="lg">
      <div className="space-y-4">
        {/* 스캔 입력 + 창고 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              ref={inputRef}
              label={t("productMgmt.receive.boxScan.placeholder")}
              value={boxNo}
              onChange={(e) => setBoxNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScan();
              }}
              leftIcon={<ScanLine className="w-4 h-4" />}
              fullWidth
            />
          </div>
          <Button onClick={handleScan} disabled={looking || !boxNo.trim()}>
            {t("productMgmt.receive.scanModal.add")}
          </Button>
        </div>
        <div className="w-full">
          <Select
            label={t("productMgmt.receive.modal.warehouseId")}
            options={whOptions}
            value={warehouseId}
            onChange={setWarehouseId}
            fullWidth
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {failed.length > 0 && (
          <div className="p-3 rounded-md border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              {t("productMgmt.receive.boxList.partialFail", { count: failed.length })}
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {failed.map((f) => (
                <li key={f.boxNo}>
                  <span className="font-mono">{f.boxNo}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 스캔 목록 */}
        <div className="border border-border rounded-md max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted dark:bg-slate-800 sticky top-0">
              <tr className="text-left text-text-muted">
                <th className="px-3 py-2">{t("productMgmt.receive.boxScan.title")}</th>
                <th className="px-3 py-2">{t("common.partName")}</th>
                <th className="px-3 py-2 text-right">{t("common.quantity")}</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {scanned.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-text-muted">
                    {t("productMgmt.receive.scanModal.empty")}
                  </td>
                </tr>
              ) : (
                scanned.map((s) => (
                  <tr key={s.boxNo} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{s.boxNo}</td>
                    <td className="px-3 py-2">{s.itemName ?? s.itemCode}</td>
                    <td className="px-3 py-2 text-right font-medium">{s.qty.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeOne(s.boxNo)}
                        className="text-text-muted hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-muted">
            {t("productMgmt.receive.boxList.selectedTotal", { count: scanned.length })}{" "}
            <span className="text-primary font-medium">{totalQty.toLocaleString()}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              {t("common.close")}
            </Button>
            <Button onClick={handleReceive} disabled={saving || scanned.length === 0 || !warehouseId}>
              <PackageCheck className="w-4 h-4 mr-1" />
              {saving
                ? t("common.saving")
                : t("productMgmt.receive.boxList.receiveSelected", { count: scanned.length })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
