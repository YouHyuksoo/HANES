# FG 바코드 발행 타이밍 가변 설계

> 작성일: 2026-03-19 | 상태: 승인됨

## 1. 배경

FG 바코드(FG_BARCODE)는 현재 통전검사 PASS 시에만 발행된다. 그러나 현장 운영에서는:
- 배판작업 시 라벨을 즉시 발행하여 제품에 부착
- 작업지시 시점에 사전 일괄 발행하여 배포

등 가변적인 타이밍이 필요하다. 시스템 레벨 설정으로 발행 모드를 전환하여 모든 시나리오를 커버한다.

## 2. SysConfig 설정

```
KEY:     FG_BARCODE_ISSUE_TIMING
VALUES:  ON_INSPECT | ON_PRODUCTION | PRE_ISSUE
DEFAULT: ON_INSPECT
```

| 값 | 발행 시점 | 설명 |
|----|----------|------|
| `ON_INSPECT` | 통전검사 PASS 시 | 현재 동작 유지. 검사 합격 즉시 채번 |
| `ON_PRODUCTION` | 생산실적 등록 시 | 배판작업 완료 시점에 채번. 검사 전 라벨 부착 가능 |
| `PRE_ISSUE` | 작업지시 시작 시 | planQty 기준 일괄 채번. 작업 전 라벨 사전 배포 |

## 3. FG_LABELS 상태 전이

```
PENDING → ISSUED → VISUAL_PASS/FAIL → PACKED → SHIPPED
                                                  ↗
VOIDED (어느 단계에서든 취소 가능)
```

- `PENDING`: 사전 발행됨 (바코드 채번 완료, 통전검사 전)
- `ISSUED`: 통전검사 완료 (PASS 또는 FAIL 기록됨)
- `ON_INSPECT` 모드에서는 PENDING 단계 SKIP → 바로 ISSUED

### 엔티티 추가 필드

```
FG_LABELS 테이블:
  INSPECT_PASS_YN  VARCHAR2(1)  NULL  — 통전검사 결과 (Y/N/null=미검사)
```

FAIL 바코드는 폐기하지 않고 유지. 재작업 후 같은 바코드로 재검사 가능.

## 4. 모드별 동작 흐름

### 4.1 ON_INSPECT (기존 동작)

```
통전검사 PASS → 바코드 채번 → FG_LABELS INSERT (status=ISSUED, inspectPassYn=Y)
통전검사 FAIL → 바코드 없음 → JobOrder.defectQty += 1
```

변경 없음.

### 4.2 ON_PRODUCTION (배판작업 시 발행)

```
1. 생산실적 등록 (POST /production/prod-results)
   → 트랜잭션 내에서 바코드 채번
   → FG_LABELS INSERT (status=PENDING, inspectPassYn=null)
   → ProdResult.prdUid에 바코드 연결

2. 통전검사 (POST /quality/continuity-inspect/inspect)
   → 작업자가 제품의 바코드를 스캔
   → FG_LABELS UPDATE (status=ISSUED, inspectPassYn=Y 또는 N)
   → PASS → JobOrder.goodQty += 1
   → FAIL → JobOrder.defectQty += 1 (바코드 유지, 재검사 가능)
```

### 4.3 PRE_ISSUE (작업지시 시 일괄 발행)

```
1. 작업지시 시작 (POST /production/job-orders/:id/start)
   → planQty개 바코드 일괄 채번 (수량 조정 가능, 기본=planQty)
   → FG_LABELS 일괄 INSERT (status=PENDING)
   → 추가 발행 API로 부족분 보충 가능

2. 통전검사
   → ON_PRODUCTION과 동일 (바코드 스캔 → 매칭)
```

## 5. API 변경

### 5.1 기존 API 수정

| API | 변경 |
|-----|------|
| `POST /quality/continuity-inspect/inspect` | DTO에 `fgBarcode?` 추가. 모드 분기: ON_INSPECT=기존(채번), 나머지=스캔 바코드 매칭 |
| `POST /production/prod-results` | ON_PRODUCTION 모드 시 바코드 채번+PENDING 생성 |
| `POST /production/job-orders/:id/start` | PRE_ISSUE 모드 시 일괄 바코드 채번+PENDING 생성 |

### 5.2 신규 API

| API | 용도 | DTO |
|-----|------|-----|
| `POST /quality/continuity-inspect/pre-issue` | 수동 추가 발행 | `{ orderNo: string, qty?: number }` qty 미지정 시 planQty-기발행수 |
| `GET /quality/continuity-inspect/pending/:orderNo` | 미검사(PENDING) 바코드 목록 | - |
| `POST /quality/continuity-inspect/re-inspect/:fgBarcode` | FAIL 바코드 재검사 | `{ passYn: string }` |

## 6. 프론트엔드 변경

### 6.1 통전검사 페이지 (`/inspection/result`)

- 페이지 로드 시 SysConfig 조회 → 모드 분기
- `ON_INSPECT`: 기존 UI (PASS/FAIL 버튼)
- `ON_PRODUCTION`/`PRE_ISSUE`: **바코드 스캔 입력 필드** + PASS/FAIL 버튼 + 작업지시별 PENDING 목록

### 6.2 작업지시 페이지 (`/production/order`)

- `PRE_ISSUE` 모드: 작업지시 상세에 **"바코드 사전발행"** 버튼
- 수량 입력 모달 → `POST /quality/continuity-inspect/pre-issue`
- 발행된 PENDING 바코드 목록 표시

### 6.3 시스템 설정

- `FG_BARCODE_ISSUE_TIMING` ComCode 등록 (ON_INSPECT/ON_PRODUCTION/PRE_ISSUE)
- SysConfig 관리 화면에서 변경 가능

## 7. 통전검사 서비스 변경 핵심 로직

```typescript
async inspect(dto, company, plant) {
  const timing = await sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');

  if (timing === 'ON_INSPECT') {
    // 기존 로직: PASS 시 채번 + FG_LABELS INSERT(ISSUED)
  } else {
    // ON_PRODUCTION / PRE_ISSUE
    // dto.fgBarcode 필수 — 스캔된 바코드
    const label = await fgLabelRepo.findOne({ fgBarcode: dto.fgBarcode });
    if (!label || label.status !== 'PENDING') throw BadRequest;

    label.status = 'ISSUED';
    label.inspectPassYn = dto.passYn;
    label.inspectResultId = savedInspect.resultNo;
    await fgLabelRepo.save(label);

    if (dto.passYn === 'Y') jobOrder.goodQty += 1;
    else jobOrder.defectQty += 1;
  }
}
```

## 8. FAIL 재검사 흐름

```
1. 통전검사 FAIL → FG_LABELS (status=ISSUED, inspectPassYn=N)
2. 재작업 수행
3. POST /quality/continuity-inspect/re-inspect/:fgBarcode
   → 새 InspectResult 생성
   → FG_LABELS.inspectPassYn = Y (또는 다시 N)
   → PASS 시 JobOrder.goodQty += 1, defectQty -= 1
```

## 9. 구현 순서

1. FG_LABELS 엔티티에 `INSPECT_PASS_YN` 컬럼 추가 + DB DDL
2. SysConfig에 `FG_BARCODE_ISSUE_TIMING` 기본값 등록
3. ContinuityInspectService 모드 분기 로직
4. ProdResultService에 ON_PRODUCTION 바코드 발행 연계
5. JobOrderService에 PRE_ISSUE 일괄 발행 연계
6. 신규 API 3개 (pre-issue, pending, re-inspect)
7. 프론트엔드 통전검사 페이지 모드 분기 UI
8. 프론트엔드 작업지시 페이지 사전발행 버튼
