import type { LayoutMode, ViewMode } from "../knowledge/knowledge-state";

interface Props { layout: LayoutMode; view: ViewMode; canGoBack: boolean; canGoForward: boolean; onLayout: (v: LayoutMode) => void; onView: (v: ViewMode) => void; onBack: () => void; onForward: () => void; onReset: () => void; onFitView: () => void; onCopyLink: () => void; copyStatus?: string }
const layouts: [LayoutMode, string][] = [["mindmap", "마인드맵"], ["process", "프로세스"], ["relation", "관계"]];
const views: [ViewMode, string][] = [["business", "업무"], ["technical", "기술"]];
export function KnowledgeToolbar(p: Props) { return <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2" aria-label="지식 지도 도구">
  <div className="flex rounded-md border border-border">{layouts.map(([v,l]) => <button key={v} type="button" aria-pressed={p.layout === v} onClick={() => p.onLayout(v)} className="px-3 py-1.5 text-xs text-text aria-pressed:bg-primary aria-pressed:text-primary-foreground">{l}</button>)}</div>
  <div className="flex rounded-md border border-border">{views.map(([v,l]) => <button key={v} type="button" aria-pressed={p.view === v} onClick={() => p.onView(v)} className="px-3 py-1.5 text-xs text-text aria-pressed:bg-surface-hover">{l}</button>)}</div>
  <span className="hidden h-5 w-px bg-border sm:block" />
  {[['뒤로',p.onBack,!p.canGoBack],['앞으로',p.onForward,!p.canGoForward],['초기화',p.onReset,false],['전체 보기',p.onFitView,false],['링크 복사',p.onCopyLink,false]].map(([label, action, disabled]) => <button key={String(label)} type="button" aria-label={String(label)} disabled={Boolean(disabled)} onClick={action as () => void} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text disabled:opacity-40">{String(label)}</button>)}
  {p.copyStatus && <span role="status" className="text-xs text-text-muted">{p.copyStatus}</span>}
</div> }
