"use client";

/**
 * @file src/components/material/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 - 시리얼 스캔 후 시리얼별 검사항목 판정
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, Upload, ScanLine } from "lucide-react";
import { Button, Modal } from "@/components/ui";
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
    extra?: { sampleQty?: number; certFile?: File; sampleBarcode?: string },
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
  const [sampleQty, setSampleQty] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const serialScanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedItem) {
      setInspectItems([]);
      setPendingSerials([]);
      setScannedSerials([]);
      setSelectedSerial("");
      setSerialInspectionMap({});
      setSerialScanValue("");
      setScanSerialError("");
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
        // 품목→IQC 검사그룹→검사항목풀 체인으로 유효 검사항목 전체를 해석한다.
        // (기존 /master/iqc-items는 IQC_ITEM_MASTERS만 봐서 일부 항목·검사기준 누락)
        const res = await api.get(
          `/master/iqc-part-links/resolve-items/${encodeURIComponent(selectedItem.itemCode)}`,
        );
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
      sampleQty: sampleQty ? parseInt(sampleQty, 10) : undefined,
      certFile: certFile ?? undefined,
      sampleBarcode: scannedSerials.join(","),
    });
  }, [anyFail, canSubmit, certFile, onSubmit, sampleQty, scannedSerials, selectedItem, serialInspectionPayload, setForm]);

  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.iqc.modalTitle")} size="full">
      <div className="flex h-[calc(75vh-32px)] max-h-[620px] flex-col gap-1.5 overflow-hidden">
        <div className="grid grid-cols-12 gap-1.5 rounded-lg bg-background p-1.5">
          <div className="col-span-7 grid grid-cols-4 gap-x-3 gap-y-1 rounded-md bg-surface px-2.5 py-1.5 text-xs">
            <p className="min-w-0 text-text-muted">{t("material.iqc.arrivalNoLabel")}: <span className="font-semibold text-text">{selectedItem.arrivalNo}</span></p>
            <p className="min-w-0 text-text-muted">{t("material.iqc.supplierLabel")}: <span className="font-semibold text-text">{selectedItem.supplierName}</span></p>
            <p className="min-w-0 text-text-muted">{t("material.iqc.serialCount", "시리얼수")}: <span className="font-semibold text-text">{selectedItem.serialCount.toLocaleString()}</span></p>
            <p className="min-w-0 text-text-muted">{t("material.iqc.totalQty", "총수량")}: <span className="font-semibold text-text">{selectedItem.totalQty.toLocaleString()} {selectedItem.unit}</span></p>
            <p className="col-span-4 min-w-0 truncate text-text-muted" title={`${selectedItem.itemName} (${selectedItem.itemCode})`}>
              {t("material.iqc.partLabel")}: <span className="font-semibold text-text">{selectedItem.itemName} ({selectedItem.itemCode})</span>
            </p>
          </div>

          <div className="col-span-5 relative">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-text">{t("material.iqc.serialJudge", "시리얼별 판정")}</span>
              <span className="text-xs text-text-muted">{scannedSerials.length.toLocaleString()} / {pendingSerials.length.toLocaleString()}</span>
            </div>
            <ScanLine className="absolute left-2.5 top-7 w-4 h-4 text-text-muted" />
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
              className="h-9 w-full pl-8 pr-3 text-sm rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {scanSerialError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{scanSerialError}</p>
            )}
          </div>

          <div className="col-span-12 grid grid-cols-12 gap-1.5">
            <label className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.inspectorLabel")}</span>
              <input
                value={form.inspector}
                onChange={(e) => setForm((prev) => ({ ...prev, inspector: e.target.value }))}
                placeholder={t("material.iqc.inspectorPlaceholder")}
                className="h-7 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="col-span-4">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("common.remark")}</span>
              <input
                value={form.remark}
                onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                placeholder={t("material.iqc.remarkPlaceholder")}
                className="h-7 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.sampleQty", "시료수량")}</span>
              <input
                type="number"
                min={0}
                value={sampleQty}
                onChange={(e) => setSampleQty(e.target.value)}
                placeholder="0"
                className="h-7 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <div className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.certFile", "검사성적서")}</span>
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
                className="h-7 w-full min-w-0 justify-start truncate px-2 text-xs"
              >
                <Upload className="mr-1 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{certFile ? certFile.name : t("material.iqc.uploadCert", "파일 선택")}</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
          <div className="grid min-h-0 flex-1 grid-cols-12">
            <div className="col-span-4 flex min-h-0 flex-col border-r border-border bg-background/40">
              <div className="px-3 py-2 border-b border-border text-xs font-medium text-text-muted">
                {t("material.iqc.scannedSerials", "스캔한 시리얼")}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
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
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-medium text-text-muted">#</th>
                            <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.inspectItem", "검사항목")}</th>
                            <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.spec", "규격")}</th>
                            <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.measuredValue", "측정값")}</th>
                            <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspection.rows.map((row, idx) => (
                            <tr key={row.itemId} className="border-t border-border hover:bg-surface/50">
                              <td className="px-2 py-1.5 text-text-muted">{idx + 1}</td>
                              <td className="px-2 py-1.5 font-medium text-text">{row.inspectItem}</td>
                              <td className="px-2 py-1.5 text-text-muted">
                                {row.spec || [row.lsl !== null ? `LSL ${row.lsl}` : null, row.usl !== null ? `USL ${row.usl}` : null].filter(Boolean).join(" / ") || "-"}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {row.lsl === null && row.usl === null ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      type="button"
                                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                        row.judge === "PASS"
                                          ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/40 dark:text-green-300 font-semibold"
                                          : "bg-surface text-text-muted border-border hover:bg-green-50 hover:text-green-700"
                                      }`}
                                      onClick={() => updateSerialJudge(selectedSerial, idx, "PASS")}
                                    >PASS</button>
                                    <button
                                      type="button"
                                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
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
                                    className="h-7 w-24 px-2 text-center border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={row.measuredValue}
                                    onChange={(e) => updateSerialMeasurement(selectedSerial, idx, e.target.value)}
                                    placeholder={row.unit}
                                  />
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {row.judge === "PASS" && <CheckCircle className="w-4 h-4 text-green-500 inline" />}
                                {row.judge === "FAIL" && <XCircle className="w-4 h-4 text-red-500 inline" />}
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

          <div className="px-3 py-1.5 bg-surface border-t border-border flex items-center justify-between gap-2">
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
      </div>
    </Modal>
  );
}
