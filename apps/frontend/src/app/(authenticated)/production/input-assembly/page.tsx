"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Boxes, CheckCircle, Play, RefreshCw, Scan, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, Select, Modal, ComCodeBadge } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "../subprocess-kitting/components/JobOrderSearchModal";

interface AssemblyComponent {
  itemCode: string;
  itemName: string;
  itemType: string;
  qtyPer: number;
  totalRequired: number;
}

interface AssemblyRequirements {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  components: AssemblyComponent[];
}

interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
}

interface AssemblyResult {
  resultNo: string;
  fgBarcodes: string[];
}

export default function InputAssemblyPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [qty, setQty] = useState<number | "">(1);
  const [circuitNo, setCircuitNo] = useState("");

  const [sgInput, setSgInput] = useState("");
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [sgLoading, setSgLoading] = useState(false);

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AssemblyResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  const [warnMessage, setWarnMessage] = useState("");
  const [warnModalOpen, setWarnModalOpen] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgInputRef = useRef<HTMLInputElement>(null);

  const { options: rawProcessOptions } = useProcessOptions();
  const { options: rawEquipOptions } = useEquipOptions(processCode || undefined);

  const processOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectProcess", "공정 선택") }, ...rawProcessOptions],
    [rawProcessOptions, t],
  );
  const equipOptions = useMemo(
    () => [
      { value: "", label: t("production.inputAssembly.equip", "설비") + " (" + t("production.subprocess.optional", "선택") + ")" },
      ...rawEquipOptions,
    ],
    [rawEquipOptions, t],
  );

  // 작업지시 선택 시 BOM 요구사항 조회
  useEffect(() => {
    if (!selectedOrder) {
      setRequirements(null);
      return;
    }
    let cancelled = false;
    setRequirementsLoading(true);
    api
      .get(
        `/production/subprocess-kitting/assembly-requirements/${encodeURIComponent(selectedOrder.orderNo)}`,
      )
      .then((res) => {
        if (!cancelled) setRequirements(res.data?.data as AssemblyRequirements);
      })
      .catch(() => {
        if (!cancelled)
          toast.error(
            t("production.inputAssembly.requirementsLoadFailed", "조립 요구사항 조회에 실패했습니다."),
          );
      })
      .finally(() => {
        if (!cancelled) {
          setRequirementsLoading(false);
          sgInputRef.current?.focus();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder, t]);

  const fetchSgLabel = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;

      if (sgList.some((item) => item.sgBarcode === trimmed)) {
        toast.error(t("production.inputAssembly.scanDuplicate", "이미 스캔된 라벨입니다."));
        setSgInput("");
        return;
      }

      setSgLoading(true);
      try {
        const res = await api.get(
          `/production/subprocess-kitting/sg-label/${encodeURIComponent(trimmed)}`,
        );
        const data = res.data?.data as SgLabelInfo;

        if (data.remainQty <= 0) {
          setWarnMessage(t("production.kitting.warnZeroQty", "잔량이 없는 SG 라벨입니다."));
          setWarnModalOpen(true);
          setSgInput("");
          return;
        }

        const validStatuses = ["IN_STOCK", "MOUNTED"];
        if (!validStatuses.includes(data.status?.toUpperCase())) {
          setWarnMessage(
            `${t("production.kitting.warnInvalidStatus", "사용할 수 없는 SG 라벨 상태입니다.")} (${data.status})`,
          );
          setWarnModalOpen(true);
          setSgInput("");
          return;
        }

        setSgList((prev) => [...prev, data]);
        setSgInput("");
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.inputAssembly.scanNotFound", "SG 라벨을 찾을 수 없습니다.");
        toast.error(message);
        setSgInput("");
      } finally {
        setSgLoading(false);
        sgInputRef.current?.focus();
      }
    },
    [sgList, t],
  );

  const removeSg = (sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  };

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setSgList([]);
    setSgInput("");
    setQty(order.planQty ?? 1);
  }, []);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      const trimmed = no.trim();
      if (!trimmed) return;
      try {
        const res = await api.get("/production/job-orders", {
          params: { limit: 20, search: trimmed, itemType: "FINISHED" },
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
    setRequirements(null);
    setSgList([]);
    setSgInput("");
    setQty(1);
    setProcessCode("");
    setEquipCode("");
    setCircuitNo("");
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetForm = () => {
    clearOrder();
    setResult(null);
  };

  // BOM 요구사항 대비 스캔 잔량 집계
  const sgProgressByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const sg of sgList) {
      map.set(sg.itemCode, (map.get(sg.itemCode) ?? 0) + sg.remainQty);
    }
    return map;
  }, [sgList]);

  const executeAssembly = async () => {
    if (!selectedOrder) {
      toast.error(t("production.inputAssembly.requireOrder", "작업지시를 선택하세요."));
      return;
    }
    if (!processCode) {
      toast.error(t("production.subprocess.requireProcess", "공정을 선택하세요."));
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast.error(t("production.subprocess.requireQty", "수량을 입력하세요."));
      return;
    }
    if (sgList.length === 0) {
      toast.error(t("production.inputAssembly.requireScan", "SG 라벨을 스캔하세요."));
      return;
    }

    setExecuting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: selectedOrder.orderNo,
        processCode,
        qty: Number(qty),
        sgBarcodes: sgList.map((item) => item.sgBarcode),
      };
      if (equipCode.trim()) payload.equipCode = equipCode.trim();
      if (circuitNo.trim()) payload.circuitNo = circuitNo.trim();

      const res = await api.post("/production/subprocess-kitting", payload);
      const data = res.data?.data as AssemblyResult;
      setResult(data);
      setResultModalOpen(true);
      toast.success(t("production.inputAssembly.executeSuccess", "조립이 완료되었습니다."));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.inputAssembly.executeFailed", "조립 실행에 실패했습니다.");
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
            <Boxes className="w-7 h-7 text-primary" />
            {t("production.inputAssembly.title", "실적입력(조립)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("production.inputAssembly.description", "반제품 SG 라벨을 스캔하여 완제품을 조립합니다.")}
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
              {t("production.inputAssembly.orderSection", "작업지시 (완제품)")}
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
                    label={t("production.subprocess.orderScanLabel", "작업지시번호 스캔 또는 입력 후 Enter")}
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

        {/* BOM 요구사항 패널 */}
        {selectedOrder && (
          <Card padding="none" className="flex-shrink-0">
            <CardContent className="p-4">
              <h2 className="font-bold text-text mb-3">
                {t("production.inputAssembly.bomSection", "조립 요구사항")}
              </h2>
              {requirementsLoading ? (
                <p className="text-sm text-text-muted text-center py-4">
                  {t("common.loading", "조회 중...")}
                </p>
              ) : requirements && requirements.components.length > 0 ? (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface border-b border-border">
                      <tr className="text-text-muted text-xs">
                        <th className="px-3 py-2 text-left font-semibold">
                          {t("common.itemCode", "품번")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {t("common.itemName", "품명")}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {t("production.inputAssembly.qtyPer", "단위당 수량")}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {t("production.inputAssembly.totalRequired", "총 필요")}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {t("production.inputAssembly.scannedList", "스캔된 SG 라벨")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {t("production.inputAssembly.fulfilled", "충족")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.components.map((comp) => {
                        const scanned = sgProgressByItem.get(comp.itemCode) ?? 0;
                        const fulfilled = scanned >= comp.totalRequired;
                        return (
                          <tr
                            key={comp.itemCode}
                            className="border-b border-border/70 hover:bg-surface/60"
                          >
                            <td className="px-3 py-2 font-mono text-xs">{comp.itemCode}</td>
                            <td className="px-3 py-2 text-xs">{comp.itemName}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums">
                              {comp.qtyPer.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums">
                              {comp.totalRequired.toLocaleString()}
                            </td>
                            <td
                              className={`px-3 py-2 text-right text-xs tabular-nums font-semibold ${fulfilled ? "text-green-600" : "text-orange-500"}`}
                            >
                              {scanned.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {fulfilled ? (
                                <CheckCircle className="w-4 h-4 text-green-500 inline-block" />
                              ) : (
                                <span className="text-xs text-orange-500">
                                  {t("production.inputAssembly.notFulfilled", "미충족")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-4 border border-dashed border-border rounded">
                  {t("production.inputAssembly.noComponents", "조립 요구사항이 없습니다.")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SG 스캔 패널 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.inputAssembly.scanSection", "SG 라벨 스캔")}
            </h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  ref={sgInputRef}
                  label={t("production.inputAssembly.scanPlaceholder", "SG 바코드 스캔 또는 입력 후 Enter")}
                  value={sgInput}
                  onChange={(e) => setSgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fetchSgLabel(sgInput);
                    }
                  }}
                  disabled={!selectedOrder || sgLoading}
                  leftIcon={<Scan className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fetchSgLabel(sgInput)}
                isLoading={sgLoading}
                disabled={!selectedOrder}
                className="mb-0.5"
              >
                {t("common.search")}
              </Button>
            </div>

            {sgList.length > 0 && (
              <div className="mt-3 border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr className="text-text-muted text-xs">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">
                        {t("production.kitting.sgBarcode", "SG 바코드")}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        {t("common.itemCode", "품번")}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {t("production.kitting.sgRemainQty", "잔량")}
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        {t("common.status", "상태")}
                      </th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sgList.map((item, index) => (
                      <tr
                        key={item.sgBarcode}
                        className="border-b border-border/70 hover:bg-surface/60"
                      >
                        <td className="px-3 py-2 text-text-muted text-xs">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sgBarcode}</td>
                        <td className="px-3 py-2 text-xs">{item.itemCode}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          {item.remainQty != null ? item.remainQty.toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-500/10 text-red-500"
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

        {/* 실행 패널 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.inputAssembly.execute", "조립 실행")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Select
                label={t("production.subprocess.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <Select
                label={`${t("production.inputAssembly.equip", "설비")} (${t("production.subprocess.optional", "선택")})`}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.subprocess.goodQty", "조립 수량")}
                value={Number(qty) || 0}
                onChange={(n) => setQty(n || "")}
                disabled={!selectedOrder}
                fullWidth
              />
              <Input
                label={`${t("production.inputAssembly.circuitNo", "회로번호")} (${t("production.subprocess.optional", "선택")})`}
                value={circuitNo}
                onChange={(e) => setCircuitNo(e.target.value)}
                disabled={!selectedOrder}
                fullWidth
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button
                size="lg"
                onClick={executeAssembly}
                isLoading={executing}
                disabled={!selectedOrder || !processCode || sgList.length === 0}
                leftIcon={<Play className="w-5 h-5" />}
              >
                {t("production.inputAssembly.execute", "조립 실행")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작업지시 검색 모달 — FINISHED 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="FINISHED"
      />

      {/* 경고 모달 */}
      <Modal
        isOpen={warnModalOpen}
        onClose={() => setWarnModalOpen(false)}
        title={t("common.error")}
        size="md"
        footer={
          <Button
            onClick={() => {
              setWarnModalOpen(false);
              sgInputRef.current?.focus();
            }}
          >
            {t("common.confirm")}
          </Button>
        }
      >
        <p className="text-sm text-text">{warnMessage}</p>
      </Modal>

      {/* 결과 모달 */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => {
          setResultModalOpen(false);
          resetForm();
        }}
        title={t("production.inputAssembly.fgLabelsTitle", "발행된 FG 라벨")}
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
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-text-muted">
                {t("production.subprocess.resultNo", "실적번호")}:
              </span>
              <span className="font-mono text-text">{result.resultNo}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-muted mb-2">
                {t("production.inputAssembly.fgLabelsTitle", "발행된 FG 라벨")} ({result.fgBarcodes.length}건)
              </p>
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
