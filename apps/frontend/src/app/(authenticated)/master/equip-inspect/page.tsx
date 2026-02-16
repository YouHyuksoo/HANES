"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/page.tsx
 * @description 설비점검항목 관리 (통합 탭 구조)
 *
 * 초보자 가이드:
 * 1. **점검항목 마스터 탭**: 공통 점검항목 Pool을 관리
 * 2. **설비별 할당 탭**: 설비별로 점검항목을 선택/할당
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";
import ItemMasterTab from "./components/ItemMasterTab";
import EquipAssignTab from "./components/EquipAssignTab";

type TabValue = "master" | "assign";

export default function EquipInspectPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("assign");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Wrench className="w-7 h-7 text-primary" />
          {t("master.equipInspect.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.equipInspect.subtitle")}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("assign")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "assign"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            {t("master.equipInspect.tabAssign", "설비별 할당")}
          </button>
          <button
            onClick={() => setActiveTab("master")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "master"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            {t("master.equipInspect.tabMaster", "점검항목 마스터")}
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === "assign" && <EquipAssignTab />}
        {activeTab === "master" && <ItemMasterTab />}
      </div>
    </div>
  );
}
