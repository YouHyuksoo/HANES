# managing-docs 스킬 + HANES docs 전면 재편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) 구문으로 추적한다.

**Goal:** 사용자 레벨 docs 관리 스킬(`managing-docs`)을 만들고 HANES를 첫 표준 적용 프로젝트로 전면 재편한다.

**Architecture:** 표준 규정(core 8 + 등록제 + 문서 2계층)은 스킬 `SKILL.md`(canonical, standardVersion 1)와 각 프로젝트 `docs/README.md`(manifest, 도구 중립 단일 출처)에 이중화된다. 스킬 명령 5종(init/new/audit/sync/upgrade)은 LLM 절차 지침이며, sync만 결정적 사전 스캔 스크립트(git diff 기반 stale 감지)를 동반한다.

**Tech Stack:** Claude Code 스킬(markdown), Node .mjs 스크립트(frontmatter 승격·stale 스캔), git mv.

**Spec:** `docs/specs/2026-07-04-docs-standard-skill-design.md` (957876d3 기준)

## Global Constraints

- 스킬 위치는 `C:\Users\hsyou\.claude\skills\managing-docs\` (사용자 레벨, 모든 프로젝트 공용).
- core 8 폴더 명칭·명명규칙·2계층 구분은 스펙 2·3장의 값을 verbatim 사용. 임의 변경 금지.
- HANES 파일 이동은 전부 `git mv` (이력 보존). 삭제는 빈 폴더/중복뿐.
- 기록형 문서(adr/specs/plans/reports)는 마이그레이션 시 **내용 수정 금지** — 위치만 이동.
- coordination enabled 상태 — 편집 전 LOCKS 등록, codex active lock 파일(`docs/standards/master-part-page-standard.md`, `docs/standards/ui-screen-patterns.md` 포함 가능) 불간섭.
- 다국어 아닌 순수 문서 작업이므로 i18n 무관. 커밋 메시지 여러 줄이면 임시파일+`-F`.
- 검증용 임시 프로젝트는 scratchpad(`C:\Users\hsyou\AppData\Local\Temp\claude\...\scratchpad\docs-skill-test\`) 아래에만 생성.

---

### Task 0: coordination 등록

**Files:**
- Modify: `.ai-coordination/TASKS.md`, `.ai-coordination/LOCKS.md`

- [ ] **Step 1: TASKS.md `## Active Tasks` 상단에 추가**

```md
## T-DOCS-STANDARD docs 표준 스킬 + HANES docs 전면 재편
status: IN_PROGRESS
owner: claude
role: implementer
scope:
- docs/specs/2026-07-04-docs-standard-skill-design.md 구현
files:
- (LOCKS.md T-DOCS-STANDARD 참조)
verification:
- 임시 프로젝트 init→new→audit→sync→upgrade 시나리오
- HANES 재편 후 audit 클린 + 구경로 참조 grep 0건
review:
- needs-review
notes:
- docs/ 대규모 이동 포함. 다른 AI는 이동 완료 전 docs 하위 신규 문서 생성 시 docs/README.md 확인 요망.
```

- [ ] **Step 2: LOCKS.md `## Active Locks`에 추가**

```md
## T-DOCS-STANDARD
status: active
owner: claude
role: implementer
expires: 2026-07-06T12:00:00Z
files:
- docs/ (구조 재편 — 단, codex active lock 파일 docs/standards/master-part-page-standard.md, docs/standards/ui-screen-patterns.md 는 불간섭)
- AGENTS.md
- tools/promote-bl-frontmatter.mjs
- tools/docs-sync-scan.mjs
notes:
- superpowers/{specs,plans} 통합, design→architecture 개명, setup→guides, manifest 생성. 스킬 본체는 ~/.claude/skills/managing-docs (repo 밖).
```

- [ ] **Step 3: 협업 문서는 gitignore이므로 커밋 없음 — 파일 저장으로 완료.**

---

### Task 1: 스킬 본체 SKILL.md

**Files:**
- Create: `C:\Users\hsyou\.claude\skills\managing-docs\SKILL.md`

**Interfaces:**
- Produces: 스킬 트리거·5개 명령의 절차 정의. Task 2의 references 파일명들을 참조(`references/manifest-template.md`, `references/changelog.md`, `references/templates/<type>.md`).

- [ ] **Step 1: SKILL.md 작성 (아래 내용 그대로)**

````markdown
---
name: managing-docs
description: Use when creating, organizing, auditing, or synchronizing project documentation under docs/ — 새 문서 작성(설계/계획/ADR/표준/디자인규칙/비즈니스로직/가이드/리포트), docs 폴더 초기화(init), 규정 위반 점검(audit), 소스↔문서 동기화(sync/최신화), 표준 버전 승급(upgrade). Triggers - "설계문서 만들어", "docs 정리/감사", "문서 최신화/동기화", "docs 초기화", "/managing-docs".
---

# Managing Docs — 공통 문서 표준 관리

standardVersion: 1

