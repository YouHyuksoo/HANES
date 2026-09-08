"use client";

/**
 * @file src/app/(authenticated)/master/iqc-part-spec/page.tsx
 * @description IQC002 품목별 IQC 항목관리 단독 페이지
 */

import { IqcPartHelp } from "./iqcPartHelp";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import ItemListPanel from "../iqc-item/components/ItemListPanel";
import IqcSpecPanel from "../iqc-item/components/IqcSpecPanel";
import type { IqcPoolItem } from "../iqc-item/types";
import api from "@/services/api";
import UseYnSelect from "@/components/shared/UseYnSelect";
import ServerPager from "@/components/shared/ServerPager";
import { Select } from "@/components/ui";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";

interface PartItem {
  itemCode: string;
  itemName: string;
  sampleQty?: number | null;
  iqcAqlPolicyCode?: string | null;
  inspectItemCount: number;
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
    sampleMethod?: string | null;
    requiredQty?: number | null;
    sampleQty?: number | null;
  }>;
}

export default function IqcPartSpecPage() {
  const { t } = useTranslation();
  const { selectedCompany, selectedPlant } = useAuthStore();
  const [parts, setParts] = useState<PartItem[]>([]);
  const [specCountMap, setSpecCountMap] = useState<Map<string, number>>(new Map());
  const [poolItems, setPoolItems] = useState<IqcPoolItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [useYn, setUseYn] = useState("Y");
  const [hasInspectItems, setHasInspectItems] = useState("Y");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const requestVersion = useRef(0);
  const pageSize = 50;
  const [aqlPreviewLotQty, setAqlPreviewLotQty] = useState("1000");
  const [aqlPreview, setAqlPreview] = useState<AqlPolicyPreview | null>(null);
  const [aqlPreviewLoading, setAqlPreviewLoading] = useState(false);

  const fetchBase = useCallback(async () => {
    const version = ++requestVersion.current;
    setPartsLoading(true);
    try {
      const [partsRes, poolRes] = await Promise.all([
        api.get("/master/iqc-part-specs/parts", { params: { page, limit: pageSize, useYn: useYn || undefined, hasInspectItems: hasInspectItems || undefined, search: searchText || undefined } }),
        api.get("/master/iqc-item-pool", { params: { limit: "5000", useYn: "Y" } }),
      ]);
      if (version !== requestVersion.current) return;
      const rows: PartItem[] = partsRes.data?.data ?? [];
      const resultTotal = Number(partsRes.data?.meta?.total ?? 0);
      if (page > 1 && rows.length === 0) {
        setPage(Math.max(1, Math.ceil(resultTotal / pageSize)));
        return;
      }
      setParts(rows);
      setTotal(resultTotal);
      setSpecCountMap(new Map(rows.map(part => [part.itemCode, Number(part.inspectItemCount)])));
      setSelectedItemCode(current => rows.some(part => part.itemCode === current) ? current : null);

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
      if (version !== requestVersion.current) return;
      setParts([]);
      setSpecCountMap(new Map());
      setPoolItems([]);
      setTotal(0);
      setSelectedItemCode(null);
      toast.error(t("master.iqcPartSpec.loadFailed", "품목별 IQC 목록을 불러오지 못했습니다."));
    } finally {
      if (version === requestVersion.current) setPartsLoading(false);
    }
  }, [page, useYn, hasInspectItems, searchText, t, selectedCompany, selectedPlant]);

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
      fixed: results.filter((item) => item.inspectionType === "DESTRUCTIVE" || item.inspectionType === "FULL" || item.sampleMethod === "FIXED").length,
    };
  }, [aqlPreview]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          {t("master.iqcItem.perItemIqc", "품목별 IQC 항목관리")}
        </h1>
        <IqcPartHelp field="overview"><p className="text-text-muted mt-1">
          {t("master.iqcItem.perItemIqcSubtitle", "품목별 시료수, 파괴검사 여부, 검사항목과 규격을 관리합니다.")}
        </p></IqcPartHelp>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="col-span-2 min-h-0">
          <ItemListPanel
            parts={parts}
            linkCountMap={specCountMap}
            selectedItemCode={selectedItemCode}
            onSelect={setSelectedItemCode}
            searchText={searchText}
            onSearchChange={value => { setSearchText(value); setPage(1); }}
            loading={partsLoading}
            serverFiltered
            searchPlaceholder={t("master.iqcPartSpec.partSearch", "품목코드, 품목명 검색...")}
            filters={<div className="space-y-2 mb-2">
              <IqcPartHelp field="useYn" className="w-full"><UseYnSelect value={useYn} onChange={value => { setUseYn(value); setPage(1); }} fullWidth /></IqcPartHelp>
              <IqcPartHelp field="hasItems" className="w-full"><Select aria-label={t("master.iqcPartSpec.hasItems", "IQC 검사항목 유무")} value={hasInspectItems}
                onChange={value => { setHasInspectItems(value); setPage(1); }} fullWidth
                options={[
                  { value: "", label: t("master.iqcPartSpec.itemsAll", "검사항목: 전체") },
                  { value: "Y", label: t("master.iqcPartSpec.itemsYes", "검사항목: 있음") },
                  { value: "N", label: t("master.iqcPartSpec.itemsNo", "검사항목: 없음") },
                ]} /></IqcPartHelp>
            </div>}
            footer={<IqcPartHelp field="pager" className="w-full"><ServerPager page={page} total={total} limit={pageSize} onPageChange={setPage} disabled={partsLoading} className="justify-center flex-wrap !whitespace-normal" /></IqcPartHelp>}
          />
        </div>
        <div className="col-span-10 min-h-0 flex flex-col gap-3">
          {selectedPart && (
            <div className="flex-shrink-0 rounded-lg border border-border bg-bg px-4 py-3" data-iqc-part-aql-summary>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <IqcPartHelp field="selectedPart"><div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{t("master.iqcPartSpec.aqlCriteria", "AQL 기준")}</div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {selectedPart.itemCode} · {selectedPart.itemName}
                  </div>
                </div></IqcPartHelp>
                <IqcPartHelp field="lotPreview"><label className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="whitespace-nowrap">{t("master.iqcPartSpec.lotQtyPreview", "LOT 수량 미리보기")}</span>
                  <input
                    type="number"
                    min={1}
                    value={aqlPreviewLotQty}
                    onChange={(e) => setAqlPreviewLotQty(e.target.value)}
                    className="h-8 w-28 rounded border border-border bg-surface px-2 text-right text-sm text-text tabular-nums focus:border-primary focus:outline-none"
                  />
                </label></IqcPartHelp>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                <IqcPartHelp field="policy" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.aqlPolicy", "AQL 정책")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text">{selectedPart.iqcAqlPolicyCode || "-"}</div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="defaultSample" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.defaultSampleQty", "기본시료수")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">{renderAqlValue(selectedPart.sampleQty)}</div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="level" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcItem.inspectionLevel", "검사수준")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.inspectionLevel ?? "-")}
                  </div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="sample" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.sampleQty", "샘플수량")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.sampleQty ?? "-")}
                  </div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="major" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">Major Ac/Re</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.majorRule ? `${aqlPreview.majorRule.acceptQty}/${aqlPreview.majorRule.rejectQty}` : "-")}
                  </div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="minor" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">Minor Ac/Re</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : (aqlPreview?.minorRule ? `${aqlPreview.minorRule.acceptQty}/${aqlPreview.minorRule.rejectQty}` : "-")}
                  </div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="criteria" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.inspItemCriteria", "검사항목 기준")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : t("master.iqcPartSpec.countCases", "{{count}}건", { count: itemSpecSummary.total })}
                  </div>
                </div>
                </IqcPartHelp>
                <IqcPartHelp field="fixed" className="!block">
                <div className="rounded border border-border/70 bg-surface px-2 py-1.5">
                  <div className="text-[10px] leading-tight text-text-muted">{t("master.iqcPartSpec.destFixed", "파괴/고정")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-text tabular-nums">
                    {aqlPreviewLoading ? "..." : t("master.iqcPartSpec.countCases", "{{count}}건", { count: itemSpecSummary.fixed })}
                  </div>
                </div>
                </IqcPartHelp>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <IqcSpecPanel
              itemCode={selectedItemCode}
              itemName={selectedItemName}
              poolItems={poolItems}
              onSaved={fetchBase}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
