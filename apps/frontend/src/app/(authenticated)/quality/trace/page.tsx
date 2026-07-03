"use client";

/**
 * @file src/app/(authenticated)/quality/trace/page.tsx
 * @description 추적성조회 페이지 — WebDisplay식 추적 방식 선택 모달 + 후보 목록 + 제품 이력 상세
 */
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Search } from "lucide-react";
import { Card, CardHeader, CardContent, Button } from "@/components/ui";
import api from "@/services/api";
import type {
  ProductTraceabilityDto,
  TraceCandidate,
  TraceCandidatesResult,
  TraceSearchInput,
  TraceSearchMode,
} from "./types";
import MaterialSection from "./components/MaterialSection";
import SemiProductSection from "./components/SemiProductSection";
import EquipInspectionSection from "./components/EquipInspectionSection";
import EquipConsumableSection from "./components/EquipConsumableSection";
import DefectRepairSection from "./components/DefectRepairSection";
import TraceSearchWizard from "./components/TraceSearchWizard";

const MODE_LABELS: Record<TraceSearchMode, string> = {
  product: "제품 바코드",
  material: "자재 UID",
  supplierLot: "원자재 업체 LOT",
  box: "박스번호",
  pallet: "팔레트번호",
  shipOrder: "출하지시번호",
  equipment: "설비 + 기간",
  operator: "작업자 + 기간",
  workOrder: "작업지시번호",
  sg: "SFG 바코드",
};

