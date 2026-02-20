"use client";

/**
 * @file src/app/(authenticated)/material/receive-label/page.tsx
 * @description 입고라벨 발행 페이지 - IQC 합격 LOT 선택 후 자재롯트 라벨 발행
 *
 * 초보자 가이드:
 * 1. **대상**: IQC 합격(PASSED) LOT 중 라벨 발행할 건을 체크박스로 선택
 * 2. **발행**: "라벨 발행" 클릭 → 자재롯트라벨 템플릿 적용 → LOT 수량만큼 인쇄
 * 3. **템플릿**: 기준정보 > 라벨관리 > 자재롯트라벨 탭에서 디자인 저장
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Printer, Search, RefreshCw, Tag, CheckCircle, Package, FileText,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/services/api";
import BarcodeCanvas from "../../master/label/components/BarcodeCanvas";
import { LabelDesign, MAT_LOT_DEFAULT_DESIGN } from "../../master/label/types";

/** IQC 합격 LOT 아이템 */
interface PassedLot {
  id: string;
  lotNo: string;
  partId: string;
  partType: string;
  initQty: number;
  currentQty: number;
  recvDate?: string | null;
  poNo?: string | null;
  vendor?: string | null;
  iqcStatus: string;
  receivedQty: number;
  remainingQty: number;
  part: { id: string; partCode: string; partName: string; unit: string };
}

/** 통계 */
interface LabelStats {
  totalLots: number;
  totalQty: number;
  selectedLots: number;
  selectedQty: number;
}

