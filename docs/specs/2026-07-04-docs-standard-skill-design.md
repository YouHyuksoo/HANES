# 공통 docs 표준 + 관리 스킬(managing-docs) 설계

- 작성일: 2026-07-04
- 상태: 설계 승인됨 (구현 대기)
- 적용 범위: 사용자 전체 프로젝트 공통 (스킬은 사용자 레벨, 첫 적용은 HANES)

## 1. 배경과 목표

docs/ 폴더 구조·명명에 표준이 없어 프로젝트마다 유기적으로 자란다. HANES 실측: 폴더 12개, `docs/plans`(34)와 `docs/superpowers/plans` 중복, `docs/specs`(29)와 `docs/superpowers/specs` 중복, 빈 `manuals/`, 1파일 `presentation/`, `design/`과 `specs/` 경계 모호.

**목표**: ① 모든 프로젝트 공통의 정형화된 docs 분류체계를 정의하고 ② Claude 스킬(`managing-docs`)로 문서 생성·감사·초기화를 수행하며 ③ 규정의 단일 출처는 각 프로젝트 `docs/README.md`(manifest)에 두어 다른 AI 도구도 따를 수 있게 한다.

## 2. 표준 분류체계 (core 8 + 등록제 확장)

```
docs/
├─ README.md          ← manifest: 규정 전문 + 특화 폴더 등록부 + 외부 문서 집합 (단일 출처)
├─ adr/               ← 아키텍처 결정기록        ADR-NNN-kebab-제목.md
├─ specs/             ← 설계문서 (구현 전 의도)   YYYY-MM-DD-주제-design.md
├─ plans/             ← 구현계획                YYYY-MM-DD-주제.md
├─ standards/         ← 코드·업무 규칙, 컨벤션, 절차  kebab-case.md
├─ design/            ← UI 디자인 시스템 (화면 공용화·표준화 규칙)
├─ business-logics/   ← 화면/기능 단위 비즈니스 로직·데이터 흐름 분석 (구현 후 실측)  MENU_CODE.md 또는 kebab-case.md
├─ guides/            ← 설치·운영·사용 가이드     kebab-case.md
└─ reports/           ← 산출물·감사·미완료기록    YYYY-MM-DD-주제.md 또는 주제 폴더
```

### 규칙

- docs 루트에 md 파일 금지 (README.md 제외). 임시/작업 문서는 docs가 아니라 세션 scratchpad.
- **특화 폴더**(예: HANES `workflows/`)는 manifest 등록부에 `폴더명 | 용도 | 명명규칙`을 등록해야 허용. 미등록 폴더 = 감사 위반.
- 빈 core 폴더는 위반이 아니다 (프로젝트 성격상 불필요하면 비워둠).
- specs vs business-logics 경계: specs = 구현 전 설계(무엇을 만들 것인가), business-logics = 구현 후 실측 분석(실제로 어떻게 동작하는가).
- standards vs design 경계: standards = 코드/절차를 어떻게 쓰나, design = 화면이 어떻게 보이고 동작하나.

### design/ 내부 정형 구성

```
design/
├─ overview.md      ← 디자인 의도, 대비 위계, 안티패턴 금지 목록(AI-slop 등)
├─ theme.md         ← 색상 토큰(OKLCH+hex), 타이포, 간격 리듬
├─ layout.md        ← 페이지 골격, 필터 영역, 반응형
├─ buttons.md       ← 버튼 종류·배치 규칙(패널 액션 상단 등)
├─ data-grid.md     ← DataGrid 컬럼·배지·정렬 규칙
├─ navigation.md    ← 메뉴·사이드바·브레드크럼
├─ modals.md        ← 모달 크기(DataGrid xl+/폼 lg+/확인 md+)·구조
└─ forms.md         ← 입력 컴포넌트 규칙(QtyInput, BarcodeScanInput, ComCode 계열 등)
```

- 신규 페이지/컴포넌트 작업 시 해당 파일만 읽으면 되는 참조 규칙집.
- 루트 `DESIGN.md`를 쓰던 프로젝트는 `docs/design/`이 승계(루트에는 포인터만 남기거나 제거).

### 외부 문서 집합 (External Doc Sets)

런타임 자산이라 위치를 앱이 결정하는 문서 집합은 **물리 이동 없이** manifest에 등록해 관리 범위에 포함한다.

HANES 예:

```markdown
## 외부 문서 집합
| 위치 | 용도 | 관리 규정 |
|---|---|---|
| apps/frontend/public/help/{user,operator}/ko/ | 화면 도움말 (Next.js 정적 서빙 + AI RAG) | help-authoring-guide, frontmatter 필수, i18n 4언어 |
```

