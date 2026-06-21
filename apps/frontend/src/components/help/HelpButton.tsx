"use client";

import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHelpStore } from "@/stores/helpStore";

export default function HelpButton() {
  const { t } = useTranslation();
  const openHelp = useHelpStore((s) => s.openHelp);
  return (
    <button
      onClick={openHelp}
      className="p-2 rounded-md hover:bg-background transition-colors"
      aria-label={t("help.title", "도움말")}
      title={t("help.title", "도움말")}
    >
      <HelpCircle className="w-5 h-5 text-text-muted" />
    </button>
  );
}
