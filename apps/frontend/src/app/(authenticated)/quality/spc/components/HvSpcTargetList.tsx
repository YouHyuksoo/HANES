"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/HvSpcTargetList.tsx
 * @description SPC 관리대상 목록 — 공정별 그룹, 행마다 Cpk·상태·이탈 수.
 *
 * 초보자 가이드:
 * - 상태(health)는 서버가 정한다. 여기서는 색만 입힌다(hv-tone-*).
 * - Cpk 가 null 이면 '-' 로 둔다. 0 으로 보이면 "공정능력 0" 으로 오해된다.
 * - 라벨은 전부 i18n `quality.spc.hv.*` 키 — 화면 전용 한글 사전을 만들지 않는다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SpcTargetSummary } from "../types";

interface Props {
  targets: SpcTargetSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
}

function fmtCpk(v: number | null): string {
  return v === null ? "-" : v.toFixed(2);
}

/** Cpk 숫자 색 — 목록은 1.33 미만 경고, 1.00 미만 부적합 (상세 capTone 과 같은 기준) */
function cpkTone(v: number | null): string {
  if (v === null) return "";
  if (v < 1.0) return "hv-tone-OOC";
  if (v < 1.33) return "hv-tone-WARN";
  return "";
}

export default function HvSpcTargetList({ targets, selectedId, onSelect, loading, error }: Props) {
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; rows: SpcTargetSummary[] }>();
    for (const tg of targets) {
      const g = map.get(tg.processCode) ?? { code: tg.processCode, name: tg.processName, rows: [] };
      g.rows.push(tg);
      map.set(tg.processCode, g);
    }
    return Array.from(map.values());
  }, [targets]);

  if (error) {
    return <div className="p-4 text-xs hv-tone-OOC">{error}</div>;
  }
  if (loading && targets.length === 0) {
    return <div className="p-4 text-xs" style={{ color: "var(--hv-ink-mute)" }}>{t("quality.spc.hv.loading", "불러오는 중…")}</div>;
  }
  if (targets.length === 0) {
    return <div className="p-4 text-xs" style={{ color: "var(--hv-ink-mute)" }}>{t("quality.spc.hv.noTargets", "조건에 맞는 관리대상이 없습니다")}</div>;
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.code}>
          <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
            <span className="hv-eyebrow">{g.code}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--hv-ink-dim)" }}>{g.name}</span>
          </div>
          {g.rows.map((tg) => (
            <button
              key={tg.id}
              type="button"
              className="hv-row w-full text-left px-4 py-2.5 flex items-center gap-3"
              data-selected={selectedId === tg.id}
              onClick={() => onSelect(tg.id)}
            >
              <span className={`hv-tone-${tg.health} flex-shrink-0`} title={t(`quality.spc.hv.status.${tg.health}`)}>
                <span className="hv-dot" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold truncate">{tg.characteristic}</span>
                <span className="block text-[11px] truncate hv-num" style={{ color: "var(--hv-ink-mute)" }}>
                  {tg.itemCode} · n={tg.subgroupSize} · {tg.unit}
                </span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className={`block hv-num text-sm font-bold ${cpkTone(tg.cpk)}`}>
                  {fmtCpk(tg.cpk)}
                </span>
                <span className="block text-[10px] hv-num" style={{ color: "var(--hv-ink-mute)" }}>
                  {tg.oocCount > 0 && <span className="hv-tone-OOC">OOC {tg.oocCount} </span>}
                  {tg.warnCount > 0 && <span className="hv-tone-WARN">RULE {tg.warnCount}</span>}
                  {tg.oocCount === 0 && tg.warnCount === 0 && <span>k={tg.subgroupCount}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
