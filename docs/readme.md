# HANES Docs Guide

## 목적

`docs/`는 HANES MES 프로젝트의 현재 코드 기준 개발 문서와 관련 산출물 및 분석 보고서를 효율적으로 찾아보고 유지 관리하기 위해 역할별로 분류하여 저장한다.

---

## 📁 디렉토리 카테고리 구조

모든 문서는 역할과 성격에 따라 다음 5대 카테고리로 나누어 관리한다.

### 1. 📁 [design/](file:///C:/Project/HANES/docs/design) (시스템 설계 및 API 사양)
시스템 아키텍처 구성, ERD 및 데이터 모델, 라우팅 및 모듈 배치 지도 문서.
*   [01-system-architecture.md](file:///C:/Project/HANES/docs/design/01-system-architecture.md): 시스템 전체 상위 구조도 및 컴포넌트 설계
*   [02-data-model-erd.md](file:///C:/Project/HANES/docs/design/02-data-model-erd.md): ERD 설계 원칙 및 전체 데이터 모델 명세
*   [03-frontend-routing.md](file:///C:/Project/HANES/docs/design/03-frontend-routing.md): Next.js App Router 기반의 프론트엔드 라우팅 설계
*   [04-backend-api-endpoints.md](file:///C:/Project/HANES/docs/design/04-backend-api-endpoints.md): 모듈별 백엔드 API 컨트롤러 엔드포인트 목록
*   [module-map.md](file:///C:/Project/HANES/docs/design/module-map.md): Turborepo 저장소 도메인 및 패키지 배치 지도
*   [backend-module-index.md](file:///C:/Project/HANES/docs/design/backend-module-index.md): 백엔드 모듈별 역할 정의 및 API 인덱스

### 2. 📁 [workflows/](file:///C:/Project/HANES/docs/workflows) (도메인 업무 흐름 및 제조 공정)
제조 현장의 물류 흐름, 설비 통신, 기능별 상태 전이 규칙과 메뉴 배치 흐름.
*   [05-production-process-flow.md](file:///C:/Project/HANES/docs/workflows/05-production-process-flow.md): 생산 제조 공정 및 품목 유형별 정합성 흐름도
*   [domain-workflows.md](file:///C:/Project/HANES/docs/workflows/domain-workflows.md): 자재, 생산, 품질, 출하 도메인별 상태 전이 수명주기
*   [menu-add-workflow.md](file:///C:/Project/HANES/docs/workflows/menu-add-workflow.md): 사이드바 메뉴 트리 변경 및 신규 메뉴 추가 가이드

### 3. 📁 [standards/](file:///C:/Project/HANES/docs/standards) (개발 표준 및 규칙)
코딩 규격, DB 도메인 사전, UI 스크린 유형, RBAC 권한, 다국어 처리 등 준수해야 할 개발 지침.
*   [implementation-rules.md](file:///C:/Project/HANES/docs/standards/implementation-rules.md): AI/개발자용 코딩 룰 및 제조/재고 정합성(역처리 금지) 통제 규칙
*   [architecture-principles.md](file:///C:/Project/HANES/docs/standards/architecture-principles.md): 모노레포 및 서비스 컴포지션의 구조적 아키텍처 설계 원칙
*   [entity-design-guide.md](file:///C:/Project/HANES/docs/standards/entity-design-guide.md): Oracle 연동 TypeORM 엔티티 작성 표준
*   [api-contract-guide.md](file:///C:/Project/HANES/docs/standards/api-contract-guide.md): 통일된 API 응답 규격 및 공통 Dto 명세 규칙
*   [database-column-domains.md](file:///C:/Project/HANES/docs/standards/database-column-domains.md): Oracle 데이터베이스 표준 컬럼명 및 도메인 사전
*   [common-code-guide.md](file:///C:/Project/HANES/docs/standards/common-code-guide.md): 공통 코드 체계 및 관련 Badges, Selects 콤보박스 사용법
*   [ui-screen-patterns.md](file:///C:/Project/HANES/docs/standards/ui-screen-patterns.md): 데이터 그리드, 필터, 편집용 Form 템플릿 등 표준 UI 유형 명세
*   [navigation-spec.md](file:///C:/Project/HANES/docs/standards/navigation-spec.md): 메뉴 네비게이션 트리 데이터와 연계 설정 규칙
*   [theme-system-spec.md](file:///C:/Project/HANES/docs/standards/theme-system-spec.md): Tailwind CSS 및 HSL 테마 컬러 표준 색상 정의
*   [authentication-spec.md](file:///C:/Project/HANES/docs/standards/authentication-spec.md): 로그인 인증, 토큰 만료 가드 및 RBAC(메뉴 권한 통제)
*   [i18n-spec.md](file:///C:/Project/HANES/docs/standards/i18n-spec.md): 프론트엔드 다국어 리소스 적용 및 i18next 번역 적용 규격
*   [anti-patterns.md](file:///C:/Project/HANES/docs/standards/anti-patterns.md): 코드 품질 하락을 막기 위해 철저히 금지해야 하는 코딩 안티패턴
*   [glossary.md](file:///C:/Project/HANES/docs/standards/glossary.md): MES 프로젝트에서 사용되는 공통 용어 사전

### 4. 📁 [setup/](file:///C:/Project/HANES/docs/setup) (개발 세팅 및 부트스트랩)
프로젝트 초기 빌드 및 실행을 위한 로컬 서버 설치 가이드와 체크리스트.
*   [ai-project-bootstrap.md](file:///C:/Project/HANES/docs/setup/ai-project-bootstrap.md): AI 에이전트 신규 기능 개발 시 우선 로드 및 참조할 지침
*   [environment-setup-guide.md](file:///C:/Project/HANES/docs/setup/environment-setup-guide.md): Node.js, Oracle DB, 로컬 환경변수 설정 가이드
*   [project-bootstrap-checklist.md](file:///C:/Project/HANES/docs/setup/project-bootstrap-checklist.md): 개발 환경 실행 후 1단계로 정상 점검할 체크리스트
*   [development-stack-guide.md](file:///C:/Project/HANES/docs/setup/development-stack-guide.md): HANES MES 전반에 사용된 기술 스택 명세 및 제약사항

### 5. 📁 [reports/](file:///C:/Project/HANES/docs/reports) (분석 및 갭 리포트)
프로젝트 전반의 성능, 아키텍처 및 ERP 연동을 위한 갭 분석 리포트 보관함.
*   [architecture-analysis-report.md](file:///C:/Project/HANES/docs/reports/architecture-analysis-report.md): HANES MES 아키텍처 최종 재분석 보고서 (2026-05-23 최종)
*   [tenant-controller-gap-report.md](file:///C:/Project/HANES/docs/reports/tenant-controller-gap-report.md): 멀티 테넌트 적용 대상 컨트롤러 식별 분석 보고서
*   [tenant-service-query-gap-report.md](file:///C:/Project/HANES/docs/reports/tenant-service-query-gap-report.md): 서비스 쿼리 레벨에서의 테넌트 식별자 반영 갭 보고서

---

## ⚙️ 운영 및 문서화 원칙

1.  **코드 최우선 기준**: 코드와 문서의 정의가 충돌할 때는 언제나 동작하는 "소스 코드"를 기준으로 보고 문서를 보정한다.
2.  **사실 관계 위주 기재**: 작동하지 않는 가상의 계획이나 임시 작업 메모는 문서에 두지 않는다.
3.  **lowercase-kebab-case**: 모든 마크다운 문서명은 영어 소문자와 대시(-)만을 사용한다.
4.  **README 예외 해제**: 루트 리포지토리의 리드미와 각 패키지의 개발 리드미도 `README.md` 대신 `readme.md`로 일관되게 소문자 작성한다.
