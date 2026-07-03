"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Boxes, Cpu, ChevronDown, RefreshCw, Scan, Search } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button, Card, CardContent } from "@/components/ui";
import api from "@/services/api";
import JobOrderSelectModal, { type JobOrder } from "@/components/production/JobOrderSelectModal";
import EquipMaterialMountPanel from "./components/EquipMaterialMountPanel";
import SgScanPanel from "./components/SgScanPanel";
import AssemblyActionBar from "./components/AssemblyActionBar";
import WorkInstructionView from "../input-kiosk/components/WorkInstructionView";
import EquipSelectModal from "../input-kiosk/components/EquipSelectModal";
import FgLabelPrintHost, { type FgLabelPrintHandle } from "../input-kiosk/components/FgLabelPrintHost";
import { normalizeEquipOptions, type EquipOption } from "../input-kiosk/utils/equipOptions";

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
  /** 라벨 종류 — BUNDLE(묶음)/SFG(회로) */
  labelType?: string;
}

/** 화면에서 보관하는 작업지시 최소 정보 — 공용 모달(JobOrder)·스캔 응답을 공통으로 담는다. */
interface JobOrderPick {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  planQty?: number;
  status?: string;
  processCode?: string;
}

/** 공용 모달 JobOrder → 화면 JobOrderPick 매핑 */
const toJobOrderPick = (jo: JobOrder): JobOrderPick => ({
  orderNo: jo.orderNo,
  itemCode: jo.itemCode,
  itemName: jo.itemName,
  planQty: jo.planQty,
  status: jo.status,
  processCode: jo.processCode,
});

const ASSEMBLY_SELECTED_EQUIP_KEY = "hanes:production:input-assembly:selected-equip";

