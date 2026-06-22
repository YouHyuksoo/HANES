"use client";

/**
 * @file src/pages/consumables/receiving/ReceivingPage.tsx
 * @description 소모품 입고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **바코드 스캔 입고**: 상단 스캔 영역에서 conUid 바코드를 스캔하면 즉시 입고 확정
 * 2. **바코드 스캔 반납**: 상단 모드를 반납으로 전환 후 바코드 스캔하여 반납 처리
 * 3. **수동 입고(IN)**: 우측 슬라이드 패널(ReceivingFormPanel)에서 등록
 */
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Search, PackagePlus,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ReceivingTable from "@/components/consumables/ReceivingTable";
import ReceivingFormPanel from "@/components/consumables/ReceivingFormPanel";
import BarcodeScanPanel from "@/components/consumables/BarcodeScanPanel";
import { useReceivingData } from "@/hooks/consumables/useReceivingData";
import api from "@/services/api";

type PanelType = "receiving" | null;

export default function ReceivingPage() {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [saving, setSaving] = useState(false);
  const panelAnimateRef = useRef(true);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter,
    startDate, setStartDate, endDate, setEndDate, refresh,
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

  return (
    <div className="flex h-full animate-fade-in">
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
            <Button size="sm" onClick={() => openPanel("receiving")}>
              <Plus className="w-4 h-4 mr-1" /> {t("consumables.receiving.register")}
            </Button>
          </div>
        </div>

        {/* 바코드 스캔 입고 확정 */}
        <BarcodeScanPanel onScanSuccess={refresh} />

        {/* 필터 + 테이블 */}
        <Card>
          <CardContent>
            <ReceivingTable
              data={data}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <DateRangeFilter from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
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
    </div>
  );
}
