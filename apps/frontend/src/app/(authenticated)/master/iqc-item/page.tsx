"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC001 검사항목마스터 단독 페이지
 */

import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import IqcItemTab from "./components/IqcItemTab";

export default function IqcItemPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          {t("master.iqcItem.itemPool", "검사항목마스터")}
        </h1>
        <p className="text-text-muted mt-1">
          {t("master.iqcItem.itemPoolSubtitle", "IQC 검사에 사용할 전역 검사항목을 등록하고 관리합니다.")}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <IqcItemTab />
      </div>
    </div>
  );
}
