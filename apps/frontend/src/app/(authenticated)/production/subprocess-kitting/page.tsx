"use client";

/**
 * @file production/subprocess-kitting/page.tsx
 * @description 실적입력(서브공정) — 2영역 스캔 키팅.
 *   키오스크 공정에서 부착되어 온 이전 공정 SFG 라벨을 스캔해 회로별 새 SFG(반제품 서브)를 만든다.
 *   input-assembly의 거울상(완제품 FG가 아니라 한 단계 아래 반제품 SFG를 만든다).
 *   흐름: 작업지시·공정·설비·회로 선택 → (좌)설비 자재 장착 + (우)이전 공정 SFG 스캔
 *        → "키팅 실행"으로 새 SFG 발행+자동출력 → 실물 새 SFG 스캔으로 확정.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Cpu, ChevronDown, Package, RefreshCw, Scan, Search } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button, Card, CardContent, Select } from "@/components/ui";
import api from "@/services/api";
import JobOrderSelectModal, { type JobOrder } from "@/components/production/JobOrderSelectModal";
import InputSgScanPanel from "./components/InputSgScanPanel";
import SubKitActionBar from "./components/SubKitActionBar";
import EquipMaterialMountPanel from "../input-assembly/components/EquipMaterialMountPanel";
import SgLabelPrintHost, { type SgLabelPrintHandle } from "../input-kiosk/components/SgLabelPrintHost";
import WorkInstructionView from "../input-kiosk/components/WorkInstructionView";
import EquipSelectModal from "../input-kiosk/components/EquipSelectModal";
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
}

interface CircuitInfo {
  circuitNo: string;
  wireSpec: string | null;
  colorName: string | null;
}

/** 화면에서 보관하는 작업지시 최소 정보 — 공용 모달(JobOrder)·스캔 응답을 공통으로 담는다. */
interface JobOrderPick {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  planQty?: number;
  status?: string;
  processCode?: string;
  orderKind?: string | null;
  routingSeq?: number | null;
}

/** 공용 모달 JobOrder → 화면 JobOrderPick 매핑 */
const toJobOrderPick = (jo: JobOrder & { part?: { itemName?: string } }): JobOrderPick => ({
  orderNo: jo.orderNo,
  itemCode: jo.itemCode,
  itemName: jo.itemName ?? jo.part?.itemName,
  planQty: jo.planQty,
  status: jo.status,
  processCode: jo.processCode,
  orderKind: jo.orderKind,
  routingSeq: jo.routingSeq,
});

const SUBKIT_SELECTED_EQUIP_KEY = "hanes:production:subprocess-kitting:selected-equip";

const SUBKIT_ORDER_KIND_META = {
  ITEM: {
    label: "품목지시",
    description: "반제품 품목 단위",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  },
  OPERATION: {
    label: "공정지시",
    description: "라우팅 공정 단위",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
  },
  UNKNOWN: {
    label: "지시구분",
    description: "구분 미지정",
    className:
      "border-border bg-surface text-text-muted",
  },
} as const;

const getOrderKindMeta = (orderKind?: string | null) => {
  if (orderKind === "ITEM") return SUBKIT_ORDER_KIND_META.ITEM;
  if (orderKind === "OPERATION") return SUBKIT_ORDER_KIND_META.OPERATION;
  return SUBKIT_ORDER_KIND_META.UNKNOWN;
};

const isSubkitSelectableOrder = (order: JobOrderPick, currentProcessCode: string) =>
  order.orderKind === "ITEM" || !currentProcessCode || order.processCode === currentProcessCode;

