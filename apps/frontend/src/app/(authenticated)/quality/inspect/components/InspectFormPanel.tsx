/**
 * @file quality/inspect/components/InspectFormPanel.tsx
 * @description 외관검사 등록 패널 — FG_BARCODE 기반
 *
 * 초보자 가이드:
 * 1. 스캔된 FG_BARCODE의 라벨 정보 표시 (읽기전용)
 * 2. 합격/불합격 판정 버튼
 * 3. 불합격 시 불량 체크리스트 (ComCode VISUAL_DEFECT)
 * 4. 저장: POST /quality/inspect-results + PUT FG_LABELS status
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { FgLabelInfo, DefectCheckItem } from "../types";

interface Props {
  fgLabel: FgLabelInfo;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function InspectFormPanel({ fgLabel, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const defectOptions = useComCodeOptions("VISUAL_DEFECT");
  const alreadyInspected = fgLabel.status !== "ISSUED";

  const [passYn, setPassYn] = useState<"Y" | "N">("Y");
  const [errorCode, setErrorCode] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<DefectCheckItem[]>([]);

  useEffect(() => {
    if (defectOptions.length === 0) return;
    setChecklist(defectOptions.map((opt) => ({
      code: opt.value, name: opt.label, checked: false, qty: 0, remark: "",
    })));
  }, [defectOptions]);

  /** 폼 리셋 */
  useEffect(() => {
    setPassYn("Y");
    setErrorCode("");
    setErrorDetail("");
  }, [fgLabel]);

  const updateCheckItem = (code: string, field: keyof DefectCheckItem, value: boolean | number | string) => {
    setChecklist((prev) => prev.map((item) => item.code === code ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // 1. 검사결과 등록
      await api.post("/quality/inspect-results", {
        prodResultNo: null,
        inspectType: "VISUAL",
        inspectScope: "FULL",
        passYn,
        fgBarcode: fgLabel.fgBarcode,
        errorCode: passYn === "N" ? (errorCode || null) : null,
        errorDetail: passYn === "N" ? (errorDetail || null) : null,
        inspectData: passYn === "N" ? JSON.stringify(checklist.filter((c) => c.checked)) : null,
      });

      // 2. FG_LABELS 상태 업데이트
      const newStatus = passYn === "Y" ? "VISUAL_PASS" : "VISUAL_FAIL";
      await api.put(`/quality/continuity-inspect/fg-label-status/${fgLabel.fgBarcode}`, { status: newStatus });

      onSave();
      onClose();
    } catch { /* API 인터셉터 처리 */ }
    finally { setSaving(false); }
  };

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t("quality.inspect.registerInspect")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          {!alreadyInspected && (
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 라벨 정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.inspectInfo")}</h3>
          <div className="bg-surface rounded-lg p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">FG Barcode</span>
              <span className="font-mono font-bold text-primary">{fgLabel.fgBarcode}</span>
            </div>
            <InfoRow label={t("master.part.partCode", "품목코드")} value={fgLabel.itemCode} />
            <InfoRow label={t("production.result.orderNo", "작업지시")} value={fgLabel.orderNo || "-"} />
            <InfoRow label={t("production.result.equipCode", "설비")} value={fgLabel.equipCode || "-"} />
            <InfoRow label={t("common.status", "상태")} value={fgLabel.status} />
          </div>
        </div>

        {/* 이미 검사 완료된 경우 */}
        {alreadyInspected && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 text-center">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              {t("quality.inspect.alreadyInspected")} ({fgLabel.status})
            </p>
          </div>
        )}

        {/* 판정 */}
        {!alreadyInspected && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.judgement")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPassYn("Y")}
                  className={`flex items-center justify-center gap-2 py-4 rounded-lg border-2 font-bold text-sm transition-all ${
                    passYn === "Y" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "border-border bg-surface text-text-muted hover:border-green-300"
                  }`}>
                  <CheckCircle className="w-6 h-6" />{t("quality.inspect.pass")}
                </button>
                <button onClick={() => setPassYn("N")}
                  className={`flex items-center justify-center gap-2 py-4 rounded-lg border-2 font-bold text-sm transition-all ${
                    passYn === "N" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "border-border bg-surface text-text-muted hover:border-red-300"
                  }`}>
                  <XCircle className="w-6 h-6" />{t("quality.inspect.fail")}
                </button>
              </div>
            </div>

            {/* 불합격 시 체크리스트 */}
            {passYn === "N" && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.defectChecklist")}</h3>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.code} className={`rounded-lg border p-3 transition-colors ${item.checked ? "border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-900/20" : "border-border bg-surface"}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={item.checked} onChange={(e) => updateCheckItem(item.code, "checked", e.target.checked)} className="w-4 h-4 accent-red-500" />
                        <span className={`flex-1 text-xs font-medium ${item.checked ? "text-text" : "text-text-muted"}`}>{item.name}</span>
                        {item.checked && (
                          <Input type="number" value={String(item.qty)} onChange={(e) => updateCheckItem(item.code, "qty", Number(e.target.value))} className="w-20" placeholder={t("quality.inspect.defectQty")} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <ComCodeSelect groupCode="VISUAL_DEFECT" label={t("quality.inspect.mainDefectCode")} includeAll={false} value={errorCode} onChange={setErrorCode} fullWidth />
                  <Input label={t("quality.inspect.detailReason")} value={errorDetail} onChange={(e) => setErrorDetail(e.target.value)} fullWidth />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}
