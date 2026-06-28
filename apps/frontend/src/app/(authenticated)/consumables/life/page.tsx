"use client";

/**
 * @file src/app/(authenticated)/consumables/life/page.tsx
 * @description 소모품 수명 현황 페이지 — conUid별 개별 인스턴스 수명 모니터링
 *
 * 초보자 가이드:
 * 1. **수명 관리**: 소모품(금형, 지그, 공구)의 사용횟수 기반 수명 모니터링
 * 2. **상태**: NORMAL(정상), WARNING(주의), REPLACE(교체필요)
 * 3. API: GET /consumables/stocks (expectedLife>0 인스턴스만 표시)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Activity, Search, Layers } from "lucide-react";
import { Card, CardContent, Button, ComCodeBadge, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createConsumableLifeGridColumns, type LifeInstance } from "./consumableLifeColumns";

function computeStatus(currentCount: number, expectedLife: number): string {
  if (!expectedLife) return "NORMAL";
  const pct = currentCount / expectedLife;
  if (pct >= 1) return "REPLACE";
  if (pct >= 0.8) return "WARNING";
  return "NORMAL";
}

interface StockItem {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string | null;
  currentCount: number;
  expectedLife: number | null;
  status: string;
  location: string | null;
  mountedEquipCode: string | null;
  recvDate: string | null;
}

export default function ConsumableLifePage() {
  const { t } = useTranslation();
  const [rawData, setRawData] = useState<LifeInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/consumables/stocks", { params: { limit: "5000" } });
      const raw = res.data?.data ?? res.data ?? [];
      const items: StockItem[] = Array.isArray(raw) ? raw : raw?.data ?? [];
      const lifeItems: LifeInstance[] = items
        .filter((d: StockItem) => d.expectedLife != null && d.expectedLife > 0)
        .map((d: StockItem) => ({
          conUid: d.conUid,
          consumableCode: d.consumableCode,
          consumableName: d.consumableName,
          category: d.category ?? "",
          currentCount: d.currentCount,
          expectedLife: d.expectedLife ?? 0,
          status: computeStatus(d.currentCount, d.expectedLife ?? 0),
          location: d.location ?? "",
          mountedEquipCode: d.mountedEquipCode,
          lastReplaceAt: d.recvDate,
        }));
      setRawData(lifeItems);
    } catch {
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const data = useMemo(() => {
    return rawData.filter((d) => {
      const matchSearch = !searchTerm ||
        d.conUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.consumableName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter || d.status === statusFilter;
      const matchCategory = !categoryFilter || d.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [rawData, searchTerm, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: data.length,
    normal: data.filter((d) => d.status === "NORMAL").length,
    warning: data.filter((d) => d.status === "WARNING").length,
    replace: data.filter((d) => d.status === "REPLACE").length,
  }), [data]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    const statusMap = new Map<string, { normal: number; warning: number; replace: number }>();
    data.forEach((d) => {
      map.set(d.category, (map.get(d.category) || 0) + 1);
      if (!statusMap.has(d.category)) statusMap.set(d.category, { normal: 0, warning: 0, replace: 0 });
      const s = statusMap.get(d.category)!;
      if (d.status === "NORMAL") s.normal++;
      else if (d.status === "WARNING") s.warning++;
      else if (d.status === "REPLACE") s.replace++;
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, cnt]) => ({ cat, cnt, ...statusMap.get(cat)! }));
  }, [data]);

  const infoCards = useMemo(() => [
    {
      key: "total", label: t("common.total"), value: stats.total,
      subLabel: t("consumables.life.managedTarget"), icon: Activity,
      tone: "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
      iconTone: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
    },
    {
      key: "normal", label: t("consumables.life.normal"), value: stats.normal,
      subLabel: t("consumables.life.normalUse"), icon: CheckCircle,
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
      iconTone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    {
      key: "warning", label: t("consumables.life.warning"), value: stats.warning,
      subLabel: t("consumables.life.impendingReplace"), icon: AlertTriangle,
      tone: "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
      iconTone: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    },
    {
      key: "replace", label: t("consumables.life.replace"), value: stats.replace,
      subLabel: t("consumables.life.immediateAction"), icon: XCircle,
      tone: "border-red-200 bg-red-50/80 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
      iconTone: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    },
  ], [stats, t]);

  const columns = useMemo(() => createConsumableLifeGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text">{t("consumables.life.title")}</h1>
          <span className="text-xs text-text-muted">{data.length}{t("common.count")}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-shrink-0">
        {infoCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} data-testid={`consumable-life-card-${card.key}`}
              className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-2 ${card.tone}`}>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{card.label}</div>
                <div className="text-2xl font-bold leading-none text-text">{card.value.toLocaleString()}</div>
                <div className="text-[10px] opacity-70 truncate">{card.subLabel}</div>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.iconTone}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
        {categoryStats.length > 0 && (
          <div className="rounded-lg border border-surface-alt bg-surface px-3 py-3 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-semibold text-text-muted">{t("consumables.life.categoryLabel")}</span>
            </div>
            <div className="text-2xl font-bold leading-none text-text">{categoryStats.length}</div>
            <div className="flex gap-1 flex-wrap">
              {categoryStats.map((cs) => (
                <span key={cs.cat} className="inline-flex items-center gap-0.5 text-[10px] font-medium text-text-muted">
                  <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={cs.cat} className="text-[10px]" />
                  <span>{cs.cnt}</span>
                  {cs.replace > 0 && <span className="text-red-500 font-bold">({cs.replace})</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("consumables.life.title")}
          toolbarLeft={
            <div className="flex gap-2 items-center flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("consumables.life.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-3.5 h-3.5" />} fullWidth />
              </div>
              <div className="w-28 flex-shrink-0">
                <ComCodeSelect groupCode="CONSUMABLE_LIFE_STATUS" value={statusFilter} onChange={setStatusFilter} labelPrefix={t("common.status", "상태")} fullWidth />
              </div>
              <div className="w-28 flex-shrink-0">
                <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} labelPrefix={t("consumables.life.categoryLabel", "분류")} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT *\nFROM CONSUMABLE_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND EXPECTED_LIFE > 0\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
