"use client";

/**
 * @file src/app/(authenticated)/master/prod-line/page.tsx
 * @description 생산라인관리 페이지 - 생산라인 CRUD
 *
 * 초보자 가이드:
 * 1. 공정에 속하는 물리적 생산라인을 관리하는 마스터 페이지
 * 2. ProdLineTab 컴포넌트가 실제 CRUD UI 담당
 */
import { useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";
import ProdLineTab from "@/components/master/ProdLineTab";

export default function ProdLinePage() {
  const { t } = useTranslation();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-primary" />
            {t("master.prodLine.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.prodLine.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ProdLineTab onHeaderActions={setHeaderActions} />
      </div>
    </div>
  );
}
