"use client";

/**
 * @file src/app/(authenticated)/master/equip/page.tsx
 * @description 설비관리 통합 페이지 (2-Layer 탭 구조)
 *
 * 초보자 가이드:
 * 1. **설비기본정보 탭**: 설비 마스터 CRUD — 설비 기본 정보 관리
 * 2. **설비BOM관리 탭**: 부품/소모품 관리 — 설비별 BOM 구성 관리
 *
 * IQC 항목 페이지와 동일한 UI 패턴 적용
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Package } from "lucide-react";
import EquipMasterTab from "./components/EquipMasterTab";
import EquipBomTab from "./components/EquipBomTab";

type TabValue = "masters" | "bom";

export default function EquipPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("masters");

  const tabs: { key: TabValue; label: string; icon: React.ReactNode }[] = [
    { 
      key: "masters", 
      label: t("master.equip.tabMasters", "설비 기본정보"),
      icon: <Monitor className="w-4 h-4" />,
    },
    { 
      key: "bom", 
      label: t("master.equip.tabBom", "설비 BOM 관리"),
      icon: <Package className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col animate-fade-in h-[calc(100vh-var(--header-height)-var(--tab-bar-height)-48px)]">
      {/* 헤더 */}
      <div className="shrink-0 mb-4">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Monitor className="w-7 h-7 text-primary" />
          {t("master.equip.title", "설비 관리")}
        </h1>
        <p className="text-text-muted mt-1">
          {t("master.equip.subtitle", "설비 마스터 및 BOM 관리")}
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border shrink-0">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 flex flex-col min-h-0 mt-4">
        {activeTab === "masters" && <EquipMasterTab />}
        {activeTab === "bom" && <EquipBomTab />}
      </div>
    </div>
  );
}