결정 근거: Next.js는 `public/` 안의 파일만 정적 서빙하므로 도움말 원본을 docs로 옮기면 복사 단계가 필요해진다. 검토 결과(사용자 결정) 도움말은 현행 위치 유지, 관리적 통합만 한다.

## 3. 스킬: `managing-docs` (사용자 레벨)

- 위치: `~/.claude/skills/managing-docs/` — 모든 프로젝트에서 사용 가능.
- 구조: `SKILL.md`(규정+동작 지침) + `references/manifest-template.md` + `references/templates/`(문서 유형별 골격: adr/spec/plan/standard/design-*/business-logic/guide/report).

### 명령

| 명령 | 동작 |
|---|---|
| `/managing-docs init` | core 8 폴더 + manifest 스캐폴드 생성. 기존 docs가 있으면 먼저 audit을 실행해 마이그레이션 계획을 제시하고 승인 후 재편 |
| `/managing-docs new <유형> <주제>` | 표준 경로·파일명·유형별 템플릿으로 문서 생성. 살아있는 문서 유형이면 `sources` 선언을 요구. 유형이 애매하면 분류 기준으로 질문 |
| `/managing-docs audit` | manifest 대비 실태 점검: 미등록 폴더, 명명 위반, 위치 오류, 루트 오염, 살아있는 문서의 sources/verifiedCommit 누락, 외부 문서 집합 규정 → 리포트 제시 → **사용자 승인 후** 이동/정리 실행 |
| `/managing-docs sync` | **소스↔문서 동기화 (최신화의 본체)**: 아래 "문서 2계층과 동기화" 참조 |
| `/managing-docs upgrade` | 표준 버전 승급: 프로젝트 manifest의 `standardVersion`을 스킬의 canonical 버전과 비교 → 변경 내역 리포트 → 승인 후 manifest 공통부 갱신 + 구조 마이그레이션. 로컬 블록(특화 폴더 등록부 등)은 보존 |

### 문서 2계층과 동기화 (`sync`)

소스가 계속 변하면 문서와 불일치가 생긴다. 이를 감지·해소하는 것이 sync다. 전제는 문서 계층 구분:

| 계층 | 폴더 | 동기화 |
|---|---|---|
| **기록형** (시점 고정) | adr, specs, plans, reports | 대상 아님 — 작성 시점의 기록이 존재 이유(설계·결정·계획은 낡는 게 정상) |
| **살아있는 문서** (소스 추적) | standards, design, business-logics, guides, 외부 문서 집합(help) | **동기화 대상** — 항상 현재 소스와 일치해야 함 |

살아있는 문서는 frontmatter로 추적 계약을 선언한다:

```yaml
---
sources:                      # 이 문서가 설명하는 소스 파일/디렉토리(글롭 허용)
  - apps/backend/src/modules/production/services/prod-receive.service.ts
  - apps/frontend/src/app/(authenticated)/production/receive/
verifiedCommit: 8a7e96ea      # 마지막으로 소스와 대조 확인한 커밋
---
```

**sync 절차:**

1. 살아있는 문서 전체 스캔 → 문서별 `git diff --stat {verifiedCommit}..HEAD -- {sources}` 실행
2. 소스 변경이 있는 문서 = stale 후보 → 변경량 순 리포트 (예: `PROD_RECEIVE.md: 소스 3파일 +214/-87`)
3. 사용자 승인(전체/선택) → 승인된 문서만 재검증: 소스 변경분과 문서를 대조해 갱신(문서 수가 많으면 서브에이전트 병렬)
4. 갱신 후 `verifiedCommit`을 현재 HEAD로 재스탬프. 소스가 바뀌었어도 문서 내용이 여전히 정확하면 내용 수정 없이 스탬프만 갱신
5. sources 선언이 없는 살아있는 문서는 sync가 처리 불가 → audit 위반 항목으로 노출하고, sync 리포트에 "추적 불가" 목록으로 표시

HANES business-logics의 기존 관례(`> 분석 기준 커밋:` 본문 표기)를 frontmatter 계약으로 정형화한 것이다. 마이그레이션 시 기존 163개 문서의 본문 표기를 frontmatter로 승격한다.

### 표준 버전 관리 (`upgrade`의 기반)

