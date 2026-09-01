import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, CircleDot, Database, FileCheck, Monitor, OctagonAlert, ShieldCheck, Wrench } from "lucide-react";
import type { KnowledgeNodeData } from "../knowledge/knowledge-view-model";

const kinds = { activity:[CircleDot,"업무","rounded-full"], screen:[Monitor,"화면","rounded-md"], master:[Box,"기준","rounded-sm"], constraint:[ShieldCheck,"조건","rounded-md"], requiredTask:[FileCheck,"필수","rounded-md"], exception:[OctagonAlert,"예외","rounded-md"], logic:[Wrench,"로직","rounded-sm"], data:[Database,"데이터","rounded-sm"], evidence:[FileCheck,"근거","rounded-none"] } as const;
export function KnowledgeNode({ data, selected }: NodeProps) {
  const node = data as KnowledgeNodeData & { center?: boolean; evidenceStatus?: string };
  const [Icon, kindLabel, shape] = kinds[node.kind];
  const evidenceStatus = node.evidenceStatus ?? "undocumented";
  return <div role="button" tabIndex={0} aria-selected={selected} aria-current={node.center ? "true" : undefined} className={`${shape} min-w-40 border-2 bg-card px-4 py-3 text-text shadow-sm transition motion-reduce:transition-none ${node.center ? "border-primary ring-4 ring-primary/20" : selected ? "border-info ring-2 ring-info/20" : "border-border"}`} style={{ opacity: node.opacity }}>
    <Handle type="target" position={Position.Left} className="opacity-0" />
    <div className="flex items-center gap-2"><Icon size={15} aria-hidden /><span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{kindLabel}{node.center ? " · CENTER" : ""}</span></div>
    <strong className="mt-1 block max-w-56 text-sm leading-5">{node.label}</strong>
    {node.labelDensity === "full" && node.description && <p className="mt-1 max-w-56 text-xs leading-4 text-text-muted">{node.description}</p>}
    <span className="mt-2 block text-[10px] text-text-muted">● 근거 {evidenceStatus}</span>
    <Handle type="source" position={Position.Right} className="opacity-0" />
  </div>;
}
