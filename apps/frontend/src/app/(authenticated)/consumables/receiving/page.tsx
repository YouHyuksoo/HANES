"use client";

/**
 * @file src/pages/consumables/receiving/ReceivingPage.tsx
 * @description 소모품 입고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **바코드 스캔 입고**: 상단 스캔 영역에서 conUid 바코드를 스캔하면 즉시 입고 확정
 * 2. **수동 입고(IN)**: 우측 슬라이드 패널(ReceivingFormPanel)에서 등록
 * 3. **입고반품(IN_RETURN)**: 우측 슬라이드 패널(ReceivingReturnPanel)에서 등록
 * 4. **통계카드**: 금일 입고건수, 입고금액, 반품건수 표시
 */
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Search, ArrowDownCircle,
  DollarSign, Undo2, PackagePlus,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import ReceivingTable from "@/components/consumables/ReceivingTable";
import ReceivingFormPanel from "@/components/consumables/ReceivingFormPanel";
import ReceivingReturnPanel from "@/components/consumables/ReceivingReturnPanel";
import BarcodeScanPanel from "@/components/consumables/BarcodeScanPanel";
import { useReceivingData } from "@/hooks/consumables/useReceivingData";
import api from "@/services/api";

type PanelType = "receiving" | "return" | null;

export default function ReceivingPage() {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [saving, setSaving] = useState(false);
  const panelAnimateRef = useRef(true);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter, todayStats, refresh,
  } = useReceivingData();

  const openPanel = useCallback((type: PanelType) => {
    panelAnimateRef.current = activePanel !== type;
    setActivePanel(type);
  }, [activePanel]);

  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
    panelAnimateRef.current = true;
  }, []);

  const handleReceivingSubmit = async (formData: any) => {
    setSaving(true);
    try {
      await api.post("/consumables/receiving", { ...formData, logType: "IN" });
      setActivePanel(null);
      refresh();
    } catch (e) {
      console.error("Receiving submit failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnSubmit = async (formData: any) => {
    setSaving(true);
    try {
      await api.post("/consumables/receiving", { ...formData, logType: "IN_RETURN" });
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
              <PackagePlus className="w-7 h-7 text-primary" />
              {t("consumables.receiving.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("consumables.receiving.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openPanel("return")}>
              <Undo2 className="w-4 h-4 mr-1" /> {t("consumables.receiving.returnReceiving")}
            </Button>
            <Button size="sm" onClick={() => openPanel("receiving")}>
              <Plus className="w-4 h-4 mr-1" /> {t("consumables.receiving.register")}
            </Button>
          </div>
        </div>

        {/* 바코드 스캔 입고 확정 */}
        <BarcodeScanPanel />

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t("consumables.receiving.todayInCount")} value={todayStats.inCount} icon={ArrowDownCircle} color="green" />
          <StatCard label={t("consumables.receiving.todayInAmount")} value={todayStats.inAmount.toLocaleString() + t("common.won")} icon={DollarSign} color="blue" />
          <StatCard label={t("consumables.receiving.todayReturnCount")} value={todayStats.returnCount} icon={Undo2} color="orange" />
        </div>

        {/* 필터 + 테이블 */}
        <Card>
          <CardContent>
            <ReceivingTable
              data={data}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("consumables.receiving.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select
                      options={[
                        { value: "", label: t("consumables.receiving.allTypes") },
                        { value: "IN", label: t("consumables.receiving.typeIn") },
                        { value: "IN_RETURN", label: t("consumables.receiving.typeInReturn") },
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

      {/* 우측: 입고등록 패널 */}
      {activePanel === "receiving" && (
        <ReceivingFormPanel
          onClose={handlePanelClose}
          onSubmit={handleReceivingSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}

      {/* 우측: 입고반품 패널 */}
      {activePanel === "return" && (
        <ReceivingReturnPanel
          onClose={handlePanelClose}
          onSubmit={handleReturnSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}
    </div>
  );
}
