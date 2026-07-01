"use client";

/**
 * @file src/components/material/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 - 시리얼 스캔 후 시리얼별 검사항목 판정
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, Upload, ScanLine, ListChecks, X } from "lucide-react";
import { Button, Modal, ComCodeBadge, Select } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import { useWorkerOptions } from "@/hooks/useMasterOptions";
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
  judgeMethod?: string;
  judgeCriteria: string | null;
  defectGrade?: string | null;
  inspectionLevel?: string | null;
  aql?: number | null;
  inspItemCode?: string;
  inspectionType?: string | null;
  sampleMethod?: string | null;
  sampleQty?: number | null;
}

interface MeasurementRow {
  itemId: string;
  inspectItem: string;
  spec: string;
  lsl: number | null;
  usl: number | null;
  unit: string;
  judgeMethod: string;
  judgeCriteria: string;
  measuredValue: string;
  judge: "PASS" | "FAIL" | "";
  defectGrade: string | null;
  inspectionLevel: string | null;
  aql: number | null;
}

interface PendingSerial {
  matUid: string;
  initQty: number;
  currentQty: number;
}

interface ScannedSerialSample {
  scanKey: string;
  matUid: string;
}

interface SerialInspection {
  result: "PASS" | "FAIL" | "";
  rows: MeasurementRow[];
}

interface AqlPolicyPreview {
  inspectionLevel: string;
  inspectionMode: string;
  sampleQty: number;
  itemResults?: Array<{
    seq: number;
    inspItemCode?: string | null;
    defectGrade?: string | null;
    inspectionLevel?: string | null;
    aql?: number | null;
    acceptQty?: number | null;
    rejectQty?: number | null;
    inspectionType?: string | null;
    requiredQty?: number | null;
    inspectedQty?: number | null;
  }>;
  majorRule?: { aqlCode: string; acceptQty: number; rejectQty: number } | null;
  minorRule?: { aqlCode: string; acceptQty: number; rejectQty: number } | null;
}

interface DefectCodeOption {
  defectCode: string;
  defectName: string;
  defectGrade?: string | null;
}

interface DefectRow {
  defectCode: string;
  qty: string;
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
    extra?: {
      sampleQty?: number;
      certFile?: File;
      sampleBarcode?: string;
      defects?: Array<{ defectCode: string; qty: number }>;
    },
  ) => void;
}

/** IQC 검사자 후보 부서 (작업자관리 WORKER_MASTERS.DEPT 기준) */
const INSPECTOR_DEPT = "품질팀";

