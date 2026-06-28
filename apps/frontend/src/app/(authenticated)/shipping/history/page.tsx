"use client";

/**
 * @file src/app/(authenticated)/shipping/history/page.tsx
 * @description 출하이력조회 페이지 - 출하 이력 필터링 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **조회 전용**: 출하지시 이력을 다양한 필터로 검색
 * 2. **필터**: 상태, 날짜 범위, 고객명 등으로 필터링
 * 3. API: GET /shipping/orders (조회 전용)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  History, Search, RefreshCw, Package, Box, Loader2,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { createShippingHistoryGridColumns, type ShipHistory } from "./shippingHistoryColumns";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface OrderPalletBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  status?: string;
}

interface OrderShippedBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  palletNo?: string;
  shippedAt?: string | null;
}

interface OrderPallet {
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: string;
  closeAt?: string | null;
  shippedAt?: string | null;
  boxes: OrderPalletBox[];
}

interface PalletDetail {
  pallets: OrderPallet[];
  boxShipped: OrderShippedBox[];
}

export default function ShipHistoryPage() {
  const { t } = useTranslation();
  const today = formatDateInput(new Date());
  const [data, setData] = useState<ShipHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ShipHistory | null>(null);
  const [palletDetail, setPalletDetail] = useState<PalletDetail | null>(null);
  const [palletLoading, setPalletLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const comCodeStatusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.shipDateFrom = dateFrom;
      if (dateTo) params.shipDateTo = dateTo;
      const res = await api.get("/shipping/history", { params });
      const rows: ShipHistory[] = (res.data?.data ?? []).map((row: ShipHistory) => ({
        ...row,
        id: row.id ?? row.shipOrderNo,
        itemCount: row.itemCount ?? row.items?.length ?? 0,
        totalQty: row.totalQty ?? row.items?.reduce((sum, item) => sum + Number(item.orderQty ?? 0), 0) ?? 0,
      }));
      setData(rows);
      setSelectedHistory((current) => {
        if (current && !rows.some((row) => row.shipOrderNo === current.shipOrderNo)) {
          setPalletDetail(null);
          return null;
        }
        return current;
      });
    } catch {
      setData([]);
      setSelectedHistory(null);
      setPalletDetail(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectHistory = useCallback(async (row: ShipHistory) => {
    setSelectedHistory(row);
    setPalletLoading(true);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(row.shipOrderNo)}/shipped-detail`, {
        suppressErrorModal: true,
      });
      setPalletDetail({
        pallets: res.data?.data?.pallets ?? [],
        boxShipped: res.data?.data?.boxShipped ?? [],
      });
    } catch {
      setPalletDetail({ pallets: [], boxShipped: [] });
    } finally {
      setPalletLoading(false);
    }
  }, []);

  const columns = useMemo(() => createShippingHistoryGridColumns({ t }), [t]);

  const pallets = palletDetail?.pallets ?? [];
  const looseBoxes = palletDetail?.boxShipped ?? [];
  const getPalletBoxCount = (pallet: OrderPallet) => pallet.boxes?.length ?? pallet.boxCount ?? 0;
  const getPalletQty = (pallet: OrderPallet) => (
    pallet.boxes?.length
      ? pallet.boxes.reduce((sum, box) => sum + Number(box.qty ?? 0), 0)
      : Number(pallet.totalQty ?? 0)
  );
  const palletTotals = useMemo(() => ({
    palletCount: pallets.length,
    boxCount: pallets.reduce((sum, pallet) => sum + getPalletBoxCount(pallet), 0) + looseBoxes.length,
    totalQty: pallets.reduce((sum, pallet) => sum + getPalletQty(pallet), 0) + looseBoxes.reduce((sum, box) => sum + Number(box.qty ?? 0), 0),
  }), [pallets, looseBoxes]);
  const fmt = (value?: number | null) => Number(value ?? 0).toLocaleString();
  const fmtDateTime = (value?: string | null) => value ? String(value).replace("T", " ").slice(0, 16) : "-";

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />{t("shipping.history.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.history.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
            enableExport exportFileName={t("shipping.history.title")}
            onRowClick={handleSelectHistory}
            selectedRowId={selectedHistory?.id}
            getRowId={(row) => row.id}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("shipping.history.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
                <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} className="flex-shrink-0" />
              </div>
            }
            sqlQuery={`SELECT *\nFROM SHIPPING_HISTORIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>

        <aside className="min-h-0 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
                  <Package className="h-4 w-4 text-primary" />
                  {t("shipping.history.palletDetail", "팔레트 상세")}
                </h2>
                {palletLoading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
              </div>
              <p className="mt-1 truncate font-mono text-xs text-text-muted">
                {selectedHistory?.shipOrderNo ?? t("shipping.history.selectRowForPallet", "좌측 행을 선택하세요")}
              </p>
            </div>

            {!selectedHistory ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-text-muted">
                {t("shipping.history.selectRowForPalletDetail", "좌측 출하이력 행을 선택하면 팔레트번호와 박스 구성이 표시됩니다.")}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded border border-border bg-background px-2 py-2">
                    <p className="text-xs text-text-muted">{t("shipping.confirm.pallet", "팔레트")}</p>
                    <p className="font-mono text-base font-semibold text-text">{fmt(palletTotals.palletCount)}</p>
                  </div>
                  <div className="rounded border border-border bg-background px-2 py-2">
                    <p className="text-xs text-text-muted">{t("shipping.confirm.box", "박스")}</p>
                    <p className="font-mono text-base font-semibold text-text">{fmt(palletTotals.boxCount)}</p>
                  </div>
                  <div className="rounded border border-border bg-background px-2 py-2">
                    <p className="text-xs text-text-muted">{t("common.totalQty", "총수량")}</p>
                    <p className="font-mono text-base font-semibold text-text">{fmt(palletTotals.totalQty)}</p>
                  </div>
                </div>

                {pallets.length === 0 && looseBoxes.length === 0 && !palletLoading ? (
                  <div className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
                    {t("shipping.history.noPalletDetail", "등록된 팔레트 정보가 없습니다.")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pallets.map((pallet) => (
                      <section key={pallet.palletNo} className="rounded border border-border bg-background">
                        <div className="border-b border-border px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate font-mono text-sm font-semibold text-primary" title={pallet.palletNo}>
                              {pallet.palletNo}
                            </p>
                            <span className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-text-muted">{pallet.status}</span>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
                            <span>{t("shipping.confirm.box", "박스")} {fmt(getPalletBoxCount(pallet))}</span>
                            <span>{t("common.qty", "수량")} {fmt(getPalletQty(pallet))}</span>
                            <span>{t("shipping.pallet.closeAt", "마감")} {fmtDateTime(pallet.closeAt)}</span>
                            <span>{t("shipping.pallet.shippedAt", "출하")} {fmtDateTime(pallet.shippedAt)}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-border">
                          {pallet.boxes.map((box) => (
                            <div key={box.boxNo} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate font-mono font-medium text-text" title={box.boxNo}>
                                  <Box className="h-3 w-3 text-text-muted" /> {box.boxNo}
                                </p>
                                <p className="mt-0.5 truncate text-text-muted">{box.itemCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-text">{fmt(box.qty)}</p>
                                <p className="text-text-muted">{box.status}</p>
                              </div>
                            </div>
                          ))}
                          {pallet.boxes.length === 0 && (
                            <div className="px-3 py-3 text-center text-xs text-text-muted">
                              {t("shipping.history.noPalletBoxes", "팔레트에 연결된 박스가 없습니다.")}
                            </div>
                          )}
                        </div>
                      </section>
                    ))}
                    {looseBoxes.length > 0 && (
                      <section className="rounded border border-border bg-background">
                        <div className="border-b border-border px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold text-primary">
                              {t("shipping.history.boxShipped", "박스 단건 출하")}
                            </p>
                            <span className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-text-muted">*</span>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
                            <span>{t("shipping.confirm.box", "박스")} {fmt(looseBoxes.length)}</span>
                            <span>{t("common.qty", "수량")} {fmt(looseBoxes.reduce((sum, box) => sum + Number(box.qty ?? 0), 0))}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-border">
                          {looseBoxes.map((box) => (
                            <div key={box.boxNo} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate font-mono font-medium text-text" title={box.boxNo}>
                                  <Box className="h-3 w-3 text-text-muted" /> {box.boxNo}
                                </p>
                                <p className="mt-0.5 truncate text-text-muted">{box.itemCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-text">{fmt(box.qty)}</p>
                                <p className="text-text-muted">{fmtDateTime(box.shippedAt)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
