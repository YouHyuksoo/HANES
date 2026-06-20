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

### 2025-06-21

#### 3. IQC AQL 프로세스 리뷰 — 근거 없는 가정 금지 + stale 코드 판단 금지

##### 3a. 근거 없는 가정 금지
- **실수**:
  - `IqcModal`의 `supplierName`이 업체명(문자열)일 것이라 추정만 하고 실제 DB/API 응답값을 확인하지 않음. 실제로는 백엔드가 `PARTNER_CODE`를 내려주고 있었음.
  - `iqc-part-spec` 페이지의 preview API가 이미 `resolve-iqc-items`로 전환된 사실을 `page.tsx` 본문을 읽지 않고 외부 리뷰 보고서만 참고해 "불일치"라고 주장함.
  - 서버가 `aqlPolicy.result`로 프론트 verdict를 무시하고 최종 재정의하는 구조를 추적하지 못하고 "프론트 판정이 최종을 오염시킨다"는 근거 없는 우려를 씀.
  - 검토 중인 API(`POST /material/iqc-history/arrival`)의 실제 서비스 코드 흐름을 끝까지 읽지 않고 중간 단계에서 결론을 내림.
- **교훈** (무조건 지켜야 할 규칙):
  1. **변수명만 보고 데이터 타입/값을 추정하지 말 것. 반드시 실제 API 응답을 생성하는 백엔드 서비스/쿼리 코드를 찾아서 확인한다.**
  2. **"A 화면이 X API를 쓴다"고 주장하려면 반드시 해당 화면의 소스 코드를 직접 읽어서 확인한다. 외부 리뷰/문서를 근거로 삼지 않는다.**
  3. **CRUD 저장 API를 리뷰할 때는 반드시 Controller → Service → Entity까지 전체 호출 체인을 읽고, 프론트 제출값이 서버에서 어떻게 재정의/검증되는지 추적한다.**
  4. **"~일 것이다", "~할 가능성이 있다"는 표현은 리뷰에 쓰지 않는다. 코드로 증명되거나 재현될 수 있는 사실만 리뷰에 포함한다.**
  5. **리뷰 우선순위는 "실제 운영 데이터에서 지금 터지는가?"를 먼저 확인하고, 그다음 "코드 방어 필요성"을 논한다. 이론적 위험만으로 경고를 올리지 않는다.**
- **관련 파일**: `apps/frontend/src/components/material/IqcModal.tsx`, `apps/frontend/src/hooks/material/useIqcData.ts`, `apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx`, `apps/backend/src/modules/material/services/iqc-history.service.ts`, `apps/backend/src/modules/quality/aql/services/aql.service.ts`

##### 3b. stale 코드 기준 판단 금지
- **실수**:
  - 1차 리뷰 이후 HEAD가 `a5e9fa08`로 앞서갔는데, `Read` 도구로 읽은 파일 내용을 재확인 없이 "현재 코드"라고 가정하고 리뷰를 씀.
  - `resolvePartPolicy()`가 이미 `BadRequestException` throw로 강화된 상태(`aql.service.ts:631-633`)였지만, 이전에 읽은 null 반환 코드 기준으로 "정책 미설정 PASS 위험"이라고 주장함.
  - `buildSampleBarcode()`(`IqcModal.tsx:111`)와 `compactSampleBarcode()`(`iqc-history.service.ts:623`)가 이미 존재하는데 "sampleBarcode 500자 제한 터짐"이라고 경고함.
  - `assertDefectCodesHaveFailedInspection()`(`iqc-history.service.ts:605`)가 이미 있는데 "defectCodes 무시됨"이라고 주장함.
- **교훈** (무조건 지켜야 할 규칙):
  1. **코드 리뷰/판단을 내리기 전에 반드시 `git log --oneline -3`으로 HEAD를 확인한다.**
  2. **이전 세션에서 읽은 파일 내용을 "현재 상태"로 가정하지 않는다. `Read` 도구로 다시 읽어서 HEAD의 최신 상태를 확인한다.**
  3. **"~일 것이다"보다 더 위험한 것은 "이미 해결된 문제를 현재 문제라고 주장하는 것"이다. stale 데이터로 판단하지 않는다.**
  4. **특정 라인 번호를 지목할 때는 반드시 해당 시점의 HEAD에서 다시 읽은 라인 번호를 사용한다.**
- **관련 파일**: `apps/backend/src/modules/quality/aql/services/aql.service.ts`, `apps/frontend/src/components/material/IqcModal.tsx`, `apps/backend/src/modules/material/services/iqc-history.service.ts`

### 2025-06-17

#### 4. jsPDF + autotable 한글 폰트 (CID/CJK)
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
- 화면 개발 시 검사수준, AQL, 검사구분, 단위, 상태, 라인, 설비, 공정, 품목, 거래처처럼 코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 방식을 우선한다. 공통코드/기준정보가 없으면 먼저 기준을 추가하고 선택 컴포넌트로 연결한다.

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
