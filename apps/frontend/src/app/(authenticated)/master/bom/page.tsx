"use client";

/**
 * @file src/app/(authenticated)/master/bom/page.tsx
 * @description BOM + Routing 통합 관리 페이지 - DB API 연동
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: GET /master/boms/parents 로 모품목 목록 조회
 * 2. **우측 패널**: 탭으로 BOM(자재) / Routing(공정순서) 전환
 * 3. **BOM 탭**: GET /master/boms/hierarchy/:id 로 트리 구조 조회
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Package, ChevronRight, Layers, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardContent, Input, Button } from "@/components/ui";
import api from "@/services/api";
import BomTab from "./components/BomTab";
import RoutingTab from "./components/RoutingTab";
import { ParentPart, RoutingTarget } from "./types";

type TabType = "bom" | "routing";

function BomPage() {
  const { t } = useTranslation();
  const [parents, setParents] = useState<ParentPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentPart | null>(null);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("bom");
  const [routingTarget, setRoutingTarget] = useState<RoutingTarget | null>(null);
  const [bomRoutingLinks, setBomRoutingLinks] = useState<Map<string, string>>(() => new Map());

  /** DB에서 모품목(부모품목) 목록 조회 */
  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/boms/parents", { params: searchText ? { search: searchText } : {} });
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
  }, [searchText]);

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

  const handleLinkRouting = useCallback((partCode: string, routingCode: string) => {
    setBomRoutingLinks((prev) => new Map(prev).set(partCode, routingCode));
  }, []);

  const handleUnlinkRouting = useCallback((partCode: string) => {
    setBomRoutingLinks((prev) => { const next = new Map(prev); next.delete(partCode); return next; });
  }, []);

  const tabs: { key: TabType; label: string }[] = [
    { key: "bom", label: t("master.bom.tabBom") },
    { key: "routing", label: t("master.bom.tabRouting") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary" />{t("master.bom.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.bom.subtitle")} ({parents.length}건)</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchParents}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 좌측: 부모품목 목록 */}
        <div className="col-span-3">
          <Card>
            <CardHeader title={t("master.bom.parentPart")} subtitle={t("master.bom.selectParent")} />
            <CardContent>
              <Input placeholder={t("master.bom.searchPlaceholder")} value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} fullWidth className="mb-3" />
              <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
                {parents.map((parent) => (
                  <button key={parent.id} onClick={() => handleSelectParent(parent)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                      selectedParent?.id === parent.id ? "bg-primary text-white" : "hover:bg-surface text-text"
                    }`}>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">{parent.partNo || parent.partCode}</div>
                        <div className={`text-xs ${selectedParent?.id === parent.id ? "text-white/70" : "text-text-muted"}`}>
                          {parent.partName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        selectedParent?.id === parent.id ? "bg-white/20 text-white" : "bg-surface text-text-muted"
                      }`}>{parent.bomCount}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
                {parents.length === 0 && !loading && (
                  <p className="text-center text-sm text-text-muted py-8">{t("common.noData")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: BOM / Routing 탭 전환 */}
        <div className="col-span-9">
          <Card>
            <CardContent>
              <div className="flex border-b border-border mb-4">
                {tabs.map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      activeTab === tab.key ? "border-primary text-primary"
                        : "border-transparent text-text-muted hover:text-text hover:border-border"
                    }`}>
                    {tab.label}
                    {tab.key === "routing" && routingTarget && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                        {routingTarget.partCode}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === "bom" ? (
                <BomTab selectedParent={selectedParent} onViewRouting={handleViewRouting}
                  bomRoutingLinks={bomRoutingLinks} onLinkRouting={handleLinkRouting}
                  onUnlinkRouting={handleUnlinkRouting} />
              ) : (
                <RoutingTab selectedParent={selectedParent} routingTarget={routingTarget}
                  onClearTarget={handleClearRoutingTarget} bomRoutingLinks={bomRoutingLinks} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default BomPage;
