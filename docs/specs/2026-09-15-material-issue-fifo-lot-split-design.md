# 자재출고 FIFO 롯트 분할 출고 설계

작성일: 2026-09-15
대상 화면: `/material/issue` — 출고요청 기반 출고 모달
관련 문서: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md` (LOT 분할/병합 재설계)

## 1. 배경과 문제

현재 출고 모달(`apps/frontend/src/components/material/IssueFromRequestModal.tsx`)은
**요청 품목 1행 = 출고 LOT 1개**(`Select`) 구조다. 한 품목의 요청 수량을 한 롯트에서만
끌어올 수 있다.

현장 실제는 다르다. 선입선출(FIFO)을 지키려면 먼저 입고된 롯트부터 소진해야 하고,
그 롯트만으로 요청 수량이 채워지지 않으면 다음 롯트로 넘어가야 한다.

> 예: 선입 롯트 200, 후입 롯트 1000이 있고 900을 요청 → 200 + 700으로 나눠 출고하고
> 후입 롯트에 300이 남는다.

두 번째 문제는 **라벨**이다. 자재 라벨 ZPL의 `{{qty}}`는
`label-print.service.ts:125`에서 `lot.initQty`(입고 당시 수량)를 찍는다. 현재 재고가 아니다.
따라서 수량만 차감하는 부분 출고를 하면 창고에 남은 300짜리 물건에 "1000"이라 찍힌
라벨이 붙어 있게 된다. 현장에서 실물과 표시가 어긋난다.

## 2. 목표 / 비목표

### 목표

1. 한 요청 품목이 **여러 롯트에서 FIFO 순서로** 수량을 끌어올 수 있게 한다.
2. 롯트를 부분 사용해야 할 때 **실제 LOT 분할**(신규 시리얼 발번)을 수행하고
   **라벨 2장**(출고분 / 잔량분)을 발행해 각각 부착할 수 있게 한다.
3. 분할과 출고를 **2단계로 분리**해, 라벨을 붙이기 전에 재고가 움직이지 않게 한다.
4. `findAvailable`의 FIFO 정렬 결함을 제거한다.

### 비목표

- 백엔드 출고 계약(`POST /material/issue-requests/:requestNo/issue`) 변경. 현행 그대로 쓴다.
- 기존 LOT분할 화면(`/material/lot-split`)의 동작 변경.
- 스캔 출고 패널(`IssueScanPanel`)의 전량 출고 동작 변경.
- 라벨 템플릿 자체의 재설계.

## 3. 용어 정리 — "분할"의 두 의미

이 설계에서 "분할"은 두 가지를 뜻하므로 구분한다.

| 용어 | 의미 | 물리적 영향 |
|---|---|---|
| **수량 배분(allocation)** | 요청 수량을 FIFO 롯트들에 나눠 배정하는 계산 | 없음 (화면상 계산) |
| **LOT 분할(split)** | 원본 시리얼 폐기 → 신규 시리얼 2개 발번 → 라벨 2장 | 실물에 새 라벨 부착 |

요청 900을 200 + 700으로 나누는 것은 **배분**이고, 후입 롯트 1000을 700/300 두 시리얼로
쪼개는 것이 **LOT 분할**이다. 배분 결과 어떤 롯트를 **전량** 쓰면 그 롯트는 분할하지 않는다.
**부분만** 쓰는 롯트(대개 마지막 한 개)만 분할 대상이다.

## 4. 전체 흐름 (2단계)

```
[1단계] 배분 확정 → 분할 + 라벨 발행
  사용자가 좌측 요청 품목을 보며 우측 FIFO 롯트에 수량을 배분
      ↓
  [분할 및 라벨발행] 버튼
      ↓
  POST /material/issue-requests/:requestNo/split-for-issue
      · 부분 사용 롯트만 분할 (전량 사용 롯트는 건너뜀)
      · 한 트랜잭션에서 전 롯트 일괄 처리
      ↓
  MatLabelPreviewModal — 신규 시리얼 라벨 미리보기 → 프린터 출력

[현장] 라벨 2장을 출고분 / 잔량분에 각각 부착

[2단계] 출고
  모달이 롯트 목록을 재조회 (신규 시리얼이 FIFO 목록에 등장)
      ↓
  [출고] 버튼
      ↓
  POST /material/issue-requests/:requestNo/issue  ← 기존 API 그대로
      · 분할된 출고분 시리얼을 전량 출고
