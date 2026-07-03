"use client";

/**
 * @file apps/frontend/src/components/consumables/IssueScanPanel.tsx
 * @description 바코드 스캔 출고/출고취소 패널
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, Undo2 } from "lucide-react";
import { BarcodeScanInput, ProcessSelect } from "@/components/shared";
import { Card, CardContent, Button } from "@/components/ui";
import api from "@/services/api";

type ScanMode = "issue" | "issue-return";

interface IssueScanPanelProps {
  onScanSuccess?: () => void;
}

export default function IssueScanPanel({ onScanSuccess }: IssueScanPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [mode, setMode] = useState<ScanMode>("issue");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (mode === "issue" && processCode) inputRef.current?.focus();
  }, [mode, processCode]);

  const handleScan = async (rawUid?: string) => {
    const uid = (rawUid ?? scanValue).replace(/\r?\n|\r/g, "").trim();
    if (!uid || isScanning) return;

    setIsScanning(true);
    try {
      if (mode === "issue") {
        await api.post("/consumables/label/issue", {
          conUid: uid,
          processCode,
          issueReason: "PRODUCTION",
        });
      } else {
        await api.post("/consumables/label/issue-return", {
          conUid: uid,
        });
      }
      onScanSuccess?.();
    } catch {
      // API interceptor handles error modal
    } finally {
      setScanValue("");
      setIsScanning(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          {/* 모드 토글 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setMode("issue")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  mode === "issue"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("consumables.issuing.typeOut")}
              </button>
              <button
                type="button"
                onClick={() => setMode("issue-return")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  mode === "issue-return"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                {t("consumables.issuing.typeOutReturn")}
              </button>
            </div>
            {mode === "issue-return" && (
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                {t("consumables.issuing.returnScanHint", "출고취소 모드")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_auto] gap-3 items-end">
            <ProcessSelect
              label={t("consumables.issuing.processLabel", "출고 공정")}
              value={processCode}
              onChange={setProcessCode}
              fullWidth
              required={mode === "issue"}
              disabled={isScanning}
            />
            <div className="flex-1">
              <BarcodeScanInput
                ref={inputRef}
                placeholder={t("consumables.issuing.scanPlaceholder", "conUid 스캔 또는 입력")}
                value={scanValue}
                onChange={setScanValue}
                onScan={handleScan}
                autoFocus
                fullWidth
                disabled={isScanning || (mode === "issue" && !processCode)}
              />
            </div>
            <Button
              onClick={() => handleScan()}
              disabled={!scanValue.trim() || isScanning || (mode === "issue" && !processCode)}
              className="flex-shrink-0"
            >
              {mode === "issue"
                ? t("consumables.issuing.confirmBtn", "출고확정")
                : t("consumables.issuing.returnBtn", "취소확정")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
