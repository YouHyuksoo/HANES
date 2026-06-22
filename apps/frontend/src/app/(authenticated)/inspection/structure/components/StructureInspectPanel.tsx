"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, ScanLine } from "lucide-react";
import { Button, Input } from "@/components/ui";
import QtyInput from "@/components/shared/QtyInput";
import api from "@/services/api";
import type { FgLabelInfo, DefectCheckItem } from "../types";

interface Props {
  fgLabel: FgLabelInfo | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const STRUCTURE_DEFECT_ITEMS: DefectCheckItem[] = [
  { code: "DIM", name: "DIM'S", checked: false, qty: 0, remark: "" },
  { code: "MISSING_PART", name: "부재자 누락", checked: false, qty: 0, remark: "" },
];

export default function StructureInspectPanel({ fgLabel, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();

  const [passYn, setPassYn] = useState<"Y" | "N">("Y");
  const [errorDetail, setErrorDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<DefectCheckItem[]>(
    STRUCTURE_DEFECT_ITEMS.map((item) => ({ ...item }))
  );

  const updateCheckItem = (code: string, field: keyof DefectCheckItem, value: boolean | number | string) => {
    setChecklist((prev) => prev.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async () => {
    if (!fgLabel) return;
    setSaving(true);
    try {
      const checkedItems = checklist.filter((c) => c.checked);
      const errorCode = passYn === "N" ? (checkedItems.map((c) => c.code).join(",") || null) : null;

      await api.post(`/quality/continuity-inspect/structure-inspect/${fgLabel.fgBarcode}`, {
        passYn,
        errorCode,
        errorDetail: passYn === "N" ? (errorDetail || null) : null,
        inspectData: passYn === "N" ? JSON.stringify(checkedItems) : null,
      });

      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t("inspection.structure.title", "구조검사")}</h2>
        {fgLabel && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {!fgLabel ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
            <ScanLine className="w-16 h-16 opacity-20" />
            <p className="text-sm">{t("inspection.structure.scanPlaceholder", "FG 바코드를 스캔 또는 입력하세요")}</p>
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.inspectInfo", "검사정보")}</h3>
              <div className="bg-surface rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">FG Barcode</span>
                  <span className="font-mono font-bold text-primary">{fgLabel.fgBarcode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("master.part.partCode", "품목코드")}</span>
                  <span className="text-text font-medium">{fgLabel.itemCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("production.result.orderNo", "작업지시")}</span>
                  <span className="text-text font-medium">{fgLabel.orderNo || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("common.status", "상태")}</span>
                  <span className="text-text font-medium">{fgLabel.status}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.judgement", "판정")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPassYn("Y")}
                  className={`flex items-center justify-center gap-2 py-4 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
                    passYn === "Y" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "border-border bg-surface text-text-muted hover:border-green-300"
                  }`}>
                  <CheckCircle className="w-6 h-6" />{t("quality.inspect.pass")}
                </button>
                <button onClick={() => setPassYn("N")}
                  className={`flex items-center justify-center gap-2 py-4 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
                    passYn === "N" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "border-border bg-surface text-text-muted hover:border-red-300"
                  }`}>
                  <XCircle className="w-6 h-6" />{t("quality.inspect.fail")}
                </button>
              </div>
            </div>

            {passYn === "N" && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("inspection.structure.defectChecklist", "불량항목")}</h3>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.code} className={`rounded-lg border p-3 transition-colors ${item.checked ? "border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-900/20" : "border-border bg-surface"}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={item.checked} onChange={(e) => updateCheckItem(item.code, "checked", e.target.checked)} className="w-4 h-4 accent-red-500" />
                        <span className={`flex-1 text-xs font-medium ${item.checked ? "text-text" : "text-text-muted"}`}>{item.name}</span>
                        {item.checked && (
                          <QtyInput value={item.qty} onChange={(n) => updateCheckItem(item.code, "qty", n)} className="w-20" placeholder={t("quality.inspect.defectQty", "수량")} />
                        )}
                      </div>
                      {item.checked && (
                        <div className="mt-2 ml-7">
                          <Input value={item.remark} onChange={(e) => updateCheckItem(item.code, "remark", e.target.value)} placeholder={t("quality.inspect.detailReason", "상세사유")} fullWidth />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Input label={t("quality.inspect.detailReason", "비고")} value={errorDetail} onChange={(e) => setErrorDetail(e.target.value)} fullWidth />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
