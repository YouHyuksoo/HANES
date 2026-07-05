# AI Embedding 청킹 대상 파일/폴더 UI 구분 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/system/config` Embedding 탭의 "청킹 대상 추가" 입력창에 파일/폴더 모드 토글을 추가해, 이미 백엔드가 지원하는 폴더(재귀 `.md` 수집) 대상 추가 기능을 UI에서 명확히 드러낸다.

**Architecture:** `apps/frontend/src/components/system/AiEmbeddingPanel.tsx` 단일 컴포넌트에 로컬 UI state(`addMode`)만 추가한다. 입력 검증(`toChunkTarget`)과 백엔드 API(`/ai/knowledge/reindex`)는 변경하지 않는다 — 폴더 재귀 처리는 이미 `ai-knowledge.service.ts`에 구현되어 있다. 대상 목록의 파일/폴더 아이콘은 `target.path`가 `.md`로 끝나는지 여부로 추론하며, 별도 데이터 필드 없이 기존 `localStorage` 데이터와 호환된다.

**Tech Stack:** Next.js (React function component, client component `"use client"`), lucide-react 아이콘, 기존 `components/ui`의 `Button`/`Input`.

## Global Constraints

- 이 파일은 기존에 i18n(`t()`) 대신 하드코딩된 한글 문자열을 사용하는 패턴이다. 새로 추가하는 문자열도 기존 패턴을 따라 하드코딩된 한글로 작성한다(i18n 키 추가하지 않음).
- 백엔드(`ai-knowledge.controller.ts`, `ai-knowledge.service.ts`)는 수정하지 않는다.
- 이 컴포넌트에는 기존 자동화 테스트가 없다. 새 자동화 테스트를 추가하지 않고, 각 태스크는 개발 서버에서 수동 확인으로 검증한다(설계 문서 `docs/superpowers/specs/2026-07-04-ai-embedding-chunk-target-folder-ui-design.md`의 테스트 섹션과 동일).
- 개발 서버는 기본 포트 3002. 이미 떠 있으면 새로 띄우지 않는다.

---

### Task 1: 파일/폴더 모드 토글 + placeholder/버튼/안내문구 전환

**Files:**
- Modify: `apps/frontend/src/components/system/AiEmbeddingPanel.tsx:9` (아이콘 import)
- Modify: `apps/frontend/src/components/system/AiEmbeddingPanel.tsx:157` (state 추가)
- Modify: `apps/frontend/src/components/system/AiEmbeddingPanel.tsx:466-489` (토글 UI + placeholder/버튼 전환 + 안내문구)

**Interfaces:**
- Produces: `addMode: "file" | "folder"` state and `setAddMode` — Task 2는 이 값을 사용하지 않는다(Task 2는 `target.path`만 사용). 이 태스크만으로 독립적으로 완결된다.

- [ ] **Step 1: lucide-react 아이콘 import에 `Folder`, `FileText` 추가**

`apps/frontend/src/components/system/AiEmbeddingPanel.tsx:9`의 기존 import 라인을 아래로 교체:

```tsx
import { Database, FileText, Folder, LoaderCircle, Play, Plug, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from "lucide-react";
```

- [ ] **Step 2: `addMode` state 추가**

`apps/frontend/src/components/system/AiEmbeddingPanel.tsx:157` 부근, `const [newTargetPath, setNewTargetPath] = useState("");` 바로 다음 줄에 추가:

```tsx
  const [newTargetPath, setNewTargetPath] = useState("");
  const [addMode, setAddMode] = useState<"file" | "folder">("file");
```

- [ ] **Step 3: 토글 UI + placeholder/버튼 라벨 전환 + 폴더 모드 안내문구**

`apps/frontend/src/components/system/AiEmbeddingPanel.tsx:466-489`의 기존 블록:

```tsx
            <div className="rounded-md border border-border bg-surface-secondary/50 p-2">
              <div className="flex flex-col gap-2 lg:flex-row">
                <Input
                  value={newTargetPath}
                  onChange={(e) => setNewTargetPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTarget();
                    }
                  }}
                  placeholder="docs/custom 또는 docs/custom/file.md"
                  fullWidth
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleAddTarget} disabled={!newTargetPath.trim()}>
                    <Plus className="h-4 w-4" />
                    추가
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRestoreDefaultTargets} title="기본 대상 복원">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
```

를 아래로 교체:

```tsx
            <div className="rounded-md border border-border bg-surface-secondary/50 p-2">
              <div className="flex gap-1.5">
                <Button
                  variant={addMode === "file" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setAddMode("file")}
                >
                  <FileText className="h-4 w-4" />
                  파일
                </Button>
                <Button
                  variant={addMode === "folder" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setAddMode("folder")}
                >
                  <Folder className="h-4 w-4" />
                  폴더
                </Button>
              </div>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                <Input
                  value={newTargetPath}
                  onChange={(e) => setNewTargetPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTarget();
                    }
                  }}
                  placeholder={addMode === "folder" ? "docs/custom" : "docs/custom/file.md"}
                  fullWidth
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleAddTarget} disabled={!newTargetPath.trim()}>
                    <Plus className="h-4 w-4" />
                    {addMode === "folder" ? "폴더 추가" : "문서 추가"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRestoreDefaultTargets} title="기본 대상 복원">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {addMode === "folder" && (
                <p className="mt-1 text-[11px] text-text-muted">
                  폴더 경로를 입력하면 하위 .md 파일을 모두 재귀적으로 청킹합니다.
                </p>
              )}
```

