"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사 관리 통합 페이지 (2탭)
 *
 * 초보자 가이드:
 * 1. [검사항목 마스터] 탭: 전역 검사항목 코드/명/종류/단위 CRUD
 * 2. [품목별 IQC 기준] 탭: 품목 선택 → 시료수/파괴검사/검사항목+규격 설정
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import IqcItemTab from "./components/IqcItemTab";
import ItemListPanel from "./components/ItemListPanel";
import IqcSpecPanel from "./components/IqcSpecPanel";
import type { IqcPoolItem } from "./types";
import api from "@/services/api";

type TabValue = "items" | "perItem";

interface PartItem {
  itemCode: string;
  itemName: string;
}

export default function IqcItemPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("items");

  const [parts, setParts] = useState<PartItem[]>([]);
  const [specCountMap, setSpecCountMap] = useState<Map<string, number>>(new Map());
  const [poolItems, setPoolItems] = useState<IqcPoolItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const fetchBase = useCallback(async () => {
    setPartsLoading(true);
    try {
      const [partsRes, specsRes, poolRes] = await Promise.all([
        api.get("/master/parts", { params: { itemType: "RAW_MATERIAL", limit: "5000" } }),
        api.get("/master/iqc-part-specs"),
        api.get("/master/iqc-item-pool", { params: { limit: "5000", useYn: "Y" } }),
      ]);
      setParts(partsRes.data?.data ?? []);

      const specs: { itemCode: string; items: unknown[] }[] = specsRes.data?.data ?? [];
      const m = new Map<string, number>();
      specs.forEach((s) => m.set(s.itemCode, s.items?.length ?? 0));
      setSpecCountMap(m);

      setPoolItems(
        (poolRes.data?.data ?? []).map((p: any) => ({
          inspItemCode: p.inspItemCode,
          inspItemName: p.inspItemName,
          judgeMethod: p.judgeMethod,
          unit: p.unit ?? null,
          useYn: p.useYn,
        }))
      );
    } catch {
      setParts([]);
    } finally {
      setPartsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  const selectedItemName = useMemo(
    () => parts.find((p) => p.itemCode === selectedItemCode)?.itemName ?? "",
    [parts, selectedItemCode]
  );

  const tabs: { key: TabValue; label: string }[] = [
    { key: "items", label: t("master.iqcItem.itemPool", "검사항목 마스터") },
    { key: "perItem", label: t("master.iqcItem.perItemIqc", "품목별 IQC 기준") },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          {t("master.iqcItem.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.iqcItem.subtitle")}</p>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full ${activeTab === "items" ? "" : "hidden"}`}>
          <IqcItemTab />
        </div>
        <div className={`h-full ${activeTab === "perItem" ? "" : "hidden"}`}>
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-4 min-h-0">
              <ItemListPanel
                parts={parts}
                linkCountMap={specCountMap}
                selectedItemCode={selectedItemCode}
                onSelect={setSelectedItemCode}
                searchText={searchText}
                onSearchChange={setSearchText}
                loading={partsLoading}
              />
            </div>
            <div className="col-span-8 min-h-0">
              <IqcSpecPanel
                itemCode={selectedItemCode}
                itemName={selectedItemName}
                poolItems={poolItems}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
