"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckCircle, Package, Play, Printer, RefreshCw, Scan, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Select, Modal, ComCodeBadge } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "./components/JobOrderSearchModal";
import SgLabelPrintHost, { type SgLabelPrintHandle } from "../input-kiosk/components/SgLabelPrintHost";

interface SgLabelRow {
  sgBarcode: string;
  itemCode: string;
  initQty: number;
  remainQty: number;
  status: string;
  issuedAt: string;
}

interface SubmitResult {
  resultNo: string;
  sgLabels: SgLabelRow[];
}

export default function SubprocessKittingPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [goodQty, setGoodQty] = useState<number>(1);
  const [bundleCount, setBundleCount] = useState<number>(1);
  const [qtyPerBundle, setQtyPerBundle] = useState<number>(0);

  const [executing, setExecuting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgPrinterRef = useRef<SgLabelPrintHandle>(null);

  const { options: rawProcessOptions } = useProcessOptions();
  const { options: rawEquipOptions } = useEquipOptions(processCode || undefined);

  const processOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectProcess", "공정 선택") }, ...rawProcessOptions],
    [rawProcessOptions, t],
  );
  const equipOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectEquipOptional", "설비 선택 (선택)") }, ...rawEquipOptions],
    [rawEquipOptions, t],
  );

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setGoodQty(order.planQty ?? 1);
  }, []);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      const trimmed = no.trim();
      if (!trimmed) return;
      if (/^(FG|SG)\d/i.test(trimmed)) {
        toast.error(t("production.subprocess.scanIsLabel", "바코드 라벨입니다. 작업지시번호를 입력하거나 검색 버튼을 이용하세요."));
        return;
      }
      try {
        const res = await api.get("/production/job-orders", {
          params: { limit: 20, search: trimmed, itemType: "SEMI_PRODUCT" },
        });
        const list: JobOrderPick[] = Array.isArray(res.data?.data) ? res.data.data : [];
        const found = list.find((r) => r.orderNo === trimmed) ?? list[0];
        if (found) {
          selectOrder(found);
        } else {
          toast.error(t("production.subprocess.orderNotFound", "작업지시를 찾을 수 없습니다."));
        }
      } catch {
        toast.error(t("production.subprocess.orderNotFound", "작업지시를 찾을 수 없습니다."));
      }
    },
    [selectOrder, t],
  );

  const clearOrder = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setProcessCode("");
    setEquipCode("");
    setGoodQty(1);
    setBundleCount(1);
    setQtyPerBundle(0);
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetForm = () => {
    clearOrder();
    setSubmitResult(null);
  };

  const executeSubmit = async () => {
    if (!selectedOrder) {
      toast.error(t("production.subprocess.requireOrderNo", "작업지시를 선택하세요."));
      return;
    }
    if (!processCode) {
      toast.error(t("production.subprocess.requireProcess", "공정을 선택하세요."));
      return;
    }
    if (!goodQty || goodQty <= 0) {
      toast.error(t("production.subprocess.requireQty", "양품 수량을 입력하세요."));
      return;
    }

    setExecuting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: selectedOrder.orderNo,
        processCode,
        goodQty,
      };
      if (equipCode.trim()) payload.equipCode = equipCode.trim();
      if (bundleCount > 0) payload.bundleCount = bundleCount;
      if (qtyPerBundle > 0) payload.qtyPerBundle = qtyPerBundle;

      const res = await api.post("/production/prod-results", payload);
      const resultNo: string = res.data?.data?.resultNo ?? "";

      let sgLabels: SgLabelRow[] = [];
      if (resultNo) {
        try {
          const sgRes = await api.get(
            `/production/subprocess-kitting/sg-labels-by-result/${encodeURIComponent(resultNo)}`,
          );
          sgLabels = Array.isArray(sgRes.data?.data) ? (sgRes.data.data as SgLabelRow[]) : [];
        } catch {
          // SG 조회 실패해도 실적 등록은 성공으로 처리
        }
      }

      setSubmitResult({ resultNo, sgLabels });
      setResultModalOpen(true);
      toast.success(t("production.subprocess.submitSuccess", "서브공정 실적이 등록되었습니다."));

      // 발행공정이면 발행된 SG 라벨을 키오스크와 동일하게 Print Agent로 자동 출력(발행분 없으면 무동작).
      if (resultNo && sgLabels.length > 0) {
        void sgPrinterRef.current?.printByResultNo(resultNo);
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.subprocess.submitFailed", "실적 등록에 실패했습니다.");
      toast.error(message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in bg-background">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            {t("production.kitting.title", "실적입력(서브공정)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t(
              "production.kitting.description",
              "반제품 서브공정 실적을 등록하고 SG 추적라벨을 발행합니다.",
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetForm}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-auto">
        {/* 작업지시 선택 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.subprocess.orderSection", "작업지시 (반제품)")}
            </h2>
            {selectedOrder ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
                <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.subprocess.orderNo", "작업지시번호")}
                    </div>
                    <div className="font-mono text-text">{selectedOrder.orderNo}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-text-muted">{t("common.partName", "품목")}</div>
                    <div className="truncate text-text">
                      {selectedOrder.itemCode}
                      {selectedOrder.itemName ? ` · ${selectedOrder.itemName}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.subprocess.planQty", "계획수량")}
                    </div>
                    <div className="tabular-nums text-text">
                      {(selectedOrder.planQty ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">{t("common.status", "상태")}</div>
                    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedOrder.status} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={clearOrder}>
                  {t("common.change", "변경")}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    ref={orderScanRef}
                    label={t(
                      "production.subprocess.orderScanLabel",
                      "작업지시번호 스캔 또는 입력 후 Enter",
                    )}
                    value={orderScan}
                    onChange={(e) => setOrderScan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        fetchOrderByNo(orderScan);
                      }
                    }}
                    placeholder="W-20260001"
                    leftIcon={<Scan className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOrderSearchOpen(true)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="mb-0.5"
                >
                  {t("common.search")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 실적 입력 폼 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.subprocess.resultSection", "실적 입력")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Select
                label={t("production.subprocess.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <Select
                label={`${t("production.subprocess.equip", "설비")} (${t("production.subprocess.optional", "선택")})`}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.subprocess.goodQty", "양품 수량")}
                value={goodQty}
                onChange={setGoodQty}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.subprocess.bundleCount", "묶음 수")}
                value={bundleCount}
                onChange={setBundleCount}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={`${t("production.subprocess.qtyPerBundle", "묶음당 가닥")} (${t("production.subprocess.optional", "선택")})`}
                value={qtyPerBundle}
                onChange={setQtyPerBundle}
                disabled={!selectedOrder}
                fullWidth
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button
                size="lg"
                onClick={executeSubmit}
                isLoading={executing}
                disabled={!selectedOrder || !processCode}
                leftIcon={<Play className="w-5 h-5" />}
              >
                {t("production.subprocess.submit", "실적 등록")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작업지시 검색 모달 — SEMI_PRODUCT 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="SEMI_PRODUCT"
      />

      {/* 결과 모달 */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => {
          setResultModalOpen(false);
          resetForm();
        }}
        title={t("production.subprocess.resultTitle", "서브공정 실적 등록 완료")}
        size="lg"
        footer={
          <Button
            onClick={() => {
              setResultModalOpen(false);
              resetForm();
            }}
          >
            {t("common.confirm")}
          </Button>
        }
      >
        {submitResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-text-muted">
                {t("production.subprocess.resultNo", "실적번호")}:
              </span>
              <span className="font-mono text-text">{submitResult.resultNo}</span>
            </div>
            {submitResult.sgLabels.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-text-muted">
                    {t("production.subprocess.issuedSgLabels", "발행된 SG 추적라벨")} (
                    {submitResult.sgLabels.length}건)
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void sgPrinterRef.current?.printByResultNo(submitResult.resultNo)}
                    leftIcon={<Printer className="w-4 h-4" />}
                  >
                    {t("production.subprocess.reprintSgLabels", "라벨 재출력")}
                  </Button>
                </div>
                <div className="border border-border rounded divide-y divide-border max-h-60 overflow-auto">
                  {submitResult.sgLabels.map((sg, index) => (
                    <div key={sg.sgBarcode} className="px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-text-muted w-6 text-right">{index + 1}</span>
                      <span className="font-mono text-sm text-text flex-1">{sg.sgBarcode}</span>
                      <span className="text-xs text-text-muted">{sg.initQty}개</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {t(
                  "production.subprocess.noSgLabels",
                  "이 공정에서는 SG 라벨이 발행되지 않습니다. ROUTING_PROCESSES의 ISSUE_SG_LABEL_YN='Y' 설정을 확인하세요.",
                )}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* SG(반제품) 라벨 자동 출력 호스트 — 키오스크와 동일, 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