function ReceiveLabelPage() {
  const { t } = useTranslation();
  const [lots, setLots] = useState<PassedLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(MAT_LOT_DEFAULT_DESIGN);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  /** IQC 합격 LOT 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/receiving/receivable");
      const raw = res.data?.data ?? res.data;
      const list: PassedLot[] = Array.isArray(raw) ? raw : raw?.data ?? [];
      setLots(list);
    } catch {
      setLots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 자재롯트 라벨 템플릿 로드 */
  const fetchTemplate = useCallback(async () => {
    try {
      const res = await api.get("/master/label-templates", {
        params: { category: "mat_lot" },
      });
      const templates = res.data?.data ?? [];
      const defaultTpl = templates.find(
        (tpl: { isDefault: boolean }) => tpl.isDefault
      ) || templates[0];
      if (defaultTpl?.designData) {
        const design =
          typeof defaultTpl.designData === "string"
            ? JSON.parse(defaultTpl.designData)
            : defaultTpl.designData;
        setLabelDesign(design);
      }
    } catch {
      /* 템플릿 없으면 기본값 사용 */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTemplate();
  }, [fetchData, fetchTemplate]);

  /** 검색 필터 */
  const filteredLots = useMemo(() => {
    if (!searchText.trim()) return lots;
    const q = searchText.toLowerCase();
    return lots.filter(
      (lot) =>
        lot.lotNo.toLowerCase().includes(q) ||
        lot.part.partCode.toLowerCase().includes(q) ||
        lot.part.partName.toLowerCase().includes(q) ||
        (lot.vendor ?? "").toLowerCase().includes(q)
    );
  }, [lots, searchText]);

  /** 통계 */
  const stats = useMemo<LabelStats>(() => {
    const selectedLots = filteredLots.filter((l) => selectedIds.has(l.id));
    return {
      totalLots: filteredLots.length,
      totalQty: filteredLots.reduce((s, l) => s + l.initQty, 0),
      selectedLots: selectedLots.length,
      selectedQty: selectedLots.reduce((s, l) => s + l.initQty, 0),
    };
  }, [filteredLots, selectedIds]);

  /** 전체 선택/해제 */
  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(
        checked ? new Set(filteredLots.map((l) => l.id)) : new Set()
      );
    },
    [filteredLots]
  );

  /** 개별 선택 */
  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /** 라벨 인쇄 */
  const handlePrint = useCallback(() => {
    const selected = filteredLots.filter((l) => selectedIds.has(l.id));
    if (selected.length === 0) return;

    setPrinting(true);
    /* 렌더 후 인쇄 실행 */
    setTimeout(() => {
      if (!printRef.current) {
        setPrinting(false);
        return;
      }
      const win = window.open("", "_blank");
      if (!win) {
        setPrinting(false);
        return;
      }
      win.document.write(`
        <html><head><title>${t("material.receiveLabel.printTitle")}</title>
        <style>
          body { margin: 0; font-family: sans-serif; }
          .label-grid { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; }
          .label-card { border: 1px dashed #ccc; position: relative; overflow: hidden;
            width: ${labelDesign.labelWidth}mm; height: ${labelDesign.labelHeight}mm;
            page-break-inside: avoid; box-sizing: border-box; }
          .bc { position: absolute; display: flex; align-items: center; justify-content: center; }
          .txt { position: absolute; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          canvas { max-width: 100%; max-height: 100%; }
          @media print { .label-card { border: 1px dashed #ddd; } }
        </style></head><body>
        <div class="label-grid">${printRef.current.innerHTML}</div>
        <script>window.onload=()=>{window.print();window.close();}<\/script>
        </body></html>
      `);
      win.document.close();
      setPrinting(false);
    }, 500);
  }, [filteredLots, selectedIds, labelDesign, t]);

  /** 선택된 LOT → 라벨 데이터 (수량만큼 라벨 반복) */
  const labelItems = useMemo(() => {
    const selected = filteredLots.filter((l) => selectedIds.has(l.id));
    const result: { key: string; lotNo: string; partCode: string; partName: string; sub: string }[] = [];
    for (const lot of selected) {
      for (let i = 0; i < lot.initQty; i++) {
        result.push({
          key: `${lot.id}-${i}`,
          lotNo: lot.lotNo,
          partCode: lot.part.partCode,
          partName: lot.part.partName,
          sub: `${lot.vendor ?? ""} | ${lot.recvDate?.slice(0, 10) ?? ""}`,
        });
      }
    }
    return result;
  }, [filteredLots, selectedIds]);

  const allSelected =
    filteredLots.length > 0 &&
    filteredLots.every((l) => selectedIds.has(l.id));

  /** DataGrid 컬럼 */
  const columns = useMemo<ColumnDef<PassedLot>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
        ),
        size: 40,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleItem(row.original.id)}
            className="w-4 h-4 accent-primary"
          />
        ),
      },
      {
        id: "lotNo",
        header: t("material.col.lotNo"),
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.lotNo}</span>
        ),
      },
      {
        id: "partCode",
        header: t("common.partCode"),
        size: 120,
        cell: ({ row }) => row.original.part.partCode,
      },
      {
        id: "partName",
        header: t("common.partName"),
        size: 150,
        cell: ({ row }) => row.original.part.partName,
      },
      {
        id: "initQty",
        header: t("material.receiveLabel.qty"),
        size: 80,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.initQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: "labelCount",
        header: t("material.receiveLabel.labelCount"),
        size: 80,
        cell: ({ row }) => (
          <span className="text-primary font-bold">
            {row.original.initQty.toLocaleString()}
            {t("material.receiveLabel.sheets")}
          </span>
        ),
      },
      {
        id: "vendor",
        header: t("material.arrival.col.vendor"),
        size: 120,
        cell: ({ row }) => row.original.vendor || "-",
      },
      {
        id: "poNo",
        header: t("material.arrival.col.poNo"),
        size: 120,
        cell: ({ row }) => row.original.poNo || "-",
      },
      {
        id: "recvDate",
        header: t("material.col.arrivalDate"),
        size: 100,
        cell: ({ row }) => row.original.recvDate?.slice(0, 10) || "-",
      },
    ],
    [t, allSelected, selectedIds, toggleAll, toggleItem]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />
            {t("material.receiveLabel.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.receiveLabel.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t("common.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={selectedIds.size === 0 || printing}
          >
            <Printer className="w-4 h-4 mr-1" />
            {t("material.receiveLabel.printLabel")}
            {stats.selectedQty > 0 && ` (${stats.selectedQty}${t("material.receiveLabel.sheets")})`}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label={t("material.receiveLabel.stats.totalLots")}
          value={stats.totalLots}
          icon={Package}
          color="blue"
        />
        <StatCard
          label={t("material.receiveLabel.stats.totalQty")}
          value={stats.totalQty}
          icon={FileText}
          color="gray"
        />
        <StatCard
          label={t("material.receiveLabel.stats.selectedLots")}
          value={stats.selectedLots}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label={t("material.receiveLabel.stats.selectedLabels")}
          value={stats.selectedQty}
          icon={Printer}
          color="purple"
        />
      </div>

      {/* 검색 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 max-w-md">
              <Input
                placeholder={t("material.receiveLabel.searchPlaceholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
          </div>
          <DataGrid data={filteredLots} columns={columns} pageSize={20} isLoading={loading} />
        </CardContent>
      </Card>

      {/* 인쇄용 라벨 렌더링 (숨김) */}
      {printing && labelItems.length > 0 && (
        <div className="fixed left-[-9999px] top-0">
          <div ref={printRef} className="flex flex-wrap gap-1">
            {labelItems.map((item) => (
              <div
                key={item.key}
                className="border border-dashed border-gray-300 relative overflow-hidden"
                style={{
                  width: `${labelDesign.labelWidth}mm`,
                  height: `${labelDesign.labelHeight}mm`,
                }}
              >
                {/* 바코드 */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${(labelDesign.barcode.x / labelDesign.labelWidth) * 100}%`,
                    top: `${(labelDesign.barcode.y / labelDesign.labelHeight) * 100}%`,
                    transform: "translateX(-50%)",
                    width: `${(labelDesign.barcode.size / labelDesign.labelWidth) * 100}%`,
                  }}
                >
                  <BarcodeCanvas
                    value={item.lotNo}
                    format={labelDesign.barcode.format}
                  />
                </div>
                {/* 코드 텍스트 (품목코드) */}
                {labelDesign.codeText.enabled && (
                  <div
                    className="absolute w-full truncate"
                    style={{
                      top: `${(labelDesign.codeText.y / labelDesign.labelHeight) * 100}%`,
                      fontSize: `${labelDesign.codeText.fontSize * 0.8}px`,
                      fontFamily: labelDesign.codeText.fontFamily,
                      fontWeight: labelDesign.codeText.bold ? "bold" : "normal",
                      textAlign: labelDesign.codeText.align,
                      left: 0,
                      right: 0,
                      padding: "0 4px",
                    }}
                  >
                    {item.partCode}
                  </div>
                )}
                {/* 명칭 텍스트 (품목명) */}
                {labelDesign.nameText.enabled && (
                  <div
                    className="absolute w-full truncate text-gray-600"
                    style={{
                      top: `${(labelDesign.nameText.y / labelDesign.labelHeight) * 100}%`,
                      fontSize: `${labelDesign.nameText.fontSize * 0.8}px`,
                      fontFamily: labelDesign.nameText.fontFamily,
                      fontWeight: labelDesign.nameText.bold ? "bold" : "normal",
                      textAlign: labelDesign.nameText.align,
                      left: 0,
                      right: 0,
                      padding: "0 4px",
                    }}
                  >
                    {item.partName}
                  </div>
                )}
                {/* 서브 텍스트 (거래처 | 입하일) */}
                {labelDesign.subText.enabled && (
                  <div
                    className="absolute w-full truncate text-gray-400"
                    style={{
                      top: `${(labelDesign.subText.y / labelDesign.labelHeight) * 100}%`,
                      fontSize: `${labelDesign.subText.fontSize * 0.8}px`,
                      fontFamily: labelDesign.subText.fontFamily,
                      fontWeight: labelDesign.subText.bold ? "bold" : "normal",
                      textAlign: labelDesign.subText.align,
                      left: 0,
                      right: 0,
                      padding: "0 4px",
                    }}
                  >
                    {item.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiveLabelPage;
