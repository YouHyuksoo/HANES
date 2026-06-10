"use client";

/**
 * @file src/components/material/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 - 시리얼 스캔 후 시리얼별 검사항목 판정
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, Upload, ScanLine } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import type { IqcItem, IqcResultForm } from "@/hooks/material/useIqcData";
import api from "@/services/api";

interface IqcInspectItem {
  itemCode: string;
  seq: number;
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

interface PendingSerial {
  matUid: string;
  initQty: number;
  currentQty: number;
}

interface SerialInspection {
  result: "PASS" | "FAIL" | "";
  rows: MeasurementRow[];
}

interface IqcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: IqcItem | null;
  form: IqcResultForm;
  setForm: React.Dispatch<React.SetStateAction<IqcResultForm>>;
  onSubmit: (
    details?: unknown,
    overrideResult?: string,
    extra?: { inspectClass?: string; sampleQty?: number; certFile?: File; sampleBarcode?: string },
  ) => void;
}

function judgeValue(value: string, lsl: number | null, usl: number | null): "PASS" | "FAIL" | "" {
  if (!value.trim()) return "";
  if (lsl === null && usl === null) return "PASS";
  const num = parseFloat(value);
  if (Number.isNaN(num)) return "";
  if (lsl !== null && num < lsl) return "FAIL";
  if (usl !== null && num > usl) return "FAIL";
  return "PASS";
}

function normalizeScanValue(value: string) {
  return value.replace(/[\r\n]+/g, "").trim();
}

function createMeasurementRows(items: IqcInspectItem[]): MeasurementRow[] {
  return items.map((item) => ({
    itemId: `${item.itemCode}::${item.seq}`,
    inspectItem: item.inspectItem,
    spec: item.spec || "",
    lsl: item.lsl,
    usl: item.usl,
    unit: item.unit || "",
    measuredValue: "",
    judge: "",
  }));
}

function getSerialResult(inspection: SerialInspection | undefined): "PASS" | "FAIL" | "" {
  if (!inspection) return "";
  if (inspection.rows.length === 0) return inspection.result;
  if (inspection.rows.some((row) => !row.judge)) return "";
  return inspection.rows.some((row) => row.judge === "FAIL") ? "FAIL" : "PASS";
}

export default function IqcModal({ isOpen, onClose, selectedItem, form, setForm, onSubmit }: IqcModalProps) {
  const { t } = useTranslation();
  const [inspectItems, setInspectItems] = useState<IqcInspectItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pendingSerials, setPendingSerials] = useState<PendingSerial[]>([]);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [selectedSerial, setSelectedSerial] = useState("");
  const [serialInspectionMap, setSerialInspectionMap] = useState<Record<string, SerialInspection>>({});
  const [serialScanValue, setSerialScanValue] = useState("");
  const [scanSerialError, setScanSerialError] = useState("");
  const [inspectClass, setInspectClass] = useState("SAMPLE");
  const [sampleQty, setSampleQty] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const serialScanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inspectClassOptions = useMemo(() => [
    { value: "FULL", label: t("material.iqc.inspectClassFull", "전수검사") },
    { value: "SAMPLE", label: t("material.iqc.inspectClassSample", "선별검사") },
    { value: "NONE", label: t("material.iqc.inspectClassNone", "무검사") },
  ], [t]);

  useEffect(() => {
    if (!isOpen || !selectedItem) {
      setInspectItems([]);
      setPendingSerials([]);
      setScannedSerials([]);
      setSelectedSerial("");
      setSerialInspectionMap({});
      setSerialScanValue("");
      setScanSerialError("");
      setInspectClass("SAMPLE");
      setSampleQty("");
      setCertFile(null);
      return;
    }

    const focusTimer = window.setTimeout(() => serialScanInputRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen, selectedItem]);

  useEffect(() => {
    if (!isOpen || !selectedItem) return;

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const res = await api.get("/master/iqc-items", { params: { itemCode: selectedItem.itemCode } });
        setInspectItems(res.data?.data ?? []);
      } catch {
        setInspectItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [isOpen, selectedItem]);

  useEffect(() => {
    if (!isOpen || !selectedItem) return;

    api.get("/material/iqc-history/pending-serials", {
      params: { arrivalNo: selectedItem.arrivalNo, itemCode: selectedItem.itemCode },
    })
      .then((res) => setPendingSerials(res.data?.data ?? []))
      .catch(() => setPendingSerials([]));
  }, [isOpen, selectedItem]);

  useEffect(() => {
    if (inspectItems.length === 0) return;
    setSerialInspectionMap((prev) => {
      const next = { ...prev };
      for (const matUid of scannedSerials) {
        if (!next[matUid] || next[matUid].rows.length === 0) {
          next[matUid] = { result: "", rows: createMeasurementRows(inspectItems) };
        }
      }
      return next;
    });
  }, [inspectItems, scannedSerials]);

  const findPendingSerial = useCallback((rawSerial: string) => {
    const normalized = rawSerial.toUpperCase();
    return pendingSerials.find((serial) => serial.matUid.toUpperCase() === normalized) ?? null;
  }, [pendingSerials]);

  const handleSerialScan = useCallback((rawValue?: string) => {
    const scanned = normalizeScanValue(rawValue ?? serialScanValue);
    if (!scanned) return;

    const matched = findPendingSerial(scanned);
    if (!matched) {
      setScanSerialError(t("material.iqc.serialNotFound", "검사대기 시리얼이 아닙니다: {{serial}}", { serial: scanned }));
      setSerialScanValue("");
      serialScanInputRef.current?.focus();
      return;
    }

    setScanSerialError("");
    setScannedSerials((prev) => prev.includes(matched.matUid) ? prev : [...prev, matched.matUid]);
    setSerialInspectionMap((prev) => ({
      ...prev,
      [matched.matUid]: prev[matched.matUid] ?? {
        result: "",
        rows: createMeasurementRows(inspectItems),
      },
    }));
    setSelectedSerial(matched.matUid);
    setSerialScanValue("");
    window.setTimeout(() => serialScanInputRef.current?.focus(), 0);
  }, [findPendingSerial, inspectItems, serialScanValue, t]);

  const updateSerialMeasurement = useCallback((matUid: string, idx: number, value: string) => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[matUid];
      if (!inspection) return prev;
      const rows = [...inspection.rows];
      rows[idx] = {
        ...rows[idx],
        measuredValue: value,
        judge: judgeValue(value, rows[idx].lsl, rows[idx].usl),
      };
      return { ...prev, [matUid]: { ...inspection, rows } };
    });
  }, []);

  const updateSerialJudge = useCallback((matUid: string, idx: number, judge: "PASS" | "FAIL") => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[matUid];
      if (!inspection) return prev;
      const rows = [...inspection.rows];
      rows[idx] = { ...rows[idx], measuredValue: judge, judge };
      return { ...prev, [matUid]: { ...inspection, rows } };
    });
  }, []);

  const updateSerialSimpleResult = useCallback((matUid: string, result: "PASS" | "FAIL") => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[matUid] ?? { rows: [], result: "" };
      return { ...prev, [matUid]: { ...inspection, result } };
    });
  }, []);

  const serialInspectionPayload = useMemo(() => {
    return scannedSerials.map((matUid) => {
      const serial = pendingSerials.find((s) => s.matUid === matUid);
      const inspection = serialInspectionMap[matUid];
      return {
        matUid,
        qty: serial?.currentQty ?? serial?.initQty ?? null,
        result: getSerialResult(inspection),
        items: (inspection?.rows ?? []).map((row) => ({
          itemId: row.itemId,
          inspectItem: row.inspectItem,
          spec: row.spec,
          measuredValue: row.measuredValue,
          judge: row.judge,
          lsl: row.lsl,
          usl: row.usl,
          unit: row.unit,
        })),
      };
    });
  }, [pendingSerials, scannedSerials, serialInspectionMap]);

  const selectedInspection = selectedSerial ? serialInspectionMap[selectedSerial] : undefined;
  const selectedPendingSerial = selectedSerial
    ? pendingSerials.find((serial) => serial.matUid === selectedSerial)
    : undefined;
  const hasInspectItems = inspectItems.length > 0;
  const isIncomplete = serialInspectionPayload.some((serial) => !serial.result);
  const passCount = serialInspectionPayload.filter((serial) => serial.result === "PASS").length;
  const failCount = serialInspectionPayload.filter((serial) => serial.result === "FAIL").length;
  const anyFail = failCount > 0;
  const canSubmit = scannedSerials.length > 0 && !loadingItems && !isIncomplete;

  const handleSerialSubmit = useCallback(() => {
    if (!selectedItem || !canSubmit) return;

    const verdict = anyFail ? "FAILED" : "PASSED";
    setForm((prev) => ({ ...prev, result: verdict as IqcResultForm["result"] }));
    onSubmit({
      type: "SERIAL_INSPECTION",
      serials: serialInspectionPayload,
    }, verdict, {
      inspectClass,
      sampleQty: sampleQty ? parseInt(sampleQty, 10) : undefined,
      certFile: certFile ?? undefined,
      sampleBarcode: scannedSerials.join(","),
    });
  }, [anyFail, canSubmit, certFile, inspectClass, onSubmit, sampleQty, scannedSerials, selectedItem, serialInspectionPayload, setForm]);

  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.iqc.modalTitle")} size="2xl">
      <div className="space-y-4">
        <div className="p-3 bg-background rounded-lg grid grid-cols-2 gap-x-6 gap-y-1">
          <p className="text-sm text-text-muted">{t("material.iqc.arrivalNoLabel")}: <span className="font-medium text-text">{selectedItem.arrivalNo}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.supplierLabel")}: <span className="font-medium text-text">{selectedItem.supplierName}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.partLabel")}: <span className="font-medium text-text">{selectedItem.itemName} ({selectedItem.itemCode})</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.serialCount", "시리얼수")}: <span className="font-medium text-text">{selectedItem.serialCount.toLocaleString()}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.totalQty", "총수량")}: <span className="font-medium text-text">{selectedItem.totalQty.toLocaleString()} {selectedItem.unit}</span></p>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-surface border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">{t("material.iqc.serialJudge", "시리얼별 판정")}</p>
                <p className="text-xs text-text-muted">
                  {t("material.iqc.serialScanGuide", "시리얼을 스캔한 뒤 왼쪽 목록에서 선택하고 오른쪽 검사항목을 판정합니다.")}
                </p>
              </div>
              <div className="text-xs text-text-muted">
                {scannedSerials.length.toLocaleString()} / {pendingSerials.length.toLocaleString()}
              </div>
            </div>
            <div className="mt-2 relative">
              <ScanLine className="absolute left-2.5 top-2.5 w-4 h-4 text-text-muted" />
              <input
                ref={serialScanInputRef}
                value={serialScanValue}
                onChange={(e) => setSerialScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSerialScan();
                  }
                }}
                placeholder={t("material.iqc.serialScanPlaceholder", "시리얼을 스캔하거나 입력 후 Enter")}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {scanSerialError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{scanSerialError}</p>
            )}
          </div>

          <div className="grid grid-cols-12 min-h-[320px]">
            <div className="col-span-4 border-r border-border bg-background/40">
              <div className="px-3 py-2 border-b border-border text-xs font-medium text-text-muted">
                {t("material.iqc.scannedSerials", "스캔한 시리얼")}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {scannedSerials.length === 0 ? (
                  <div className="p-4 text-sm text-text-muted text-center">
                    {t("material.iqc.scanFirst", "시리얼을 먼저 스캔하세요.")}
                  </div>
                ) : (
                  scannedSerials.map((matUid, idx) => {
                    const result = getSerialResult(serialInspectionMap[matUid]);
                    return (
                      <button
                        key={matUid}
                        type="button"
                        onClick={() => setSelectedSerial(matUid)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left border-b border-border hover:bg-surface ${
                          selectedSerial === matUid ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-text-muted">{idx + 1}</p>
                          <p className="font-mono text-sm text-text truncate">{matUid}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          result === "PASS"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : result === "FAIL"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-surface text-text-muted"
                        }`}>
                          {result || t("material.iqc.pendingJudge", "대기")}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="col-span-8">
              {!selectedSerial ? (
                <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-text-muted">
                  {t("material.iqc.selectScannedSerial", "왼쪽에서 스캔한 시리얼을 선택하세요.")}
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-text-muted">{t("material.iqc.selectedSerial", "선택 시리얼")}</p>
                      <p className="font-mono font-semibold text-text">{selectedSerial}</p>
                    </div>
                    <p className="text-sm text-text-muted">
                      {t("material.iqc.qty", "수량")}: {(selectedPendingSerial?.currentQty ?? selectedPendingSerial?.initQty ?? 0).toLocaleString()}
                    </p>
                  </div>

                  {loadingItems ? (
                    <div className="p-8 text-center text-sm text-text-muted">{t("common.loading")}</div>
                  ) : hasInspectItems && selectedInspection ? (
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-surface">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-text-muted">#</th>
                            <th className="text-left px-3 py-2 font-medium text-text-muted">{t("material.iqc.inspectItem", "검사항목")}</th>
                            <th className="text-left px-3 py-2 font-medium text-text-muted">{t("material.iqc.spec", "규격")}</th>
                            <th className="text-center px-3 py-2 font-medium text-text-muted">{t("material.iqc.measuredValue", "측정값")}</th>
                            <th className="text-center px-3 py-2 font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspection.rows.map((row, idx) => (
                            <tr key={row.itemId} className="border-t border-border hover:bg-surface/50">
                              <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-text">{row.inspectItem}</td>
                              <td className="px-3 py-2 text-text-muted">
                                {row.spec || [row.lsl !== null ? `LSL ${row.lsl}` : null, row.usl !== null ? `USL ${row.usl}` : null].filter(Boolean).join(" / ") || "-"}
                              </td>
                              <td className="px-3 py-1 text-center">
                                {row.lsl === null && row.usl === null ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      type="button"
                                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        row.judge === "PASS"
                                          ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/40 dark:text-green-300 font-semibold"
                                          : "bg-surface text-text-muted border-border hover:bg-green-50 hover:text-green-700"
                                      }`}
                                      onClick={() => updateSerialJudge(selectedSerial, idx, "PASS")}
                                    >PASS</button>
                                    <button
                                      type="button"
                                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        row.judge === "FAIL"
                                          ? "bg-red-100 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 font-semibold"
                                          : "bg-surface text-text-muted border-border hover:bg-red-50 hover:text-red-700"
                                      }`}
                                      onClick={() => updateSerialJudge(selectedSerial, idx, "FAIL")}
                                    >FAIL</button>
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    step="any"
                                    className="w-24 px-2 py-1 text-center border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={row.measuredValue}
                                    onChange={(e) => updateSerialMeasurement(selectedSerial, idx, e.target.value)}
                                    placeholder={row.unit}
                                  />
                                )}
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
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">{t("material.iqc.noInspectItems", "이 품목에 등록된 IQC 검사항목이 없습니다. 수동으로 합불 판정해주세요.")}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={selectedInspection?.result === "PASS" ? "primary" : "secondary"} onClick={() => updateSerialSimpleResult(selectedSerial, "PASS")}>PASS</Button>
                        <Button size="sm" variant={selectedInspection?.result === "FAIL" ? "danger" : "secondary"} onClick={() => updateSerialSimpleResult(selectedSerial, "FAIL")}>FAIL</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-3 py-2 bg-surface border-t border-border flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {scannedSerials.length === 0
                ? <span className="text-text-muted">{t("material.iqc.noScannedSerials", "스캔한 시리얼이 없습니다.")}</span>
                : isIncomplete
                  ? <span className="text-amber-600 dark:text-amber-300">{t("material.iqc.incompleteSerialJudge", "판정이 끝나지 않은 시리얼이 있습니다.")}</span>
                  : anyFail
                    ? <span className="text-red-600 dark:text-red-400">FAIL {failCount} / PASS {passCount}</span>
                    : <span className="text-green-600 dark:text-green-400">PASS {passCount}</span>}
            </span>
            <Button size="sm" variant={anyFail ? "danger" : "primary"} onClick={handleSerialSubmit} disabled={!canSubmit}>
              {anyFail ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              {t("material.iqc.serialSubmit", "검사결과 등록")} ({scannedSerials.length})
            </Button>
          </div>
        </div>

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

        <div className="grid grid-cols-3 gap-4">
          <Select
            label={t("material.iqc.inspectClassLabel", "검사분류")}
            options={inspectClassOptions}
            value={inspectClass}
            onChange={setInspectClass}
            fullWidth
          />
          <Input
            label={t("material.iqc.sampleQty", "샘플 시료수량")}
            type="number"
            min={0}
            placeholder="0"
            value={sampleQty}
            onChange={(e) => setSampleQty(e.target.value)}
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              {t("material.iqc.certFile", "검사성적서")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-1" />
              {certFile ? certFile.name : t("material.iqc.uploadCert", "파일 선택")}
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        </div>
      </div>
    </Modal>
  );
}
