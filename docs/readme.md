# HANES Docs Guide

`docs/`는 HANES MES 프로젝트의 현재 코드 기준 개발 문서를 역할별로 분류한다.

| 폴더 | 내용 |
|------|------|
| `standards/` | 코딩 규칙, 아키텍처 원칙, DB 도메인, UI 패턴, 인증/i18n/anti-patterns 등 개발 표준 (AI 사전주입 순서 유지) |
| `design/` | 시스템 아키텍처, ERD, 프론트 라우팅, 백엔드 API 인덱스, 모듈 맵 |
| `workflows/` | 자재/생산/품질/출하/설비 도메인별 상태 전이 및 업무 흐름 (가장 방대한 문서군) |
| `setup/` | 환경 설정, 기술 스택, AI 부트스트랩, 프로젝트 체크리스트 |
| `specs/` | 기능별 설계 명세 (live design docs) |
| `plans/` | 기능별 구현 계획 |
| `reports/` | DB 스키마 ERD (자동 생성) 및 기타 리포트 |
| `presentation/` | 고객 발표 자료 |

## 원칙

1. **코드 우선**: 코드와 문서 충돌 시 코드가 기준.
2. **사실 위주**: 가상 계획이나 작업 메모는 문서에 두지 않는다.
3. **lowercase-kebab-case**: 모든 문서명은 영어 소문자와 대시(`-`) 사용.
4. **AI 주입 순서**: `setup/ai-project-bootstrap.md` → `standards/`(architecture → implementation → entity → UI → auth → i18n → anti-patterns).
