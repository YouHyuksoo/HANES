# Workflow Business Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/workflow` as an interactive React Flow business-system relationship map.

**Architecture:** Keep workflow knowledge in a static frontend map and render it through `@xyflow/react`. The page owns selection/search/filter UI and a fixed detail panel. No backend or Oracle package change is required.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@xyflow/react`, lucide-react, Node structure tests, `pnpm.cmd`.

---

### Task 1: Static Map Definition

**Files:**
- Create: `apps/frontend/src/config/workflowMap.ts`

- [ ] Define lane, node, edge, and route types.
- [ ] Add six lanes.
- [ ] Add 25-35 business activity nodes.
- [ ] Add business handoff edges.

### Task 2: Structure Test

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs`

- [ ] Assert `/workflow/page.tsx` imports `@xyflow/react`.
- [ ] Assert page does not call `/workflow/summary`.
- [ ] Assert static map import exists.
- [ ] Assert detail panel and route navigation exist.

### Task 3: React Flow Page

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/workflow/page.tsx`

- [ ] Replace the old card grid with a three-part layout: top toolbar, canvas, right detail panel.
- [ ] Convert map nodes and edges to React Flow nodes and edges.
- [ ] Implement custom business activity node.
- [ ] Add search and lane filters.
- [ ] Add detail panel with related route buttons.

### Task 4: Verification

**Commands:**
- `node --test "apps/frontend/src/app/(authenticated)/workflow/workflow-business-map.structure.test.mjs"`
- `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- `git diff --check -- apps/frontend/src/config/workflowMap.ts "apps/frontend/src/app/(authenticated)/workflow" docs/superpowers/specs/2026-06-24-workflow-business-map-design.md docs/superpowers/plans/2026-06-24-workflow-business-map.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md`

### Task 5: Coordination

- [ ] Append result and verification to `JOURNAL.md`.
- [ ] Update `HANDOFF/codex.md`.
- [ ] Move task to `REVIEW` in `TASKS.md`.
