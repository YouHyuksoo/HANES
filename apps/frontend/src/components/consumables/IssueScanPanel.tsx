"use client";

/**
 * @file apps/frontend/src/components/consumables/IssueScanPanel.tsx
 * @description 바코드 스캔 출고/출고취소 패널
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScanBarcode, LogOut, Undo2 } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import api from "@/services/api";

type ScanMode = "issue" | "issue-return";

interface IssueScanPanelProps {
  onScanSuccess?: () => void;
}

export default function IssueScanPanel({ onScanSuccess }: IssueScanPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [mode, setMode] = useState<ScanMode>("issue");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async () => {
    const uid = scanValue.trim();
    if (!uid || isScanning) return;

    setIsScanning(true);
    try {
      if (mode === "issue") {
        await api.post("/consumables/label/issue", {
          conUid: uid,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
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

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={t("consumables.issuing.scanPlaceholder", "conUid 스캔 또는 입력")}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<ScanBarcode className="w-4 h-4" />}
                autoFocus
                fullWidth
              />
            </div>
            <Button onClick={handleScan} disabled={!scanValue.trim() || isScanning} className="flex-shrink-0">
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
