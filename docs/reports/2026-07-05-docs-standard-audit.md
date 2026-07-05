# docs 표준 적용 후 audit 결과

- 작성일: 2026-07-05
- 작성 계기: managing-docs 표준을 HANES에 첫 적용(전면 재편) 후 `/managing-docs audit` 실행 + 잔여 정리 완료 기록
- 표준: `docs/README.md` (manifest, standardVersion 1), 설계 `docs/specs/2026-07-04-docs-standard-skill-design.md`

## 요약 (결론 먼저)

구조 재편 + 잔여 정리 모두 완료. 명명 위반 0, 살아있는 문서 추적 계약(frontmatter) 미비는 **codex lock 2건을 제외하고 전량 해소**. audit이 표면화한 부채를 그 자리에서 정리했다.

## 통과 항목

- **분류체계**: core 8 전부 존재. 특화 폴더(architecture/manuals/presentation/workflows) 4종 manifest 등록. 미등록 폴더 0. 루트 오염 0(README만).
- **명명 위반 0** (아래 해소 내역 참조).
- **살아있는 문서 추적 계약**: `node tools/docs-sync-scan.mjs` → `fresh=163 stale=2 untracked=34 no-frontmatter=2 bad-commit=0`.
  - `no-frontmatter=2` = codex active lock 2건(`master-part-page-standard.md`, `ui-screen-patterns.md`)뿐. lock 해제 후 백필 필요.
  - `untracked=34` = 순수 규칙 문서(glossary/anti-patterns 등, 추적할 특정 소스 없음)로 `sources: []` 명시 선언. 정상.
  - `stale=2` = 소스가 verifiedCommit 이후 변경됨 → sync가 정상 감지(다음 `sync`에서 내용 대조·재스탬프 대상).
- **외부 문서 집합**: help 경로 등록 + `node tools/help-frontmatter-audit.mjs` 연결(도움말 234개 누락 0).
- **AI RAG 정합성**: 재편+frontmatter 승격/백필 후 재인덱싱 성공. engineer 스모크 정상(PROD_RECEIVE→PRODUCT_STOCKS·FG_LABELS 정답).

## 해소 내역

### 명명 위반 (전량 해소, 커밋 2e8d7f56)
- ADR 관례 충돌: 표준을 HANES가 이미 쓰는 adr-tools 관례 `NNNN-kebab-제목.md`로 통일(SKILL/manifest-template/README COMMON 3자 + adr 템플릿). 기존 ADR 3개 리네이밍 불필요, 준수 상태.
- `docs/plans/ddl-iqc-part-specs.sql` → `apps/backend/src/migrations/2026-06-23_iqc_part_specs.sql` 이동(수동적용 DDL이 올바른 위치, migrations는 자동실행 안 함).
- `docs/plans/code-map-tool-plan.md` → `2026-06-29-code-map-tool.md`(날짜 접두 부여).
- `docs/specs/2026-06-08-lot-split-merge-redesign.md` → `-design` 접미사 부여, 참조 10곳(help 8 + 코드 2) 동시 갱신.

### 살아있는 문서 sources 백필 (커밋 1706f83f)
- `tools/backfill-doc-sources.mjs`: 본문의 소스 경로 직접언급 + 심볼(Service/Controller/Store/Panel 등, useXxx 훅)을 코드베이스 `export` 인덱스로 resolve해 **실존 검증된 파일만** frontmatter sources에 채움. 모호한 심볼(여러 파일 매칭)은 오탐 방지로 제외.
- 결과: 109개 문서에 실소스 채움 + 순수 규칙 문서 14개에 `sources: []` 명시. codex-lock 2개 제외.
- Task 5의 business-logics verifiedCommit(분석 기준 커밋)은 보존.

## 잔여 (lock 종속, 후속)

- codex lock 2건(`docs/standards/master-part-page-standard.md`, `docs/standards/ui-screen-patterns.md`) — lock 해제 후 `node tools/backfill-doc-sources.mjs --commit` 재실행하면 자동 백필됨(스크립트가 이미 대상에 포함, 현재만 skip).
- `stale=2` 문서 — 다음 `/managing-docs sync`에서 소스 변경분과 대조해 내용 갱신·재스탬프.

## 결론

표준이 "보이지 않던 문서 부채를 보이게" 만들고, 그 부채를 audit→정리 루프로 실제 해소했다. 남은 것은 타 세션 lock 종속 2건뿐.
