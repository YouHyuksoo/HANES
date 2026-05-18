"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Route } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import RoutingTreePanel from "./components/RoutingTreePanel";
import QualityConditionEditor from "./components/QualityConditionEditor";
import type { SelectedProcess } from "./types";

export default function RoutingPage() {
  const { t } = useTranslation();
  const [selectedProcess, setSelectedProcess] = useState<SelectedProcess | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
    setSelectedProcess(null);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <Route className="w-7 h-7 text-primary" />
            {t("master.routing.title")}
          </h1>
          <p className="text-text-muted dark:text-gray-400 mt-1">
            {t("master.routing.subtitle")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { no: "1", title: t("master.routing.stepSelectItem"), desc: t("master.routing.stepSelectItemDesc") },
          { no: "2", title: t("master.routing.stepManageProcess"), desc: t("master.routing.stepManageProcessDesc") },
          { no: "3", title: t("master.routing.stepManageCondition"), desc: t("master.routing.stepManageConditionDesc") },
        ].map((step) => (
          <div key={step.no} className="flex items-start gap-3 rounded-lg border border-border dark:border-gray-700 bg-surface/60 dark:bg-gray-800/50 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {step.no}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text dark:text-gray-100">{step.title}</div>
              <div className="mt-0.5 text-xs text-text-muted dark:text-gray-400">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
        <div className="col-span-4 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              <RoutingTreePanel
                key={refreshKey}
                selectedProcess={selectedProcess}
                onSelectProcess={setSelectedProcess}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              {selectedProcess ? (
                <QualityConditionEditor selectedProcess={selectedProcess} />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted dark:text-gray-400 text-sm">
                  {t("master.routing.selectItemPrompt")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
