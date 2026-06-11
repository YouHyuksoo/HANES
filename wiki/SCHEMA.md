# HANES MES 지식 위키 — 스키마

LLM Wiki 패턴(Karpathy) 기반. LLM이 `docs/`를 읽고 이 위키를 점진적으로 구축·유지한다.

## 구조

| 경로 | 역할 | 권한 |
|------|------|------|
| `C:\Project\HANES\docs\` | 원본 자료(sources) | **불변 — 읽기 전용** |
| `wiki/pages/*.md` | 위키 페이지 | LLM이 전담 작성 |
| `wiki/index.md` | 전체 페이지 카탈로그 (카테고리별, 한 줄 요약) | 매 ingest마다 갱신 |
| `wiki/log.md` | append-only 작업 로그 | 매 작업마다 추가 |
| `wiki/SCHEMA.md` | 본 문서 — 구조·규칙 | 사용자 합의 후 수정 |

## 규칙

- **언어**: 한국어 (기술 용어·코드 식별자는 원문 유지)
- **페이지 명명**: kebab-case (예: `common-code-system.md`)
- **링크**: `[[page-name]]` 표기 (확장자 없이)
- **출처**: 각 페이지 상단에 근거가 된 `docs/` 원본 경로를 명시
- **갱신**: 새 문서가 `docs/`에 추가되면 ingest — 요약 페이지 작성 + 관련 기존 페이지 교차참조 갱신 + index/log 갱신

## 카테고리

1. **개요** — 프로젝트 전체 그림, 개발환경, 문서 체계
2. **아키텍처** — 시스템 구조, 데이터 모델, 모듈 맵, 라우팅, API
3. **표준** — 설계 원칙, 엔티티/공통코드/채번/i18n/인증/UI 규칙, 용어집
4. **도메인** — 자재/생산/품질/설비/출하/기준정보/시스템 업무 흐름
5. **기능 이력** — superpowers plans/specs 기반 기능별 설계·구현 연혁

## log.md 형식

```markdown
## [YYYY-MM-DD] ingest|query|lint | 제목
한 줄 설명. 갱신된 페이지: [[page-a]], [[page-b]]
```
