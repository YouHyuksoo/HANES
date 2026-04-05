/**
 * @file src/config/workflowConfig.ts
 * @description 워크플로우 정의 — 7개 업무 프로세스의 노드, 분기, 메뉴 경로 설정
 *
 * 초보자 가이드:
 * 1. WorkflowNode: 각 단계 (노드명, 경로, 색상, 역분개 경로)
 * 2. WorkflowBranch: 분기 조건 (합격/불합격 등)
 * 3. WorkflowDefinition: 워크플로우 전체 정의 (노드 배열 + 분기)
 * 4. workflowConfigs: 7개 워크플로우 배열
 * 5. icon은 lucide-react 컴포넌트 (사이드 메뉴와 동일 스타일)
 */
import {
  Package, Factory, Shield, Truck, Wrench, Building2, Cog,
} from "lucide-react";

export interface WorkflowNode {
  id: string;
  labelKey: string;
  statusKey: string;
  path: string;
  color: string;
  reversePath?: string;
  reverseKey?: string;
}

export interface WorkflowBranch {
  afterNodeId: string;
  conditions: Array<{
    labelKey: string;
    type: "pass" | "fail";
  }>;
}

export interface WorkflowDefinition {
  id: string;
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badgeColor: string;
  nodes: WorkflowNode[];
  branches?: WorkflowBranch[];
  fullWidth?: boolean;
}

