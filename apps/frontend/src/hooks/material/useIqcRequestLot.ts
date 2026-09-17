/**
 * IQC 검사의뢰 LOT 구성 훅. 모집단은 담당자가 담은 PENDING 입하 수량 합이다.
 *
 * 이 훅은 LOT 구성과 검사의뢰까지만 다룬다. 합불 판정은 AQL 정책을 타는 IQC 검사 화면에서 한다.
 * AQL 산출값은 모집단 크기 판단을 돕는 참고 표시용이며 입력값이 아니다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { IQC_INSPECT_LOT_MODE_KEY, allowsIqcRequestLot } from "@harness/shared";
import type { IqcSampleQtySource } from "@harness/shared";
import api from "@/services/api";
import { useSysConfigStore } from "@/stores/sysConfigStore";

export interface RequestCandidate {
  arrivalNo: string;
  /** MAT_ARRIVALS.SEQ. arrivalNo 단독으로는 입하 행이 유일하지 않다. */
  seq: number;
  itemCode: string;
  /**
   * 검사대기(PENDING) 시리얼 INIT_QTY 합. MAT_ARRIVALS.QTY가 아니다.
   * 모집단(LOT_QTY)·검사대기 목록 표시 수량·판정 대상이 모두 이 기준이다.
   */
  qty: number;
  /** 이 입하 행에 달린 검사대기 시리얼 건수 */
  serialCount: number;
  invoiceNo: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  arrivalDate: string | null;
}

export interface RequestLine {
  arrivalNo: string;
  arrivalSeq: number;
  qty: number;
  lineRole: "SAMPLE" | "REPRESENTED";
  invoiceNo: string | null;
}

export interface RequestRow {
  requestNo: string;
  itemCode: string;
  itemName: string | null;
  invoiceNo: string | null;
  lotQty: number;
  sampleQty: number | null;
  status: string;
  /** 검사 시점에 AQL이 채운다. 의뢰 시점에는 null이다. */
  lines: RequestLine[];
}

export type BasketRow = RequestCandidate & { lineRole: "SAMPLE" | "REPRESENTED" };

/** 입하 행 식별 키. MAT_ARRIVALS PK가 (ARRIVAL_NO, SEQ) 복합키라 둘을 묶어야 행이 구분된다. */
export const arrivalRowKey = (row: { arrivalNo: string; seq: number }) => `${row.arrivalNo}#${row.seq}`;

interface AqlPreview extends IqcSampleQtySource {
  inspectionLevel?: string | null;
  inspectionMode?: string | null;
  judgeReason?: string | null;
}

/** 서버가 내려준 거절 사유(모드 가드, 중복 편성 등)를 삼키지 않고 그대로 보여준다. */
function resolveApiMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
}

