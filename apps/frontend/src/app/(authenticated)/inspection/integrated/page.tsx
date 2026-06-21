"use client";

import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";
import IntegratedInspectWorkflow from "./components/IntegratedInspectWorkflow";

export default function IntegratedInspectPage() {
  const { t } = useTranslation();
  return (
    <IntegratedInspectWorkflow
      title={t("inspection.integrated.title", "통합검사")}
      description={t("inspection.integrated.description", "회로/리크/내전압/구조 통합 검사")}
      searchPlaceholder={t("inspection.integrated.searchPlaceholder", "작업지시번호/품목 검색...")}
    />
  );
}