const MAX_SAMPLE_BARCODE_BYTES = 500;
const EMPTY_DEFECT_ROW: DefectRow = { defectCode: "", qty: "1" };

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function buildSampleBarcode(serials: string[]) {
  const values = serials.map((serial) => serial.trim()).filter(Boolean);
  const joined = values.join(",");
  if (utf8Bytes(joined) <= MAX_SAMPLE_BARCODE_BYTES) return joined;

  const kept: string[] = [];
  for (const value of values) {
    const next = [...kept, value];
    const remaining = values.length - next.length;
    const suffix = remaining > 0 ? `...(+${remaining} more)` : "";
    const candidate = suffix ? `${next.join(",")},${suffix}` : next.join(",");
    if (utf8Bytes(candidate) > MAX_SAMPLE_BARCODE_BYTES) break;
    kept.push(value);
  }

  const remaining = values.length - kept.length;
  return remaining > 0
    ? `${kept.length > 0 ? `${kept.join(",")},` : ""}...(+${remaining} more)`
    : kept.join(",");
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
    judgeMethod: item.judgeMethod || "",
    judgeCriteria: item.judgeCriteria || "",
    measuredValue: "",
    judge: "",
    defectGrade: item.defectGrade ?? null,
    inspectionLevel: item.inspectionLevel ?? null,
    aql: item.aql ?? null,
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
  const { options: workerOptions } = useWorkerOptions(INSPECTOR_DEPT);
  const inspectorOptions = useMemo(
    () => workerOptions.map((o) => ({ value: o.label, label: o.label })),
    [workerOptions],
  );
  const [inspectItems, setInspectItems] = useState<IqcInspectItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pendingSerials, setPendingSerials] = useState<PendingSerial[]>([]);
  const [scannedSerials, setScannedSerials] = useState<ScannedSerialSample[]>([]);
  const [selectedSerial, setSelectedSerial] = useState("");
  const [serialInspectionMap, setSerialInspectionMap] = useState<Record<string, SerialInspection>>({});
  const [serialScanValue, setSerialScanValue] = useState("");
  const [scanSerialError, setScanSerialError] = useState("");
  const [sampleQty, setSampleQty] = useState("");
  const [aqlPolicy, setAqlPolicy] = useState<AqlPolicyPreview | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [showPendingList, setShowPendingList] = useState(false);
  const [destructInputs, setDestructInputs] = useState<Record<number, { inspectedQty: string; defectQty: string }>>({});
  const [defectCodeOptions, setDefectCodeOptions] = useState<DefectCodeOption[]>([]);
  const [defectRows, setDefectRows] = useState<DefectRow[]>([EMPTY_DEFECT_ROW]);
  const serialScanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanSequenceRef = useRef(0);

  useEffect(() => {
    if (!isOpen || !selectedItem) {
      setInspectItems([]);
      setPendingSerials([]);
      setScannedSerials([]);
      setSelectedSerial("");
      setSerialInspectionMap({});
      scanSequenceRef.current = 0;
      setSerialScanValue("");
      setScanSerialError("");
      setSampleQty("");
      setAqlPolicy(null);
      setCertFile(null);
      setDestructInputs({});
      setDefectCodeOptions([]);
      setDefectRows([EMPTY_DEFECT_ROW]);
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
        // 검사항목 + 기본 시료수를 병렬로 조회한다.
        const [itemsRes, specRes] = await Promise.allSettled([
          api.get(`/master/iqc-part-specs/${encodeURIComponent(selectedItem.itemCode)}/resolve-items`),
          api.get(`/master/iqc-part-specs/${encodeURIComponent(selectedItem.itemCode)}`),
        ]);

        setInspectItems(itemsRes.status === 'fulfilled' ? (itemsRes.value.data?.data ?? []) : []);

        if (specRes.status === 'fulfilled' && specRes.value.data?.data?.sampleQty) {
          setSampleQty(String(specRes.value.data.data.sampleQty));
        }
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
    if (!isOpen || !selectedItem) return;

    api.get("/quality/defect-codes/options", {
      params: selectedItem.defectModelGroup ? { productType: selectedItem.defectModelGroup } : undefined,
    })
      .then((res) => setDefectCodeOptions(res.data?.data ?? []))
      .catch(() => setDefectCodeOptions([]));
  }, [isOpen, selectedItem]);

  useEffect(() => {
    if (!isOpen || !selectedItem) return;

    api.get("/quality/aql/resolve-iqc-items", {
      params: {
        itemCode: selectedItem.itemCode,
        vendorCode: selectedItem.vendorCode,
        lotQty: selectedItem.totalQty,
      },
    })
      .then((res) => setAqlPolicy(res.data?.data ?? null))
      .catch(() => setAqlPolicy(null));
  }, [isOpen, selectedItem]);

  const aqlItems = useMemo(
    () => inspectItems.filter((it) => (it.inspectionType ?? 'AQL').toUpperCase() === 'AQL'),
    [inspectItems],
  );
  const destructItems = useMemo(
    () => inspectItems.filter((it) => ['DESTRUCTIVE', 'FULL'].includes((it.inspectionType ?? 'AQL').toUpperCase())),
    [inspectItems],
  );

  const aqlItemSummary = useMemo(() => {
    const itemResults = aqlPolicy?.itemResults ?? [];
    return {
      total: itemResults.length,
      fixed: itemResults.filter((item) => {
        const type = String(item.inspectionType ?? '').toUpperCase();
        return type === 'DESTRUCTIVE' || type === 'FULL' || item.requiredQty != null || item.inspectedQty != null;
      }).length,
      rules: itemResults
        .filter((item) => item.acceptQty != null || item.rejectQty != null || item.requiredQty != null)
        .slice(0, 3),
    };
  }, [aqlPolicy?.itemResults]);

  useEffect(() => {
    if (aqlItems.length === 0) return;
    setSerialInspectionMap((prev) => {
      const next = { ...prev };
      for (const sample of scannedSerials) {
        if (!next[sample.scanKey] || next[sample.scanKey].rows.length === 0) {
          next[sample.scanKey] = { result: "", rows: createMeasurementRows(aqlItems) };
        }
      }
      return next;
    });
  }, [aqlItems, scannedSerials]);

  useEffect(() => {
    setDestructInputs((prev) => {
      const next = { ...prev };
      for (const it of destructItems) {
        if (!next[it.seq]) next[it.seq] = { inspectedQty: String(it.sampleQty ?? ''), defectQty: '0' };
      }
      return next;
    });
  }, [destructItems]);

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
    scanSequenceRef.current += 1;
    const sample = {
      scanKey: `${matched.matUid}::${scanSequenceRef.current}`,
      matUid: matched.matUid,
    };
    setScannedSerials((prev) => [...prev, sample]);
    setSerialInspectionMap((prev) => ({
      ...prev,
      [sample.scanKey]: prev[sample.scanKey] ?? {
        result: "",
        rows: createMeasurementRows(aqlItems),
      },
    }));
    setSelectedSerial(sample.scanKey);
    setSerialScanValue("");
    window.setTimeout(() => serialScanInputRef.current?.focus(), 0);
  }, [findPendingSerial, aqlItems, serialScanValue, t]);

  const handleAddAllPending = useCallback(() => {
    if (pendingSerials.length === 0) return;
    const samples = pendingSerials.map((serial) => {
      scanSequenceRef.current += 1;
      return {
        scanKey: `${serial.matUid}::${scanSequenceRef.current}`,
        matUid: serial.matUid,
      };
    });
    setScannedSerials((prev) => [...prev, ...samples]);
    setSerialInspectionMap((prev) => {
      const next = { ...prev };
      for (const sample of samples) {
        if (!next[sample.scanKey]) next[sample.scanKey] = { result: "", rows: createMeasurementRows(aqlItems) };
      }
      return next;
    });
    setSelectedSerial(samples[0].scanKey);
  }, [pendingSerials, aqlItems]);

  const handleRemoveSerial = useCallback((scanKey: string) => {
    setScannedSerials((prev) => prev.filter((sample) => sample.scanKey !== scanKey));
    setSerialInspectionMap((prev) => {
      const next = { ...prev };
      delete next[scanKey];
      return next;
    });
    setSelectedSerial((prev) => (prev === scanKey ? "" : prev));
  }, []);

  const updateSerialMeasurement = useCallback((scanKey: string, idx: number, value: string) => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[scanKey];
      if (!inspection) return prev;
      const rows = [...inspection.rows];
      rows[idx] = {
        ...rows[idx],
        measuredValue: value,
        judge: judgeValue(value, rows[idx].lsl, rows[idx].usl),
      };
      return { ...prev, [scanKey]: { ...inspection, rows } };
    });
  }, []);

  const updateSerialJudge = useCallback((scanKey: string, idx: number, judge: "PASS" | "FAIL") => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[scanKey];
      if (!inspection) return prev;
      const rows = [...inspection.rows];
      rows[idx] = { ...rows[idx], measuredValue: judge, judge };
      return { ...prev, [scanKey]: { ...inspection, rows } };
    });
  }, []);

  const updateSerialSimpleResult = useCallback((scanKey: string, result: "PASS" | "FAIL") => {
    setSerialInspectionMap((prev) => {
      const inspection = prev[scanKey] ?? { rows: [], result: "" };
      return { ...prev, [scanKey]: { ...inspection, result } };
    });
  }, []);

  const serialInspectionPayload = useMemo(() => {
    return scannedSerials.map((sample, index) => {
      const serial = pendingSerials.find((s) => s.matUid === sample.matUid);
      const inspection = serialInspectionMap[sample.scanKey];
      return {
        matUid: sample.matUid,
        sampleNo: index + 1,
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
  const selectedScannedSerial = selectedSerial
    ? scannedSerials.find((sample) => sample.scanKey === selectedSerial)
    : undefined;
  const selectedPendingSerial = selectedSerial
    ? pendingSerials.find((serial) => serial.matUid === selectedScannedSerial?.matUid)
    : undefined;
  const hasInspectItems = inspectItems.length > 0;
  const unscannedPending = pendingSerials;
  const isIncomplete = serialInspectionPayload.some((serial) => !serial.result);
  const passCount = serialInspectionPayload.filter((serial) => serial.result === "PASS").length;
  const failCount = serialInspectionPayload.filter((serial) => serial.result === "FAIL").length;
  const anyFail = failCount > 0;

  const destructivePayload = useMemo(() => destructItems.map((it) => {
    const v = destructInputs[it.seq] ?? { inspectedQty: '', defectQty: '0' };
    const defectQty = Number(v.defectQty) || 0;
    return {
      seq: it.seq,
      inspItemCode: it.inspItemCode ?? '',
      requiredQty: it.sampleQty ?? null,
      inspectedQty: Number(v.inspectedQty) || 0,
      defectQty,
      result: defectQty > 0 ? 'FAIL' : 'PASS',
    };
  }), [destructItems, destructInputs]);
  const anyDestructFail = destructivePayload.some((d) => d.result === 'FAIL');
  const hasDefectCodeRows = defectRows.some((row) => row.defectCode && Number(row.qty) > 0);
  const needsDefectCode = (anyFail || anyDestructFail) && !hasDefectCodeRows;
  const hasContradictingDefectCodes = !(anyFail || anyDestructFail) && hasDefectCodeRows;
  const canSubmit = (scannedSerials.length > 0 || (aqlItems.length === 0 && destructItems.length > 0))
    && !loadingItems
    && !isIncomplete
    && (!needsDefectCode || hasDefectCodeRows)
    && !hasContradictingDefectCodes;

  const defectPayload = useMemo(() => defectRows
    .map((row) => ({ defectCode: row.defectCode, qty: Number(row.qty) || 0 }))
    .filter((row) => row.defectCode && row.qty > 0), [defectRows]);
  const defectSelectOptions = useMemo(() => [
    { value: "", label: "-" },
    ...defectCodeOptions.map((option) => ({
      value: option.defectCode,
      label: `${option.defectCode} - ${option.defectName}`,
    })),
  ], [defectCodeOptions]);

  const updateDefectRow = useCallback((index: number, patch: Partial<DefectRow>) => {
    setDefectRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }, []);

  const addDefectRow = useCallback(() => {
    setDefectRows((prev) => [...prev, { ...EMPTY_DEFECT_ROW }]);
  }, []);

  const removeDefectRow = useCallback((index: number) => {
    setDefectRows((prev) => prev.length <= 1 ? [EMPTY_DEFECT_ROW] : prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSerialSubmit = useCallback(() => {
    if (!selectedItem || !canSubmit) return;

    const verdict = (anyFail || anyDestructFail) ? "FAILED" : "PASSED";
    setForm((prev) => ({ ...prev, result: verdict as IqcResultForm["result"] }));
    onSubmit({
      type: "SERIAL_INSPECTION",
      serials: serialInspectionPayload,
      destructive: destructivePayload,
    }, verdict, {
      sampleQty: sampleQty ? Number(sampleQty) : undefined,
      certFile: certFile ?? undefined,
      sampleBarcode: buildSampleBarcode(scannedSerials.map((serial) => serial.matUid)),
      defects: defectPayload,
    });
  }, [anyDestructFail, anyFail, canSubmit, certFile, defectPayload, destructivePayload, onSubmit, sampleQty, scannedSerials, selectedItem, serialInspectionPayload, setForm]);

  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.iqc.modalTitle")} size="full">
      <div className="flex h-[calc(75vh-32px)] max-h-[620px] flex-col gap-2 overflow-hidden">
        {/* 상단: 입하 정보 */}
        <div className="grid grid-cols-5 gap-x-4 gap-y-0.5 rounded-md bg-surface px-3 py-1.5 text-xs flex-shrink-0">
          <p className="min-w-0 truncate text-text-muted">{t("material.iqc.arrivalNoLabel")}: <span className="font-semibold text-text">{selectedItem.arrivalNo}</span></p>
          <p className="min-w-0 truncate text-text-muted">{t("material.iqc.supplierLabel")}: <span className="font-semibold text-text">{selectedItem.supplierName}</span></p>
          <p className="min-w-0 truncate text-text-muted">{t("material.iqc.serialCount", "시리얼수")}: <span className="font-semibold text-text">{selectedItem.serialCount.toLocaleString()}</span></p>
          <p className="min-w-0 truncate text-text-muted">{t("material.iqc.totalQty", "총수량")}: <span className="font-semibold text-text">{selectedItem.totalQty.toLocaleString()} {selectedItem.unit}</span></p>
          <p className="min-w-0 truncate text-text-muted" title={`${selectedItem.itemName} (${selectedItem.itemCode})`}>
            {t("material.iqc.partLabel")}: <span className="font-semibold text-text">{selectedItem.itemName} ({selectedItem.itemCode})</span>
          </p>
        </div>

        {/* 본문 3컬럼: 입력폼 / 스캔시리얼 / 측정 */}
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
          {/* 좌측: 입력 폼 (위→아래) */}
          <div className="col-span-3 flex min-h-0 flex-col gap-2.5 overflow-y-auto rounded-lg border border-border bg-background/40 p-2.5">
            {/* 시리얼 스캔 + 검사대기 조회 */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-text">{t("material.iqc.serialScan", "시리얼 스캔")}</span>
                <span className="text-xs text-text-muted">{scannedSerials.length.toLocaleString()} / {pendingSerials.length.toLocaleString()}</span>
              </div>
              <div>
                <BarcodeScanInput
                  ref={serialScanInputRef}
                  value={serialScanValue}
                  onChange={setSerialScanValue}
                  onScan={handleSerialScan}
                  placeholder={t("material.iqc.serialScanPlaceholder", "시리얼을 스캔하거나 입력 후 Enter")}
                  className="h-9 text-sm"
                  fullWidth
                />
              </div>
              {scanSerialError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{scanSerialError}</p>
              )}
              <button
                type="button"
                onClick={() => setShowPendingList((v) => !v)}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text transition-colors hover:border-primary hover:text-primary"
              >
                <ListChecks className="h-3.5 w-3.5" />
                {t("material.iqc.viewPending", "검사대기 시리얼 조회")} ({unscannedPending.length})
              </button>
              {showPendingList && (
                <div className="mt-1 overflow-hidden rounded-md border border-border bg-surface">
                  <div className="flex items-center justify-between border-b border-border px-2 py-1">
                    <span className="text-[11px] text-text-muted">{t("material.iqc.pendingSerials", "검사대기")} {unscannedPending.length}</span>
                    <button
                      type="button"
                      onClick={handleAddAllPending}
                      disabled={unscannedPending.length === 0}
                      className="text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
                    >
                      {t("material.iqc.addAll", "전체 추가")}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {unscannedPending.length === 0 ? (
                      <div className="px-2 py-3 text-center text-[11px] text-text-muted">
                        {t("material.iqc.noPending", "검사대기 시리얼이 없습니다.")}
                      </div>
                    ) : (
                      unscannedPending.map((p) => (
                        <button
                          key={p.matUid}
                          type="button"
                          onClick={() => handleSerialScan(p.matUid)}
                          className="flex w-full items-center justify-between gap-2 border-b border-border/50 px-2 py-1.5 text-left text-xs hover:bg-primary/5"
                        >
                          <span className="truncate font-mono text-text">{p.matUid}</span>
                          <span className="shrink-0 text-text-muted">{(p.currentQty ?? p.initQty ?? 0).toLocaleString()}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 검사자 */}
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.inspectorLabel")}</span>
              <Select
                options={inspectorOptions}
                value={form.inspector}
                onChange={(v) => setForm((prev) => ({ ...prev, inspector: v }))}
                placeholder={t("material.iqc.inspectorPlaceholder")}
                fullWidth
              />
            </label>

            {/* 비고 */}
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("common.remark")}</span>
              <input
                value={form.remark}
                onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                placeholder={t("material.iqc.remarkPlaceholder")}
                className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>

            {/* 기본시료수 */}
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.basicSampleQty", "기본시료수")}</span>
              <input
                type="number"
                min={0}
                value={sampleQty}
                onChange={(e) => setSampleQty(e.target.value)}
                placeholder="0"
                className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>

            {/* AQL 샘플수량 */}
            <div className="rounded border border-border bg-background px-2 py-1.5">
              <span className="block text-[11px] font-medium leading-none text-text-muted">{t("material.iqc.aqlSampleQty", "AQL 샘플수량")}</span>
              <span className="mt-1 block text-xs font-semibold text-text">
                {aqlPolicy ? `${aqlPolicy.sampleQty.toLocaleString()} / ${aqlPolicy.inspectionLevel} / ${aqlPolicy.inspectionMode}` : "-"}
              </span>
              {aqlPolicy && (
                <span className="mt-1 block text-[10px] leading-tight text-text-muted">
                  검사항목 기준 {aqlItemSummary.total}건
                  {aqlItemSummary.fixed > 0 ? ` · 파괴/고정 ${aqlItemSummary.fixed}건` : ""}
                </span>
              )}
              {aqlItemSummary.rules.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {aqlItemSummary.rules.map((item) => (
                    <div key={`${item.seq}-${item.inspItemCode ?? ''}`} className="flex min-w-0 items-center justify-between gap-1 text-[10px] text-text-muted">
                      <span className="truncate">{item.inspItemCode ?? `SEQ ${item.seq}`} {item.defectGrade ?? ""}</span>
                      <span className="shrink-0 tabular-nums">
                        {item.acceptQty != null || item.rejectQty != null
                          ? `Ac/Re ${item.acceptQty ?? "-"}/${item.rejectQty ?? "-"}`
                          : `시료 ${item.requiredQty ?? "-"}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 검사성적서 */}
            <div className="block">
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
                className="h-8 w-full min-w-0 justify-start truncate px-2 text-xs"
              >
                <Upload className="mr-1 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{certFile ? certFile.name : t("material.iqc.uploadCert", "파일 선택")}</span>
              </Button>
            </div>

            {/* 파괴/전수 검사 */}
            {destructItems.length > 0 && (
              <div className="rounded border border-border bg-background p-1.5">
                <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">
                  {t("material.iqc.destructive", "파괴/전수 검사")}
                </span>
                <div className="space-y-1">
                  {destructItems.map((it) => {
                    const v = destructInputs[it.seq] ?? { inspectedQty: '', defectQty: '0' };
                    const defectN = Number(v.defectQty) || 0;
                    return (
                      <div key={it.seq} className="grid grid-cols-[1fr_44px_44px] items-center gap-1">
                        <span className="truncate text-[11px] text-text" title={it.inspectItem}>
                          {it.inspectItem}
                          <span className="ml-1 text-text-muted">({it.sampleQty ?? '-'})</span>
                        </span>
                        <input
                          type="number" min={0} value={v.inspectedQty}
                          onChange={(e) => setDestructInputs((p) => ({ ...p, [it.seq]: { ...v, inspectedQty: e.target.value } }))}
                          className="h-7 min-w-0 rounded border border-border bg-surface px-1 text-xs text-text"
                          title={t("material.iqc.inspectedQty", "검사수량")}
                        />
                        <input
                          type="number" min={0} value={v.defectQty}
                          onChange={(e) => setDestructInputs((p) => ({ ...p, [it.seq]: { ...v, defectQty: e.target.value } }))}
                          className={`h-7 min-w-0 rounded border px-1 text-xs ${defectN > 0 ? 'border-red-400 text-red-600' : 'border-border text-text'} bg-surface`}
                          title={t("material.iqc.defectQty", "불량수")}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-text-muted">{t("material.iqc.destructiveHint", "검사수량 / 불량수 — 불량 1건이면 FAIL")}</p>
              </div>
            )}

            {(anyFail || anyDestructFail || hasDefectCodeRows) && (
              <div className="rounded border border-border bg-background p-1.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="block text-[11px] font-medium leading-none text-text-muted">
                    {t("material.iqc.defectCode", "불량코드")}
                  </span>
                  <button
                    type="button"
                    onClick={addDefectRow}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {t("common.add", "추가")}
                  </button>
                </div>
                <div className="space-y-1">
                  {defectRows.map((row, index) => {
                    const selectedDefect = defectCodeOptions.find((option) => option.defectCode === row.defectCode);
                    return (
                      <div key={index} className="grid grid-cols-[1fr_48px_24px] items-center gap-1">
                        <Select
                          options={defectSelectOptions}
                          value={row.defectCode}
                          onChange={(defectCode) => updateDefectRow(index, { defectCode })}
                          fullWidth
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.qty}
                          onChange={(e) => updateDefectRow(index, { qty: e.target.value })}
                          className="h-8 min-w-0 rounded border border-border bg-surface px-1 text-xs text-text"
                          title={t("material.iqc.defectQty", "불량수")}
                        />
                        <button
                          type="button"
                          onClick={() => removeDefectRow(index)}
                          className="flex h-8 w-6 items-center justify-center rounded text-text-muted hover:bg-red-50 hover:text-red-600"
                          title={t("common.delete", "삭제")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {selectedDefect?.defectGrade && (
                          <span className="col-span-3 text-[10px] text-text-muted">
                            {t("material.iqc.defectGrade", "등급")}: <ComCodeBadge groupCode="DEFECT_GRADE" code={selectedDefect.defectGrade} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {needsDefectCode && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                    {t("material.iqc.defectCodeRequired", "FAIL 판정에는 불량코드와 불량수가 필요합니다.")}
                  </p>
                )}
                {hasContradictingDefectCodes && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                    {t("material.iqc.defectCodeContradiction", "PASS 판정에는 불량코드를 입력할 수 없습니다.")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 중간: 스캔한 시리얼 목록 */}
          <div className="col-span-3 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background/40">
            <div className="px-3 py-2 border-b border-border text-xs font-medium text-text-muted flex-shrink-0">
              {t("material.iqc.scannedSerials", "스캔한 시리얼")} ({scannedSerials.length})
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {scannedSerials.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">
                  {t("material.iqc.scanFirst", "시리얼을 먼저 스캔하세요.")}
                </div>
              ) : (
                scannedSerials.map((sample, idx) => {
                  const result = getSerialResult(serialInspectionMap[sample.scanKey]);
                  return (
                    <div
                      key={sample.scanKey}
                      className={`flex items-center gap-1 border-b border-border hover:bg-surface ${
                        selectedSerial === sample.scanKey ? "bg-primary/10" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSerial(sample.scanKey)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-text-muted">{idx + 1}</p>
                          <p className="font-mono text-sm text-text truncate">{sample.matUid}</p>
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
                      <button
                        type="button"
                        onClick={() => handleRemoveSerial(sample.scanKey)}
                        aria-label={t("material.iqc.removeSerial", "시리얼 제거")}
                        title={t("material.iqc.removeSerial", "시리얼 제거")}
                        className="mr-2 shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 우측: 측정 */}
          <div className="col-span-6 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border">
              {!selectedSerial ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  {t("material.iqc.selectScannedSerial", "왼쪽에서 스캔한 시리얼을 선택하세요.")}
                </div>
              ) : (
                <div className="h-full flex flex-col min-h-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-text-muted">{t("material.iqc.selectedSerial", "선택 시리얼")}</p>
                      <p className="font-mono font-semibold text-text">{selectedScannedSerial?.matUid ?? selectedSerial}</p>
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
                            <th className="text-right px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.lsl", "하한")}</th>
                            <th className="text-right px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.usl", "상한")}</th>
                            <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.judgeCriteria", "판정기준")}</th>
                            <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.measuredValue", "측정값")}</th>
                            <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspection.rows.map((row, idx) => (
                            <tr key={row.itemId} className="border-t border-border hover:bg-surface/50">
                              <td className="px-2 py-1.5 text-text-muted">{idx + 1}</td>
                              <td className="px-2 py-1.5 font-medium text-text">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.inspectItem}</span>
                                  {row.defectGrade && (
                                    <ComCodeBadge groupCode="DEFECT_GRADE" code={row.defectGrade} />
                                  )}
                                </div>
                                {(row.inspectionLevel || row.aql != null) && (
                                  <div className="text-[11px] text-text-muted mt-0.5">
                                    {row.inspectionLevel ? `검사수준 ${row.inspectionLevel}` : ""}
                                    {row.inspectionLevel && row.aql != null ? " · " : ""}
                                    {row.aql != null ? `AQL ${row.aql}` : ""}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-text-muted">
                                {row.spec || "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                                {row.lsl !== null ? row.lsl : "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                                {row.usl !== null ? row.usl : "-"}
                              </td>
                              <td className="px-2 py-1.5 text-text-muted max-w-[180px]">
                                <span className="block truncate" title={row.judgeCriteria || undefined}>
                                  {row.judgeCriteria || "-"}
                                </span>
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
                  : anyFail || anyDestructFail
                    ? <span className="text-red-600 dark:text-red-400">FAIL {failCount} / PASS {passCount}</span>
                    : <span className="text-green-600 dark:text-green-400">PASS {passCount}</span>}
            </span>
            <Button size="sm" variant={(anyFail || anyDestructFail) ? "danger" : "primary"} onClick={handleSerialSubmit} disabled={!canSubmit}>
              {(anyFail || anyDestructFail) ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              {t("material.iqc.serialSubmit", "검사결과 등록")} ({scannedSerials.length})
            </Button>
          </div>
      </div>
    </Modal>
  );
}
