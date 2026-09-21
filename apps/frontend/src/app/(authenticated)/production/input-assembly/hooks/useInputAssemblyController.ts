"use client";

/**
 * @file production/input-assembly/hooks/useInputAssemblyController.ts
 * @description 실적입력(조립) 화면의 상태·게이트·저장 로직.
 *
 * 초보자 가이드:
 * 화면(page.tsx)은 "무엇을 어디에 그릴지"만 담당하고, "무슨 일이 일어나는지"는 전부 이 파일에 있다.
 * 배치 시안 input-assembly-b 가 같은 훅을 쓰므로, 로직을 고칠 때는 이 파일만 고치면 두 화면에 함께 반영된다.
 *
 * 담는 것: 설비·작업지시 선택, 설비 현재상태 복원, 일상/작업자 점검 인터록, 반제품 SFG 스캔 세션,
 *          FG 라벨 발행(+자동출력), 실물 스캔 확정, 설비정지·관리자호출, 준비 안내, 초기화.
 *
 * 담지 않는 것: 전체화면(view=full) 토글. 라우트 경로가 화면마다 다르므로 각 page.tsx 가 갖는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import { judgeRestoredJobOrder } from "@/components/production/jobOrderRestore";
import type { JobOrder } from "@/components/production/JobOrderSelectModal";
import { useCarrierProcessFlags, useOutputCarrier } from "@/components/shared/carrier";
import { useAssemblyScanSession, type AssemblySgLabel } from "./useAssemblyScanSession";
import { usePrepGuide } from "@/components/shared/prep-guide";
import { buildAssemblyPrepGuideSteps } from "../assemblyPrepGuideSteps";
import type { FgLabelPrintHandle } from "../../input-kiosk/components/FgLabelPrintHost";
import { normalizeEquipOptions, type EquipOption } from "../../input-kiosk/utils/equipOptions";
import { useKioskStore } from "@/stores/kioskStore";
import { useEquipWorkers } from "../../input-kiosk/hooks/useEquipWorkers";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import type { Worker } from "@/components/worker/WorkerSelector";
import { inspectStatusDetail, isInspectNg } from "../../input-kiosk/utils/inspectStatus";
import { normalizeScannedOrderNo } from "@/utils/scanned-order-no";
import { useEquipStop } from "../../input-kiosk/hooks/useEquipStop";

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

export type SgLabelInfo = AssemblySgLabel;

/** 화면에서 보관하는 작업지시 최소 정보 — 공용 모달(JobOrder)·스캔 응답을 공통으로 담는다. */
export interface JobOrderPick {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  planQty?: number;
  status?: string;
  processCode?: string;
}

/** 공용 모달 JobOrder → 화면 JobOrderPick 매핑 */
export const toJobOrderPick = (jo: JobOrder): JobOrderPick => ({
  orderNo: jo.orderNo,
  itemCode: jo.itemCode,
  itemName: jo.itemName,
  planQty: jo.planQty,
  status: jo.status,
  processCode: jo.processCode,
});

export const ASSEMBLY_SELECTED_EQUIP_KEY = "hanes:production:input-assembly:selected-equip";

