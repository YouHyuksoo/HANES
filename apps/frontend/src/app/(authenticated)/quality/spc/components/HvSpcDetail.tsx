"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/HvSpcDetail.tsx
 * @description 선택한 관리대상의 상세 — 헤드라인, 능력지수 스트립, 관리도, 규칙 위반, 서브그룹 표.
 *
 * 초보자 가이드:
 * - 값이 없으면 0 이 아니라 '-' 또는 '미산출' 로 둔다. (규격 없는 Cp, 데이터 2건 미만 등)
 * - 능력지수 색: ≥1.33 정상, 1.00~1.33 경고, <1.00 부적합 — `capTone()` 한 곳에서만 정한다.
 * - 규칙 코드 설명은 i18n `quality.spc.hv.rules.{R1..RR1}` 키.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SpcRuleCode, SpcTargetData } from "../types";
import { flagBySubgroup, isOocRule } from "./spc-rules";
import HvSpcCharts from "./HvSpcCharts";

interface Props {
  data: SpcTargetData | null;
  loading: boolean;
  error: string | null;
}

function capTone(v: number | null): string {
  if (v === null) return "hv-tone-idle";
  if (v >= 1.33) return "hv-tone-STABLE";
  if (v >= 1.0) return "hv-tone-WARN";
  return "hv-tone-OOC";
}

const RULE_CODES: SpcRuleCode[] = ["R1", "R2", "R3", "R4", "RR1"];

