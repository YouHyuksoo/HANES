"use client";

/**
 * @file src/app/(authenticated)/master/process/page.tsx
 * @description 공정관리 페이지 - 공정 코드/유형별 CRUD
 *
 * 초보자 가이드:
 * 1. 공정 코드, 이름, 유형 등을 관리하는 마스터 페이지
 * 2. ProcessTab 컴포넌트가 실제 CRUD UI 담당
 */
import { useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Workflow } from "lucide-react";
import ProcessTab from "@/components/master/ProcessTab";

export default function ProcessPage() {
  const { t } = useTranslation();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Workflow className="w-7 h-7 text-primary" />
            {t("master.process.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.process.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ProcessTab onHeaderActions={setHeaderActions} />
      </div>
    </div>
  );
}