모든 프로젝트의 `docs/`를 하나의 표준으로 관리한다. 규정의 프로젝트별 단일 출처는
`docs/README.md`(manifest)다. 이 스킬은 manifest를 생성(init)·집행(new/audit)·
동기화(sync)·승급(upgrade)하는 관리자다. **manifest가 있으면 항상 manifest를 먼저
읽고 그 규정을 따른다** (프로젝트 로컬 규정이 이 문서의 기본값보다 우선).

## 표준 분류체계 (core 8 + 등록제 확장)

| 폴더 | 용도 | 명명규칙 | 계층 |
|---|---|---|---|
| adr/ | 아키텍처 결정기록 | `ADR-NNN-kebab-제목.md` | 기록형 |
| specs/ | 설계문서 (구현 전 의도) | `YYYY-MM-DD-주제-design.md` | 기록형 |
| plans/ | 구현계획 | `YYYY-MM-DD-주제.md` | 기록형 |
| standards/ | 코드·업무 규칙, 컨벤션, 절차 | `kebab-case.md` | 살아있음 |
| design/ | UI 디자인 시스템 (화면 공용화·표준화 규칙) | 정형 파일셋(아래) | 살아있음 |
| business-logics/ | 화면/기능 단위 로직·데이터 흐름 분석 (구현 후 실측) | `MENU_CODE.md` 또는 `kebab-case.md` | 살아있음 |
| guides/ | 설치·운영·사용 가이드 | `kebab-case.md` | 살아있음 |
| reports/ | 산출물·감사·미완료기록 | `YYYY-MM-DD-주제.md` 또는 주제 폴더 | 기록형 |

- design/ 정형 파일셋: `overview.md theme.md layout.md buttons.md data-grid.md navigation.md modals.md forms.md` (프로젝트 성격에 따라 부분 생략 가능, manifest에 명시).
- docs 루트에 md 금지(README.md 제외). 특화 폴더는 manifest 등록부에 등록해야 허용. 빈 core 폴더는 위반 아님.
- 경계: specs=구현 전 설계 / business-logics=구현 후 실측. standards=코드·절차 규칙 / design=화면 규칙.

## 문서 2계층

- **기록형** (adr/specs/plans/reports): 작성 시점 고정. sync 대상 아님. 마이그레이션 시에도 내용 수정 금지.
- **살아있는 문서** (standards/design/business-logics/guides/외부 문서 집합): frontmatter 추적 계약 필수 —

```yaml
---
sources:            # 이 문서가 설명하는 소스 파일/디렉토리 (repo 상대경로, 디렉토리·글롭 허용)
  - path/to/source.ts
verifiedCommit: abc1234   # 마지막으로 소스와 대조 확인한 커밋 (git short sha)
---
```

## 명령

사용자가 `/managing-docs <명령>` 또는 자연어로 요청하면 아래 절차를 따른다.
명령이 애매하면 AskUserQuestion으로 확인한다.

### init — 프로젝트 docs 초기화

1. `docs/`가 이미 있고 비어있지 않으면 **먼저 audit 절차를 실행**해 현황 리포트와
   마이그레이션 계획(무엇을 어디로 옮길지, git mv 목록)을 제시하고, 승인 후 재편한다.
2. core 8 폴더 생성(빈 폴더는 `.gitkeep` 없이 폴더만; git이 빈 폴더를 못 담으므로
   실제로는 문서가 생길 때 생성해도 됨 — manifest에 표만 있으면 충분).
3. `references/manifest-template.md`를 복사해 `docs/README.md` 생성:
   - frontmatter `standardVersion`을 이 문서 상단의 값으로 스탬프
   - `<!-- LOCAL:START -->` 아래 로컬부(특화 폴더 등록부/외부 문서 집합)를 프로젝트에 맞게 채움
4. 프로젝트에 `AGENTS.md`가 있으면 "docs/ 아래 문서 생성·이동 시 `docs/README.md` 규정을 준수한다." 1줄이 있는지 확인하고 없으면 추가를 제안한다.

### new <유형> <주제> — 표준 문서 생성

1. manifest에서 유형별 폴더·명명규칙 확인. 유형이 애매하면 경계 기준(위 표)으로 질문.
2. `references/templates/<유형>.md` 골격으로 파일 생성. 파일명은 명명규칙 준수
   (날짜는 오늘, 주제는 kebab-case, ADR은 기존 최대 NNN+1).
3. **살아있는 유형이면 sources를 반드시 채운다** — 사용자가 안 줬으면 "이 문서가 설명하는
   소스 파일/폴더가 어디인가?"를 묻거나 대화 맥락에서 추출. `verifiedCommit`은
   `git rev-parse --short HEAD`로 스탬프.
4. 생성 후 경로를 보고한다.

### audit — 규정 위반 점검

