# 품질 관리계획 문서체계 설계

- 작성일: 2026-09-15
- 대상 메뉴: `QC_CONTROL_PLAN`
- 대상 경로: `/quality/control-plan`
- 원본 절차서: `C:\Users\hsyou\Downloads\QREKA-PR-025 관리계획서 작성 절차서 REV.00(L).pdf`
- 설계 상태: 사용자 승인

## 1. 목적

HANES 품질관리 카테고리에서 품목·프로젝트별 공정흐름도(PFD), PFMEA, Control Plan을 순서대로 작성하고 발행·개정·조회·출력·이력관리할 수 있는 통합 문서체계를 제공한다.

최종 출력은 QREKA-PR-025 절차서에 포함된 네 가지 양식의 구조와 용지 규격을 따른다.

1. 공정흐름도: `QREKA-PR-025-01`, A4 가로
2. PFMEA: `QREKA-PR-025-02`, A3 가로
3. Control Plan 이력: `QREKA-PR-025-03`, A4 세로
4. Control Plan: `QREKA-PR-025-04`, A3 가로

## 2. 원본 절차서 분석

### 2.1 업무 목적과 적용범위

- FMEA 사전활동에서 파악한 제품·공정 특별특성과 관리항목을 Control Plan에 반영한다.
- 시작품(Prototype), 선행양산(Pre Launch), 양산(Production) 단계에 적용한다.
- 최초 작성 후 제품·공정·공정능력·검사방법·검사주기 변경 시 지속적으로 개정한다.
- 기록은 품질부서가 관리하고 단종 시까지 보관한 뒤 10년 보존한다.

### 2.2 문서 작성 순서

```text
공정흐름도(PFD) → PFMEA → Control Plan → 작업지도서
```

PFD의 공정순서를 PFMEA로 전환하고, PFMEA에서 합의한 관리요구사항을 Control Plan에 빠짐없이 연결해야 한다.

### 2.3 개정 발생 조건

- 제품 또는 공정 변경
- 공정 불안정
- 공정능력 부족
- 검사방법 또는 검사주기 변경
- 개발·생산 과정에서 새 관리항목 추가 또는 삭제 필요

### 2.4 원본 문서의 표기 불일치

파일명과 표지·개정이력에는 `REV.00`이 표시되지만 절차서 본문 2~11페이지 머리글에는 개정번호 `01`이 표시된다. 시스템에서는 다음 두 값을 분리한다.

- 양식 버전: 출력 템플릿 자체의 버전(예: `QREKA-PR-025-04 REV.00`)
- 업무 문서 Revision: 실제 품목별 Control Plan의 개정번호(예: `CP-20260915-001 REV.02`)

## 3. 범위

### 3.1 포함

- PFD, PFMEA, Control Plan 통합 문서함
- 빈 문서 작성과 HANES 기준정보 기반 자동 초안
- 문서별 독립 Revision 및 문서 간 참조 Revision 고정
- 작성중, 발행, 구버전 상태와 개정 복제
- 발행 전 문서 간 정합성 검사
- Revision 비교와 개정이력 자동 생성
- PDF 미리보기·저장·직접 인쇄
- 동일 데이터의 Excel 출력
- 기존 `CONTROL_PLANS`, `CONTROL_PLAN_ITEMS` 이관과 호환 전환
- 품질 추적성 및 PPAP에서 발행 문서 참조

### 3.2 제외

- 전자결재 및 결재선
- 검토자·승인자의 승인 상태 전이
- 자유 배치 방식의 PFD 도형 캔버스
- 발행본 직접 수정 또는 삭제
- 원본 절차서 자체의 관리·개정 기능

## 4. 사용자 작업 흐름

```text
문서 묶음 생성
  → 품목·프로젝트·단계 선택
  → 기준정보에서 PFD 초안 생성 또는 빈 문서 시작
  → PFD 작성
  → PFD 공정으로 PFMEA 행 생성
  → PFMEA 관리항목을 Control Plan으로 연결
  → 정합성 검사
  → 발행
  → PDF·Excel·인쇄
  → 변경 필요 시 개정 생성
  → 직전 발행본 복제 후 수정·재발행
```