- 스킬의 `SKILL.md`가 canonical 표준 버전(`standardVersion: N`)과 버전별 변경 이력(`references/changelog.md`)을 가진다.
- 각 프로젝트 manifest frontmatter에 `standardVersion: N` 기록 — init/upgrade 시 스킬이 스탬프.
- 표준을 바꿀 때의 절차: 스킬의 SKILL.md·템플릿·changelog 갱신(버전 +1) → 각 프로젝트에서 `/managing-docs upgrade` 실행하면 그 프로젝트가 최신 표준으로 승급.
- upgrade는 **manifest의 공통 규정 블록만** 교체하고, 프로젝트 로컬 블록(특화 폴더 등록부, 외부 문서 집합, 프로젝트 참고사항)은 그대로 보존한다 — manifest를 공통부/로컬부로 구획해 이를 기계적으로 안전하게 만든다.

### 자동 트리거

- "설계문서/계획/ADR/디자인 규칙/가이드 만들어", "docs 정리/감사", "새 프로젝트 docs 초기화" 등의 요청 시 스킬이 개입해 표준 위치·명명을 강제.
- superpowers의 brainstorming(spec 저장)·writing-plans(plan 저장)는 "사용자 위치 선호가 기본값에 우선" 규정이 있으므로, 글로벌 CLAUDE.md에 spec=`docs/specs/`, plan=`docs/plans/` 선호를 명시해 `docs/superpowers/` 사용을 중단시킨다.

### 동작 원칙

- 스킬은 manifest(docs/README.md)를 **읽고 쓰는 관리자**다. 규정 본문의 단일 출처는 manifest이고 스킬의 SKILL.md는 기본값(신규 프로젝트 init용 원본)을 가진다.
- audit의 이동/삭제는 반드시 리포트→승인→실행 순서. 참조 갱신(이동된 경로를 가리키는 문서/설정) 포함.
- 프로젝트별 manifest가 core 정의와 다르면 manifest가 우선(프로젝트 사정 존중), 단 audit 리포트에 표준과의 차이를 명시.

## 4. 다중 AI 연동

- 규정 전문은 `docs/README.md`(manifest) — 도구 중립.
- `AGENTS.md`에 1줄 추가: "docs/ 아래 문서 생성·이동 시 `docs/README.md` 규정을 준수한다."

## 5. HANES 전면 재편 (첫 적용)

| 대상 | 처리 |
|---|---|
| `superpowers/specs/*` → `specs/` | git mv (파일명 이미 규격 호환), `superpowers/plans/*` → `plans/`, 빈 superpowers/ 제거 |
| `setup/`(5) + `manuals/`(빈) + `presentation/`(1) | `guides/`로 통합 (presentation 1건은 내용 확인 후 배치) |
| `design/`(6) | 2장 design 정형 구성으로 재배치·재작성. 메모리에 산재한 디자인 규칙(파스텔 금지, 모달 최대폭, 패널 버튼 상단, QtyInput, BarcodeScanInput 등)을 성문화해 단일출처화 |
| `workflows/` | manifest 특화 폴더 등록 (AI RAG 그래프 단일 출처) |
| `business-logics/`(163) | core라 이동 없음, manifest 반영. 본문의 `분석 기준 커밋` 표기를 frontmatter(sources/verifiedCommit)로 승격(스크립트 일괄) |
| `docs/readme.md` | 표준 manifest `README.md`로 대체 |
| 참조 갱신 | 이동 경로를 참조하는 문서·메모리·지침(CLAUDE.md 등) 전수 grep 후 갱신. 특히 `docs/superpowers/` 참조 다수 |
| 외부 집합 | help 경로 + `tools/help-frontmatter-audit.mjs`를 audit 절차에 연결 |

## 6. 검증

- 스킬: superpowers:writing-skills 절차로 작성·검증 (신규 임시 프로젝트에서 init→new→audit→sync→upgrade 시나리오 실행. sync는 sources 선언 문서의 소스를 수정해 stale 감지→재스탬프를 검증, upgrade는 changelog에 가짜 v2를 만들어 승급 동작 검증).
- HANES 재편 후: `/managing-docs audit` 클린 통과, 이동 경로 참조 전수 grep 0건(구경로), superpowers 스킬로 spec/plan 생성 시 새 경로에 저장되는지 확인.

## 7. 제외한 대안

- **Diátaxis 4분류**: 실사용 패턴(specs/plans/reports 중심)과 매핑이 억지스러움.
- **hook 기반 강제**: 오탐 시 작업 방해, 프로젝트마다 설정 필요 → audit 명령으로 대체.
- **도움말 docs/help 물리 이동(빌드 복사)**: Next.js public 서빙 규칙상 복사 단계 필요 → 사용자 결정으로 현행 유지+관리적 통합.
- **고정 폴더만(확장 금지)**: 대형 특화 집합(163개 business-logics 같은)이 2단 깊이로 밀려남 → 등록제로 유연성 확보.
