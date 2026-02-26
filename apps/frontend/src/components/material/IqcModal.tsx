"use client";

/**
 * @file src/components/material/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 - 항목별 계측값 입력 + 자동 판정
 *
 * 초보자 가이드:
 * 1. 모달 오픈 시 해당 품목의 IQC 검사항목을 API에서 조회
 * 2. 각 항목별로 측정값(계측값) 입력 → LSL/USL 기준 자동 판정
 * 3. 전체 판정은 모든 항목 합격 시 합격, 하나라도 불합격이면 불합격
 * 4. 검사 상세 데이터는 details(JSON)로 저장
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import type { IqcItem, IqcResultForm } from "@/hooks/material/useIqcData";
import api from "@/services/api";

interface IqcInspectItem {
  id: string;
  inspectItem: string;
  spec: string | null;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
}

interface MeasurementRow {
  itemId: string;
  inspectItem: string;
  spec: string;
  lsl: number | null;
  usl: number | null;
  unit: string;
  measuredValue: string;
  judge: "PASS" | "FAIL" | "";
}

interface IqcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: IqcItem | null;
  form: IqcResultForm;
  setForm: React.Dispatch<React.SetStateAction<IqcResultForm>>;
  onSubmit: (details?: MeasurementRow[], overrideResult?: string) => void;
}

function judgeValue(value: string, lsl: number | null, usl: number | null): "PASS" | "FAIL" | "" {
  if (!value.trim()) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  if (lsl !== null && num < lsl) return "FAIL";
  if (usl !== null && num > usl) return "FAIL";
  return "PASS";
}

export default function IqcModal({ isOpen, onClose, selectedItem, form, setForm, onSubmit }: IqcModalProps) {
  const { t } = useTranslation();
  const [inspectItems, setInspectItems] = useState<IqcInspectItem[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const resultOptions = useMemo(() => [
    { value: "", label: t("material.iqc.resultSelect") },
    { value: "PASSED", label: t("material.iqc.passed") },
    { value: "FAILED", label: t("material.iqc.failed") },
  ], [t]);

  // 모달 열릴 때 품목별 검사항목 조회
  useEffect(() => {
    if (!isOpen || !selectedItem) {
      setInspectItems([]);
      setMeasurements([]);
      return;
    }
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const res = await api.get("/master/iqc-items", { params: { itemCode: selectedItem.itemCode } });
        const items: IqcInspectItem[] = res.data?.data ?? [];
        setInspectItems(items);
        setMeasurements(items.map((item) => ({
          itemId: item.id,
          inspectItem: item.inspectItem,
          spec: item.spec || "",
          lsl: item.lsl,
          usl: item.usl,
          unit: item.unit || "",
          measuredValue: "",
          judge: "",
        })));
      } catch {
        setInspectItems([]);
        setMeasurements([]);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchItems();
  }, [isOpen, selectedItem]);

  const updateMeasurement = useCallback((idx: number, value: string) => {
    setMeasurements((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        measuredValue: value,
        judge: judgeValue(value, updated[idx].lsl, updated[idx].usl),
      };
      return updated;
    });
  }, []);

  // 전체 자동 판정
  const overallJudge = useMemo(() => {
    if (measurements.length === 0) return form.result;
    const filled = measurements.filter((m) => m.measuredValue.trim());
    if (filled.length === 0) return form.result;
    const hasFail = filled.some((m) => m.judge === "FAIL");
    return hasFail ? "FAILED" : "PASSED";
  }, [measurements, form.result]);

  const handleSubmitWithDetails = useCallback(() => {
    const finalResult = overallJudge || form.result;
    if (!finalResult) return;
    setForm((prev) => ({ ...prev, result: finalResult as IqcResultForm["result"] }));
    onSubmit(measurements.length > 0 ? measurements : undefined, finalResult);
  }, [overallJudge, form.result, measurements, setForm, onSubmit]);

  if (!selectedItem) return null;

  const hasInspectItems = inspectItems.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.iqc.modalTitle")} size={hasInspectItems ? "xl" : "lg"}>
      <div className="space-y-4">
        {/* 입하 정보 표시 */}
        <div className="p-3 bg-background rounded-lg grid grid-cols-2 gap-x-6 gap-y-1">
          <p className="text-sm text-text-muted">{t("material.iqc.arrivalNoLabel")}: <span className="font-medium text-text">{selectedItem.receiveNo}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.supplierLabel")}: <span className="font-medium text-text">{selectedItem.supplierName}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.partLabel")}: <span className="font-medium text-text">{selectedItem.itemName} ({selectedItem.itemCode})</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.matUidLabel")}: <span className="font-medium text-text">{selectedItem.matUid}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.quantityLabel")}: <span className="font-medium text-text">{selectedItem.quantity.toLocaleString()} {selectedItem.unit}</span></p>
        </div>

        {/* 검사항목별 계측값 입력 */}
        {loadingItems && <p className="text-sm text-text-muted text-center py-4">{t("common.loading")}</p>}

        {hasInspectItems && !loadingItems && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-3 py-2 font-medium text-text-muted">#</th>
                  <th className="text-left px-3 py-2 font-medium text-text-muted">{t("material.iqc.inspectItem")}</th>
                  <th className="text-left px-3 py-2 font-medium text-text-muted">{t("material.iqc.spec")}</th>
                  <th className="text-center px-3 py-2 font-medium text-text-muted">LSL</th>
                  <th className="text-center px-3 py-2 font-medium text-text-muted">USL</th>
                  <th className="text-center px-3 py-2 font-medium text-text-muted">{t("material.iqc.measuredValue")}</th>
                  <th className="text-center px-3 py-2 font-medium text-text-muted">{t("material.iqc.judgment")}</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((row, idx) => (
                  <tr key={row.itemId} className="border-t border-border hover:bg-surface/50">
                    <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                    <td className="px-3 py-2 text-text font-medium">{row.inspectItem}</td>
                    <td className="px-3 py-2 text-text-muted">{row.spec || "-"}</td>
                    <td className="px-3 py-2 text-center text-text-muted">{row.lsl !== null ? row.lsl : "-"}</td>
                    <td className="px-3 py-2 text-center text-text-muted">{row.usl !== null ? row.usl : "-"}</td>
                    <td className="px-3 py-1 text-center">
                      <input
                        type="number"
                        step="any"
                        className="w-24 px-2 py-1 text-center border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary"
                        value={row.measuredValue}
                        onChange={(e) => updateMeasurement(idx, e.target.value)}
                        placeholder={row.unit || ""}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.judge === "PASS" && <CheckCircle className="w-5 h-5 text-green-500 inline" />}
                      {row.judge === "FAIL" && <XCircle className="w-5 h-5 text-red-500 inline" />}
                      {row.judge === "" && <span className="text-text-muted">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 전체 판정 */}
            <div className="flex items-center justify-end gap-2 px-3 py-2 bg-surface border-t border-border">
              <span className="text-sm font-medium text-text-muted">{t("material.iqc.overallJudge")}:</span>
              {overallJudge === "PASSED" && <span className="flex items-center gap-1 text-green-600 font-medium text-sm"><CheckCircle className="w-4 h-4" />{t("material.iqc.passed")}</span>}
              {overallJudge === "FAILED" && <span className="flex items-center gap-1 text-red-600 font-medium text-sm"><XCircle className="w-4 h-4" />{t("material.iqc.failed")}</span>}
              {!overallJudge && <span className="text-text-muted text-sm">-</span>}
            </div>
          </div>
        )}

        {/* 검사항목 없을 때 기존 방식 (단순 합불 판정) */}
        {!hasInspectItems && !loadingItems && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">{t("material.iqc.noInspectItems")}</p>
          </div>
        )}

        {/* 검사결과 (검사항목 없을 때만 수동 선택) */}
        {!hasInspectItems && !loadingItems && (
          <Select
            label={t("material.iqc.resultLabel")}
            options={resultOptions}
            value={form.result}
            onChange={(v) => setForm((prev) => ({ ...prev, result: v as IqcResultForm["result"] }))}
            fullWidth
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("material.iqc.inspectorLabel")}
            placeholder={t("material.iqc.inspectorPlaceholder")}
            value={form.inspector}
            onChange={(e) => setForm((prev) => ({ ...prev, inspector: e.target.value }))}
            fullWidth
          />
          <Input
            label={t("common.remark")}
            placeholder={t("material.iqc.remarkPlaceholder")}
            value={form.remark}
            onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            fullWidth
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-4 border-t border-border">
          {!hasInspectItems && (
            <>
              <Button className="flex-1" variant="secondary" onClick={() => { setForm((prev) => ({ ...prev, result: "FAILED" })); onSubmit(); }}>
                <XCircle className="w-4 h-4 mr-1 text-red-500" /> {t("material.iqc.failed")}
              </Button>
              <Button className="flex-1" onClick={() => { setForm((prev) => ({ ...prev, result: "PASSED" })); onSubmit(); }}>
                <CheckCircle className="w-4 h-4 mr-1" /> {t("material.iqc.passed")}
              </Button>
            </>
          )}
          {hasInspectItems && (
            <>
              <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
              <Button className="flex-1" onClick={handleSubmitWithDetails} disabled={!overallJudge}>
                {overallJudge === "FAILED" ? <XCircle className="w-4 h-4 mr-1 text-red-500" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                {overallJudge === "FAILED" ? t("material.iqc.submitFailed") : t("material.iqc.submitPassed")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
