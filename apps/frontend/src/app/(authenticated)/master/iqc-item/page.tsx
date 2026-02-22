"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사 관리 통합 페이지 (3-Layer 탭 구조)
 *
 * 초보자 가이드:
 * 1. **검사항목 탭**: 개별 검사항목(IQC-xxx) CRUD — 검사 라이브러리
 * 2. **검사그룹 탭**: 항목을 묶어 검사그룹(IGR-xxx) 관리 — 검사 템플릿
 * 3. **연결관리 탭**: 품목+거래처 → 검사그룹 매핑 — 실제 적용
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import IqcItemTab from "./components/IqcItemTab";
import IqcGroupTab from "./components/IqcGroupTab";
import IqcLinkTab from "./components/IqcLinkTab";

type TabValue = "items" | "groups" | "links";

export default function IqcItemPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("items");

  const tabs: { key: TabValue; label: string }[] = [
    { key: "items", label: t("master.iqcGroup.tabItems", "검사항목") },
    { key: "groups", label: t("master.iqcGroup.tabGroups", "검사그룹") },
    { key: "links", label: t("master.iqcLink.tabLinks", "연결관리") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          {t("master.iqcItem.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.iqcItem.subtitle")}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === "items" && <IqcItemTab />}
        {activeTab === "groups" && <IqcGroupTab />}
        {activeTab === "links" && <IqcLinkTab />}
      </div>
    </div>
  );
}
