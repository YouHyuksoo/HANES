"use client";

/**
 * @file src/app/(authenticated)/workflow/components/WorkflowOverview.tsx
 * @description 전체구성도 — 왼쪽에 전체 흐름 박스와 연결, 오른쪽에 선택한 공정의 규칙.
 *
 * 초보자 가이드:
 * 1. 데이터는 config/workflowMap.ts(레인/노드/엣지) 단일 출처에서 집계한다. 여기서 새로 정의하지 않는다.
 * 2. 연결(엣지)을 하나도 빠뜨리지 않는다.
 *    - 나란히 놓인 두 박스 사이에 실제 연결이 있으면 화살표에 그 이름을 적는다.
 *    - 떨어져 있거나 다른 영역에서 오는 연결은 레인 아래 "연결" 줄에 출발▶도착으로 적는다.
 *    - 실제 연결이 없는 이웃 박스 사이에는 화살표를 그리지 않는다(없는 흐름을 그리면 거짓이 된다).
 * 3. 단계는 세 종류로 구분한다 — 주 업무(실선) / 기준정보(점선) / 보조 업무(아래 영역).
 *    기준정보는 "흐름의 대상이 되지 않고 참조로만 쓰이는 단계"를 데이터에서 계산해 가려낸다.
 * 4. 박스를 클릭해도 탭을 옮기지 않는다. 오른쪽 패널 내용만 바뀐다.
 * 5. 게이트 단계(검사·판정)는 영역색으로 채워 통제점임을 드러낸다.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import {
  workflowEdges,
  workflowLanes,
  workflowNodes,
  type WorkflowActivityNode,
  type WorkflowBusinessEdge,
  type WorkflowLane,
  type WorkflowLaneId,
} from "@/config/workflowMap";

interface Props {
  /** 선택한 단계를 부모에 알린다. 이 화면은 탭을 옮기지 않고 오른쪽 패널만 바꾼다. */
  onSelect: (id: string) => void;
}

/** 주 흐름 레인 — 위에서 아래로 이어지는 순서 */
const MAIN_LANES: WorkflowLaneId[] = ["purchase-arrival", "material-iqc", "production", "quality", "shipping"];

/** 보조 레인 — 주 흐름을 둘러싼 상시 업무 */
const SUPPORT_LANES: WorkflowLaneId[] = ["trace", "reversal", "quality-system", "consumables", "pda"];

/** 게이트 단계 — 통과하지 못하면 다음 단계로 못 가는 지점 */
const GATE_NODE_IDS = new Set(["iqc-inspection", "process-inspection", "oqc"]);

/** 세로 색띠에 쓰는 짧은 이름 */
const LANE_SHORT: Record<WorkflowLaneId, { key: string; fallback: string }> = {
  "purchase-arrival": { key: "workflowGuide.laneShortArrival", fallback: "입하" },
  "material-iqc": { key: "workflowGuide.laneShortMaterial", fallback: "자재" },
  production: { key: "workflowGuide.laneShortProduction", fallback: "생산" },
  quality: { key: "workflowGuide.laneShortQuality", fallback: "품질" },
  shipping: { key: "workflowGuide.laneShortShipping", fallback: "출하" },
  trace: { key: "workflowGuide.laneShortTrace", fallback: "추적" },
  reversal: { key: "workflowGuide.laneShortReversal", fallback: "역처리" },
  "quality-system": { key: "workflowGuide.laneShortQualitySystem", fallback: "IATF" },
  consumables: { key: "workflowGuide.laneShortConsumables", fallback: "소모품" },
  pda: { key: "workflowGuide.laneShortPda", fallback: "PDA" },
};

/** 엣지 종류 표기 */
const EDGE_KIND: Record<WorkflowBusinessEdge["kind"], { key: string; fallback: string; arrow: string }> = {
  normal: { key: "workflowGuide.legendNormal", fallback: "진행", arrow: "▶" },
  branch: { key: "workflowGuide.legendBranch", fallback: "분기", arrow: "▶" },
  reversal: { key: "workflowGuide.legendReversal", fallback: "역처리", arrow: "◀" },
  reference: { key: "workflowGuide.legendReference", fallback: "참조", arrow: "⇢" },
};