1. manifest를 읽는다(없으면 init 권유 후 중단).
2. 점검 항목 (각각 위반 목록 수집):
   - 미등록 폴더: docs/ 직하위 폴더 중 core 8도 아니고 등록부에도 없는 것
   - 루트 오염: docs/ 직하위 md 파일(README.md 제외)
   - 명명 위반: 각 폴더의 파일명이 그 폴더 명명규칙과 불일치
   - 위치 의심: 파일명 패턴이 다른 폴더 규칙과 일치(예: specs/에 있는 `YYYY-MM-DD-주제.md`(design 접미사 없음)는 plans 후보)
   - 추적 계약 누락: 살아있는 문서인데 frontmatter에 sources 또는 verifiedCommit 없음
   - 외부 문서 집합: manifest에 등록된 각 집합의 "관리 규정" 열에 적힌 점검 명령이 있으면 실행(예: HANES `node tools/help-frontmatter-audit.mjs`)
3. 위반 리포트를 표로 제시(항목·파일·권고 조치) → **사용자 승인 후** 이동/수정 실행.
   이동 시 반드시 git mv + 이동 경로를 참조하는 파일 전수 grep 후 갱신.

### sync — 소스↔문서 동기화 (최신화)

1. 살아있는 문서 전체를 스캔한다. 프로젝트에 `tools/docs-sync-scan.mjs`가 있으면
   `node tools/docs-sync-scan.mjs --json`으로 stale 후보를 얻고, 없으면 문서별로
   frontmatter를 읽어 `git diff --stat <verifiedCommit>..HEAD -- <sources...>`를 직접 실행한다.
2. stale 후보를 변경량 내림차순 표로 제시: `문서 | verifiedCommit | 소스 변경 (파일수, +/-)`.
   sources 미선언 문서는 별도 "추적 불가" 목록으로 표시.
3. 사용자 승인(전체/선택) → 승인된 문서만 재검증:
   - `git diff <verifiedCommit>..HEAD -- <sources>`로 변경 내용을 읽고 문서와 대조
   - 문서가 틀려졌으면 소스 실측 기준으로 갱신(문서 수 많으면 서브에이전트 병렬)
   - 문서가 여전히 정확하면 내용 무수정
4. 처리한 문서의 `verifiedCommit`을 현재 `git rev-parse --short HEAD`로 재스탬프하고
   결과 요약(갱신 N건/스탬프만 M건/추적불가 K건)을 보고한다.

### upgrade — 표준 버전 승급

1. manifest frontmatter의 `standardVersion`과 이 SKILL.md 상단 값을 비교.
   같으면 "최신 표준입니다" 보고 후 종료.
2. 다르면 `references/changelog.md`에서 두 버전 사이의 변경 항목을 제시.
3. 승인 후: manifest의 `<!-- COMMON:START -->`~`<!-- COMMON:END -->` 블록만
   `references/manifest-template.md`의 최신 공통부로 교체하고 standardVersion 재스탬프.
   `<!-- LOCAL:START -->` 아래 로컬부는 **절대 수정하지 않는다**.
4. changelog 항목에 구조 마이그레이션(폴더 추가/개명 등)이 명시돼 있으면 audit과 같은
   리포트→승인→실행 절차로 수행한다.

## 원칙

- 모든 이동/삭제/일괄 수정은 리포트 → 사용자 승인 → 실행. 예외 없음.
- manifest 로컬부는 프로젝트 소유 — init/upgrade가 덮어쓰지 않는다.
- 이 스킬은 문서 위치·형식·신선도를 관리한다. 문서 **내용**의 품질 규정(예: 도움말 작성 가이드)은 각 프로젝트 문서(manifest 외부 집합의 "관리 규정")가 담당.
````

- [ ] **Step 2: 검증 — frontmatter 파싱 확인**

Run: `head -5 "C:\Users\hsyou\.claude\skills\managing-docs\SKILL.md"`
Expected: `---` / `name: managing-docs` / `description: Use when ...` 출력.

- [ ] **Step 3: 커밋 없음** — `~/.claude/skills`는 git repo가 아님(확인: `git -C ~/.claude rev-parse 2>&1`이 에러면 스킵, repo면 커밋).

---

### Task 2: references — manifest 템플릿·changelog·문서 템플릿

**Files:**
- Create: `C:\Users\hsyou\.claude\skills\managing-docs\references\manifest-template.md`
- Create: `C:\Users\hsyou\.claude\skills\managing-docs\references\changelog.md`
- Create: `C:\Users\hsyou\.claude\skills\managing-docs\references\templates\{adr,spec,plan,standard,design-rule,business-logic,guide,report}.md`

**Interfaces:**
- Consumes: Task 1의 표준 표(폴더·명명·계층) — 값 동일해야 함.
- Produces: init이 복사하는 manifest 원본, new가 쓰는 유형별 골격.

- [ ] **Step 1: manifest-template.md 작성**

````markdown
---
standardVersion: 1
---

# Docs Manifest — 문서 표준 규정 (단일 출처)

