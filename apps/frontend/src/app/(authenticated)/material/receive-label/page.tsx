"use client";

/**
 * @file src/app/(authenticated)/material/receive-label/page.tsx
 * @description 입고라벨 발행 페이지 - IQC 합격 입하 건 선택 후 자재시리얼 생성 및 라벨 발행
 *
 * 초보자 가이드:
 * 1. **대상**: IQC 합격(PASS) 입하 건을 DataGrid에 표시
 * 2. **선택**: 체크박스로 입하 건 선택 (전체선택/개별선택)
 * 3. **발행**: "라벨 발행" 클릭 → 선택 건마다 POST create → matUid 생성 → 라벨 인쇄
 * 4. **자동추적**: 발행 완료 시 이력 기록 → 목록 자동 새로고침
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Printer, Search, RefreshCw, Tag, CheckCircle, Package, Info,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { api } from "@/services/api";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import { LabelDesign, MAT_LOT_DEFAULT_DESIGN } from "../../master/label/types";
import PrintActionBar from "./components/PrintActionBar";
import LabelPreviewRenderer, { LabelItem } from "./components/LabelPreviewRenderer";
import PrintHistorySection from "./components/PrintHistorySection";
import { LabelableArrival, useReceiveLabelColumns } from "./components/useReceiveLabelColumns";
import { useLabelIssue } from "./components/useLabelIssue";

/** 템플릿 정보 */
interface TemplateInfo { id: string; printMode: string; }

