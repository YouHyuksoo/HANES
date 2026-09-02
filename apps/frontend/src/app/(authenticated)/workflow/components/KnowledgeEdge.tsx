import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { KnowledgeEdgeData } from "../knowledge/knowledge-view-model";
import { useTranslation } from "react-i18next";

/**
 * 지식맵 엣지 — 관계 종류에 따라 선 모양을 바꾸고 라벨을 띄운다.
 *
 * BaseEdge에 props를 통째로 펼치지 않는다. EdgeProps에는 selectable·deletable처럼
 * DOM 속성이 아닌 값이 섞여 있어, 그대로 넘기면 <path>까지 흘러가 React가 경고한다.
 * 필요한 값만 명시적으로 전달한다.
 */
export function KnowledgeEdge(props: EdgeProps) {
  const { t } = useTranslation();
  const data = props.data as (KnowledgeEdgeData & { condition?: string }) | undefined;
  const [path, x, y] = getBezierPath(props);
  const dashed = data?.kind === "branchesTo" || data?.kind === "raises" || data?.kind === "recoversWith";
  const double = data?.kind === "requires" || data?.kind === "validates";

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
        style={{
          ...props.style,
          strokeWidth: double ? 3 : 1.5,
          strokeDasharray: dashed ? "7 5" : undefined,
          opacity: data?.opacity,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none absolute rounded-sm border border-border bg-card px-2 py-1 font-mono text-[10px] text-text"
          style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}
        >
          {String(props.label ?? data?.kind ?? t("workflowGuide.knowledge.relation"))}
          {data?.condition && (
            <span className="block text-warning">
              {t("workflowGuide.knowledge.condition", { condition: data.condition })}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
