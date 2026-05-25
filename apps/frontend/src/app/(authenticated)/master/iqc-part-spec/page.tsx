"use client";

/**
 * @file src/app/(authenticated)/master/iqc-part-spec/page.tsx
 * @description IQC002 품목별 IQC 항목관리 단독 페이지
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import ItemListPanel from "../iqc-item/components/ItemListPanel";
import IqcSpecPanel from "../iqc-item/components/IqcSpecPanel";
import type { IqcPoolItem } from "../iqc-item/types";
import api from "@/services/api";

interface PartItem {
  itemCode: string;
  itemName: string;
}

export default function IqcPartSpecPage() {
  const { t } = useTranslation();
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
      setSpecCountMap(new Map());
      setPoolItems([]);
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

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          {t("master.iqcItem.perItemIqc", "품목별 IQC 항목관리")}
        </h1>
        <p className="text-text-muted mt-1">
          {t("master.iqcItem.perItemIqcSubtitle", "품목별 시료수, 파괴검사 여부, 검사항목과 규격을 관리합니다.")}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
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
  );
}
