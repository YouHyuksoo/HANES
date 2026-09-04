"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/HvSpcBoard.tsx
 * @description 고전압 하네스 SPC 관리도 화면 본문 — 좌측 관리대상 목록 + 우측 관리도 상세.
 *
 * 초보자 가이드:
 * 1. 조회 조건(기간·k·공정·검색)은 이 컴포넌트가 들고, 목록/상세는 props 로만 받는다.
 * 2. 목록: GET /quality/spc/hv/targets?days=&k= — Cpk·상태·이탈 수 요약
 * 3. 상세: GET /quality/spc/hv/targets/:targetId?days=&k= — 서브그룹·관리한계·능력지수·규칙 위반
 * 4. 데이터가 목업(sourceKind='MOCK')이면 툴바 우측에 점선 배너로 알린다. 실 소스로 바뀌면 저절로 사라진다.
 * 5. 조회는 React Query(useApiQuery) 60초 자동 갱신. 응답은 ApiResponse 의 `data`.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiQuery } from "@/hooks/useApi";
import { SPC_DAY_OPTIONS, SPC_K_OPTIONS, type SpcTargetData, type SpcTargetsResponse } from "../types";
import HvSpcTargetList from "./HvSpcTargetList";
import HvSpcDetail from "./HvSpcDetail";
import "./hv-spc-theme.css";

const REFRESH_MS = 60_000;

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export default function HvSpcBoard() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const [kLimit, setKLimit] = useState<number>(0);
  const [processFilter, setProcessFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useApiQuery<SpcTargetsResponse>(
    ["quality", "spc", "hv", "targets", String(days), String(kLimit)],
    `/quality/spc/hv/targets?days=${days}&k=${kLimit}`,
    { refetchInterval: REFRESH_MS, retry: false },
  );
  const list = listQuery.data?.data;

  const processes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tg of list?.targets ?? []) if (!seen.has(tg.processCode)) seen.set(tg.processCode, tg.processName);
    return Array.from(seen, ([code, name]) => ({ code, name }));
  }, [list]);

  const visibleTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list?.targets ?? []).filter((tg) => {
      if (processFilter && tg.processCode !== processFilter) return false;
      if (!q) return true;
      return [tg.characteristic, tg.characteristicEn, tg.itemCode, tg.processName, tg.processCode]
        .some((s) => s.toLowerCase().includes(q));
    });
  }, [list, processFilter, search]);

  /* 선택이 없거나 필터로 사라졌으면 이탈 대상 → 첫 항목 순으로 자동 선택. state 가 아니라 파생값이라 effect 가 필요 없다 */
  const effectiveId = useMemo(() => {
    if (selectedId && visibleTargets.some((tg) => tg.id === selectedId)) return selectedId;
    const first = visibleTargets.find((tg) => tg.health === "OOC") ?? visibleTargets[0];
    return first?.id ?? null;
  }, [selectedId, visibleTargets]);

  const detailQuery = useApiQuery<SpcTargetData>(
    ["quality", "spc", "hv", "target", effectiveId ?? "", String(days), String(kLimit)],
    effectiveId ? `/quality/spc/hv/targets/${encodeURIComponent(effectiveId)}?days=${days}&k=${kLimit}` : null,
    { enabled: !!effectiveId, refetchInterval: REFRESH_MS, retry: false, placeholderData: (prev) => prev },
  );
  const detail = detailQuery.data?.data ?? null;

  const counts = useMemo(() => {
    const all = list?.targets ?? [];
    return {
      total: all.length,
      ooc: all.filter((x) => x.health === "OOC").length,
      warn: all.filter((x) => x.health === "WARN").length,
    };
  }, [list]);

  const periodLabel = t("quality.spc.hv.period", "기간");
  const kLabel = t("quality.spc.hv.kLimit", "서브그룹");

  return (
    <div className="hvspc-root h-full flex flex-col min-h-0">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-b" style={{ borderColor: "var(--hv-line)" }}>
        <div className="flex items-center gap-2">
          <span className="hv-label">{periodLabel}</span>
          <div className="hv-seg" role="group" aria-label={periodLabel}>
            {SPC_DAY_OPTIONS.map((d) => (
              <button key={d} type="button" data-active={days === d} onClick={() => setDays(d)}>
                {t("quality.spc.hv.daysN", "{{n}}일", { n: d })}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hv-label">{kLabel}</span>
          <div className="hv-seg" role="group" aria-label={kLabel}>
            {SPC_K_OPTIONS.map((k) => (
              <button key={k} type="button" data-active={kLimit === k} onClick={() => setKLimit(k)}>
                {k === 0 ? t("quality.spc.hv.kAll", "전체") : `k=${k}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hv-label">{t("quality.spc.hv.process", "공정")}</span>
          <select className="hv-input" value={processFilter} onChange={(e) => setProcessFilter(e.target.value)}>
            <option value="">{t("quality.spc.hv.allProcesses", "전체 공정")}</option>
            {processes.map((p) => (
              <option key={p.code} value={p.code}>{p.code} · {p.name}</option>
            ))}
          </select>
        </div>
        <input
          className="hv-input min-w-[180px]"
          placeholder={t("quality.spc.hv.searchPlaceholder", "특성·품목·공정 검색")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="hv-num" style={{ color: "var(--hv-ink-dim)" }}>
            {list ? `${list.dateFrom} ~ ${list.dateTo}` : ""}
          </span>
          <span className="flex items-center gap-3">
            <span className="hv-tone-OOC hv-num font-bold">{t("quality.spc.hv.status.OOC", "이탈")} {counts.ooc}</span>
            <span className="hv-tone-WARN hv-num font-bold">{t("quality.spc.hv.status.WARN", "주의")} {counts.warn}</span>
            <span className="hv-num" style={{ color: "var(--hv-ink-dim)" }}>{t("quality.spc.hv.targets", "관리대상")} {counts.total}</span>
          </span>
          {list?.sourceKind === "MOCK" && (
            <span className="hv-banner">{t("quality.spc.hv.mockBanner", "목업 데이터 — 검사이력 연동 전")}</span>
          )}
        </div>
      </div>

      {/* 본문: 좌 목록 / 우 상세 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside
          className="hv-scroll lg:w-[360px] lg:flex-shrink-0 max-h-[40vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--hv-line)" }}
        >
          <HvSpcTargetList
            targets={visibleTargets}
            selectedId={effectiveId}
            onSelect={setSelectedId}
            loading={listQuery.isLoading}
            error={errorText(listQuery.error)}
          />
        </aside>
        <section className="hv-scroll flex-1 min-w-0 min-h-0 overflow-y-auto">
          <HvSpcDetail
            data={detail}
            loading={detailQuery.isLoading && !detail}
            error={errorText(detailQuery.error)}
          />
        </section>
      </div>
    </div>
  );
}