/** 시스템 전체 핵심 규칙 — 아무것도 선택하지 않았을 때 */
const RULES = [
  { key: "workflowGuide.ruleTrace", fallback: "추적성", bodyKey: "workflowGuide.ruleTraceBody", bodyFallback: "완제품(FG) ← 반제품(SG) ← 자재 LOT 전 구간 역추적" },
  { key: "workflowGuide.ruleGate", fallback: "품질 게이트", bodyKey: "workflowGuide.ruleGateBody", bodyFallback: "IQC 판정 · 공정검사 · OQC 세 지점에서 불합격은 다음 단계로 넘어가지 않는다" },
  { key: "workflowGuide.ruleReversal", fallback: "역처리", bodyKey: "workflowGuide.ruleReversalBody", bodyFallback: "입하 · 입고 · 출하 취소는 뒤 공정이 진행되기 전까지만 가능" },
  { key: "workflowGuide.ruleField", fallback: "현장 단말", bodyKey: "workflowGuide.ruleFieldBody", bodyFallback: "PDA로 자재입고 · 불출 · 제품입고 · 출하 · 설비점검을 동일하게 처리" },
];

type TFn = (key: string, fallback: string) => string;
type LaneLink = { edge: WorkflowBusinessEdge; from: WorkflowActivityNode; to: WorkflowActivityNode };

