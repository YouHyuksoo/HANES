"use client";

/**
 * @file src/app/(authenticated)/material/receive-label/page.tsx
 * @description 입고라벨 발행 페이지 - IQC 합격 LOT 선택 후 자재롯트 라벨 발행
 *
 * 초보자 가이드:
 * 1. **대상**: IQC 합격(PASSED) LOT 중 라벨 발행할 건을 체크박스로 선택
 * 2. **발행**: 출력 방식(브라우저/ZPL USB/ZPL TCP) 선택 후 "라벨 발행" 클릭
 * 3. **템플릿**: 기준정보 > 라벨관리 > 자재롯트라벨 탭에서 디자인 저장
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Printer, Search, RefreshCw, Tag, CheckCircle, Package, FileText, Info,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { api } from "@/services/api";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import { LabelDesign, MAT_LOT_DEFAULT_DESIGN } from "../../master/label/types";
import PrintActionBar from "./components/PrintActionBar";
import LabelPreviewRenderer, { LabelItem } from "./components/LabelPreviewRenderer";
import PrintHistorySection from "./components/PrintHistorySection";
import { PassedLot, useReceiveLabelColumns } from "./components/useReceiveLabelColumns";

/** 템플릿 정보 */
interface TemplateInfo { id: string; printMode: string; }

function ReceiveLabelPage() {
  const { t } = useTranslation();
  const [lots, setLots] = useState<PassedLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(MAT_LOT_DEFAULT_DESIGN);
  const [printing, setPrinting] = useState(false);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { isEnabled } = useSysConfigStore();
  const isAutoReceive = isEnabled('IQC_AUTO_RECEIVE');
  const [autoReceiveResult, setAutoReceiveResult] = useState<{
    received: string[]; skipped: string[]; warehouseName?: string;
  } | null>(null);

  /** IQC 합격 LOT 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/receiving/receivable");
      const raw = res.data?.data ?? res.data;
      setLots(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch { setLots([]); }
    finally { setLoading(false); }
  }, []);

  /** 자재롯트 라벨 템플릿 로드 */
  const fetchTemplate = useCallback(async () => {
    try {
      const res = await api.get("/master/label-templates", { params: { category: "mat_lot" } });
      const templates = res.data?.data ?? [];
      const tpl = templates.find((t: { isDefault: boolean }) => t.isDefault) || templates[0];
      if (tpl) {
        setTemplate({ id: tpl.id, printMode: tpl.printMode ?? 'BROWSER' });
        if (tpl.designData) {
          setLabelDesign(typeof tpl.designData === "string" ? JSON.parse(tpl.designData) : tpl.designData);
        }
      }
    } catch { /* 템플릿 없으면 기본값 사용 */ }
  }, []);

  useEffect(() => { fetchData(); fetchTemplate(); }, [fetchData, fetchTemplate]);

  /** 검색 필터 */
  const filteredLots = useMemo(() => {
    if (!searchText.trim()) return lots;
    const q = searchText.toLowerCase();
    return lots.filter((lot) =>
      lot.lotNo.toLowerCase().includes(q) || lot.part.partCode.toLowerCase().includes(q) ||
      lot.part.partName.toLowerCase().includes(q) || (lot.vendor ?? "").toLowerCase().includes(q));
  }, [lots, searchText]);

  /** 통계 */
  const stats = useMemo(() => {
    const sel = filteredLots.filter((l) => selectedIds.has(l.id));
    return {
      totalLots: filteredLots.length,
      totalQty: filteredLots.reduce((s, l) => s + l.initQty, 0),
      selectedLots: sel.length,
      selectedQty: sel.reduce((s, l) => s + l.initQty, 0),
    };
  }, [filteredLots, selectedIds]);

  const toggleAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredLots.map((l) => l.id)) : new Set());
  }, [filteredLots]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allSelected = filteredLots.length > 0 && filteredLots.every((l) => selectedIds.has(l.id));
  const columns = useReceiveLabelColumns({ allSelected, selectedIds, toggleAll, toggleItem });

  /** 자동입고 처리 */
  const handleAutoReceive = useCallback(async () => {
    const selected = filteredLots.filter((l) => selectedIds.has(l.id));
    if (!isAutoReceive || selected.length === 0) return;
    try {
      const res = await api.post("/material/receiving/auto", { lotIds: selected.map((l) => l.id) });
      const result = res.data?.data;
      if (result) {
        setAutoReceiveResult(result);
        if (result.received?.length > 0) fetchData();
      }
    } catch (err) { console.error("Auto-receive failed:", err); }
  }, [filteredLots, selectedIds, isAutoReceive, fetchData]);

  /** 브라우저 인쇄 (자동입고 포함) */
  const handleBrowserPrint = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await handleAutoReceive();
    setPrinting(true);
    setTimeout(() => {
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
      setPrinting(false);
    }, 500);
  }, [selectedIds, handleAutoReceive, labelDesign, t]);

  /** 선택된 LOT -> 라벨 데이터 */
  const labelItems = useMemo<LabelItem[]>(() => {
    const selected = filteredLots.filter((l) => selectedIds.has(l.id));
    const result: LabelItem[] = [];
    for (const lot of selected) {
      for (let i = 0; i < lot.initQty; i++) {
        result.push({ key: `${lot.id}-${i}`, lotNo: lot.lotNo, partCode: lot.part.partCode,
          partName: lot.part.partName, sub: `${lot.vendor ?? ""} | ${lot.recvDate?.slice(0, 10) ?? ""}` });
      }
    }
    return result;
  }, [filteredLots, selectedIds]);

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
            selectedCount={stats.selectedLots} selectedQty={stats.selectedQty}
            templateId={template?.id ?? null} templatePrintMode={template?.printMode ?? 'BROWSER'}
            selectedLotIds={Array.from(selectedIds)} onBrowserPrint={handleBrowserPrint}
            printing={printing}
          />
        </div>
      </div>

      {/* 자동입고 설정 상태 배너 */}
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
        <StatCard label={t("material.receiveLabel.stats.totalLots")} value={stats.totalLots} icon={Package} color="blue" />
        <StatCard label={t("material.receiveLabel.stats.totalQty")} value={stats.totalQty} icon={FileText} color="gray" />
        <StatCard label={t("material.receiveLabel.stats.selectedLots")} value={stats.selectedLots} icon={CheckCircle} color="green" />
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
              <button onClick={() => setAutoReceiveResult(null)} className="ml-auto text-green-400 hover:text-green-600">
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

      {/* 검색 + 테이블 */}
      <Card><CardContent>
        <DataGrid data={filteredLots} columns={columns} isLoading={loading}
          enableColumnFilter enableExport exportFileName={t("material.receiveLabel.title")}
          toolbarLeft={
            <Input placeholder={t("material.receiveLabel.searchPlaceholder")}
              value={searchText} onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />} />
          } />
      </CardContent></Card>

      {/* 발행 이력 */}
      <PrintHistorySection category="mat_lot" />

      {/* 인쇄용 라벨 렌더링 (숨김) */}
      <LabelPreviewRenderer ref={printRef} items={labelItems} design={labelDesign} visible={printing} />
    </div>
  );
}

export default ReceiveLabelPage;