export const workflowConfigs: WorkflowDefinition[] = [
  {
    id: "MATERIAL",
    titleKey: "workflow.material.title",
    icon: Package,
    accent: "border-green-500",
    badgeColor: "bg-green-500",
    nodes: [
      { id: "ARRIVAL", labelKey: "workflow.material.arrival", statusKey: "workflow.status.pending", path: "/material/arrival", color: "text-green-500" },
      { id: "LABEL", labelKey: "workflow.material.label", statusKey: "workflow.status.issuing", path: "/material/receive-label", color: "text-cyan-500" },
      { id: "IQC", labelKey: "workflow.material.iqc", statusKey: "workflow.status.inspecting", path: "/material/iqc", color: "text-blue-500" },
      { id: "RECEIVE", labelKey: "workflow.material.receive", statusKey: "workflow.status.done", path: "/material/receive", color: "text-violet-500", reversePath: "/material/receipt-cancel", reverseKey: "workflow.action.cancelReceipt" },
      { id: "REQUEST", labelKey: "workflow.material.request", statusKey: "workflow.status.requesting", path: "/material/request", color: "text-amber-500" },
      { id: "ISSUE", labelKey: "workflow.material.issue", statusKey: "workflow.status.done", path: "/material/issue", color: "text-purple-500" },
    ],
    branches: [{ afterNodeId: "IQC", conditions: [{ labelKey: "workflow.branch.pass", type: "pass" }, { labelKey: "workflow.branch.fail", type: "fail" }] }],
  },
  {
    id: "PRODUCTION",
    titleKey: "workflow.production.title",
    icon: Factory,
    accent: "border-blue-500",
    badgeColor: "bg-blue-500",
    nodes: [
      { id: "PLAN", labelKey: "workflow.production.plan", statusKey: "workflow.status.planning", path: "/production/monthly-plan", color: "text-green-500" },
      { id: "SIMULATION", labelKey: "workflow.production.simulation", statusKey: "workflow.status.simulating", path: "/production/simulation", color: "text-cyan-500" },
      { id: "ORDER", labelKey: "workflow.production.order", statusKey: "workflow.status.active", path: "/production/order", color: "text-amber-500" },
      { id: "RESULT", labelKey: "workflow.production.result", statusKey: "workflow.status.inputting", path: "/production/result", color: "text-blue-500" },
      { id: "INSPECT", labelKey: "workflow.production.inspect", statusKey: "workflow.status.inspecting", path: "/production/input-inspect", color: "text-violet-500" },
      { id: "FG_RECEIVE", labelKey: "workflow.production.fgReceive", statusKey: "workflow.status.done", path: "/product/receive", color: "text-purple-500", reversePath: "/product/receipt-cancel", reverseKey: "workflow.action.cancelReceipt" },
    ],
  },
  {
    id: "CONSUMABLES",
    titleKey: "workflow.consumables.title",
    icon: Cog,
    accent: "border-pink-500",
    badgeColor: "bg-pink-500",
    nodes: [
      { id: "RECEIVING", labelKey: "workflow.consumables.receiving", statusKey: "workflow.status.pending", path: "/consumables/receiving", color: "text-green-500" },
      { id: "LABEL", labelKey: "workflow.consumables.label", statusKey: "workflow.status.issuing", path: "/consumables/label", color: "text-blue-500" },
      { id: "ISSUING", labelKey: "workflow.consumables.issuing", statusKey: "workflow.status.active", path: "/consumables/issuing", color: "text-amber-500" },
      { id: "MOUNT", labelKey: "workflow.consumables.mount", statusKey: "workflow.status.done", path: "/consumables/mount", color: "text-violet-500" },
      { id: "LIFE", labelKey: "workflow.consumables.life", statusKey: "workflow.status.managing", path: "/consumables/life", color: "text-pink-500" },
    ],
  },
  {
    id: "SHIPPING",
    titleKey: "workflow.shipping.title",
    icon: Truck,
    accent: "border-red-500",
    badgeColor: "bg-red-500",
    nodes: [
      { id: "PACK_RESULT", labelKey: "workflow.shipping.packResult", statusKey: "workflow.status.active", path: "/production/pack-result", color: "text-green-500" },
      { id: "PACK", labelKey: "workflow.shipping.pack", statusKey: "workflow.status.packing", path: "/shipping/pack", color: "text-cyan-500" },
      { id: "PALLET", labelKey: "workflow.shipping.pallet", statusKey: "workflow.status.palletizing", path: "/shipping/pallet", color: "text-blue-500" },
      { id: "OQC", labelKey: "workflow.shipping.oqc", statusKey: "workflow.status.inspecting", path: "/quality/oqc", color: "text-amber-500" },
      { id: "CONFIRM", labelKey: "workflow.shipping.confirm", statusKey: "workflow.status.confirming", path: "/shipping/confirm", color: "text-violet-500", reversePath: "/shipping/return", reverseKey: "workflow.action.return" },
      { id: "HISTORY", labelKey: "workflow.shipping.history", statusKey: "workflow.status.done", path: "/shipping/history", color: "text-purple-500" },
    ],
    branches: [{ afterNodeId: "OQC", conditions: [{ labelKey: "workflow.branch.pass", type: "pass" }, { labelKey: "workflow.branch.fail", type: "fail" }] }],
  },
  {
    id: "EQUIPMENT",
    titleKey: "workflow.equipment.title",
    icon: Wrench,
    accent: "border-violet-500",
    badgeColor: "bg-violet-500",
    nodes: [
      { id: "PM_PLAN", labelKey: "workflow.equipment.pmPlan", statusKey: "workflow.status.planning", path: "/equipment/pm-plan", color: "text-blue-500" },
      { id: "PM_CALENDAR", labelKey: "workflow.equipment.pmCalendar", statusKey: "workflow.status.scheduled", path: "/equipment/pm-calendar", color: "text-amber-500" },
      { id: "PM_RESULT", labelKey: "workflow.equipment.pmResult", statusKey: "workflow.status.executing", path: "/equipment/pm-result", color: "text-green-500" },
      { id: "DAILY", labelKey: "workflow.equipment.daily", statusKey: "workflow.status.inspecting", path: "/equipment/inspect-calendar", color: "text-cyan-500" },
      { id: "PERIODIC", labelKey: "workflow.equipment.periodic", statusKey: "workflow.status.inspecting", path: "/equipment/periodic-inspect-calendar", color: "text-violet-500" },
      { id: "HISTORY", labelKey: "workflow.equipment.history", statusKey: "workflow.status.done", path: "/equipment/inspect-history", color: "text-purple-500" },
    ],
  },
  {
    id: "OUTSOURCING",
    titleKey: "workflow.outsourcing.title",
    icon: Building2,
    accent: "border-emerald-500",
    badgeColor: "bg-emerald-500",
    nodes: [
      { id: "VENDOR", labelKey: "workflow.outsourcing.vendor", statusKey: "workflow.status.master", path: "/outsourcing/vendor", color: "text-green-500" },
      { id: "ORDER", labelKey: "workflow.outsourcing.order", statusKey: "workflow.status.ordering", path: "/outsourcing/order", color: "text-amber-500" },
      { id: "RECEIVE", labelKey: "workflow.outsourcing.receive", statusKey: "workflow.status.receiving", path: "/outsourcing/receive", color: "text-emerald-500" },
    ],
  },
  {
    id: "QUALITY",
    titleKey: "workflow.quality.title",
    icon: Shield,
    accent: "border-amber-500",
    badgeColor: "bg-amber-500",
    fullWidth: true,
    nodes: [
      { id: "IQC", labelKey: "workflow.quality.iqc", statusKey: "workflow.status.inspecting", path: "/material/iqc", color: "text-blue-500" },
      { id: "PROCESS_INSPECT", labelKey: "workflow.quality.processInspect", statusKey: "workflow.status.active", path: "/quality/inspect", color: "text-amber-500" },
      { id: "OQC", labelKey: "workflow.quality.oqc", statusKey: "workflow.status.pending", path: "/quality/oqc", color: "text-emerald-500" },
      { id: "DEFECT", labelKey: "workflow.quality.defect", statusKey: "workflow.status.reporting", path: "/quality/defect", color: "text-red-500" },
      { id: "REWORK", labelKey: "workflow.quality.rework", statusKey: "workflow.status.active", path: "/quality/rework", color: "text-orange-500" },
      { id: "REINSPECT", labelKey: "workflow.quality.reinspect", statusKey: "workflow.status.inspecting", path: "/quality/rework-inspect", color: "text-violet-500" },
      { id: "CAPA", labelKey: "workflow.quality.capa", statusKey: "workflow.status.done", path: "/quality/capa", color: "text-purple-500" },
    ],
  },
];
