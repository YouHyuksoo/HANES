"use client";

/**
 * @file src/app/(authenticated)/production/carrier-status/page.tsx
 * @description 대차현황 페이지 — 레이아웃·상태 배선만 담당(thin page)
 *
 * 초보자 가이드:
 * 1. 기본 필터는 "활성(빈 대차 제외)" — EMPTY 상태는 목록에서 빠진다.
 * 2. 좌: DataGrid(서버 페이징) — 컬럼은 carrierStatusColumns.tsx
 * 3. 바코드로 대차 찾기(BarcodeScanInput)는 목록 조회의 barcode 파라미터로 넘어간다(대차번호/담긴 라벨 바코드 매칭은 서버 담당)
 * 4. 우: CarrierContentsPanel — 행 클릭 시 담긴 내용을 조회, 이동전표는 CarrierSlipPrintModal 재사용
 * 5. API: /production/carriers (GET), /production/carriers/:no (GET)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Search, Truck } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ProcessSelect, BarcodeScanInput } from "@/components/shared";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { createCarrierStatusColumns, type CarrierStatusRow } from "./carrierStatusColumns";
import CarrierContentsPanel from "./CarrierContentsPanel";

const PAGE_SIZE = 50;

export default function CarrierStatusPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CarrierStatusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [processFilter, setProcessFilter] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedNo, setSelectedNo] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/carriers", {
        params: {
          page,
          limit: PAGE_SIZE,
          carrierStatus: statusFilter,
          ...(processFilter && { processCode: processFilter }),
          ...(barcodeQuery.trim() && { barcode: barcodeQuery.trim() }),
          ...(searchText.trim() && { search: searchText.trim() }),
        },
      });
      setRows(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, processFilter, barcodeQuery, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 필터가 바뀔 때 setPage(1)을 별도 useEffect로 뒤따라 부르면 fetchData가 두 번(옛 page→새 page) 실행된다.
  // 필터 변경과 page 리셋을 같은 이벤트 핸들러에서 함께 반영해 React가 한 번에 배치하도록 한다 → 요청 1회.
  const handleStatusFilterChange = useCallback((value: string) => { setStatusFilter(value); setPage(1); }, []);
  const handleProcessFilterChange = useCallback((value: string) => { setProcessFilter(value); setPage(1); }, []);
  const handleBarcodeQueryChange = useCallback((value: string) => { setBarcodeQuery(value); setPage(1); }, []);
  const handleSearchTextChange = useCallback((value: string) => { setSearchText(value); setPage(1); }, []);

  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("production.carrierStatus.active") },
    { value: "EMPTY", label: t("comCode.CARRIER_STATUS.EMPTY", "빈 대차") },
    { value: "LOADING", label: t("comCode.CARRIER_STATUS.LOADING", "적재중") },
    { value: "IN_TRANSIT", label: t("comCode.CARRIER_STATUS.IN_TRANSIT", "이동중") },
  ], [t]);

  const columns = useMemo(() => createCarrierStatusColumns({ t }), [t]);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Truck className="w-7 h-7 text-primary" />
              {t("production.carrierStatus.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("production.carrierStatus.subtitle")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchData()}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={rows} columns={columns} isLoading={loading} pageSize={PAGE_SIZE}
              enableColumnFilter enableExport
              exportFileName={t("production.carrierStatus.title")}
              getRowId={(row) => (row as CarrierStatusRow).carrierNo}
              selectedRowId={selectedNo ?? undefined}
              onRowClick={(row) => setSelectedNo((row as CarrierStatusRow).carrierNo)}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="w-40">
                    <Select options={statusOptions} value={statusFilter} onChange={handleStatusFilterChange} fullWidth />
                  </div>
                  <ProcessSelect value={processFilter} onChange={handleProcessFilterChange} labelPrefix={t("production.carrierStatus.loadProcess")} />
                  <div className="w-56">
                    <BarcodeScanInput
                      value={barcodeQuery}
                      onChange={handleBarcodeQueryChange}
                      onScan={(v) => handleBarcodeQueryChange(v)}
                      placeholder={t("production.carrierStatus.findByBarcode")}
                      maintainFocus={false}
                      blinkIndicator={false}
                      fullWidth
                    />
                  </div>
                  <div className="w-56">
                    <Input placeholder={t("common.search")} value={searchText}
                      onChange={e => handleSearchTextChange(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />
                </div>
              }
              sqlQuery={`SELECT c.CARRIER_NO, c.CARRIER_TYPE, c.CARRIER_NAME, c.CAPACITY,\n       CASE WHEN cnt.LOADED_COUNT = 0 THEN 'EMPTY' ELSE l.STATUS END AS STATUS,\n       l.KIND, l.ITEM_CODE, l.ITEM_NAME, l.ORDER_NO,\n       cnt.LOADED_COUNT, cnt.TOTAL_QTY, l.SLIP_NO, l.LOAD_PROCESS_CD, cnt.LAST_LOADED_AT\nFROM CARRIER_MASTERS c\nLEFT JOIN (\n  SELECT CARRIER_NO, KIND, ITEM_CODE, ITEM_NAME, ORDER_NO, STATUS, SLIP_NO, LOAD_PROCESS_CD FROM FG_LABELS\n  UNION ALL SELECT CARRIER_NO, KIND, ITEM_CODE, ITEM_NAME, ORDER_NO, STATUS, SLIP_NO, LOAD_PROCESS_CD FROM SG_LABELS\n  UNION ALL SELECT CARRIER_NO, KIND, ITEM_CODE, ITEM_NAME, ORDER_NO, STATUS, SLIP_NO, LOAD_PROCESS_CD FROM MAT_LOTS\n) l ON l.CARRIER_NO = c.CARRIER_NO\nLEFT JOIN (SELECT CARRIER_NO, COUNT(*) LOADED_COUNT, SUM(QTY) TOTAL_QTY, MAX(LOADED_AT) LAST_LOADED_AT FROM (...) GROUP BY CARRIER_NO) cnt\n  ON cnt.CARRIER_NO = c.CARRIER_NO\nWHERE c.COMPANY = '40' AND c.PLANT_CD = '1000'\nORDER BY c.CARRIER_NO`} />
          </CardContent>
        </Card>
      </div>

      <CarrierContentsPanel carrierNo={selectedNo} onClose={() => setSelectedNo(null)} onChanged={fetchData} />
    </div>
  );
}
