"use client";

/**
 * @file src/components/consumables/BarcodeScanPanel.tsx
 * @description 바코드 스캔 입고/반납 패널
 *
 * 초보자 가이드:
 * 1. 바코드 스캐너로 conUid를 스캔하면 자동 입고 확정 (PENDING→ACTIVE)
 * 2. 모드를 반납으로 전환하면 입고반납(IN_RETURN) 처리
 * 3. 미입고(PENDING) UID 목록도 함께 표시
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownToLine, Undo2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, Input, Button, Select } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useLocationOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

type ScanMode = "receiving" | "return";

interface PendingStock {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  labelPrintedAt: string;
  vendorName: string | null;
}

interface BarcodeScanPanelProps {
  onScanSuccess?: () => void;
}

export default function BarcodeScanPanel({ onScanSuccess }: BarcodeScanPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [mode, setMode] = useState<ScanMode>("receiving");
  const [location, setLocation] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const { options: locationOptions, isLoading: locationLoading } = useLocationOptions();
  const [pendingList, setPendingList] = useState<PendingStock[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get("/consumables/label/pending");
      setPendingList(res.data ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (rawUid?: string) => {
    const uid = (rawUid ?? scanValue).replace(/\r?\n|\r/g, "").trim();
    if (!uid || isScanning) return;

    setIsScanning(true);
    try {
      if (mode === "receiving") {
        await api.post("/consumables/label/confirm", {
          conUid: uid,
          location: location || undefined,
        });
      } else {
        await api.post("/consumables/label/return", {
          conUid: uid,
          returnReason: returnReason || undefined,
        });
      }
      fetchPending();
      onScanSuccess?.();
    } catch {
      // API interceptor handles error modal
    } finally {
      setScanValue("");
      setReturnReason("");
      setIsScanning(false);
      inputRef.current?.focus();
    }
  };

  const pendingColumns = useMemo<ColumnDef<PendingStock>[]>(
    () => [
      { accessorKey: "conUid", header: t("consumables.stock.conUid"), size: 150 },
      { accessorKey: "consumableCode", header: t("consumables.comp.consumableCode"), size: 120 },
      { accessorKey: "consumableName", header: t("consumables.comp.consumableName"), size: 150 },
      {
        accessorKey: "category",
        header: t("consumables.comp.category"),
        size: 90,
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} />
        ),
      },
      { accessorKey: "labelPrintedAt", header: t("consumables.receiving.labelPrintedAt"), size: 140 },
      { accessorKey: "vendorName", header: t("consumables.comp.vendorName"), size: 120 },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      {/* 스캔 입력 영역 */}
      <Card>
        <CardContent>
          {/* 모드 토글 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setMode("receiving")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  mode === "receiving"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                {t("consumables.receiving.typeIn")}
              </button>
              <button
                type="button"
                onClick={() => setMode("return")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  mode === "return"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                {t("consumables.receiving.typeInReturn")}
              </button>
            </div>
            {mode === "return" && (
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                {t("consumables.receiving.returnScanHint", "반납입고 모드")}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <BarcodeScanInput
                ref={inputRef}
                placeholder={t("consumables.receiving.scanPlaceholder")}
                value={scanValue}
                onChange={setScanValue}
                onScan={handleScan}
                autoFocus
                fullWidth
              />
            </div>
            {mode === "receiving" && (
              <div className="w-48">
                <Select
                  placeholder={t("consumables.receiving.locationPlaceholder")}
                  options={locationOptions}
                  value={location}
                  onChange={setLocation}
                  disabled={locationLoading}
                  fullWidth
                />
              </div>
            )}
            {mode === "return" && (
              <div className="w-48">
                <Input
                  placeholder={t("consumables.receiving.returnReasonPlaceholder")}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  fullWidth
                />
              </div>
            )}
            <Button onClick={() => handleScan()} disabled={!scanValue.trim() || isScanning} className="flex-shrink-0">
              {mode === "receiving"
                ? t("consumables.receiving.confirmBtn")
                : t("consumables.receiving.returnBtn", "반납확정")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 미입고(PENDING) 목록 — 입고 모드에서만 표시 */}
      {mode === "receiving" && pendingList.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-semibold text-text mb-3">
              {t("consumables.receiving.pendingTitle")}
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({pendingList.length}{t("common.count")})
              </span>
            </h3>
            <DataGrid
      sqlQuery={`SELECT *\nFROM CONSUMABLE_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
              data={pendingList}
              columns={pendingColumns}
              pageSize={5}
              maxHeight="250px"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
