"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock, Database, ExternalLink, HelpCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui";
import {
  workflowLanes,
  getPreviousNodes,
  getNextNodes,
  type WorkflowActivityNode,
} from "@/config/workflowMap";
import WorkflowHelpInline from "./WorkflowHelpInline";

const laneById = new Map(workflowLanes.map((l) => [l.id, l]));

export default function WorkflowGuide({
  node,
  onSelect,
}: {
  node: WorkflowActivityNode;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const lane = laneById.get(node.lane);
  const previous = getPreviousNodes(node.id);
  const next = getNextNodes(node.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      {/* 헤더 */}
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane?.color }} />
          {lane?.title}
          {typeof node.order === "number" && <span className="text-text-muted">· {node.order}단계</span>}
        </div>
        <h2 className="text-2xl font-semibold">{node.activity}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{node.detail}</p>
      </div>

      {/* 왜 / 언제 / 주의점 */}
      {node.why && (
        <GuideBlock icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title="왜 하는가">
          <p className="text-sm leading-6 text-text">{node.why}</p>
        </GuideBlock>
      )}
      {node.when && (
        <GuideBlock icon={<Clock className="h-4 w-4 text-sky-500" />} title="언제 하는가">
          <p className="text-sm leading-6 text-text">{node.when}</p>
        </GuideBlock>
      )}
      {node.cautions && node.cautions.length > 0 && (
        <GuideBlock icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} title="주의점">
          <ul className="space-y-1">
            {node.cautions.map((c) => (
              <li key={c} className="text-sm leading-6 text-text">- {c}</li>
            ))}
          </ul>
        </GuideBlock>
      )}

      {/* 입력 / 산출 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title="입력">
          <ul className="space-y-1">
            {node.inputs.map((i) => (
              <li key={i} className="text-xs text-text-muted">- {i}</li>
            ))}
          </ul>
        </GuideBlock>
        <GuideBlock title="산출">
          <ul className="space-y-1">
            {node.outputs.map((o) => (
              <li key={o} className="text-xs text-text-muted">- {o}</li>
            ))}
          </ul>
        </GuideBlock>
      </section>

      {/* 화면 바로가기 */}
      <GuideBlock title="화면 바로가기">
        <div className="space-y-2">
          {node.routes.map((route) => (
            <Button
              key={route.path}
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => router.push(route.path)}
            >
              <span>{route.label}</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </GuideBlock>

      {/* 관련 화면 도움말 (help md 인라인) */}
      <GuideBlock icon={<HelpCircle className="h-4 w-4 text-primary" />} title="관련 화면 도움말">
        <WorkflowHelpInline node={node} />
      </GuideBlock>

      {/* 생성/변경 데이터 */}
      <GuideBlock title="생성/변경 데이터">
        <div className="flex flex-wrap gap-1.5">
          {node.dataObjects.map((obj) => (
            <span key={obj} className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-muted">
              <Database className="mr-1 inline h-3 w-3" />
              {obj}
            </span>
          ))}
        </div>
      </GuideBlock>

      {/* 선행 / 후행 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title="선행 업무">
          {previous.length === 0 ? (
            <p className="text-xs text-text-muted">이 맵의 시작 업무입니다.</p>
          ) : (
            <div className="space-y-2">
              {previous.map(({ edge, node: p }) => (
                <RelationButton key={edge.id} label={p.activity} edgeLabel={edge.label} onClick={() => onSelect(p.id)} />
              ))}
            </div>
          )}
        </GuideBlock>
        <GuideBlock title="후행 업무">
          {next.length === 0 ? (
            <p className="text-xs text-text-muted">이 맵의 종료 또는 조회 업무입니다.</p>
          ) : (
            <div className="space-y-2">
              {next.map(({ edge, node: n }) => (
                <RelationButton key={edge.id} label={n.activity} edgeLabel={edge.label} onClick={() => onSelect(n.id)} />
              ))}
            </div>
          )}
        </GuideBlock>
      </section>
    </div>
  );
}

function GuideBlock({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function RelationButton({ label, edgeLabel, onClick }: { label: string; edgeLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary/60"
    >
      <span>
        <span className="font-semibold text-text">{label}</span>
        <span className="ml-2 text-text-muted">{edgeLabel}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
    </button>
  );
}
