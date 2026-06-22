"use client";

/**
 * @file src/pages/consumables/issuing/IssuingPage.tsx
 * @description 소모품 출고관리 메인 페이지
 */
import { useTranslation } from "react-i18next";
import {
  RefreshCw, Search,
  PackageMinus,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import IssuingTable from "@/components/consumables/IssuingTable";
import IssueScanPanel from "@/components/consumables/IssueScanPanel";
import { useIssuingData } from "@/hooks/consumables/useIssuingData";

export default function IssuingPage() {
  const { t } = useTranslation();
  const {
    data, isLoading, refresh,
    searchTerm, setSearchTerm,
    typeFilter, setTypeFilter,
    startDate, setStartDate,
    endDate, setEndDate,
  } = useIssuingData();

  return (
    <div className="flex h-full animate-fade-in">
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
          </div>
        </div>

        {/* 스캔 패널 */}
        <IssueScanPanel onScanSuccess={refresh} />

        {/* 필터 + 테이블 */}
        <Card>
          <CardContent>
            <IssuingTable
              data={data}
              isLoading={isLoading}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <DateRangeFilter from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
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
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
