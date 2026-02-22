"use client";

/**
 * @file src/app/(authenticated)/interface/manual/page.tsx
 * @description ERP 인터페이스 수동 전송 페이지
 *
 * 초보자 가이드:
 * 1. **수동 전송**: ERP↔MES 간 수동 데이터 전송
 * 2. **Inbound**: 작업지시, BOM, 품목 동기화 (ERP→MES)
 * 3. **Outbound**: 생산실적, 재고 동기화 (MES→ERP)
 * 4. API: POST /interface/manual-transfer
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Send, RefreshCw, ArrowDownCircle, ArrowUpCircle, FileText, Package, Clipboard, Database } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

interface TransferOption {
  id: string;
  direction: string;
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export default function InterfaceManualPage() {
  const { t } = useTranslation();

  const inboundOptions: TransferOption[] = useMemo(() => [
    {
      id: "job_order", direction: "IN", type: "JOB_ORDER",
      name: t("interface.manual.optJobOrder"),
      description: t("interface.manual.optJobOrderDesc"),
      icon: <FileText className="w-6 h-6" />,
    },
    {
      id: "bom_sync", direction: "IN", type: "BOM_SYNC",
      name: t("interface.manual.optBomSync"),
      description: t("interface.manual.optBomSyncDesc"),
      icon: <Clipboard className="w-6 h-6" />,
    },
    {
      id: "part_sync", direction: "IN", type: "PART_SYNC",
      name: t("interface.manual.optPartSync"),
      description: t("interface.manual.optPartSyncDesc"),
      icon: <Database className="w-6 h-6" />,
    },
  ], [t]);

  const outboundOptions: TransferOption[] = useMemo(() => [
    {
      id: "prod_result", direction: "OUT", type: "PROD_RESULT",
      name: t("interface.manual.optProdResult"),
      description: t("interface.manual.optProdResultDesc"),
      icon: <Package className="w-6 h-6" />,
    },
    {
      id: "stock_sync", direction: "OUT", type: "STOCK_SYNC",
      name: t("interface.manual.optStockSync"),
      description: t("interface.manual.optStockSyncDesc"),
      icon: <Database className="w-6 h-6" />,
    },
  ], [t]);

  const [selectedOption, setSelectedOption] = useState<TransferOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [params, setParams] = useState({ dateStart: "", dateEnd: "", scope: "all" });

  const handleTransfer = async () => {
    if (!selectedOption) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const res = await api.post("/interface/manual-transfer", {
        direction: selectedOption.direction,
        type: selectedOption.type,
        ...params,
      });
      setResult({ success: true, message: res.data?.message || t("interface.manual.resultSuccess", { name: selectedOption.name, count: res.data?.count ?? 0 }) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("interface.manual.resultError");
      setResult({ success: false, message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Send className="w-7 h-7 text-primary" />{t("interface.manual.title")}</h1>
          <p className="text-text-muted mt-1">{t("interface.manual.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Inbound 옵션 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="w-5 h-5 text-blue-500" /><span className="font-medium text-text">{t("interface.manual.inboundSection")}</span></div>
            <p className="text-sm text-text-muted mb-3">{t("interface.manual.inboundDesc")}</p>
            <div className="space-y-3">
              {inboundOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => { setSelectedOption(option); setResult(null); }}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedOption?.id === option.id
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedOption?.id === option.id ? "bg-primary text-white" : "bg-surface text-primary"}`}>
                      {option.icon}
                    </div>
                    <div>
                      <p className="font-medium text-text">{option.name}</p>
                      <p className="text-sm text-text-muted mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Outbound 옵션 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="w-5 h-5 text-purple-500" /><span className="font-medium text-text">{t("interface.manual.outboundSection")}</span></div>
            <p className="text-sm text-text-muted mb-3">{t("interface.manual.outboundDesc")}</p>
            <div className="space-y-3">
              {outboundOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => { setSelectedOption(option); setResult(null); }}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedOption?.id === option.id
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedOption?.id === option.id ? "bg-primary text-white" : "bg-surface text-primary"}`}>
                      {option.icon}
                    </div>
                    <div>
                      <p className="font-medium text-text">{option.name}</p>
                      <p className="text-sm text-text-muted mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 선택된 옵션 상세 */}
      {selectedOption && (
        <Card>
          <CardContent>
            <div className="font-medium text-text mb-1">{t("interface.manual.executeTitle", { name: selectedOption.name })}</div>
            <p className="text-sm text-text-muted mb-4">{selectedOption.description}</p>
            <div className="space-y-4">
              {selectedOption.type === "JOB_ORDER" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label={t("interface.manual.planDateStart")} type="date" value={params.dateStart} onChange={(e) => setParams((p) => ({ ...p, dateStart: e.target.value }))} fullWidth />
                  <Input label={t("interface.manual.planDateEnd")} type="date" value={params.dateEnd} onChange={(e) => setParams((p) => ({ ...p, dateEnd: e.target.value }))} fullWidth />
                </div>
              )}

              {selectedOption.type === "PROD_RESULT" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label={t("interface.manual.prodDateStart")} type="date" value={params.dateStart} onChange={(e) => setParams((p) => ({ ...p, dateStart: e.target.value }))} fullWidth />
                  <Input label={t("interface.manual.prodDateEnd")} type="date" value={params.dateEnd} onChange={(e) => setParams((p) => ({ ...p, dateEnd: e.target.value }))} fullWidth />
                  <Select
                    label={t("interface.manual.transferScope")}
                    options={[
                      { value: "all", label: t("interface.manual.scopeAll") },
                      { value: "today", label: t("interface.manual.scopeToday") },
                      { value: "selected", label: t("interface.manual.scopeSelected") },
                    ]}
                    value={params.scope}
                    onChange={(val) => setParams((p) => ({ ...p, scope: val }))}
                    fullWidth
                  />
                </div>
              )}

              {selectedOption.type === "BOM_SYNC" && (
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-text-muted">{t("interface.manual.bomSyncInfo")}</p>
                </div>
              )}

              {selectedOption.type === "PART_SYNC" && (
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-text-muted">{t("interface.manual.partSyncInfo")}</p>
                </div>
              )}

              {selectedOption.type === "STOCK_SYNC" && (
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-text-muted">{t("interface.manual.optStockSyncDesc")}</p>
                </div>
              )}

              {/* 결과 메시지 */}
              {result && (
                <div className={`p-4 rounded-lg ${
                  result.success
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}>
                  <p className={`text-sm ${result.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                    {result.message}
                  </p>
                </div>
              )}

              {/* 실행 버튼 */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => { setSelectedOption(null); setResult(null); }}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleTransfer} disabled={isProcessing}>
                  {isProcessing ? (
                    <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> {t("interface.manual.processing")}</>
                  ) : (
                    <><Send className="w-4 h-4 mr-1" /> {t("interface.manual.execute")}</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
