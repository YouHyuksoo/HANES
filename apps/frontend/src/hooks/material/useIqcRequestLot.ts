/**
 * IQC 검사의뢰 LOT 구성 훅. 모집단은 담당자가 담은 PENDING 입하 수량 합이다.
 *
 * 이 훅은 LOT 구성과 검사의뢰까지만 다룬다. 합불 판정은 AQL 정책을 타는 IQC 검사 화면에서 한다.
 * AQL 산출값은 모집단 크기 판단을 돕는 참고 표시용이며 입력값이 아니다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "@/services/api";

export interface RequestCandidate {
  arrivalNo: string;
  /** MAT_ARRIVALS.SEQ. arrivalNo 단독으로는 입하 행이 유일하지 않다. */
  seq: number;
  itemCode: string;
  qty: number;
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

interface AqlPreview {
  sampleQty?: number | null;
  inspectionLevel?: string | null;
  inspectionMode?: string | null;
  judgeReason?: string | null;
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
  const [aql, setAql] = useState<AqlPreview | null>(null);
  const [partOpen, setPartOpen] = useState(false);

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
    try {
      await api.post("/quality/iqc-request-lots", {
        itemCode: itemCode.trim(),
        invoiceNo: invoiceFilter.trim() || undefined,
        lines: basket.map((row) => ({ arrivalNo: row.arrivalNo, arrivalSeq: row.seq, lineRole: row.lineRole })),
      });
      toast.success(t("material.iqcRequestLot.created", "검사의뢰 LOT을 등록했습니다."));
      setBasket([]);
      await refresh();
    } catch {
      toast.error(t("common.saveFailed"));
    }
  };

  const cancelRequest = async (requestNo: string) => {
    try {
      await api.post(`/quality/iqc-request-lots/${encodeURIComponent(requestNo)}/cancel`);
      toast.success(t("material.iqcRequestLot.canceled", "의뢰를 취소했습니다."));
      await refresh();
    } catch {
      toast.error(t("common.saveFailed"));
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
    refresh,
    addToBasket,
    removeFromBasket,
    addVisible,
    confirmRequest,
    cancelRequest,
  };
}
