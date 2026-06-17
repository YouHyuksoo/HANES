# HANES Print Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Go local print agent that receives already-rendered label PNG payloads from HANES web and prints silently through the Windows printer driver.

**Architecture:** The agent is a separate Go app under `apps/print-agent`, bound to `127.0.0.1`. The web app owns label rendering and sends fixed-size PNG jobs; the agent only handles local printer discovery, configuration, logging, and Windows driver output.

**Tech Stack:** Go standard library, Windows GDI printing APIs, Next.js/TypeScript fetch client, Node structure tests.

---

### Task 1: Agent Contract And Structure

**Files:**
- Create: `tools/print-agent.structure.test.mjs`
- Create: `apps/print-agent/go.mod`
- Create: `apps/print-agent/README.md`
- Create: `apps/print-agent/cmd/hanes-print-agent/main.go`
- Create: `apps/print-agent/internal/server/server.go`
- Create: `apps/print-agent/internal/config/config.go`
- Create: `apps/print-agent/internal/printer/printer.go`
- Create: `apps/print-agent/internal/printer/printer_windows.go`
- Create: `apps/print-agent/internal/printer/printer_stub.go`
- Create: `apps/print-agent/internal/jobs/log.go`

- [ ] **Step 1: Write the failing structure test**

Run: `node tools/print-agent.structure.test.mjs`
Expected: FAIL because `apps/print-agent` does not exist yet.

- [ ] **Step 2: Add Go agent skeleton and APIs**

Implement `GET /health`, `GET /printers`, `GET /config`, `POST /config`, `POST /print`, and `POST /test-print`.

- [ ] **Step 3: Add Windows PNG print implementation**

Decode base64 PNG, render it to the target printer DC using Windows GDI, and return the spool submission result.

- [ ] **Step 4: Add frontend client**

Create `apps/frontend/src/services/print-agent.ts` with `checkPrintAgent`, `getPrintAgentPrinters`, `printAgentPng`, and `savePrintAgentConfig`.

- [ ] **Step 5: Verify**

Run:
- `node tools/print-agent.structure.test.mjs`
- `go test ./...` from `apps/print-agent` when Go is installed.

Expected:
- Node structure test passes.
- Go test/build is blocked on machines without Go installed.

### Task 2: Agent-Owned Settings Management

**Files:**
- Modify: `tools/print-agent.structure.test.mjs`
- Modify: `apps/print-agent/internal/server/server.go`
- Create: `apps/print-agent/internal/server/settings_page.go`
- Modify: `apps/print-agent/internal/tray/tray_windows.go`
- Modify: `apps/print-agent/internal/tray/tray_stub.go`
- Modify: `apps/print-agent/cmd/hanes-print-agent/run_windows.go`
- Modify: `apps/print-agent/README.md`

- [x] **Step 1: Write the failing structure test**

Run: `node tools/print-agent.structure.test.mjs`
Expected: FAIL because `/settings`, tray `설정`, `ShellExecuteW`, and restart metadata are missing.

- [x] **Step 2: Add agent settings page**

Implement `GET /settings` as an agent-owned local HTML page. It must load `/health`, `/config`, `/printers`, save `/config`, and run `/test-print`.

- [x] **Step 3: Make config save operationally safe**

Expose `effectiveListenAddress` and `restartRequired`. Preserve an existing token unless `clearToken` is explicitly sent, so normal config saves do not accidentally clear security.

- [x] **Step 4: Add tray settings entry**

Add `설정` to the Windows tray menu and open `http://<listenAddress>/settings` with `ShellExecuteW`.

- [x] **Step 5: Verify**

Run:
- `node tools/print-agent.structure.test.mjs`
- `C:\go\bin\go.exe test ./...`
- `C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent`
- Restart the local agent and verify `GET /settings`, `GET/POST /config`, and `POST /test-print`.

Expected:
- Structure and Go tests pass.
- `/settings` returns HTTP 200.
- `defaultPrinter` persists to `config.json`.
- `/test-print` can print using saved `defaultPrinter`.
- Temporary listenAddress change returns `restartRequired=true` and restore returns `false`.
