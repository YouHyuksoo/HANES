"use client";

/**
 * @file src/app/(authenticated)/material/concession/page.tsx
 * @description 특채처리 페이지 - IQC 불합격(FAIL) 자재를 특별채택하여 양품입고 허용
 *
 * 초보자 가이드:
 * 1. **특채(특별채택)**: 검사 불합격 자재를 조건부로 사용 승인하는 처리
 * 2. **대상**: 검사결과가 불량(iqcStatus='FAIL')인 입하건+품목 그룹만
 * 3. **효과**: 특채 처리 시 입고화면에 노출되어 양품창고로 입고 가능
 * 4. API: GET /material/concession/targets, POST /material/concession, POST /material/concession/cancel
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck, Search, RefreshCw, ShieldCheck, ShieldX, AlertTriangle, ScanLine,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard } from "@/components/ui";
import { BarcodeScanInput, WorkerSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createConcessionGridColumns, type ConcessionTarget } from "./concessionColumns";

interface WorkerQrResponse {
  workerCode: string;
  workerName?: string | null;
  dept?: string | null;
}

const formatQty = (value?: number | null) => (typeof value === "number" ? value.toLocaleString() : "0");

export default function ConcessionPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ConcessionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<ConcessionTarget | null>(null);
  const [actionType, setActionType] = useState<"apply" | "cancel">("apply");
  const [reason, setReason] = useState("");
  const [specialAcceptWorkerCode, setSpecialAcceptWorkerCode] = useState("");
  const [specialAcceptWorkerName, setSpecialAcceptWorkerName] = useState("");
  const [workerQrText, setWorkerQrText] = useState("");
  const [workerQrLoading, setWorkerQrLoading] = useState(false);
  const [workerQrError, setWorkerQrError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      const res = await api.get("/material/concession/targets", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    accepted: data.filter((d) => d.specialAcceptYn === "Y").length,
    pending: data.filter((d) => d.specialAcceptYn !== "Y").length,
  }), [data]);

  const handleAction = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const url = actionType === "apply" ? "/material/concession" : "/material/concession/cancel";
      await api.post(url, {
        arrivalNo: selected.arrivalNo,
        itemCode: selected.itemCode,
        specialAcceptWorkerCode: specialAcceptWorkerCode || undefined,
        reason: reason || undefined,
      });
      setIsModalOpen(false);
      setReason("");
      setSpecialAcceptWorkerCode("");
      setSpecialAcceptWorkerName("");
      setWorkerQrText("");
      setWorkerQrError("");
      setSelected(null);
      fetchData();
    } catch (e: unknown) {
      console.error("Concession action failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selected, actionType, specialAcceptWorkerCode, reason, fetchData]);

  const openModal = useCallback((row: ConcessionTarget, type: "apply" | "cancel") => {
    setSelected(row);
    setActionType(type);
    setReason("");
    setSpecialAcceptWorkerCode(type === "apply" ? "" : (row.specialAcceptWorkerCode ?? ""));
    setSpecialAcceptWorkerName(type === "apply" ? "" : (row.specialAcceptWorkerName ?? ""));
    setWorkerQrText("");
    setWorkerQrError("");
    setIsModalOpen(true);
  }, []);

  const handleWorkerQrLookup = useCallback(async (rawWorkerQr?: string) => {
    const workerQr = (rawWorkerQr ?? workerQrText).replace(/\r?\n|\r/g, "").trim();
    if (!workerQr) return;
    setWorkerQrLoading(true);
    setWorkerQrError("");
    try {
      const res = await api.get(
        `/master/workers/by-qr/${encodeURIComponent(workerQr)}`,
      );
      const worker = res.data?.data as WorkerQrResponse | undefined;
      if (!worker?.workerCode) {
        setWorkerQrError(t("material.concession.workerQrNotFound", "작업자 QR을 찾을 수 없습니다."));
        return;
      }
      setSpecialAcceptWorkerCode(worker.workerCode);
      setSpecialAcceptWorkerName(worker.workerName ?? worker.workerCode);
      setWorkerQrText("");
    } catch {
      setWorkerQrError(t("material.concession.workerQrNotFound", "작업자 QR을 찾을 수 없습니다."));
    } finally {
      setWorkerQrLoading(false);
    }
  }, [t, workerQrText]);

  const columns = useMemo(() => createConcessionGridColumns({ t, openModal }), [t, openModal]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <BadgeCheck className="w-7 h-7 text-primary" />
            {t("material.concession.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.concession.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("material.concession.stats.total")} value={stats.total} icon={ShieldX} color="red" />
        <StatCard label={t("material.concession.stats.accepted")} value={stats.accepted} icon={ShieldCheck} color="green" />
        <StatCard label={t("material.concession.stats.pending")} value={stats.pending} icon={AlertTriangle} color="yellow" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("material.concession.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.concession.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT ARRIVAL_NO, ITEM_CODE, VENDOR,\n       COUNT(*) AS SERIAL_COUNT, SUM(INIT_QTY) AS TOTAL_QTY,\n       SUM(CASE WHEN SPECIAL_ACCEPT_YN='Y' THEN 1 ELSE 0 END) AS SPECIAL_ACCEPT_COUNT,\n       MAX(SPECIAL_ACCEPT_WORKER_CODE) AS SPECIAL_ACCEPT_WORKER_CODE\nFROM MAT_LOTS\nWHERE COMPANY = '40' AND PLANT_CD = '1000'\n  AND IQC_STATUS = 'FAIL' AND ARRIVAL_NO IS NOT NULL\nGROUP BY ARRIVAL_NO, ITEM_CODE, VENDOR\nORDER BY MIN(CREATED_AT) DESC`} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={actionType === "apply" ? t("material.concession.applyTitle") : t("material.concession.cancelTitle")} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-text-muted">{t("material.col.arrivalNo")}:</span> <span className="font-mono font-medium">{selected.arrivalNo}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selected.itemCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selected.itemName || "-"}</div>
                <div><span className="text-text-muted">{t("material.iqc.serialCount", "시리얼수")}:</span> <span className="font-medium">{formatQty(selected.serialCount)}</span></div>
                <div><span className="text-text-muted">{t("material.iqc.totalQty", "총수량")}:</span> <span className="font-medium">{formatQty(selected.totalQty)} {selected.unit || ""}</span></div>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              {actionType === "apply" ? t("material.concession.applyHint") : t("material.concession.cancelHint")}
            </p>
            {actionType === "apply" && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)_auto] gap-2 items-end">
                  <BarcodeScanInput
                    label={t("material.concession.workerQrScan", "작업자 QR 스캔")}
                    placeholder={t("material.concession.workerQrScanPlaceholder", "작업자 QR을 스캔하거나 입력 후 Enter")}
                    value={workerQrText}
                    onChange={(value) => {
                      setWorkerQrText(value);
                      setWorkerQrError("");
                    }}
                    onScan={handleWorkerQrLookup}
                    fullWidth
                  />
                  <WorkerSelect
                    label={t("material.concession.workerSelect", "작업자 선택")}
                    placeholder={t("material.concession.specialAcceptWorkerPlaceholder", "작업자 선택")}
                    value={specialAcceptWorkerCode}
                    onChange={(value) => {
                      setSpecialAcceptWorkerCode(value);
                      setSpecialAcceptWorkerName("");
                      setWorkerQrError("");
                    }}
                    fullWidth
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleWorkerQrLookup()}
                    disabled={workerQrLoading || !workerQrText.trim()}
                  >
                    {workerQrLoading ? t("common.loading") : t("common.search")}
                  </Button>
                </div>
                {specialAcceptWorkerName && (
                  <p className="text-xs text-primary">
                    {t("material.concession.selectedWorker", "선택된 작업자")}: {specialAcceptWorkerName} ({specialAcceptWorkerCode})
                  </p>
                )}
                {workerQrError && <p className="text-xs text-red-500">{workerQrError}</p>}
              </div>
            )}
            <Input label={t("material.concession.reason")} placeholder={t("material.concession.reasonPlaceholder")}
              value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleAction} disabled={saving || (actionType === "apply" && !specialAcceptWorkerCode)}>
                {saving ? t("common.saving") : actionType === "apply" ? t("material.concession.apply") : t("material.concession.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
