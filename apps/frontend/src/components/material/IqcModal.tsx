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
 * 5. G4: 검사분류(전수/선별/무검사), 파괴검사 시료수량, 검사성적서 파일 업로드
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, Upload } from "lucide-react";
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

interface IqcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: IqcItem | null;
  form: IqcResultForm;
  setForm: React.Dispatch<React.SetStateAction<IqcResultForm>>;
  onSubmit: (details?: MeasurementRow[], overrideResult?: string, extra?: { inspectClass?: string; sampleQty?: number; certFile?: File; sampleBarcode?: string }) => void;
}

interface PendingSerial {
  matUid: string;
  initQty: number;
  currentQty: number;
}

function judgeValue(value: string, lsl: number | null, usl: number | null): "PASS" | "FAIL" | "" {
  if (!value.trim()) return "";
  if (lsl === null && usl === null) return "PASS"; // 정성검사: 값 입력 시 자동 합격
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

  // 시료 시리얼 판정 (사용한 시료 시리얼 + 각 합/불 → 롯트 all-or-nothing)
  const [serials, setSerials] = useState<PendingSerial[]>([]);
  const [serialResults, setSerialResults] = useState<Record<string, "PASS" | "FAIL">>({});

  // 검사분류(기본 샘플검사), 샘플 시료수량, 검사성적서 파일
  const [inspectClass, setInspectClass] = useState("SAMPLE");
  const [sampleQty, setSampleQty] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inspectClassOptions = useMemo(() => [
    { value: "FULL", label: t("material.iqc.inspectClassFull", "전수검사") },
    { value: "SAMPLE", label: t("material.iqc.inspectClassSample", "선별검사") },
    { value: "NONE", label: t("material.iqc.inspectClassNone", "무검사") },
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
          itemId: `${item.itemCode}::${item.seq}`,
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

  // 모달 열릴 때 검사대기 시리얼 목록 조회 (시리얼별 개별 판정용, 기본 전체 PASS)
  useEffect(() => {
    if (!isOpen || !selectedItem) { setSerials([]); setSerialResults({}); return; }
    api.get("/material/iqc-history/pending-serials", {
      params: { arrivalNo: selectedItem.arrivalNo, itemCode: selectedItem.itemCode },
    })
      .then((res) => {
        const list: PendingSerial[] = res.data?.data ?? [];
        setSerials(list);
        const init: Record<string, "PASS" | "FAIL"> = {};
        list.forEach((s) => { init[s.matUid] = "PASS"; });
        setSerialResults(init);
      })
      .catch(() => { setSerials([]); setSerialResults({}); });
  }, [isOpen, selectedItem]);

  const setSerialResult = useCallback((matUid: string, r: "PASS" | "FAIL") => {
    setSerialResults((prev) => ({ ...prev, [matUid]: r }));
  }, []);
  const setAllSerials = useCallback((r: "PASS" | "FAIL") => {
    setSerialResults(() => Object.fromEntries(serials.map((s) => [s.matUid, r])));
  }, [serials]);

  // 시료 시리얼 판정 → 입하롯트 단위 등록(onSubmit→/arrival).
  // 규칙: 시료 중 1개라도 FAIL이면 롯트 전체 FAIL(입고불가). 시료 시리얼+결과는 sampleBarcode에 근거로 기록.
  const handleSerialSubmit = useCallback(() => {
    if (!selectedItem || serials.length === 0) return;
    const failed = serials.filter((s) => serialResults[s.matUid] === "FAIL").map((s) => s.matUid);
    const verdict = failed.length > 0 ? "FAILED" : "PASSED";
    const sampleEvidence = serials.map((s) => `${s.matUid}:${serialResults[s.matUid] || "PASS"}`).join(", ");
    setForm((prev) => ({ ...prev, result: verdict as IqcResultForm["result"] }));
    onSubmit(measurements.length > 0 ? measurements : undefined, verdict, {
      inspectClass,
      sampleQty: sampleQty ? parseInt(sampleQty, 10) : undefined,
      certFile: certFile ?? undefined,
      sampleBarcode: sampleEvidence,
    });
  }, [selectedItem, serials, serialResults, measurements, inspectClass, sampleQty, certFile, onSubmit, setForm]);

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

  // 정성검사 항목: 직접 PASS/FAIL 토글
  const updateJudge = useCallback((idx: number, judge: "PASS" | "FAIL") => {
    setMeasurements((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        measuredValue: judge,
        judge,
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


  if (!selectedItem) return null;

  const hasInspectItems = inspectItems.length > 0;
  const serialPassCount = serials.filter((s) => serialResults[s.matUid] === "PASS").length;
  // 규칙: 시리얼 1개라도 FAIL이면 입하롯트 전체 불합격(입고불가)
  const anyFail = serials.length > 0 && serialPassCount < serials.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.iqc.modalTitle")} size={hasInspectItems || serials.length > 0 ? "2xl" : "lg"}>
      <div className="space-y-4">
        {/* 입하 정보 표시 (입하번호 + 품목 단위) */}
        <div className="p-3 bg-background rounded-lg grid grid-cols-2 gap-x-6 gap-y-1">
          <p className="text-sm text-text-muted">{t("material.iqc.arrivalNoLabel")}: <span className="font-medium text-text">{selectedItem.arrivalNo}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.supplierLabel")}: <span className="font-medium text-text">{selectedItem.supplierName}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.partLabel")}: <span className="font-medium text-text">{selectedItem.itemName} ({selectedItem.itemCode})</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.serialCount", "시리얼수")}: <span className="font-medium text-text">{selectedItem.serialCount.toLocaleString()}</span></p>
          <p className="text-sm text-text-muted">{t("material.iqc.totalQty", "총수량")}: <span className="font-medium text-text">{selectedItem.totalQty.toLocaleString()} {selectedItem.unit}</span></p>
        </div>

        {/* 시리얼별 개별 판정 (전수검사형 다중 등록) */}
        {serials.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border">
              <span className="text-sm font-semibold text-text">
                {t("material.iqc.serialJudge", "시리얼별 판정")}{" "}
                <span className="text-text-muted font-normal">({serialPassCount} PASS / {serials.length - serialPassCount} FAIL)</span>
              </span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setAllSerials("PASS")}
                  className="px-2 py-1 text-xs rounded border border-green-400 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20">
                  {t("material.iqc.allPass", "전체 PASS")}
                </button>
                <button type="button" onClick={() => setAllSerials("FAIL")}
                  className="px-2 py-1 text-xs rounded border border-red-400 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                  {t("material.iqc.allFail", "전체 FAIL")}
                </button>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-border text-[11px] text-amber-700 dark:text-amber-300">
              ※ {t("material.iqc.lotRuleNotice", "시리얼 1개라도 불량이면 입하롯트 전체가 불합격(입고 불가) 처리됩니다.")}
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-text-muted">#</th>
                    <th className="text-left px-3 py-1.5 font-medium text-text-muted">{t("material.iqc.serialNo", "시리얼")}</th>
                    <th className="text-right px-3 py-1.5 font-medium text-text-muted">{t("material.iqc.qty", "수량")}</th>
                    <th className="text-center px-3 py-1.5 font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                  </tr>
                </thead>
                <tbody>
                  {serials.map((s, idx) => (
                    <tr key={s.matUid} className="border-t border-border hover:bg-surface/50">
                      <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-text">{s.matUid}</td>
                      <td className="px-3 py-1.5 text-right text-text-muted">{(s.currentQty ?? s.initQty)?.toLocaleString?.() ?? s.initQty}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex gap-1 justify-center">
                          <button type="button" onClick={() => setSerialResult(s.matUid, "PASS")}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                              serialResults[s.matUid] === "PASS"
                                ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/40 dark:text-green-300 font-semibold"
                                : "bg-surface text-text-muted border-border hover:bg-green-50 dark:hover:bg-green-900/20"
                            }`}>PASS</button>
                          <button type="button" onClick={() => setSerialResult(s.matUid, "FAIL")}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                              serialResults[s.matUid] === "FAIL"
                                ? "bg-red-100 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 font-semibold"
                                : "bg-surface text-text-muted border-border hover:bg-red-50 dark:hover:bg-red-900/20"
                            }`}>FAIL</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 bg-surface border-t border-border flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">
                {anyFail
                  ? <span className="text-red-600 dark:text-red-400">→ {t("material.iqc.lotFail", "입하롯트 전체 불합격 (입고불가)")}</span>
                  : <span className="text-green-600 dark:text-green-400">→ {t("material.iqc.lotPass", "입하롯트 합격")}</span>}
              </span>
              <Button size="sm" variant={anyFail ? "danger" : "primary"} onClick={handleSerialSubmit}>
                {anyFail ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                {t("material.iqc.serialSubmit", "검사결과 등록")} ({serials.length})
              </Button>
            </div>
          </div>
        )}

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
                      {row.lsl === null && row.usl === null ? (
                        // 정성검사: PASS/FAIL 직접 토글
                        <div className="flex gap-1 justify-center">
                          <button
                            type="button"
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              row.judge === "PASS"
                                ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600 font-semibold"
                                : "bg-surface text-text-muted border-border hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20"
                            }`}
                            onClick={() => updateJudge(idx, "PASS")}
                          >PASS</button>
                          <button
                            type="button"
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              row.judge === "FAIL"
                                ? "bg-red-100 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-600 font-semibold"
                                : "bg-surface text-text-muted border-border hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                            }`}
                            onClick={() => updateJudge(idx, "FAIL")}
                          >FAIL</button>
                        </div>
                      ) : (
                        // 정량검사: 숫자 입력 후 자동 판정
                        <input
                          type="number"
                          step="any"
                          className="w-24 px-2 py-1 text-center border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          value={row.measuredValue}
                          onChange={(e) => updateMeasurement(idx, e.target.value)}
                          placeholder={row.unit || ""}
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

        {/* G4: 검사분류 / 파괴검사 시료 / 검사성적서 */}
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

        {/* 등록은 시료 시리얼 패널의 [검사결과 등록] 버튼으로 단일화 */}
        {serials.length === 0 && !loadingItems && (
          <p className="text-sm text-text-muted text-center py-2">{t("material.iqc.noPendingSerials", "검사대기 시료 시리얼이 없습니다.")}</p>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        </div>
      </div>
    </Modal>
  );
}
