import type { LayoutMode, ViewMode } from "../knowledge/knowledge-state";
import { useTranslation } from "react-i18next";

interface Props { layout: LayoutMode; view: ViewMode; canGoBack: boolean; canGoForward: boolean; onLayout: (v: LayoutMode) => void; onView: (v: ViewMode) => void; onBack: () => void; onForward: () => void; onReset: () => void; onFitView: () => void; onCopyLink: () => void; copyStatus?: string }
const layouts: LayoutMode[] = ["mindmap", "process", "relation"];
const views: ViewMode[] = ["business", "technical"];
export function KnowledgeToolbar(p: Props) { const { t } = useTranslation(); const actions = [["back",p.onBack,!p.canGoBack],["forward",p.onForward,!p.canGoForward],["reset",p.onReset,false],["fit",p.onFitView,false],["copy",p.onCopyLink,false]] as const; return <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2" aria-label={t("workflowGuide.knowledge.toolbar.label")}>
  <div className="flex rounded-md border border-border">{layouts.map((v) => <button key={v} type="button" aria-pressed={p.layout === v} onClick={() => p.onLayout(v)} className="px-3 py-1.5 text-xs text-text aria-pressed:bg-primary aria-pressed:text-primary-foreground">{t(`workflowGuide.knowledge.layouts.${v}`)}</button>)}</div>
  <div className="flex rounded-md border border-border">{views.map((v) => <button key={v} type="button" aria-pressed={p.view === v} onClick={() => p.onView(v)} className="px-3 py-1.5 text-xs text-text aria-pressed:bg-surface-hover">{t(`workflowGuide.knowledge.views.${v}`)}</button>)}</div>
  <span className="hidden h-5 w-px bg-border sm:block" />
  {actions.map(([key, action, disabled]) => <button key={key} type="button" aria-label={t(`workflowGuide.knowledge.toolbar.${key}`)} disabled={disabled} onClick={action} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text disabled:opacity-40">{t(`workflowGuide.knowledge.toolbar.${key}`)}</button>)}
  {p.copyStatus && <span role="status" className="text-xs text-text-muted">{p.copyStatus}</span>}
</div> }
