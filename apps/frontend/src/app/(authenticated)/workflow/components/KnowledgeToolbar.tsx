import {
  ArrowLeft,
  ArrowRight,
  Hand,
  Link2,
  LocateFixed,
  Maximize,
  Maximize2,
  Minimize2,
  MousePointer2,
  RotateCcw,
} from "lucide-react";
import type { ViewMode } from "../knowledge/knowledge-state";
import type { CanvasCursorMode } from "./KnowledgeCanvas";
import { useTranslation } from "react-i18next";

interface Props {
  view: ViewMode;
  canGoBack: boolean;
  canGoForward: boolean;
  /** 선택한 노드를 새 중심으로 잡을 수 있는가(선택이 없거나 이미 중심이면 false) */
  canRecenter: boolean;
  cursorMode: CanvasCursorMode;
  isFullscreen: boolean;
  onView: (v: ViewMode) => void;
  onCursorMode: (v: CanvasCursorMode) => void;
  onBack: () => void;
  onForward: () => void;
  onReset: () => void;
  onRecenter: () => void;
  onFitView: () => void;
  onCopyLink: () => void;
  onToggleFullscreen: () => void;
  copyStatus?: string;
}

const views: ViewMode[] = ["business", "technical"];

/** 아이콘 버튼 — 라벨은 tooltip/aria로만 두어 한 줄에 들어가게 한다 */
const iconButton =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-muted hover:text-text disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function KnowledgeToolbar(p: Props) {
  const { t } = useTranslation();

  const actions = [
    { key: "back", icon: <ArrowLeft className="h-3.5 w-3.5" />, run: p.onBack, disabled: !p.canGoBack },
    { key: "forward", icon: <ArrowRight className="h-3.5 w-3.5" />, run: p.onForward, disabled: !p.canGoForward },
    { key: "recenter", icon: <LocateFixed className="h-3.5 w-3.5" />, run: p.onRecenter, disabled: !p.canRecenter },
    { key: "reset", icon: <RotateCcw className="h-3.5 w-3.5" />, run: p.onReset, disabled: false },
    { key: "fit", icon: <Maximize className="h-3.5 w-3.5" />, run: p.onFitView, disabled: false },
    { key: "copy", icon: <Link2 className="h-3.5 w-3.5" />, run: p.onCopyLink, disabled: false },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t("workflowGuide.knowledge.toolbar.label")}>
      {/* 관점 */}
      <div className="flex overflow-hidden rounded-md border border-border">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={p.view === v}
            onClick={() => p.onView(v)}
            className="px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-muted aria-pressed:bg-surface-hover aria-pressed:text-text"
          >
            {t(`workflowGuide.knowledge.views.${v}`)}
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      {/* 커서 도구 — 포인터(선택·노드 이동) / 손(화면 이동) */}
      <div className="flex overflow-hidden rounded-md border border-border">
        <button
          type="button"
          aria-pressed={p.cursorMode === "select"}
          title={t("workflowGuide.knowledge.toolbar.cursorSelect")}
          aria-label={t("workflowGuide.knowledge.toolbar.cursorSelect")}
          onClick={() => p.onCursorMode("select")}
          className="inline-flex h-7 w-7 items-center justify-center text-text-muted transition-colors hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          <MousePointer2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-pressed={p.cursorMode === "pan"}
          title={t("workflowGuide.knowledge.toolbar.cursorPan")}
          aria-label={t("workflowGuide.knowledge.toolbar.cursorPan")}
          onClick={() => p.onCursorMode("pan")}
          className="inline-flex h-7 w-7 items-center justify-center text-text-muted transition-colors hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          <Hand className="h-3.5 w-3.5" />
        </button>
      </div>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      {/* 이동·보기 액션 */}
      {actions.map(({ key, icon, run, disabled }) => (
        <button
          key={key}
          type="button"
          title={t(`workflowGuide.knowledge.toolbar.${key}`)}
          aria-label={t(`workflowGuide.knowledge.toolbar.${key}`)}
          disabled={disabled}
          onClick={run}
          className={iconButton}
        >
          {icon}
        </button>
      ))}

      {/* 전체화면 */}
      <button
        type="button"
        title={t(`workflowGuide.knowledge.toolbar.${p.isFullscreen ? "exitFullscreen" : "fullscreen"}`)}
        aria-label={t(`workflowGuide.knowledge.toolbar.${p.isFullscreen ? "exitFullscreen" : "fullscreen"}`)}
        aria-pressed={p.isFullscreen}
        onClick={p.onToggleFullscreen}
        className={iconButton}
      >
        {p.isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>

      {p.copyStatus && (
        <span role="status" className="text-[11px] text-text-muted">
          {p.copyStatus}
        </span>
      )}
    </div>
  );
}
