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
  sampleQty?: number | null;
  iqcAqlPolicyCode?: string | null;
}

interface AqlPolicyPreview {
  inspectionLevel: string;
  inspectionMode: string;
  sampleQty: number;
  policyCode?: string | null;
  majorRule?: { aqlCode: string; acceptQty: number; rejectQty: number } | null;
  minorRule?: { aqlCode: string; acceptQty: number; rejectQty: number } | null;
  itemResults?: Array<{
    defectGrade?: string | null;
    inspectionType?: string | null;
    requiredQty?: number | null;
    sampleQty?: number | null;
  }>;
}

export default function IqcPartSpecPage() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<PartItem[]>([]);
  const [specCountMap, setSpecCountMap] = useState<Map<string, number>>(new Map());
  const [poolItems, setPoolItems] = useState<IqcPoolItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [aqlPreviewLotQty, setAqlPreviewLotQty] = useState("1000");
  const [aqlPreview, setAqlPreview] = useState<AqlPolicyPreview | null>(null);
  const [aqlPreviewLoading, setAqlPreviewLoading] = useState(false);

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

  const selectedPart = useMemo(
    () => parts.find((p) => p.itemCode === selectedItemCode) ?? null,
    [parts, selectedItemCode]
  );

  useEffect(() => {
    if (!selectedPart) {
      setAqlPreview(null);
      return;
    }

    const lotQty = Math.max(1, Number(aqlPreviewLotQty) || 1);
    let cancelled = false;
    setAqlPreviewLoading(true);
    api.get("/quality/aql/resolve-iqc-items", {
      params: {
        itemCode: selectedPart.itemCode,
        lotQty,
      },
    })
      .then((res) => {
        if (!cancelled) setAqlPreview(res.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setAqlPreview(null);
      })
      .finally(() => {
        if (!cancelled) setAqlPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPart, aqlPreviewLotQty]);

  const renderAqlValue = (value: number | null | undefined) => (
    value === null || value === undefined ? "-" : value
  );

  const itemSpecSummary = useMemo(() => {
    const results = aqlPreview?.itemResults ?? [];
    return {
      total: results.length,
      critical: results.filter((item) => item.defectGrade === "CRITICAL").length,
      major: results.filter((item) => item.defectGrade === "MAJOR").length,
      minor: results.filter((item) => item.defectGrade === "MINOR").length,
      fixed: results.filter((item) => item.inspectionType === "DESTRUCTIVE" || item.inspectionType === "FULL" || item.requiredQty != null || item.sampleQty != null).length,
    };
  }, [aqlPreview]);

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
        <div className="col-span-2 min-h-0">
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
        <div className="col-span-10 min-h-0 flex flex-col gap-3">
          {selectedPart && (
            <div className="flex-shrink-0 rounded-lg border border-border bg-bg px-4 py-3" data-iqc-part-aql-summary>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{t("master.iqcPartSpec.aqlCriteria", "AQL 기준")}</div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {selectedPart.itemCode} · {selectedPart.itemName}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="whitespace-nowrap">{t("master.iqcPartSpec.lotQtyPreview", "LOT 수량 미리보기")}</span>
                  <input
                    type="number"
                    min={1}
                    value={aqlPreviewLotQty}
                    onChange={(e) => setAqlPreviewLotQty(e.target.value)}
                    className="h-8 w-28 rounded border border-border bg-surface px-2 text-right text-sm text-text tabular-nums focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.aqlPolicy", "AQL 정책")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text">{selectedPart.iqcAqlPolicyCode || "-"}</div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.defaultSampleQty", "기본시료수")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">{renderAqlValue(selectedPart.sampleQty)}</div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcItem.inspectionLevel", "검사수준")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.inspectionLevel ?? "-")}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.sampleQty", "샘플수량")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.sampleQty ?? "-")}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">Major Ac/Re</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.majorRule ? `${aqlPreview.majorRule.acceptQty}/${aqlPreview.majorRule.rejectQty}` : "-")}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">Minor Ac/Re</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.minorRule ? `${aqlPreview.minorRule.acceptQty}/${aqlPreview.minorRule.rejectQty}` : "-")}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.inspItemCriteria", "검사항목 기준")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : t("master.iqcPartSpec.countCases", "{{count}}건", { count: itemSpecSummary.total })}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.destFixed", "파괴/고정")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : t("master.iqcPartSpec.countCases", "{{count}}건", { count: itemSpecSummary.fixed })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <IqcSpecPanel
              itemCode={selectedItemCode}
              itemName={selectedItemName}
              poolItems={poolItems}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
