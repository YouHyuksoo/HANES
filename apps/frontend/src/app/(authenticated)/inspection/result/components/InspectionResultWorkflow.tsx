"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { ScanLine, RefreshCw, Search, Sparkles } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeLabel } from "@/hooks/useComCode";
import api from "@/services/api";
import type { JobOrderRow } from "../types";
import InspectPanel from "./InspectPanel";
import ConsumablePanel from "./ConsumablePanel";
import InspectStationHeader from "./InspectStationHeader";
import InspectPrepGuideModal from "./InspectPrepGuideModal";
import SampleCheckModal from "./SampleCheckModal";
import SampleCheckHistoryModal from "./SampleCheckHistoryModal";
import { DailyInspectModal, WorkerInspectModal } from "@/components/inspect";
import useInspectPrepStatus from "../hooks/useInspectPrepStatus";
import { usePrepGuide } from "@/components/shared/prep-guide";
import { buildPrepGuideSteps } from "../hooks/prepGuideSteps";

interface TesterEquip {
  equipCode: string;
  equipName: string;
}

/** /equipment/equips/type/TESTER 응답을 {equipCode, equipName}로 정규화 */
function normalizeTesters(payload: unknown): TesterEquip[] {
  const arr = Array.isArray(payload) ? payload : [];
  return arr.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const rec = item as Record<string, unknown>;
    if (typeof rec.equipCode !== "string") return [];
    const equipName =
      typeof rec.equipName === "string" && rec.equipName.trim() ? rec.equipName : rec.equipCode;
    return [{ equipCode: rec.equipCode, equipName }];
  });
}

interface Props {
  titleKey: string;
  descriptionKey: string;
  searchPlaceholderKey: string;
  selectOrderKey: string;
  inspectType: "CONTINUITY" | "TERMINAL";
  /** 좌측 작업지시 목록을 완제품(FINISHED) 작업지시로만 제한 */
  finishedOnly?: boolean;
}