/** 조립 화면 컨트롤러. page.tsx(A안)와 input-assembly-b(B안)가 같은 규약을 쓴다. */
export function useInputAssemblyController() {
  const { t } = useTranslation();
  const { interlock, setSelectedEquip: setKioskEquip, setSelectedJobOrder: setKioskOrder, setInterlock } = useKioskStore();
  const sysConfigLoaded = useSysConfigStore((state) => state.isLoaded);
  const sysConfigRequired = useSysConfigStore((state) => state.isEnabled);
  const fetchSysConfigs = useSysConfigStore((state) => state.fetchConfigs);
  const dailyInspectRequired = !sysConfigLoaded || sysConfigRequired("ASSEMBLY_DAILY_INSPECT_REQUIRED");
  const workerInspectRequired = !sysConfigLoaded || sysConfigRequired("ASSEMBLY_WORKER_INSPECT_REQUIRED");

  const fgPrinterRef = useRef<FgLabelPrintHandle>(null);

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

  /** 출력 대차 — 공정 CARRIER_LOAD_YN=Y일 때만 슬롯이 보이고, FG 확정에 carrierNo가 실린다.
   *  restoreEquipmentCurrentState/resetAll이 setEquipCurCarrierNo를 쓰므로 그 함수들보다 먼저 선언한다. */
  const carrierFlags = useCarrierProcessFlags({ orderNo: selectedOrder?.orderNo, processCode });
  const carrierRequired = carrierFlags?.carrierLoadYn === "Y";
  const [equipCurCarrierNo, setEquipCurCarrierNo] = useState<string | null>(null);
  const outputCarrier = useOutputCarrier({ equipCode: equipCode || null, enabled: carrierRequired, initialCarrierNo: equipCurCarrierNo });

  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const { sgList, setSgList, continuous, setContinuous, ready: sgReady, applyConfirmed, refreshAfterFailure } =
    useAssemblyScanSession(requirements?.components ?? []);
  const [issuedFg, setIssuedFg] = useState<string | null>(null);
  const [productivityRevision, setProductivityRevision] = useState(0);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const actionPending = useRef(false);
  const contextLocked = issuing || confirming || !!issuedFg;

  // 설비정지 · 관리자호출 — 실적입력(가공)과 같은 훅·같은 API. 정지 중에는 발행/확정을 막는다.
  const equipStop = useEquipStop(equipCode || null, selectedOrder?.orderNo ?? null);
  const [isEquipStopOpen, setIsEquipStopOpen] = useState(false);
  const [isManagerCallOpen, setIsManagerCallOpen] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const restoredEquipRef = useRef<string | null>(null);
  const initialRestoreDoneRef = useRef(false);

  // 설비 목록 로드(공정 정보 포함) — input-kiosk와 동일 소스
  useEffect(() => {
    api
      .get("/equipment/equips", { params: { limit: "500", useYn: "Y" } })
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
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    window.localStorage.setItem(ASSEMBLY_SELECTED_EQUIP_KEY, equip.equipCode);

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
      setEquipCurCarrierNo(null);
      toast.error(t("production.subprocess.restoreError", "설비 현재 작업 상태를 불러오지 못했습니다."));
      setTimeout(() => orderScanRef.current?.focus(), 80);
    }
  }, [persistCurrentJobOrder, restoreWorkers, selectOrder, setKioskEquip, t]);

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
    setRequirements(null);
    setSgList([]);
    setIssuedFg(null);
    setKioskEquip(null);
    clearWorkers();
    window.localStorage.removeItem(ASSEMBLY_SELECTED_EQUIP_KEY);
    if (prevEquipCode) {
      void persistCurrentJobOrder(null, prevEquipCode).catch(() => {
        toast.error(t("production.subprocess.clearOrderFailed", "설비 현재 작업지시 해제에 실패했습니다."));
      });
    }
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const addSg = useCallback((data: SgLabelInfo) => {
    if (actionPending.current) return;
    setSgList((prev) => prev.some((label) => label.sgBarcode === data.sgBarcode) ? prev : [...prev, data]);
  }, [setSgList]);

  const removeSg = useCallback((sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  }, []);

  /** 진입 안내 — 설비→작업지시→작업자→점검 순서로 유도하고, 끝나면 자동으로 닫힌다 */
  const workerNames = useMemo(() => selectedWorkers.map((w) => w.workerName), [selectedWorkers]);
  const guideSteps = useMemo(() => buildAssemblyPrepGuideSteps({
    equipName: equipName || null,
    orderNo: selectedOrder?.orderNo ?? null,
    workerNames,
    interlock,
    dailyInspectRequired,
    workerInspectRequired,
    dailyInspectResult,
    workerInspectResult,
    carrierRequired,
    carrierNo: outputCarrier.carrier?.carrierNo ?? null,
  }), [equipName, selectedOrder?.orderNo, workerNames, interlock, dailyInspectRequired, workerInspectRequired, dailyInspectResult, workerInspectResult, carrierRequired, outputCarrier.carrier?.carrierNo]);
  const guide = usePrepGuide(guideSteps);

  // 설비정지 중이면 막는다 — 서버(issueLabel/confirmAssembly)에도 같은 게이트가 걸려 있다.
  const canIssue =
    !!selectedOrder && !!processCode && !!equipCode && sgReady && !issuedFg && !issuing && !confirming
    && !equipStop.isStopped
    && (!dailyInspectRequired || interlock.dailyInspectDone)
    && (!workerInspectRequired || interlock.workerInspectDone);
  const issueDisabledReason = equipStop.isStopped ? t('kiosk.equipStop.blockReason', '설비가 정지 중입니다. 정지를 해제한 뒤 실적을 등록하세요.')
    : issuing || confirming ? t('common.actionProcessingHelp', '처리 중입니다. 완료될 때까지 기다려 주세요.')
    : issuedFg ? t('production.inputAssembly.finishIssuedHelp', '발행된 FG 라벨을 스캔하여 확정하거나 발행을 취소하세요.')
    : !selectedOrder ? t('production.inputAssembly.requireOrder', '작업지시를 선택하세요.')
    : !processCode ? t('production.subprocess.requireProcess', '공정을 선택하세요.')
    : !equipCode ? t('production.inputAssembly.requireEquip', '설비를 선택하세요.')
    : dailyInspectRequired && !interlock.dailyInspectDone
      ? (dailyInspectResult
        ? t('production.inspect.dailyNgBlock', '설비 일상점검 종합판정이 NG입니다. 조치 후 재점검하세요.')
        : '설비 일상점검을 먼저 완료하세요.')
    : workerInspectRequired && !interlock.workerInspectDone
      ? (workerInspectResult
        ? t('production.inspect.workerNgBlock', '작업자 설비점검 종합판정이 NG입니다. 조치 후 재점검하세요.')
        : '작업자 설비점검을 먼저 완료하세요.')
    : t('production.inputAssembly.sgNotReadyHelp', '필요한 반제품을 스캔하고 잔량을 확인하세요.');

  const onIssue = useCallback(async () => {
    if (actionPending.current || issuedFg || !sgReady) return;
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

    actionPending.current = true;
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
      actionPending.current = false;
      setIssuing(false);
    }
  }, [equipCode, issuedFg, processCode, selectedOrder, sgList.length, sgReady, t]);

  const onConfirmScan = useCallback(
    async (scanned: string) => {
      if (actionPending.current || !issuedFg || !sgReady) return;
      if (issuedFg && scanned !== issuedFg) {
        toast.error(t("production.inputAssembly.confirmMismatch", "발행된 라벨과 일치하지 않습니다."));
        return;
      }
      if (!selectedOrder) return;

      actionPending.current = true;
      setConfirming(true);
      try {
        const res = await api.post("/production/subprocess-kitting/confirm", {
          fgBarcode: scanned,
          orderNo: selectedOrder.orderNo,
          equipCode,
          processCode,
          sgBarcodes: sgList.map((s) => s.sgBarcode),
          carrierNo: outputCarrier.carrier?.carrierNo ?? undefined,
        });
        toast.success(t("production.inputAssembly.confirmSuccess", "조립이 확정되었습니다."));
        // FG 라벨 데이터는 항상 발행되며, 인쇄 여부는 백엔드 printFg(라우팅 ISSUE_LABEL_TYPE='FG')로 제어한다.
        const confirmData = res.data?.data as { fgBarcode?: string; printFg?: boolean; sgLabels?: SgLabelInfo[] } | undefined;
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
        applyConfirmed(confirmData?.sgLabels);
        setIssuedFg(null);
        setProductivityRevision(value => value + 1);
        void outputCarrier.refresh();
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.inputAssembly.confirmFailed", "조립 확정에 실패했습니다.");
        if (message.startsWith("대차 교체")) {
          // 대차 용량 초과 안내는 onCapacityRejected가 자체 토스트로 띄운다(중복 토스트 방지).
          outputCarrier.onCapacityRejected();
        } else {
          toast.error(message);
        }
        await refreshAfterFailure();
      } finally {
        actionPending.current = false;
        setConfirming(false);
      }
    },
    [equipCode, issuedFg, processCode, selectedOrder, sgList, sgReady, applyConfirmed, refreshAfterFailure, t, outputCarrier],
  );

  const onResetIssued = useCallback(() => {
    setIssuedFg(null);
  }, []);

  /** 전체화면(chromeless) 토글 — input-kiosk와 동일하게 ?view=full + document fullscreen */

  return {
    // 선택 상태
    selectedOrder, orderScan, setOrderScan, orderSearchOpen, setOrderSearchOpen,
    processCode, processName, equipCode, equipName, equips,
    selectedWorkers, removeWorker, workerNames,
    // 모달 열림 상태
    equipModalOpen, setEquipModalOpen, workerModalOpen, setWorkerModalOpen,
    dailyInspectOpen, setDailyInspectOpen, workerInspectOpen, setWorkerInspectOpen,
    // 점검 인터록
    interlock, dailyInspectRequired, workerInspectRequired,
    dailyInspectResult, workerInspectResult, inspectDoneDetail, inspectNgDetail, refreshInspectStatus,
    // 조립 데이터
    requirements, sgList, setSgList, addSg, removeSg,
    continuous, setContinuous, sgReady, issuedFg, productivityRevision,
    // 대차
    carrierFlags, outputCarrier,
    // 설비정지 · 관리자호출
    equipStop, isEquipStopOpen, setIsEquipStopOpen, isManagerCallOpen, setIsManagerCallOpen,
    // 준비 안내
    guide,
    // 동작
    selectOrder, fetchOrderByNo, clearOrder, resetAll,
    handleEquipSelect, handleWorkerSelect, restoreEquipmentCurrentState,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    contextLocked, issueDisabledReason,
    // ref
    orderScanRef, fgPrinterRef,
  };
}

export type InputAssemblyController = ReturnType<typeof useInputAssemblyController>;
