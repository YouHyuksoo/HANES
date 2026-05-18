"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Route } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import RoutingGroupManager from "./components/RoutingGroupManager";
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
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <Route className="w-6 h-6 text-primary" />
            {t("master.routing.title")}
          </h1>
          <p className="text-sm text-text-muted dark:text-gray-400 mt-0.5">
            {t("master.routing.subtitle")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-5 min-h-0 flex-1">
        <div className="col-span-7 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              <RoutingGroupManager
                key={refreshKey}
                selectedProcess={selectedProcess}
                onSelectProcess={setSelectedProcess}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-5 flex flex-col min-h-0">
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
