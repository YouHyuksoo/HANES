# AI 지식 파이프라인 v2 설계 (RAG 개선)

- 작성일: 2026-07-04
- 상태: 설계 승인됨 (구현 대기)
- 관련 코드: `apps/backend/src/modules/ai-knowledge/`, `apps/backend/src/modules/ai/ai-sql.service.ts`
- 선행 설계: `docs/superpowers/specs/2026-06-22-ai-chat-phase{1,2}`

## 1. 배경과 문제

현재 AI 채팅 RAG는 `도움말 md → 헤딩 단위 청크 → sqlite-vec(0.6)+FTS5(0.3) 점수 융합 → top-5 프롬프트 주입` 구조다. 답변이 단편적인 원인:

1. **청크 고립** — 헤딩 섹션이 문서/워크플로우 맥락 없이 임베딩된다.
2. **관계가 점수 부스트로만 소비** — frontmatter `related`가 관련 청크를 컨텍스트로 끌어오지 않고 점수만 올린다. top-K 밖이면 버려진다.
3. **질의 재작성 없음** — 사용자 원문 그대로 1회 검색. 표현이 다르면 못 찾는다.
4. **리랭킹 없음 + 매직넘버 융합** — 0.6/0.3/0.15 가중치, `등록|입력|저장` 정규식 휴리스틱.
5. **local-hash 조용한 degrade** — 임베딩 키가 없으면 의미 검색이 사실상 무작위인데 겉으로는 정상 동작처럼 보인다.

## 2. 목표 질문 유형 (4종 모두 지원)

1. 화면 사용법 (단일 메뉴)
2. 워크플로우 전후관계 ("검사 끝나면 다음 뭐 해?")
3. 문제 해결/원인 추적 ("라벨 발행이 안 되는데 왜?")
4. 엔지니어용 로직/데이터 구조 (business-logics 근거)

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 워크플로우 지식 출처 | `docs/workflows/definitions/*.md` 신설(루트에 구형 가이드 문서가 있어 하위 폴더 분리) (단일 출처) | 사람 검수된 정확한 그래프. LLM 자동 추출(GraphRAG)은 추출 오류 검수 부담으로 제외 |
| 런타임 깊이 | 풀 파이프라인 (LLM 3회: 질의이해→리랭크→답변) | 복합 질문 품질 우선, 체감 3~6초 허용 |
| 벡터 저장소 | sqlite-vec 유지 | 4.5MB 코퍼스에 충분, 외부 벡터DB는 운영 부담만 증가 |

## 4. 소스데이터 계약

### 4-A. 워크플로우 정의 문서 (신설) — `docs/workflows/definitions/*.md`

업무 흐름 하나당 파일 하나 (핵심 흐름 8~15개 예상: 생산, 자재입출고, 검사, 출하 등).
frontmatter = 기계가 읽는 그래프, 본문 = 사람이 읽는 단계별 설명.

```markdown
---
workflowId: PROD_FLOW
title: 생산계획→작업지시→투입→입고 흐름
steps:
  - menu: PROD_PLAN
  - menu: JOB_ORDER
    requires: [PROD_PLAN]
    transitions: "WAITING→RUNNING"
  - menu: PROD_INPUT_KIOSK
    requires: [JOB_ORDER=RUNNING]
    produces: [FG_LABEL]
  - menu: FG_RECEIVE
    requires: [FG_LABEL, BOX_NO]
troubleshooting:
  - symptom: "라벨 발행이 안 됨"
    causes: [JOB_ORDER 상태가 RUNNING 아님, BOM 미등록]
    resolutions: [작업지시 화면에서 상태 확인, BOM 등록 확인]
relatedWorkflows: [QC_FLOW]
---
## 단계별 설명
...
```

**스키마 필드:**

- `workflowId` (필수): 대문자 스네이크, 고유
- `title` (필수)
- `steps[]` (필수): `menu`(메뉴코드, 필수), `requires[]`(선행 메뉴코드 또는 `MENU=STATE` 조건), `transitions`(해당 단계에서 일어나는 상태 전이), `produces[]`(산출물)
- `troubleshooting[]` (선택): `symptom`, `causes[]`, `resolutions[]`
- `relatedWorkflows[]` (선택)

