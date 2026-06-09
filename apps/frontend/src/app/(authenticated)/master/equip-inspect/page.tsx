"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/page.tsx
 * @description 설비점검항목 관리 - 설비별 점검항목 할당 + 점검항목 Pool 관리
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";
import EquipAssignTab from "./components/EquipAssignTab";
import ItemMasterTab from "./components/ItemMasterTab";

type ActiveTab = "assign" | "master";

export default function EquipInspectPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("assign");

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: "assign", label: t("master.equipInspect.tabAssign") },
    { id: "master", label: t("master.equipInspect.tabMaster") },
  ];

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

      <div className="flex flex-shrink-0 gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-text-muted hover:bg-background hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "assign" ? <EquipAssignTab /> : <ItemMasterTab />}
      </div>
    </div>
  );
}
