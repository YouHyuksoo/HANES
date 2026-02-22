"use client";

/**
 * @file src/app/(authenticated)/master/prod-line/page.tsx
 * @description 생산라인/공정/라우팅 통합 관리 페이지 - 탭으로 구분
 *
 * 초보자 가이드:
 * 1. **생산라인 탭**: 공장 내 물리적 생산라인 CRUD (API 연동)
 * 2. **공정관리 탭**: 공정 코드/유형별 CRUD
 * 3. **라우팅관리 탭**: 품목별 공정순서(ProcessMap) CRUD
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, Workflow, Route } from "lucide-react";
import ProdLineTab from "@/components/master/ProdLineTab";
import ProcessTab from "@/components/master/ProcessTab";
import RoutingTab from "@/components/master/RoutingTab";

const TABS = [
  { key: "prodLine", labelKey: "master.prodLine.title", icon: GitBranch },
  { key: "process", labelKey: "master.process.title", icon: Workflow },
  { key: "routing", labelKey: "master.routing.title", icon: Route },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ProdLinePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("prodLine");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <GitBranch className="w-7 h-7 text-primary" />
          {t("master.prodLine.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.prodLine.subtitle")}</p>
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
      {activeTab === "prodLine" && <ProdLineTab />}
      {activeTab === "process" && <ProcessTab />}
      {activeTab === "routing" && <RoutingTab />}
    </div>
  );
}

export default ProdLinePage;