export default function InspectionResultWorkflow({
  titleKey,
  descriptionKey,
  searchPlaceholderKey,
  selectOrderKey,
  inspectType,
  finishedOnly = false,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<JobOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<JobOrderRow | null>(null);
  const [searchText, setSearchText] = useState("");
  /** 검사기(TESTER) 선택 — 소모품 조회/장착 + 검사 실적 기록의 설비 기준 */
  const [testers, setTesters] = useState<TesterEquip[]>([]);
  const [selectedEquipCode, setSelectedEquipCode] = useState("");
  /** 선택 검사기는 스테이션 단위로 localStorage에 유지(검사 유형별 분리) */
  const equipStorageKey = `hanes:inspection:equip:${inspectType}`;
  /** 검사기 선택 변경 시 localStorage에 저장 */
  const handleSelectEquip = useCallback((code: string) => {
    setSelectedEquipCode(code);
    try {
      if (code) localStorage.setItem(equipStorageKey, code);
      else localStorage.removeItem(equipStorageKey);
    } catch {
      // localStorage 비가용 시 무시(세션 한정 동작)
    }
  }, [equipStorageKey]);
  /** 점검·대조 모달 열림 상태 */
  const [dailyInspectOpen, setDailyInspectOpen] = useState(false);
  const [workerInspectOpen, setWorkerInspectOpen] = useState(false);
  const [sampleCheckOpen, setSampleCheckOpen] = useState(false);
  const [sampleHistoryOpen, setSampleHistoryOpen] = useState(false);
  /** 작업자 선택 모달 — 헤더와 준비 안내 모달이 같은 모달을 연다 */
  const [workerSelectOpen, setWorkerSelectOpen] = useState(false);
  /** 전체화면(chromeless) 모드 — view=full 쿼리 + 브라우저 Fullscreen API */
  const isFullView = searchParams.get("view") === "full";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 헤더의 소모품 카드에서 좌측 소모품 패널로 이동 */

  const [debouncedSearch, setDebouncedSearch] = useState("");

  /** 검사기(TESTER) 목록 로드 + 저장된 선택 복원 */
  useEffect(() => {
    // 저장된 검사기를 먼저 복원(목록 로드 전에도 유지)
    let saved = "";
    try {
      saved = localStorage.getItem(equipStorageKey) ?? "";
    } catch {
      saved = "";
    }
    if (saved) setSelectedEquipCode(saved);

    api
      .get("/equipment/equips/type/TESTER")
      .then((res) => {
        const list = normalizeTesters(res.data?.data ?? []);
        setTesters(list);
        // 저장된 검사기가 더 이상 목록에 없으면 정리
        if (saved && !list.some((e) => e.equipCode === saved)) {
          setSelectedEquipCode("");
          try {
            localStorage.removeItem(equipStorageKey);
          } catch {
            // 무시
          }
        }
      })
      .catch(() => setTesters([]));
  }, [equipStorageKey]);

  /** 전체화면 토글 — view=full 라우팅 + Fullscreen API (키오스크와 동일 패턴) */
  const toggleFullscreen = useCallback(() => {
    if (isFullView) {
      router.push(pathname);
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push(`${pathname}?view=full`);
    void document.documentElement.requestFullscreen?.();
  }, [isFullView, pathname, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/job-orders", {
        params: finishedOnly ? { finishedOnly: "true" } : {},
      });
      setOrders(res.data?.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [finishedOnly]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /** 작업지시가 정확히 1개이면 자동 선택 */
  useEffect(() => {
    if (orders.length === 1) setSelected(orders[0]);
  }, [orders]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return orders;
    const q = debouncedSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.itemName ?? "").toLowerCase().includes(q) ||
        o.itemCode.toLowerCase().includes(q),
    );
  }, [orders, debouncedSearch]);

  /** 상태별 그룹 — 진행중(RUNNING/IN_PROGRESS) 위, 대기중(WAITING) 아래, 섞지 않고 영역 분리 */
  const runningOrders = useMemo(() => filtered.filter((o) => o.status === "RUNNING" || o.status === "IN_PROGRESS"), [filtered]);
  const waitingOrders = useMemo(() => filtered.filter((o) => o.status === "WAITING"), [filtered]);
  const runningLabel = useComCodeLabel("JOB_ORDER_STATUS", "RUNNING");
  const waitingLabel = useComCodeLabel("JOB_ORDER_STATUS", "WAITING");

  /** 그리드 컬럼 — 지시번호 / 품명 / 상태 / 계획 / 양품 / 불량 */
  const columns = useMemo<ColumnDef<JobOrderRow>[]>(() => [
    {
      accessorKey: "orderNo", header: t("production.result.orderNo"), size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-text">{getValue() as string}</span>,
    },
    {
      id: "itemName", header: t("master.part.partName"), size: 140,
      accessorFn: (o) => o.itemName ?? o.itemCode,
      cell: ({ getValue }) => <span className="text-xs text-text-muted truncate">{getValue() as string}</span>,
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
      meta: { align: "center" },
    },
    {
      accessorKey: "planQty", header: t("inspection.result.planQty"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
    {
      accessorKey: "goodQty", header: t("inspection.result.pass"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs text-green-600 dark:text-green-400">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
    {
      accessorKey: "defectQty", header: t("inspection.result.fail"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs text-red-600 dark:text-red-400">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
  ], [t]);

  /** 상태 그룹 헤더 */
  const renderGroupHeader = (label: string, count: number) => (
    <div className="flex items-center gap-2 px-1 pt-2 pb-1 first:pt-0">
      <span className="text-xs font-semibold text-text">{label}</span>
      <span className="text-xs text-text-muted tabular-nums">{count}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );

  /** 상태 그룹별 작업지시 그리드 */
  const renderOrderGrid = (rows: JobOrderRow[]) => (
    <DataGrid
      data={rows}
      columns={columns}
      pageSize={100}
      enableColumnFilter={false}
      enableColumnResizing={false}
      enableColumnReordering={false}
      onRowClick={(row) => setSelected(row)}
      selectedRowId={selected?.orderNo}
      getRowId={(row) => row.orderNo}
      sqlQuery={`SELECT *
FROM JOB_ORDERS jo
JOIN ITEM_MASTERS p ON p.ITEM_CODE = jo.ITEM_CODE
WHERE jo.COMPANY = :company
  AND jo.PLANT_CD = :plant
  AND jo.STATUS IN ('RUNNING', 'IN_PROGRESS', 'WAITING')${finishedOnly ? "\n  AND p.ITEM_TYPE = 'FINISHED'" : ""}
ORDER BY jo.PRIORITY ASC, jo.PLAN_DATE ASC`}
    />
  );

  /** 준비 상태(작업자·설비점검·양불대조·소모품) 단일 소스 */
  const prep = useInspectPrepStatus({
    orderNo: selected?.orderNo,
    itemCode: selected?.itemCode,
    inspectType,
    equipCode: selectedEquipCode || undefined,
    noWorkerMessage: t("inspection.result.prep.selectWorkerFirst"),
    noEquipMessage: t("inspection.result.prep.selectEquipFirst"),
    consumableMessage: t("inspection.result.prep.consumableNotReady"),
  });

  /** 진입 안내 — 검사기→작업자→작업지시→점검→대조 순서로 유도하고, 끝나면 자동으로 닫힌다 */
  const guideSteps = useMemo(
    () => buildPrepGuideSteps({ hasEquip: Boolean(selectedEquipCode), hasOrder: Boolean(selected), prep }),
    [selectedEquipCode, selected, prep],
  );
  const guide = usePrepGuide(guideSteps);

  const inspectContext = useMemo(() => ({
    equip: selectedEquipCode
      ? {
        equipCode: selectedEquipCode,
        equipName: testers.find((e) => e.equipCode === selectedEquipCode)?.equipName ?? selectedEquipCode,
      }
      : null,
    jobOrder: selected ? { orderNo: selected.orderNo, itemName: selected.itemName } : null,
    workers: prep.workers.map((w) => ({ id: w.id, workerName: w.workerName })),
  }), [selectedEquipCode, testers, selected, prep.workers]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ScanLine className="w-7 h-7 text-primary" />
            {t(titleKey)}
          </h1>
          <p className="text-text-muted mt-1">{t(descriptionKey)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={guide.openGuide}
            data-testid="inspect-guide-open"
            title={t("prepGuide.reopen")}
          >
            <Sparkles className="w-4 h-4 mr-1 text-primary" />
            {t("prepGuide.reopen")}
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchOrders}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 상단 스테이션 헤더 — 실적입력(가공)과 같은 형식으로 검사기·작업지시·작업자·준비점검을 한 줄에 모은다 */}
      <InspectStationHeader
        testers={testers}
        equipCode={selectedEquipCode}
        onSelectEquip={handleSelectEquip}
        order={selected}
        prep={prep}
        onOpenDailyInspect={() => setDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setWorkerInspectOpen(true)}
        onOpenSampleCheck={() => setSampleCheckOpen(true)}
        onOpenSampleCheckHistory={() => setSampleHistoryOpen(true)}
        isFullView={isFullView}
        onToggleFullscreen={toggleFullscreen}
        workerSelectOpen={workerSelectOpen}
        onWorkerSelectOpenChange={setWorkerSelectOpen}
      />

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="col-span-4 flex flex-col gap-4 min-h-0 overflow-hidden">
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col" padding="none">
            <CardContent className="flex flex-col h-full p-3 gap-2">
              <Input
                placeholder={t(searchPlaceholderKey)}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
              <div className="flex-1 overflow-auto min-h-0">
                {filtered.length === 0 && !loading && (
                  <p className="text-sm text-text-muted text-center mt-8">
                    {t("common.noData")}
                  </p>
                )}
                {runningOrders.length > 0 && (
                  <>
                    {renderGroupHeader(runningLabel, runningOrders.length)}
                    {renderOrderGrid(runningOrders)}
                  </>
                )}
                {waitingOrders.length > 0 && (
                  <>
                    {renderGroupHeader(waitingLabel, waitingOrders.length)}
                    {renderOrderGrid(waitingOrders)}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 소모성 설비부품 (좌측 하단) — 매핑 표시 + conUid 스캔 장착 */}
          {selected && (
            <div className="shrink-0">
              <ConsumablePanel
                key={`${selected.orderNo}::${selectedEquipCode}`}
                orderNo={selected.orderNo}
                equipCode={selectedEquipCode || undefined}
                onStatusChange={prep.setConsumableStatus}
              />
            </div>
          )}
        </div>

        <div className="col-span-8 overflow-hidden flex flex-col">
          {selected ? (
            <InspectPanel
              key={`${inspectType}-${selected.orderNo}`}
              order={selected}
              inspectType={inspectType}
              equipCode={selectedEquipCode || undefined}
              prep={prep}
            />
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-text-muted">
                  <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t(selectOrderKey)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <InspectPrepGuideModal
        open={guide.open}
        steps={guide.steps}
        current={guide.current}
        doneCount={guide.doneCount}
        allReady={guide.allReady}
        onClose={guide.closeGuide}
        testers={testers}
        equipCode={selectedEquipCode}
        onSelectEquip={handleSelectEquip}
        orders={orders}
        selectedOrderNo={selected?.orderNo ?? null}
        onSelectOrder={setSelected}
        workers={prep.workers}
        onOpenWorkerSelect={() => setWorkerSelectOpen(true)}
        onOpenDailyInspect={() => setDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setWorkerInspectOpen(true)}
        onOpenSampleCheck={() => setSampleCheckOpen(true)}
      />
      <DailyInspectModal
        isOpen={dailyInspectOpen}
        onClose={() => setDailyInspectOpen(false)}
        onDone={() => { setDailyInspectOpen(false); void prep.refresh(); }}
        context={inspectContext}
      />
      <WorkerInspectModal
        isOpen={workerInspectOpen}
        onClose={() => setWorkerInspectOpen(false)}
        onDone={() => { setWorkerInspectOpen(false); void prep.refresh(); }}
        context={inspectContext}
      />
      {selected && selectedEquipCode && (
        <SampleCheckModal
          isOpen={sampleCheckOpen}
          onClose={() => setSampleCheckOpen(false)}
          onDone={() => { void prep.refresh(); }}
          orderNo={selected.orderNo}
          itemCode={selected.itemCode}
          equipCode={selectedEquipCode}
          inspectType={inspectType}
          workerId={prep.workers[0]?.id ?? null}
        />
      )}
      {selected && (
        <SampleCheckHistoryModal
          isOpen={sampleHistoryOpen}
          onClose={() => setSampleHistoryOpen(false)}
          orderNo={selected.orderNo}
          inspectType={inspectType}
        />
      )}
    </div>
  );
}
