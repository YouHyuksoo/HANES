"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Route } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import RoutingGroupManager from "./components/RoutingGroupManager";
import QualityConditionEditor from "./components/QualityConditionEditor";
import RoutingMaterialEditor from "./components/RoutingMaterialEditor";
import SelfInspectConfigEditor from "./components/SelfInspectConfigEditor";
import type { SelectedProcess } from "./types";

export default function RoutingPage() {
  usePageAiTools("master.routing");
  const { t } = useTranslation();
  const [selectedProcess, setSelectedProcess] = useState<SelectedProcess | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"conditions" | "materials" | "selfinspect">("conditions");
  const [refreshKey, setRefreshKey] = useState(0);
  const [layoutFocus, setLayoutFocus] = useState<"center" | "detail">("center");

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

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        <div
          className={`${layoutFocus === "detail" ? "col-span-7" : "col-span-9"} flex flex-col min-h-0 min-w-0 overflow-hidden transition-[grid-column] duration-200`}
          onMouseDownCapture={() => setLayoutFocus("center")}
        >
          <RoutingGroupManager
            key={refreshKey}
            selectedProcess={selectedProcess}
            onSelectProcess={setSelectedProcess}
            layoutFocus={layoutFocus}
          />
        </div>

        <div
          className={`${layoutFocus === "detail" ? "col-span-5" : "col-span-3"} flex flex-col min-h-0 min-w-0 overflow-hidden transition-[grid-column] duration-200`}
          onMouseDownCapture={() => setLayoutFocus("detail")}
        >
          <Card padding="none" className="flex-1 flex flex-col min-h-0 rounded-lg">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              {selectedProcess ? (
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex items-center gap-1 mb-3 shrink-0 border-b border-border dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("conditions")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "conditions"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted dark:text-gray-400 hover:text-text dark:hover:text-gray-200"
                      }`}
                    >
                      {t("master.routing.conditionEditorTitle")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("materials")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "materials"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted dark:text-gray-400 hover:text-text dark:hover:text-gray-200"
                      }`}
                    >
                      {t("master.routing.materialEditorTitle", { defaultValue: "투입자재" })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("selfinspect")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "selfinspect"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted dark:text-gray-400 hover:text-text dark:hover:text-gray-200"
                      }`}
                    >
                      {t("master.routing.selfInspectEditorTitle", "자주검사 설정")}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {activeDetailTab === "conditions" ? (
                      <QualityConditionEditor selectedProcess={selectedProcess} />
                    ) : activeDetailTab === "materials" ? (
                      <RoutingMaterialEditor selectedProcess={selectedProcess} />
                    ) : (
                      <SelfInspectConfigEditor selectedProcess={selectedProcess} />
                    )}
                  </div>
                </div>
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
