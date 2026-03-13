"use client";

/**
 * @file src/app/(authenticated)/master/process/page.tsx
 * @description 공정/라인/라우팅 통합 관리 페이지 - 탭으로 구분
 *
 * 초보자 가이드:
 * 1. **공정관리 탭**: 공정 코드/유형별 CRUD (최상위 개념)
 * 2. **생산라인 탭**: 공정에 속하는 물리적 생산라인 CRUD
 * 3. **라우팅관리 탭**: 품목별 공정순서(ProcessMap) CRUD
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Workflow, GitBranch, Route } from "lucide-react";
import ProcessTab from "@/components/master/ProcessTab";
import ProdLineTab from "@/components/master/ProdLineTab";
import RoutingTab from "@/components/master/RoutingTab";

const TABS = [
  { key: "process", labelKey: "master.process.title", icon: Workflow },
  { key: "prodLine", labelKey: "master.prodLine.title", icon: GitBranch },
  { key: "routing", labelKey: "master.routing.title", icon: Route },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ProcessPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("process");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Workflow className="w-7 h-7 text-primary" />
          {t("master.process.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.process.subtitle")}</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />{t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === "process" && <ProcessTab />}
      {activeTab === "prodLine" && <ProdLineTab />}
      {activeTab === "routing" && <RoutingTab />}
    </div>
  );
}