**초안 생성**: 기존 도움말 + `docs/business-logics/` 문서에서 LLM이 초안 생성 → 사용자 검수 후 확정. 초안 생성은 구현 단계의 별도 작업.

### 4-B. 도움말 md (기존 519개, `apps/frontend/public/help/`)

- frontmatter `menuCode`, `summary`, `keywords` 필수화. 누락분 일괄 점검(스크립트) 후 보완.
- **워크플로우 관계는 도움말에 넣지 않는다** (단일 출처 원칙). 기존 `related`는 "관련 화면" 참고용으로 유지.
- 본문 구조 변경 없음.

### 4-C. business-logics 문서 (기존)

엔지니어 페르소나 근거로 그대로 인덱싱. 변경 없음.

## 5. 인덱싱 파이프라인

### 5-1. 맥락 주입 청킹 (contextual chunking)

각 청크의 **임베딩/FTS 입력 텍스트** 앞에 맥락 헤더를 붙인다:

```
[박스입고(FG_RECEIVE) 사용자 도움말 | PROD_FLOW 워크플로우 4단계 | 선행: 자재투입(PROD_INPUT_KIOSK) | 후행: 없음]
(원본 청크 내용)
```

- 헤더는 워크플로우 그래프 + 도움말 frontmatter에서 **규칙 기반으로 생성** (LLM 불필요).
- 저장되는 `content`는 원본 유지, 검색 입력 텍스트에만 헤더 추가 (표시 오염 방지).
- 근거: Anthropic contextual retrieval 실측 — 맥락 주입 + 리랭킹 조합으로 검색 실패율 약 67% 감소.

### 5-2. 그래프 테이블

workflows frontmatter 파싱 → SQLite 테이블:

```sql
CREATE TABLE ai_knowledge_graph (
  workflow_id TEXT NOT NULL,
  from_menu   TEXT NOT NULL,
  to_menu     TEXT NOT NULL,
  edge_type   TEXT NOT NULL,  -- precedes | requires | produces
  detail      TEXT,           -- 상태조건("JOB_ORDER=RUNNING"), 산출물명 등
  PRIMARY KEY (workflow_id, from_menu, to_menu, edge_type)
);
CREATE TABLE ai_knowledge_troubleshooting (
  workflow_id TEXT NOT NULL,
  symptom     TEXT NOT NULL,
  causes_json TEXT NOT NULL,
  resolutions_json TEXT,
  chunk_id    TEXT            -- 해당 워크플로우 문서 청크 연결
);
```

- 도움말 청크는 `menu_code`로 그래프 노드에 연결된다 (기존 컬럼 재사용).
- reindex 시 workflows 문서도 함께 파싱·재구축.
- `DEFAULT_KNOWLEDGE_TARGETS`에 `docs/workflows/definitions` (docType: `workflow`) 추가.

### 5-3. 하이브리드 검색 저장소

- sqlite-vec + FTS5 유지.
- **local-hash degrade 시 채팅 UI에 경고 배지** 노출: `status()`의 `realEmbeddingProvider=false`를 프론트 채팅 패널에서 표시.

## 6. 런타임 파이프라인 (LLM 3회)