이 파일은 이 프로젝트 `docs/`의 규정이다. AI/사람 구분 없이 docs 아래 문서를
생성·이동·삭제할 때 이 규정을 따른다. 관리 명령은 Claude `managing-docs` 스킬
(init/new/audit/sync/upgrade)이 제공하지만, 규정 자체는 도구 중립이다.

<!-- COMMON:START (upgrade가 이 블록만 교체한다 — 직접 수정 금지) -->

## 분류체계 (core 8)

| 폴더 | 용도 | 명명규칙 | 계층 |
|---|---|---|---|
| adr/ | 아키텍처 결정기록 | `ADR-NNN-kebab-제목.md` | 기록형 |
| specs/ | 설계문서 (구현 전 의도) | `YYYY-MM-DD-주제-design.md` | 기록형 |
| plans/ | 구현계획 | `YYYY-MM-DD-주제.md` | 기록형 |
| standards/ | 코드·업무 규칙, 컨벤션, 절차 | `kebab-case.md` | 살아있음 |
| design/ | UI 디자인 시스템 | overview/theme/layout/buttons/data-grid/navigation/modals/forms.md | 살아있음 |
| business-logics/ | 화면/기능 단위 로직·데이터 흐름 분석 (구현 후 실측) | `MENU_CODE.md` 또는 `kebab-case.md` | 살아있음 |
| guides/ | 설치·운영·사용 가이드 | `kebab-case.md` | 살아있음 |
| reports/ | 산출물·감사·미완료기록 | `YYYY-MM-DD-주제.md` 또는 주제 폴더 | 기록형 |

## 공통 규칙

1. docs 루트에 md 파일 금지 (이 README 제외). 임시 문서는 docs가 아니라 작업 스크래치.
2. 아래 등록부에 없는 특화 폴더 생성 금지. 필요하면 등록부에 먼저 추가.
3. **살아있는 문서**(standards/design/business-logics/guides)는 frontmatter에
   `sources`(설명 대상 소스 경로 목록)와 `verifiedCommit`(마지막 대조 커밋)을 선언한다.
   소스가 바뀌면 문서도 동기화 대상이 된다 (`managing-docs sync`).
4. **기록형 문서**(adr/specs/plans/reports)는 작성 시점 기록이다 — 사후 수정하지 않는다.
5. 경계 판단: specs=구현 전 설계 / business-logics=구현 후 실측. standards=코드·절차 / design=화면.

<!-- COMMON:END -->

<!-- LOCAL:START (프로젝트 소유 — upgrade가 건드리지 않는다) -->

## 특화 폴더 등록부

| 폴더 | 용도 | 명명규칙 |
|---|---|---|
| (없음) | | |

## 외부 문서 집합 (위치를 앱이 결정하는 문서)

| 위치 | 용도 | 관리 규정 (audit 점검 명령 포함) |
|---|---|---|
| (없음) | | |

## 프로젝트 참고사항

- (없음)

<!-- LOCAL:END -->
````

- [ ] **Step 2: changelog.md 작성**

```markdown
# managing-docs 표준 changelog

## v1 (2026-07-05)
- 최초 표준: core 8(adr/specs/plans/standards/design/business-logics/guides/reports) + 등록제 특화 폴더 + 외부 문서 집합.
- 문서 2계층(기록형/살아있음)과 sources/verifiedCommit 추적 계약, sync 명령.
- manifest 공통부/로컬부 구획(COMMON/LOCAL 마커)과 upgrade 절차.
```

- [ ] **Step 3: templates/ 8개 작성** — 각 파일 전문:

`templates/adr.md`:
```markdown
# ADR-NNN: <결정 제목>

- 날짜: YYYY-MM-DD
- 상태: 제안됨 | 승인됨 | 폐기됨(ADR-MMM로 대체)

## 맥락
<결정이 필요해진 배경. 어떤 힘들이 충돌하는가>

## 결정
<채택한 방안 한 문단>

## 결과
<이 결정으로 얻는 것/감수하는 것. 되돌리려면 무엇이 필요한가>

## 검토한 대안
- <대안 A>: <제외 이유>
```

`templates/spec.md`:
```markdown
# <주제> 설계

- 작성일: YYYY-MM-DD
- 상태: 설계 승인됨 (구현 대기)

## 1. 배경과 문제
## 2. 목표 / 비목표
## 3. 설계 결정 요약
| 결정 | 선택 | 근거 |
|---|---|---|
## 4. 상세 설계
## 5. 에러 처리
## 6. 테스트 전략
## 7. 제외한 대안
```

`templates/plan.md`:
```markdown
# <주제> 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** <한 문장>
**Architecture:** <2-3문장>
**Spec:** <docs/specs/... 경로>

## Global Constraints
- <스펙의 프로젝트 공통 제약을 그대로>

### Task 1: <이름>
**Files:** / **Interfaces:** / Steps(TDD)...
```

`templates/standard.md`:
```markdown
---
sources: []
verifiedCommit: <git short sha>
---

# <규칙 이름>

## 규칙
<무엇을 해야/하지 말아야 하는가. 예외가 있으면 명시>

## 근거
<왜 이 규칙인가>

## 예시
<올바른 예 / 위반 예>
```

