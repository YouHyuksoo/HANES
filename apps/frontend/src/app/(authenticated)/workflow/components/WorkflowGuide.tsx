"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, Clock, Database, ExternalLink, HelpCircle, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  workflowLanes,
  getPreviousNodes,
  getNextNodes,
  type WorkflowActivityNode,
} from "@/config/workflowMap";
import WorkflowHelpInline from "./WorkflowHelpInline";
import WorkflowSchemaPanel from "./WorkflowSchemaPanel";

const laneById = new Map(workflowLanes.map((l) => [l.id, l]));

export default function WorkflowGuide({
  node,
  onSelect,
}: {
  node: WorkflowActivityNode;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [schemaTable, setSchemaTable] = useState<string | null>(null);
  const [isNavPending, startNav] = useTransition();
  const [navPath, setNavPath] = useState<string | null>(null);
  const lane = laneById.get(node.lane);

  // 화면 바로가기: 클릭 즉시 pending 표시 후 이동(대상 페이지 로딩 동안 스피너)
  const goToRoute = (path: string) => {
    setNavPath(path);
    startNav(() => router.push(path));
  };
  const previous = getPreviousNodes(node.id);
  const next = getNextNodes(node.id);

  // 다른 단계를 선택하면 열려 있던 스키마 패널을 닫는다
  useEffect(() => {
    setSchemaTable(null);
  }, [node.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      {/* 헤더 */}
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane?.color }} />
          {lane?.title}
          {typeof node.order === "number" && <span className="text-text-muted">· {node.order}{t("workflowGuide.stepSuffix", "단계")}</span>}
        </div>
        <h2 className="text-2xl font-semibold">{node.activity}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{node.detail}</p>
      </div>

      {/* 왜 / 언제 / 주의점 */}
      {node.why && (
        <GuideBlock icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title={t("workflowGuide.why", "왜 하는가")}>
          <p className="text-sm leading-6 text-text">{node.why}</p>
        </GuideBlock>
      )}
      {node.when && (
        <GuideBlock icon={<Clock className="h-4 w-4 text-sky-500" />} title={t("workflowGuide.when", "언제 하는가")}>
          <p className="text-sm leading-6 text-text">{node.when}</p>
        </GuideBlock>
      )}
      {node.cautions && node.cautions.length > 0 && (
        <GuideBlock icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} title={t("workflowGuide.cautions", "주의점")}>
          <ul className="space-y-1">
            {node.cautions.map((c) => (
              <li key={c} className="text-sm leading-6 text-text">- {c}</li>
            ))}
          </ul>
        </GuideBlock>
      )}

      {/* 입력 / 산출 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title={t("workflowGuide.inputs", "입력")}>
          <ul className="space-y-1">
            {node.inputs.map((i) => (
              <li key={i} className="text-xs text-text-muted">- {i}</li>
            ))}
          </ul>
        </GuideBlock>
        <GuideBlock title={t("workflowGuide.outputs", "산출")}>
          <ul className="space-y-1">
            {node.outputs.map((o) => (
              <li key={o} className="text-xs text-text-muted">- {o}</li>
            ))}
          </ul>
        </GuideBlock>
      </section>

      {/* 화면 바로가기 */}
      <GuideBlock title={t("workflowGuide.routes", "화면 바로가기")}>
        <div className="space-y-2">
          {node.routes.map((route) => {
            const navigating = isNavPending && navPath === route.path;
            return (
              <Button
                key={route.path}
                variant="secondary"
                size="sm"
                className="w-full justify-between"
                onClick={() => goToRoute(route.path)}
                disabled={isNavPending}
              >
                <span>{navigating ? t("workflowGuide.opening", "여는 중…") : route.label}</span>
                {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              </Button>
            );
          })}
        </div>
      </GuideBlock>

      {/* 관련 화면 도움말 (help md 인라인) */}
      <GuideBlock icon={<HelpCircle className="h-4 w-4 text-primary" />} title={t("workflowGuide.help", "관련 화면 도움말")}>
        <WorkflowHelpInline node={node} />
      </GuideBlock>

      {/* 생성/변경 데이터 — 칩 클릭 시 우측 스키마 패널 */}
      <GuideBlock title={t("workflowGuide.dataObjects", "생성/변경 데이터")}>
        <div className="flex flex-wrap gap-1.5">
          {node.dataObjects.map((obj) => {
            const active = schemaTable === obj;
            return (
              <button
                key={obj}
                type="button"
                onClick={() => setSchemaTable(obj)}
                title={t("workflowGuide.viewSchema", "테이블 스키마 보기")}
                className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-text-muted hover:border-primary/60 hover:text-text"
                }`}
              >
                <Database className="mr-1 inline h-3 w-3" />
                {obj}
              </button>
            );
          })}
        </div>
      </GuideBlock>

      {/* 선행 / 후행 */}
      <section className="grid grid-cols-2 gap-3">
        <GuideBlock title={t("workflowGuide.previous", "선행 업무")}>
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
        <GuideBlock title={t("workflowGuide.next", "후행 업무")}>
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

      {schemaTable && (
        <WorkflowSchemaPanel tableName={schemaTable} onClose={() => setSchemaTable(null)} />
      )}
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