주의: `toChunkTarget`/`handleAddTarget` 로직은 그대로 둔다. `addMode`는 placeholder/버튼 라벨/안내문구 표시에만 쓰이고, 실제로 추가되는 `target.path` 값이나 백엔드로 전송되는 데이터에는 전혀 관여하지 않는다.

- [ ] **Step 4: 개발 서버에서 수동 확인**

개발 서버가 이미 떠 있지 않으면 실행:

```powershell
pnpm.cmd --filter @harness/frontend dev
```

브라우저에서 `http://localhost:3002/system/config` → Embedding 탭 이동 후 확인:
1. 기본 진입 시 "파일" 토글이 활성 상태이고 placeholder가 `docs/custom/file.md`, 버튼이 "문서 추가"인지
2. "폴더" 토글 클릭 시 placeholder가 `docs/custom`으로, 버튼이 "폴더 추가"로 바뀌고 안내문구가 나타나는지
3. "파일"로 다시 전환 시 안내문구가 사라지는지
4. 폴더 모드에서 `docs/plans` 같은 경로를 입력해 추가 버튼을 눌렀을 때 기존과 동일하게 대상 목록에 추가되는지(에러 없이)

- [ ] **Step 5: typecheck**

```powershell
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 에러 없음(신규 타입 오류 없음).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/system/AiEmbeddingPanel.tsx
git commit -m "feat(system-config): 청킹 대상 추가에 파일/폴더 모드 토글 추가"
```

---

### Task 2: 대상 목록에 파일/폴더 아이콘 표시

**Files:**
- Modify: `apps/frontend/src/components/system/AiEmbeddingPanel.tsx:490-515` (대상 목록 렌더링)

**Interfaces:**
- Consumes: 기존 `chunkTargets: ChunkTarget[]`(`{ path: string; label: string }`), Task 1에서 import한 `FileText`, `Folder` 아이콘.
- Produces: 없음(리프 노드, 다른 태스크가 이 변경에 의존하지 않음).

- [ ] **Step 1: 대상 목록 각 행에 파일/폴더 아이콘 추가**

`apps/frontend/src/components/system/AiEmbeddingPanel.tsx:490-515`의 기존 블록:

```tsx
              <div className="mt-2 grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                {chunkTargets.map((target) => (
                  <label key={target.path} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={selectedTargetPaths.has(target.path)}
                      onChange={() => handleToggleTarget(target.path)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text">{target.label}</span>
                      <span className="block truncate font-mono text-[11px] text-text-muted" title={target.path}>{target.path}</span>
                    </span>
                    <button
                      type="button"
                      className="rounded-md p-1 text-text-muted hover:bg-error/10 hover:text-error"
                      title="대상 삭제"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteTarget(target.path);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </label>
                ))}
```

를 아래로 교체(체크박스 뒤, 라벨/경로 앞에 아이콘 삽입):

```tsx
              <div className="mt-2 grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                {chunkTargets.map((target) => {
                  const isFile = target.path.toLowerCase().endsWith(".md");
                  return (
                    <label key={target.path} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary"
                        checked={selectedTargetPaths.has(target.path)}
                        onChange={() => handleToggleTarget(target.path)}
                      />
                      {isFile ? (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-text">{target.label}</span>
                        <span className="block truncate font-mono text-[11px] text-text-muted" title={target.path}>{target.path}</span>
                      </span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-text-muted hover:bg-error/10 hover:text-error"
                        title="대상 삭제"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteTarget(target.path);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  );
                })}
```

- [ ] **Step 2: 개발 서버에서 수동 확인**

`http://localhost:3002/system/config` → Embedding 탭에서 기존 기본 대상 목록(`DEFAULT_CHUNK_TARGETS`) 확인:
1. `apps/backend/data/ai-table-catalog.md`(파일) 행에 문서 아이콘(`FileText`)이 표시되는지
2. `apps/frontend/public/help/user/ko`, `docs/standards` 등 나머지 폴더 대상 행에 폴더 아이콘(`Folder`)이 표시되는지
3. Task 1에서 새로 추가한 대상(파일/폴더 모두)도 경로 기준으로 올바른 아이콘이 붙는지

- [ ] **Step 3: typecheck**

```powershell
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/system/AiEmbeddingPanel.tsx
git commit -m "feat(system-config): 청킹 대상 목록에 파일/폴더 아이콘 표시"
```
