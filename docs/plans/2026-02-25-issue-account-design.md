# 출고계정(Issue Account) 시스템 디자인

**날짜:** 2026-02-25
**상태:** 승인됨

## 목적

자재 불출 시 출고계정(양산, 불량, 샘플, 설계시작, 재고조정, 로스 등)을 필수 선택하도록 하여, 출고 목적별 추적 및 분석이 가능하도록 한다.

## 접근 방식

**ComCode 기반 동적 관리** — 기존 하드코딩된 `ISSUE_TYPE_VALUES` 상수를 제거하고, ComCode 테이블의 `ISSUE_TYPE` 그룹으로 전환한다. 프로젝트 규칙(ComCodeBadge + useComCodeOptions)에 부합하며, 관리자가 UI에서 계정을 추가/수정할 수 있다.

## 데이터 구조

### ComCode 그룹: `ISSUE_TYPE`

| code_value | code_name (ko) | code_name (en) | 정렬 |
|------------|-----------------|-----------------|------|
| PRODUCTION | 양산 | Production | 1 |
| DEFECT | 불량 | Defect | 2 |
| SAMPLE | 샘플 | Sample | 3 |
| DESIGN_START | 설계시작 | Design Start | 4 |
| ADJUSTMENT | 재고조정 | Adjustment | 5 |
| LOSS | 로스 | Loss | 6 |
| SUBCONTRACT | 외주 | Subcontract | 7 |
| SCRAP | 폐기 | Scrap | 8 |
| RETURN | 반품 | Return | 9 |
| ETC | 기타 | Etc | 10 |

### 데이터 마이그레이션

기존 데이터 변환:
- `PROD` → `PRODUCTION`
- `ADJ` → `ADJUSTMENT`
- `SUBCON` → `SUBCONTRACT`
- `SAMPLE` → 유지

## 백엔드 변경

### DTO (issueType 필수화)
- `CreateMatIssueDto`: `@IsOptional()` 제거 → `@IsNotEmpty()`
- `ScanIssueDto`: `@IsOptional()` 제거 → `@IsNotEmpty()`
- `CreateIssueRequestDto`: `issueType` 필드 추가 (필수)
- `MatIssueQueryDto`: 기존 필터 유지

### Service
- `MatIssueService.create()`: `issueType ?? 'PROD'` fallback 제거, DTO 값 그대로 사용
- `MatIssueService.scanIssue()`: 동일
- `IssueRequestService.create()`: issueType 저장
- `IssueRequestService.issueFromRequest()`: 요청의 issueType을 출고에 전달

### 상수 정리
- `shared/constants/com-code-values.ts`에서 `ISSUE_TYPE_VALUES` 제거 또는 deprecated 처리

### ComCode seed (Oracle DB — JSHANES 사이트)
- `COM_CODES` 단일 테이블에 MERGE INTO로 10개 코드값 삽입
- oracle-db 스킬로 실행

## 프론트엔드 변경

### 모든 출고 탭에 출고계정 드롭다운 추가

1. **수동출고 탭 (ManualIssueTab)**: 상단에 필수 드롭다운, 미선택 시 출고 버튼 비활성화
2. **바코드스캔 탭 (BarcodeScanTab)**: 스캔 입력 위에 드롭다운, 연속 스캔 시 선택값 유지
3. **출고요청처리 탭 (IssueRequestTab)**: 요청 생성 시 계정 선택, 출고 모달에서 표시
4. **출고이력 탭 (IssueHistoryTab)**: DataGrid에 ComCodeBadge 표시, 필터에 드롭다운 추가

### i18n
- ko, en, zh, vi 4개 파일에 관련 키 추가

## 적용 범위

모든 출고 방식(수동출고, 바코드스캔, 출고요청)에 출고계정 선택을 필수로 적용한다.
