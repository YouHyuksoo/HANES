"use client";

/**
 * @file src/app/(authenticated)/quality/inspect/page.tsx
 * @description 외관검사 페이지 - FG_BARCODE 스캔 → 외관검사 판정 등록
 *
 * 초보자 가이드:
 * 1. FG_BARCODE 스캔 → FG_LABELS에서 제품 정보 조회
 * 2. 합격/불합격 판정 → INSPECT_RESULTS 등록 + FG_LABELS.STATUS 업데이트
 * 3. 불합격 시 불량 체크리스트 (ComCode VISUAL_DEFECT)
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Eye, RefreshCw, Search, CheckCircle, XCircle, ScanLine, Maximize2, Minimize2, List,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import InspectFormPanel from "./components/InspectFormPanel";
import FgLabelSelectModal from "./components/FgLabelSelectModal";
import type { FgLabelInfo, VisualInspectRecord } from "./types";

export default function VisualInspectPage() {
  const { t } = useTranslation();
  const [inspectHistory, setInspectHistory] = useState<VisualInspectRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [scanInput, setScanInput] = useState("");
  const [scannedLabel, setScannedLabel] = useState<FgLabelInfo | null>(null);
  const [scanError, setScanError] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const panelAnimateRef = useRef(true);

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  const toggleMaximize = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  /** 외관검사 이력 조회 */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/inspect-results", {
        params: { inspectType: "VISUAL", limit: 500 },
      });
      setInspectHistory(res.data?.data ?? []);
    } catch { setInspectHistory([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const openInspectPanel = useCallback(async (barcode: string) => {
    setScanError("");
    try {
      const res = await api.get(`/quality/continuity-inspect/fg-label/${barcode}`);
      const label: FgLabelInfo = res.data?.data;
      if (!label) return;
      setScannedLabel(label);
      panelAnimateRef.current = !isPanelOpen;
      setIsPanelOpen(true);
    } catch {
      setScanError(t("quality.inspect.barcodeNotFound", "바코드를 찾을 수 없습니다"));
    }
  }, [isPanelOpen, t]);

  /** 바코드 스캔 처리 */
  const handleScan = useCallback(async () => {
    const barcode = scanInput.trim();
    if (!barcode) return;
    setScanInput("");
    await openInspectPanel(barcode);
  }, [scanInput, openInspectPanel]);

  const handleSelectLabel = useCallback((barcode: string) => {
    openInspectPanel(barcode);
  }, [openInspectPanel]);

  /** Enter 키로 스캔 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScan();
  }, [handleScan]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setScannedLabel(null);
    panelAnimateRef.current = true;
    scanRef.current?.focus();
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchHistory();
    scanRef.current?.focus();
  }, [fetchHistory]);

  const columns = useMemo<ColumnDef<VisualInspectRecord>[]>(() => [
    {
      accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode", "FG 바코드"),
      size: 150, meta: { filterType: "text" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="font-mono text-xs text-primary">{v}</span> : "-";
      },
    },
    {
      accessorKey: "passYn", header: t("quality.inspect.judgement", "판정"),
      size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "Y"
          ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4" />{t("quality.inspect.pass")}</span>
          : <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><XCircle className="w-4 h-4" />{t("quality.inspect.fail")}</span>;
      },
    },
    {
      accessorKey: "errorCode", header: t("quality.inspect.mainDefectCode", "불량코드"),
      size: 100, meta: { filterType: "text" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="text-red-500 font-mono text-xs">{v}</span> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "inspectAt", header: t("inspection.result.issuedAt", "검사시간"),
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
      },
    },
    {
      accessorKey: "inspectorId", header: t("quality.inspect.inspector", "검사원"),
      size: 100, cell: ({ getValue }) => getValue() || "-",
    },
  ], [t]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Eye className="w-7 h-7 text-primary" />{t("quality.inspect.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.inspect.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMaximize} title={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")} aria-label={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <Button variant="secondary" size="sm" onClick={fetchHistory}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
          </div>
        </div>

        {/* 바코드 스캔 입력 */}
        <Card className="flex-shrink-0">
          <CardContent>
            <div className="flex items-center gap-3">
              <ScanLine className="w-6 h-6 text-primary flex-shrink-0" />
              <Input
                ref={scanRef}
                placeholder={t("quality.inspect.scanPlaceholder", "FG 바코드를 스캔하세요")}
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanError(""); }}
                onKeyDown={handleKeyDown}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
                autoFocus
              />
              <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setIsSelectModalOpen(true)}>
                <List className="w-4 h-4 mr-1" />{t("common.select", "선택")}
              </Button>
            </div>
            {scanError && (
              <p className="mt-2 text-sm text-red-500">{scanError}</p>
            )}
          </CardContent>
        </Card>

        {/* 이력 DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={inspectHistory}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("quality.inspect.title")}
            
            sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 검사 등록 패널 */}
      <InspectFormPanel
        fgLabel={scannedLabel}
        onClose={handlePanelClose}
        onSave={handlePanelSave}
        animate={panelAnimateRef.current}
      />

      <FgLabelSelectModal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        onSelect={handleSelectLabel}
      />
    </div>
  );
}
