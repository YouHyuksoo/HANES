"use client";

/**
 * @file src/pages/consumables/issuing/IssuingPage.tsx
 * @description 소모품 출고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **출고(OUT)**: 우측 슬라이드 패널(IssuingFormPanel)에서 등록
 * 2. **출고반품(OUT_RETURN)**: 우측 슬라이드 패널(IssuingReturnPanel)에서 등록
 * 3. **통계카드**: 금일 출고건수, 출고반품건수, 미반품건수 표시
 */
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Search, ArrowUpCircle,
  Undo2, AlertTriangle, PackageMinus,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import IssuingTable from "@/components/consumables/IssuingTable";
import IssuingFormPanel from "@/components/consumables/IssuingFormPanel";
import IssuingReturnPanel from "@/components/consumables/IssuingReturnPanel";
import { useIssuingData } from "@/hooks/consumables/useIssuingData";
import api from "@/services/api";

type PanelType = "issuing" | "return" | null;

export default function IssuingPage() {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [saving, setSaving] = useState(false);
  const panelAnimateRef = useRef(true);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter, todayStats, refresh,
  } = useIssuingData();

  const openPanel = useCallback((type: PanelType) => {
    panelAnimateRef.current = activePanel !== type;
    setActivePanel(type);
  }, [activePanel]);

  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
    panelAnimateRef.current = true;
  }, []);

  const handleIssuingSubmit = async (formData: any) => {
    setSaving(true);
    try {
      await api.post("/consumables/issuing", { ...formData, logType: "OUT" });
      setActivePanel(null);
      refresh();
    } catch (e) {
      console.error("Issuing submit failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnSubmit = async (formData: any) => {
    setSaving(true);
    try {
      await api.post("/consumables/issuing", { ...formData, logType: "OUT_RETURN" });
      setActivePanel(null);
      refresh();
    } catch (e) {
      console.error("Return submit failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <PackageMinus className="w-7 h-7 text-primary" />
              {t("consumables.issuing.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("consumables.issuing.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openPanel("return")}>
              <Undo2 className="w-4 h-4 mr-1" /> {t("consumables.issuing.returnIssuing")}
            </Button>
            <Button size="sm" onClick={() => openPanel("issuing")}>
              <Plus className="w-4 h-4 mr-1" /> {t("consumables.issuing.register")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t("consumables.issuing.todayOutCount")} value={todayStats.outCount} icon={ArrowUpCircle} color="blue" />
          <StatCard label={t("consumables.issuing.todayReturnCount")} value={todayStats.returnCount} icon={Undo2} color="purple" />
          <StatCard label={t("consumables.issuing.unreturned")} value={todayStats.unreturned} icon={AlertTriangle} color="red" />
        </div>

        {/* 필터 + 테이블 */}
        <Card>
          <CardContent>
            <IssuingTable
              data={data}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("consumables.issuing.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select
                      options={[
                        { value: "", label: t("consumables.issuing.allTypes") },
                        { value: "OUT", label: t("consumables.issuing.typeOut") },
                        { value: "OUT_RETURN", label: t("consumables.issuing.typeOutReturn") },
                      ]}
                      value={typeFilter}
                      onChange={setTypeFilter}
                      fullWidth
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={refresh} className="flex-shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 우측: 출고등록 패널 */}
      {activePanel === "issuing" && (
        <IssuingFormPanel
          onClose={handlePanelClose}
          onSubmit={handleIssuingSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}

      {/* 우측: 출고반품 패널 */}
      {activePanel === "return" && (
        <IssuingReturnPanel
          onClose={handlePanelClose}
          onSubmit={handleReturnSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}
    </div>
  );
}
