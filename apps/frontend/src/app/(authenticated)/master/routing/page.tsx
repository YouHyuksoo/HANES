"use client";

/**
 * @file src/app/(authenticated)/master/routing/page.tsx
 * @description 라우팅관리 페이지 - 품목별 공정순서(ProcessMap) CRUD
 *
 * 초보자 가이드:
 * 1. 품목별 공정순서를 관리하는 마스터 페이지
 * 2. RoutingTab 컴포넌트가 실제 CRUD UI 담당
 */
import { useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Route } from "lucide-react";
import RoutingTab from "@/components/master/RoutingTab";

export default function RoutingPage() {
  const { t } = useTranslation();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Route className="w-7 h-7 text-primary" />
            {t("master.routing.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.routing.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <RoutingTab onHeaderActions={setHeaderActions} />
      </div>
    </div>
  );
}
