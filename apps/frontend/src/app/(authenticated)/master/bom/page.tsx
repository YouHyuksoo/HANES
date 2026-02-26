"use client";

/**
 * @file src/app/(authenticated)/master/bom/page.tsx
 * @description BOM + Routing 통합 관리 페이지 - DB API 연동
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: GET /master/boms/parents 로 모품목 목록 조회
 * 2. **우측 패널**: 탭으로 BOM(자재) / Routing(공정순서) 전환
 * 3. **BOM 탭**: GET /master/boms/hierarchy/:id 로 트리 구조 조회
 * 4. **Routing 탭**: GET /master/routings?partId=xxx 로 품목별 공정순서 조회
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Layers, RefreshCw, Calendar } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import BomTab from "./components/BomTab";
import RoutingTab from "./components/RoutingTab";
import { ParentPart, RoutingTarget } from "./types";

type TabType = "bom" | "routing";

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => new Date().toISOString().split("T")[0];

function BomPage() {
  const { t } = useTranslation();
  const [parents, setParents] = useState<ParentPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentPart | null>(null);
  const [searchText, setSearchText] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(getToday());
  const [activeTab, setActiveTab] = useState<TabType>("bom");
  const [routingTarget, setRoutingTarget] = useState<RoutingTarget | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const partTypeOptions = useComCodeOptions("PART_TYPE");

  const filteredParents = useMemo(() => {
    if (!typeFilter) return parents;
    return parents.filter((p) => p.itemType === typeFilter);
  }, [parents, typeFilter]);

  /** DB에서 모품목(부모품목) 목록 조회 */
  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (effectiveDate) params.effectiveDate = effectiveDate;
      const res = await api.get("/master/boms/parents", { params });
      if (res.data.success) {
        setParents(res.data.data || []);
        if (!selectedParent && res.data.data?.length > 0) {
          setSelectedParent(res.data.data[0]);
        }
      }
    } catch {
      setParents([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, effectiveDate]);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const handleViewRouting = useCallback((target: RoutingTarget) => {
    setRoutingTarget(target);
    setActiveTab("routing");
  }, []);

  const handleSelectParent = useCallback((parent: ParentPart) => {
    setSelectedParent(parent);
    setRoutingTarget(null);
  }, []);

  const handleClearRoutingTarget = useCallback(() => { setRoutingTarget(null); }, []);

  const tabs: { key: TabType; label: string }[] = [
    { key: "bom", label: t("master.bom.tabBom") },
    { key: "routing", label: t("master.bom.tabRouting") },
  ];

  return (
    <div className="flex flex-col animate-fade-in h-[calc(100vh-var(--header-height)-var(--tab-bar-height)-48px)]">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary" />{t("master.bom.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.bom.subtitle")} ({filteredParents.length}건)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-muted whitespace-nowrap">{t("master.bom.effectiveDate")}:</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bg-transparent text-sm text-text font-medium border-none outline-none cursor-pointer"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchParents}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
        {/* 좌측: 부모품목 목록 */}
        <div className="col-span-4 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              <Input placeholder={t("master.bom.searchPlaceholder")} value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} fullWidth className="mb-2 shrink-0" />
              <div className="flex gap-1 mb-2 flex-wrap shrink-0">
                <button onClick={() => setTypeFilter("")}
                  className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                    !typeFilter ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"
                  }`}>{t("common.all")}
                </button>
                {partTypeOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                      typeFilter === opt.value ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"
                    }`}>{opt.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr className="border-b border-border text-text-muted">
                      <th className="text-left py-1.5 px-2 font-medium">{t("master.part.partNo")}</th>
                      <th className="text-left py-1.5 px-2 font-medium">{t("master.part.partName")}</th>
                      <th className="text-center py-1.5 px-1 font-medium w-12">{t("master.part.partType")}</th>
                      <th className="text-center py-1.5 px-1 font-medium w-12">BOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : filteredParents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-text-muted">
                          {t("common.noData")}
                        </td>
                      </tr>
                    ) : (
                      filteredParents.map((parent) => (
                        <tr key={parent.id} onClick={() => handleSelectParent(parent)}
                          className={`cursor-pointer border-b border-border/50 transition-colors ${
                            selectedParent?.id === parent.id
                              ? "bg-primary text-white"
                              : "hover:bg-surface text-text"
                          }`}>
                          <td className="py-1.5 px-2 font-medium whitespace-nowrap">
                            {parent.itemNo || parent.itemCode}
                          </td>
                          <td className={`py-1.5 px-2 truncate max-w-[120px] relative group/tip ${
                            selectedParent?.id === parent.id ? "text-white/80" : "text-text-muted"
                          }`}>
                            {parent.itemName}
                            {(parent.spec || parent.customer || parent.remark) && (
                              <div className="hidden group-hover/tip:block absolute left-0 top-full z-50 mt-1
                                bg-gray-900 dark:bg-gray-800 text-white text-[11px] rounded-lg shadow-xl
                                p-2.5 min-w-[200px] max-w-[280px] whitespace-normal pointer-events-none">
                                <p className="font-semibold text-xs mb-1.5 border-b border-gray-700 pb-1">
                                  {parent.itemNo || parent.itemCode} - {parent.itemName}
                                </p>
                                {parent.spec && (
                                  <p><span className="text-gray-400">{t("master.part.spec")}:</span> {parent.spec}</p>
                                )}
                                {parent.unit && (
                                  <p><span className="text-gray-400">{t("master.part.unit")}:</span> {parent.unit}</p>
                                )}
                                {parent.customer && (
                                  <p><span className="text-gray-400">{t("master.part.customer")}:</span> {parent.customer}</p>
                                )}
                                {parent.remark && (
                                  <p className="mt-1 pt-1 border-t border-gray-700">
                                    <span className="text-gray-400">{t("common.remark")}:</span> {parent.remark}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                              selectedParent?.id === parent.id
                                ? "bg-white/20 text-white"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}>{parent.itemType}</span>
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                              selectedParent?.id === parent.id
                                ? "bg-white/20 text-white"
                                : "bg-surface text-text-muted"
                            }`}>{parent.bomCount}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: BOM / Routing 탭 전환 */}
        <div className="col-span-8 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              <div className="flex border-b border-border mb-4 shrink-0">
                {tabs.map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      activeTab === tab.key ? "border-primary text-primary"
                        : "border-transparent text-text-muted hover:text-text hover:border-border"
                    }`}>
                    {tab.label}
                    {tab.key === "routing" && routingTarget && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                        {routingTarget.itemCode}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === "bom" ? (
                  <BomTab selectedParent={selectedParent} onViewRouting={handleViewRouting} effectiveDate={effectiveDate} />
                ) : (
                  <RoutingTab selectedParent={selectedParent} routingTarget={routingTarget} onClearTarget={handleClearRoutingTarget} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default BomPage;
