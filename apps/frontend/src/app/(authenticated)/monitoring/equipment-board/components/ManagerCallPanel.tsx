"use client";

/**
 * @file monitoring/equipment-board/components/ManagerCallPanel.tsx
 * @description 설비모니터링 — 현장에서 올라온 관리자호출을 받고 **응대 완료(해제)** 처리하는 패널
 *
 * 초보자 가이드:
 * 1. 현장 키오스크는 호출만 등록한다(작업은 멈추지 않는다). 해제는 여기서만 한다.
 * 2. OPEN 상태 호출만 5초마다 폴링한다(/equipment/call?onlyOpen=Y).
 * 3. "응대 완료"를 누르면 /equipment/call/:callId/ack 로 종료되고, 키오스크 배지도 폴링으로 사라진다.
 * 4. TV모드에서도 보이도록 화면 좌하단에 fixed 로 띄운다. 호출이 없으면 아무것도 그리지 않는다.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { BellRing, Check, ChevronDown, ChevronUp } from "lucide-react";
import api from "@/services/api";
import { useComCodeLabel } from "@/hooks/useComCode";

export interface OpenCall {
  callId: number;
  equipCode: string;
  jobOrderNo: string | null;
  callType: string;
  callRemark: string | null;
  status: "OPEN" | "ACKED";
  calledAt: string;
  calledBy: string | null;
  elapsedSeconds: number;
}

const POLL_MS = 5_000;

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function CallTypeLabel({ code }: { code: string }) {
  const label = useComCodeLabel("EQUIP_CALL_TYPE", code ?? "");
  return <span>{label || code}</span>;
}

interface Props {
  /** 설비코드 → 설비명 (보드가 이미 가진 목록을 그대로 쓴다) */
  equipNameMap: Map<string, string>;
  /** 보드 설정에서 고른 설비만 볼 때 사용. 비어 있으면 전체. */
  selectedCodes: string[];
}

export default function ManagerCallPanel({ equipNameMap, selectedCodes }: Props) {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<OpenCall[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/equipment/call", { params: { onlyOpen: "Y" } });
      const rows: OpenCall[] = res.data?.data ?? [];
      setCalls(
        selectedCodes.length === 0
          ? rows
          : rows.filter((r) => selectedCodes.includes(r.equipCode)),
      );
    } catch {
      // 폴링 실패는 보드를 깨뜨리지 않는다.
    }
  }, [selectedCodes]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // 대기시간을 1초씩 흐르게 (기준값은 서버 elapsedSeconds, 폴링마다 재보정)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setTick(0), [calls]);

  const handleAck = async (callId: number) => {
    setBusyId(callId);
    try {
      await api.post(`/equipment/call/${callId}/ack`, {});
      setCalls((prev) => prev.filter((c) => c.callId !== callId));
    } catch {
      // 목록에서 지우지 않는다. 다음 폴링에서 서버 상태를 다시 받는다.
      toast.error(t("monitoring.managerCall.ackFailed", "응대 처리에 실패했습니다."));
    } finally {
      setBusyId(null);
    }
  };

  if (calls.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-amber-500/60 bg-black/85 text-white shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={
          collapsed
            ? t("monitoring.managerCall.expand", "관리자호출 목록 펼치기")
            : t("monitoring.managerCall.collapse", "관리자호출 목록 접기")
        }
        className="flex w-full items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/20 px-3 py-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <BellRing className="h-4 w-4 animate-pulse text-amber-300" />
          {t("monitoring.managerCall.title", "관리자호출")}
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-black tabular-nums">
            {calls.length}
          </span>
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <ul className="max-h-[50vh] divide-y divide-white/10 overflow-auto">
          {calls.map((c) => (
            <li key={c.callId} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="truncate">{equipNameMap.get(c.equipCode) ?? c.equipCode}</span>
                  <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">
                    <CallTypeLabel code={c.callType} />
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-white/60">
                  {c.callRemark || t("monitoring.managerCall.noRemark", "내용 없음")}
                  {c.calledBy ? ` · ${c.calledBy}` : ""}
                </div>
              </div>

              <span className="shrink-0 font-mono text-lg font-extrabold tabular-nums text-amber-300">
                {formatElapsed(c.elapsedSeconds + tick)}
              </span>

              <button
                type="button"
                disabled={busyId === c.callId}
                onClick={() => handleAck(c.callId)}
                data-testid="board-call-ack"
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {t("monitoring.managerCall.ack", "응대 완료")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