```

핵심 불변식: **1단계를 거치면 2단계의 모든 출고는 전량 출고**가 된다. 부분 소진은
분할이 불가능한 예외 케이스(§8)에서만 발생한다.

1단계와 2단계 사이에서 중단해도 안전하다. 분할된 시리얼은 창고에 그대로 남아 있고,
`createChildLot`이 `recvDate`를 계승하므로 다시 열면 같은 FIFO 위치에 나타난다.

## 5. 화면 설계

`Modal size="full"` 유지. 본문을 좌우 2단으로 나눈다.

### 5.1 좌측 — 요청 내역 (약 45%)

요청 품목 1행. 행 클릭 = 선택(우측과 연동).

| 컬럼 | 설명 |
|---|---|
| 품목코드 / 품목명 | |
| 요청 / 기출고 / 잔여 | 기존과 동일 |
| 실출고수량 | `roundUpToPack(잔여, minPackQty)` — 포장단위 올림 |
| 배분합계 | 우측에서 배분한 수량의 합 |
| 부족 | `실출고수량 - 배분합계` (> 0이면 붉게) |
| 상태 | 배분완료 / 부족 / 분할필요 / 분할완료 |

### 5.2 우측 — 선택 품목의 FIFO 롯트 (약 55%)

입고일 오름차순 롯트 테이블.

| 컬럼 | 설명 |
|---|---|
| # | FIFO 순번. 1번 행에 `선입` 뱃지 |
| matUid | 시리얼 |
| 창고 | |
| 입고일 | FIFO 기준 |
| 가용 | `availableQty` |
| 배분수량 | 공통 `QtyInput` (천단위 표시) |
| 잔량 | `가용 - 배분수량`. > 0이고 배분수량 > 0이면 `분할` 뱃지 |

상단 액션: `[FIFO 자동배분]` / `[배분 초기화]`.

자동배분은 모달 진입 시 **전 품목에 대해 1회 자동 수행**한다. 사용자가 특정 품목의
롯트 수량을 직접 수정하면 그 품목은 `수동` 으로 고정되어 이후 자동배분이 덮어쓰지 않는다.

### 5.3 하단

총 출고수량, 미배분/부족 요약, 그리고 단계에 따라 `[분할 및 라벨발행]` 또는 `[출고]`.
분할 대상이 하나도 없으면 1단계를 건너뛰고 바로 `[출고]`를 노출한다.

## 6. 배분 규칙 — 공통 패키지 단일 출처

`packages/shared/src/issue-allocation-rules.ts` 신설. 프론트가 호출하는 순수 함수다.

```ts
export interface FifoLot {
  matUid: string;
  availableQty: number;
  recvDate: string | null;
}

export interface AllocationSlice {
  matUid: string;
  qty: number;
}

export interface AllocationResult {
  slices: AllocationSlice[];
  allocatedQty: number;
  /** 가용 재고로 채우지 못한 수량 */
  shortageQty: number;
}