export default function InputAssemblyPage() {
  const { t } = useTranslation();

  const fgPrinterRef = useRef<FgLabelPrintHandle>(null);

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  // 설비 선택으로 공정을 도출한다(설비→공정). processCode는 설비 선택 시 자동 설정.
  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [equipName, setEquipName] = useState("");
  const [processName, setProcessName] = useState("");
  const [equips, setEquips] = useState<EquipOption[]>([]);
  const [equipModalOpen, setEquipModalOpen] = useState(false);

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [issuedFg, setIssuedFg] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const restoredEquipRef = useRef<string | null>(null);
  const initialRestoreDoneRef = useRef(false);

  // 설비 목록 로드(공정 정보 포함) — input-kiosk와 동일 소스
  useEffect(() => {
    api
      .get("/equipment/equips", { params: { limit: "500" } })
      .then((res) => setEquips(normalizeEquipOptions(res.data)))
      .catch(() => setEquips([]));
  }, []);

  const persistCurrentJobOrder = useCallback(async (orderNo: string | null, targetEquipCode = equipCode) => {
    if (!targetEquipCode) return;
    await api.patch(
      `/equipment/equips/${encodeURIComponent(targetEquipCode)}/job-order`,
      { orderNo },
      { suppressErrorModal: true },
    );
  }, [equipCode]);

  const selectOrder = useCallback((order: JobOrderPick, options?: { persist?: boolean }) => {
    setSelectedOrder(order);
    setOrderScan("");
    setSgList([]);
    setIssuedFg(null);
    if (options?.persist !== false) {
      void persistCurrentJobOrder(order.orderNo).catch((error: unknown) => {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.assignOrderFailed", "설비 현재 작업지시 저장에 실패했습니다.");
        toast.error(message);
      });
    }
  }, [persistCurrentJobOrder, t]);

  const restoreEquipmentCurrentState = useCallback(async (equip: EquipOption) => {
    restoredEquipRef.current = equip.equipCode;
    setEquipCode(equip.equipCode);
    setEquipName(equip.equipName);
    setProcessCode(equip.processCode ?? "");
    setProcessName(equip.processName ?? "");
    setSelectedOrder(null);
    setOrderScan("");
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    window.localStorage.setItem(ASSEMBLY_SELECTED_EQUIP_KEY, equip.equipCode);

    try {
      const equipRes = await api.get(`/equipment/equips/${encodeURIComponent(equip.equipCode)}`);
      const current = equipRes.data?.data ?? {};
      const currentJobOrderId = current.currentJobOrderId ?? equip.currentJobOrderId ?? null;

      if (currentJobOrderId) {
        const orderRes = await api.get(
          `/production/job-orders/order-no/${encodeURIComponent(currentJobOrderId)}`,
        );
        const restored = orderRes.data?.data as JobOrder | null | undefined;
        if (restored?.orderNo) {
          if (restored.itemType && restored.itemType !== "FINISHED") {
            await persistCurrentJobOrder(null, equip.equipCode);
            setTimeout(() => orderScanRef.current?.focus(), 80);
            return;
          }
          selectOrder(toJobOrderPick(restored), { persist: false });
          return;
        }
      }
      setTimeout(() => orderScanRef.current?.focus(), 80);
    } catch {
      toast.error(t("production.subprocess.restoreError", "설비 현재 작업 상태를 불러오지 못했습니다."));
      setTimeout(() => orderScanRef.current?.focus(), 80);
    }
  }, [persistCurrentJobOrder, selectOrder, t]);

  useEffect(() => {
    if (initialRestoreDoneRef.current || equips.length === 0) return;
    initialRestoreDoneRef.current = true;
    const savedEquipCode = window.localStorage.getItem(ASSEMBLY_SELECTED_EQUIP_KEY);
    if (!savedEquipCode) return;
    const savedEquip = equips.find((equip) => equip.equipCode === savedEquipCode);
    if (savedEquip) void restoreEquipmentCurrentState(savedEquip);
  }, [equips, restoreEquipmentCurrentState]);

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

  // 설비 선택 — 설비가 공정을 결정한다(설비→공정 자동). 저장된 설비 현재 작업지시가 있으면 함께 복원한다.
  const handleEquipSelect = useCallback((equip: EquipOption) => {
    void restoreEquipmentCurrentState(equip);
  }, [restoreEquipmentCurrentState]);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      const trimmed = no.trim();
      if (!trimmed) return;
      if (!equipCode) {
        toast.error(t("production.subprocess.requireEquipFirst", "설비를 먼저 선택하세요."));
        return;
      }
      if (/^(FG|SG)\d/i.test(trimmed)) {
        toast.error(t("production.subprocess.scanIsLabel", "바코드 라벨입니다. 작업지시번호를 입력하거나 검색 버튼을 이용하세요."));
        return;
      }
      try {
        const res = await api.get("/production/job-orders", {
          params: {
            limit: 20,
            search: trimmed,
            statuses: "WAITING,RUNNING",
            itemType: "FINISHED",
            orderKind: "OPERATION",
            assignableEquipCode: equipCode,
            ...(processCode ? { processCode } : {}),
          },
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
    [equipCode, processCode, selectOrder, t],
  );

  const clearOrder = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    void persistCurrentJobOrder(null).catch(() => {
      toast.error(t("production.subprocess.clearOrderFailed", "설비 현재 작업지시 해제에 실패했습니다."));
    });
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetAll = () => {
    const prevEquipCode = equipCode;
    setSelectedOrder(null);
    setOrderScan("");
    setProcessCode("");
    setEquipCode("");
    setEquipName("");
    setProcessName("");
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    window.localStorage.removeItem(ASSEMBLY_SELECTED_EQUIP_KEY);
    if (prevEquipCode) {
      void persistCurrentJobOrder(null, prevEquipCode).catch(() => {
        toast.error(t("production.subprocess.clearOrderFailed", "설비 현재 작업지시 해제에 실패했습니다."));
      });
    }
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
      toast.error(t("production.inputAssembly.requireScan", "SFG 라벨을 스캔하세요."));
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
        const res = await api.post("/production/subprocess-kitting/confirm", {
          fgBarcode: scanned,
          orderNo: selectedOrder.orderNo,
          equipCode,
          processCode,
          sgBarcodes: sgList.map((s) => s.sgBarcode),
        });
        toast.success(t("production.inputAssembly.confirmSuccess", "조립이 확정되었습니다."));
        // FG 라벨 데이터는 항상 발행되며, 인쇄 여부는 백엔드 printFg(라우팅 ISSUE_LABEL_TYPE='FG')로 제어한다.
        const confirmData = res.data?.data as { fgBarcode?: string; printFg?: boolean } | undefined;
        if (confirmData?.printFg) {
          void fgPrinterRef.current?.printByFgBarcodes([
            {
              fgBarcode: confirmData.fgBarcode ?? scanned,
              itemCode: selectedOrder.itemCode,
              orderNo: selectedOrder.orderNo,
              equipCode,
            },
          ]);
        }
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
            {t("production.inputAssembly.description", "반제품 SFG 라벨을 스캔하여 완제품을 조립합니다.")}
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

      {/* 상단 고정 바: 설비(=공정) + 작업지시 */}
      <Card padding="none" className="flex-shrink-0">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            {/* 1) 설비 — 가장 먼저 선택. 설비가 공정을 결정(설비→공정)하고 작업지시 조회조건이 된다. */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-text mb-1">
                {t("production.inputAssembly.equip", "설비")}
              </label>
              <button
                type="button"
                onClick={() => setEquipModalOpen(true)}
                className={`flex h-11 w-full items-center gap-2 rounded-lg border px-3 text-left transition-colors ${
                  equipCode
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-dashed border-border hover:border-primary"
                }`}
              >
                <Cpu className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  {equipCode ? (
                    <>
                      <div className="truncate text-sm font-semibold text-text">{equipName}</div>
                      <div className="truncate text-[11px] text-text-muted">
                        {equipCode}
                        {processName && (
                          <span className="ml-1 font-semibold text-primary">· {processName}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">
                      {t("kiosk.header.selectEquip", "설비 선택")}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </div>

            {/* 2) 작업지시 — 설비 선택 후 활성화. 선택 설비의 공정에 내려진 작업지시만 조회. */}
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
                    <BarcodeScanInput
                      ref={orderScanRef}
                      label={t("production.subprocess.orderScanLabel", "작업지시번호 스캔 또는 입력 후 Enter")}
                      value={orderScan}
                      onChange={setOrderScan}
                      onScan={fetchOrderByNo}
                      placeholder={
                        equipCode
                          ? "W-20260001"
                          : t("production.subprocess.requireEquipFirst", "설비를 먼저 선택하세요.")
                      }
                      disabled={!equipCode}
                      fullWidth
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOrderSearchOpen(true)}
                    leftIcon={<Search className="w-4 h-4" />}
                    disabled={!equipCode}
                    className="mb-0.5"
                  >
                    {t("common.search")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 본문 3영역 — input-kiosk 스타일: 좌(설비 자재 장착) | 중앙(작업지도서) | 우(반제품 SFG 스캔).
          좌·우는 고정폭으로 축소하고 중앙 작업지도서를 넓게 둔다. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-3 flex-1 min-h-0">
        <EquipMaterialMountPanel
          equipCode={equipCode}
          orderNo={selectedOrder?.orderNo}
          itemCode={selectedOrder?.itemCode}
          expectedItemTypes={["RAW_MATERIAL"]}
          autoFocusKey={selectedOrder?.orderNo}
        />
        {/* 중앙: 작업지도서 — 선택된 작업지시 품목 + 공정 기준 조회 */}
        <div className="flex flex-col h-full min-h-0 overflow-hidden rounded border border-border bg-card">
          <WorkInstructionView
            itemCode={selectedOrder?.itemCode}
            processCode={processCode || undefined}
          />
        </div>
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

      {/* 작업지시 선택 모달 — 공용 모달. 선택 공정 + FINISHED 조회조건. */}
      <JobOrderSelectModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onConfirm={(jo) => {
          selectOrder(toJobOrderPick(jo));
          setOrderSearchOpen(false);
        }}
        processCode={processCode || undefined}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={equipCode || undefined}
        itemType="FINISHED"
        orderKind="OPERATION"
      />

      {/* 설비 선택 모달 — input-kiosk 공용. 설비 선택 시 공정 자동 도출. */}
      <EquipSelectModal
        isOpen={equipModalOpen}
        onClose={() => setEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
      />

      {/* FG 라벨 자동 출력 호스트(오프스크린). 조립 확정 시 printFg=true면 출력. */}
      <FgLabelPrintHost ref={fgPrinterRef} />
    </div>
  );
}
