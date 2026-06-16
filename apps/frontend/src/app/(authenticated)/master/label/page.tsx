"use client";

/**
 * @file src/app/(authenticated)/master/label/page.tsx
 * @description 객체 기반 라벨 디자인 관리 페이지
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileJson2, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import TemplateManager from "./components/TemplateManager";
import LabelObjectDesigner from "./components/LabelObjectDesigner";
import LabelDesignRenderer from "./components/LabelDesignRenderer";
import {
  LabelCategory,
  LabelDesign,
  LabelSourceTable,
  createDefaultLabelDesign,
  ensureObjectLabelDesign,
} from "./types";
import { getSampleData } from "./labelSources";

const sourceCategoryMap: Record<LabelSourceTable, LabelCategory> = {
  equipment: "equip",
  consumable: "jig",
  worker: "worker",
  mat_lot: "mat_lot",
  box: "box",
};

function LabelPage() {
  const { t } = useTranslation();
  const [design, setDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("jig"));
  const category = sourceCategoryMap[design.sourceTable ?? "consumable"];

  const handleLoad = useCallback((loaded: LabelDesign) => {
    setDesign(ensureObjectLabelDesign(loaded, category));
  }, [category]);

  const sampleData = getSampleData(category, design.sourceTable, design.sourceFields);

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />
            {t("master.label.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.label.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          <FileJson2 className="w-4 h-4 text-primary" />
          DESIGN_DATA JSON
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 min-h-0 flex-1">
        <div className="min-h-0">
          <LabelObjectDesigner category={category} design={design} onChange={setDesign} />
        </div>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <Card><CardContent>
            <TemplateManager category={category} design={design} onLoad={handleLoad} />
          </CardContent></Card>

          <Card><CardContent>
            <h3 className="text-sm font-semibold text-text mb-3">{t("master.label.preview")}</h3>
            <div className="overflow-auto flex justify-center py-2">
              <LabelDesignRenderer design={design} data={sampleData} scale={3} />
            </div>
            <div className="mt-3 text-xs text-text-muted">
              {design.labelWidth} x {design.labelHeight} mm / {design.elements?.length ?? 0} objects
            </div>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

export default LabelPage;
