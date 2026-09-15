/**
 * IQC 검사의뢰 LOT 구성 훅. 모집단은 담당자가 담은 PENDING 입하 수량 합이다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "@/services/api";

export interface RequestCandidate {
  arrivalNo: string;
  itemCode: string;
  qty: number;
  invoiceNo: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  arrivalDate: string | null;
}

export interface RequestLine {
  arrivalNo: string;
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
  lines: RequestLine[];
}

export type BasketRow = RequestCandidate & { lineRole: "SAMPLE" | "REPRESENTED" };

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
  const [inspectTarget, setInspectTarget] = useState<RequestRow | null>(null);
  const [inspector, setInspector] = useState("");
  const [sampleQty, setSampleQty] = useState("");
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
        .then((res) => {
          const data = res.data?.data ?? null;
          setAql(data);
          if (data?.sampleQty != null) {
            setSampleQty((prev) => prev || String(data.sampleQty));
          }
        })
        .catch(() => setAql(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [itemCode, vendorCode, lotQty]);

  const addToBasket = (row: RequestCandidate, role: "SAMPLE" | "REPRESENTED") => {
    setBasket((prev) => {
      const rest = prev.filter((x) => x.arrivalNo !== row.arrivalNo);
      return [...rest, { ...row, lineRole: role }];
    });
  };

  const addVisible = (role: "SAMPLE" | "REPRESENTED") => {
    setBasket((prev) => {
      const map = new Map(prev.map((row) => [row.arrivalNo, row]));
      for (const row of visibleCandidates) {
        map.set(row.arrivalNo, { ...row, lineRole: map.get(row.arrivalNo)?.lineRole ?? role });
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
        sampleQty: sampleQty ? Number(sampleQty) : undefined,
        lines: basket.map((row) => ({ arrivalNo: row.arrivalNo, lineRole: row.lineRole })),
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

  const inspect = async (result: "PASS" | "FAIL") => {
    if (!inspectTarget) return;
    try {
      await api.post(`/quality/iqc-request-lots/${encodeURIComponent(inspectTarget.requestNo)}/inspect`, {
        result,
        inspectorName: inspector || undefined,
        sampleQty: sampleQty ? Number(sampleQty) : inspectTarget.sampleQty,
      });
      toast.success(t("material.iqcRequestLot.judged", "의뢰 LOT을 일괄 판정했습니다."));
      setInspectTarget(null);
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
    inspectTarget,
    setInspectTarget,
    inspector,
    setInspector,
    sampleQty,
    setSampleQty,
    aql,
    partOpen,
    setPartOpen,
    lotQty,
    refresh,
    addToBasket,
    addVisible,
    confirmRequest,
    cancelRequest,
    inspect,
  };
}
