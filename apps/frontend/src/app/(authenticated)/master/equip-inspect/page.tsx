"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/page.tsx
 * @description 설비점검항목 관리 - 설비별 점검항목 할당 + 점검항목 Pool 관리
 */
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";
import EquipAssignTab from "./components/EquipAssignTab";

export default function EquipInspectPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Wrench className="w-7 h-7 text-primary" />
          {t("master.equipInspect.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.equipInspect.subtitle")}</p>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EquipAssignTab />
      </div>
    </div>
  );
}
