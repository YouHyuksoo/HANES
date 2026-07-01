"use client";

/**
 * @file src/app/(authenticated)/material/lot-merge/page.tsx
 * @description 자재 LOT 병합 관리 페이지
 *
 * 재설계(2026-06-08):
 * 1. 바코드 스캔으로 병합 대상 시리얼을 누적(동일 품목 + 동일 최초시리얼 origin)
 * 2. 병합 시 원본 전부 폐기(MERGED) → 합산 수량의 신규 통합 시리얼 1개 발번
 * 3. 신규 시리얼 자재라벨 발행(MatLabelPreviewModal 재사용)
 * API: GET /material/lot-merge, GET /material/lot-merge/by-barcode/:matUid, POST /material/lot-merge
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Merge, Search, RefreshCw, ScanLine, X, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import MatLabelPreviewModal from "../arrival/components/MatLabelPreviewModal";
import type { PoLineReceiptResponse } from "../arrival/components/types";
import { createLotMergeGridColumns, type MergeableLot } from "./lotMergeColumns";

export default function LotMergePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<MergeableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 바코드 스캔 누적
  const [scanned, setScanned] = useState<MergeableLot[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const [merging, setMerging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // 병합 결과 라벨
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
      const res = await api.get("/material/lot-merge", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const extractMsg = (e: unknown, fallback: string): string => {
    const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    return msg ?? fallback;
  };

  // 바코드(또는 목록 클릭)로 시리얼 누적 추가
  const addByBarcode = useCallback(async (raw: string) => {
    const matUid = raw.trim();
    if (!matUid) return;
    setScanError(null);
    if (scanned.some((s) => s.matUid === matUid)) {
      setScanError(t("material.lotMerge.alreadyScanned", { matUid }));
      setScanInput("");
      return;
    }
    try {
      const res = await api.get(`/material/lot-merge/by-barcode/${encodeURIComponent(matUid)}`);
      const lot: MergeableLot = res.data?.data;
      if (!lot) {
        setScanError(t("material.lotMerge.notFound", { matUid }));
        return;
      }
      // 누적된 첫 항목과 품목/입하번호 일치 검증(프론트 선제 안내)
      if (scanned.length > 0) {
        const base = scanned[0];
        if (base.itemCode !== lot.itemCode) {
          setScanError(t("material.lotMerge.itemMismatchScan", { matUid }));
          return;
        }
        if (!lot.arrivalNo || base.arrivalNo !== lot.arrivalNo) {
          setScanError(t("material.lotMerge.arrivalMismatchScan", { matUid }));
          return;
        }
      }
      setScanned((prev) => [...prev, lot]);
      setScanInput("");
    } catch (e: unknown) {
      setScanError(extractMsg(e, t("material.lotMerge.scanFailed")));
    } finally {
      scanRef.current?.focus();
    }
  }, [scanned, t]);

  const removeScanned = useCallback((matUid: string) => {
    setScanned((prev) => prev.filter((s) => s.matUid !== matUid));
    setScanError(null);
  }, []);

  const totalMergeQty = useMemo(() => scanned.reduce((s, l) => s + (l.qty ?? 0), 0), [scanned]);
  const canMerge = scanned.length >= 2;

  const handleMerge = useCallback(async () => {
    if (!canMerge) return;
    setMerging(true);
    setMergeError(null);
    try {
      const res = await api.post("/material/lot-merge", {
        sourceLotIds: scanned.map((s) => s.matUid),
      });
      const result = res.data?.data;
      setShowConfirm(false);
      if (result?.label) {
        setLabelData(result.label);
        setLabelItemName(result.itemName ?? scanned[0]?.itemName ?? "");
        // 병합은 동일 입하번호 LOT만 허용 → 첫 스캔 LOT의 제조사를 계승
        setLabelMfgName(resolveMfgPartnerName(scanned[0]?.mfgPartnerCode));
        setIsLabelOpen(true);
      }
      setScanned([]);
      fetchData();
    } catch (e: unknown) {
      setMergeError(extractMsg(e, t("material.lotMerge.mergeFailed")));
    } finally {
      setMerging(false);
    }
  }, [canMerge, scanned, fetchData, resolveMfgPartnerName, t]);

  const columns = useMemo(() => createLotMergeGridColumns({ t, scanned, addByBarcode }), [t, scanned, addByBarcode]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Merge className="w-7 h-7 text-primary" />{t("material.lotMerge.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lotMerge.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
        </Button>
      </div>

      {/* 바코드 스캔 영역 */}
      <Card className="flex-shrink-0" padding="none"><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <BarcodeScanInput
              ref={scanRef}
              placeholder={t("material.lotMerge.scanPlaceholder")}
              value={scanInput}
              onChange={setScanInput}
              onScan={addByBarcode}
              fullWidth
              autoFocus
            />
          </div>
          <Button onClick={() => addByBarcode(scanInput)} disabled={!scanInput.trim()}>
            <Plus className="w-4 h-4 mr-1" />{t("material.lotMerge.addScan")}
          </Button>
        </div>
        {scanError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />{scanError}
          </div>
        )}

        {/* 누적 시리얼 */}
        {scanned.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {scanned.map((s) => (
              <span key={s.matUid}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 text-sm">
                <span className="font-mono">{s.matUid}</span>
                <span className="text-text-muted">{(s.qty ?? 0).toLocaleString()} {s.unit || "EA"}</span>
                <button onClick={() => removeScanned(s.matUid)} className="text-text-muted hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {scanned.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t("material.lotMerge.selectedCount")} value={scanned.length} icon={ScanLine} color="blue" />
            <StatCard label={t("material.lotMerge.totalQty")} value={totalMergeQty.toLocaleString()} icon={Merge} color="green" />
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => { setScanned([]); setScanError(null); }}>
                {t("material.lotMerge.clearSelection")}
              </Button>
              <Button onClick={() => { setMergeError(null); setShowConfirm(true); }} disabled={!canMerge}>
                <Merge className="w-4 h-4 mr-1" />{t("material.lotMerge.mergeSelected")} ({scanned.length})
              </Button>
            </div>
          </div>
        )}
      </CardContent></Card>

      {/* 병합 가능 LOT 목록 (참조 — + 버튼으로 누적에 추가) */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("material.lotMerge.title")}
          toolbarLeft={
            <div className="flex gap-2 items-center">
              <Input placeholder={t("material.lotMerge.searchPlaceholder")}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} />
            </div>
          }
          sqlQuery={`SELECT ml.*\nFROM MAT_LOTS ml\nWHERE ml.STATUS = 'NORMAL'\n  AND ml.COMPANY = '40'\n  AND ml.PLANT_CD = '1000'\n  AND ml.INIT_QTY <= NVL((SELECT SUM(st.QTY) FROM STOCK_TRANSACTIONS st\n    WHERE st.MAT_UID = ml.MAT_UID AND st.TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND st.STATUS <> 'CANCELED'), 0)\nORDER BY ml.ITEM_CODE, ml.ORIGIN, ml.MAT_UID`}/>
      </CardContent></Card>

      {/* 병합 확인 모달 */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        title={t("material.lotMerge.confirmTitle")} size="lg">
        <div className="space-y-4">
          <p className="text-text">{t("material.lotMerge.confirmMessageNew")}</p>
          <div className="bg-surface-alt dark:bg-surface rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("material.lotMerge.mergingLots")}:</span>
              <span className="text-text font-mono text-right">{scanned.map((l) => l.matUid).join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-text-muted">{t("material.lotMerge.totalQty")}:</span>
              <span className="font-bold text-primary">{totalMergeQty.toLocaleString()} {scanned[0]?.unit || "EA"}</span>
            </div>
          </div>
          {mergeError && <div className="text-sm text-red-600 dark:text-red-400">{mergeError}</div>}
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleMerge} disabled={merging}>
            {merging ? t("common.saving") : t("material.lotMerge.confirmMerge")}
          </Button>
        </div>
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
