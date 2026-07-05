# docs 표준 적용 후 audit 결과

- 작성일: 2026-07-05
- 작성 계기: managing-docs 표준을 HANES에 첫 적용(전면 재편) 후 `/managing-docs audit` 절차 실행 결과 기록
- 표준: `docs/README.md` (manifest, standardVersion 1), 설계 `docs/specs/2026-07-04-docs-standard-skill-design.md`

## 요약 (결론 먼저)

구조 재편은 클린 통과. 표준이 **표면화한** 잔여 정리 대상은 명명 위반 소수 + 살아있는 문서 30개의 추적 계약(frontmatter) 누락이며, 모두 표준 도입 이전부터 존재하던 것이다. 강제 수정 대신 후속 정리 대상으로 기록한다(일부는 사용자 판단 필요).

## 통과 항목

- **분류체계**: core 8(adr/specs/plans/standards/design/business-logics/guides/reports) 전부 존재.
- **특화 폴더 등록**: architecture/manuals/presentation/workflows 4종 모두 manifest 등록부에 등록됨. 미등록 폴더 0.
- **루트 오염**: docs/ 직하위 md는 README.md뿐. 0 위반.
- **외부 문서 집합**: help 경로 등록 + `node tools/help-frontmatter-audit.mjs` 점검 명령 연결(도움말 234개 frontmatter 누락 0, 기존 확인).
- **AI RAG 정합성**: 재편+BL frontmatter 승격 후 재인덱싱 성공(506문서/6186청크/그래프 90엣지/workflowErrors 0). engineer 질문 스모크 테스트 정상(PROD_RECEIVE business-logics 인용, PRODUCT_STOCKS·FG_LABELS 정답).

## 잔여 정리 대상 (후속)

### 1. 명명 위반 (소수, 사용자 판단)
- `docs/specs/2026-06-08-lot-split-merge-redesign.md` — `-design` 접미사 누락. spec이면 접미사 추가, plan 성격이면 plans로 이동 판단 필요.
- `docs/plans/code-map-tool-plan.md` — 날짜 접두 없음(`YYYY-MM-DD-` 규칙 위반).
- `docs/plans/ddl-iqc-part-specs.sql` — plans에 SQL 파일. docs가 아니라 마이그레이션/스크립트 위치로 이동 대상.
- `docs/adr/NNNN-title.md` 형식(예: `0001-label-issue-by-routing.md`) — 표준은 `ADR-NNN-kebab-제목.md`. HANES는 adr-tools 관례(`NNNN-title`)를 이미 사용 중. **표준을 HANES 관례에 맞출지, 기존 ADR을 리네이밍할지 사용자 결정 필요** (리네이밍 시 상호 참조 갱신 동반).

### 2. 살아있는 문서 추적 계약 누락 (30건)
`node tools/docs-sync-scan.mjs` 결과 `no-frontmatter=30`:
- docs/standards 19, docs/guides 5, docs/architecture 6.
이들은 표준 도입 이전 문서라 `sources`/`verifiedCommit` frontmatter가 없어 `sync`로 소스 변경을 추적할 수 없다. 각 문서가 설명하는 소스를 판단해 frontmatter를 채우는 후속 작업 필요(문서별 판단이라 일괄 스크립트 부적합).

### 3. business-logics sources 커버리지 (115/163)
BL 163개 중 115개가 `sources: []`(본문에 apps/packages 백틱 경로 미기재) → sync 추적 불가. 정규식 확대 또는 저자 수동 기입으로 커버리지 확대는 별도 태스크(Task 5 리뷰 지적).

## 결론

표준이 "보이지 않던 문서 부채를 보이게" 만드는 목적을 달성했다. 위 잔여 항목은 audit이 앞으로도 반복 표면화하므로, 우선순위에 따라 점진 정리하면 된다.
