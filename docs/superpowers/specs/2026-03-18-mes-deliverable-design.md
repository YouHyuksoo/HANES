# MES SI 프로젝트 산출물 생성 스킬 설계서

## 1. 개요

MES 시스템 개발 시 SI 프로젝트 감리/검수에 필요한 산출물을 코드베이스 자동 추출 + 대화형 보완 하이브리드 방식으로 Word(.docx) 문서를 생성하는 스킬.

## 2. 스킬 정보

- **스킬명**: `mes-deliverable`
- **사용법**: `/mes-deliverable [산출물유형] [모듈명]`
- **출력 포맷**: Word (.docx)
- **언어**: 한국어 전용
- **프레임워크**: NestJS + ASP.NET Core 자동 감지

## 3. 산출물 목록 (전체 22종)

### 우선 구현 (5종)

| No | 산출물 | 영문 키워드 | 자동 추출 |
|---|---|---|---|
| 1 | DB설계서 | db-design | ✅ 자동 |
| 2 | 화면설계서 | screen-design | 🔄 일부 |
| 3 | 기능설계서 | func-design | 🔄 일부 |
| 4 | 프로그램목록 | program-list | ✅ 자동 |
| 5 | 추적표 | traceability | 🔄 일부 |

### 향후 확장 (17종)

| No | 산출물 | 영문 키워드 | 단계 |
|---|---|---|---|
| 6 | 산출물적용계획표 | deliverable-plan | 분석 |
| 7 | 개발표준정의서 | dev-standard | 분석 |
| 8 | 현행시스템 분석서 | as-is-analysis | 분석 |
| 9 | 요구사항 정의서 | srs | 분석 |
| 10 | 업무 프로세스 정의서 | business-process | 분석 |
| 11 | 용어사전 | glossary | 분석 |
| 12 | 메뉴구성도 | menu-structure | 설계 |
| 13 | 코드정의서 | code-definition | 설계 |
| 14 | 도메인정의서 | domain-definition | 설계 |
| 15 | 인터페이스 설계서 | interface-design | 설계 |
| 16 | ERD | erd | 설계 |
| 17 | 테스트계획서 | test-plan | 설계 |
| 18 | 단위테스트 시나리오/결과서 | unit-test | 테스트 |
| 19 | 통합테스트 시나리오/결과서 | integration-test | 테스트 |
| 20 | 사용자 매뉴얼 | user-manual | 완료 |
| 21 | 운영자 매뉴얼 | ops-manual | 완료 |
| 22 | 교육 명세서 | training-spec | 완료 |

## 4. 사용법

```bash
# 개별 생성
/mes-deliverable 기능설계서 material
/mes-deliverable db-design production

# 일괄 생성 (특정 모듈의 5종 전부)
/mes-deliverable all material

# 전체 모듈 전체 산출물
/mes-deliverable all
```

### 키워드 매핑 (한글/영문 모두 지원)

| 한글 | 영문 |
|---|---|
| DB설계서 | db-design |
| 화면설계서 | screen-design |
| 기능설계서 | func-design |
| 프로그램목록 | program-list |
| 추적표 | traceability |

## 5. 워크플로우

### 공통 흐름

```
1. 인자 파싱 (산출물 유형 + 모듈명)
2. 프레임워크 자동 감지 (NestJS / ASP.NET Core)
3. 코드베이스 자동 분석
   ├── 엔티티 → 테이블/컬럼 정보
   ├── 컨트롤러 → API 엔드포인트
   ├── 서비스 → 비즈니스 로직
   ├── DTO → 입출력 구조
   ├── 프론트엔드 페이지 → 화면 구성
   └── i18n → 한글 라벨명
4. 자동 추출 결과 제시
5. 대화형 보완 (산출물별 질문 목록)
   ├── 목적/범위 확인
   ├── 비즈니스 규칙/제약조건
   ├── 예외 처리/에러 시나리오
   └── 특이사항/추가 요구
6. 최종 내용 확인
7. docx 생성 (docx 스킬 활용)
```

### 프레임워크 자동 감지

| 감지 기준 | 프레임워크 |
|---|---|
| `package.json` + `@nestjs/core` | NestJS |
| `*.csproj` + `Microsoft.AspNetCore` | ASP.NET Core |

### 프레임워크별 추출 매핑

