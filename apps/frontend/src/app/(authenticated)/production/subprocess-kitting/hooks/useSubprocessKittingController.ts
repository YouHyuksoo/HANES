"use client";

/**
 * @file production/subprocess-kitting/hooks/useSubprocessKittingController.ts
 * @description 실적입력(서브공정) 키팅 화면의 상태·게이트·저장 로직.
 *
 * 초보자 가이드:
 * 화면(page.tsx)은 "무엇을 어디에 그릴지"만 담당하고, "무슨 일이 일어나는지"는 전부 이 파일에 있다.
 * 배치 시안 subprocess-kitting-b 가 같은 훅을 쓰므로, 로직을 고칠 때는 이 파일만 고치면 두 화면에 함께 반영된다.
 *
 * 담는 것: 설비·작업지시·회로 선택, 설비 현재상태 복원, 일상/작업자 점검 인터록,
 *          이전 공정 SFG 스캔 목록, SFG 발행(+자동출력), 실물 스캔 확정, 초기화.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import { judgeRestoredJobOrder } from "@/components/production/jobOrderRestore";
import type { JobOrder } from "@/components/production/JobOrderSelectModal";
import { useCarrierProcessFlags, useOutputCarrier } from "@/components/shared/carrier";
import type { SgLabelPrintHandle } from "../../input-kiosk/components/SgLabelPrintHost";
import { normalizeEquipOptions, type EquipOption } from "../../input-kiosk/utils/equipOptions";
import { useKioskStore } from "@/stores/kioskStore";
import { useEquipWorkers } from "../../input-kiosk/hooks/useEquipWorkers";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import type { Worker } from "@/components/worker/WorkerSelector";
import { inspectStatusDetail, isInspectNg } from "../../input-kiosk/utils/inspectStatus";
import { normalizeScannedOrderNo } from "@/utils/scanned-order-no";


export interface AssemblyComponent {
  itemCode: string;
  itemName: string;
  itemType: string;
  qtyPer: number;
  totalRequired: number;
}

export interface AssemblyRequirements {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  components: AssemblyComponent[];
}

export interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
}

export interface CircuitInfo {
  circuitNo: string;
  wireSpec: string | null;
  colorName: string | null;
}

/** 화면에서 보관하는 작업지시 최소 정보 — 공용 모달(JobOrder)·스캔 응답을 공통으로 담는다. */
export interface JobOrderPick {
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
export const toJobOrderPick = (jo: JobOrder & { part?: { itemName?: string } }): JobOrderPick => ({
  orderNo: jo.orderNo,
  itemCode: jo.itemCode,
  itemName: jo.itemName ?? jo.part?.itemName,
  planQty: jo.planQty,
  status: jo.status,
  processCode: jo.processCode,
  orderKind: jo.orderKind,
  routingSeq: jo.routingSeq,
});

export const SUBKIT_SELECTED_EQUIP_KEY = "hanes:production:subprocess-kitting:selected-equip";

export const SUBKIT_ORDER_KIND_META = {
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

export const getOrderKindMeta = (orderKind?: string | null) => {
  if (orderKind === "ITEM") return SUBKIT_ORDER_KIND_META.ITEM;
  if (orderKind === "OPERATION") return SUBKIT_ORDER_KIND_META.OPERATION;
  return SUBKIT_ORDER_KIND_META.UNKNOWN;
};

export const isSubkitSelectableOrder = (order: JobOrderPick, currentProcessCode: string) =>
  order.orderKind === "ITEM" || !currentProcessCode || order.processCode === currentProcessCode;


/** 키팅 화면 컨트롤러. page.tsx(A안)와 subprocess-kitting-b(B안)가 같은 규약을 쓴다. */
export function useSubprocessKittingController() {
  const { t } = useTranslation();
  const { interlock, setSelectedEquip: setKioskEquip, setSelectedJobOrder: setKioskOrder, setInterlock } = useKioskStore();
  const sysConfigLoaded = useSysConfigStore((state) => state.isLoaded);
  const sysConfigRequired = useSysConfigStore((state) => state.isEnabled);
  const fetchSysConfigs = useSysConfigStore((state) => state.fetchConfigs);
  const dailyInspectRequired = !sysConfigLoaded || sysConfigRequired("SUBASSEMBLY_DAILY_INSPECT_REQUIRED");
  const workerInspectRequired = !sysConfigLoaded || sysConfigRequired("SUBASSEMBLY_WORKER_INSPECT_REQUIRED");

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  // 설비 선택으로 공정을 도출한다(설비→공정). processCode는 설비 선택 시 자동 설정.
  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const { selectedWorkers, addWorker, removeWorker, restoreWorkers, clearWorkers } = useEquipWorkers(equipCode || undefined);
  const [equipName, setEquipName] = useState("");
  const [processName, setProcessName] = useState("");
  const [equips, setEquips] = useState<EquipOption[]>([]);
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [dailyInspectOpen, setDailyInspectOpen] = useState(false);
  const [workerInspectOpen, setWorkerInspectOpen] = useState(false);
  const [circuitNo, setCircuitNo] = useState("");
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [issuedSg, setIssuedSg] = useState<string | null>(null);
  const [productivityRevision, setProductivityRevision] = useState(0);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultQuality, setResultQuality] = useState<"GOOD" | "DEFECT">("GOOD");

  const carrierFlags = useCarrierProcessFlags({ orderNo: selectedOrder?.orderNo, processCode });
  const [equipCurCarrierNo, setEquipCurCarrierNo] = useState<string | null>(null);
  const outputCarrier = useOutputCarrier({ equipCode: equipCode || null, enabled: carrierFlags?.carrierLoadYn === "Y", initialCarrierNo: equipCurCarrierNo });

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgPrinterRef = useRef<SgLabelPrintHandle>(null);
  const restoredEquipRef = useRef<string | null>(null);
  const initialRestoreDoneRef = useRef(false);

  // 설비 목록 로드(공정 정보 포함) — input-kiosk와 동일 소스
  useEffect(() => {
    api
      .get("/equipment/equips", { params: { limit: "500", useYn: "Y" } })
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
    setKioskOrder(order as unknown as import('@/components/production/JobOrderSelectModal').JobOrder);
    if (options?.persist !== false) {
      void persistCurrentJobOrder(order.orderNo).catch((error: unknown) => {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.assignOrderFailed", "설비 현재 작업지시 저장에 실패했습니다.");
        toast.error(message);
      });
    }
  }, [persistCurrentJobOrder, setKioskOrder, t]);

  const restoreEquipmentCurrentState = useCallback(async (equip: EquipOption) => {
    restoredEquipRef.current = equip.equipCode;
    setEquipCode(equip.equipCode);
    setEquipName(equip.equipName);
    setProcessCode(equip.processCode ?? "");
    setProcessName(equip.processName ?? "");
    setKioskEquip({ equipCode: equip.equipCode, equipName: equip.equipName, processCode: equip.processCode, processName: equip.processName });
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
      setEquipCurCarrierNo(current.curCarrierNo ?? null);
      const currentJobOrderId = current.currentJobOrderId ?? equip.currentJobOrderId ?? null;
      await restoreWorkers(current.currentWorkerCodes ?? equip.currentWorkerCodes ?? null);

      if (currentJobOrderId) {
        const orderRes = await api.get(
          `/production/job-orders/order-no/${encodeURIComponent(currentJobOrderId)}`,
          { suppressErrorModal: true },
        ).catch(() => null);
        const restored = (orderRes?.data?.data ?? null) as JobOrder | null;
        const verdict = judgeRestoredJobOrder(restored);
        if (verdict.kind !== "ok") {
          // 완료/취소/미존재 지시는 복원하지 않고 설비 바인딩을 풀어 새 지시를 고르게 한다
          await persistCurrentJobOrder(null, equip.equipCode);
          toast(verdict.kind === "finished"
            ? t("production.jobOrderRestore.finishedReleased", "완료된 작업지시는 해제했습니다. 작업지시를 새로 선택하세요.")
            : t("production.jobOrderRestore.missingReleased", "저장된 작업지시를 찾을 수 없어 해제했습니다. 작업지시를 새로 선택하세요."));
          setTimeout(() => orderScanRef.current?.focus(), 80);
          return;
        }
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
      setEquipCurCarrierNo(null);
      toast.error(t("production.subprocess.restoreError", "설비 현재 작업 상태를 불러오지 못했습니다."));
      setTimeout(() => orderScanRef.current?.focus(), 80);
    }
  }, [persistCurrentJobOrder, restoreWorkers, selectOrder, setKioskEquip, t]);

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

  const handleWorkerSelect = useCallback((worker: Worker) => {
    setWorkerModalOpen(false);
    void addWorker(worker);
  }, [addWorker]);

  // 종합판정(OVERALL_RESULT). 점검 기록은 있으나 판정이 PASS가 아닌 상태를 구분해 표시/차단한다.
  const [dailyInspectResult, setDailyInspectResult] = useState<string | null>(null);
  const [workerInspectResult, setWorkerInspectResult] = useState<string | null>(null);

  // 점검 배지에 완료 여부 + 종합판정을 함께 표시한다("완료(합격)" / "완료(불합격)").
  // 판정 라벨은 공통코드 i18n comCode.INSPECT_JUDGE.* 단일 출처.
  const inspectDetailLabels = {
    done: t('kiosk.header.done', '완료'),
    judge: (code: string) => t(`comCode.INSPECT_JUDGE.${code}`, code),
  };
  const inspectDoneDetail = (result?: string | null) => inspectStatusDetail(result, null, inspectDetailLabels);
  const inspectNgDetail = (result?: string | null) =>
    isInspectNg(result) ? inspectStatusDetail(result, null, inspectDetailLabels) : undefined;

  const refreshInspectStatus = useCallback(async () => {
    if (!equipCode) {
      setInterlock('dailyInspectDone', !dailyInspectRequired);
      setInterlock('workerInspectDone', !workerInspectRequired);
      setDailyInspectResult(null);
      setWorkerInspectResult(null);
      return;
    }
    const checks = await Promise.allSettled([
      dailyInspectRequired ? api.get('/equipment/daily-inspect/check', { params: { equipCode, inspectType: 'DAILY' } }) : Promise.resolve(null),
      workerInspectRequired && selectedOrder?.orderNo ? api.get('/equipment/daily-inspect/check', { params: { equipCode, inspectType: 'WORKER', orderNo: selectedOrder.orderNo } }) : Promise.resolve(null),
    ]);
    const dailyData = checks[0].status === 'fulfilled' ? checks[0].value?.data?.data : null;
    const workerData = checks[1].status === 'fulfilled' ? checks[1].value?.data?.data : null;
    // 인터록은 "기록 존재"가 아니라 "종합판정 PASS" 기준.
    setInterlock('dailyInspectDone', !dailyInspectRequired || Boolean(dailyData?.inspectPassed));
    setInterlock('workerInspectDone', !workerInspectRequired || Boolean(workerData?.inspectPassed));
    setDailyInspectResult(dailyData?.alreadyInspected ? (dailyData?.overallResult ?? null) : null);
    setWorkerInspectResult(workerData?.alreadyInspected ? (workerData?.overallResult ?? null) : null);
  }, [dailyInspectRequired, equipCode, selectedOrder?.orderNo, setInterlock, workerInspectRequired]);

  useEffect(() => { void refreshInspectStatus(); }, [refreshInspectStatus]);
  useEffect(() => { if (!sysConfigLoaded) void fetchSysConfigs(); }, [fetchSysConfigs, sysConfigLoaded]);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      // 예전 출력물의 QR 은 조회 URL 이라 그대로 찍으면 주소가 통째로 들어온다 — 번호만 뽑는다.
      const trimmed = normalizeScannedOrderNo(no);
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
    setKioskOrder(null);
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
    setEquipCurCarrierNo(null);
    setEquipCode("");
    setEquipName("");
    setProcessName("");
    setCircuitNo("");
    setRequirements(null);
    setCircuits([]);
    setSgList([]);
    setIssuedSg(null);
    setResultQuality("GOOD");
    setKioskEquip(null);
    clearWorkers();
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
    !!selectedOrder && !!processCode && !!equipCode && sgList.length > 0 && !issuedSg
    && (!dailyInspectRequired || interlock.dailyInspectDone)
    && (!workerInspectRequired || interlock.workerInspectDone);

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
          carrierNo: outputCarrier.carrier?.carrierNo ?? undefined,
        });
        toast.success(t("production.subprocess.confirmSuccess", "서브 키팅이 확정되었습니다."));
        setSgList([]);
        setIssuedSg(null);
        setResultQuality("GOOD");
        setProductivityRevision(value => value + 1);
        void outputCarrier.refresh();
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.confirmFailed", "서브 키팅 확정에 실패했습니다.");
        if (message.startsWith("대차 교체")) {
          // 대차 용량 초과 안내는 onCapacityRejected가 자체 토스트로 띄운다(중복 토스트 방지).
          outputCarrier.onCapacityRejected();
        } else {
          toast.error(message);
        }
      } finally {
        setConfirming(false);
      }
    },
    [circuitNo, circuits.length, equipCode, issuedSg, processCode, resultQuality, selectedOrder, sgList, t, outputCarrier],
  );

  const onResetIssued = useCallback(() => {
    setIssuedSg(null);
  }, []);

  return {
    // 선택 상태
    selectedOrder, orderScan, setOrderScan, orderSearchOpen, setOrderSearchOpen,
    processCode, processName, equipCode, equipName, equips,
    circuitNo, setCircuitNo, circuits, circuitOptions,
    selectedWorkers, removeWorker,
    // 모달 열림 상태
    equipModalOpen, setEquipModalOpen, workerModalOpen, setWorkerModalOpen,
    dailyInspectOpen, setDailyInspectOpen, workerInspectOpen, setWorkerInspectOpen,
    // 점검 인터록
    interlock, dailyInspectRequired, workerInspectRequired,
    dailyInspectResult, workerInspectResult, inspectDoneDetail, inspectNgDetail, refreshInspectStatus,
    // 키팅 데이터
    requirements, sgList, addSg, removeSg, issuedSg,
    resultQuality, setResultQuality, productivityRevision,
    // 대차
    carrierFlags, outputCarrier,
    // 동작
    selectOrder, fetchOrderByNo, clearOrder, resetAll,
    handleEquipSelect, handleWorkerSelect, restoreEquipmentCurrentState,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    // ref
    orderScanRef, sgPrinterRef,
  };
}

export type SubprocessKittingController = ReturnType<typeof useSubprocessKittingController>;
