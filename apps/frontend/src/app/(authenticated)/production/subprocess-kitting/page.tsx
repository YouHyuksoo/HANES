"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { GitMerge, Play, RefreshCw, Scan, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, Modal } from "@/components/ui";
import api from "@/services/api";

interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string;
}

interface MatLot {
  matUid: string;
  itemCode: string;
  qty: number;
}

interface KittingResult {
  resultNo: string;
  fgBarcodes: string[];
}

export default function SubprocessKittingPage() {
  const { t } = useTranslation();

  // form state
  const [orderNo, setOrderNo] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [equipCode, setEquipCode] = useState("");
  const [circuitNo, setCircuitNo] = useState("");

  // SG scan state
  const [sgInput, setSgInput] = useState("");
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [sgLoading, setSgLoading] = useState(false);

  // execute state
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<KittingResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  // warn modal state
  const [warnMessage, setWarnMessage] = useState("");
  const [warnModalOpen, setWarnModalOpen] = useState(false);

  const sgInputRef = useRef<HTMLInputElement>(null);

  const fetchSgLabel = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    // prevent duplicate scan
    if (sgList.some((item) => item.sgBarcode === trimmed)) {
      toast.error(t("production.kitting.alreadyScanned", "이미 스캔된 라벨입니다."));
      setSgInput("");
      return;
    }

    setSgLoading(true);
    try {
      const res = await api.get(`/production/subprocess-kitting/sg-label/${encodeURIComponent(trimmed)}`);
      const data = res.data?.data as SgLabelInfo;

      if (data.remainQty <= 0) {
        setWarnMessage(t("production.kitting.warnZeroQty"));
        setWarnModalOpen(true);
        setSgInput("");
        return;
      }

      // 키팅 소비 가능 상태만 허용 — 백엔드 kit() 및 SG_LABELS enum 기준(IN_STOCK/MOUNTED).
      // (CONSUMED/DEFECT 등은 소비 불가)
      const validStatuses = ["IN_STOCK", "MOUNTED"];
      if (!validStatuses.includes(data.status?.toUpperCase())) {
        setWarnMessage(`${t("production.kitting.warnInvalidStatus")} (${data.status})`);
        setWarnModalOpen(true);
        setSgInput("");
        return;
      }

      setSgList((prev) => [...prev, data]);
      setSgInput("");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("production.kitting.sgLabelLookupFailed", "SG 라벨 조회에 실패했습니다.");
      toast.error(message);
      setSgInput("");
    } finally {
      setSgLoading(false);
      sgInputRef.current?.focus();
    }
  }, [sgList, t]);

  const removeSg = (sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  };

  const resetForm = () => {
    setOrderNo("");
    setProcessCode("");
    setQty("");
    setEquipCode("");
    setCircuitNo("");
    setSgList([]);
    setSgInput("");
    setResult(null);
    sgInputRef.current?.focus();
  };

  const executeKitting = async () => {
    if (!orderNo.trim()) {
      toast.error(t("production.kitting.requireOrderNo", "작업지시번호를 입력하세요."));
      return;
    }
    if (!processCode.trim()) {
      toast.error(t("production.kitting.requireProcessCode", "서브공정코드를 입력하세요."));
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast.error(t("production.kitting.requireQty", "발행수량을 입력하세요."));
      return;
    }
    if (sgList.length === 0) {
      toast.error(t("production.kitting.requireSgLabel", "SG 추적라벨을 하나 이상 스캔하세요."));
      return;
    }

    setExecuting(true);
    try {
      const payload: {
        orderNo: string;
        processCode: string;
        qty: number;
        sgBarcodes: string[];
        matLots?: MatLot[];
        equipCode?: string;
        circuitNo?: string;
      } = {
        orderNo: orderNo.trim(),
        processCode: processCode.trim(),
        qty: Number(qty),
        sgBarcodes: sgList.map((item) => item.sgBarcode),
      };
      if (equipCode.trim()) payload.equipCode = equipCode.trim();
      if (circuitNo.trim()) payload.circuitNo = circuitNo.trim();

      const res = await api.post("/production/subprocess-kitting", payload);
      const data = res.data?.data as KittingResult;
      setResult(data);
      setResultModalOpen(true);
      toast.success(t("production.kitting.executeSuccess"));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.kitting.executeFailed");
      toast.error(message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitMerge className="w-7 h-7 text-primary" />
            {t("production.kitting.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("production.kitting.description")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={resetForm} leftIcon={<RefreshCw className="w-4 h-4" />}>
          {t("common.reset")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-auto">
        {/* Input Form */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">{t("common.register")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Input
                label={t("production.kitting.orderNo")}
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="W-20260001"
                fullWidth
              />
              <Input
                label={t("production.kitting.processCode")}
                value={processCode}
                onChange={(e) => setProcessCode(e.target.value)}
                placeholder="SUB-CRIMP"
                fullWidth
              />
              <Input
                label={t("production.kitting.qty")}
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="1"
                fullWidth
              />
              <Input
                label={`${t("production.kitting.equipCode")} (${t("common.select")})`}
                value={equipCode}
                onChange={(e) => setEquipCode(e.target.value)}
                placeholder={t("production.kitting.optional", "선택 사항")}
                fullWidth
              />
              <Input
                label={`${t("production.kitting.circuitNo")} (${t("common.select")})`}
                value={circuitNo}
                onChange={(e) => setCircuitNo(e.target.value)}
                placeholder={t("production.kitting.optional", "선택 사항")}
                fullWidth
              />
            </div>
          </CardContent>
        </Card>

        {/* SG Scan */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">{t("production.kitting.sgBarcode")}</h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  ref={sgInputRef}
                  label={t("production.kitting.sgBarcodePlaceholder")}
                  value={sgInput}
                  onChange={(e) => setSgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fetchSgLabel(sgInput);
                    }
                  }}
                  disabled={sgLoading}
                  leftIcon={<Scan className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fetchSgLabel(sgInput)}
                isLoading={sgLoading}
                className="mb-0.5"
              >
                {t("common.search")}
              </Button>
            </div>

            {/* SG List */}
            {sgList.length > 0 && (
              <div className="mt-3 border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr className="text-text-muted text-xs">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("production.kitting.sgBarcode")}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("production.kitting.sgItemCode")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("production.kitting.sgRemainQty")}</th>
                      <th className="px-3 py-2 text-center font-semibold">{t("production.kitting.sgStatus")}</th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sgList.map((item, index) => (
                      <tr key={item.sgBarcode} className="border-b border-border/70 hover:bg-surface/60">
                        <td className="px-3 py-2 text-text-muted text-xs">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sgBarcode}</td>
                        <td className="px-3 py-2 text-xs">{item.itemCode}</td>
                        <td className="px-3 py-2 text-right text-xs">{item.remainQty != null ? item.remainQty.toLocaleString() : "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            onClick={() => removeSg(item.sgBarcode)}
                            title={t("common.delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sgList.length === 0 && (
              <p className="mt-3 text-sm text-text-muted text-center py-4 border border-dashed border-border rounded">
                {t("common.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Execute Button */}
        <div className="flex justify-end flex-shrink-0">
          <Button
            size="lg"
            onClick={executeKitting}
            isLoading={executing}
            disabled={sgList.length === 0}
            leftIcon={<Play className="w-5 h-5" />}
          >
            {t("production.kitting.execute")}
          </Button>
        </div>
      </div>

      {/* Warn Modal */}
      <Modal
        isOpen={warnModalOpen}
        onClose={() => setWarnModalOpen(false)}
        title={t("common.error")}
        size="md"
        footer={(
          <Button onClick={() => { setWarnModalOpen(false); sgInputRef.current?.focus(); }}>
            {t("common.confirm")}
          </Button>
        )}
      >
        <p className="text-sm text-text">{warnMessage}</p>
      </Modal>

      {/* Result Modal */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => { setResultModalOpen(false); resetForm(); }}
        title={t("production.kitting.result")}
        size="lg"
        footer={(
          <Button onClick={() => { setResultModalOpen(false); resetForm(); }}>
            {t("common.confirm")}
          </Button>
        )}
      >
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-text-muted">{t("production.kitting.resultNo")}:</span>
              <span className="font-mono text-text">{result.resultNo}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-muted mb-2">{t("production.kitting.fgBarcodes")}</p>
              <div className="border border-border rounded divide-y divide-border max-h-60 overflow-auto">
                {result.fgBarcodes.map((barcode, index) => (
                  <div key={barcode} className="px-3 py-2 flex items-center gap-3">
                    <span className="text-xs text-text-muted w-6 text-right">{index + 1}</span>
                    <span className="font-mono text-sm text-text">{barcode}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
