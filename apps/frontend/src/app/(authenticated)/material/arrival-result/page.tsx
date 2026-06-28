"use client";

/**
 * @file material/arrival-result/page.tsx
 * @description IQC006 — 입하실적조회 (목업 IQC006)
 *
 * 초보자 가이드:
 * 1. 좌측: 입하실적 목록(입하번호+SEQ 단위). 행 선택 시 우측 시리얼 로드
 * 2. 우측: 선택 입하 정보 + 제조사 변경 / 시리얼 목록(체크) + 라벨 재발행
 * 3. 입하취소: 미입고 건만 가능 (입고 후 불가)
 * API:
 *  - GET  /material/arrivals/results
 *  - GET  /material/arrivals/results/:arrivalNo/:seq/serials
 *  - POST /material/arrivals/results/:arrivalNo/cancel        (body: seq, reason)
 *  - PATCH /material/arrivals/results/:arrivalNo/manufacturer (body: seq, mfgPartnerCode)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, RefreshCw, Printer, Pencil } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import { PartnerSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { createArrivalResultGridColumns, type ArrivalResultRow } from "./arrivalResultColumns";
import api from "@/services/api";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import { getTodayLocal } from "@/utils/date";
import MatLabelPreviewModal from "../arrival/components/MatLabelPreviewModal";
import type { PoLineReceiptResponse } from "../arrival/components/types";
import {
  LabelDesign,
  createDefaultLabelDesign,
  ensureObjectLabelDesign,
} from "../../master/label/types";

interface SerialRow {
  matUid: string;
  qty: number;
  iqcStatus: string | null;
  stockInYn: string;
  cancelYn: string;
  checkable: boolean;
}

interface TemplateInfo {
  templateKey: string;
  templateName: string;
  category: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

const fmtDate = (v: string | null) => (v ? String(v).slice(0, 10) : "-");
const DEFAULT_TEMPLATE_KEY = "__default__";

export default function ArrivalResultPage() {
  const { t } = useTranslation();
  const { options: mfgPartnerOptions } = usePartnerOptions("MFG");

  // 필터
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [itemCode, setItemCode] = useState("");
  const [arrivalNo, setArrivalNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 텍스트 필터(품목코드/입하번호)는 디바운스 — 다른 화면처럼 입력 변경 시 자동 조회(별도 검색 버튼 없음)
  const [debItemCode, setDebItemCode] = useState("");
  const [debArrivalNo, setDebArrivalNo] = useState("");
  useEffect(() => {
    const tm = setTimeout(() => { setDebItemCode(itemCode); setDebArrivalNo(arrivalNo); }, 300);
    return () => clearTimeout(tm);
  }, [itemCode, arrivalNo]);

  // 좌측 목록
  const [rows, setRows] = useState<ArrivalResultRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 우측 시리얼
  const [selected, setSelected] = useState<ArrivalResultRow | null>(null);
  const [serials, setSerials] = useState<SerialRow[]>([]);
  const [serialLoading, setSerialLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 모달
  const [cancelTarget, setCancelTarget] = useState<ArrivalResultRow | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [mfgOpen, setMfgOpen] = useState(false);
  const [mfgCode, setMfgCode] = useState("");
  const [mfgSaving, setMfgSaving] = useState(false);
  const [labelData, setLabelData] = useState<PoLineReceiptResponse | null>(null);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("mat_lot"));
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/arrivals/results", {
        params: {
          limit: 200,
          ...(fromDate && { fromDate }),
          ...(toDate && { toDate }),
          ...(debItemCode && { itemCode: debItemCode }),
          ...(debArrivalNo && { arrivalNo: debArrivalNo }),
          ...(statusFilter && { status: statusFilter }),
        },
      });
      setRows(res.data?.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, debItemCode, debArrivalNo, statusFilter]);

  // 필터(날짜·상태·디바운스된 텍스트) 변경 시 자동 조회 — 검색 버튼 불필요
  useEffect(() => { fetchResults(); }, [fetchResults]);

  useEffect(() => {
    let cancelled = false;

    const fetchTemplates = async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "mat_lot" } });
        const rawTemplates = res.data?.data ?? [];
        const nextTemplates: TemplateInfo[] = rawTemplates.map((tpl: {
          templateKey?: string;
          templateName: string;
          category: string;
          printMode?: string;
          designData: string | LabelDesign;
          isDefault?: boolean;
        }) => {
          const rawDesign = typeof tpl.designData === "string" ? JSON.parse(tpl.designData) : tpl.designData;
          return {
            templateKey: tpl.templateKey ?? `${tpl.templateName}::${tpl.category}`,
            templateName: tpl.templateName,
            category: tpl.category,
            printMode: tpl.printMode ?? "BROWSER",
            designData: ensureObjectLabelDesign(rawDesign, "mat_lot"),
            isDefault: tpl.isDefault,
          };
        });

        if (cancelled) return;

        setTemplates(nextTemplates);
        const preferred = nextTemplates.find((item) => item.isDefault) ?? nextTemplates[0];
        if (!preferred) {
          setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
          setLabelDesign(createDefaultLabelDesign("mat_lot"));
          return;
        }

        const rawDesign = preferred.designData;
        setSelectedTemplateKey(preferred.templateKey);
        setLabelDesign(ensureObjectLabelDesign(rawDesign, "mat_lot"));
      } catch {
        if (cancelled) return;
        setTemplates([]);
        setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
        setLabelDesign(createDefaultLabelDesign("mat_lot"));
      }
    };

    fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadSerials = useCallback(async (row: ArrivalResultRow) => {
    setSelected(row);
    setChecked(new Set());
    setSerialLoading(true);
    try {
      const res = await api.get(`/material/arrivals/results/${encodeURIComponent(row.arrivalNo)}/serials`, {
        params: { itemCode: row.itemCode },
      });
      setSerials(res.data?.data ?? []);
    } catch {
      setSerials([]);
    } finally {
      setSerialLoading(false);
    }
  }, []);

  const resolveMfgPartnerName = useCallback((partnerCode: string) => {
    const option = mfgPartnerOptions.find((o) => o.value === partnerCode);
    if (!option) return partnerCode;
    const codePrefix = `${partnerCode} - `;
    return option.label.startsWith(codePrefix) ? option.label.slice(codePrefix.length) : option.label;
  }, [mfgPartnerOptions]);

  const toggleCheck = (matUid: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(matUid)) next.delete(matUid); else next.add(matUid);
      return next;
    });
  };

  const checkableSerials = useMemo(() => serials.filter((s) => s.checkable), [serials]);
  const allChecked = checkableSerials.length > 0 && checkableSerials.every((s) => checked.has(s.matUid));
  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(checkableSerials.map((s) => s.matUid)));
  };

  const templateOptions = useMemo(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: t("material.arrival.defaultDesign", "기본 디자인") },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ""}`,
    })),
  ], [templates, t]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === DEFAULT_TEMPLATE_KEY) {
      setLabelDesign(createDefaultLabelDesign("mat_lot"));
      return;
    }

    const tpl = templates.find((item) => item.templateKey === templateKey);
    if (!tpl) return;
    const rawDesign = tpl.designData;
    setLabelDesign(ensureObjectLabelDesign(rawDesign, "mat_lot"));
  }, [templates]);

  // 라벨 재발행
  const handleReprint = () => {
    if (!selected || checked.size === 0) return;
    const picked = serials.filter((s) => checked.has(s.matUid));
    setLabelData({
      arrivalNo: selected.arrivalNo,
      serials: picked.map((s, idx) => ({
        matUid: s.matUid,
        initQty: s.qty,
        arrivalSeq: idx + 1,
        itemCode: selected.itemCode,
      })),
    });
  };

  // 입하취소 — arrivalNo 전체 일괄 취소
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    try {
      await api.post(`/material/arrivals/results/${encodeURIComponent(cancelTarget.arrivalNo)}/cancel`, {});
      setCancelTarget(null);
      if (selected && selected.arrivalNo === cancelTarget.arrivalNo) {
        setSelected(null);
        setSerials([]);
      }
      fetchResults();
    } catch {
      // 인터셉터에서 에러 표시
    } finally {
      setCanceling(false);
    }
  };

  // 제조사 변경
  const openMfg = () => {
    if (!selected) return;
    setMfgCode("");
    setMfgOpen(true);
  };
  const saveMfg = async () => {
    if (!selected || !mfgCode) return;
    setMfgSaving(true);
    try {
      await api.patch(`/material/arrivals/results/${encodeURIComponent(selected.arrivalNo)}/manufacturer`, {
        itemCode: selected.itemCode,
        mfgPartnerCode: mfgCode,
      });
      const nextMfgPartnerName = resolveMfgPartnerName(mfgCode);
      const updatedSelected = {
        ...selected,
        mfgPartnerCode: mfgCode,
        mfgPartnerName: nextMfgPartnerName,
      };
      setSelected(updatedSelected);
      setRows((prev) => prev.map((row) => (
        row.arrivalNo === selected.arrivalNo && row.itemCode === selected.itemCode
          ? { ...row, mfgPartnerCode: mfgCode, mfgPartnerName: nextMfgPartnerName }
          : row
      )));
      setMfgOpen(false);
    } catch {
      // 인터셉터에서 에러 표시
    } finally {
      setMfgSaving(false);
    }
  };

  const columns = useMemo(
    () => createArrivalResultGridColumns({ t, onCancelArrival: setCancelTarget }),
    [t],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.arrivalResult.title", "입하실적조회")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.arrivalResult.subtitle", "입하 이력을 조회하고 시리얼 라벨 재발행·입하 취소를 처리합니다.")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchResults}>
          <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
        </Button>
      </div>

      {/* 본문 좌/우 */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* 좌측 목록 */}
        <Card className="flex-1 min-w-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0">
            <DataGrid
      sqlQuery={`SELECT *\nFROM MAT_ARRIVALS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
              data={rows}
              columns={columns}
              initialSorting={[{ id: "createdAt", desc: true }]}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName="iqc006_arrival_results"
              toolbarLeft={
                <div className="flex gap-2 flex-1 min-w-0 flex-wrap">
                  <DateRangeFilter
                    from={fromDate}
                    to={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                    className="flex-shrink-0"
                  />
                  <div className="w-40 flex-shrink-0">
                    <ComCodeSelect groupCode="ARRIVAL_RESULT_STATUS" labelPrefix={t("common.status")} value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                  <Input placeholder={t("common.partCode")} value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="w-32 flex-shrink-0" />
                  <Input placeholder={t("material.arrivalResult.col.arrivalNo", "입하번호")} value={arrivalNo} onChange={(e) => setArrivalNo(e.target.value)} className="w-36 flex-shrink-0" />
                </div>
              }
              onRowClick={(row) => loadSerials(row)}
            />
          </CardContent>
        </Card>

        {/* 우측 시리얼 */}
        <Card className="w-[460px] flex-shrink-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0 gap-3">
            {/* 선택 입하 정보 */}
            <div className="rounded-lg border border-border p-3 text-sm">
              {selected ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-text truncate">
                      {selected.itemCode} <span className="text-text-muted font-normal">{selected.itemName}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {selected.arrivalNo} · {t("material.arrivalResult.col.qty", "입하수량")} {selected.qty.toLocaleString()} · {fmtDate(selected.arrivalDate)}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {t("material.arrivalResult.supplier", "공급사")}: {selected.vendorName ?? "-"}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {t("material.arrivalResult.manufacturer", "제조사")}: {selected.mfgPartnerName ?? "-"}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={openMfg} disabled={selected.status === "CANCELED"}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />{t("material.arrivalResult.changeMfg", "제조사 변경")}
                  </Button>
                </div>
              ) : (
                <div className="text-text-muted text-center py-2">{t("material.arrivalResult.selectHint", "좌측에서 입하 건을 선택하세요")}</div>
              )}
            </div>

            {/* 액션 행 */}
            {selected && (
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={checkableSerials.length === 0} />
                  {t("material.arrivalResult.selectAll", "전체 선택")}
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-48">
                    <Select
                      aria-label={t("material.arrival.labelTemplate", "입하 라벨 템플릿")}
                      options={templateOptions}
                      value={selectedTemplateKey}
                      onChange={handleTemplateChange}
                      fullWidth
                    />
                  </div>
                  <Button size="sm" onClick={handleReprint} disabled={checked.size === 0}>
                    <Printer className="w-4 h-4 mr-1" />{t("material.arrivalResult.reprint", "라벨 재발행")}
                  </Button>
                </div>
              </div>
            )}

            {/* 시리얼 목록 */}
            <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-secondary dark:bg-slate-800 text-text-muted">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="p-2 text-left">{t("material.arrivalResult.col.serialNo", "시리얼번호")}</th>
                    <th className="p-2 text-right">{t("material.arrivalResult.col.serialQty", "수량")}</th>
                    <th className="p-2 text-center">{t("material.arrivalResult.col.stockIn", "입고")}</th>
                    <th className="p-2 text-center">{t("material.arrivalResult.col.canceled", "취소")}</th>
                  </tr>
                </thead>
                <tbody>
                  {serialLoading ? (
                    <tr><td colSpan={5} className="text-center text-text-muted py-6">{t("common.loading", "불러오는 중...")}</td></tr>
                  ) : serials.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-text-muted py-6">{selected ? t("material.arrivalResult.noSerials", "시리얼이 없습니다") : "-"}</td></tr>
                  ) : (
                    serials.map((s) => (
                      <tr key={s.matUid} className="border-t border-border">
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={checked.has(s.matUid)} disabled={!s.checkable} onChange={() => toggleCheck(s.matUid)} />
                        </td>
                        <td className="p-2 font-mono text-xs text-slate-800 dark:text-slate-200">{s.matUid}</td>
                        <td className="p-2 text-right">{s.qty.toLocaleString()}</td>
                        <td className="p-2 text-center font-bold text-green-600 dark:text-green-400">{s.stockInYn === "Y" ? "Y" : ""}</td>
                        <td className="p-2 text-center font-bold text-red-600 dark:text-red-400">{s.cancelYn === "Y" ? "Y" : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 입하취소 확인 모달 */}
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title={t("material.arrivalResult.cancelTitle", "입하 취소")} size="md">
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              {t("material.arrivalResult.cancelConfirmAll", "해당 입하 번호의 모든 품목이 일괄 취소됩니다. 계속하시겠습니까?")}
            </p>
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-text-muted">
              {t("material.arrivalResult.cancelTargetLabel", "입하번호")} : <span className="font-semibold text-text">{cancelTarget.arrivalNo}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={canceling}>{t("common.cancel")}</Button>
              <Button onClick={confirmCancel} disabled={canceling}>
                {canceling ? t("common.saving") : t("material.arrivalResult.cancel", "입하취소")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 제조사 변경 모달 */}
      <Modal isOpen={mfgOpen} onClose={() => setMfgOpen(false)} title={t("material.arrivalResult.changeMfg", "제조사 변경")} size="md">
        <div className="space-y-4">
          {selected && (
            <div className="rounded-lg border border-border p-3 text-sm text-text-muted">
              {selected.arrivalNo} · {selected.itemCode} {selected.itemName}
            </div>
          )}
          <PartnerSelect
            label={t("material.arrivalResult.manufacturer", "제조사")}
            partnerType="MFG"
            value={mfgCode}
            onChange={setMfgCode}
            fullWidth
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMfgOpen(false)} disabled={mfgSaving}>{t("common.cancel")}</Button>
            <Button onClick={saveMfg} disabled={mfgSaving || !mfgCode}>
              {mfgSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 라벨 재발행 미리보기 */}
      <MatLabelPreviewModal
        isOpen={!!labelData}
        data={labelData}
        itemName={selected?.itemName ?? ""}
        mfgPartnerLabel={selected?.mfgPartnerName
          ?? (selected?.mfgPartnerCode ? resolveMfgPartnerName(selected.mfgPartnerCode) : "")}
        receivedDate={fmtDate(selected?.arrivalDate ?? null)}
        labelDesign={labelDesign}
        templateOptions={templateOptions}
        selectedTemplateKey={selectedTemplateKey}
        onTemplateChange={handleTemplateChange}
        onClose={() => setLabelData(null)}
      />
    </div>
  );
}
