"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ScanLine, RefreshCw, List, Maximize2, Minimize2,
} from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Card, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import StructureInspectPanel from "./components/StructureInspectPanel";
import FgLabelSelectModal from "./components/FgLabelSelectModal";
import type { FgLabelInfo, StructureInspectRecord } from "./types";
import { createStructureInspectGridColumns } from "./structureInspectColumns";

export default function StructureInspectPage() {
  const { t } = useTranslation();
  const [inspectHistory, setInspectHistory] = useState<StructureInspectRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [scanInput, setScanInput] = useState("");
  const [scannedLabel, setScannedLabel] = useState<FgLabelInfo | null>(null);
  const [scanError, setScanError] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

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

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/inspect-results", {
        params: { inspectType: "STRUCTURE", limit: 500 },
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
      setIsPanelOpen(true);
    } catch {
      setScanError(t("quality.inspect.barcodeNotFound", "바코드를 찾을 수 없습니다"));
    }
  }, [t]);

  const handleScan = useCallback(async (rawBarcode?: string) => {
    const barcode = (rawBarcode ?? scanInput).replace(/\r?\n|\r/g, "").trim();
    if (!barcode) return;
    setScanInput("");
    await openInspectPanel(barcode);
  }, [scanInput, openInspectPanel]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setScannedLabel(null);
    scanRef.current?.focus();
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchHistory();
    scanRef.current?.focus();
  }, [fetchHistory]);

  const handleSelectLabel = useCallback((barcode: string) => {
    openInspectPanel(barcode);
  }, [openInspectPanel]);

  const columns = useMemo(() => createStructureInspectGridColumns(t), [t]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ScanLine className="w-7 h-7 text-primary" />{t("inspection.structure.title", "구조검사")}
            </h1>
            <p className="text-text-muted mt-1">{t("inspection.structure.description", "저전압 공정 DIM'S/부재자누락 검사")}</p>
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

        <Card className="flex-shrink-0">
          <CardContent>
            <div className="flex items-center gap-3">
              <ScanLine className="w-6 h-6 text-primary flex-shrink-0" />
              <BarcodeScanInput
                ref={scanRef}
                placeholder={t("inspection.structure.scanPlaceholder", "FG 바코드를 스캔 또는 입력하세요")}
                value={scanInput}
                onChange={(value) => { setScanInput(value); setScanError(""); }}
                onScan={handleScan}
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

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={inspectHistory}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("inspection.structure.title", "구조검사")}

            sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE INSPECT_TYPE = 'STRUCTURE'\n  AND COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      <StructureInspectPanel
        fgLabel={scannedLabel}
        onClose={handlePanelClose}
        onSave={handlePanelSave}
        animate
      />

      <FgLabelSelectModal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        onSelect={handleSelectLabel}
      />
    </div>
  );
}
