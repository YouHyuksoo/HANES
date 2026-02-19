"use client";

/**
 * @file src/app/(authenticated)/master/label/page.tsx
 * @description 라벨관리 페이지 - 카테고리별 바코드 라벨 디자인/저장/출력
 *
 * 초보자 가이드:
 * 1. **카테고리 탭**: 설비/지그/작업자/품목 중 선택
 * 2. **좌측**: 체크박스로 출력 대상 선택
 * 3. **중앙**: 라벨 디자인 설정 + 템플릿 저장/불러오기
 * 4. **우측**: 실시간 미리보기 + 인쇄
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import LabelDesigner from "./components/LabelDesigner";
import LabelCanvas from "./components/LabelCanvas";
import LabelPreview from "./components/LabelPreview";
import TemplateManager from "./components/TemplateManager";
import LabelGrid from "./components/LabelGrid";
import { LabelCategory, LabelItem, LabelDesign, DEFAULT_DESIGN } from "./types";
import { api } from "@/services/api";

const categories: { key: LabelCategory; labelKey: string }[] = [
  { key: "equip", labelKey: "master.label.catEquip" },
  { key: "jig", labelKey: "master.label.catJig" },
  { key: "worker", labelKey: "master.label.catWorker" },
  { key: "part", labelKey: "master.label.catPart" },
];

/** 카테고리별 API 경로 및 필드 매핑 */
const categoryApiMap: Record<LabelCategory, {
  url: string;
  mapFn: (item: Record<string, unknown>) => LabelItem;
}> = {
  equip: {
    url: "/equipment/equips",
    mapFn: (item) => ({
      id: item.id as string,
      code: item.equipCode as string,
      name: item.equipName as string,
      sub: (item.lineCode as string) || (item.equipType as string) || "",
    }),
  },
  jig: {
    url: "/consumables",
    mapFn: (item) => ({
      id: item.id as string,
      code: item.consumableCode as string,
      name: item.consumableName as string,
      sub: (item.category as string) || "",
    }),
  },
  worker: {
    url: "/master/workers",
    mapFn: (item) => ({
      id: item.id as string,
      code: item.workerCode as string,
      name: item.workerName as string,
      sub: (item.dept as string) || "",
    }),
  },
  part: {
    url: "/master/parts",
    mapFn: (item) => ({
      id: item.id as string,
      code: item.partCode as string,
      name: item.partName as string,
      sub: (item.partType as string) || "",
    }),
  },
};

function LabelPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<LabelCategory>("equip");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [design, setDesign] = useState<LabelDesign>(DEFAULT_DESIGN);
  const [items, setItems] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 카테고리 변경 시 API 데이터 로드 */
  const fetchItems = useCallback(async (cat: LabelCategory) => {
    setLoading(true);
    try {
      const { url, mapFn } = categoryApiMap[cat];
      const res = await api.get(url, { params: { limit: 100, useYn: "Y" } });
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      setItems(list.map(mapFn));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(category);
  }, [category, fetchItems]);

  const selectedItems = useMemo(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);
  const firstSelected = selectedItems[0];

  const handleCategoryChange = useCallback((cat: LabelCategory) => {
    setCategory(cat);
    setSelectedIds(new Set());
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Tag className="w-7 h-7 text-primary" />{t("master.label.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.label.subtitle")}</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex border-b border-border">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              category === cat.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 좌측: 항목 선택 */}
        <div className="col-span-4">
          <LabelGrid items={items} selectedIds={selectedIds} onSelectionChange={setSelectedIds} loading={loading} />
        </div>

        {/* 중앙: 디자인 설정 + 템플릿 관리 */}
        <div className="col-span-4 space-y-4">
          <Card><CardContent>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />{t("master.label.designer")}
            </h3>
            <div className="overflow-auto max-h-[400px]">
              <LabelDesigner design={design} onChange={setDesign} />
            </div>
          </CardContent></Card>

          <Card><CardContent>
            <TemplateManager category={category} design={design} onLoad={setDesign} />
          </CardContent></Card>
        </div>

        {/* 우측: 미리보기 + 인쇄 */}
        <div className="col-span-4 space-y-4">
          <Card><CardContent>
            <h3 className="text-sm font-semibold text-text mb-3">{t("master.label.preview")}</h3>
            <div className="flex justify-center py-4">
              <LabelCanvas
                design={design}
                sampleCode={firstSelected?.code ?? "SAMPLE-001"}
                sampleName={firstSelected?.name ?? "Sample"}
                sampleSub={firstSelected?.sub ?? "Info"}
              />
            </div>
          </CardContent></Card>

          <Card><CardContent>
            <LabelPreview items={selectedItems} design={design} />
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export default LabelPage;