## 5. 화면 설계

기존 `/quality/control-plan`을 새 메뉴로 대체하지 않고 통합 작업공간으로 확장한다.

### 5.1 레이아웃

- 왼쪽 문서함: 품목·프로젝트별 문서 묶음, PFD/PFMEA/Control Plan의 현재 REV와 상태
- 상단 액션: 신규, 기존문서 이관, 자동 초안, 개정 생성, 발행, PDF, Excel, 인쇄
- 본문 탭: 기본정보, PFD, PFMEA, Control Plan, 개정이력, 출력센터

### 5.2 기본정보

- 고객, 프로젝트, 품목번호, 품목명
- 적용단계: `PROTOTYPE`, `PRE_LAUNCH`, `PRODUCTION`
- 회사, 공장, 조직·사이트
- Key Contact
- CFT 참여자 목록
- 최초 발행일, 최근 개정일, 최근 변경수준
- 연결된 작업지도서

품목·고객·회사·공장·사용자·공정·설비는 기존 기준정보를 선택한다. 코드성 값을 자유입력으로 우회하지 않는다.

### 5.3 PFD 편집기

행 기반 편집을 사용하고 시스템이 흐름선을 자동 배치한다.

- 공정번호와 공정명
- 공정흐름 구분: 부공정, 주공정, 외주
- 공정기호: 작업, 검사, 이동, 보관, 지연, 재작업, 격리, 출하
- 제품 특별특성
- 공정 특별특성
- 비고
- 행 순서 변경

자동 초안은 품목 라우팅과 공정마스터에서 생성하며 사용자가 행을 추가·수정할 수 있다.

### 5.4 PFMEA 편집기

PFD 공정을 참조해 다음 필드를 관리한다.

- 공정단계, 공정기능, 요구사항
- 잠재적 고장형태와 영향
- 심각도, 특별특성 분류
- 잠재적 원인
- 현 예방관리, 발생도
- 현 검출관리, 검출도
- RPN 자동계산
- 권고조치
- 책임조직·담당자·목표일
- 완료조치·완료일
- 조치 후 심각도·발생도·검출도·RPN

### 5.5 Control Plan 편집기

원문 양식의 머리정보와 관리항목을 빠짐없이 지원한다.

머리정보:

- Document No., REV No., Issue Date, Revision Date
- Customer, Project Name, Part No., Part Name
- Latest Change Level, Phase Covered, Organization/Site
- Key Contact, CFT/Area Responsible, Prepared by/Date
- `Verified by/Date`, `Approved by/Date`는 결재 제외에 따라 `-` 출력
- 고객 기술승인, 고객 품질승인, 기타승인은 필요 여부와 참조정보만 관리하고 기본 `N/A`

관리항목:

- Process No.
- Process flow: Sub, Main, Out Sourcing
- Process Name
- Machines/Jigs/Fixtures/Tools
- Characteristic No.
- Product Characteristic
- Process Characteristic
- Special Characteristics
- Specification/Tolerance
- Evaluation/Measurement Technique
- Sample Size, Frequency
- Control Method/Error Proofing
- Contact: 생산 `P`, 품질 `Q`, 공동 `P/Q`
- Corrective Action
- Document/Record

### 5.6 개정이력과 비교

- 문서번호별 모든 Revision을 시간순으로 표시한다.
- Revision, 제·개정 내용, 개정일자, 담당자를 자동 출력한다.
- 두 Revision을 선택해 머리정보와 행의 추가·삭제·변경을 비교한다.
- 발행·개정·출력·다운로드 이벤트는 감사로그에 기록한다.

## 6. 문서와 Revision 모델

### 6.1 논리 구조