```
질문
 → [1] 질의 이해 (LLM 호출 1, 소형 모델 가능)
      출력(JSON): { intent: usage|workflow|troubleshoot|engineer,
                    queries: [검색질의 2~3개], menus: [언급 메뉴코드] }
 → [2] 하이브리드 검색
      질의별로 기존 search()(vector+FTS+lexical 융합)를 호출하고,
      질의 간 결과는 RRF(Reciprocal Rank Fusion)로 융합
      ※ 단일 질의 내부 점수 체계(2026-07-04 기준 lexical 개선 포함)는 기존
        테스트가 보증하므로 유지한다. RRF는 멀티 질의 융합에만 적용.
 → [3] 그래프 확장 (LLM 없음)
      매칭 청크의 menuCode → ai_knowledge_graph 1~2홉 이웃(선행/후행) 문서의
      대표 청크(개요 섹션)를 컨텍스트에 강제 포함.
      intent=workflow|troubleshoot → 해당 워크플로우 문서 청크를 최우선 포함.
      intent=troubleshoot → troubleshooting 테이블 symptom 매칭 결과 포함.
      intent=engineer → business-logics 청크 우선.
 → [4] 리랭크 (LLM 호출 2)
      후보 ~20개를 질문 관련성으로 채점 → top 6~8 선별.
      단, 그래프 확장으로 들어온 선행/후행 대표 청크는 리랭크와 무관하게 유지.
 → [5] 답변 생성 (LLM 호출 3)
      컨텍스트를 섹션으로 구조화해 전달:
        ## 현재 화면 문서 / ## 워크플로우 전후 단계 / ## 문제 해결 / ## 관련 화면
      답변 지침: 전후관계 질문이면 워크플로우 단계 순서대로,
      문제해결 질문이면 증상→원인 후보→확인 순서로 답하라.
```

- 단편성 해소 지점: [3] 관계가 점수 부스트가 아니라 **컨텍스트 자체**로 들어가고, [5] 답변 LLM이 관계를 구분된 섹션으로 명시적으로 받는다.
- [1] 실패(JSON 파싱 실패 등) 시 원문 1질의로 폴백, [4] 실패 시 RRF 순위 그대로 사용 — 파이프라인 단계 실패가 채팅 실패로 전파되지 않는다.
- text-to-SQL 분기(`processWithKnowledge`)는 기존 유지. 이 파이프라인은 지식 검색 경로(`generalChat` + `analyze`의 knowledgePrompt)에 적용.

## 7. 에러 처리

| 상황 | 동작 |
|---|---|
| 질의 이해 LLM 실패 | 원문 그대로 단일 질의 검색으로 폴백 |
| 리랭크 LLM 실패 | RRF 순위 상위 6개 사용 |
| workflows 문서 frontmatter 파싱 오류 | reindex 결과에 파일별 오류 목록 반환, 해당 파일 스킵 |
| steps의 menu가 도움말에 없는 메뉴코드 | reindex 경고 (오타 감지) |
| 임베딩 키 없음 (local-hash) | 채팅 패널에 "의미 검색 비활성" 경고 배지 |

## 8. 테스트 전략

- **markdown-chunker/workflow 파서**: frontmatter 스키마 파싱, 맥락 헤더 생성 단위 테스트 (기존 spec 파일 패턴).
- **그래프 확장**: 그래프 테이블 시드 → menuCode 홉 탐색 결과 검증.
- **RRF 융합**: 순위 융합 로직 단위 테스트 (기존 bm25 부호 버그 같은 회귀 방지).
- **파이프라인 폴백**: LLM 단계 실패 시 폴백 경로 테스트 (LLM mock).
- **평가 세트**: 4개 질문 유형 × 5~10개 실제 질문으로 golden 질문 목록을 만들어 개선 전/후 답변 비교 (수동 검수).

## 9. 구현 순서 (요약)

1. workflows 문서 스키마 파서 + 그래프 테이블 + reindex 통합
2. 워크플로우 문서 초안 생성 (LLM) → 사용자 검수
3. 맥락 주입 청킹
4. 런타임: 질의 이해 → RRF → 그래프 확장 → 리랭크 → 구조화 컨텍스트
5. 도움말 frontmatter 누락 점검 스크립트 + 보완
6. local-hash 경고 배지 (프론트)
7. golden 질문 평가

상세 계획은 writing-plans 단계에서 작성.

## 10. 제외한 대안

- **정통 GraphRAG (LLM 엔티티 추출 + 커뮤니티 요약)**: 도움말이 이미 메뉴 단위로 구조화되어 있어 워크플로우 문서가 같은 효과를 더 정확하게 낸다. 추출 오류 검수 부담으로 제외.
- **외부 벡터DB (Qdrant 등)**: 코퍼스 4.5MB에 sqlite-vec로 충분.
- **도움말 frontmatter에 prev/next 분산 기입**: 519개 파일에 흩어져 정합성 관리 불가, 단일 출처 원칙 위배.
