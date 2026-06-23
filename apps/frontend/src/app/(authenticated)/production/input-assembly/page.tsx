"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Boxes, RefreshCw, Scan, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "../subprocess-kitting/components/JobOrderSearchModal";
import EquipMaterialMountPanel from "./components/EquipMaterialMountPanel";
import SgScanPanel from "./components/SgScanPanel";
import AssemblyActionBar from "./components/AssemblyActionBar";

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

export default function InputAssemblyPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [issuedFg, setIssuedFg] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);

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

  // 작업지시 선택 시 BOM 요구사항 조회
  useEffect(() => {
    if (!selectedOrder) {
      setRequirements(null);
      return;
    }
    let cancelled = false;
    setSgList([]);
    setIssuedFg(null);
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
    return () => {
      cancelled = true;
    };
  }, [selectedOrder, t]);

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setSgList([]);
    setIssuedFg(null);
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
    setIssuedFg(null);
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetAll = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setProcessCode("");
    setEquipCode("");
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const addSg = useCallback((data: SgLabelInfo) => {
    setSgList((prev) => [...prev, data]);
  }, []);

  const removeSg = useCallback((sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  }, []);

  const canIssue =
    !!selectedOrder && !!processCode && !!equipCode && sgList.length > 0 && !issuedFg;

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

    setIssuing(true);
    try {
      const res = await api.post("/production/subprocess-kitting/issue-label", {
        orderNo: selectedOrder.orderNo,
        equipCode,
      });
      const data = res.data?.data as { fgBarcode: string };
      setIssuedFg(data.fgBarcode);
      toast.success(
        t("production.inputAssembly.issueSuccess", "FG 라벨이 발행되었습니다. 실물 라벨을 스캔하세요."),
      );
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.inputAssembly.issueFailed", "FG 라벨 발행에 실패했습니다.");
      toast.error(message);
    } finally {
      setIssuing(false);
    }
  }, [equipCode, processCode, selectedOrder, sgList.length, t]);

  const onConfirmScan = useCallback(
    async (scanned: string) => {
      if (issuedFg && scanned !== issuedFg) {
        toast.error(t("production.inputAssembly.confirmMismatch", "발행된 라벨과 일치하지 않습니다."));
        return;
      }
      if (!selectedOrder) return;

      setConfirming(true);
      try {
        await api.post("/production/subprocess-kitting/confirm", {
          fgBarcode: scanned,
          orderNo: selectedOrder.orderNo,
          equipCode,
          processCode,
          sgBarcodes: sgList.map((s) => s.sgBarcode),
        });
        toast.success(t("production.inputAssembly.confirmSuccess", "조립이 확정되었습니다."));
        setSgList([]);
        setIssuedFg(null);
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.inputAssembly.confirmFailed", "조립 확정에 실패했습니다.");
        toast.error(message);
      } finally {
        setConfirming(false);
      }
    },
    [equipCode, issuedFg, processCode, selectedOrder, sgList, t],
  );

  const onResetIssued = useCallback(() => {
    setIssuedFg(null);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-3 animate-fade-in bg-background">
      {/* 헤더 */}
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
          onClick={resetAll}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      {/* 상단 고정 바: 작업지시 + 공정 + 설비 */}
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

            <div className="w-full lg:w-48">
              <Select
                label={t("production.subprocess.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                fullWidth
              />
            </div>
            <div className="w-full lg:w-48">
              <Select
                label={t("production.inputAssembly.equip", "설비")}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                fullWidth
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 본문 2영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <EquipMaterialMountPanel equipCode={equipCode} />
        <SgScanPanel
          orderNo={selectedOrder?.orderNo}
          sgList={sgList}
          components={requirements?.components ?? []}
          onAdd={addSg}
          onRemove={removeSg}
        />
      </div>

      {/* 하단 액션 바 */}
      <div className="flex-shrink-0">
        <AssemblyActionBar
          canIssue={canIssue}
          issuing={issuing}
          issuedFg={issuedFg}
          onIssue={onIssue}
          confirming={confirming}
          onConfirmScan={onConfirmScan}
          onResetIssued={onResetIssued}
        />
      </div>

      {/* 작업지시 검색 모달 — FINISHED 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="FINISHED"
      />
    </div>
  );
}
