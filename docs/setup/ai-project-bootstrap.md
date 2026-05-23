# AI 프로젝트 부트스트랩

## 목적

이 문서는 다른 신규 프로젝트를 시작할 때 AI에게 가장 먼저 주입할 수 있는 단일 진입 문서다.
아래 순서와 규칙을 그대로 사용하면 HANES에서 정리한 설계 기준을 새 프로젝트에 이식할 수 있다.

## 사용 방법

1. 먼저 이 문서를 읽힌다.
2. 이어서 지정된 핵심 문서를 순서대로 주입한다.
3. 프로젝트 특화 요구사항은 마지막에 추가한다.

## 기본 지시문

다음 규칙을 기준으로 프로젝트를 설계하고 구현하라.

- 아키텍처 기준은 [architecture-principles.md](C:/Project/HANES/docs/core/architecture-principles.md)
- 개발환경과 기술스택 기준은 [development-stack-guide.md](C:/Project/HANES/docs/core/development-stack-guide.md)
- 구현 세부 규칙은 [implementation-rules.md](C:/Project/HANES/docs/core/implementation-rules.md)
- 도메인 구조 템플릿은 [domain-blueprints.md](C:/Project/HANES/docs/core/domain-blueprints.md)
- API 표면 규칙은 [api-contract-guide.md](C:/Project/HANES/docs/core/api-contract-guide.md)
- 엔티티 설계 기준은 [entity-design-guide.md](C:/Project/HANES/docs/core/entity-design-guide.md)
- UI 설계 기준은 [ui-screen-patterns.md](C:/Project/HANES/docs/core/ui-screen-patterns.md)
- 네비게이션 기준은 [navigation-spec.md](C:/Project/HANES/docs/core/navigation-spec.md)
- 테마 시스템 기준은 [theme-system-spec.md](C:/Project/HANES/docs/core/theme-system-spec.md)
- 인증 기준은 [authentication-spec.md](C:/Project/HANES/docs/core/authentication-spec.md)
- 다국어 기준은 [i18n-spec.md](C:/Project/HANES/docs/core/i18n-spec.md)
- 금지 규칙은 [anti-patterns.md](C:/Project/HANES/docs/core/anti-patterns.md)
- 상태 코드와 분류 코드가 있으면 [common-code-guide.md](C:/Project/HANES/docs/core/common-code-guide.md)를 추가로 따른다.

## 권장 주입 순서

1. [development-stack-guide.md](C:/Project/HANES/docs/core/development-stack-guide.md)
2. [architecture-principles.md](C:/Project/HANES/docs/core/architecture-principles.md)
3. [implementation-rules.md](C:/Project/HANES/docs/core/implementation-rules.md)
4. [domain-blueprints.md](C:/Project/HANES/docs/core/domain-blueprints.md)
5. [api-contract-guide.md](C:/Project/HANES/docs/core/api-contract-guide.md)
6. [entity-design-guide.md](C:/Project/HANES/docs/core/entity-design-guide.md)
7. [ui-screen-patterns.md](C:/Project/HANES/docs/core/ui-screen-patterns.md)
8. [navigation-spec.md](C:/Project/HANES/docs/core/navigation-spec.md)
9. [theme-system-spec.md](C:/Project/HANES/docs/core/theme-system-spec.md)
10. [authentication-spec.md](C:/Project/HANES/docs/core/authentication-spec.md)
11. [i18n-spec.md](C:/Project/HANES/docs/core/i18n-spec.md)
12. [anti-patterns.md](C:/Project/HANES/docs/core/anti-patterns.md)
13. 필요 시 [common-code-guide.md](C:/Project/HANES/docs/core/common-code-guide.md)

## 목적별 최소 번들

### 설계만 먼저 할 때

- [architecture-principles.md](C:/Project/HANES/docs/core/architecture-principles.md)
- [development-stack-guide.md](C:/Project/HANES/docs/core/development-stack-guide.md)
- [domain-blueprints.md](C:/Project/HANES/docs/core/domain-blueprints.md)
- [entity-design-guide.md](C:/Project/HANES/docs/core/entity-design-guide.md)
- [navigation-spec.md](C:/Project/HANES/docs/core/navigation-spec.md)

### 백엔드 구현 중심일 때

- [implementation-rules.md](C:/Project/HANES/docs/core/implementation-rules.md)
- [development-stack-guide.md](C:/Project/HANES/docs/core/development-stack-guide.md)
- [api-contract-guide.md](C:/Project/HANES/docs/core/api-contract-guide.md)
- [authentication-spec.md](C:/Project/HANES/docs/core/authentication-spec.md)
- [anti-patterns.md](C:/Project/HANES/docs/core/anti-patterns.md)

### 화면 구현 중심일 때

- [ui-screen-patterns.md](C:/Project/HANES/docs/core/ui-screen-patterns.md)
- [navigation-spec.md](C:/Project/HANES/docs/core/navigation-spec.md)
- [theme-system-spec.md](C:/Project/HANES/docs/core/theme-system-spec.md)
- [i18n-spec.md](C:/Project/HANES/docs/core/i18n-spec.md)
- [common-code-guide.md](C:/Project/HANES/docs/core/common-code-guide.md)
- [anti-patterns.md](C:/Project/HANES/docs/core/anti-patterns.md)

## 주입 후 첫 질문 템플릿

AI에게 아래 순서로 답하게 하면 좋다.

1. 이 프로젝트의 핵심 도메인 모듈을 정의하라.
2. 각 도메인의 상태 전이와 핵심 엔티티를 제시하라.
3. API 경로와 DTO 구조 초안을 제시하라.
4. 금지 안티패턴을 피하는 구현 전략을 제시하라.
5. 필요한 경우 화면 패턴과 공통 코드 전략을 제시하라.

## 주의사항

1. 현재 프로젝트 설명 문서와 규격 문서를 혼동하지 않는다.
2. 신규 프로젝트에는 설명 문서보다 규격 문서를 우선 주입한다.
3. 설명 문서는 예시와 참고용으로만 사용한다.
