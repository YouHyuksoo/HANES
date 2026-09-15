"use client";

/**
 * @file production/label-reprint/page.tsx
 * @description 반제품(SG)·완제품(FG) 라벨 재발행 — 훼손·분실 라벨을 다시 출력한다.
 *
 * 초보자 가이드:
 * 1. SG 라벨은 실적입력(가공) 저장 직후, FG 라벨은 실적입력(조립) 발행 시 각각 1회만 나온다.
 *    이후 다시 뽑을 화면이 없어 이 화면을 만들었다(자재·소모품·박스 라벨은 이미 재발행이 있다).
 * 2. 이력성 목록이라 발행일 구간을 기본 당일로 두고 조회한다 — 조건 없는 전량 조회를 하지 않는다.
 * 3. 출력은 키오스크와 같은 프린트 호스트(SgLabelPrintHost/FgLabelPrintHost)를 그대로 쓴다.
 *    같은 템플릿·같은 렌더러라 재발행분이 원본과 똑같이 나온다.
 * 4. 재발행은 먼저 서버에 기록(FG 는 REPRINT_COUNT, 둘 다 LABEL_PRINT_LOGS)한 뒤 출력한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer, RefreshCw, Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import FilterBar from "@/components/shared/FilterBar";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import StatusBadge from "@/components/shared/StatusBadge";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import SgLabelPrintHost, { SgLabelPrintHandle } from "../input-kiosk/components/SgLabelPrintHost";
import FgLabelPrintHost, { FgLabelPrintHandle } from "../input-kiosk/components/FgLabelPrintHost";

type LabelType = "SG" | "FG";

interface ReprintRow {
  labelType: LabelType;
  barcode: string;
  itemCode: string;
  orderNo: string | null;
  qty: number | null;
  processCode: string | null;
  status: string;
  issuedAt: string;
  reprintCount: number | null;
}

export default function LabelReprintPage() {
  const { t } = useTranslation();
  const today = getTodayLocal();

  const [labelType, setLabelType] = useState<LabelType>("SG");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReprintRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const sgHostRef = useRef<SgLabelPrintHandle>(null);
  const fgHostRef = useRef<FgLabelPrintHandle>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/label-reprint", {
        params: { labelType, fromDate, toDate, ...(search.trim() ? { search: search.trim() } : {}) },
      });
      setRows(res.data?.data ?? []);
      setSelected(new Set());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [labelType, fromDate, toDate, search]);

  useEffect(() => { fetchRows(); }, [labelType, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((barcode: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode);
      else next.add(barcode);
      return next;
    });
  }, []);

  const selectableRows = useMemo(() => rows.filter((r) => r.status !== "VOIDED"), [rows]);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.barcode));

  const handleReprint = useCallback(async () => {
    const barcodes = [...selected];
    if (barcodes.length === 0) return;

    setPrinting(true);
    try {
      // 기록을 먼저 남긴다 — 뽑았는데 이력이 없는 상태를 만들지 않는다.
      const res = await api.post("/production/label-reprint", { labelType, barcodes });
      const printable = (res.data?.data ?? []) as Array<{
        barcode: string; itemCode: string; orderNo: string | null; qty: number | null; processCode: string | null;
      }>;

      if (labelType === "SG") {
        await sgHostRef.current?.printBySgBarcodes(
          printable.map((p) => ({
            sgBarcode: p.barcode,
            itemCode: p.itemCode,
            orderNo: p.orderNo ?? undefined,
            initQty: p.qty ?? undefined,
            issueProcessCode: p.processCode ?? undefined,
          })),
        );
      } else {
        await fgHostRef.current?.printByFgBarcodes(
          printable.map((p) => ({
            fgBarcode: p.barcode,
            itemCode: p.itemCode,
            orderNo: p.orderNo ?? undefined,
          })),
        );
      }
      await fetchRows();
    } catch {
      // 오류 토스트는 인터셉터가 띄운다
    } finally {
      setPrinting(false);
    }
  }, [selected, labelType, fetchRows]);

  const columns = useMemo<ColumnDef<ReprintRow>[]>(() => [
    {
      id: "select", size: 44, header: () => (
        <input
          type="checkbox"
          aria-label={t("common.selectAll", "전체 선택")}
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(selectableRows.map((r) => r.barcode)))}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={t("production.labelReprint.selectRow", "{{barcode}} 선택", { barcode: row.original.barcode })}
          checked={selected.has(row.original.barcode)}
          disabled={row.original.status === "VOIDED"}
          onChange={() => toggle(row.original.barcode)}
        />
      ),
    },
    {
      accessorKey: "barcode", header: t("production.labelReprint.barcode", "라벨 바코드"), size: 170,
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
    },
    { accessorKey: "itemCode", header: t("common.partCode", "품번"), size: 160 },
    {
      accessorKey: "orderNo", header: t("production.result.orderNo", "작업지시"), size: 150,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "qty", header: t("common.qty", "수량"), size: 80, meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v === null ? "-" : v.toLocaleString();
      },
    },
    {
      accessorKey: "status", header: t("common.status", "상태"), size: 110,
      cell: ({ getValue }) => <StatusBadge codeType="FG_LABEL_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: "reprintCount", header: t("production.labelReprint.reprintCount", "재발행"), size: 80,
      meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v === null ? "-" : `${v}회`;
      },
    },
    { accessorKey: "issuedAt", header: t("production.labelReprint.issuedAt", "발행일시"), size: 160 },
  ], [t, selected, allSelected, selectableRows, toggle]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div>
        <h1 className="text-xl font-bold text-text">
          {t("production.labelReprint.title", "반제품·완제품 라벨 재발행")}
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          {t("production.labelReprint.description", "훼손·분실된 SG/FG 라벨을 다시 출력합니다. 재발행 이력이 기록됩니다.")}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={fetchRows} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh", "새로고침")}
        </Button>
        <Button
          onClick={handleReprint}
          disabled={selected.size === 0 || printing}
          data-testid="label-reprint-print"
        >
          <Printer className="w-4 h-4 mr-1" />
          {t("production.labelReprint.reprint", "재발행")}
          {selected.size > 0 && ` (${selected.size})`}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4 flex flex-col min-h-0">
          <DataGrid
            data={rows}
            columns={columns}
            isLoading={loading}
            enableExport
            exportFileName={t("production.labelReprint.title", "반제품·완제품 라벨 재발행")}
            toolbarLeft={
              <FilterBar>
                <Select
                  aria-label={t("production.labelReprint.labelType", "라벨 유형")}
                  value={labelType}
                  onChange={(v) => setLabelType(v === "FG" ? "FG" : "SG")}
                  options={[
                    { value: "SG", label: t("production.labelReprint.sg", "반제품(SG)") },
                    { value: "FG", label: t("production.labelReprint.fg", "완제품(FG)") },
                  ]}
                />
                <DateRangeFilter
                  label={t("production.labelReprint.issuedAt", "발행일시")}
                  from={fromDate}
                  to={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                />
                <Input
                  placeholder={t("production.labelReprint.searchPlaceholder", "바코드·품번·작업지시 검색...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") fetchRows(); }}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </FilterBar>
            }
          />
        </CardContent>
      </Card>

      <SgLabelPrintHost ref={sgHostRef} />
      <FgLabelPrintHost ref={fgHostRef} />
    </div>
  );
}
