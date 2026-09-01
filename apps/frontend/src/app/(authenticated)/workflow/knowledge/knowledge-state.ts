import {
  KNOWLEDGE_CATEGORIES,
  workflowKnowledgeCatalog,
  type KnowledgeRelationCategory,
} from "@harness/shared";

export type LayoutMode = "mindmap" | "process" | "relation";
export type ViewMode = "business" | "technical";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "mindmap";
export const DEFAULT_VIEW_MODE: ViewMode = "business";
export const LAYOUT_PREFERENCE_KEY = "workflow-knowledge-layout";
export const VIEW_PREFERENCE_KEY = "workflow-knowledge-view";

const LAYOUT_MODES: readonly LayoutMode[] = ["mindmap", "process", "relation"];
const VIEW_MODES: readonly ViewMode[] = ["business", "technical"];
export const RELATION_CATEGORIES: readonly KnowledgeRelationCategory[] = [
  ...KNOWLEDGE_CATEGORIES,
  "evidence",
];

interface HistoryLike {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NavigationEnvironment {
  location: { href: string };
  history: HistoryLike;
  localStorage?: StorageLike;
}

export interface KnowledgeNavigationSnapshot {
  centerId: string | null;
  invalidCenter: string | null;
  layout: LayoutMode;
  view: ViewMode;
  relations: readonly KnowledgeRelationCategory[];
  canGoBack: boolean;
  canGoForward: boolean;
}

const isLayoutMode = (value: string | null): value is LayoutMode =>
  LAYOUT_MODES.includes(value as LayoutMode);
const isViewMode = (value: string | null): value is ViewMode =>
  VIEW_MODES.includes(value as ViewMode);
const isRelationCategory = (value: string): value is KnowledgeRelationCategory =>
  RELATION_CATEGORIES.includes(value as KnowledgeRelationCategory);

const readPreference = <T extends string>(
  storage: StorageLike | undefined,
  key: string,
  validate: (value: string | null) => value is T,
  fallback: T,
): T => {
  const value = storage?.getItem(key) ?? null;
  return validate(value) ? value : fallback;
};

const parseRelations = (value: string | null): KnowledgeRelationCategory[] => {
  if (value === null) return [...RELATION_CATEGORIES];
  const requested = new Set(value.split(",").filter(isRelationCategory));
  return RELATION_CATEGORIES.filter((category) => requested.has(category));
};

export function parseKnowledgeNavigation(
  url: string | URL,
  storage?: StorageLike,
): Omit<KnowledgeNavigationSnapshot, "canGoBack" | "canGoForward"> {
  const parsed = url instanceof URL ? new URL(url) : new URL(url, "http://localhost");
  const requestedCenter = parsed.searchParams.get("center");
  const knownCenter = requestedCenter
    ? workflowKnowledgeCatalog.nodes.some((node) => node.id === requestedCenter)
    : false;
  const centerId = requestedCenter
    ? knownCenter ? requestedCenter : null
    : workflowKnowledgeCatalog.nodes[0]?.id ?? null;
  const urlLayout = parsed.searchParams.get("layout");
  const urlView = parsed.searchParams.get("view");

  return {
    centerId,
    invalidCenter: requestedCenter && !knownCenter ? requestedCenter : null,
    layout: urlLayout === null
      ? readPreference(storage, LAYOUT_PREFERENCE_KEY, isLayoutMode, DEFAULT_LAYOUT_MODE)
      : isLayoutMode(urlLayout) ? urlLayout : DEFAULT_LAYOUT_MODE,
    view: urlView === null
      ? readPreference(storage, VIEW_PREFERENCE_KEY, isViewMode, DEFAULT_VIEW_MODE)
      : isViewMode(urlView) ? urlView : DEFAULT_VIEW_MODE,
    relations: parseRelations(parsed.searchParams.get("relations")),
  };
}

export class KnowledgeNavigationModel {
  private readonly environment: NavigationEnvironment;
  private state: Omit<KnowledgeNavigationSnapshot, "canGoBack" | "canGoForward">;
  private centerHistory: string[];
  private centerHistoryIndex: number;

  constructor(environment: NavigationEnvironment) {
    this.environment = environment;
    this.state = parseKnowledgeNavigation(environment.location.href, environment.localStorage);
    this.centerHistory = this.state.centerId ? [this.state.centerId] : [];
    this.centerHistoryIndex = this.centerHistory.length - 1;
    this.syncUrl();
  }

  get snapshot(): KnowledgeNavigationSnapshot {
    return {
      ...this.state,
      canGoBack: this.centerHistoryIndex > 0,
      canGoForward: this.centerHistoryIndex >= 0 && this.centerHistoryIndex < this.centerHistory.length - 1,
    };
  }

  setCenter(centerId: string): void {
    const known = workflowKnowledgeCatalog.nodes.some((node) => node.id === centerId);
    this.state = { ...this.state, centerId: known ? centerId : null, invalidCenter: known ? null : centerId };
    if (known && this.centerHistory[this.centerHistoryIndex] !== centerId) {
      this.centerHistory = this.centerHistory.slice(0, this.centerHistoryIndex + 1);
      this.centerHistory.push(centerId);
      this.centerHistoryIndex = this.centerHistory.length - 1;
    }
    this.syncUrl();
  }

  setLayout(layout: LayoutMode): void {
    this.state = { ...this.state, layout };
    this.environment.localStorage?.setItem(LAYOUT_PREFERENCE_KEY, layout);
    this.syncUrl();
  }

  setView(view: ViewMode): void {
    this.state = { ...this.state, view };
    this.environment.localStorage?.setItem(VIEW_PREFERENCE_KEY, view);
    this.syncUrl();
  }

  setRelations(relations: readonly KnowledgeRelationCategory[]): void {
    const selected = new Set(relations);
    this.state = { ...this.state, relations: RELATION_CATEGORIES.filter((category) => selected.has(category)) };
    this.syncUrl();
  }

  goBack(): boolean {
    if (this.centerHistoryIndex <= 0) return false;
    this.centerHistoryIndex -= 1;
    this.restoreCenterFromHistory();
    return true;
  }

  goForward(): boolean {
    if (this.centerHistoryIndex < 0 || this.centerHistoryIndex >= this.centerHistory.length - 1) return false;
    this.centerHistoryIndex += 1;
    this.restoreCenterFromHistory();
    return true;
  }

  private restoreCenterFromHistory(): void {
    this.state = { ...this.state, centerId: this.centerHistory[this.centerHistoryIndex] ?? null, invalidCenter: null };
    this.syncUrl();
  }

  private syncUrl(): void {
    const url = new URL(this.environment.location.href, "http://localhost");
    url.search = "";
    const center = this.state.invalidCenter ?? this.state.centerId;
    if (center) url.searchParams.set("center", center);
    url.searchParams.set("layout", this.state.layout);
    url.searchParams.set("view", this.state.view);
    url.searchParams.set("relations", this.state.relations.join(","));
    this.environment.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}
