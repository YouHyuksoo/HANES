"use client";

/**
 * @file production/subprocess-kitting/page.tsx
 * @description 실적입력(서브공정) — 2영역 스캔 키팅.
 *   키오스크 공정에서 부착되어 온 이전 공정 SG 라벨을 스캔해 회로별 새 SG(반제품 서브)를 만든다.
 *   input-assembly의 거울상(완제품 FG가 아니라 한 단계 아래 반제품 SG를 만든다).
 *   흐름: 작업지시·공정·설비·회로 선택 → (좌)설비 자재 장착 + (우)이전 공정 SG 스캔
 *        → "키팅 실행"으로 새 SG 발행+자동출력 → 실물 새 SG 스캔으로 확정.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Package, RefreshCw, Scan, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "./components/JobOrderSearchModal";
import InputSgScanPanel from "./components/InputSgScanPanel";
import SubKitActionBar from "./components/SubKitActionBar";
import EquipMaterialMountPanel from "../input-assembly/components/EquipMaterialMountPanel";
import SgLabelPrintHost, { type SgLabelPrintHandle } from "../input-kiosk/components/SgLabelPrintHost";

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

interface CircuitInfo {
  circuitNo: string;
  wireSpec: string | null;
  colorName: string | null;
}

export default function SubprocessKittingPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [circuitNo, setCircuitNo] = useState("");
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [issuedSg, setIssuedSg] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgPrinterRef = useRef<SgLabelPrintHandle>(null);

  const { options: rawProcessOptions } = useProcessOptions();
  const { options: rawEquipOptions } = useEquipOptions(processCode || undefined);

  const processOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectProcess", "공정 선택") }, ...rawProcessOptions],
    [rawProcessOptions, t],
  );
  const equipOptions = useMemo(
    () => [{ value: "", label: t("production.inputAssembly.selectEquip", "설비 선택") }, ...rawEquipOptions],
    [rawEquipOptions, t],
  );
  const circuitOptions = useMemo(
    () => [
      { value: "", label: t("production.subprocess.selectCircuit", "회로 선택") },
      ...circuits.map((c) => ({
        value: c.circuitNo,
        label: [c.circuitNo, c.wireSpec, c.colorName].filter(Boolean).join(" · "),
      })),
    ],
    [circuits, t],
  );

  // 작업지시 선택 시 BOM 요구사항 + 회로 목록 조회
  useEffect(() => {
    if (!selectedOrder) {
      setRequirements(null);
      setCircuits([]);
      return;
    }
    let cancelled = false;
    setSgList([]);
    setIssuedSg(null);
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
      });
    api
      .get(
        `/production/subprocess-kitting/circuits-by-order/${encodeURIComponent(selectedOrder.orderNo)}`,
      )
      .then((res) => {
        if (!cancelled) setCircuits(Array.isArray(res.data?.data) ? (res.data.data as CircuitInfo[]) : []);
      })
      .catch(() => {
        if (!cancelled) setCircuits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder, t]);

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setSgList([]);
    setIssuedSg(null);
    setCircuitNo("");
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
    setRequirements(null);
    setCircuits([]);
    setCircuitNo("");
    setSgList([]);
    setIssuedSg(null);
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetAll = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setProcessCode("");
    setEquipCode("");
    setCircuitNo("");
    setRequirements(null);
    setCircuits([]);
    setSgList([]);
    setIssuedSg(null);
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const addSg = useCallback((data: SgLabelInfo) => {
    setSgList((prev) => [...prev, data]);
  }, []);

  const removeSg = useCallback((sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  }, []);

  const canIssue =
    !!selectedOrder && !!processCode && !!equipCode && sgList.length > 0 && !issuedSg;

  const onIssue = useCallback(async () => {
    if (!selectedOrder) {
      toast.error(t("production.inputAssembly.requireOrder", "작업지시를 선택하세요."));
      return;
    }
    if (!processCode) {
      toast.error(t("production.subprocess.requireProcess", "공정을 선택하세요."));
      return;
    }
    if (!equipCode) {
      toast.error(t("production.inputAssembly.requireEquip", "설비를 선택하세요."));
      return;
    }
    if (sgList.length === 0) {
      toast.error(t("production.inputAssembly.requireScan", "SG 라벨을 스캔하세요."));
      return;
    }
    if (circuits.length > 0 && !circuitNo) {
      toast.error(t("production.subprocess.requireCircuit", "회로를 선택하세요."));
      return;
    }

    setIssuing(true);
    try {
      const res = await api.post("/production/subprocess-kitting/issue-sg-label", {
        orderNo: selectedOrder.orderNo,
        processCode,
        equipCode,
        circuitNo: circuitNo || undefined,
      });
      const data = res.data?.data as { sgBarcode: string };
      setIssuedSg(data.sgBarcode);
      toast.success(
        t("production.subprocess.issueSuccess", "SG 라벨이 발행되었습니다. 실물 라벨을 스캔하세요."),
      );

      // 발행 즉시 키오스크와 동일하게 Print Agent로 자동 출력(실적 채번 전이므로 바코드 직접 전달).
      void sgPrinterRef.current?.printBySgBarcodes([
        {
          sgBarcode: data.sgBarcode,
          itemCode: selectedOrder.itemCode,
          orderNo: selectedOrder.orderNo,
          initQty: 1,
          issueProcessCode: processCode,
        },
      ]);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.subprocess.issueFailed", "SG 라벨 발행에 실패했습니다.");
      toast.error(message);
    } finally {
      setIssuing(false);
    }
  }, [circuitNo, circuits.length, equipCode, processCode, selectedOrder, sgList.length, t]);

  const onConfirmScan = useCallback(
    async (scanned: string) => {
      if (issuedSg && scanned !== issuedSg) {
        toast.error(t("production.subprocess.confirmMismatch", "발행된 라벨과 일치하지 않습니다."));
        return;
      }
      if (!selectedOrder) return;

      setConfirming(true);
      try {
        await api.post("/production/subprocess-kitting/confirm-subkit", {
          newSgBarcode: scanned,
          orderNo: selectedOrder.orderNo,
          processCode,
          equipCode,
          inputSgBarcodes: sgList.map((s) => s.sgBarcode),
          circuitNo: circuitNo || undefined,
        });
        toast.success(t("production.subprocess.confirmSuccess", "서브 키팅이 확정되었습니다."));
        setSgList([]);
        setIssuedSg(null);
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.confirmFailed", "서브 키팅 확정에 실패했습니다.");
        toast.error(message);
      } finally {
        setConfirming(false);
      }
    },
    [circuitNo, equipCode, issuedSg, processCode, selectedOrder, sgList, t],
  );

  const onResetIssued = useCallback(() => {
    setIssuedSg(null);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-3 animate-fade-in bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            {t("production.kitting.title", "실적입력(서브공정)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t(
              "production.subprocess.scanDescription",
              "이전 공정 SG 라벨을 스캔하여 회로별 반제품 서브를 만듭니다.",
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetAll}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      {/* 상단 고정 바: 작업지시 + 공정 + 설비 + 회로 */}
      <Card padding="none" className="flex-shrink-0">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 min-w-0">
              {selectedOrder ? (
                <div className="flex items-center justify-between gap-3 rounded border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <span className="font-mono text-text">{selectedOrder.orderNo}</span>
                    <span className="text-text-muted">
                      {" · "}
                      {selectedOrder.itemCode}
                      {selectedOrder.itemName ? ` · ${selectedOrder.itemName}` : ""}
                    </span>
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
            </div>

            <div className="w-full lg:w-44">
              <Select
                label={t("production.subprocess.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                fullWidth
              />
            </div>
            <div className="w-full lg:w-44">
              <Select
                label={t("production.inputAssembly.equip", "설비")}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                fullWidth
              />
            </div>
            <div className="w-full lg:w-52">
              <Select
                label={t("production.subprocess.circuit", "회로")}
                options={circuitOptions}
                value={circuitNo}
                onChange={setCircuitNo}
                disabled={circuits.length === 0}
                fullWidth
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 본문 2영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <EquipMaterialMountPanel equipCode={equipCode} />
        <InputSgScanPanel
          orderNo={selectedOrder?.orderNo}
          sgList={sgList}
          components={requirements?.components ?? []}
          onAdd={addSg}
          onRemove={removeSg}
        />
      </div>

      {/* 하단 액션 바 */}
      <div className="flex-shrink-0">
        <SubKitActionBar
          canIssue={canIssue}
          issuing={issuing}
          issuedSg={issuedSg}
          onIssue={onIssue}
          confirming={confirming}
          onConfirmScan={onConfirmScan}
          onResetIssued={onResetIssued}
        />
      </div>

      {/* 작업지시 검색 모달 — SEMI_PRODUCT 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="SEMI_PRODUCT"
      />

      {/* SG(반제품) 라벨 자동 출력 호스트 — 키오스크와 동일, 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
