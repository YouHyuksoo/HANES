"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ScanLine, RefreshCw, Search, Cpu, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import api from "@/services/api";
import type { JobOrderRow } from "../types";
import InspectPanel from "./InspectPanel";
import ConsumablePanel from "./ConsumablePanel";

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
  /** 소모성 설비부품 장착 인터락 상태 — ConsumablePanel(좌측 하단)이 보고, InspectPanel(우측 버튼)이 사용 */
  const [consumablesReady, setConsumablesReady] = useState(true);
  const [unmountedConsumCount, setUnmountedConsumCount] = useState(0);
  const handleConsumableStatus = useCallback((allMounted: boolean, unmounted: number) => {
    setConsumablesReady(allMounted);
    setUnmountedConsumCount(unmounted);
  }, []);
  /** 전체화면(chromeless) 모드 — view=full 쿼리 + 브라우저 Fullscreen API */
  const isFullView = searchParams.get("view") === "full";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** 브라우저 전체화면 상태 추적 */
  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

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
          <Button variant="secondary" size="sm" onClick={fetchOrders}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          {/* 전체화면 토글 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullView || isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            aria-label={isFullView || isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isFullView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="col-span-4 flex flex-col gap-4 min-h-0 overflow-hidden">
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col" padding="none">
            <CardContent className="flex flex-col h-full p-3 gap-2">
              {/* 검사기(TESTER) 선택 */}
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-primary shrink-0" />
                <Select
                  value={selectedEquipCode}
                  onChange={handleSelectEquip}
                  placeholder={t("inspection.result.selectEquip")}
                  options={testers.map((e) => ({ value: e.equipCode, label: `${e.equipName} (${e.equipCode})` }))}
                  className="flex-1"
                />
              </div>
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
                {filtered.map((o) => (
                  <button
                    key={o.orderNo}
                    onClick={() => setSelected(o)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg mb-1 transition-colors text-sm
                      ${selected?.orderNo === o.orderNo
                        ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                        : "hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent"
                      }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-semibold text-text truncate">{o.orderNo}</span>
                      <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={o.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-text-muted truncate text-xs min-w-0">{o.itemName ?? o.itemCode}</span>
                      <span
                        className="flex items-center gap-1 text-xs shrink-0 tabular-nums"
                        title={`${t("inspection.result.planQty")} ${o.planQty?.toLocaleString() ?? "-"} / ${t("inspection.result.pass")} ${o.goodQty?.toLocaleString() ?? "-"} / ${t("inspection.result.fail")} ${o.defectQty?.toLocaleString() ?? "-"}`}
                      >
                        <span className="text-text-muted">{o.planQty?.toLocaleString() ?? "-"}</span>
                        <span className="text-text-muted/40">/</span>
                        <span className="text-green-600 dark:text-green-400">{o.goodQty?.toLocaleString() ?? "-"}</span>
                        <span className="text-text-muted/40">/</span>
                        <span className="text-red-600 dark:text-red-400">{o.defectQty?.toLocaleString() ?? "-"}</span>
                      </span>
                    </div>
                  </button>
                ))}
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
                onStatusChange={handleConsumableStatus}
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
              consumablesReady={consumablesReady}
              unmountedConsumCount={unmountedConsumCount}
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
    </div>
  );
}