function ReceiveLabelPage() {
  const { t } = useTranslation();
  const [arrivals, setArrivals] = useState<LabelableArrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showUnlabeledOnly, setShowUnlabeledOnly] = useState(true);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(MAT_LOT_DEFAULT_DESIGN);
  const [printing, setPrinting] = useState(false);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { isEnabled } = useSysConfigStore();
  const isAutoReceive = isEnabled('IQC_AUTO_RECEIVE');

  /** IQC 합격 입하 건 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/receive-label/arrivals");
      const raw = res.data?.data ?? res.data;
      setArrivals(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch { setArrivals([]); }
    finally { setLoading(false); }
  }, []);

  /** 자재롯트 라벨 템플릿 로드 */
  const fetchTemplate = useCallback(async () => {
    try {
      const res = await api.get("/master/label-templates", { params: { category: "mat_lot" } });
      const templates = res.data?.data ?? [];
      const tpl = templates.find((tp: { isDefault: boolean }) => tp.isDefault) || templates[0];
      if (tpl) {
        setTemplate({ id: tpl.id, printMode: tpl.printMode ?? 'BROWSER' });
        if (tpl.designData) {
          setLabelDesign(typeof tpl.designData === "string" ? JSON.parse(tpl.designData) : tpl.designData);
        }
      }
    } catch { /* 템플릿 없으면 기본값 사용 */ }
  }, []);

  useEffect(() => { fetchData(); fetchTemplate(); }, [fetchData, fetchTemplate]);

  /** 필터링된 입하 목록 (미발행 필터 + 검색) */
  const filteredArrivals = useMemo(() => {
    let result = arrivals;
    if (showUnlabeledOnly) result = result.filter((a) => !a.labelPrinted);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((a) =>
        a.arrivalNo.toLowerCase().includes(q) ||
        (a.itemCode ?? "").toLowerCase().includes(q) ||
        (a.itemName ?? "").toLowerCase().includes(q) ||
        (a.vendor ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [arrivals, showUnlabeledOnly, searchText]);

  /** 발행 비즈니스 로직 훅 */
  const {
    issuing, createdUids, autoReceiveResult,
    createMatUids, handleAutoReceive, logBrowserPrint,
    clearCreatedUids, clearAutoReceiveResult,
  } = useLabelIssue({ filteredArrivals, selectedIds, isAutoReceive, onRefresh: fetchData });

  /** 통계 */
  const stats = useMemo(() => {
    const unlabeled = arrivals.filter((a) => !a.labelPrinted);
    const sel = filteredArrivals.filter((a) => selectedIds.has(a.id));
    return {
      unlabeledCount: unlabeled.length, totalCount: filteredArrivals.length,
      selectedCount: sel.length, selectedQty: sel.reduce((s, a) => s + a.qty, 0),
    };
  }, [arrivals, filteredArrivals, selectedIds]);

  const toggleAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredArrivals.map((a) => a.id)) : new Set());
  }, [filteredArrivals]);

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allSelected = filteredArrivals.length > 0 && filteredArrivals.every((a) => selectedIds.has(a.id));
  const columns = useReceiveLabelColumns({ allSelected, selectedIds, toggleAll, toggleItem });

  /** 브라우저 인쇄 (matUid 생성 → 자동입고 → 인쇄 → 이력기록 → 새로고침) */
  const handleBrowserPrint = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const created = await createMatUids();
    if (created.length === 0) return;
    const matUids = created.map((c) => c.matUid);
    await handleAutoReceive(matUids);
    setPrinting(true);
    setTimeout(async () => {
      if (!printRef.current) { setPrinting(false); return; }
      const win = window.open("", "_blank");
      if (!win) { setPrinting(false); return; }
      win.document.write(`<html><head><title>${t("material.receiveLabel.printTitle")}</title>
        <style>body{margin:0;font-family:sans-serif}.label-grid{display:flex;flex-wrap:wrap;gap:2px;padding:4px}
        .label-card{border:1px dashed #ccc;position:relative;overflow:hidden;width:${labelDesign.labelWidth}mm;
        height:${labelDesign.labelHeight}mm;page-break-inside:avoid;box-sizing:border-box}
        canvas{max-width:100%;max-height:100%}@media print{.label-card{border:1px dashed #ddd}}</style>
        </head><body><div class="label-grid">${printRef.current.innerHTML}</div>
        <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
      win.document.close();
      await logBrowserPrint(matUids);
      setPrinting(false);
      setSelectedIds(new Set());
      clearCreatedUids();
      fetchData();
    }, 500);
  }, [selectedIds, createMatUids, handleAutoReceive, labelDesign, t, logBrowserPrint, fetchData, clearCreatedUids]);

  /** 생성된 matUid → 라벨 데이터 */
  const labelItems = useMemo<LabelItem[]>(() =>
    createdUids.map((c) => ({
      key: c.matUid, matUid: c.matUid,
      itemCode: c.itemCode ?? "", itemName: c.itemName ?? "", sub: "",
    })), [createdUids]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />{t("material.receiveLabel.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.receiveLabel.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          <PrintActionBar
            selectedCount={stats.selectedCount} selectedQty={stats.selectedQty}
            templateId={template?.id ?? null} templatePrintMode={template?.printMode ?? 'BROWSER'}
            selectedLotIds={createdUids.map((c) => c.matUid)} onBrowserPrint={handleBrowserPrint}
            printing={printing || issuing}
            onPrintComplete={() => { setSelectedIds(new Set()); clearCreatedUids(); fetchData(); }}
          />
        </div>
      </div>

      {/* 자동입고 배너 */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
        isAutoReceive
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
      }`}>
        <Info className="w-4 h-4 shrink-0" />
        <span>{isAutoReceive
          ? t("material.receiveLabel.autoReceive.enabledBanner")
          : t("material.receiveLabel.autoReceive.disabledBanner")}</span>
        <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
          isAutoReceive ? "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200"
            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        }`}>{isAutoReceive ? "ON" : "OFF"}</span>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.receiveLabel.stats.unlabeledLots")} value={stats.unlabeledCount} icon={Package} color="blue" />
        <StatCard label={t("material.receiveLabel.stats.totalLots")} value={stats.totalCount} icon={Tag} color="gray" />
        <StatCard label={t("material.receiveLabel.stats.selectedLots")} value={stats.selectedCount} icon={CheckCircle} color="green" />
        <StatCard label={t("material.receiveLabel.stats.selectedLabels")} value={stats.selectedQty} icon={Printer} color="purple" />
      </div>

      {/* 자동입고 결과 알림 */}
      {autoReceiveResult && (
        <div className="space-y-2">
          {autoReceiveResult.received?.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-300">
                {t("material.receiveLabel.autoReceive.success", {
                  count: autoReceiveResult.received.length, warehouse: autoReceiveResult.warehouseName || "" })}
              </span>
              <button onClick={() => clearAutoReceiveResult()} className="ml-auto text-green-400 hover:text-green-600">
                <span className="text-xs">x</span>
              </button>
            </div>
          )}
          {autoReceiveResult.skipped?.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {t("material.receiveLabel.autoReceive.skipped", { count: autoReceiveResult.skipped.length })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 생성된 자재시리얼 결과 배너 */}
      {createdUids.length > 0 && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {t("material.receiveLabel.issueSuccess", { count: createdUids.length })}
            </span>
            <button onClick={clearCreatedUids} className="ml-auto text-indigo-400 hover:text-indigo-600">
              <span className="text-xs">x</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {createdUids.slice(0, 20).map((c) => (
              <span key={c.matUid}
                className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono">
                {c.matUid}
              </span>
            ))}
            {createdUids.length > 20 && (
              <span className="text-xs text-indigo-500 dark:text-indigo-400">+{createdUids.length - 20}</span>
            )}
          </div>
        </div>
      )}

      {/* DataGrid */}
      <Card><CardContent>
        <DataGrid data={filteredArrivals} columns={columns} isLoading={loading || issuing}
          enableColumnFilter enableExport exportFileName={t("material.receiveLabel.title")}
          toolbarLeft={
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowUnlabeledOnly(!showUnlabeledOnly); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${
                  showUnlabeledOnly ? "bg-primary text-white"
                    : "bg-surface border border-border text-text-muted hover:text-text"
                }`}>{t("material.receiveLabel.unlabeledOnly")}</button>
              <Input placeholder={t("material.receiveLabel.searchPlaceholder")}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} />
            </div>
          } />
      </CardContent></Card>

      <PrintHistorySection category="mat_lot" />
      <LabelPreviewRenderer ref={printRef} items={labelItems} design={labelDesign} visible={printing} />
    </div>
  );
}

export default ReceiveLabelPage;
