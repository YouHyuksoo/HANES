"use client";

/**
 * @file src/app/(authenticated)/consumables/label/page.tsx
 * @description 소모품 라벨 발행 페이지 — 마스터 선택 → conUid 채번 → 라벨 인쇄
 *
 * 초보자 가이드:
 * 1. 마스터 목록을 DataGrid에 표시 (체크박스 + 발행수량 입력)
 * 2. "UID 발행" 클릭 → 선택 건마다 POST create → conUid 생성
 * 3. 생성 상태를 한 줄로 표시 + 브라우저 인쇄
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Tag, Search, RefreshCw, Printer,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
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
  templateKey: string;
  templateName: string;
  category: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

interface IssueStatus {
  type: "loading" | "success" | "error";
  message: string;
}

const DEFAULT_TEMPLATE_KEY = "__default__";

function ConsumableLabelPage() {
  const { t } = useTranslation();
  const [masters, setMasters] = useState<LabelableMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Map<string, number>>(new Map());
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("jig"));
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [issueStatus, setIssueStatus] = useState<IssueStatus | null>(null);
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
          designData: ensureObjectLabelDesign(rawDesign, "jig"),
          isDefault: tpl.isDefault,
        };
      });
      setTemplates(nextTemplates);

      const tpl = nextTemplates.find((item) => item.isDefault) || nextTemplates[0];
      if (!tpl) {
        setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
        setTemplate(null);
        setLabelDesign(createDefaultLabelDesign("jig"));
        return;
      }
      const rawDesign = tpl.designData;
      setSelectedTemplateKey(tpl.templateKey);
      setTemplate({
        templateKey: tpl.templateKey,
        templateName: tpl.templateName,
        category: tpl.category,
        printMode: tpl.printMode,
        designData: tpl.designData,
        isDefault: tpl.isDefault,
      });
      setLabelDesign(ensureObjectLabelDesign(rawDesign, "jig"));
    } catch {
      setTemplates([]);
      setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
      setTemplate(null);
      setLabelDesign(createDefaultLabelDesign("jig"));
    }
  }, []);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const templateOptions = useMemo(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: "기본 디자인" },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ""}`,
    })),
  ], [templates]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === DEFAULT_TEMPLATE_KEY) {
      setTemplate(null);
      setLabelDesign(createDefaultLabelDesign("jig"));
      return;
    }
    const tpl = templates.find((item) => item.templateKey === templateKey);
    if (!tpl) return;
    const rawDesign = tpl.designData;
    setTemplate(tpl);
    setLabelDesign(ensureObjectLabelDesign(rawDesign, "jig"));
  }, [templates]);

  const categoryFilterOptions = useMemo(() => [
    { value: "", label: "전체 카테고리" },
    ...Array.from(new Set(masters.map((m) => m.category).filter((category): category is string => Boolean(category))))
      .sort()
      .map((category) => ({ value: category, label: category })),
  ], [masters]);

  const handleCategoryFilterChange = useCallback((value: string) => {
    setCategoryFilter(value);
    setSelectedCodes(new Set());
  }, []);

  /** 필터링된 마스터 목록 */
  const filteredMasters = useMemo(() => {
    const q = searchText.toLowerCase();
    return masters.filter((m) => {
      const matchesCategory = !categoryFilter || m.category === categoryFilter;
      const matchesSearch = !q.trim() ||
        m.consumableCode.toLowerCase().includes(q) ||
        m.consumableName.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [masters, searchText, categoryFilter]);

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

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("브라우저가 출력창을 차단했습니다. 이 사이트의 팝업을 허용해 주세요.");
      setIssueStatus({
        type: "error",
        message: "브라우저가 출력창을 차단했습니다. 이 사이트의 팝업을 허용해 주세요.",
      });
      return;
    }
    printWin.document.write(`<html><head><title>${t("consumables.label.printTitle")}</title>
      <style>body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#334155}</style>
      </head><body>UID를 발행하고 라벨 출력 준비 중입니다.</body></html>`);
    printWin.document.close();

    clearCreatedUids();
    const loadingToast = toast.loading("UID를 발행하고 라벨 출력 준비 중입니다.");
    setIssueStatus({
      type: "loading",
      message: "UID를 발행하고 라벨 출력 준비 중입니다.",
    });

    let created;
    try {
      created = await createConUids();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "UID 발행 중 오류가 발생했습니다.";
      printWin.close();
      toast.error(message, { id: loadingToast });
      setIssueStatus({ type: "error", message });
      return;
    }

    if (created.length === 0) {
      printWin.close();
      toast.error("발행된 UID가 없습니다. 선택 항목과 발행 수량을 확인하세요.", { id: loadingToast });
      setIssueStatus({
        type: "error",
        message: "발행된 UID가 없습니다. 선택 항목과 발행 수량을 확인하세요.",
      });
      return;
    }
    const conUids = created.map((c) => c.conUid);

    setPrinting(true);
    setIssueStatus({
      type: "loading",
      message: `${conUids.length}건 발행 완료. 인쇄 다이얼로그를 호출하는 중입니다.`,
    });
    setTimeout(async () => {
      if (!printRef.current || printWin.closed) {
        setPrinting(false);
        if (!printWin.closed) printWin.close();
        toast.error("라벨 출력 화면을 준비하지 못했습니다.", { id: loadingToast });
        setIssueStatus({
          type: "error",
          message: "라벨 출력 화면을 준비하지 못했습니다.",
        });
        return;
      }
      printWin.document.open();
      printWin.document.write(`<html><head><title>${t("consumables.label.printTitle")}</title>
        <style>*{box-sizing:border-box}body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif;background:#fff}.label-grid{display:flex;flex-wrap:wrap;gap:0;padding:0}
        img{max-width:100%;max-height:100%}@page{size:${labelDesign.labelWidth}mm ${labelDesign.labelHeight}mm;margin:0}</style>
        </head><body><div class="label-grid">${printRef.current.innerHTML}</div>
        <script>
          window.onload = () => {
            window.focus();
            window.setTimeout(() => window.print(), 150);
          };
        <\/script></body></html>`);
      printWin.document.close();
      await logBrowserPrint(conUids);
      setPrinting(false);
      setSelectedCodes(new Set());
      toast.success(`${conUids.length}건 UID 발행 후 인쇄 다이얼로그를 호출했습니다.`, { id: loadingToast });
      setIssueStatus({
        type: "success",
        message: `${conUids.length}건 UID 발행 후 인쇄 다이얼로그를 호출했습니다.`,
      });
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
          <div
            role="status"
            aria-live="polite"
            className={`h-9 w-80 min-w-0 flex items-center justify-end truncate text-xs ${
              issueStatus?.type === "error"
                ? "text-red-500"
                : issueStatus?.type === "success"
                  ? "text-emerald-500"
                  : "text-text-muted"
            }`}
            title={issueStatus?.message ?? ""}
          >
            <span className="truncate">
              {issueStatus?.message ?? (selectedCodes.size > 0 ? `${selectedCodes.size}건 선택됨` : "")}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <div className="w-64">
            <Select
              options={templateOptions}
              value={selectedTemplateKey}
              onChange={handleTemplateChange}
              fullWidth
            />
          </div>
          <Button size="sm" onClick={handleBrowserPrint}
            disabled={selectedCodes.size === 0 || issuing || printing}>
            <Printer className="w-4 h-4 mr-1" />
            {printing ? "출력중" : issuing ? t("consumables.label.issuing") : t("consumables.label.issueBtn")}
          </Button>
        </div>
      </div>

      {/* DataGrid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={filteredMasters} columns={columns} isLoading={loading || issuing}
          enableColumnFilter enableExport exportFileName={t("consumables.label.title")}
          toolbarLeft={
            <div className="flex items-center gap-2">
              <div className="w-72">
                <Input placeholder={t("consumables.label.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} />
              </div>
              <div className="w-44">
                <Select
                  aria-label="카테고리 필터"
                  options={categoryFilterOptions}
                  value={categoryFilter}
                  onChange={handleCategoryFilterChange}
                  fullWidth
                />
              </div>
            </div>
          } 
          sqlQuery={`SELECT *\nFROM CON_LABELS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <LabelPrintRenderer ref={printRef} items={printItems} design={labelDesign} visible={printing} />
    </div>
  );
}

export default ConsumableLabelPage;