export default function WorkflowOverview({ onSelect }: Props) {
  const { t } = useTranslation();
  /** 이 화면 안에서만 쓰는 선택 상태. null이면 전체 핵심 규칙을 보여준다. */
  const [activeId, setActiveId] = useState<string | null>(null);

  const { nodesByLane, nodeById, laneById, masterIds, edgesByPair, laneLinks, edgesByNode } = useMemo(buildModel, []);

  const activeNode = activeId ? nodeById.get(activeId) : undefined;
  const activeLane = activeNode ? laneById.get(activeNode.lane) : undefined;
  const activeLinks = activeId ? edgesByNode.get(activeId) : undefined;

  const pick = (id: string) => {
    setActiveId(id);
    onSelect(id);
  };

  const renderLane = (laneId: WorkflowLaneId, compact?: boolean) => {
    const lane = laneById.get(laneId);
    const nodes = nodesByLane.get(laneId) ?? [];
    if (!lane || nodes.length === 0) return null;
    return (
      <LaneRow
        key={laneId}
        lane={lane}
        nodes={nodes}
        shortTitle={t(LANE_SHORT[laneId].key, LANE_SHORT[laneId].fallback)}
        activeId={activeId}
        masterIds={masterIds}
        edgesByPair={edgesByPair}
        links={laneLinks.get(laneId) ?? []}
        laneById={laneById}
        onPick={pick}
        compact={compact}
        t={t}
      />
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-3 bg-background p-3">
      {/* ── 왼쪽: 전체 흐름 ── */}
      <div className="min-w-0 overflow-y-auto pr-1">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-text pb-1.5">
          <h2 className="text-[15px] font-bold leading-none">{t("workflowGuide.overviewHeading", "구축 PROCESS")}</h2>
          <span className="text-[11px] text-text-muted">
            {t("workflowGuide.overviewLead", "자재 입하에서 고객 출하까지, 각 영역이 다음 영역으로 넘어가는 조건과 함께")}
          </span>
          <div className="ml-auto flex items-center gap-2.5 text-[10px] text-text-muted">
            <LegendChip swatch={<span className="inline-block h-2.5 w-3.5 rounded-[2px] bg-text" />}>
              {t("workflowGuide.legendGate", "검사 게이트")}
            </LegendChip>
            <LegendChip swatch={<span className="inline-block h-2.5 w-3.5 rounded-[2px] border border-border" />}>
              {t("workflowGuide.legendMain", "주 업무")}
            </LegendChip>
            <LegendChip
              swatch={<span className="inline-block h-2.5 w-3.5 rounded-[2px] border border-dashed border-text-muted" />}
            >
              {t("workflowGuide.legendMaster", "기준정보")}
            </LegendChip>
          </div>
        </div>

        {/* 주 흐름 */}
        {MAIN_LANES.map((laneId) => renderLane(laneId))}

        {/* 보조 업무 */}
        <h3 className="mb-1.5 mt-3 border-b border-border pb-1 text-[11px] font-bold text-text-muted">
          {t("workflowGuide.supportAreas", "주 흐름을 둘러싼 보조 업무")}
        </h3>
        {SUPPORT_LANES.map((laneId) => renderLane(laneId, true))}
      </div>

      {/* ── 오른쪽: 선택한 공정의 규칙 ── */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[3px] border-2 border-border bg-card">
        {activeNode && activeLane ? (
          <>
            <div className="shrink-0 border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="mb-1.5 inline-flex items-center gap-1 text-[10.5px] text-text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("workflowGuide.backToRules", "전체 핵심 규칙")}
              </button>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className="shrink-0 border-l-[3px] pl-1.5 text-[10.5px] font-semibold"
                  style={{ borderColor: activeLane.color, color: activeLane.color }}
                >
                  {activeLane.title}
                </span>
                {GATE_NODE_IDS.has(activeNode.id) && (
                  <span
                    className="rounded-[2px] px-1.5 py-px text-[9.5px] font-bold text-white"
                    style={{ backgroundColor: activeLane.color }}
                  >
                    {t("workflowGuide.legendGate", "검사 게이트")}
                  </span>
                )}
                {masterIds.has(activeNode.id) && (
                  <span className="rounded-[2px] border border-dashed border-text-muted px-1.5 py-px text-[9.5px] font-bold text-text-muted">
                    {t("workflowGuide.legendMaster", "기준정보")}
                  </span>
                )}
              </div>
              <h3 className="mt-0.5 text-[14px] font-bold leading-tight">{activeNode.activity}</h3>
              <p className="mt-1 text-[11px] leading-snug text-text-muted">{activeNode.summary}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
              <div className="flex flex-col gap-2.5">
                {/* 연결 — 이 단계가 무엇과 이어지는가 */}
                {activeLinks && (activeLinks.incoming.length > 0 || activeLinks.outgoing.length > 0) && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold">{t("workflowGuide.relations", "연결")}</h4>
                    <ul className="flex flex-col gap-0.5">
                      {activeLinks.incoming.map((edge) => {
                        const other = nodeById.get(edge.source);
                        return (
                          <LinkLine
                            key={edge.id}
                            edge={edge}
                            other={other}
                            otherLane={other ? laneById.get(other.lane) : undefined}
                            direction="in"
                            onPick={pick}
                            t={t}
                          />
                        );
                      })}
                      {activeLinks.outgoing.map((edge) => {
                        const other = nodeById.get(edge.target);
                        return (
                          <LinkLine
                            key={edge.id}
                            edge={edge}
                            other={other}
                            otherLane={other ? laneById.get(other.lane) : undefined}
                            direction="out"
                            onPick={pick}
                            t={t}
                          />
                        );
                      })}
                    </ul>
                  </div>
                )}

                {activeNode.why && <PanelBlock title={t("workflowGuide.why", "왜 하는가")}>{activeNode.why}</PanelBlock>}
                {activeNode.when && <PanelBlock title={t("workflowGuide.when", "언제 하는가")}>{activeNode.when}</PanelBlock>}
                {activeNode.cautions && activeNode.cautions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold">{t("workflowGuide.cautions", "주의점")}</h4>
                    <ul className="flex flex-col gap-1">
                      {activeNode.cautions.map((c) => (
                        <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-text-muted">
                          <span className="shrink-0" aria-hidden="true">
                            ○
                          </span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!activeNode.why && !activeNode.when && (!activeNode.cautions || activeNode.cautions.length === 0) && (
                  <p className="text-[11px] leading-snug text-text-muted">{activeNode.detail}</p>
                )}

                {(activeNode.inputs.length > 0 || activeNode.outputs.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                    <TagList title={t("workflowGuide.inputs", "입력")} items={activeNode.inputs} />
                    <TagList title={t("workflowGuide.outputs", "출력")} items={activeNode.outputs} />
                  </div>
                )}

                {activeNode.dataObjects.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <TagList title={t("workflowGuide.dataObjects", "데이터")} items={activeNode.dataObjects} mono />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 border-b border-border px-3 py-2">
              <h3 className="text-[13px] font-bold">{t("workflowGuide.keyPoints", "핵심 규칙")}</h3>
              <p className="mt-0.5 text-[10.5px] text-text-muted">
                {t("workflowGuide.keyPointsHint", "왼쪽 박스를 클릭하면 그 공정의 규칙이 여기에 나옵니다.")}
              </p>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-2.5">
              {RULES.map((rule) => (
                <li key={rule.key} className="flex flex-col gap-0.5">
                  <span className="text-[11.5px] font-bold">○ {t(rule.key, rule.fallback)}</span>
                  <span className="pl-3 text-[11px] leading-snug text-text-muted">{t(rule.bodyKey, rule.bodyFallback)}</span>
                </li>
              ))}
            </ul>
            <div className="shrink-0 border-t border-border px-3 py-1.5 text-[10px] tabular-nums text-text-muted">
              {workflowLanes.length} {t("workflowGuide.overviewAreas", "업무영역")} · {workflowNodes.length}{" "}
              {t("workflowGuide.overviewSteps", "업무단계")} · {workflowEdges.length}{" "}
              {t("workflowGuide.overviewLinks", "연결")}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ────────────────────────── 데이터 집계 ────────────────────────── */

function buildModel() {
  const nodeById = new Map(workflowNodes.map((n) => [n.id, n]));
  const laneById = new Map(workflowLanes.map((l) => [l.id, l]));

  const nodesByLane = new Map<WorkflowLaneId, WorkflowActivityNode[]>();
  for (const lane of workflowLanes) nodesByLane.set(lane.id, []);
  for (const node of workflowNodes) nodesByLane.get(node.lane)?.push(node);
  for (const list of nodesByLane.values()) list.sort((a, b) => (a.order ?? a.x) - (b.order ?? b.x));

  /**
   * 기준정보 — 흐름(진행/분기)의 대상이 된 적 없고, 나가는 연결이 전부 참조인 단계.
   * PDA 레인은 제외한다. 현장 단말은 PC 업무를 그대로 대신 처리할 뿐이라 참조로만 이어지지만,
   * 기준을 제공하는 단계가 아니라 실행 단계다.
   */
  const flowTargets = new Set(
    workflowEdges.filter((e) => e.kind === "normal" || e.kind === "branch").map((e) => e.target),
  );
  const masterIds = new Set<string>();
  for (const node of workflowNodes) {
    if (node.lane === "pda" || flowTargets.has(node.id)) continue;
    const out = workflowEdges.filter((e) => e.source === node.id);
    if (out.length > 0 && out.every((e) => e.kind === "reference")) masterIds.add(node.id);
  }

  /** 두 단계 사이의 실제 연결 */
  const edgesByPair = new Map<string, WorkflowBusinessEdge>();
  for (const edge of workflowEdges) edgesByPair.set(`${edge.source}>${edge.target}`, edge);

  /** 단계별 들어오는/나가는 연결 */
  const edgesByNode = new Map<string, { incoming: WorkflowBusinessEdge[]; outgoing: WorkflowBusinessEdge[] }>();
  for (const node of workflowNodes) edgesByNode.set(node.id, { incoming: [], outgoing: [] });
  for (const edge of workflowEdges) {
    edgesByNode.get(edge.target)?.incoming.push(edge);
    edgesByNode.get(edge.source)?.outgoing.push(edge);
  }

  /**
   * 레인 아래 "연결" 줄에 실을 목록.
   * 나란한 박스 사이 화살표로 이미 보이는 연결만 빼고 나머지 전부를 담는다.
   * 도착 단계가 속한 레인에 모아, 그 영역이 무엇을 받아 시작하는지 보이게 한다.
   */
  const adjacentPairs = new Set<string>();
  for (const list of nodesByLane.values()) {
    for (let i = 1; i < list.length; i++) {
      const key = `${list[i - 1].id}>${list[i].id}`;
      if (edgesByPair.has(key)) adjacentPairs.add(key);
    }
  }

  const laneLinks = new Map<WorkflowLaneId, LaneLink[]>();
  for (const lane of workflowLanes) laneLinks.set(lane.id, []);
  for (const edge of workflowEdges) {
    if (adjacentPairs.has(`${edge.source}>${edge.target}`)) continue;
    const from = nodeById.get(edge.source);
    const to = nodeById.get(edge.target);
    if (!from || !to) continue;
    laneLinks.get(to.lane)?.push({ edge, from, to });
  }

  return { nodesByLane, nodeById, laneById, masterIds, edgesByPair, laneLinks, edgesByNode };
}

/* ────────────────────────── 표시 컴포넌트 ────────────────────────── */

function LaneRow({
  lane,
  nodes,
  shortTitle,
  activeId,
  masterIds,
  edgesByPair,
  links,
  laneById,
  onPick,
  compact,
  t,
}: {
  lane: WorkflowLane;
  nodes: WorkflowActivityNode[];
  shortTitle: string;
  activeId: string | null;
  masterIds: Set<string>;
  edgesByPair: Map<string, WorkflowBusinessEdge>;
  links: LaneLink[];
  laneById: Map<WorkflowLaneId, WorkflowLane>;
  onPick: (id: string) => void;
  compact?: boolean;
  t: TFn;
}) {
  return (
    <div className="mb-1.5 flex items-stretch gap-1.5">
      <div
        className="flex w-9 shrink-0 items-center justify-center rounded-[3px] py-2"
        style={{ backgroundColor: lane.color }}
        title={lane.description}
      >
        <span
          className="text-[11.5px] font-bold leading-none text-white"
          style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.1em" }}
        >
          {shortTitle}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-[3px] border border-border bg-card">
        {/* 이 영역이 무엇을 받아 시작하는지 — 다른 영역에서 오거나 떨어진 단계에서 오는 연결 */}
        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-2 py-1.5">
            <span className="text-[10px] font-bold text-text-muted">{t("workflowGuide.relations", "연결")}</span>
            {links.map(({ edge, from, to }) => {
              const kind = EDGE_KIND[edge.kind];
              const fromLane = laneById.get(from.lane);
              const crossLane = from.lane !== to.lane;
              return (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onPick(from.id)}
                  title={`${from.activity} ${kind.arrow} ${to.activity} · ${edge.label} · ${t(kind.key, kind.fallback)}`}
                  className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    edge.kind === "reference" ? "border-dashed border-text-muted" : "border-border"
                  }`}
                >
                  {crossLane && fromLane && (
                    <span className="font-semibold" style={{ color: fromLane.color }}>
                      {fromLane.title}
                    </span>
                  )}
                  <span className="font-medium text-text">{from.activity}</span>
                  <span style={{ color: lane.color }} aria-hidden="true">
                    {kind.arrow}
                  </span>
                  <span className="font-medium text-text">{to.activity}</span>
                  <span className="text-text-muted">· {edge.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 단계 박스 + 실제 연결 화살표 */}
        <div className="flex flex-wrap items-center gap-y-1.5 px-2 py-2">
          {nodes.map((node, idx) => {
            const prev = idx > 0 ? nodes[idx - 1] : undefined;
            const edge = prev ? edgesByPair.get(`${prev.id}>${node.id}`) : undefined;
            return (
              <div key={node.id} className="flex items-center">
                {idx > 0 && (edge ? <FlowArrow color={lane.color} label={edge.label} /> : <NoFlowGap />)}
                <StepBox
                  node={node}
                  laneColor={lane.color}
                  isGate={GATE_NODE_IDS.has(node.id)}
                  isMaster={masterIds.has(node.id)}
                  isSelected={node.id === activeId}
                  compact={compact}
                  onPick={onPick}
                  masterLabel={t("workflowGuide.legendMaster", "기준정보")}
                />
              </div>
            );
          })}
          <span className="ml-auto pl-2 text-[10px] tabular-nums text-text-muted">
            {nodes.length}
            {t("workflowGuide.stepSuffix", "단계")}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepBox({
  node,
  laneColor,
  isGate,
  isMaster,
  isSelected,
  compact,
  onPick,
  masterLabel,
}: {
  node: WorkflowActivityNode;
  laneColor: string;
  isGate: boolean;
  isMaster: boolean;
  isSelected: boolean;
  compact?: boolean;
  onPick: (id: string) => void;
  masterLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(node.id)}
      aria-pressed={isSelected}
      title={node.summary}
      className={`flex items-center justify-center rounded-[3px] border-2 text-center font-bold leading-[1.2] transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        compact ? "h-8 min-w-[96px] px-1.5 text-[10.5px]" : "h-10 min-w-[104px] max-w-[150px] px-2 text-[11.5px]"
      } ${isGate ? "" : "text-text"} ${isMaster && !isGate ? "border-dashed border-text-muted" : ""}`}
      style={
        isGate
          ? { backgroundColor: laneColor, borderColor: laneColor, color: "#fff" }
          : isSelected
            ? { borderColor: laneColor, borderWidth: 3, borderStyle: "solid" }
            : undefined
      }
    >
      <span className="break-keep">{node.activity}</span>
      {isMaster && <span className="sr-only"> ({masterLabel})</span>}
    </button>
  );
}

function LinkLine({
  edge,
  other,
  otherLane,
  direction,
  onPick,
  t,
}: {
  edge: WorkflowBusinessEdge;
  other?: WorkflowActivityNode;
  otherLane?: WorkflowLane;
  direction: "in" | "out";
  onPick: (id: string) => void;
  t: TFn;
}) {
  if (!other) return null;
  const kind = EDGE_KIND[edge.kind];
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(other.id)}
        className="flex w-full items-baseline gap-1.5 rounded-[2px] px-1 py-0.5 text-left text-[10.5px] leading-snug transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="shrink-0 text-text-muted" aria-hidden="true">
          {direction === "in" ? "◀" : kind.arrow}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-text">{other.activity}</span>
          {otherLane && <span className="text-text-muted"> · {otherLane.title}</span>}
          <span className="text-text-muted"> · {edge.label}</span>
        </span>
        <span className="shrink-0 text-[9.5px] text-text-muted">{t(kind.key, kind.fallback)}</span>
      </button>
    </li>
  );
}

function LegendChip({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true">{swatch}</span>
      {children}
    </span>
  );
}

function PanelBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h4 className="text-[11px] font-bold">{title}</h4>
      <p className="text-[11px] leading-snug text-text-muted">{children}</p>
    </div>
  );
}

function TagList({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h4 className="text-[10.5px] font-bold text-text-muted">{title}</h4>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className={`rounded-[2px] border border-border px-1.5 py-px text-[10px] ${mono ? "font-mono" : ""}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 실제 연결이 있는 이웃 — 화살표에 연결 이름을 적는다 */
function FlowArrow({ color, label }: { color: string; label: string }) {
  return (
    <span className="mx-1 flex shrink-0 flex-col items-center justify-center" title={label}>
      <span className="max-w-[78px] truncate text-[9px] leading-none text-text-muted">{label}</span>
      <span className="mt-0.5 flex w-8 items-center" aria-hidden="true">
        <span className="h-[2px] flex-1" style={{ backgroundColor: color }} />
        <span
          className="block h-0 w-0"
          style={{
            borderLeft: `6px solid ${color}`,
            borderTop: "4px solid transparent",
            borderBottom: "4px solid transparent",
          }}
        />
      </span>
    </span>
  );
}

/** 실제 연결이 없는 이웃 — 화살표를 그리지 않는다 */
function NoFlowGap() {
  return <span className="mx-1.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}