export default function SubprocessKittingPage() {
  const { t } = useTranslation();

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
  const [circuitNo, setCircuitNo] = useState("");
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [issuedSg, setIssuedSg] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultQuality, setResultQuality] = useState<"GOOD" | "DEFECT">("GOOD");

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgPrinterRef = useRef<SgLabelPrintHandle>(null);
  const restoredEquipRef = useRef<string | null>(null);
  const initialRestoreDoneRef = useRef(false);

  // 설비 목록 로드(공정 정보 포함) — input-kiosk와 동일 소스
  useEffect(() => {
    api
      .get("/equipment/equips", { params: { limit: "500" } })
      .then((res) => setEquips(normalizeEquipOptions(res.data)))
      .catch(() => setEquips([]));
  }, []);

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
    setIssuedSg(null);
    setResultQuality("GOOD");
    setCircuitNo("");
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
    setCircuitNo("");
    setRequirements(null);
    setCircuits([]);
    setSgList([]);
    setIssuedSg(null);
    setResultQuality("GOOD");
    window.localStorage.setItem(SUBKIT_SELECTED_EQUIP_KEY, equip.equipCode);

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
          if (restored.itemType && restored.itemType !== "SEMI_PRODUCT") {
            await persistCurrentJobOrder(null, equip.equipCode);
            setTimeout(() => orderScanRef.current?.focus(), 80);
            return;
          }
          const restoredOrder = toJobOrderPick(restored);
          if (!isSubkitSelectableOrder(restoredOrder, equip.processCode ?? "")) {
            await persistCurrentJobOrder(null, equip.equipCode);
            setTimeout(() => orderScanRef.current?.focus(), 80);
            return;
          }
          selectOrder(restoredOrder, { persist: false });
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
    const savedEquipCode = window.localStorage.getItem(SUBKIT_SELECTED_EQUIP_KEY);
    if (!savedEquipCode) return;
    const savedEquip = equips.find((equip) => equip.equipCode === savedEquipCode);
    if (savedEquip) void restoreEquipmentCurrentState(savedEquip);
  }, [equips, restoreEquipmentCurrentState]);

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
            assignableEquipCode: equipCode,
            itemType: "SEMI_PRODUCT",
          },
        });
        const list: JobOrderPick[] = Array.isArray(res.data?.data)
          ? res.data.data.map((row: JobOrder & { part?: { itemName?: string } }) => toJobOrderPick(row))
          : [];
        const selectableList = list.filter((row) => isSubkitSelectableOrder(row, processCode));
        const found = selectableList.find((r) => r.orderNo === trimmed) ?? selectableList[0];
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
    setCircuits([]);
    setCircuitNo("");
    setSgList([]);
    setIssuedSg(null);
    setResultQuality("GOOD");
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
    setCircuitNo("");
    setRequirements(null);
    setCircuits([]);
    setSgList([]);
    setIssuedSg(null);
    setResultQuality("GOOD");
    window.localStorage.removeItem(SUBKIT_SELECTED_EQUIP_KEY);
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
      toast.error(t("production.inputAssembly.requireScan", "SFG 라벨을 스캔하세요."));
      return;
    }
    if (circuits.length > 0 && !circuitNo) {
      toast.error(t("production.subprocess.requireCircuit", "회로를 선택하세요."));
      return;
    }

    setIssuing(true);
    try {
      // 회로(circuitNo)는 발행 단계에서 SG에 저장되지 않으므로 전송하지 않는다.
      // 회로 선택은 아래 onIssue 가드로 강제하고, 실제 추적은 confirm-subkit의 genealogy로 남긴다.
      const res = await api.post("/production/subprocess-kitting/issue-sg-label", {
        orderNo: selectedOrder.orderNo,
        processCode,
        equipCode,
      });
      const data = res.data?.data as { sgBarcode: string };
      setIssuedSg(data.sgBarcode);
      toast.success(
        t("production.subprocess.issueSuccess", "SFG 라벨이 발행되었습니다. 실물 라벨을 스캔하세요."),
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
        t("production.subprocess.issueFailed", "SFG 라벨 발행에 실패했습니다.");
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
      // 발행과 대칭 — 회로가 있는 품목이면 확정에도 회로 선택을 강제(genealogy circuitNo 누락 방지).
      if (circuits.length > 0 && !circuitNo) {
        toast.error(t("production.subprocess.requireCircuit", "회로를 선택하세요."));
        return;
      }

      setConfirming(true);
      try {
        await api.post("/production/subprocess-kitting/confirm-subkit", {
          newSgBarcode: scanned,
          orderNo: selectedOrder.orderNo,
          processCode,
          equipCode,
          inputSgBarcodes: sgList.map((s) => s.sgBarcode),
          circuitNo: circuitNo || undefined,
          goodQty: resultQuality === "GOOD" ? 1 : 0,
          defectQty: resultQuality === "DEFECT" ? 1 : 0,
        });
        toast.success(t("production.subprocess.confirmSuccess", "서브 키팅이 확정되었습니다."));
        setSgList([]);
        setIssuedSg(null);
        setResultQuality("GOOD");
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.confirmFailed", "서브 키팅 확정에 실패했습니다.");
        toast.error(message);
      } finally {
        setConfirming(false);
      }
    },
    [circuitNo, circuits.length, equipCode, issuedSg, processCode, resultQuality, selectedOrder, sgList, t],
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
              "이전 공정 SFG 라벨을 스캔하여 회로별 반제품 서브를 만듭니다.",
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

      {/* 상단 고정 바: 설비(=공정) + 작업지시 + 회로 */}
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
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${getOrderKindMeta(selectedOrder.orderKind).className}`}>
                      {getOrderKindMeta(selectedOrder.orderKind).label}
                    </span>
                    <div className="min-w-0">
                      <span className="font-mono text-text">{selectedOrder.orderNo}</span>
                      <span className="text-text-muted">
                        {" · "}
                        {selectedOrder.itemCode}
                        {selectedOrder.itemName ? ` · ${selectedOrder.itemName}` : ""}
                        {" · "}
                        {getOrderKindMeta(selectedOrder.orderKind).description}
                      </span>
                    </div>
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

            {/* 3) 회로 */}
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

      {/* 본문 3영역 — input-kiosk 스타일: 좌(설비 자재 장착) | 중앙(작업지도서) | 우(이전 공정 SFG 스캔).
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
          resultQuality={resultQuality}
          onResultQualityChange={setResultQuality}
        />
      </div>

      {/* 작업지시 선택 모달 — 공용 모달. 선택 공정 + SEMI_PRODUCT 조회조건. */}
      <JobOrderSelectModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onConfirm={(jo) => {
          selectOrder(toJobOrderPick(jo));
          setOrderSearchOpen(false);
        }}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={equipCode || undefined}
        processCode={processCode || undefined}
        itemType="SEMI_PRODUCT"
        includeItemOrdersForProcess
      />

      {/* 설비 선택 모달 — input-kiosk 공용. 설비 선택 시 공정 자동 도출. */}
      <EquipSelectModal
        isOpen={equipModalOpen}
        onClose={() => setEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
      />

      {/* SFG(반제품) 라벨 자동 출력 호스트 — 키오스크와 동일, 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
