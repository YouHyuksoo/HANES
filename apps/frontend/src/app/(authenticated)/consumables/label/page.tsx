"use client";

/**
 * @file src/app/(authenticated)/consumables/label/page.tsx
 * @description 소모품 라벨 발행 페이지 — 마스터 선택 → conUid 채번 → 라벨 인쇄
 *
 * 초보자 가이드:
 * 1. 마스터 목록을 DataGrid에 표시 (체크박스 + 발행수량 입력)
 * 2. "UID 발행" 클릭 → 선택 건마다 POST create → conUid 생성
 * 3. 생성 결과를 배너로 표시 + 브라우저 인쇄
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Tag, Search, RefreshCw, CheckCircle, Printer,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { api } from "@/services/api";
import { LabelableMaster, useConLabelColumns } from "./components/ConLabelColumns";
import { useConLabelIssue } from "./components/useConLabelIssue";
import {
  LabelDesign,
  createDefaultLabelDesign,
  ensureObjectLabelDesign,
} from "../../master/label/types";
import { LabelPrintRenderer } from "../../master/label/components/LabelDesignRenderer";

interface TemplateInfo {
  templateName: string;
  category: string;
  printMode: string;
}

function ConsumableLabelPage() {
  const { t } = useTranslation();
  const [masters, setMasters] = useState<LabelableMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Map<string, number>>(new Map());
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("jig"));
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  /** 마스터 목록 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/consumables/label/masters");
      const raw = res.data?.data ?? res.data;
      setMasters(Array.isArray(raw) ? raw : []);
    } catch { setMasters([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await api.get("/master/label-templates", { params: { category: "jig" } });
      const templates = res.data?.data ?? [];
      const tpl = templates.find((item: { isDefault: boolean }) => item.isDefault) || templates[0];
      if (!tpl) return;
      const rawDesign = typeof tpl.designData === "string" ? JSON.parse(tpl.designData) : tpl.designData;
      setTemplate({
        templateName: tpl.templateName,
        category: tpl.category,
        printMode: tpl.printMode ?? "BROWSER",
      });
      setLabelDesign(ensureObjectLabelDesign(rawDesign, "jig"));
    } catch {
      setTemplate(null);
      setLabelDesign(createDefaultLabelDesign("jig"));
    }
  }, []);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  /** 필터링된 마스터 목록 */
  const filteredMasters = useMemo(() => {
    if (!searchText.trim()) return masters;
    const q = searchText.toLowerCase();
    return masters.filter((m) =>
      m.consumableCode.toLowerCase().includes(q) ||
      m.consumableName.toLowerCase().includes(q));
  }, [masters, searchText]);

  /** 수량 설정 */
  const setQty = useCallback((code: string, qty: number) => {
    setQtyMap((prev) => new Map(prev).set(code, qty));
  }, []);

  /** 발행 비즈니스 로직 */
  const {
    issuing, createdUids,
    createConUids, logBrowserPrint, clearCreatedUids,
  } = useConLabelIssue({
    filteredMasters, selectedCodes, qtyMap, onRefresh: fetchData,
  });

  /** 전체 선택/해제 */
  const toggleAll = useCallback((checked: boolean) => {
    setSelectedCodes(checked ? new Set(filteredMasters.map((m) => m.consumableCode)) : new Set());
  }, [filteredMasters]);

  const toggleItem = useCallback((code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }, []);

  const allSelected = filteredMasters.length > 0 &&
    filteredMasters.every((m) => selectedCodes.has(m.consumableCode));

  const columns = useConLabelColumns({
    allSelected, selectedCodes, toggleAll, toggleItem, qtyMap, setQty,
  });

  /** 브라우저 인쇄 (conUid 생성 → 인쇄 → 이력기록) */
  const handleBrowserPrint = useCallback(async () => {
    if (selectedCodes.size === 0) return;
    const created = await createConUids();
    if (created.length === 0) return;
    const conUids = created.map((c) => c.conUid);

    setPrinting(true);
    setTimeout(async () => {
      if (!printRef.current) { setPrinting(false); return; }
      const win = window.open("", "_blank");
      if (!win) { setPrinting(false); return; }
      win.document.write(`<html><head><title>${t("consumables.label.printTitle")}</title>
        <style>*{box-sizing:border-box}body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif;background:#fff}.label-grid{display:flex;flex-wrap:wrap;gap:0;padding:0}
        img{max-width:100%;max-height:100%}@page{size:${labelDesign.labelWidth}mm ${labelDesign.labelHeight}mm;margin:0}</style>
        </head><body><div class="label-grid">${printRef.current.innerHTML}</div>
        <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
      win.document.close();
      await logBrowserPrint(conUids);
      setPrinting(false);
      setSelectedCodes(new Set());
      clearCreatedUids();
      fetchData();
    }, 500);
  }, [selectedCodes, createConUids, t, labelDesign.labelHeight, labelDesign.labelWidth, logBrowserPrint, fetchData, clearCreatedUids]);

  const printItems = useMemo(() => createdUids.map((item) => ({
    key: item.conUid,
    data: {
      conUid: item.conUid,
      consumableCode: item.consumableCode,
      consumableName: item.consumableName,
      category: item.category ?? "",
      imageUrl: item.imageUrl ?? "",
      stockQty: item.stockQty ?? "",
      expectedLife: item.expectedLife ?? "",
      location: item.location ?? "",
    },
  })), [createdUids]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />{t("consumables.label.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("consumables.label.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <span className="hidden xl:inline-flex items-center h-8 px-2.5 rounded border border-border bg-surface text-xs text-text-muted">
            {template ? `${template.templateName} / ${template.printMode}` : "기본 디자인"}
          </span>
          <Button size="sm" onClick={handleBrowserPrint}
            disabled={selectedCodes.size === 0 || issuing || printing}>
            <Printer className="w-4 h-4 mr-1" />
            {issuing ? t("consumables.label.issuing") : t("consumables.label.issueBtn")}
          </Button>
        </div>
      </div>

      {/* 생성된 conUid 결과 배너 */}
      {createdUids.length > 0 && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {t("consumables.label.issueSuccess", { count: createdUids.length })}
            </span>
            <button onClick={clearCreatedUids}
              className="ml-auto text-indigo-400 hover:text-indigo-600">
              <span className="text-xs">x</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {createdUids.slice(0, 20).map((c) => (
              <span key={c.conUid}
                className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono">
                {c.conUid}
              </span>
            ))}
            {createdUids.length > 20 && (
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                +{createdUids.length - 20}
              </span>
            )}
          </div>
        </div>
      )}

      {/* DataGrid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={filteredMasters} columns={columns} isLoading={loading || issuing}
          enableColumnFilter enableExport exportFileName={t("consumables.label.title")}
          toolbarLeft={
            <Input placeholder={t("consumables.label.searchPlaceholder")}
              value={searchText} onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />} />
          } 
          sqlQuery={`SELECT *\nFROM CON_LABELS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <LabelPrintRenderer ref={printRef} items={printItems} design={labelDesign} visible={printing} />
    </div>
  );
}

export default ConsumableLabelPage;
