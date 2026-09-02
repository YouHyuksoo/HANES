import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, CircleDot, Database, FileCheck, Monitor, OctagonAlert, ShieldCheck, Wrench } from "lucide-react";
import type { KnowledgeNodeData } from "../knowledge/knowledge-view-model";
import { useTranslation } from "react-i18next";

/**
 * 종류별 표시 규칙 — 아이콘 · 모서리 · 외곽선 색.
 *
 * 카드가 전부 같은 테두리라 종류가 구분되지 않아, 종류마다 외곽선 색을 달리한다.
 * 모서리는 약하게만 준다(둥글수록 겹칠 때 형태가 뭉개진다).
 * 색은 테두리와 아이콘에만 쓰고 배경은 칠하지 않는다.
 */
const kinds = {
  activity:     [CircleDot,     "rounded",       "border-sky-500",     "text-sky-500"],
  screen:       [Monitor,       "rounded",       "border-indigo-500",  "text-indigo-500"],
  master:       [Box,           "rounded-sm",    "border-teal-600",    "text-teal-600"],
  constraint:   [ShieldCheck,   "rounded",       "border-amber-600",   "text-amber-600"],
  requiredTask: [FileCheck,     "rounded",       "border-violet-500",  "text-violet-500"],
  exception:    [OctagonAlert,  "rounded",       "border-rose-500",    "text-rose-500"],
  logic:        [Wrench,        "rounded-sm",    "border-orange-600",  "text-orange-600"],
  data:         [Database,      "rounded-sm",    "border-emerald-600", "text-emerald-600"],
  evidence:     [FileCheck,     "rounded-none",  "border-slate-500",   "text-slate-500"],
} as const;
export function KnowledgeNode({ data, selected }: NodeProps) {
  const { t } = useTranslation();
  const node = data as KnowledgeNodeData & { center?: boolean; evidenceStatus?: string };
  const [Icon, shape, borderColor, iconColor] = kinds[node.kind];
  const evidenceStatus = node.evidenceStatus ?? "undocumented";
  return <div role="button" tabIndex={0} aria-label={t("workflowGuide.knowledge.selectExpand", { label: node.label })} aria-selected={selected} aria-current={node.center ? "true" : undefined} className={`${shape} min-w-40 border-2 bg-card px-4 py-3 text-text shadow-sm transition motion-reduce:transition-none ${node.center ? "border-primary ring-4 ring-primary/20" : selected ? "border-info ring-2 ring-info/20" : borderColor}`} style={{ opacity: node.opacity }}>
    <Handle type="target" position={Position.Left} className="opacity-0" />
    <div className="flex items-center gap-2"><Icon size={15} className={iconColor} aria-hidden /><span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t(`workflowGuide.knowledge.kinds.${node.kind}`)}{node.center ? ` · ${t("workflowGuide.knowledge.center")}` : ""}</span></div>
    <strong className="mt-1 block max-w-56 text-sm leading-5">{node.label}</strong>
    {node.labelDensity === "full" && node.description && <p className="mt-1 max-w-56 text-xs leading-4 text-text-muted">{node.description}</p>}
    <span className="mt-2 block text-[10px] text-text-muted">● {t("workflowGuide.knowledge.evidenceLabel", { status: t(`workflowGuide.knowledge.evidenceStatus.${evidenceStatus}`) })}</span>
    <Handle type="source" position={Position.Right} className="opacity-0" />
  </div>;
}
