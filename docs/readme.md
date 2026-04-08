# HANES Docs Guide

## 목적

`docs/`는 현재 코드 기준 문서와 문서 생성 도구만 남긴다.

## 구조

### `docs/core/`

현재 구현을 설명하는 문서와 다른 프로젝트에 재사용 가능한 규격 문서를 함께 둔다.

### `docs/tools/`

문서 생성 보조 스크립트.

## 운영 원칙

1. 코드와 충돌하면 코드를 기준으로 본다.
2. 코드에서 직접 검증되지 않는 작업 메모와 임시 계획은 `docs/`에 두지 않는다.
3. 산출물은 `exports/`에 둔다.
4. 상위 폴더는 더 늘리지 않는다.

## AI 주입용 우선 문서

신규 프로젝트에 주입할 때는 아래 문서를 우선 사용한다.

0. `ai-project-bootstrap.md`
1. `development-stack-guide.md`
2. `architecture-principles.md`
3. `implementation-rules.md`
4. `domain-blueprints.md`
5. `api-contract-guide.md`
6. `entity-design-guide.md`
7. `ui-screen-patterns.md`
8. `navigation-spec.md`
9. `theme-system-spec.md`
10. `authentication-spec.md`
11. `i18n-spec.md`
12. `anti-patterns.md`
13. `project-bootstrap-checklist.md`
14. `environment-setup-guide.md`

## 권장 입력 순서

1. `ai-project-bootstrap.md`
2. `development-stack-guide.md`
3. `architecture-principles.md`
4. `implementation-rules.md`
5. `domain-blueprints.md`
6. `api-contract-guide.md`
7. `entity-design-guide.md`
8. `ui-screen-patterns.md`
9. `navigation-spec.md`
10. `theme-system-spec.md`
11. `authentication-spec.md`
12. `i18n-spec.md`
13. `anti-patterns.md`
14. `project-bootstrap-checklist.md`
15. `environment-setup-guide.md`
16. 필요 시 `common-code-guide.md`

## 주입 목적별 선택

- 설계 중심: `architecture-principles.md`, `domain-blueprints.md`, `entity-design-guide.md`
- 구현 중심: `implementation-rules.md`, `api-contract-guide.md`, `anti-patterns.md`
- 화면 중심: `ui-screen-patterns.md`, `navigation-spec.md`, `theme-system-spec.md`
- 인증 중심: `authentication-spec.md`
- 다국어 중심: `i18n-spec.md`, `common-code-guide.md`

## 설명 문서와 규격 문서의 역할

- 설명 문서:
  - `01-system-architecture.md`: 시스템 상위 구조 설명
  - `module-map.md`: 저장소와 도메인 배치 지도
  - `backend-module-index.md`: 백엔드 모듈 책임과 API 인덱스
- 규격 문서:
  - `ai-project-bootstrap.md`
  - `development-stack-guide.md`
  - `architecture-principles.md`
  - `implementation-rules.md`
  - `domain-blueprints.md`
  - `api-contract-guide.md`
  - `entity-design-guide.md`
  - `ui-screen-patterns.md`
  - `navigation-spec.md`
  - `theme-system-spec.md`
  - `authentication-spec.md`
  - `i18n-spec.md`
  - `anti-patterns.md`
  - `project-bootstrap-checklist.md`
  - `environment-setup-guide.md`
  - `common-code-guide.md`

## 문서 명명 규칙

1. 문서 파일명은 모두 `lowercase-kebab-case`를 사용한다.
2. `README.md` 같은 대문자 예외를 두지 않고 `readme.md`로 통일한다.
3. 순서가 필요한 개요 문서는 `01-`, `02-` 같은 숫자 접두사를 유지한다.
4. 약어가 포함돼도 파일명에서는 소문자로 내린다. 예: `api`, `erd`, `pda`.
