# Workflow Business Map Design

## Purpose

`/workflow` is a business understanding map, not an operations dashboard. It should help a new HANES MES user understand how purchasing, material, IQC, production, inspection, shipping, traceability, and reversal workflows connect.

## Decisions

- Use `@xyflow/react` for a full interactive canvas.
- Use six swimlanes: purchasing/arrival, material/IQC, production, quality, product/shipping, traceability/reversal.
- Model nodes as business activities, not menu pages.
- Keep 25-35 nodes so the map explains the system without copying the sidebar.
- Show node details in a fixed right panel.
- Detail panel includes: purpose, related screens, data objects, previous activities, and next activities.
- Exclude real-time counts, KPI cards, backend package changes, write actions, and node editing.

## Data Model

The first version uses a static frontend definition in `apps/frontend/src/config/workflowMap.ts`.

Each node owns:

- `id`
- `lane`
- `title`
- `summary`
- `routes`
- `dataObjects`
- `inputs`
- `outputs`

Edges describe business handoff semantics, not simple menu navigation.

## UX

The canvas supports pan, zoom, minimap, fit view, search, lane filtering, and node selection. Node click selects the node and opens details. Route navigation happens only from explicit buttons in the detail panel.

## Verification

- Structure test confirms React Flow usage, no summary API dependency, static map definition, right detail panel, and route buttons.
- Frontend typecheck must pass.
- Browser check should confirm `/workflow` renders without console/page errors and the canvas is not blank.
