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
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import LabelDesigner from "./components/LabelDesigner";
import LabelCanvas from "./components/LabelCanvas";
import LabelPreview from "./components/LabelPreview";
import TemplateManager from "./components/TemplateManager";
import LabelGrid from "./components/LabelGrid";
import { LabelCategory, LabelItem, LabelDesign, DEFAULT_DESIGN } from "./types";

const categories: { key: LabelCategory; labelKey: string }[] = [
  { key: "equip", labelKey: "master.label.catEquip" },
  { key: "jig", labelKey: "master.label.catJig" },
  { key: "worker", labelKey: "master.label.catWorker" },
  { key: "part", labelKey: "master.label.catPart" },
];

/** 카테고리별 목 데이터 */
const mockDataMap: Record<LabelCategory, LabelItem[]> = {
  equip: [
    { id: "e1", code: "EQ-CUT-001", name: "자동절단기 1호", sub: "L1" },
    { id: "e2", code: "EQ-CRM-001", name: "압착기 1호", sub: "L1" },
    { id: "e3", code: "EQ-CRM-002", name: "압착기 2호", sub: "L2" },
    { id: "e4", code: "EQ-ASM-001", name: "조립지그 A", sub: "L1" },
    { id: "e5", code: "EQ-INS-001", name: "통전검사기 1호", sub: "L1" },
    { id: "e6", code: "EQ-PKG-001", name: "포장라인 1", sub: "L3" },
  ],
  jig: [
    { id: "j1", code: "JIG-A-001", name: "절단 블레이드 A", sub: "CUT" },
    { id: "j2", code: "JIG-B-001", name: "압착 금형 110형", sub: "CRM" },
    { id: "j3", code: "JIG-B-002", name: "압착 금형 250형", sub: "CRM" },
    { id: "j4", code: "JIG-C-001", name: "조립보드 12P", sub: "ASM" },
    { id: "j5", code: "JIG-C-002", name: "조립보드 24P", sub: "ASM" },
  ],
  worker: [
    { id: "w1", code: "WK-2024-001", name: "김철수", sub: "생산1팀" },
    { id: "w2", code: "WK-2024-002", name: "이영희", sub: "생산1팀" },
    { id: "w3", code: "WK-2024-003", name: "박민수", sub: "생산2팀" },
    { id: "w4", code: "WK-2024-004", name: "정수진", sub: "품질팀" },
    { id: "w5", code: "WK-2024-005", name: "Nguyen Van A", sub: "생산1팀" },
  ],
  part: [
    { id: "p1", code: "H-001", name: "메인 하네스 A", sub: "FG" },
    { id: "p2", code: "H-002", name: "서브 하네스 B", sub: "WIP" },
    { id: "p3", code: "W-001", name: "전선 AWG18 RED", sub: "RAW" },
    { id: "p4", code: "T-001", name: "단자 110형", sub: "RAW" },
    { id: "p5", code: "T-002", name: "커넥터 12P", sub: "RAW" },
    { id: "p6", code: "C-001", name: "튜브 10mm", sub: "RAW" },
  ],
};

function LabelPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<LabelCategory>("equip");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [design, setDesign] = useState<LabelDesign>(DEFAULT_DESIGN);

  const items = mockDataMap[category];
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
          <LabelGrid items={items} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
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
