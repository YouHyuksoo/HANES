# AGENTS.md - HANES MES 프로젝트 가이드

## ⚠️ Corrections & Learnings (실수 방지 기록)

### 2025-02-24

#### 1. 도구 식별 명확화
- **실수**: 사용자가 Claude Code CLI임을 명시했음에도 Kimi Code CLI 관련 설명으로 혼란을 줄 수 있었음
- **교훈**: 
  - 사용자가 사용하는 도구(Claude Code CLI)와 내가 동일하지 않음을 명확히 인지
  - 스킬/설정 경로는 사용자의 환경(`.claude/`)과 내 환경(`.agents/skills/`)이 다름
  - 사용자 환경 정보는 직접 물어보거나 명시적 확인 필요

#### 2. 스킬 경로 구분
- **사실 확인**:
  - **Claude Code CLI**: `~/.claude/skills/` 또는 프로젝트 내 `.claude/`
  - **Kimi Code CLI**: `~/.agents/skills/`
- **교훈**: 두 시스템은 완전히 분리되어 있음. 교차 참조하지 않도록 주의

### 2025-06-17

#### 3. jsPDF + autotable 한글 폰트 (CID/CJK)
- **문제**: html2canvas는 Tailwind CSS `lab()` 색상 함수 파싱 실패 → 사용 불가. jsPDF + autotable에서 한글 깨짐.
- **해결** (정석):
  1. 폰트 TTF를 `fetch` → `arrayBuffer()` → `btoa()` → `addFileToVFS("name.ttf", base64)`
  2. `doc.addFont("name.ttf", "FontName", "normal", "Identity-H")` — **CID 인코딩 `Identity-H` 필수**
  3. autotable `styles.font` + `headStyles.font` + `bodyStyles.font` + `alternateRowStyles.font` + `didParseCell` 전부 `"FontName"` 지정
  4. **`headStyles.fontStyle`를 반드시 `"normal"`로 명시** (autotable 기본값 `"bold"`인데 Regular 폰트만 등록하면 `setFont("FontName", "bold")`가 fallback돼서 헤더만 깨짐)
  5. Bold 폰트가 꼭 필요하지 않으면 Regular만 등록 (복잡도 감소)
- **관련 파일**: `apps/frontend/src/hooks/useExport.ts`, `public/fonts/NotoSansKR-*.ttf`
- **금지**: `html2canvas` 접근법 (Tailwind `lab()` 충돌로 재현 불가)

---

## 📝 프로젝트 컨텍스트

### 프로젝트 정보
- **이름**: HANES MES (Manufacturing Execution System)
- **스택**: NestJS + TypeORM + Oracle Database
- **구조**: Turborepo 모노레포
- **DB 사이트**: JSHANES (10.1.10.35:1527/JSHNSMES)

### 주의사항
- TypeORM CLI는 ES Module 이슈로 직접 사용 불가 → Raw SQL via oracle-db Python connector 사용
- 마이그레이션 파일은 `apps/backend/src/migrations/`에 보관
- `SEQ` 채번은 Oracle `SEQUENCE.NEXTVAL`만 사용한다. `MAX(SEQ)+1`, `NVL(MAX(...))+1`, 날짜별 1부터 재시작 채번은 금지한다.
- 테이블/컬럼/PK/FK/CHECK/코드 도메인 등 DB 스키마를 변경하면 반드시 `python tools/generate_db_schema_doc.py`를 실행해 `docs/reports/db-schema-erd.md`를 함께 갱신한다. 스키마 변경 PR/커밋은 마이그레이션 SQL과 ERD 문서 갱신을 같은 작업 범위에 포함해야 한다.

---

## AI 협업 규칙

여러 AI 세션이 동시에 작업할 수 있으므로 모든 AI는 작업 시작 전 아래 파일을 먼저 읽어야 한다.

1. `.ai-coordination/README.md`
2. `.ai-coordination/STATE.md`
3. `.ai-coordination/TASKS.md`
4. `.ai-coordination/DECISIONS.md`
5. `.ai-coordination/LOCKS.md`

### 필수 절차
- 작업 시작 전 `LOCKS.md`에 담당 영역과 파일을 기록한다.
- 코드 수정 전 `TASKS.md`에서 작업 ID를 확인하거나 새 작업 ID를 만든다.
- 작업 중 중요한 판단은 `DECISIONS.md`에 남긴다.
- 작업 종료 전 `JOURNAL.md`와 `.ai-coordination/HANDOFF/<agent-name>.md`를 갱신한다.
- 다른 AI가 lock한 파일은 사용자 허가 없이 수정하지 않는다.
- `AGENTS.md`의 프로젝트 규칙이 최우선이며, 불확실하면 구현하지 말고 `TASKS.md`에 BLOCKED로 남긴다.

### 언어 규칙
- `.ai-coordination/`의 모든 문서(TASKS, DECISIONS, JOURNAL, STATE, PROTOCOL, LOCKS, ARCHIVE, HANDOFF)는 **한글로 기록**한다.
- 영어로 적힌 기존 항목은 수정할 때 한글로 갱신한다.
- 코드, 파일 경로, DB 테이블명, API 엔드포인트 등 기술 식별자는 원문을 유지한다.
