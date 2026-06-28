"use client";

/**
 * @file src/app/(authenticated)/material/lot-split/page.tsx
 * @description 자재분할 페이지 - 입고완료 시리얼을 2조각으로 분할
 *
 * 재설계(2026-06-08):
 * 1. 입고완료(RECEIVE) LOT만 분할 대상
 * 2. 분할 시 원본 폐기(SPLIT) → 신규 시리얼 2개 발번
 * 3. 분할 결과 신규 2건 자재라벨 발행(MatLabelPreviewModal 재사용)
 * API: GET /material/lot-split, POST /material/lot-split
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Scissors, Search, RefreshCw, GitBranch } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import MatLabelPreviewModal from "../arrival/components/MatLabelPreviewModal";
import type { PoLineReceiptResponse } from "../arrival/components/types";
import { createLotSplitGridColumns, type SplittableLot } from "./lotSplitColumns";

export default function LotSplitPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<SplittableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<SplittableLot | null>(null);
  const [splitForm, setSplitForm] = useState({ splitQty: "", remark: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 분할 결과 라벨
  const [labelData, setLabelData] = useState<PoLineReceiptResponse | null>(null);
  const [labelItemName, setLabelItemName] = useState("");
  const [labelMfgName, setLabelMfgName] = useState("");
  const [isLabelOpen, setIsLabelOpen] = useState(false);

  const { options: mfgPartnerOptions } = usePartnerOptions("MFG");
  const resolveMfgPartnerName = useCallback((partnerCode?: string | null) => {
    if (!partnerCode) return "";
    const option = mfgPartnerOptions.find((o) => o.value === partnerCode);
    if (!option) return partnerCode;
    const codePrefix = `${partnerCode} - `;
    return option.label.startsWith(codePrefix) ? option.label.slice(codePrefix.length) : option.label;
  }, [mfgPartnerOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/material/lot-split", { params });
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
    totalQty: data.reduce((s, d) => s + d.qty, 0),
  }), [data]);

  const handleSplit = useCallback(async () => {
    if (!selectedLot || !splitForm.splitQty) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.post("/material/lot-split", {
        sourceLotId: selectedLot.matUid,
        splitQty: Number(splitForm.splitQty),
        remark: splitForm.remark || undefined,
      });
      const result = res.data?.data;
      setIsModalOpen(false);
      setSplitForm({ splitQty: "", remark: "" });
      // 분할 결과 라벨 발행
      if (result?.label) {
        setLabelData(result.label);
        setLabelItemName(result.itemName ?? selectedLot.itemName ?? "");
        // 분할 조각은 원본 LOT의 제조사를 계승
        setLabelMfgName(resolveMfgPartnerName(selectedLot.mfgPartnerCode));
        setIsLabelOpen(true);
      }
      setSelectedLot(null);
      fetchData();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("material.lotSplit.splitFailed");
      setErrorMsg(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSaving(false);
    }
  }, [selectedLot, splitForm, fetchData, resolveMfgPartnerName, t]);

  const handleOpenSplit = useCallback((lot: SplittableLot) => {
    setSelectedLot(lot);
    setSplitForm({ splitQty: "", remark: "" });
    setErrorMsg(null);
    setIsModalOpen(true);
  }, []);

  const columns = useMemo(() => createLotSplitGridColumns({
    t,
    onSplit: handleOpenSplit,
  }), [t, handleOpenSplit]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-primary" />{t("material.lotSplit.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lotSplit.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-shrink-0">
        <StatCard label={t("material.lotSplit.stats.total")} value={stats.total} icon={GitBranch} color="blue" />
        <StatCard label={t("material.lotSplit.stats.totalQty")} value={stats.totalQty.toLocaleString()} icon={Scissors} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("material.lotSplit.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.lotSplit.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT ml.*\nFROM MAT_LOTS ml\nWHERE ml.STATUS = 'NORMAL'\n  AND ml.COMPANY = '40'\n  AND ml.PLANT_CD = '1000'\n  AND ml.INIT_QTY <= NVL((SELECT SUM(st.QTY) FROM STOCK_TRANSACTIONS st\n    WHERE st.MAT_UID = ml.MAT_UID AND st.TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND st.STATUS <> 'CANCELED'), 0)\nORDER BY ml.CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("material.lotSplit.splitTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-alt dark:bg-surface rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-muted">{t("material.col.matUid")}:</span> <span className="font-mono font-medium">{selectedLot.matUid}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedLot.itemCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedLot.itemName}</div>
                <div><span className="text-text-muted">{t("material.lotSplit.currentQty")}:</span> <span className="font-semibold">{selectedLot.qty.toLocaleString()} {selectedLot.unit || ""}</span></div>
              </div>
            </div>
            <QtyInput label={t("material.lotSplit.splitQty")} placeholder="0"
              value={Number(splitForm.splitQty) || 0} onChange={n => setSplitForm(p => ({ ...p, splitQty: n ? String(n) : "" }))} maxValue={selectedLot.qty} fullWidth />
            {splitForm.splitQty && Number(splitForm.splitQty) > 0 && Number(splitForm.splitQty) < selectedLot.qty && (
              <div className="text-sm text-text-muted">
                {t("material.lotSplit.splitPreview", {
                  a: Number(splitForm.splitQty).toLocaleString(),
                  b: (selectedLot.qty - Number(splitForm.splitQty)).toLocaleString(),
                })}
              </div>
            )}
            <Input label={t("material.lotSplit.remark")} placeholder={t("material.lotSplit.remarkPlaceholder")}
              value={splitForm.remark} onChange={e => setSplitForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
            {errorMsg && (
              <div className="text-sm text-red-600 dark:text-red-400">{errorMsg}</div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSplit}
                disabled={saving || !splitForm.splitQty || Number(splitForm.splitQty) <= 0 || Number(splitForm.splitQty) >= selectedLot.qty}>
                {saving ? t("common.saving") : <><Scissors className="w-4 h-4 mr-1" />{t("material.lotSplit.split")}</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <MatLabelPreviewModal
        isOpen={isLabelOpen}
        data={labelData}
        itemName={labelItemName}
        mfgPartnerLabel={labelMfgName}
        onClose={() => setIsLabelOpen(false)}
      />
    </div>
  );
}