export function useIqcRequestLot() {
  const { t } = useTranslation();
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [candidates, setCandidates] = useState<RequestCandidate[]>([]);
  const [basket, setBasket] = useState<BasketRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  // 의뢰 확정 진행 중 재제출 차단. 서버가 입하 행을 잠가 중복을 막지만,
  // 연타는 두 번째 요청이 잠금 대기로 매달렸다가 400으로 끝나 사용자에게 실패로 보인다.
  const [confirming, setConfirming] = useState(false);
  const [aql, setAql] = useState<AqlPreview | null>(null);
  const [partOpen, setPartOpen] = useState(false);
  // 검사 단위 모드. ARRIVAL이면 의뢰를 만들어도 IQC 검사대기에 뜨지 않으므로 서버가 생성을 막는다.
  // 판정 기준은 @harness/shared 단일 출처를 쓴다. 여기에 조건을 따로 적지 말 것.
  const inspectLotMode = useSysConfigStore((state) => state.getConfig(IQC_INSPECT_LOT_MODE_KEY));
  const requestLotEnabled = allowsIqcRequestLot(inspectLotMode);

  const lotQty = useMemo(() => basket.reduce((sum, row) => sum + row.qty, 0), [basket]);
  const vendorCode = basket[0]?.vendorCode ?? candidates[0]?.vendorCode ?? "";

  const visibleCandidates = useMemo(() => {
    const q = invoiceFilter.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((row) => (row.invoiceNo ?? "").toLowerCase().includes(q));
  }, [candidates, invoiceFilter]);

  const loadRequests = useCallback(async () => {
    const res = await api.get("/quality/iqc-request-lots", { params: itemCode ? { itemCode } : {} });
    setRequests(res.data?.data ?? []);
  }, [itemCode]);

  const loadCandidates = useCallback(async () => {
    if (!itemCode.trim()) {
      setCandidates([]);
      return;
    }
    const res = await api.get("/quality/iqc-request-lots/candidates", { params: { itemCode: itemCode.trim() } });
    setCandidates(res.data?.data ?? []);
  }, [itemCode]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCandidates(), loadRequests()]);
    } catch {
      toast.error(t("common.loadError"));
    } finally {
      setLoading(false);
    }
  }, [loadCandidates, loadRequests, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!itemCode.trim() || lotQty <= 0) {
      setAql(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get("/quality/aql/resolve-iqc-items", {
          params: { itemCode: itemCode.trim(), vendorCode, lotQty },
        })
        .then((res) => setAql(res.data?.data ?? null))
        .catch(() => setAql(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [itemCode, vendorCode, lotQty]);

  const addToBasket = (row: RequestCandidate, role: "SAMPLE" | "REPRESENTED") => {
    setBasket((prev) => {
      const key = arrivalRowKey(row);
      const rest = prev.filter((x) => arrivalRowKey(x) !== key);
      return [...rest, { ...row, lineRole: role }];
    });
  };

  const removeFromBasket = (row: { arrivalNo: string; seq: number }) => {
    const key = arrivalRowKey(row);
    setBasket((prev) => prev.filter((x) => arrivalRowKey(x) !== key));
  };

  const addVisible = (role: "SAMPLE" | "REPRESENTED") => {
    setBasket((prev) => {
      const map = new Map(prev.map((row) => [arrivalRowKey(row), row]));
      for (const row of visibleCandidates) {
        const key = arrivalRowKey(row);
        map.set(key, { ...row, lineRole: map.get(key)?.lineRole ?? role });
      }
      const next = [...map.values()];
      if (!next.some((row) => row.lineRole === "SAMPLE") && next[0]) {
        next[0] = { ...next[0], lineRole: "SAMPLE" };
      }
      return next;
    });
  };

  const confirmRequest = async () => {
    if (!requestLotEnabled) {
      toast.error(
        t(
          "material.iqcRequestLot.modeDisabled",
          "IQC 검사 단위가 입하단위(ARRIVAL)입니다. 시스템설정에서 검사 단위를 의뢰 LOT(REQUEST)으로 바꿔야 의뢰할 수 있습니다.",
        ),
      );
      return;
    }
    if (!itemCode.trim()) {
      toast.error(t("material.iqcRequestLot.needItem", "품목코드를 입력하세요."));
      return;
    }
    if (basket.length === 0) {
      toast.error(t("material.iqcRequestLot.needLines", "구성 입하를 선택하세요."));
      return;
    }
    if (!basket.some((row) => row.lineRole === "SAMPLE")) {
      toast.error(t("material.iqcRequestLot.needSample", "시료 입하를 한 건 이상 지정하세요."));
      return;
    }
    if (confirming) return;
    setConfirming(true);
    try {
      await api.post("/quality/iqc-request-lots", {
        itemCode: itemCode.trim(),
        invoiceNo: invoiceFilter.trim() || undefined,
        lines: basket.map((row) => ({ arrivalNo: row.arrivalNo, arrivalSeq: row.seq, lineRole: row.lineRole })),
      });
      toast.success(t("material.iqcRequestLot.created", "검사의뢰 LOT을 등록했습니다."));
      setBasket([]);
      await refresh();
    } catch (error: unknown) {
      toast.error(resolveApiMessage(error, t("common.saveFailed")));
    } finally {
      setConfirming(false);
    }
  };

  const cancelRequest = async (requestNo: string) => {
    try {
      await api.post(`/quality/iqc-request-lots/${encodeURIComponent(requestNo)}/cancel`);
      toast.success(t("material.iqcRequestLot.canceled", "의뢰를 취소했습니다."));
      await refresh();
    } catch (error: unknown) {
      toast.error(resolveApiMessage(error, t("common.saveFailed")));
    }
  };

  return {
    itemCode,
    setItemCode,
    itemName,
    setItemName,
    invoiceFilter,
    setInvoiceFilter,
    candidates: visibleCandidates,
    candidateTotal: candidates.length,
    basket,
    setBasket,
    requests,
    loading,
    aql,
    partOpen,
    setPartOpen,
    lotQty,
    inspectLotMode,
    requestLotEnabled,
    refresh,
    addToBasket,
    removeFromBasket,
    addVisible,
    confirmRequest,
    confirming,
    cancelRequest,
  };
}
