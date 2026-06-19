"use client";

import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

export default function AqlPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          {t("quality.aql.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("quality.aql.subtitle")}</p>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-5 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t("quality.aql.standardSection")}</h2>
            <div className="h-full min-h-[240px] rounded border border-dashed border-border bg-surface/30 flex items-center justify-center text-sm text-text-muted">
              {t("quality.aql.empty")}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-7 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t("quality.aql.ruleSection")}</h2>
            <div className="h-full min-h-[240px] rounded border border-dashed border-border bg-surface/30 flex items-center justify-center text-sm text-text-muted">
              {t("quality.aql.empty")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