/** 요청 총량을 FIFO(입고일 오름차순) 롯트에 앞에서부터 채운다. */
export function allocateFifo(totalQty: number, lots: FifoLot[]): AllocationResult;
```

규칙:

1. `totalQty = roundUpToPack(요청잔여, minPackQty)` — **총량만** 포장단위 올림.
   롯트 조각은 임의 수량을 허용한다.
2. 롯트를 입고일 오름차순으로 순회하며 `min(남은 총량, lot.availableQty)`씩 채운다.
3. 다 채우지 못하면 `shortageQty`로 반환한다. 출고는 차단하지 않는다(§9).
4. **`qty === 0`인 조각은 반환하지 않는다.** `RequestIssueItemDto.issueQty`가
   `@IsInt() @Min(1)`이라 0이 섞이면 요청 전체가 400으로 거절된다.

`roundUpToPack`도 같은 파일로 승격한다. 현재 모달과
`issue-request.service.ts`에 각각 구현되어 있다.

> 빌드 순서 주의: `packages/shared` 편집 후 `pnpm --filter @harness/shared build`를
> 먼저 돌려야 FE/BE typecheck가 새 export를 본다.

## 7. 백엔드 — 분할 오케스트레이션 API

### 7.1 신규 엔드포인트

```
POST /material/issue-requests/:requestNo/split-for-issue
```

요청:

```jsonc
{
  "splits": [
    { "sourceMatUid": "VH1-RM260703-00004", "issueQty": 700 }
  ],
  "remark": "출고요청 MR-... 분할"
}
```

응답: 기존 `LotSplitService.split()` 반환 형태를 합성한다.

```jsonc
{
  "splits": [
    {
      "sourceMatUid": "VH1-RM260703-00004",
      "itemCode": "TKEG1WFSCD",
      "itemName": "...",
      "arrivalNo": "...",
      "results": [
        { "matUid": "VH1-RM260915-00001", "qty": 700 },  // 출고분
        { "matUid": "VH1-RM260915-00002", "qty": 300 }   // 잔량분
      ],
      "label": { "arrivalNo": "...", "serials": [ /* 자식 2건 */ ] }
    }
  ]
}
```

`results[0]`이 출고분, `results[1]`이 잔량분이다(`split()`의 `pieces = [splitQty, remainQty]`
순서를 그대로 따른다).

라벨 데이터는 **원본 롯트별로 분리해서** 내려준다. 하나로 합치지 않는다 — 미리보기
컴포넌트가 단일 `arrivalNo` / `itemName`만 받기 때문이다(§10.1).

### 7.2 단일 트랜잭션 요구

여러 롯트를 한 번에 분할하므로 **전부 성공 아니면 전부 롤백**이어야 한다. 5개 중 3번째가
실패했는데 앞의 2개만 쪼개져 라벨 없이 남는 상황을 만들면 안 된다.

현재 `LotSplitService.split()`은 자체적으로 `this.tx.run`을 연다. `MatIssueService`가
`create` / `createInTx`로 분리해 둔 것과 동일하게 **`splitInTx(queryRunner, ...)` 추출**이
필요하다. 이 리팩터링은 부수 작업이 아니라 이 설계의 필수 항목이다.

- `split(dto, ...)` → `this.tx.run(qr => this.splitInTx(qr, dto, ...))` 로 축소
- 기존 LOT분할 화면 호출부는 `split()`을 그대로 쓰므로 영향 없음

### 7.3 출고 경로 한정 차단 해제

`lot-split.service.ts:186-193`은 출고 이력이 있는 롯트의 분할을 막는다.

```ts
if (issueHistories.some((issue) => issue.status !== 'CANCELED')) {
  throw new BadRequestException('이미 자재출고 이력이 있는 LOT는 분할할 수 없습니다. ...');
}
```

`splitInTx`에 `allowIssuedSource?: boolean` 옵션을 추가해 **출고 경로에서만** 이 검사를
건너뛴다. 기존 LOT분할 화면 경로는 기본값(`false`)이라 동작이 바뀌지 않는다.

이유는 레거시 데이터 정리가 아니다. **새 흐름 자체에 필요**하다. 요청 잔량이 남아 다음 날
이어서 출고하는 경우, 전날 분할로 생긴 잔량 시리얼에 출고 이력이 붙는 순간 그 시리얼은
영영 재분할이 불가능해진다. 즉 이 검사를 그대로 두면 **분할 출고가 롯트당 1회로 제한된다.**

기술적 성립 근거:

- 분할은 `initQty`가 아니라 **현재고(`sourceStock.qty`)**를 두 조각으로 나눈다(`:210-211`).
  부분 소진 롯트도 남은 수량 기준으로 정확히 쪼개진다.
- 입고완료 게이트(`assertReceived`, `:295-308`)는 `RECEIVE / LOT_SPLIT_IN / LOT_MERGE_IN`
  수불 합계만 본다. 출고는 이 합계를 줄이지 않으므로 부분 소진 롯트도 통과한다.
- 자식 시리얼은 `initQty = 조각수량`이고 `LOT_SPLIT_IN`도 같은 수량이므로, 자식의
  재분할 역시 게이트를 통과한다.
- 과거 출고 이력이 가리키는 원본 시리얼은 `status='SPLIT'`으로 남고, `origin` 컬럼
  계승으로 추적이 유지된다.

### 7.4 실측 확인 (2026-09-15, JSHANES)

| 항목 | 건수 |
|---|---|
| 재고 보유(QTY>0) 행 | 186 |
| 그중 출고 이력 보유(=분할 차단 대상) | 67 |
| `ITEM_MASTERS.IS_SPLITTABLE = 'N'` 품목 | 0 |
| 예약수량(`RESERVED_QTY > 0`) 보유 재고 | 0 |

67건을 실제로 조회한 결과 `10000 입고 → 9998 출고, 잔량 2` 형태가 모두 같은 날
(2026-07-03) 1회 출고로 찍혀 있다. 운영상의 부분 소진이 아니라 시드 데이터 소진 흔적이다.
`IS_SPLITTABLE='N'`과 예약 건이 0이므로, 실무에서 걸리는 차단 사유는 §7.3 하나뿐이다.

## 8. FIFO 정렬 결함 수정 — 이 설계의 전제

`mat-stock.service.ts:236-293`의 `findAvailable`은 DB에서 **`updatedAt DESC`로 먼저
페이징**(`skip`/`take`)한 뒤, 가져온 페이지만 메모리에서 `recvDate` 오름차순 정렬한다.
즉 FIFO가 페이지 안에서만 성립한다. 품목 재고행이 `limit`을 넘으면 정작 가장 오래된
롯트가 페이지 밖으로 밀린다.

이 설계에서는 단순한 정리 항목이 아니라 **기능을 깨뜨리는 결함**이다. 분할로 생긴 자식
시리얼은 `recvDate`는 옛날 것을 계승하지만 `updatedAt`은 방금 시각이다. 따라서 분할할
때마다 자식이 DB 페이지 맨 앞으로 올라오고, 손대지 않은 오래된 롯트는 뒤로 밀린다.
분할 출고를 쓸수록 FIFO가 망가진다.

수정: `MAT_LOTS`를 조인해 **`RECV_DATE ASC NULLS LAST`를 DB `ORDER BY`로 내린다.**
메모리 정렬은 제거한다.

`findAvailable`의 다른 호출부(스캔 출고 경로 등)가 순서에 의존하는지 함께 확인한다.

## 9. 예외 처리

| 상황 | 동작 |
|---|---|
| 가용 재고 < 요청 실출고수량 | 가용 전량 배분 + `부족 N` 배너. 출고는 허용하고 요청은 `PARTIAL`로 남는다 |
| 분할 불가 롯트 (`IS_SPLITTABLE='N'`, 예약 보유, 입고 미완료) | 그 롯트만 분할 없이 현행 방식으로 부분 출고. 우측에 `분할불가 · 라벨수량 불일치` 경고 배너. 출고는 막지 않는다 |
| 1단계 후 모달 닫음 | 분할 시리얼은 창고에 남는다. 재진입 시 FIFO 목록에 정상 노출(`recvDate` 계승) |
| 1단계 중 일부 롯트 분할 실패 | 트랜잭션 전체 롤백. 아무것도 쪼개지지 않음 |
| 2단계에서 재고 변동 | 2단계는 **클라이언트 메모리 상태를 재생하지 않는다.** 모달이 롯트 목록을 재조회한 뒤 그 결과로 `items[]`를 구성한다 |

## 10. 라벨 발행

`split()` 반환값에 이미 `label.serials[{ matUid, initQty, arrivalSeq, itemCode }]` 형태가
들어 있다(`lot-split.service.ts:277-288`). 라벨의 `{{qty}}`는 자식 시리얼의
`initQty`(= 조각 수량)이므로, 700짜리 라벨과 300짜리 라벨이 실물과 정확히 일치한다.

### 10.1 기존 미리보기 컴포넌트의 제약

`MatLabelPreviewModal`
(`apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx`)은
**한 번에 한 입하건만** 받는다. `data`는 단일 `arrivalNo` + `serials` 배열이고,
`itemName` / `mfgPartnerLabel` / `receivedDate`도 모달 전체에 하나씩 적용되는 단일 값이다.

출고 모달은 **여러 품목의 여러 롯트를 동시에 분할**할 수 있으므로, 분할 결과를 하나의
`data`로 합성할 수 없다. 품목이 다르면 `itemName`이 다르고, 입하건이 다르면 `arrivalNo`가
다르다.

### 10.2 대응

1. 분할 결과를 **원본 롯트 단위로 그룹**으로 나눈다. 한 그룹 = 원본 롯트 1개에서 나온
   자식 2개 = 라벨 2장. 그룹은 `itemCode` / `itemName` / `arrivalNo`가 단일하게 정해진다.
2. `MatLabelPreviewModal`을 `components/material/`로 이동해 route 폴더 밖에서도
   재사용할 수 있게 한다. props 시그니처는 바꾸지 않는다(입하 화면 회귀 없음).
3. 그룹이 여러 개면 **순차 표시**한다. `1 / 3` 진행 표시와 함께 한 그룹 출력 후 다음 그룹으로
   넘어간다. 그룹이 하나면 지금과 동일한 단발 모달이다.

사용자가 미리보기를 확인한 뒤 프린터를 골라 출력한다. 자동 출력은 하지 않는다.
출력 실패나 건너뜀이 있어도 **분할은 이미 커밋되어 있다.** 따라서 좌측 요청 행의
`분할완료` 상태에서 `[라벨 재출력]`을 항상 제공해, 분할 결과를 다시 불러 뽑을 수 있어야 한다.

## 11. 테스트

**단위 (`allocateFifo`)** — 구현 전에 작성한다.

- 첫 롯트로 정확히 채워짐 → 조각 1개
- 첫 롯트 부족 → 2개 롯트 분할 (200 + 700 = 900 시나리오)
- 전 롯트로도 부족 → `shortageQty` 반환
- `qty=0` 조각이 결과에 포함되지 않음
- 포장단위 올림이 총량에만 적용되고 조각에는 적용되지 않음
- 롯트 목록이 비어 있음 → 빈 결과 + 전량 부족

**백엔드**

- `splitInTx` 다건 중 하나 실패 시 전체 롤백
- `allowIssuedSource=true`에서 출고 이력 롯트 분할 성공
- `allowIssuedSource` 기본값에서 기존 차단 유지 (기존 spec 회귀)
- 자식 시리얼 재분할이 `assertReceived`를 통과
- `findAvailable`이 `recvDate` 오름차순으로 반환 (페이징 경계 포함)

**프론트 구조 테스트** — 기존 `issue-from-request-modal-contract.structure.test.mjs` 패턴을 따른다.

- 같은 `requestItemId`로 복수 `items` 엔트리를 전송
- 좌우 2단 구조와 선택 연동
- 분할 대상 없으면 1단계 버튼을 노출하지 않음
- 분할 결과가 원본 롯트별 그룹으로 나뉘어 라벨 미리보기에 순차 전달됨
- `분할완료` 상태에서 `[라벨 재출력]`이 노출됨

## 12. 손댈 파일

| 파일 | 변경 |
|---|---|
| `packages/shared/src/issue-allocation-rules.ts` | 신규 — `allocateFifo`, `roundUpToPack` |
| `packages/shared/src/index.ts` | export 추가 |
| `apps/backend/.../services/lot-split.service.ts` | `splitInTx` 추출, `allowIssuedSource` 옵션 |
| `apps/backend/.../services/issue-request.service.ts` | `splitForIssue` 오케스트레이션 |
| `apps/backend/.../controllers/issue-request.controller.ts` | `POST :requestNo/split-for-issue` |
| `apps/backend/.../dto/issue-request.dto.ts` | `SplitForIssueDto` |
| `apps/backend/.../services/mat-stock.service.ts` | `findAvailable` FIFO를 DB ORDER BY로 |
| `apps/frontend/.../material/IssueFromRequestModal.tsx` | 2단 레이아웃 + 2단계 흐름으로 재작성 |
| `apps/frontend/.../material/issue-from-request/` | 신규 — 좌측 목록 / 우측 롯트 패널 분리 |
| `apps/frontend/.../material/arrival/components/MatLabelPreviewModal.tsx` | `components/material/`로 이동 (props 불변, 입하 화면 import 경로만 수정) |
| `apps/frontend/src/locales/{ko,en,zh,vi}.json` | 4개 동시 |

현재 모달이 480줄이므로 그대로 키우지 않고 하위 컴포넌트로 분리한다.

## 13. 발견했지만 범위 외

- `issue-request.service.ts`의 `roundUpToPack`이 모달과 중복 구현되어 있다. §6에서
  공통 패키지로 승격하지만, 백엔드 호출부를 공통 함수로 바꾸는 작업은 이번 범위에 넣지 않는다.
- `label-print.service.ts:125`가 `lot.initQty`를 찍는 구조 자체는 유지한다. 분할로 자식
  시리얼의 `initQty`가 곧 실수량이 되므로 이 설계의 목표는 달성된다.