```text
QUALITY_PLAN_PACKAGES
 ├─ PROCESS_FLOW_DOCUMENTS
 │    └─ PROCESS_FLOW_REVISIONS
 │         └─ PROCESS_FLOW_ROWS
 ├─ PFMEA_DOCUMENTS
 │    └─ PFMEA_REVISIONS
 │         └─ PFMEA_ROWS
 └─ CONTROL_PLAN_DOCUMENTS
      └─ CONTROL_PLAN_REVISIONS
           ├─ CONTROL_PLAN_ROWS
           └─ CONTROL_PLAN_PARTICIPANTS
```

실제 구현 시 공통 필드를 중복 테이블로 만들지 않도록 `QUALITY_PLAN_DOCUMENTS`와 `QUALITY_PLAN_REVISIONS` 공통 부모를 두고 문서 유형별 행 테이블을 연결하는 구조를 우선한다.

### 6.2 키와 테넌트

- 물리 ID는 Oracle `SEQUENCE.NEXTVAL`을 사용한다.
- 업무 문서번호는 문서 유형별 `NumberingService` 규칙으로 생성한다.
- 신규 자동채번 예: `PFD-YYYYMMDD-NNN`, `PFMEA-YYYYMMDD-NNN`, `CP-YYYYMMDD-NNN`
- 기존 문서 이관은 문서번호 직접입력을 허용하되 중복과 tenant를 검증한다.
- `COMPANY`, `PLANT_CD`가 있는 PK/FK는 tenant 범위를 포함한다.

### 6.3 상태와 불변성

```text
DRAFT ──발행──> PUBLISHED
  ▲                 │
  └── 새 REV 복제 ──┘

이전 발행본: SUPERSEDED
```

- 신규 문서는 `REV.00 / DRAFT`로 시작한다.
- 발행본과 하위 행은 수정·삭제할 수 없다.
- 같은 문서에는 DRAFT Revision을 하나만 허용한다.
- 새 REV 발행이 완료된 후에만 직전 발행본을 `SUPERSEDED`로 변경한다.
- 개정 작업을 취소하거나 실패하면 직전 발행본은 계속 유효하다.
- PFD/PFMEA/Control Plan은 독립적으로 개정한다.
- PFMEA Revision은 참조한 PFD Revision을 고정한다.
- Control Plan Revision은 참조한 PFD와 PFMEA Revision을 고정한다.

### 6.4 변경 감지

참조 PFD 또는 PFMEA에 새 발행본이 생기면 연결된 Control Plan에 변경 경고를 표시한다. 기존 Control Plan 발행본은 자동 변경하지 않으며 새 Control Plan Revision에서만 참조 Revision을 갱신한다.

## 7. API 설계

```text
GET/POST  /quality/plan-packages
GET/PUT   /quality/plan-packages/:packageId
POST      /quality/plan-packages/:packageId/generate-draft

GET/POST  /quality/process-flow-documents
GET/POST  /quality/pfmea-documents
GET/POST  /quality/control-plan-documents

GET       /quality/documents/:documentId/revisions
GET/PUT   /quality/revisions/:revisionId
POST      /quality/revisions/:revisionId/validate
POST      /quality/revisions/:revisionId/publish
POST      /quality/revisions/:revisionId/create-revision
DELETE    /quality/revisions/:revisionId
GET       /quality/revisions/:revisionId/compare/:otherRevisionId
GET       /quality/revisions/:revisionId/export?format=pdf|xlsx
```

- Controller는 인증·tenant·DTO 처리만 담당한다.
- 문서 종류별 행 규칙은 독립 서비스로 분리한다.
- Revision 생성·발행·불변성은 공통 `QualityDocumentRevisionService`가 담당한다.
- 자동 초안 생성은 `QualityPlanDraftGenerator`가 기존 기준정보를 읽어 생성한다.
- 발행 검증은 `QualityPlanValidationService`가 PFD/PFMEA/Control Plan 공통 결과를 반환한다.
- 저장, 복제, 발행 상태 변경은 트랜잭션으로 실행한다.
- 회사·공장·작성자·REV는 요청 본문을 신뢰하지 않고 서버에서 정한다.

