"use client";

/**
 * @file src/components/consumables/BarcodeScanPanel.tsx
 * @description 바코드 스캔 입고확정 패널
 *
 * 초보자 가이드:
 * 1. 바코드 스캐너로 conUid를 스캔하면 자동 입고 확정 (PENDING→ACTIVE)
 * 2. 최근 스캔 결과를 리스트로 보여줌
 * 3. 미입고(PENDING) UID 목록도 함께 표시
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScanBarcode, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface ScanResult {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  status: string;
  success: boolean;
  message?: string;
  scannedAt: string;
}

interface PendingStock {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  labelPrintedAt: string;
  vendorName: string | null;
}

export default function BarcodeScanPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [location, setLocation] = useState("");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
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

  const handleScan = async () => {
    const uid = scanValue.trim();
    if (!uid || isScanning) return;

    setIsScanning(true);
    try {
      const res = await api.post("/consumables/label/confirm", {
        conUid: uid,
        location: location || undefined,
      });
      const data = res.data;
      setScanResults((prev) => [
        {
          conUid: data.conUid,
          consumableCode: data.consumableCode,
          consumableName: data.consumableName,
          status: data.status,
          success: true,
          scannedAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      fetchPending();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? t("consumables.receiving.scanFail");
      setScanResults((prev) => [
        {
          conUid: uid,
          consumableCode: "-",
          consumableName: "-",
          status: "ERROR",
          success: false,
          message: msg,
          scannedAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } finally {
      setScanValue("");
      setIsScanning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  const successCount = scanResults.filter((r) => r.success).length;

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
          <ComCodeBadge groupCode="CON_CATEGORY" code={getValue() as string} />
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
          <div className="flex items-center gap-2 mb-4">
            <ScanBarcode className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-text">{t("consumables.receiving.scanTitle")}</h3>
            {successCount > 0 && (
              <span className="ml-auto text-sm text-green-600 dark:text-green-400 font-medium">
                {t("consumables.receiving.scanConfirmedCount", { count: successCount })}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={t("consumables.receiving.scanPlaceholder")}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<ScanBarcode className="w-4 h-4" />}
                autoFocus
                fullWidth
              />
            </div>
            <div className="w-48">
              <Input
                placeholder={t("consumables.receiving.locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                leftIcon={<MapPin className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <Button onClick={handleScan} disabled={!scanValue.trim() || isScanning} className="flex-shrink-0">
              {t("consumables.receiving.confirmBtn")}
            </Button>
          </div>

          {/* 최근 스캔 결과 */}
          {scanResults.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto border border-border rounded-[var(--radius)]">
              <table className="w-full text-sm">
                <thead className="bg-surface-alt sticky top-0">
                  <tr className="text-left text-text-muted">
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2">{t("consumables.receiving.scanResult")}</th>
                    <th className="px-3 py-2">{t("consumables.stock.conUid")}</th>
                    <th className="px-3 py-2">{t("consumables.comp.consumableCode")}</th>
                    <th className="px-3 py-2">{t("consumables.comp.consumableName")}</th>
                    <th className="px-3 py-2">{t("common.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.slice(0, 20).map((r, i) => (
                    <tr key={`${r.conUid}-${i}`} className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-muted">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        {r.success ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            {t("consumables.receiving.scanSuccess")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400" title={r.message}>
                            <XCircle className="w-4 h-4" />
                            {r.message || t("consumables.receiving.scanFail")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.conUid}</td>
                      <td className="px-3 py-1.5">{r.consumableCode}</td>
                      <td className="px-3 py-1.5">{r.consumableName}</td>
                      <td className="px-3 py-1.5 text-text-muted">{r.scannedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 미입고(PENDING) 목록 */}
      {pendingList.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-semibold text-text mb-3">
              {t("consumables.receiving.pendingTitle")}
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({pendingList.length}{t("common.count")})
              </span>
            </h3>
            <DataGrid
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
