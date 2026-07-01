/**
 * @file quality/defect/components/DefectFormPanel.tsx
 * @description 불량 수동 등록 패널 — 검사불량 입력과 동일한 우측 슬라이드 패널 패턴
 *
 * 초보자 가이드:
 * 1. 제품 바코드 스캔(주 식별자) 또는 작업지시 번호로 대상 생산실적 식별
 * 2. 불량유형 선택 시 등급(defectGrade)·범위(defectScope) 자동 표시
 * 3. 수량·원인 입력 후 저장: POST /quality/defect-logs
 *    (검사를 통하지 않고 발생한 불량을 직접 등록하는 화면)
 */

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import QtyInput from "@/components/shared/QtyInput";
import api from "@/services/api";
import toast from "react-hot-toast";

export interface DefectCodeOption {
  defectCode: string;
  defectName: string;
  defectGrade: string;
  defectScope: string;
}

interface Props {
  isOpen: boolean;
  defectCodeOptions: DefectCodeOption[];
  defectCodeLoading: boolean;
  onClose: () => void;
  onSave: () => void;
}

const INITIAL_FORM = { prdUid: "", defectCode: "", qty: "" };

interface ScannedInfo {
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
}

/** API 에러에서 사용자용 메시지 추출 */
function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}


export default function DefectFormPanel({
  isOpen,
  defectCodeOptions,
  defectCodeLoading,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [scannedInfo, setScannedInfo] = useState<ScannedInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  /** 패널이 열릴 때마다 폼·스캔 정보 초기화 + 바코드 입력란 포커스 */
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setScannedInfo(null);
      setTimeout(() => barcodeRef.current?.focus(), 320);
    }
  }, [isOpen]);

  const lookupBarcode = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) { setScannedInfo(null); return; }
    setScanning(true);
    try {
      const res = await api.get(`/quality/continuity-inspect/fg-label/${encodeURIComponent(trimmed)}`);
      const d = res.data?.data ?? res.data;
      setScannedInfo({
        itemCode: d.itemCode ?? "",
        itemName: d.itemName ?? null,
        orderNo: d.orderNo ?? null,
      });
    } catch {
      setScannedInfo(null);
    } finally {
      setScanning(false);
    }
  };

  const canSave = form.prdUid.trim() !== "" && form.defectCode !== "";

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const selectedCode = defectCodeOptions.find((c) => c.defectCode === form.defectCode);
      await api.post("/quality/defect-logs", {
        prdUid: form.prdUid.trim(),
        defectCode: form.defectCode,
        ...(selectedCode?.defectName && { defectName: selectedCode.defectName }),
        qty: Number(form.qty) || 1,
      });
      toast.success(t("common.register"));
      onSave();
      onClose();
    } catch (e) {
      toast.error(errMessage(e, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs transition-[width] duration-300 ease-in-out ${
        isOpen ? "w-[480px]" : "w-0"
      }`}
    >
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          {t("quality.defect.register", "불량 등록")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setForm(INITIAL_FORM); setScannedInfo(null); setTimeout(() => barcodeRef.current?.focus(), 0); }} disabled={saving}>
            {t("common.cancel", "취소")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface text-text-muted hover:text-text" title={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <>
            {/* 불량 대상 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">
                {t("quality.defect.target", "불량 대상")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    {t("quality.defect.productBarcode", "제품 바코드")}
                  </label>
                  <BarcodeScanInput
                    ref={barcodeRef}
                    placeholder={t("quality.defect.productBarcodePlaceholder", "제품 바코드를 스캔하세요")}
                    value={form.prdUid}
                    onChange={(value) => {
                      setForm((p) => ({ ...p, prdUid: value }));
                    }}
                    onScan={(value) => {
                      const clean = value.replace(/\r?\n|\r/g, "").trim();
                      setForm((p) => ({ ...p, prdUid: clean }));
                      lookupBarcode(clean);
                    }}
                    onBlur={() => lookupBarcode(form.prdUid)}
                    className={`font-mono ${scanning ? "animate-pulse" : ""}`}
                    fullWidth
                  />
                  {/* 스캔 결과 표시 */}
                  {scannedInfo && (
                    <div className="mt-1.5 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-0.5">
                      <div className="flex gap-2">
                        <span className="text-text-muted w-16 shrink-0">{t("common.partCode", "품목코드")}</span>
                        <span className="font-mono font-medium text-text">{scannedInfo.itemCode}</span>
                      </div>
                      {scannedInfo.itemName && (
                        <div className="flex gap-2">
                          <span className="text-text-muted w-16 shrink-0">{t("common.partName", "품목명")}</span>
                          <span className="text-text">{scannedInfo.itemName}</span>
                        </div>
                      )}
                      {scannedInfo.orderNo && (
                        <div className="flex gap-2">
                          <span className="text-text-muted w-16 shrink-0">{t("quality.defect.workOrder", "작업지시")}</span>
                          <span className="font-mono text-primary">{scannedInfo.orderNo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 불량 정보 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">
                {t("quality.defect.info", "불량 정보")}
              </h3>
              <div className="space-y-3">
                {/* 불량 코드 목록 선택 */}
                <div>
                  <label className="block text-xs font-medium text-text mb-1.5">
                    {t("quality.defect.defectCode", "불량 코드")}
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  {defectCodeLoading ? (
                    <div className="flex items-center justify-center h-16 text-text-muted text-xs">로딩 중...</div>
                  ) : defectCodeOptions.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-text-muted text-xs border border-border rounded-lg">
                      등록된 공정 불량 코드가 없습니다
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto rounded-lg border border-border p-1">
                      {defectCodeOptions.map((code) => (
                        <button
                          key={code.defectCode}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, defectCode: code.defectCode }))}
                          className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                            form.defectCode === code.defectCode
                              ? "bg-primary text-white"
                              : "hover:bg-surface text-text"
                          }`}
                        >
                          <span className="font-medium">{code.defectName}</span>
                          <span className={`font-mono text-[10px] ${form.defectCode === code.defectCode ? "text-white/70" : "text-text-muted"}`}>
                            {code.defectCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <QtyInput
                  label={t("quality.defect.quantity", "수량")}
                  placeholder="1"
                  value={Number(form.qty) || 0}
                  onChange={(n) => setForm((p) => ({ ...p, qty: String(n) }))}
                  fullWidth
                />
              </div>
            </div>

            {/* 안내 */}
            <p className="text-[11px] text-text-muted bg-surface/50 border border-border/50 rounded p-2 leading-relaxed">
              {t(
                "quality.defect.registerHint",
                "제품 바코드를 스캔하면 해당 제품의 생산실적에 불량이 연결됩니다.",
              )}
            </p>
          </>
      </div>
    </div>
  );
}