## 8. 발행 검증

### 8.1 발행 차단

- PFD 공정번호 중복 또는 공정순서 누락
- PFMEA 공정이 PFD에 없음
- 심각도·발생도·검출도가 1~10 범위 밖
- RPN 계산 불일치
- PFMEA 특별특성이 Control Plan에 연결되지 않음
- Control Plan 공정번호·공정명이 PFD와 불일치
- 규격, 측정방법, 관리방법 또는 반응계획 누락
- 샘플 크기가 100%인데 검사주기가 입력됨
- REV.01 이상인데 개정사유 또는 제·개정 내용 누락
- 같은 품목·단계의 유효 발행본 중복
- 다른 tenant 기준정보 참조

### 8.2 경고 후 발행 가능

- PFD에 재작업·부적합 격리·출하 공정 없음
- PFMEA RPN 100 이상인데 권고조치 없음
- 심각도 8 이상인데 특별특성 미지정
- 측정장비 검교정 또는 MSA/R&R 확인 불가
- 최신이 아닌 PFD/PFMEA Revision 참조
- 작업지도서 또는 기록양식 미연결

### 8.3 특별특성

- `★`: 법규·안전 특별특성
- `◈`: 기능·외관·장착성 특별특성
- 화면에는 기호와 텍스트 설명을 함께 표시한다.
- 기존 `CC`, `SC`, `HI`는 운영 매핑 확인 후 신규 공통코드로 이관한다.

## 9. 출력 설계

### 9.1 공통 출력 모델

화면과 출력에서 같은 데이터를 사용하도록 `DocumentPrintModel`을 둔다. 출력 템플릿은 편집 UI와 분리해 화면 디자인 변경이 공식 양식에 영향을 주지 않게 한다.

### 9.2 PDF

- 기존 `jsPDF 4.2.0`, `jspdf-autotable 5.0.7`을 사용한다.
- `NotoSansKR-Regular.ttf`를 VFS에 등록하고 `Identity-H`로 출력한다.
- `styles`, `headStyles`, `bodyStyles`, `alternateRowStyles`, `didParseCell`에 동일 한글 폰트를 지정한다.
- 병합 셀, 공정별 행 병합, 반복 머리글, 페이지 번호, 특별특성 기호를 지원한다.
- `html2canvas`는 사용하지 않는다.
- 발행본 PDF는 Revision snapshot으로 생성해 이후 기준정보 변경의 영향을 받지 않게 한다.

### 9.3 Excel

- 기존 `xlsx` 라이브러리를 사용한다.
- PFD, PFMEA, Control Plan, 개정이력을 각각 Sheet로 출력한다.
- 원문에 대응하는 셀 병합, 열 너비, 행 높이, 반복 머리글, 인쇄영역을 설정한다.

### 9.4 직접 인쇄

- PDF 미리보기와 동일한 생성물을 사용한다.
- 문서별 A4/A3 용지와 방향을 고정한다.
- 여러 페이지일 때 컬럼 머리글을 반복하고 `현재 페이지 / 전체 페이지`를 출력한다.

## 10. 기존 기능 전환

현재 소스에는 `/quality/control-plan` 화면, `CONTROL_PLANS`, `CONTROL_PLAN_ITEMS`, `ControlPlanService`가 존재한다. 그러나 원문 머리정보·PFD·PFMEA·출력·개정사유·안정적인 문서 계보가 부족하고 프론트가 호출하는 항목 단위 API가 Controller에 없다.

전환 순서:

1. 신규 스키마와 API 추가
2. 기존 데이터를 신규 문서·Revision 구조로 변환하는 migration 작성
3. 기존 `planNo`와 신규 document/revision ID 매핑 보존
4. 통합 UI를 신규 API로 전환
5. 품질 추적성, PPAP 등 기존 소비자를 신규 발행본 조회로 전환
6. 구 API 참조가 없음을 확인할 때까지 호환 계층 유지
7. JSHANES pre-check, 적용, post-check
8. `python tools/generate_db_schema_doc.py`로 ERD 갱신

