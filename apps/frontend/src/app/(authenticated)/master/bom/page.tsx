"use client";

/**
 * @file src/app/(authenticated)/master/bom/page.tsx
 * @description 제품/반제품 BOM 구조와 선택 품목 기준 라우팅 상세 통합 화면
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Calendar, Download, FileSpreadsheet, GitBranch, Layers, RefreshCw, Search, X } from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import BomTab from "./components/BomTab";
import BomUploadModal from "./components/BomUploadModal";
import QualityConditionEditor from "../routing/components/QualityConditionEditor";
import RoutingMaterialEditor from "../routing/components/RoutingMaterialEditor";
import type { BomRoutingInfo, BomRoutingProcess, ParentPart, RoutingTarget } from "./types";
import type { SelectedProcess } from "../routing/types";
import { getTodayLocal } from "@/utils/date";

export default function BomPage() {
  usePageAiTools("master.bom");
  const { t } = useTranslation();
  const router = useRouter();
  const itemTypeOptions = useComCodeOptions("ITEM_TYPE");
  const [parents, setParents] = useState<ParentPart[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentPart | null>(null);
  const [selectedBomItem, setSelectedBomItem] = useState<RoutingTarget | null>(null);
  const [routingInfo, setRoutingInfo] = useState<BomRoutingInfo | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<SelectedProcess | null>(null);
  const [routingPanelOpen, setRoutingPanelOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"conditions" | "materials">("conditions");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("FINISHED");
  const [bomDateMode, setBomDateMode] = useState<"effective" | "all">("effective");
  const [effectiveDate, setEffectiveDate] = useState(getTodayLocal());
  const [loadingParents, setLoadingParents] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loadingRouting, setLoadingRouting] = useState(false);

  const itemTypeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    itemTypeOptions.forEach((option) => { map[option.value] = option.label; });
    return map;
  }, [itemTypeOptions]);

  const filteredParents = useMemo(() => {
    if (!typeFilter) return parents;
    return parents.filter((parent) => parent.itemType === typeFilter);
  }, [parents, typeFilter]);

  const processes = useMemo(() => routingInfo?.processes ?? [], [routingInfo]);

  const fetchParents = useCallback(async () => {
    setLoadingParents(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (bomDateMode === "effective" && effectiveDate) params.effectiveDate = effectiveDate;
      const res = await api.get("/master/boms/parents", { params });
      const data: ParentPart[] = res.data?.success ? res.data.data || [] : [];
      setParents(data);
      setSelectedParent((prev) => {
        if (prev && data.some((parent) => parent.itemCode === prev.itemCode)) return prev;
        return data[0] ?? null;
      });
    } catch {
      setParents([]);
      setSelectedParent(null);
    } finally {
      setLoadingParents(false);
    }
  }, [bomDateMode, effectiveDate, searchText]);

  const fetchRoutingByBomItem = useCallback(async () => {
    if (!routingPanelOpen || !selectedBomItem?.itemCode) {
      setRoutingInfo(null);
      setSelectedProcess(null);
      return;
    }

    setLoadingRouting(true);
    try {
      const res = await api.get(`/master/routing-groups/by-item/${selectedBomItem.itemCode}`);
      const data: BomRoutingInfo | null = res.data?.data ?? null;
      setRoutingInfo(data);
      setSelectedProcess((prev) => {
        const nextProcesses = data?.processes ?? [];
        if (prev && prev.routingCode === data?.routingCode && nextProcesses.some((process) => process.seq === prev.seq)) return prev;
        const first = nextProcesses[0];
        return first && data
          ? {
              routingCode: first.routingCode,
              routingName: data.routingName,
              seq: first.seq,
              processCode: first.processCode,
              processName: first.processName,
            }
          : null;
      });
    } catch {
      setRoutingInfo(null);
      setSelectedProcess(null);
    } finally {
      setLoadingRouting(false);
    }
  }, [routingPanelOpen, selectedBomItem]);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  useEffect(() => {
    if (!selectedParent) {
      setSelectedBomItem(null);
      return;
    }
    setSelectedBomItem({
      itemCode: selectedParent.itemCode,
      itemName: selectedParent.itemName,
      itemType: selectedParent.itemType,
      breadcrumb: selectedParent.itemCode,
    });
    setRoutingPanelOpen(false);
  }, [selectedParent]);

  useEffect(() => { fetchRoutingByBomItem(); }, [fetchRoutingByBomItem]);

  const openRoutingManagement = useCallback((target?: RoutingTarget | null) => {
    if (target?.itemCode) {
      router.push(`/master/routing?${new URLSearchParams({ itemCode: target.itemCode }).toString()}`);
      return;
    }
    router.push("/master/routing");
  }, [router]);

  const openRoutingPanel = useCallback((target: RoutingTarget) => {
    setSelectedBomItem(target);
    setRoutingPanelOpen(true);
  }, []);

  const handleSelectProcess = useCallback((process: BomRoutingProcess) => {
    if (!routingInfo) return;
    setSelectedProcess({
      routingCode: process.routingCode,
      routingName: routingInfo.routingName,
      seq: process.seq,
      processCode: process.processCode,
      processName: process.processName,
    });
  }, [routingInfo]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            {t("master.bom.title")}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {t("master.bom.pageSubtitle", "제품/반제품 BOM 구조를 선택하고, 선택된 BOM 행 기준으로 라우팅과 투입자재를 관리합니다.")} ({filteredParents.length}{t("common.count", "건")})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const res = await api.get("/master/boms/template", { responseType: "blob" });
              const url = URL.createObjectURL(res.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = "BOM_template.xlsx";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-1" />
            {t("master.bom.downloadTemplate")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            {t("master.bom.excelUpload")}
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setBomDateMode("effective")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                bomDateMode === "effective" ? "bg-primary text-white" : "text-text-muted hover:text-text"
              }`}
            >
              {t("master.bom.effectiveLookup", "기준일")}
            </button>
            <button
              type="button"
              onClick={() => setBomDateMode("all")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                bomDateMode === "all" ? "bg-primary text-white" : "text-text-muted hover:text-text"
              }`}
            >
              {t("master.bom.allHistoryLookup", "전체이력")}
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-muted whitespace-nowrap">{t("master.bom.effectiveDate")}:</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={bomDateMode === "all"}
              className="bg-transparent text-sm text-text font-medium border-none outline-none cursor-pointer"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchParents}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingParents ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        <div className="col-span-3 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <div className="text-sm font-semibold text-text mb-2 shrink-0">{t("master.bom.productSemiProductList", "제품/반제품 목록")}</div>
              <Input
                placeholder={t("master.bom.searchPlaceholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
                className="mb-2 shrink-0"
              />
              <div className="flex gap-1 mb-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setTypeFilter("")}
                  className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                    !typeFilter ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"
                  }`}
                >
                  {t("common.all")}
                </button>
                {itemTypeOptions.filter((option) => !["RAW_MATERIAL", "CONSUMABLE"].includes(option.value)).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTypeFilter(option.value)}
                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                      typeFilter === option.value ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto border border-border rounded-lg min-h-0">
                {loadingParents ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : filteredParents.length === 0 ? (
                  <div className="py-12 text-center text-sm text-text-muted">{t("common.noData")}</div>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {filteredParents.map((parent) => (
                        <tr
                          key={parent.itemCode}
                          onClick={() => setSelectedParent(parent)}
                          className={`border-b border-border/50 cursor-pointer transition-colors ${
                            selectedParent?.itemCode === parent.itemCode
                              ? "bg-primary text-white"
                              : "hover:bg-surface-hover text-text"
                          }`}
                        >
                          <td className="px-2 py-2 min-w-0">
                            <div className="font-mono font-semibold truncate">{parent.itemNo || parent.itemCode}</div>
                            <div className="font-medium truncate">{parent.itemName}</div>
                            <div className="text-[11px] opacity-70 truncate">
                              {parent.itemCode} / {itemTypeLabelMap[parent.itemType] || parent.itemType} / BOM {parent.bomCount}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={`${routingPanelOpen ? "col-span-5" : "col-span-9"} flex flex-col min-h-0`}>
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-2 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-text">{t("master.bom.bomStructureTitle")}</h2>
                  <p className="text-xs text-text-muted truncate">
                    {selectedParent ? `${selectedParent.itemCode} - ${selectedParent.itemName}` : t("master.bom.selectParentPrompt")}
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <BomTab
                  selectedParent={selectedParent}
                  selectedItemCode={selectedBomItem?.itemCode}
                  onSelectItem={setSelectedBomItem}
                  onViewRouting={openRoutingPanel}
                  effectiveDate={bomDateMode === "effective" ? effectiveDate : undefined}
                  compact
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {routingPanelOpen && <div className="col-span-4 grid grid-rows-[220px_minmax(0,1fr)] gap-4 min-h-0">
          <Card padding="none" className="flex flex-col min-h-0">
            <CardContent className="flex flex-col min-h-0 p-3">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-primary" />
                    {t("master.bom.selectedItemRouting", "선택 품목 라우팅")}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {selectedBomItem ? `${selectedBomItem.itemCode} - ${selectedBomItem.itemName}` : t("master.bom.selectBomRowPrompt", "BOM 행을 선택하세요")}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openRoutingManagement(selectedBomItem)}>
                    {t("master.bom.goRoutingManagement")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setRoutingPanelOpen(false)}
                    className="p-1.5 rounded hover:bg-surface text-text-muted hover:text-text"
                    title={t("common.close")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {routingInfo && (
                <div className="mb-2 rounded border border-border bg-surface/60 px-2 py-1.5 text-xs shrink-0">
                  <div className="font-mono font-semibold text-primary truncate">{routingInfo.routingCode}</div>
                  <div className="text-text-muted truncate">{routingInfo.routingName}</div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto border border-border rounded-lg min-h-0">
                {loadingRouting ? (
                  <div className="flex justify-center py-10">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : processes.length === 0 ? (
                  <div className="py-10 text-center text-sm text-text-muted">
                    {selectedBomItem ? t("master.bom.noRoutingInfo", "등록된 라우팅 정보가 없습니다.") : t("master.bom.selectBomRowPromptDot", "BOM 행을 선택하세요.")}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border text-text-muted">
                        <th className="text-center py-2 w-14">{t("master.routing.seq")}</th>
                        <th className="text-left py-2">{t("master.routing.processName")}</th>
                        <th className="text-center py-2 w-28">{t("master.routing.processCode")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map((process) => {
                        const isSelected = selectedProcess?.routingCode === process.routingCode && selectedProcess.seq === process.seq;
                        return (
                          <tr
                            key={`${process.routingCode}-${process.seq}`}
                            onClick={() => handleSelectProcess(process)}
                            className={`border-b border-border/50 cursor-pointer transition-colors ${
                              isSelected ? "bg-primary text-white" : "hover:bg-surface-hover text-text"
                            }`}
                          >
                            <td className="py-2 text-center font-mono">{process.seq}</td>
                            <td className="py-2 font-medium truncate">{process.processName}</td>
                            <td className="py-2 text-center font-mono">{process.processCode}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              {selectedProcess ? (
                <>
                  <div className="flex items-center gap-1 mb-3 shrink-0 border-b border-border">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("conditions")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "conditions"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted hover:text-text"
                      }`}
                    >
                      {t("master.routing.conditionEditorTitle")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("materials")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "materials"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted hover:text-text"
                      }`}
                    >
                      {t("master.routing.materialEditorTitle", { defaultValue: "투입자재" })}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {activeDetailTab === "conditions" ? (
                      <QualityConditionEditor selectedProcess={selectedProcess} />
                    ) : (
                      <RoutingMaterialEditor selectedProcess={selectedProcess} />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  {selectedBomItem ? t("master.bom.selectProcessPrompt", "공정을 선택하세요.") : t("master.bom.selectBomRowPromptDot", "BOM 행을 선택하세요.")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>}
      </div>
      <BomUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={() => fetchParents()}
      />
    </div>
  );
}