export default function TracePage() {
  const { t } = useTranslation();
  const [isWizardOpen, setWizardOpen] = useState(true);
  const [currentSearch, setCurrentSearch] = useState<{ mode: TraceSearchMode; summary: string } | null>(null);
  const [candidateItems, setCandidateItems] = useState<TraceCandidate[]>([]);
  const [selectedTraceKey, setSelectedTraceKey] = useState("");
  const [data, setData] = useState<ProductTraceabilityDto | null>(null);
  const [searched, setSearched] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [largeCandidateConfirm, setLargeCandidateConfirm] = useState<{
    input: TraceSearchInput;
    total: number;
    limit: number;
    message: string | null;
  } | null>(null);

  const selectedCandidate = useMemo(
    () => candidateItems.find((item) => item.traceKey === selectedTraceKey) ?? null,
    [candidateItems, selectedTraceKey],
  );

  const fetchProductTrace = useCallback(async (traceKey: string) => {
    if (!traceKey.trim()) return;
    setSelectedTraceKey(traceKey);
    setDetailLoading(true);
    setSearched(true);
    setError("");
    try {
      const res = await api.get("/quality/trace", {
        params: { serial: traceKey },
      });
      setData(res.data?.data ?? null);
    } catch {
      setData(null);
      setError(t("quality.trace.loadFailed", "추적 상세를 조회하지 못했습니다."));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const fetchCandidates = useCallback(async (input: TraceSearchInput, confirmLarge = false) => {
    setWizardOpen(false);
    setListLoading(true);
    setCandidateItems([]);
    setSelectedTraceKey("");
    setData(null);
    setError("");
    setSearched(false);
    setLargeCandidateConfirm(null);

    const params =
      input.mode === "equipment"
        ? {
            mode: input.mode,
            equipCode: input.equipCode,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            confirmLarge: confirmLarge ? "true" : undefined,
          }
        : input.mode === "operator"
        ? {
            mode: input.mode,
            value: input.value,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            confirmLarge: confirmLarge ? "true" : undefined,
          }
        : { mode: input.mode, value: input.value, confirmLarge: confirmLarge ? "true" : undefined };
    const summary =
      input.mode === "equipment"
        ? `${input.equipCode} · ${input.dateFrom}~${input.dateTo}`
        : input.mode === "operator"
        ? `${input.value} · ${input.dateFrom}~${input.dateTo}`
        : input.value;

    try {
      const res = await api.get("/quality/trace/candidates", { params });
      const payload = res.data?.data as TraceCandidate[] | TraceCandidatesResult | undefined;
      const result: TraceCandidatesResult = Array.isArray(payload)
        ? { candidates: payload, requiresConfirmation: false, total: payload.length, limit: 500, message: null }
        : payload ?? { candidates: [], requiresConfirmation: false, total: 0, limit: 500, message: null };

      setCurrentSearch({ mode: input.mode, summary });
      if (result.requiresConfirmation && !confirmLarge) {
        setLargeCandidateConfirm({ input, total: result.total, limit: result.limit, message: result.message });
        return;
      }

      const items = result.candidates;
      setCandidateItems(items);
      if (items.length === 1 && items[0].traceType === "FG") {
        await fetchProductTrace(items[0].traceKey);
      }
    } catch {
      setCurrentSearch({ mode: input.mode, summary });
      setError(t("quality.trace.candidateLoadFailed", "추적 후보를 조회하지 못했습니다."));
    } finally {
      setListLoading(false);
    }
  }, [fetchProductTrace, t]);

  const handleCandidateClick = useCallback((candidate: TraceCandidate) => {
    setSelectedTraceKey(candidate.traceKey);
    if (candidate.traceType === "FG") {
      fetchProductTrace(candidate.traceKey);
      return;
    }
    setData(null);
    setSearched(true);
  }, [fetchProductTrace]);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-7 w-7 text-primary" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text">{t("quality.trace.title")}</h1>
            <p className="text-text-muted mt-1">{t("quality.trace.description")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {currentSearch && (
              <div className="hidden min-w-0 max-w-[520px] truncate rounded border border-border bg-card px-3 py-1.5 text-xs text-text-muted xl:block">
                <span className="font-semibold text-text">{MODE_LABELS[currentSearch.mode]}</span>
                <span className="mx-2 text-border-hover">/</span>
                <span className="font-mono">{currentSearch.summary}</span>
              </div>
            )}
            <Button onClick={() => setWizardOpen(true)} leftIcon={<Search className="h-4 w-4" />}>
              {currentSearch
                ? t("quality.trace.changeMode", "방식 변경")
                : t("quality.trace.startTrace", "추적 시작")}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-80 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">
              {t("quality.trace.candidates", "추적 후보")} {candidateItems.length > 0 && `(${candidateItems.length})`}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {currentSearch
                ? `${MODE_LABELS[currentSearch.mode]} · ${currentSearch.summary}`
                : t("quality.trace.openWizardHint", "추적 시작을 눌러 방식을 선택하세요.")}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listLoading && (
              <div className="px-4 py-6 text-sm text-text-muted">
                {t("common.loading", "로딩 중...")}
              </div>
            )}

            {!listLoading && currentSearch && candidateItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                {t("quality.trace.noCandidates", "조회된 추적 후보가 없습니다.")}
              </div>
            )}

            {!listLoading && !currentSearch && (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                {t("quality.trace.startWithWizard", "제품, 자재, 박스, 설비 등 가진 단서로 추적을 시작합니다.")}
              </div>
            )}

            {candidateItems.map((candidate) => (
              <button
                key={`${candidate.traceType}-${candidate.traceKey}`}
                type="button"
                onClick={() => handleCandidateClick(candidate)}
                className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-card-hover ${
                  selectedTraceKey === candidate.traceKey ? "bg-primary/10 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                    {candidate.traceType}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-primary">
                    {candidate.traceKey}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm text-text">
                  {candidate.itemName || candidate.itemCode || "-"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                  <span className="truncate">{candidate.orderNo ?? "-"}</span>
                  {candidate.status && candidate.traceType === "FG" && (
                    <FgStatusBadge status={candidate.status} />
                  )}
                  {candidate.status && candidate.traceType === "SG" && (
                    <span className="text-xs text-text-muted">{candidate.status}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-6">
          {detailLoading && (
            <Card>
              <CardContent>
                <div className="py-12 text-center text-text-muted">
                  {t("quality.trace.loadingDetail", "추적 상세 조회 중...")}
                </div>
              </CardContent>
            </Card>
          )}

          {!detailLoading && searched && !data && selectedCandidate?.traceType === "SG" && (
            <Card>
              <CardContent>
                <div className="py-12 text-center text-text-muted">
                  {t("quality.trace.sgOnlyCandidate", "선택한 SG는 연결 제품 후보가 없어 제품 제조이력 상세를 표시할 수 없습니다.")}
                </div>
              </CardContent>
            </Card>
          )}

          {!detailLoading && searched && !data && selectedCandidate?.traceType !== "SG" && (
            <Card>
              <CardContent>
                <div className="py-12 text-center text-text-muted">
                  {t("quality.trace.noResults")}
                </div>
              </CardContent>
            </Card>
          )}

          {!detailLoading && !searched && (
            <Card>
              <CardContent>
                <div className="py-12 text-center text-text-muted">
                  {candidateItems.length > 0
                    ? t("quality.trace.selectCandidate", "좌측 후보를 선택하면 제조이력이 표시됩니다.")
                    : t("quality.trace.openWizardHint", "추적 시작을 눌러 방식을 선택하세요.")}
                </div>
              </CardContent>
            </Card>
          )}

          {!detailLoading && data && <TraceDetail data={data} />}
        </main>
      </div>

      <TraceSearchWizard
        isOpen={isWizardOpen}
        loading={listLoading}
        onClose={() => setWizardOpen(false)}
        onSubmit={fetchCandidates}
      />

      <LargeCandidateConfirmModal
        state={largeCandidateConfirm}
        loading={listLoading}
        onCancel={() => setLargeCandidateConfirm(null)}
        onConfirm={() => {
          if (!largeCandidateConfirm) return;
          fetchCandidates(largeCandidateConfirm.input, true);
        }}
      />
    </div>
  );
}

function LargeCandidateConfirmModal({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: { total: number; limit: number; message: string | null } | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <h3 className="text-sm font-semibold">
          {t("quality.trace.largeCandidateConfirmTitle", "대량 후보 조회 확인")}
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          {state.message ??
            t(
              "quality.trace.largeCandidateConfirmMessage",
              "연결 제품 후보가 {{total}}건입니다. {{limit}}건을 초과해 조회 시간이 길어질 수 있습니다. 계속 조회할까요?",
              { total: state.total, limit: state.limit },
            )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {t("common.cancel", "취소")}
          </Button>
          <Button type="button" onClick={onConfirm} isLoading={loading}>
            {t("quality.trace.continueLargeCandidateSearch", "감수하고 조회")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TraceDetail({ data }: { data: ProductTraceabilityDto }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t("quality.trace.productInfo")} />
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
              <Field label={t("quality.trace.serialNo")} value={data.product.serialNo} mono />
              <Field label={t("quality.trace.partNo")} value={data.product.itemNo} />
              <Field label={t("quality.trace.partName")} value={data.product.itemName} />
              <Field label={t("quality.trace.workOrderNo")} value={data.product.orderNo ?? "-"} mono />
              <div className="min-w-0">
                <div className="text-xs text-text-muted mb-0.5">{t("quality.trace.statusCol")}</div>
                <FgStatusBadge status={data.product.status} />
              </div>
              <Field label={t("quality.trace.productionDate")} value={fmt(data.product.productionDate)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t("quality.trace.packaging")} />
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
              <Field label={t("quality.trace.boxNo")} value={data.packaging.boxNo ?? "-"} mono />
              <Field label={t("quality.trace.boxPackedAt")} value={fmt(data.packaging.boxPackedAt)} />
              <Field label={t("quality.trace.palletNo")} value={data.packaging.palletNo ?? "-"} mono />
              <Field label={t("quality.trace.palletPackedAt")} value={fmt(data.packaging.palletPackedAt)} />
              <Field label={t("quality.trace.shippedAt")} value={fmt(data.packaging.shippedAt)} />
              <Field label={t("quality.trace.shipOrderNo", "출하지시번호")} value={data.packaging.shipOrderNo ?? "-"} mono />
              <Field label={t("quality.trace.customerPoNo", "고객PO번호")} value={data.packaging.customerPoNo ?? "-"} mono />
              <Field label={t("quality.trace.customerName", "고객명")} value={data.packaging.customerName ?? "-"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t("quality.trace.processTimeline")} />
          <CardContent>
            <ul className="divide-y divide-border">
              {data.processHistory.map((s, i) => (
                <li key={`${i}-${s.timestamp}-${s.process}`} className="flex items-center gap-3 text-sm py-1.5">
                  <span className="font-mono text-xs text-text-muted shrink-0">
                    {s.timestamp.slice(5, 16).replace("T", " ")}
                  </span>
                  <span className="font-medium text-text">{s.processName}</span>
                  <span className="text-xs text-text-muted truncate">
                    {s.equipmentName} / {s.operator}
                  </span>
                  <span className="ml-auto shrink-0">{badge(s.result)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t("quality.trace.inspections")} />
          <CardContent>
            {data.inspections.length === 0 ? (
              <div className="text-sm text-text-muted py-1.5">
                {t("quality.trace.noInspections", "검사 기록 없음")}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.inspections.map((ir, i) => (
                  <li key={`${i}-${ir.inspectAt}-${ir.inspectType}`} className="flex items-center gap-3 text-sm py-1.5">
                    <span className="font-mono text-xs text-text-muted shrink-0">
                      {ir.inspectAt.slice(5, 16).replace("T", " ")}
                    </span>
                    <span className="font-medium text-text">{ir.inspectType}</span>
                    <span className="text-xs text-text-muted truncate">{ir.inspectorId}</span>
                    <span className="ml-auto shrink-0">{badge(ir.result)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("quality.trace.materials")} />
        <CardContent>
          <MaterialSection materials={data.materials} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t("quality.trace.semiProducts")} />
        <CardContent>
          <SemiProductSection semiProducts={data.semiProducts} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t("quality.trace.equipInspections", "설비점검 내역")} />
          <CardContent>
            <EquipInspectionSection inspections={data.equipInspections} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t("quality.trace.equipConsumables", "설비 장착 소모품")} />
          <CardContent>
            <EquipConsumableSection consumables={data.equipConsumables} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("quality.trace.defectRepair", "불량·수리 이력")} />
        <CardContent>
          <DefectRepairSection defects={data.defects} repairs={data.repairs} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className={`text-sm truncate ${mono ? "font-mono text-text" : "text-text"}`}>{value}</div>
    </div>
  );
}

function fmt(s: string | null): string {
  return s ? s.slice(0, 19).replace("T", " ") : "-";
}

function badge(r: "PASS" | "FAIL" | "WORK") {
  const cls =
    r === "PASS"
      ? "text-green-600 border-green-600"
      : r === "FAIL"
        ? "text-red-600 border-red-600"
        : "text-blue-600 border-blue-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      {r}
    </span>
  );
}

const FG_STATUS_CLS: Record<string, string> = {
  ISSUED:       "text-text-muted border-border",
  VISUAL_PASS:  "text-green-600 border-green-600",
  VISUAL_FAIL:  "text-red-600 border-red-600",
  PACKED:       "text-blue-600 border-blue-600",
  SHIPPED:      "text-purple-600 border-purple-600",
  VOIDED:       "text-red-400 border-red-400",
};

function FgStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = FG_STATUS_CLS[status] ?? "text-text-muted border-border";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>{t(`comCode.FG_LABEL_STATUS.${status}`, status)}</span>;
}