## 11. 오류 처리

- 저장 충돌 시 현재 서버 Revision을 다시 읽도록 안내한다.
- 발행 검증 오류는 문서 종류, 행 번호, 필드, 오류코드, 사용자 메시지를 반환한다.
- 사용자가 오류를 선택하면 해당 탭과 행으로 이동한다.
- 개정 복제 또는 발행 중 하나라도 실패하면 전체 트랜잭션을 롤백한다.
- PDF/Excel 생성 실패는 문서 상태를 변경하지 않는다.
- 예상 포트 3002, JSHANES, 출력 도구가 unavailable이면 다른 환경으로 우회하지 않고 실패를 기록한다.

## 12. 검증 전략

### 12.1 Backend

- 신규 생성, 임시저장, 발행, 개정 복제, 개정 취소
- 발행본 수정·삭제 차단
- 하나의 DRAFT Revision 제약과 동시 개정 경쟁
- tenant 격리
- 문서 간 Revision 연결
- 발행 검증 오류와 경고
- 트랜잭션 실패 롤백
- 기존 데이터 이관 전후 건수와 FK 무결성

### 12.2 Frontend

- route/page는 화면 조립만 담당하고 탭·컬럼·폼·서비스를 분리한다.
- 기준정보 선택, 자동 초안, 행 편집·정렬
- 검증 오류에서 대상 행 이동
- 발행본 읽기 전용
- Revision 비교
- 공식 양식 미리보기

### 12.3 출력

- PDF MediaBox의 실제 A4/A3 크기와 방향
- 한글과 `★`, `◈` 기호
- 행·열 병합
- 다중 페이지 반복 머리글과 페이지 번호
- PDF와 Excel의 값 일치
- 원본 PDF 양식과 주요 좌표·컬럼 순서의 시각 비교

### 12.4 실제 사용자 시나리오

포트 `3002`에서 다음 흐름을 검증한다.

1. 문서 묶음 생성
2. 기준정보 기반 초안 생성
3. PFD 수정
4. PFMEA 작성과 RPN 계산
5. Control Plan 연결
6. 의도적인 오류로 발행 차단 확인
7. 오류 수정 후 발행
8. REV.01 생성과 재발행
9. 이전 발행본 조회와 비교
10. 네 가지 공식 PDF, 통합 Excel, 직접 인쇄 확인

## 13. 완료 기준

- 사용자가 한 문서 묶음에서 PFD, PFMEA, Control Plan을 작성할 수 있다.
- 문서 간 공정과 관리항목의 추적성이 서버에서 검증된다.
- 발행본은 불변이고 새 Revision을 통해서만 변경된다.
- 이전 Revision과 변경사유를 조회·비교할 수 있다.
- 네 가지 공식 양식을 지정 용지와 방향으로 출력할 수 있다.
- 기존 관리계획 데이터와 품질 추적성 소비자가 유실 없이 전환된다.
- Backend focused test, Frontend typecheck, 포트 3002 브라우저 시나리오, JSHANES pre/post-check, 출력 시각검증이 모두 완료된다.

## 14. 승인된 결정

- 범위가 크더라도 PFD와 PFMEA를 포함한다.
- 최종 출력은 원본 절차서 양식을 따른다.
- 전자결재는 제외한다.
- `DRAFT → PUBLISHED → 새 REV` 발행 흐름은 유지한다.
- 신규 문서는 자동채번하고 기존 문서 이관 시 기존 번호를 허용한다.
- 기준정보 기반 자동 초안과 빈 양식 작성을 모두 제공한다.
- PDF, 직접 인쇄, Excel 출력을 제공한다.
- PFD는 행 기반 자동 배치 방식으로 구현한다.
- 기존 `/quality/control-plan`을 통합 문서 패키지형 화면으로 확장한다.
