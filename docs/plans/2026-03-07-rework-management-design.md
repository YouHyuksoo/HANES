# 재작업관리 설계 문서

> IATF 16949 8.7.1 "부적합 출력물의 관리" 준수
> 작성일: 2026-03-07

## 1. 개요

IATF 16949 8.7.1 기준에 따라 부적합품(불량 반제품)의 재작업 프로세스를 관리하는 모듈.
불량 발생 → 재작업 지시(2단계 승인) → 재작업 수행 → 재검사 → 최종 판정까지 전 과정을 추적.

## 2. 메뉴 구성

| 페이지 | 경로 | 코드 | 설명 |
|--------|------|------|------|
| 재작업 실적 입력 | `/quality/rework` | QC_REWORK | 불량품 재작업 등록, 2단계 승인, 작업내역 기록 |
| 재작업 후 검사 | `/quality/rework-inspect` | QC_REWORK_INSPECT | 재작업 완료 건에 대한 재검증 검사 실적 입력 |
| 재작업 현황 | `/quality/rework-history` | QC_REWORK_HISTORY | 재작업 이력 조회, 통계, 추적성 |

위치: 품질관리(Quality) 하위 메뉴

## 3. 상태 흐름 (2단계 승인)

```
REGISTERED (등록)
  -> QC_PENDING (품질승인대기)
    -> QC_APPROVED (품질승인) / QC_REJECTED (품질반려)
      -> PROD_PENDING (생산승인대기)
        -> APPROVED (생산승인) / PROD_REJECTED (생산반려)
          -> IN_PROGRESS (진행중)
            -> REWORK_DONE (재작업완료)
              -> INSPECT_PENDING (재검사대기)
                -> PASS (합격) / FAIL (불합격) / SCRAP (폐기)
```

## 4. 엔티티 설계

### 4.1 ReworkOrder (재작업 지시)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | number (SEQUENCE) | PK |
| reworkNo | string | 자동채번 (RW-YYYYMMDD-NNN) |
| defectLogId | number | DefectLog FK |
| itemCode | string | 품목코드 |
| prdUid | string | 제품 UID |
| reworkQty | number | 재작업 수량 |
| defectType | string | 불량유형 (ComCode: DEFECT_TYPE) |
| reworkMethod | string | 재작업 방법 (IATF: 승인된 방법) |
| status | string | 상태 (ComCode: REWORK_STATUS) |
| qcApproverCode | string | 품질 승인자 |
| qcApprovedAt | timestamp | 품질 승인일시 |
| qcRejectReason | string | 품질 반려사유 |
| prodApproverCode | string | 생산 승인자 |
| prodApprovedAt | timestamp | 생산 승인일시 |
| prodRejectReason | string | 생산 반려사유 |
| workerCode | string | 작업자 |
| lineCode | string | 라인 |
| equipCode | string | 설비 |
| startAt | timestamp | 작업 시작일시 |
| endAt | timestamp | 작업 종료일시 |
| resultQty | number | 결과 수량 |
| passQty | number | 합격 수량 |
| failQty | number | 불합격 수량 |
| isolationFlag | boolean | 격리 상태 (논리적) |
| remarks | string | 비고 |
| imageUrl | string | 이미지 URL |
| company | number | 회사 |
| plant | string | 사업장 |
| createdBy | string | 생성자 |
| updatedBy | string | 수정자 |
| createdAt | timestamp | 생성일시 |
| updatedAt | timestamp | 수정일시 |

### 4.2 ReworkInspect (재작업 후 검사)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | number (SEQUENCE) | PK |
| reworkOrderId | number | ReworkOrder FK |
| inspectorCode | string | 검사자 |
| inspectAt | timestamp | 검사일시 |
| inspectMethod | string | 검사방법 |
| inspectResult | string | 결과 (PASS/FAIL/SCRAP) |
| passQty | number | 합격수량 |
| failQty | number | 불합격수량 |
| defectDetail | string | 불합격 시 상세 |
| remarks | string | 비고 |
| imageUrl | string | 이미지 URL |
| company | number | 회사 |
| plant | string | 사업장 |
| createdBy | string | 생성자 |
| updatedBy | string | 수정자 |
| createdAt | timestamp | 생성일시 |
| updatedAt | timestamp | 수정일시 |

## 5. API 엔드포인트

### 5.1 재작업 지시

| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/reworks | 목록 조회 |
| GET | /quality/reworks/:id | 단건 조회 |
| POST | /quality/reworks | 등록 |
| PUT | /quality/reworks/:id | 수정 |
| PATCH | /quality/reworks/:id/qc-approve | 품질 승인/반려 |
| PATCH | /quality/reworks/:id/prod-approve | 생산 승인/반려 |
| PATCH | /quality/reworks/:id/start | 작업 시작 |
| PATCH | /quality/reworks/:id/complete | 작업 완료 |
| GET | /quality/reworks/stats | 통계 |

### 5.2 재작업 후 검사

| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/rework-inspects | 목록 (재검사 대기 건) |
| GET | /quality/rework-inspects/:id | 단건 조회 |
| POST | /quality/rework-inspects | 검사 결과 등록 |

## 6. 백엔드 구조

```
apps/backend/src/
  entities/
    rework-order.entity.ts
    rework-inspect.entity.ts
  modules/quality/
    controllers/
      rework.controller.ts
      rework-inspect.controller.ts
    services/
      rework.service.ts
      rework-inspect.service.ts
    dto/
      rework.dto.ts
      rework-inspect.dto.ts
```

## 7. 프론트엔드 구조

```
apps/frontend/src/app/(authenticated)/quality/
  rework/
    page.tsx                      # 재작업 실적 입력
    components/
      ReworkFormModal.tsx          # 등록/수정 모달
      ReworkApproveModal.tsx       # 승인/반려 모달
  rework-inspect/
    page.tsx                      # 재작업 후 검사
  rework-history/
    page.tsx                      # 재작업 현황 조회
```

## 8. 공통코드 (ComCode)

| 그룹코드 | 값 | 설명 |
|----------|-----|------|
| REWORK_STATUS | REGISTERED, QC_PENDING, QC_APPROVED, QC_REJECTED, PROD_PENDING, APPROVED, PROD_REJECTED, IN_PROGRESS, REWORK_DONE, INSPECT_PENDING, PASS, FAIL, SCRAP | 재작업 상태 |
| REWORK_METHOD | (현장 정의) | 재작업 방법 |
| INSPECT_RESULT | PASS, FAIL, SCRAP | 검사 결과 |

## 9. IATF 16949 대응

| 요구사항 | 구현 방식 |
|----------|----------|
| 승인된 방법으로 수행 | reworkMethod 필드 + 2단계 승인 (품질 -> 생산) |
| 재작업 후 재검증 | 별도 검사 페이지, REWORK_DONE -> INSPECT_PENDING 자동 전환 |
| 처리 결과 기록 유지 | 전 과정 이력 저장 + 재작업 현황 페이지 |
| 식별/격리/혼입방지 | isolationFlag + 상태 기반 논리적 격리 |
| 추적성 | DefectLog -> ReworkOrder -> ReworkInspect 연결 체인 |

## 10. i18n 키

4개 언어(ko, en, zh, vi) 동시 추가 필요:
- menu.quality.rework / reworkInspect / reworkHistory
- rework.title, rework.subtitle
- rework.status.*, rework.method, rework.qty
- rework.approve.qc, rework.approve.prod
- rework.inspect.title, rework.inspect.result