`templates/design-rule.md`:
```markdown
---
sources: []            # 이 규칙이 설명하는 공통 컴포넌트/토큰 파일
verifiedCommit: <git short sha>
---

# <영역> 디자인 규칙

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|

## 사용 컴포넌트/토큰
<공통 컴포넌트 경로와 사용법>

## 금지 (안티패턴)
- <금지 항목과 이유>
```

`templates/business-logic.md`:
```markdown
---
sources: []            # 분석 대상 서비스/컨트롤러/페이지 경로
verifiedCommit: <git short sha>
---

# <화면/기능 이름> — 비즈니스 로직 & 데이터 흐름 분석

## 1. 개요
## 2. 화면/입력 구성
## 3. API 흐름
## 4. 처리 규칙 (상태 전이 포함)
## 5. DB 영향 (테이블별 읽기/쓰기)
## 6. 예외·에러 경로
```

`templates/guide.md`:
```markdown
---
sources: []
verifiedCommit: <git short sha>
---

# <가이드 제목>

## 대상 독자와 목적
## 사전 조건
## 절차
1. <단계 — 실행 명령/화면 그대로>
## 확인 방법
## 문제 해결
```

`templates/report.md`:
```markdown
# <리포트 제목>

- 작성일: YYYY-MM-DD
- 작성 계기: <무엇을 위해 만든 산출물인가>

## 요약 (결론 먼저)
## 상세
## 후속 조치 (있으면)
```

- [ ] **Step 4: 파일 존재 검증**

Run: `ls "C:\Users\hsyou\.claude\skills\managing-docs\references\templates\"`
Expected: 8개 파일.

---

### Task 3: 스킬 시나리오 검증 (임시 프로젝트)

**Files:**
- 작업 디렉토리: scratchpad 아래 `docs-skill-test/` (git init한 임시 repo, 종료 후 삭제)

**절차 (SKILL.md를 문자 그대로 따라 실행하는 리허설 — 스킬 자체가 절차 지침이므로 이 실행이 곧 테스트):**

- [ ] **Step 1: 임시 repo 생성** — `git init` + 더미 소스 `src/app.ts`(아무 내용) 커밋.
- [ ] **Step 2: init 리허설** — SKILL.md init 절차대로 docs/README.md(manifest) 생성. 검증: frontmatter `standardVersion: 1`, COMMON/LOCAL 마커 존재.
- [ ] **Step 3: new 리허설** — `new standard test-rule` 절차대로 `docs/standards/test-rule.md` 생성(sources: [src/app.ts], verifiedCommit 스탬프). 검증: frontmatter 완비.
- [ ] **Step 4: sync 리허설(핵심)** — `src/app.ts` 수정+커밋 → sync 절차 1~2단계 실행 → test-rule.md가 stale 후보로 감지되는지 확인 → 재스탬프 후 재실행 시 stale 0건인지 확인.
- [ ] **Step 5: audit 리허설** — 위반 3종을 일부러 만들고(`docs/loose.md` 루트 오염, `docs/unregistered/x.md` 미등록 폴더, sources 없는 standards 문서) audit 절차 실행 → 3건 모두 리포트에 잡히는지 확인.
- [ ] **Step 6: upgrade 리허설** — 임시로 manifest standardVersion을 0으로 고쳐 놓고 upgrade 절차 실행 → COMMON 블록만 교체되고 LOCAL 블록(테스트용 등록부 한 줄 추가해둔 것)이 보존되는지 확인.
- [ ] **Step 7: 결과를 바탕으로 SKILL.md 절차의 모호/불능 지점을 수정**(발견 시). 임시 repo 삭제.

---

### Task 4: HANES 구조 재편 (이동 + manifest + 참조 갱신)

**Files:**
- git mv: `docs/superpowers/specs/*` → `docs/specs/`, `docs/superpowers/plans/*` → `docs/plans/`, `docs/design/` → `docs/architecture/`, `docs/setup/*` → `docs/guides/`
- Delete: `docs/manuals/`(빈), `docs/superpowers/`(이동 후 빈), `docs/readme.md`
- Create: `docs/README.md` (manifest, HANES 로컬부 포함)
- Modify: `AGENTS.md` (1줄), 구경로 참조 파일들

- [ ] **Step 1: 사전 충돌 확인** — `git status --short docs/`로 다른 세션의 미커밋 docs 변경이 없는지 확인. 있으면 해당 파일은 이동에서 제외하고 보고.

- [ ] **Step 2: 파일명 충돌 검사 후 git mv 실행**

