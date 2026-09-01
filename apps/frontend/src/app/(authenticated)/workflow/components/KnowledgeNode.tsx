import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, CircleDot, Database, FileCheck, Monitor, OctagonAlert, ShieldCheck, Wrench } from "lucide-react";
import type { KnowledgeNodeData } from "../knowledge/knowledge-view-model";
import { useTranslation } from "react-i18next";

const kinds = { activity:[CircleDot,"rounded-full"], screen:[Monitor,"rounded-md"], master:[Box,"rounded-sm"], constraint:[ShieldCheck,"rounded-md"], requiredTask:[FileCheck,"rounded-md"], exception:[OctagonAlert,"rounded-md"], logic:[Wrench,"rounded-sm"], data:[Database,"rounded-sm"], evidence:[FileCheck,"rounded-none"] } as const;
export function KnowledgeNode({ data, selected }: NodeProps) {
  const { t } = useTranslation();
  const node = data as KnowledgeNodeData & { center?: boolean; evidenceStatus?: string };
  const [Icon, shape] = kinds[node.kind];
  const evidenceStatus = node.evidenceStatus ?? "undocumented";
  return <div role="button" tabIndex={0} aria-label={t("workflowGuide.knowledge.selectExpand", { label: node.label })} aria-selected={selected} aria-current={node.center ? "true" : undefined} className={`${shape} min-w-40 border-2 bg-card px-4 py-3 text-text shadow-sm transition motion-reduce:transition-none ${node.center ? "border-primary ring-4 ring-primary/20" : selected ? "border-info ring-2 ring-info/20" : "border-border"}`} style={{ opacity: node.opacity }}>
    <Handle type="target" position={Position.Left} className="opacity-0" />
    <div className="flex items-center gap-2"><Icon size={15} aria-hidden /><span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t(`workflowGuide.knowledge.kinds.${node.kind}`)}{node.center ? ` · ${t("workflowGuide.knowledge.center")}` : ""}</span></div>
    <strong className="mt-1 block max-w-56 text-sm leading-5">{node.label}</strong>
    {node.labelDensity === "full" && node.description && <p className="mt-1 max-w-56 text-xs leading-4 text-text-muted">{node.description}</p>}
    <span className="mt-2 block text-[10px] text-text-muted">● {t("workflowGuide.knowledge.evidenceStatus", { status: t(`workflowGuide.knowledge.coverage.${evidenceStatus}`) })}</span>
    <Handle type="source" position={Position.Right} className="opacity-0" />
  </div>;
}
