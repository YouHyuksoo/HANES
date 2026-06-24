"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  getNodesByLane,
  getVisibleNodeIds,
  workflowLanes,
  type WorkflowLaneId,
} from "@/config/workflowMap";

const allLaneIds = new Set<WorkflowLaneId>(workflowLanes.map((l) => l.id));

export default function WorkflowSidebar({
  query,
  selectedNodeId,
  onSelect,
}: {
  query: string;
  selectedNodeId: string;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<WorkflowLaneId>>(() => new Set());
  const visibleIds = useMemo(() => getVisibleNodeIds(query, allLaneIds), [query]);
  const groups = useMemo(() => getNodesByLane(), []);

  const toggleLane = (id: WorkflowLaneId) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav className="h-full overflow-y-auto border-r border-border bg-surface">
      {groups.map(({ lane, nodes }) => {
        const shown = nodes.filter((n) => visibleIds.has(n.id));
        if (query.trim() && shown.length === 0) return null;
        const isCollapsed = collapsed.has(lane.id) && !query.trim();
        return (
          <div key={lane.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => toggleLane(lane.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
              <span className="flex-1 truncate">{lane.title}</span>
              <span className="text-xs text-text-muted">{shown.length}</span>
            </button>
            {!isCollapsed && (
              <ul className="pb-1">
                {shown.map((n) => {
                  const active = n.id === selectedNodeId;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(n.id)}
                        className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-sm transition-colors ${
                          active ? "bg-primary/10 font-semibold text-primary" : "text-text hover:bg-muted"
                        }`}
                      >
                        {typeof n.order === "number" && (
                          <span className="w-4 shrink-0 text-xs text-text-muted">{n.order}</span>
                        )}
                        <span className="truncate">{n.activity}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