```bash
# specs/plans 통합 — 동명 파일 충돌 먼저 확인 (있으면 -YYYY 접미사로 회피하고 보고)
ls docs/superpowers/specs/ docs/specs/ | sort | uniq -d
git mv docs/superpowers/specs/* docs/specs/
git mv docs/superpowers/plans/* docs/plans/
git mv docs/design docs/architecture
git mv docs/setup/ai-project-bootstrap.md docs/setup/development-stack-guide.md docs/setup/environment-setup-guide.md docs/setup/i18n-hardcoding-migration-guide.md docs/setup/project-bootstrap-checklist.md docs/guides/ 2>/dev/null || (mkdir docs/guides && git mv docs/setup/* docs/guides/)
git rm -r docs/manuals 2>/dev/null; rmdir docs/setup docs/superpowers/specs docs/superpowers/plans docs/superpowers 2>/dev/null
git rm docs/readme.md
```

(주의: `docs/manuals`가 git 미추적 빈 폴더면 `rmdir`만. presentation/은 이동하지 않는다.)

- [ ] **Step 3: manifest 생성** — Task 2 템플릿을 `docs/README.md`로 복사하고 LOCAL부를 HANES 값으로:

```markdown
## 특화 폴더 등록부

| 폴더 | 용도 | 명명규칙 |
|---|---|---|
| workflows/ | AI RAG 워크플로우 그래프 단일 출처 (definitions/*.md, 스키마는 docs/specs/2026-07-04-ai-rag-pipeline-v2-design.md 4-A) | definitions/kebab-case.md |
| architecture/ | 시스템 아키텍처 참조 (ERD, 라우팅, API 인덱스, 모듈맵) — 살아있는 문서로 취급 | NN-kebab-case.md 또는 kebab-case.md |
| presentation/ | 고객 발표 자료 (pptx/html/assets 포함) | 자유 |

## 외부 문서 집합 (위치를 앱이 결정하는 문서)

| 위치 | 용도 | 관리 규정 (audit 점검 명령 포함) |
|---|---|---|
| apps/frontend/public/help/{user,operator}/ko/ | 화면 도움말 (Next.js 정적 서빙 + AI RAG) | docs/guides/help-authoring-guide 준수(존재 시), frontmatter 필수 — 점검: `node tools/help-frontmatter-audit.mjs` |

## 프로젝트 참고사항

- AI RAG 인덱스가 docs/{standards,specs,plans,workflows/definitions,business-logics}를 청킹한다 — 폴더 개명 시 apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts DEFAULT_KNOWLEDGE_TARGETS 동기 필요.
```

- [ ] **Step 4: AGENTS.md에 규정 참조 1줄 추가** — 문서 규칙 관련 섹션(없으면 상단 규칙 목록)에: `- docs/ 아래 문서 생성·이동 시 docs/README.md 규정을 준수한다.`

- [ ] **Step 5: 구경로 참조 전수 갱신**

```bash
grep -rln "docs/superpowers" --include="*.md" docs/ AGENTS.md CLAUDE.md .superpowers/ 2>/dev/null
grep -rln "docs/design\b" --include="*.md" --include="*.ts" docs/ apps/ AGENTS.md CLAUDE.md 2>/dev/null | grep -v node_modules
grep -rln "docs/setup" --include="*.md" docs/ AGENTS.md CLAUDE.md 2>/dev/null
```