| 추출 항목 | NestJS (TypeScript) | ASP.NET Core (C#) |
|---|---|---|
| 테이블/컬럼 | `*.entity.ts` (`@Entity`, `@Column`) | `*.cs` (`DbSet`, `[Table]`, `[Column]`) |
| API 엔드포인트 | `*.controller.ts` (`@Get`, `@Post`) | `*Controller.cs` (`[HttpGet]`, `[HttpPost]`) |
| 비즈니스 로직 | `*.service.ts` | `*Service.cs`, `*UseCase.cs` |
| 입출력 구조 | `*.dto.ts` | `*Dto.cs`, `*ViewModel.cs` |
| 화면 | `page.tsx`, `*.tsx` | `*.cshtml`, `*.razor` |
| 다국어 | `i18n/*.json` | `Resources/*.resx` |

## 6. 산출물별 상세

### 6.1 DB설계서 (db-design)

**목차:**
1. 개요
2. 테이블 목록
3. 테이블별 정의 (컬럼명, 한글명, 타입, 길이, PK, FK, NULL, 기본값, 설명)
4. 인덱스 정의
5. 제약조건 정의

**자동 추출:** 엔티티 파일에서 테이블명, 컬럼명, 타입, PK/FK, 데코레이터 분석
**대화 보완:** 데이터 보존 기간, 초기 데이터, 파티션 전략, 이력 관리 방식

### 6.2 화면설계서 (screen-design)

**목차:**
1. 개요
2. 화면 목록
3. 화면별 상세
   - 화면 기본 정보 (ID, 명, 메뉴 경로, 접근 권한)
   - 화면 레이아웃 (영역 구분 테이블)
   - 항목 정의 (No, 항목ID, 항목명, 영역, 유형, 필수, 길이, 기본값, 비고)
   - 기능버튼 정의 (No, 버튼명, 위치, 동작설명, 권한, 활성조건, 비고)
   - 화면 전환 흐름

**자동 추출:** page.tsx JSX 구조, DataGrid columns, FilterPanel, Button 컴포넌트
**대화 보완:** 컬럼 순서/너비, 셀 편집 여부, 조건부 표시, 버튼 활성/비활성 조건, 연쇄 동작

### 6.3 기능설계서 (func-design)

**목차:**
1. 개요
2. 기능 목록
3. 기능별 상세
   - 기능 기본 정보 (ID, 명, 유형)
   - 입력 데이터 (파라미터, 타입, 필수 여부)
   - 처리 로직 (순서대로 기술)
   - 출력 데이터 (응답 구조)
   - 유효성 검증 규칙
   - 예외 처리
4. API 명세 (HTTP 메서드, URL, Request/Response)

**자동 추출:** 컨트롤러 + 서비스 + DTO 분석
**대화 보완:** 업무 규칙 상세, 계산 로직, 트랜잭션 범위, 에러 코드

### 6.4 프로그램목록 (program-list)

**목차:**
1. 개요
2. 프로그램 목록

| No | 프로그램ID | 프로그램명 | 유형 | 화면파일 | 컨트롤러 | 서비스 | 비고 |
|---|---|---|---|---|---|---|---|
| 1 | PG-MAT-001 | 자재입고 | 화면 | receiving/page.tsx | arrival.controller.ts | arrival.service.ts | |

**자동 추출:** 프론트엔드 page 파일 ↔ 백엔드 컨트롤러 ↔ 서비스 파일 매핑 (완전 자동)
**대화 보완:** 배치/스케줄러 프로그램, 인터페이스 프로그램 등 화면 없는 프로그램 보완

### 6.5 추적표 (traceability)

**목차:**
1. 개요
2. 추적 매트릭스

| 요구사항ID | As-Is ID | Gap | To-Be ID | 기능ID | 관련 테이블 | 화면ID | I/F ID | 프로그램ID | 단위테스트ID | 통합테스트ID | 상태 |
|---|---|---|---|---|---|---|---|---|---|---|---|

**연결 흐름:**
```
현행시스템(As-Is) → Gap/개선점 → 요구사항 → To-Be 프로세스
→ 기능설계 → DB설계(테이블 N개) → 화면설계 → 인터페이스
→ 프로그램목록 → 단위테스트 → 통합테스트
```

**자동 추출:** 각 산출물 생성 시 부여된 ID 수집, 모듈 간 의존성으로 연결 추론
**대화 보완:** 누락 연결, N:M 매핑, As-Is→To-Be Gap 정의

## 7. 출력 경로

```
docs/deliverables/{모듈명}/{산출물유형}_{모듈명}_{날짜}.docx

예시:
docs/deliverables/material/DB설계서_material_2026-03-18.docx
docs/deliverables/material/화면설계서_material_2026-03-18.docx
docs/deliverables/production/기능설계서_production_2026-03-18.docx
```

## 8. 일괄 생성 시 순서

```
DB설계서 → 기능설계서 → 화면설계서 → 프로그램목록 → 추적표
```

앞 산출물에서 수집한 정보(테이블 목록, 기능 ID 등)를 뒤 산출물에 재활용하여 중복 질문을 줄임.

## 9. 스킬 디렉토리 구조

```
~/.claude/skills/mes-deliverable/
  SKILL.md                        # 메인 (워크플로우 + 분기 로직)
  references/
    deliverable-catalog.md        # 22종 산출물 정의/ID 체계
    extraction-guide.md           # 프레임워크별 자동 추출 방법
    traceability-guide.md         # 추적표 연결 구조
  templates/
    db-design.md                  # DB설계서 템플릿
    screen-design.md              # 화면설계서 템플릿
    func-design.md                # 기능설계서 템플릿
    program-list.md               # 프로그램목록 템플릿
    traceability.md               # 추적표 템플릿
```