export default function HvSpcDetail({ data, loading, error }: Props) {
  const { t } = useTranslation();

  const flags = useMemo(() => flagBySubgroup(data?.violations ?? []), [data]);

  if (error) return <div className="p-6 text-sm hv-tone-OOC">{error}</div>;
  if (loading) return <div className="p-6 text-sm" style={{ color: "var(--hv-ink-mute)" }}>{t("quality.spc.hv.loading", "불러오는 중…")}</div>;
  if (!data) return <div className="p-6 text-sm" style={{ color: "var(--hv-ink-mute)" }}>{t("quality.spc.hv.selectHint", "좌측에서 관리대상을 선택하세요")}</div>;

  const { target, stats, capability, violations, subgroups } = data;
  const fmt = (v: number | null | undefined, d = target.decimals) => (v === null || v === undefined ? "-" : v.toFixed(d));
  const fmtCap = (v: number | null | undefined) => (v === null || v === undefined ? t("quality.spc.hv.notComputed", "미산출") : v.toFixed(2));
  const specText = [
    target.spec.lsl !== null ? `LSL ${fmt(target.spec.lsl)}` : null,
    target.spec.target !== null ? `T ${fmt(target.spec.target)}` : null,
    target.spec.usl !== null ? `USL ${fmt(target.spec.usl)}` : null,
  ].filter(Boolean).join("  ·  ");

  const ruleCounts = RULE_CODES.map((code) => ({ code, n: violations.filter((v) => v.rule === code).length }));

  return (
    <div className="flex flex-col">
      {/* 헤드라인 */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="hv-eyebrow">{target.processCode}</span>
          <span className="text-xs font-semibold" style={{ color: "var(--hv-ink-dim)" }}>{target.processName}</span>
          <span className={`ml-auto hv-tone-${target.health} text-xs font-bold flex items-center gap-1.5`}>
            <span className="hv-dot" />{t(`quality.spc.hv.status.${target.health}`)}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 mt-1">
          <h2 className="text-2xl font-bold tracking-tight">{target.characteristic}</h2>
          <span className="text-sm" style={{ color: "var(--hv-ink-mute)" }}>{target.characteristicEn}</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11.5px] hv-num" style={{ color: "var(--hv-ink-dim)" }}>
          <span><span className="hv-label">{t("quality.spc.hv.item", "품목")}</span> {target.itemCode}</span>
          <span><span className="hv-label">{t("quality.spc.hv.equipment", "설비")}</span> {target.equipCodes.join(", ")}</span>
          <span><span className="hv-label">{t("quality.spc.hv.spec", "규격")}</span> {specText || t("quality.spc.hv.specNone", "규격 없음")} <span style={{ color: "var(--hv-ink-mute)" }}>{target.unit}</span></span>
          <span><span className="hv-label">{t("quality.spc.hv.subgroup", "서브그룹")}</span> n={target.subgroupSize} · k={target.subgroupCount}</span>
          <span><span className="hv-label">{t("quality.spc.hv.lastSample", "최근 측정")}</span> {target.lastSampleAt ?? "-"}</span>
        </div>
      </div>

      {/* 능력지수 스트립 — 카드 박스가 아니라 수직 구분선 */}
      <div className="hv-kpi">
        <div>
          <div className="hv-label">Cpk</div>
          <div className={`value ${capTone(capability?.cpk ?? null)}`}>{fmtCap(capability?.cpk)}</div>
        </div>
        <div>
          <div className="hv-label">Cp</div>
          <div className={`value ${capTone(capability?.cp ?? null)}`}>{fmtCap(capability?.cp)}</div>
        </div>
        <div>
          <div className="hv-label">Ppk</div>
          <div className={`value ${capTone(capability?.ppk ?? null)}`}>{fmtCap(capability?.ppk)}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.xbarBar", "X̿ (총평균)")}</div>
          <div className="value">{fmt(stats?.xbarBar)}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.rBar", "R̄ (평균 범위)")}</div>
          <div className="value">{fmt(stats?.rBar)}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.sigmaWithin", "σ 군내")}</div>
          <div className="value">{fmt(capability?.sigmaWithin, target.decimals + 1)}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.sigmaOverall", "σ 전체")}</div>
          <div className="value">{fmt(capability?.sigmaOverall, target.decimals + 1)}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.oocCount", "관리한계 이탈")}</div>
          <div className={`value ${target.oocCount > 0 ? "hv-tone-OOC" : ""}`}>{target.oocCount}</div>
        </div>
        <div>
          <div className="hv-label">{t("quality.spc.hv.ruleHits", "패턴 규칙")}</div>
          <div className={`value ${target.warnCount > 0 ? "hv-tone-WARN" : ""}`}>{target.warnCount}</div>
        </div>
      </div>

      {/* 관리도 */}
      <div className="px-5 py-4">
        {stats ? (
          <HvSpcCharts subgroups={subgroups} stats={stats} spec={target.spec} unit={target.unit} decimals={target.decimals} flags={flags} capability={capability} />
        ) : (
          <div className="text-sm" style={{ color: "var(--hv-ink-mute)" }}>{t("quality.spc.hv.notEnoughData", "서브그룹이 2건 미만이라 관리도를 산출하지 않았습니다")}</div>
        )}
      </div>

      {/* 규칙 위반 */}
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--hv-line)" }}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
          <span className="hv-label">{t("quality.spc.hv.violations", "규칙 위반")}</span>
          {ruleCounts.map((rc) => (
            <span
              key={rc.code}
              className={`hv-num text-[11px] ${rc.n > 0 ? (isOocRule(rc.code) ? "hv-tone-OOC" : "hv-tone-WARN") : ""}`}
              style={rc.n === 0 ? { color: "var(--hv-ink-mute)" } : undefined}
              title={t(`quality.spc.hv.rules.${rc.code}`)}
            >
              {rc.code} {rc.n}
            </span>
          ))}
        </div>
        {violations.length === 0 ? (
          <div className="text-xs hv-tone-STABLE">{t("quality.spc.hv.noViolations", "규칙 위반 없음 — 관리상태")}</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {violations.map((v) => {
              const sg = subgroups.find((s) => s.id === v.subgroupId);
              const ooc = isOocRule(v.rule);
              return (
                <li key={`${v.rule}-${v.subgroupId}`} className="flex flex-wrap items-baseline gap-x-3 text-[11.5px]">
                  <span className={`hv-badge ${ooc ? "hv-tone-OOC" : "hv-tone-WARN"}`}>{v.rule}</span>
                  <span className="hv-num" style={{ color: "var(--hv-ink-dim)" }}>#{v.subgroupId} {sg ? `${sg.date} ${sg.time} · ${sg.equipCode} · ${sg.lotNo}` : ""}</span>
                  <span>{t(`quality.spc.hv.rules.${v.rule}`)}</span>
                  {v.members.length > 1 && (
                    <span className="hv-num" style={{ color: "var(--hv-ink-mute)" }}>#{v.members.join(", #")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 서브그룹 표 — 최신이 위 */}
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--hv-line)" }}>
        <div className="hv-label mb-2">{t("quality.spc.hv.subgroups", "서브그룹 이력")} <span className="hv-num">({subgroups.length})</span></div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto hv-scroll border" style={{ borderColor: "var(--hv-line)" }}>
          <table className="hv-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t("quality.spc.hv.colDate", "일자")}</th>
                <th>{t("quality.spc.hv.colTime", "시각")}</th>
                <th>{t("quality.spc.hv.colEquip", "설비")}</th>
                <th>{t("quality.spc.hv.colLot", "LOT")}</th>
                <th>{t("quality.spc.hv.colSamples", "측정값")}</th>
                <th className="num">X̄</th>
                <th className="num">R</th>
                <th>{t("quality.spc.hv.colFlag", "판정")}</th>
              </tr>
            </thead>
            <tbody>
              {[...subgroups].reverse().map((sg) => {
                const flag = flags.get(sg.id) ?? null;
                return (
                  <tr key={sg.id} data-flag={flag ?? undefined}>
                    <td className="num hv-num">{sg.id}</td>
                    <td className="hv-num">{sg.date}</td>
                    <td className="hv-num">{sg.time}</td>
                    <td className="hv-num">{sg.equipCode}</td>
                    <td className="hv-num">{sg.lotNo}</td>
                    <td className="hv-num">{sg.samples.map((v) => v.toFixed(target.decimals)).join("  ")}</td>
                    <td className="num hv-num font-semibold">{fmt(sg.xbar)}</td>
                    <td className="num hv-num">{fmt(sg.range)}</td>
                    <td>{flag ? <span className={`hv-badge hv-tone-${flag}`}>{flag}</span> : <span style={{ color: "var(--hv-ink-mute)" }}>·</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