각 파일에서 `docs/superpowers/specs`→`docs/specs`, `docs/superpowers/plans`→`docs/plans`, `docs/design/`→`docs/architecture/`, `docs/setup/`→`docs/guides/` 치환. `.superpowers/sdd/progress.md`(원장)는 이력 기록이므로 수정하지 않는다. 메모리 4개 파일(`C:\Users\hsyou\.claude\projects\C--Project-HANES\memory\`)도 동일 치환.

- [ ] **Step 6: AI RAG 타깃 영향 확인** — DEFAULT_KNOWLEDGE_TARGETS는 `docs/standards`, `docs/specs`, `docs/plans`, `docs/workflows/definitions`, `docs/business-logics`만 참조 — 이번 이동으로 경로 불변이므로 코드 수정 없음. 단 superpowers 통합으로 specs/plans 문서 수가 늘므로 완료 후 재인덱싱 1회.

- [ ] **Step 7: 검증** — `grep -rn "docs/superpowers\|docs/setup" --include="*.md" docs/ | grep -v progress` 0건, `ls docs/` = README.md + core폴더 + workflows/architecture/presentation. 커밋:

```bash
git add -A docs/ AGENTS.md
git commit -m "docs: 표준 재편 — superpowers 통합, design→architecture, setup→guides, manifest 도입"
```

---

### Task 5: business-logics frontmatter 승격 + sync 스캔 스크립트

**Files:**
- Create: `tools/promote-bl-frontmatter.mjs`
- Create: `tools/docs-sync-scan.mjs`

- [ ] **Step 1: promote-bl-frontmatter.mjs 작성**

```js
#!/usr/bin/env node
/**
 * @file tools/promote-bl-frontmatter.mjs
 * @description business-logics 문서의 본문 표기(분석 기준 커밋)를 표준 frontmatter(sources/verifiedCommit)로 승격.
 * 사용: node tools/promote-bl-frontmatter.mjs [--commit]  (기본 dry-run)
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'docs/business-logics';
const APPLY = process.argv.includes('--commit');
let changed = 0, skipped = 0, noAnchor = 0;

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  const file = path.join(DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  if (/^﻿?---\r?\n/.test(raw)) { skipped += 1; continue; }        // 이미 frontmatter 있음

  const commitMatch = raw.match(/분석 기준 커밋[:*\s`]*([0-9a-f]{7,40})/);
  const verified = commitMatch ? commitMatch[1].slice(0, 8) : null;
  if (!verified) noAnchor += 1;

  // 본문 백틱 안의 repo 상대 소스 경로 수집 (apps/, packages/ 시작 .ts/.tsx)
  const srcSet = new Set();
  for (const m of raw.matchAll(/`((?:apps|packages)\/[\w\-./()[\]]+?\.tsx?)`/g)) srcSet.add(m[1]);
  const sources = Array.from(srcSet).slice(0, 12);

  const fmLines = ['---'];
  if (sources.length > 0) { fmLines.push('sources:'); sources.forEach((s) => fmLines.push(`  - ${s}`)); }
  else fmLines.push('sources: []');
  fmLines.push(`verifiedCommit: ${verified ?? 'UNKNOWN'}`, '---', '', '');
  if (APPLY) fs.writeFileSync(file, fmLines.join('\n') + raw, 'utf8');
  changed += 1;
}
console.log(JSON.stringify({ changed, skipped, noAnchor, mode: APPLY ? 'applied' : 'dry-run' }));
```

- [ ] **Step 2: dry-run → 결과 확인 → 적용**

Run: `node tools/promote-bl-frontmatter.mjs` → changed≈163 확인 → `node tools/promote-bl-frontmatter.mjs --commit`
검증: `head -8 docs/business-logics/PROD_RECEIVE.md`에 frontmatter, `grep -c "verifiedCommit: UNKNOWN" docs/business-logics/*.md`로 앵커 없는 문서 수 보고(있으면 sync 리포트의 추적불가 대상).

- [ ] **Step 3: docs-sync-scan.mjs 작성** — sync 명령의 결정적 사전 스캔:

```js
#!/usr/bin/env node
/**
 * @file tools/docs-sync-scan.mjs
 * @description 살아있는 문서(sources/verifiedCommit 선언)의 소스 변경량을 git diff로 스캔해 stale 후보를 출력.
 * 사용: node tools/docs-sync-scan.mjs [--json]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LIVING_DIRS = ['docs/standards', 'docs/design', 'docs/business-logics', 'docs/guides', 'docs/architecture'];
const results = [];

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listMd(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  });
}

for (const dir of LIVING_DIRS) {
  for (const file of listMd(dir)) {
    const raw = fs.readFileSync(file, 'utf8');
    const fm = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!fm) { results.push({ file, status: 'no-frontmatter' }); continue; }
    const verified = /verifiedCommit:\s*([0-9a-f]{7,40})/.exec(fm[1])?.[1];
    const sources = [...fm[1].matchAll(/^\s*-\s+(.+)$/gm)].map((m) => m[1].trim());
    if (!verified || verified === 'UNKNOWN' || sources.length === 0) {
      results.push({ file, status: 'untracked', verified: verified ?? null, sourceCount: sources.length });
      continue;
    }
    try {
      const stat = execSync(`git diff --shortstat ${verified}..HEAD -- ${sources.map((s) => `"${s}"`).join(' ')}`, { encoding: 'utf8' }).trim();
      results.push(stat ? { file, status: 'stale', verified, diff: stat } : { file, status: 'fresh', verified });
    } catch {
      results.push({ file, status: 'bad-commit', verified });
    }
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 1));
else {
  for (const r of results.filter((x) => x.status === 'stale')) console.log(`STALE ${r.file} (${r.verified}) ${r.diff}`);
  const c = (s) => results.filter((x) => x.status === s).length;
  console.log(`\nfresh=${c('fresh')} stale=${c('stale')} untracked=${c('untracked')} no-frontmatter=${c('no-frontmatter')} bad-commit=${c('bad-commit')}`);
}
```

- [ ] **Step 4: 실행 검증** — `node tools/docs-sync-scan.mjs`가 business-logics 163개를 분류해 요약 출력하는지 확인 (stale 다수 예상 — 이후 sync 명령의 입력).

- [ ] **Step 5: 커밋**

```bash
git add tools/promote-bl-frontmatter.mjs tools/docs-sync-scan.mjs docs/business-logics/
git commit -m "docs: business-logics frontmatter 승격(sources/verifiedCommit) + sync 스캔 스크립트"
```

주의: business-logics frontmatter 추가로 AI RAG 청크 메타가 바뀌므로 완료 후 재인덱싱 필요(Task 7).

---

### Task 6: HANES design/ (UI 디자인 시스템) 신규 작성

**Files:**
- Create: `docs/design/{overview,theme,layout,buttons,data-grid,navigation,modals,forms}.md` (템플릿 design-rule.md 형식, sources/verifiedCommit 선언)

**내용 요구사항 (각 파일은 실코드 실측 + 아래 확정 규칙을 성문화):**

| 파일 | 반드시 담을 확정 규칙 | 실측 소스(sources로 선언) |
|---|---|---|
| overview.md | 파스텔 배경(bg-*-50) 금지→텍스트/테두리 구분, AI-slop 안티패턴 금지 목록, alert/confirm/prompt 금지→모달 사용 | apps/frontend/src/app/globals.css(존재 시), tailwind.config |
| theme.md | 실제 tailwind 색 토큰·surface/border/text 계열, 다크모드 방식 | tailwind.config.*, globals.css |
| layout.md | 페이지 골격(필터 상단·한 줄 배치 선호), 우측 슬라이드 패널 표준(equip식 데이터 교체+useUnsavedGuard) | components/shared/ 레이아웃류, docs/standards/master-part-page-standard.md 참조 |
| buttons.md | 우측 패널 액션 버튼(저장/취소) **상단** 배치, 버튼 변형 체계 | components/ui/button* |
| data-grid.md | 컬럼 팩토리(*Columns.tsx) 패턴, StatusBadge+comCode.{TYPE}.{value} i18n 단일출처, 배지 text+border | components/ui/DataGrid*, components/shared/StatusBadge* |
| navigation.md | menuConfig 구조(카테고리>leaf), 메뉴 추가 4곳 동시(menuConfig+menu-config.json+validator+DB MERGE — docs/standards/menu-add-workflow.md 링크) | src/config/menuConfig.ts |
| modals.md | 모달 최대폭 표준: DataGrid 포함 xl+, 폼 lg+, 확인 md+ | components/ui/dialog*·modal* |
| forms.md | QtyInput(수량 천단위, type=number 금지), BarcodeScanInput(maintainFocus/blinkIndicator/serialFocusedOnly/refocusAfterScan), ComCodeSelect/useComCode, 날짜 기본값=당일(getTodayLocal, toISOString 금지) | components/shared/{QtyInput,BarcodeScanInput,ComCode*}* |

**절차:**

- [ ] **Step 1:** 위 표의 실측 소스를 읽고 실제 컴포넌트 이름·prop·토큰 값을 확인 (추측 금지 — 예: QtyInput의 실제 export명과 prop).
- [ ] **Step 2:** 8개 파일 작성 — 각각 design-rule.md 템플릿 구조(frontmatter sources/verifiedCommit + 규칙 표 + 사용 컴포넌트 + 금지). 각 파일 200줄 이내, 규칙은 "해야 한다/금지" 문형으로 단정적으로.
- [ ] **Step 3:** 검증 — `node tools/docs-sync-scan.mjs`에서 design 8개가 fresh로 잡히는지 확인.
- [ ] **Step 4:** 커밋: `git add docs/design/ && git commit -m "docs(design): UI 디자인 시스템 8종 성문화 (메모리 규칙+실코드 실측)"`

---

### Task 7: 글로벌 설정 + 최종 검증 + 마무리

**Files:**
- Modify: `C:\Users\hsyou\.claude\CLAUDE.md` (spec/plan 위치 선호 1줄)
- HANES 재인덱싱 + audit 최종 실행

- [ ] **Step 1: 글로벌 CLAUDE.md에 위치 선호 추가** — "UI / Frontend / Design Workflows" 섹션 앞에:

```markdown
## Docs Location Preference

- superpowers 계열 스킬이 spec/plan을 저장할 때 `docs/superpowers/` 대신 `docs/specs/`, `docs/plans/`를 사용한다 (managing-docs 표준).
- 프로젝트에 `docs/README.md`(manifest)가 있으면 docs 문서 생성 전 그 규정을 따른다.
```

- [ ] **Step 2: HANES AI 재인덱싱** — dev 서버 상태에서 reindex API 호출(문서 이동+frontmatter 반영). `workflowErrors: []` 확인.
- [ ] **Step 3: audit 최종 리허설** — SKILL.md audit 절차를 HANES에 실행 → 위반 0건(또는 잔여 항목 보고·정리) 확인.
- [ ] **Step 4: coordination 마무리** — TASKS에서 T-DOCS-STANDARD 제거→REVIEW_QUEUE 교체, LOCKS 해제, HANDOFF/claude.md 갱신.
- [ ] **Step 5: 잔여 커밋 정리 후 전체 상태 보고** (push는 사용자 지시 시).

---

## 실행 순서와 의존성

```
Task 0 (coordination)
 → Task 1 (SKILL.md) → Task 2 (references) → Task 3 (시나리오 검증 — 스킬 완결성 게이트)
 → Task 4 (HANES 구조 재편) → Task 5 (BL 승격+스캔 스크립트) → Task 6 (design 신규 작성)
 → Task 7 (글로벌 설정+재인덱싱+audit+마무리)
```
