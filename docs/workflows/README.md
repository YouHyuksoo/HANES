# docs/workflows

이 폴더는 **AI 채팅 RAG의 워크플로우 그래프 단일 출처**다.

## 구조

- `definitions/*.md` — 업무 흐름 정의 문서. frontmatter(YAML)가 기계가 읽는 그래프(steps/requires/transitions/produces/troubleshooting)이고, 본문이 사람이 읽는 단계별 설명이다.
  - 스키마: `docs/specs/2026-07-04-ai-rag-pipeline-v2-design.md` 4-A 참조.
  - reindex(`POST /ai/knowledge/reindex`) 시 `ai_knowledge_graph` 등 그래프 테이블로 변환되어, AI 채팅이 "이 작업 다음에 뭐 해?" 같은 전후관계 질문에 답하는 근거가 된다.
  - `steps[].menu`는 반드시 도움말 frontmatter의 실제 `menuCode`여야 한다(오타는 reindex 응답의 `workflowWarnings`로 감지).

## 문서 추가/수정 시

1. `definitions/`에 파일 추가 또는 수정 (frontmatter 스키마 준수)
2. 시스템설정 > AI Embedding에서 재인덱싱 (또는 reindex API)
3. reindex 응답의 `workflowErrors`/`workflowWarnings`가 비어 있는지 확인

## 이력

- 과거 이 폴더에 있던 화면별 워크플로우 설명(`wf-*.md`, `_template.md`, `05-production-process-flow.md`, `domain-workflows.md`)은 도움말(`apps/frontend/public/help/`) + `docs/business-logics/` + `definitions/`가 완전히 대체하여 2026-07-04 정리됨.
- 개발 절차 문서였던 `menu-add-workflow.md`는 `docs/standards/menu-add-workflow.md`로 이동.
