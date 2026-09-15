# 자재출고 FIFO 롯트 분할 출고 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출고요청 모달에서 한 품목의 요청 수량을 FIFO 순서로 여러 롯트에 배분하고, 부분 사용 롯트는 실제 LOT 분할로 신규 시리얼 2개를 발번해 라벨 2장(출고분/잔량분)을 발행한 뒤 전량 출고한다.

**Architecture:** 배분 계산은 `@harness/shared`의 순수 함수(`allocateFifo`)를 단일 출처로 둔다. 백엔드는 기존 `LotSplitService.split()`을 `splitInTx`로 추출해 여러 롯트를 한 트랜잭션에 분할하는 신규 엔드포인트(`POST /material/issue-requests/:requestNo/split-for-issue`)를 만든다. 출고 자체는 기존 `POST :requestNo/issue` 계약을 그대로 쓴다(같은 `requestItemId`로 복수 엔트리 전송은 이미 백엔드가 합산 처리한다). 프론트는 모달을 좌(요청내역)/우(FIFO 롯트) 2단으로 재구성하고 분할 → 라벨 → 출고의 2단계 흐름을 만든다.

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js 15 + React, TanStack Table, i18next, Jest(백엔드), `node --test`(프론트 구조 테스트), pnpm 워크스페이스

**Spec:** `docs/specs/2026-09-15-material-issue-fifo-lot-split-design.md`

## Global Constraints

- 패키지 매니저는 `pnpm`. `npm` 금지.
- `packages/shared` 편집 후 반드시 `pnpm --filter @harness/shared build`를 먼저 실행해야 FE/BE typecheck가 새 export를 본다(앱 tsconfig가 `dist`를 해석한다).
- 프론트 dev 서버가 떠 있으면 `pnpm build` 금지. typecheck는 `pnpm.cmd run typecheck:frontend` / `typecheck:backend`.
- UI 문구는 `apps/frontend/src/locales/{ko,en,zh,vi}.json` **4개를 동시에** 수정한다. JSON에 UTF-8 BOM 금지.
- `alert()` / `confirm()` / `prompt()` 금지 — 모달 컴포넌트를 쓴다.
- 수량 입력은 `type="number"` 금지. 공통 `QtyInput`(`@/components/shared`)을 쓴다.
- `catch (error: unknown)` 형태를 유지하고 `as any`를 피한다.
- 브랜치를 따지 않고 `main`에 직접 커밋한다. `git add`는 **파일 단위**로 한다(디렉토리 단위 금지).
- `git push`는 사용자가 명시적으로 지시할 때만 한다.
- 커밋 메시지 끝에 다음 두 줄을 넣는다:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012o7RGekkuKQC1PzQYADSeo
  ```
  멀티라인 메시지는 임시파일 + `git commit -F`를 쓴다(Bash에서 `@'...'@` here-string 금지).

## 파일 구조

| 파일 | 책임 |
|---|---|
| `packages/shared/src/utils/issue-allocation-rules.ts` | 신규. FIFO 배분 계산 + 포장단위 올림. 순수 함수만 |
| `packages/shared/src/utils/index.ts` | 위 파일 re-export |
| `apps/backend/src/modules/material/issue-allocation-rules.spec.ts` | 신규. shared 배분 규칙 진리표 (기존 `mat-lot-rules.spec.ts`와 같은 위치 규칙) |
| `apps/backend/src/modules/material/services/lot-split.service.ts` | `splitInTx` 추출 + `allowIssuedSource` 옵션 |
| `apps/backend/src/modules/material/services/mat-stock.service.ts` | `findAvailable` FIFO를 DB `ORDER BY`로 |
| `apps/backend/src/modules/material/dto/issue-request.dto.ts` | `SplitForIssueItemDto`, `SplitForIssueDto` |
| `apps/backend/src/modules/material/services/issue-request.service.ts` | `splitForIssue` 오케스트레이션 |
| `apps/backend/src/modules/material/controllers/issue-request.controller.ts` | `POST :requestNo/split-for-issue` |
| `apps/backend/src/modules/material/lot/lot.module.ts` | `LotSplitService` export |
| `apps/backend/src/modules/material/issue/issue.module.ts` | `LotModule` import |
| `apps/frontend/src/components/material/MatLabelPreviewModal.tsx` | arrival 폴더에서 이동(재사용 가능하게) |
| `apps/frontend/src/components/material/issue-from-request/types.ts` | 모달 하위 공용 타입 |
| `apps/frontend/src/components/material/issue-from-request/RequestItemList.tsx` | 좌측 요청 품목 목록 |
| `apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx` | 우측 FIFO 롯트 배분 패널 |
| `apps/frontend/src/components/material/issue-from-request/SplitLabelSequence.tsx` | 분할 결과 라벨 순차 미리보기 |
| `apps/frontend/src/components/material/IssueFromRequestModal.tsx` | 2단 레이아웃 + 2단계 흐름 오케스트레이션 |

---

### Task 1: 공통 배분 규칙 (`allocateFifo`)

**Files:**
- Create: `packages/shared/src/utils/issue-allocation-rules.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Test: `apps/backend/src/modules/material/issue-allocation-rules.spec.ts`

**Interfaces:**
- Consumes: 없음 (최초 태스크)
- Produces:
  - `roundUpToPack(qty: number, minPackQty: number): number`
  - `interface FifoLot { matUid: string; availableQty: number }`
  - `interface AllocationSlice { matUid: string; qty: number }`
  - `interface AllocationResult { slices: AllocationSlice[]; allocatedQty: number; shortageQty: number }`
  - `allocateFifo(totalQty: number, lots: ReadonlyArray<FifoLot>): AllocationResult`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `apps/backend/src/modules/material/issue-allocation-rules.spec.ts`:

```ts
/**
 * @file src/modules/material/issue-allocation-rules.spec.ts
 * @description 자재출고 FIFO 배분 규칙(@harness/shared issue-allocation-rules) 진리표.
 * 출고 모달의 자동배분과 분할 대상 판정이 모두 이 함수를 본다.
 */
import { allocateFifo, roundUpToPack, type FifoLot } from '@harness/shared';

describe('roundUpToPack', () => {
  it('포장단위 배수로 올림한다', () => {
    expect(roundUpToPack(900, 100)).toBe(900);
    expect(roundUpToPack(901, 100)).toBe(1000);
  });

  it('포장단위가 0 이하이면 원값을 그대로 돌려준다', () => {
    expect(roundUpToPack(901, 0)).toBe(901);
    expect(roundUpToPack(901, -5)).toBe(901);
  });

  it('수량이 0 이하이면 원값을 그대로 돌려준다', () => {
    expect(roundUpToPack(0, 100)).toBe(0);
    expect(roundUpToPack(-3, 100)).toBe(-3);
  });
});

describe('allocateFifo', () => {
  const lots = (...pairs: Array<[string, number]>): FifoLot[] =>
    pairs.map(([matUid, availableQty]) => ({ matUid, availableQty }));

  it('첫 롯트로 정확히 채워지면 조각이 1개다', () => {
    const result = allocateFifo(200, lots(['A', 200], ['B', 1000]));
    expect(result.slices).toEqual([{ matUid: 'A', qty: 200 }]);
    expect(result.allocatedQty).toBe(200);
    expect(result.shortageQty).toBe(0);
  });

  it('첫 롯트가 부족하면 다음 롯트로 넘어가 분할한다 (200 + 700 = 900)', () => {
    const result = allocateFifo(900, lots(['A', 200], ['B', 1000]));
    expect(result.slices).toEqual([
      { matUid: 'A', qty: 200 },
      { matUid: 'B', qty: 700 },
    ]);
    expect(result.allocatedQty).toBe(900);
    expect(result.shortageQty).toBe(0);
  });

  it('전 롯트를 써도 모자라면 가용 전량을 배분하고 부족분을 돌려준다', () => {
    const result = allocateFifo(900, lots(['A', 200], ['B', 300]));
    expect(result.slices).toEqual([
      { matUid: 'A', qty: 200 },
      { matUid: 'B', qty: 300 },
    ]);
    expect(result.allocatedQty).toBe(500);
    expect(result.shortageQty).toBe(400);
  });

  it('가용 0인 롯트는 건너뛰고 qty=0 조각을 만들지 않는다', () => {
    const result = allocateFifo(100, lots(['A', 0], ['B', 100], ['C', 500]));
    expect(result.slices).toEqual([{ matUid: 'B', qty: 100 }]);
  });

  it('롯트가 없으면 전량 부족이다', () => {
    const result = allocateFifo(900, []);
    expect(result.slices).toEqual([]);
    expect(result.allocatedQty).toBe(0);
    expect(result.shortageQty).toBe(900);
  });

  it('총량이 0 이하면 아무것도 배분하지 않는다', () => {
    expect(allocateFifo(0, lots(['A', 100]))).toEqual({
      slices: [], allocatedQty: 0, shortageQty: 0,
    });
  });

  it('배열 순서를 FIFO로 신뢰하며 입력 배열을 변형하지 않는다', () => {
    const input = lots(['A', 200], ['B', 1000]);
    const snapshot = JSON.parse(JSON.stringify(input));
    allocateFifo(900, input);
    expect(input).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- issue-allocation-rules
```

Expected: FAIL — `allocateFifo` / `roundUpToPack` is not exported from `@harness/shared`

- [ ] **Step 3: 최소 구현 작성**

Create `packages/shared/src/utils/issue-allocation-rules.ts`:

```ts
/**
 * @file packages/shared/src/utils/issue-allocation-rules.ts
 * @description 자재출고 FIFO 배분 규칙 — 요청 수량을 선입선출 순서의 롯트에 나눠 배정한다.
 *
 * 단일 출처인 이유: 출고 모달의 자동배분, 분할 대상 판정(부분 사용 롯트만 분할),
 * 부족 수량 표시가 모두 같은 계산을 봐야 한다.
 *
 * 여기서 "배분"은 수량 계산일 뿐이며 실물 LOT 분할(신규 시리얼 발번)이 아니다.
 */

/** FIFO 배분 입력 롯트. 배열 순서가 곧 선입선출 순서다(호출부가 입고일 오름차순으로 넘긴다). */
export interface FifoLot {
  matUid: string;
  /** 출고 가능 수량(예약 제외) */
  availableQty: number;
}

/** 롯트 하나에 배정된 수량 */
export interface AllocationSlice {
  matUid: string;
  qty: number;
}

export interface AllocationResult {
  /** qty > 0 인 조각만 담긴다 — 백엔드 DTO 가 issueQty 를 @Min(1) 로 검증하기 때문 */
  slices: AllocationSlice[];
  allocatedQty: number;
  /** 가용 재고로 채우지 못한 수량 */
  shortageQty: number;
}

/**
 * 실출고수량 = 포장단위 배수로 올린 수량.
 * 포장단위(MIN_PACK_QTY)가 0 이하이거나 수량이 0 이하이면 원값을 그대로 돌려준다.
 */
export function roundUpToPack(qty: number, minPackQty: number): number {
  return minPackQty > 0 && qty > 0 ? Math.ceil(qty / minPackQty) * minPackQty : qty;
}

/**
 * 총 출고수량을 FIFO(입고일 오름차순) 롯트에 앞에서부터 채운다.
 *
 * - 각 롯트에서 min(남은 총량, availableQty) 만큼 가져간다.
 * - 가용 0 인 롯트와 결과적으로 0 이 되는 조각은 반환하지 않는다.
 * - 전 롯트로도 못 채우면 shortageQty 로 알린다(차단하지 않는다 — 부분출고 허용).
 */
export function allocateFifo(totalQty: number, lots: ReadonlyArray<FifoLot>): AllocationResult {
  if (!(totalQty > 0)) {
    return { slices: [], allocatedQty: 0, shortageQty: 0 };
  }

  const slices: AllocationSlice[] = [];
  let remaining = totalQty;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = lot.availableQty > 0 ? lot.availableQty : 0;
    if (available <= 0) continue;

    const qty = Math.min(remaining, available);
    slices.push({ matUid: lot.matUid, qty });
    remaining -= qty;
  }

  const allocatedQty = totalQty - remaining;
  return { slices, allocatedQty, shortageQty: remaining };
}
```

Modify `packages/shared/src/utils/index.ts` — 기존 export 목록 끝에 한 줄 추가:

```ts
export * from './inspect-measurement-spec';
export * from './issue-allocation-rules';
```

- [ ] **Step 4: shared 빌드 후 테스트 통과 확인**

```powershell
pnpm.cmd --filter @harness/shared build
pnpm.cmd --dir apps/backend run test:unit -- issue-allocation-rules
```

Expected: PASS — 10 tests

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/utils/issue-allocation-rules.ts packages/shared/src/utils/index.ts apps/backend/src/modules/material/issue-allocation-rules.spec.ts
git commit -F <임시 메시지 파일>
```

메시지:
```
feat(shared): 자재출고 FIFO 배분 규칙 allocateFifo 를 추가한다

요청 수량을 선입선출 롯트에 나눠 배정하는 순수 함수를 단일 출처로 만든다.
qty=0 조각은 반환하지 않는다 — 백엔드 DTO 가 issueQty 를 @Min(1) 로 검증한다.
```

---

### Task 2: `findAvailable` FIFO를 DB `ORDER BY`로 내리기

FIFO 정렬이 페이지 안에서만 성립하는 결함을 제거한다. 분할 자식 시리얼은 `recvDate`를 계승하지만 `updatedAt`은 방금 시각이므로, 현재 구조(`updatedAt DESC`로 페이징 후 메모리 정렬)에서는 분할할수록 FIFO가 망가진다.

**Files:**
- Modify: `apps/backend/src/modules/material/services/mat-stock.service.ts:236-293`
- Test: `apps/backend/src/modules/material/services/mat-stock.service.spec.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `findAvailable`이 `MAT_LOTS.RECV_DATE ASC NULLS LAST, MAT_UID ASC`로 정렬된 결과를 반환

- [ ] **Step 1: 현재 구현과 기존 테스트 확인**

```powershell
Get-Content apps/backend/src/modules/material/services/mat-stock.service.ts | Select-Object -Skip 235 -First 60
Select-String -Path apps/backend/src/modules/material/services/mat-stock.service.spec.ts -Pattern "findAvailable"
```

`mat-stock.service.spec.ts`는 이미 존재한다. `findAvailable` 관련 기존 테스트가 `matStockRepository.find`를 mock하고 있으면, Step 4에서 `createQueryBuilder`로 바뀌므로 그 테스트도 함께 고쳐야 한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`apps/backend/src/modules/material/services/mat-stock.service.spec.ts`에 다음 describe를 추가한다.

```ts
describe('findAvailable FIFO 정렬', () => {
  it('메모리 정렬이 아니라 DB ORDER BY 로 RECV_DATE 오름차순을 건다', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockMatStockRepo.createQueryBuilder.mockReturnValue(qb as never);

    await target.findAvailable({ page: 1, limit: 10, itemCode: 'ITEM-001' } as never, 'C1', 'P1');

    expect(qb.orderBy).toHaveBeenCalledWith('lot.RECV_DATE', 'ASC', 'NULLS LAST');
    expect(mockMatStockRepo.find).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- mat-stock.service
```

Expected: FAIL — `createQueryBuilder` was not called (현재 구현은 `repository.find`를 쓴다)

- [ ] **Step 4: 구현 — `find` 를 `createQueryBuilder` 로 교체**

`mat-stock.service.ts`의 `findAvailable` 앞부분(현재 `const stocks = await this.matStockRepository.find({...})`)을 다음으로 바꾼다.

```ts
    // FIFO(선입선출)는 DB ORDER BY 로 건다. 페이징 후 메모리 정렬하면 페이지 밖으로 밀린
    // 오래된 LOT 가 누락된다. 분할 자식 시리얼은 RECV_DATE 를 계승하지만 UPDATED_AT 은
    // 방금 시각이라, updatedAt 기준 페이징에서는 분할할수록 FIFO 가 무너진다.
    const qb = this.matStockRepository
      .createQueryBuilder('stock')
      .leftJoin(MatLot, 'lot', 'lot.MAT_UID = stock.MAT_UID')
      .where('stock.QTY > 0');
    if (itemCode) qb.andWhere('stock.ITEM_CODE = :itemCode', { itemCode });
    if (warehouseCode) qb.andWhere('stock.WAREHOUSE_CODE = :warehouseCode', { warehouseCode });
    if (company) qb.andWhere('stock.COMPANY = :company', { company });
    if (plant) qb.andWhere('stock.PLANT_CD = :plant', { plant });

    const stocks = await qb
      .orderBy('lot.RECV_DATE', 'ASC', 'NULLS LAST')
      .addOrderBy('stock.MAT_UID', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
```

그리고 함수 끝부분의 메모리 정렬 블록을 **삭제**한다:

```ts
    // FIFO(선입선출): 입고일(RECV_DATE) 오름차순, 입고일 미상(null)은 뒤로
    result.sort((a, b) => { ... });
```

`MatLot` import가 이미 있는지 확인하고 없으면 추가한다.

- [ ] **Step 5: 테스트 통과 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- mat-stock.service
pnpm.cmd run typecheck:backend
```

Expected: PASS

- [ ] **Step 6: 다른 호출부 확인**

```powershell
Select-String -Path apps/backend/src -Pattern "findAvailable" -Recurse
Select-String -Path apps/frontend/src -Pattern "stocks/available" -Recurse
```

순서에 의존하는 호출부(스캔 출고 경로 등)가 깨지지 않는지 확인한다. FIFO가 더 정확해지는 방향이므로 기대 동작이 바뀌는 곳은 없어야 한다. 있으면 해당 파일을 이 커밋에 함께 넣는다.

- [ ] **Step 7: 커밋**

메시지:
```
fix(material): 출고가능 재고 조회의 FIFO 정렬을 DB ORDER BY 로 내린다

updatedAt DESC 로 페이징한 뒤 메모리에서 recvDate 정렬을 하고 있어
FIFO 가 페이지 안에서만 성립했다. 재고행이 limit 을 넘으면 가장 오래된
LOT 이 페이지 밖으로 밀렸다.
```

---

### Task 3: `LotSplitService.splitInTx` 추출 + `allowIssuedSource` 옵션

여러 롯트를 한 트랜잭션에서 분할하려면 `split()`이 자체 `tx.run`을 여는 현재 구조를 바꿔야 한다. `MatIssueService`의 `create` / `createInTx` 분리와 같은 패턴이다.

**Files:**
- Modify: `apps/backend/src/modules/material/services/lot-split.service.ts:146-293`
- Modify: `apps/backend/src/modules/material/lot/lot.module.ts`
- Test: `apps/backend/src/modules/material/services/lot-split.service.spec.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface SplitOptions { allowIssuedSource?: boolean }`
  - `splitInTx(queryRunner: QueryRunner, dto: LotSplitDto, options?: SplitOptions, company?: string, plant?: string, userId?: string): Promise<SplitResult>`
  - `split(dto, company?, plant?, userId?)`은 시그니처 불변 — 내부적으로 `tx.run(qr => this.splitInTx(qr, dto, {}, company, plant, userId))`
  - `SplitResult` = 기존 `split()` 반환 형태 + `itemCode` / `itemName` / `arrivalNo` 최상위 필드 (이미 있음)
  - `LotModule`이 `LotSplitService`를 export

- [ ] **Step 1: 실패하는 테스트 작성**

`lot-split.service.spec.ts`에 추가:

```ts
  describe('splitInTx 옵션', () => {
    it('allowIssuedSource=true 이면 출고 이력이 있어도 현재고 기준으로 분할한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(sourceLot());
      mockQueryRunner.manager.findOne = jest.fn()
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock())
        .mockResolvedValueOnce(part());
      mockQueryRunner.manager.find = jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', status: 'DONE' } as MatIssue,
      ]);
      mockQueryRunner.manager.query = jest.fn().mockResolvedValue([{ RECVD: 10 }]);

      const result = await target.splitInTx(
        mockQueryRunner,
        { sourceLotId: 'MAT-001', splitQty: 7 },
        { allowIssuedSource: true },
        'C1', 'P1',
      );

      expect(result.results).toEqual([
        { matUid: 'NEW-1', qty: 7 },
        { matUid: 'NEW-2', qty: 3 },
      ]);
    });

    it('옵션 없이 호출하면 출고 이력 차단이 그대로 유지된다', async () => {
      mockQueryRunner.manager.findOne = jest.fn()
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock())
        .mockResolvedValueOnce(part());
      mockQueryRunner.manager.find = jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', status: 'DONE' } as MatIssue,
      ]);
      mockQueryRunner.manager.query = jest.fn().mockResolvedValue([{ RECVD: 10 }]);

      await expect(
        target.splitInTx(mockQueryRunner, { sourceLotId: 'MAT-001', splitQty: 7 }, {}, 'C1', 'P1'),
      ).rejects.toThrow('이미 자재출고 이력이 있는 LOT는 분할할 수 없습니다');
    });
  });
```

> 기존 `split()` 테스트는 그대로 둔다 — 시그니처가 바뀌지 않으므로 전부 통과해야 한다. 이것이 리팩터링의 회귀 안전망이다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- lot-split.service
```

Expected: FAIL — `target.splitInTx is not a function`

- [ ] **Step 3: 구현 — 본문 추출**

`lot-split.service.ts`에서 `split()`의 `return this.tx.run(async (queryRunner) => { ... })` **콜백 본문 전체를** 새 메서드로 옮긴다.

```ts
/** 분할 호출 옵션 — 출고 오케스트레이션 경로에서만 검사를 완화한다. */
export interface SplitOptions {
  /**
   * 출고 이력이 있는 원본의 분할을 허용한다(기본 false).
   *
   * 출고요청 분할 출고(split-for-issue)에서만 true 로 쓴다. 이 경로에서는 전날 분할로
   * 생긴 잔량 시리얼에 출고 이력이 붙는데, 검사를 그대로 두면 그 시리얼을 다시 쪼갤 수
   * 없어 분할 출고가 롯트당 1회로 제한된다.
   *
   * 안전한 이유: 분할은 initQty 가 아니라 현재고(sourceStock.qty)를 두 조각으로 나누고,
   * 입고완료 게이트는 출고와 무관한 RECEIVE 계열 수불 합계만 본다. 과거 출고 이력이
   * 가리키는 원본 시리얼은 status='SPLIT' 으로 남고 origin 계승으로 추적이 유지된다.
   */
  allowIssuedSource?: boolean;
}
```

`split()`은 이렇게 줄어든다:

```ts
  async split(dto: LotSplitDto, company?: string, plant?: string, userId?: string) {
    return this.tx.run((queryRunner) => this.splitInTx(queryRunner, dto, {}, company, plant, userId));
  }

  async splitInTx(
    queryRunner: QueryRunner,
    dto: LotSplitDto,
    options: SplitOptions = {},
    company?: string,
    plant?: string,
    userId?: string,
  ) {
    const { sourceLotId, splitQty, remark } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    // ... 기존 콜백 본문을 그대로 옮긴다 (1) 원본 조회 ~ (8) 신규 2조각 발번/생성/IN ...
  }
```

옮긴 본문에서 **출고이력 검증 블록만** 다음으로 바꾼다:

```ts
      // 4) 출고이력 검증 — 출고 오케스트레이션 경로(allowIssuedSource)에서는 건너뛴다
      if (!options.allowIssuedSource) {
        const issueHistories = await queryRunner.manager.find(MatIssue, {
          where: { matUid: sourceLotId, ...tenantWhere },
        });
        if (issueHistories.some((issue) => issue.status !== 'CANCELED')) {
          throw new BadRequestException(
            '이미 자재출고 이력이 있는 LOT는 분할할 수 없습니다. 자재출고부터 먼저 정리해 주세요.',
          );
        }
      }
```

반환 객체에 라벨 그룹 식별에 필요한 필드가 이미 있는지 확인한다(`itemCode`, `itemName`, `arrivalNo`, `label`). 이미 있으므로 추가 변경은 없다.

`lot.module.ts`의 `exports`를 고친다:

```ts
  exports: [MatLotService, LotSplitService],
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- lot-split.service
pnpm.cmd run typecheck:backend
```

Expected: PASS — 신규 2건 + 기존 `split()` 테스트 전부

- [ ] **Step 5: 커밋**

메시지:
```
refactor(material): LotSplitService 에 splitInTx 를 추출한다

여러 롯트를 한 트랜잭션에서 분할할 수 있게 MatIssueService 의 createInTx 와
같은 패턴으로 분리한다. split() 시그니처와 동작은 그대로다.
출고 오케스트레이션 전용 allowIssuedSource 옵션을 함께 넣는다.
```

---

### Task 4: `split-for-issue` 오케스트레이션 API

**Files:**
- Modify: `apps/backend/src/modules/material/dto/issue-request.dto.ts`
- Modify: `apps/backend/src/modules/material/services/issue-request.service.ts`
- Modify: `apps/backend/src/modules/material/controllers/issue-request.controller.ts`
- Modify: `apps/backend/src/modules/material/issue/issue.module.ts`
- Test: `apps/backend/src/modules/material/services/issue-request.service.spec.ts`

**Interfaces:**
- Consumes: Task 3의 `splitInTx(queryRunner, dto, options, company, plant, userId)`, `SplitOptions`
- Produces:
  - `POST /material/issue-requests/:requestNo/split-for-issue`
  - `splitForIssue(requestNo: string, dto: SplitForIssueDto, company?: string, plant?: string): Promise<{ splits: SplitGroup[] }>`
  - `SplitGroup` = `splitInTx` 반환값 + `sourceMatUid`

- [ ] **Step 1: DTO 작성**

`issue-request.dto.ts`의 `RequestIssueDto` 아래에 추가:

```ts
/** 출고 준비 분할 — 부분 사용 롯트 1건 */
export class SplitForIssueItemDto {
  @ApiProperty({ description: '분할할 원본 LOT 시리얼(MAT_UID)' })
  @IsString()
  sourceMatUid: string;

  @ApiProperty({ description: '출고분 수량. 원본 현재고보다 작아야 한다' })
  @IsInt()
  @Min(1)
  issueQty: number;
}

/** 출고요청 기반 출고 준비 분할 DTO */
export class SplitForIssueDto {
  @ApiProperty({ description: '분할 대상 목록', type: [SplitForIssueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitForIssueItemDto)
  splits: SplitForIssueItemDto[];

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`issue-request.service.spec.ts`에 추가:

```ts
  describe('splitForIssue', () => {
    it('모든 분할을 한 트랜잭션에서 처리하고 allowIssuedSource 로 호출한다', async () => {
      mockLotSplit.splitInTx
        .mockResolvedValueOnce({
          sourceLotNo: 'LOT-A', itemCode: 'ITEM-1', itemName: 'A', arrivalNo: 'AR-1',
          results: [{ matUid: 'NEW-1', qty: 700 }, { matUid: 'NEW-2', qty: 300 }],
          label: { arrivalNo: 'AR-1', serials: [] },
        } as never)
        .mockResolvedValueOnce({
          sourceLotNo: 'LOT-B', itemCode: 'ITEM-2', itemName: 'B', arrivalNo: 'AR-2',
          results: [{ matUid: 'NEW-3', qty: 50 }, { matUid: 'NEW-4', qty: 20 }],
          label: { arrivalNo: 'AR-2', serials: [] },
        } as never);

      const result = await target.splitForIssue('MR-1', {
        splits: [
          { sourceMatUid: 'LOT-A', issueQty: 700 },
          { sourceMatUid: 'LOT-B', issueQty: 50 },
        ],
      }, 'C1', 'P1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockLotSplit.splitInTx).toHaveBeenCalledTimes(2);
      expect(mockLotSplit.splitInTx).toHaveBeenCalledWith(
        mockQueryRunner,
        { sourceLotId: 'LOT-A', splitQty: 700, remark: expect.any(String) },
        { allowIssuedSource: true },
        'C1', 'P1', undefined,
      );
      expect(result.splits).toHaveLength(2);
      expect(result.splits[0].sourceMatUid).toBe('LOT-A');
    });

    it('중간 분할이 실패하면 예외를 그대로 올려 트랜잭션 전체를 롤백시킨다', async () => {
      mockLotSplit.splitInTx
        .mockResolvedValueOnce({ results: [], label: { serials: [] } } as never)
        .mockRejectedValueOnce(new BadRequestException('해당 품목은 분할할 수 없습니다.'));

      await expect(target.splitForIssue('MR-1', {
        splits: [
          { sourceMatUid: 'LOT-A', issueQty: 700 },
          { sourceMatUid: 'LOT-B', issueQty: 50 },
        ],
      }, 'C1', 'P1')).rejects.toThrow('해당 품목은 분할할 수 없습니다.');
    });

    it('APPROVED/PARTIAL 이 아닌 요청은 거절한다', async () => {
      mockRequestRepo.findOne.mockResolvedValue({
        requestNo: 'MR-1', status: 'COMPLETED', company: 'C1', plant: 'P1',
      } as never);

      await expect(target.splitForIssue('MR-1', {
        splits: [{ sourceMatUid: 'LOT-A', issueQty: 1 }],
      }, 'C1', 'P1')).rejects.toThrow('출고할 수 없는 상태입니다');
    });
  });
```

`describe` 상단 `beforeEach`에 `LotSplitService` mock을 추가한다:

```ts
    mockLotSplit = createMock<LotSplitService>();
    // providers 배열에 추가
    { provide: LotSplitService, useValue: mockLotSplit },
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- issue-request.service
```

Expected: FAIL — `target.splitForIssue is not a function`

- [ ] **Step 4: 서비스 구현**

`issue-request.service.ts` 생성자에 주입을 추가한다:

```ts
    private readonly matIssueService: MatIssueService,
    private readonly lotSplitService: LotSplitService,
```

`issueFromRequest` 위에 메서드를 추가한다:

```ts
  /**
   * 출고 준비 분할 — 부분 사용 롯트를 실물 분할해 출고분/잔량분 시리얼과 라벨을 만든다.
   *
   * 이 단계를 거치면 이어지는 출고(issueFromRequest)는 전부 전량 출고가 된다.
   * 여러 롯트를 한 트랜잭션으로 묶는다 — 일부만 쪼개져 라벨 없이 남는 상황을 막는다.
   */
  async splitForIssue(requestNo: string, dto: SplitForIssueDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'APPROVED' && request.status !== 'PARTIAL') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED/PARTIAL만 가능): ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const remark = dto.remark ?? `출고요청 ${request.requestNo} 출고 준비 분할`;

    return this.tx.run(async (queryRunner) => {
      const splits = [];
      for (const item of dto.splits) {
        const result = await this.lotSplitService.splitInTx(
          queryRunner,
          { sourceLotId: item.sourceMatUid, splitQty: item.issueQty, remark },
          { allowIssuedSource: true },
          effectiveCompany ?? undefined,
          effectivePlant ?? undefined,
          undefined,
        );
        splits.push({ sourceMatUid: item.sourceMatUid, ...result });
      }
      return { splits };
    });
  }
```

import에 `LotSplitService`와 `SplitForIssueDto`를 추가한다.

- [ ] **Step 5: 컨트롤러 + 모듈 배선**

`issue-request.controller.ts`의 `issueFromRequest` 위에 추가:

```ts
  @Post(':requestNo/split-for-issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출고 준비 분할 — 부분 사용 롯트를 출고분/잔량분으로 분할하고 라벨 데이터를 반환' })
  @ApiParam({ name: 'requestNo', description: '출고요청 번호' })
  async splitForIssue(
    @Param('requestNo') requestNo: string,
    @Body() dto: SplitForIssueDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.issueRequestService.splitForIssue(requestNo, dto, company, plant);
    return ResponseUtil.success(data, 'LOT이 분할되었습니다. 라벨을 출력해 부착하세요.');
  }
```

`issue.module.ts`에 `LotModule`을 import한다:

```ts
import { LotModule } from '../lot/lot.module';
// ...
  imports: [
    InventoryModule,
    SystemModule,
    LotModule,
    TypeOrmModule.forFeature([ /* 기존 그대로 */ ]),
  ],
```

- [ ] **Step 6: 테스트 + 타입체크 통과 확인**

```powershell
pnpm.cmd --dir apps/backend run test:unit -- issue-request.service
pnpm.cmd run typecheck:backend
```

Expected: PASS. 순환 의존(LotModule ↔ IssueModule)이 없어야 한다 — `LotModule`은 `IssueModule`을 import하지 않으므로 안전하다. 부팅 실패가 나면 순환이 생긴 것이니 멈추고 보고한다.

- [ ] **Step 7: 커밋**

메시지:
```
feat(material): 출고요청 출고 준비 분할 API 를 추가한다

POST /material/issue-requests/:requestNo/split-for-issue 로 부분 사용 롯트를
한 트랜잭션에서 일괄 분할하고 원본 롯트별 라벨 데이터를 돌려준다.
일부만 쪼개져 라벨 없이 남는 상황을 막기 위해 전부 성공 아니면 전부 롤백한다.
```

---

### Task 5: `MatLabelPreviewModal` 을 재사용 가능한 위치로 이동

**Files:**
- Move: `apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx` → `apps/frontend/src/components/material/MatLabelPreviewModal.tsx`
- Modify: import 경로를 쓰던 모든 파일
- Modify: `apps/frontend/src/components/material/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `import MatLabelPreviewModal from '@/components/material/MatLabelPreviewModal'` — **props 시그니처 불변**

- [ ] **Step 1: 현재 import 사용처 전수 조사**

```powershell
Select-String -Path apps/frontend/src -Pattern "MatLabelPreviewModal" -Recurse
```

결과를 전부 기록한다. 이동 후 남김없이 고쳐야 한다.

- [ ] **Step 2: 파일 이동**

```powershell
git mv "apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx" "apps/frontend/src/components/material/MatLabelPreviewModal.tsx"
```

- [ ] **Step 3: 이동된 파일 내부의 상대 import 수정**

원본은 route 폴더 기준 상대 경로를 쓴다. 다음 두 줄을 `@/` 절대 경로로 바꾼다:

```ts
// 변경 전
import { LabelDesign, createDefaultLabelDesign } from "../../../master/label/types";
import { LabelDesignRenderer, LabelPrintRenderer } from "../../../master/label/components/LabelDesignRenderer";
import type { PoLineReceiptResponse } from "./types";

// 변경 후
import { LabelDesign, createDefaultLabelDesign } from "@/app/(authenticated)/master/label/types";
import { LabelDesignRenderer, LabelPrintRenderer } from "@/app/(authenticated)/master/label/components/LabelDesignRenderer";
import type { PoLineReceiptResponse } from "@/app/(authenticated)/material/arrival/components/types";
```

- [ ] **Step 4: Step 1에서 찾은 호출부 import 경로 수정 + barrel export 추가**

`apps/frontend/src/components/material/index.ts`에 추가:

```ts
export { default as MatLabelPreviewModal } from './MatLabelPreviewModal';
```

- [ ] **Step 5: 타입체크로 잔여 참조 확인**

```powershell
pnpm.cmd run typecheck:frontend
```

Expected: PASS — 에러가 있으면 고치지 못한 import 경로가 남은 것이다.

- [ ] **Step 6: 커밋**

메시지:
```
refactor(frontend): MatLabelPreviewModal 을 components/material 로 옮긴다

출고 모달에서도 라벨 미리보기를 써야 해서 route 폴더 밖으로 꺼낸다.
props 시그니처는 그대로라 입하 화면 동작은 바뀌지 않는다.
```

---

### Task 6: 좌/우 2단 레이아웃 + FIFO 자동배분 (분할 없이 출고까지)

여기까지가 **동작하는 1차 완성본**이다. 분할 없이도 복수 롯트 배분 출고가 된다. 분할은 Task 7에서 얹는다.

**Files:**
- Create: `apps/frontend/src/components/material/issue-from-request/types.ts`
- Create: `apps/frontend/src/components/material/issue-from-request/RequestItemList.tsx`
- Create: `apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx`
- Modify: `apps/frontend/src/components/material/IssueFromRequestModal.tsx`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`
- Test: `apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `allocateFifo`, `roundUpToPack`, `FifoLot`, `AllocationSlice` (`@harness/shared`)
- Produces:
  - `types.ts`: `interface IssueRow`(기존 모달 정의를 이동), `interface AvailableStock`(기존 정의 이동), `type AllocationMap = Record<string, AllocationSlice[]>` (key = `IssueRow.rowKey`)
  - `RequestItemList` props: `{ rows: IssueRow[]; allocation: AllocationMap; selectedRowKey: string | null; onSelect: (rowKey: string) => void }`
  - `LotAllocationPanel` props: `{ row: IssueRow | null; lots: AvailableStock[]; slices: AllocationSlice[]; isLoading: boolean; onChange: (matUid: string, qty: number) => void; onAutoAllocate: () => void; onReset: () => void }`

- [ ] **Step 1: 실패하는 구조 테스트 작성**

Create `apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const panel = readFileSync('apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx', 'utf8');

test('출고 모달이 공통 FIFO 배분 규칙을 쓴다', () => {
  assert.match(modal, /allocateFifo/, '자체 배분 로직 대신 @harness/shared 의 allocateFifo 를 써야 한다');
  assert.match(modal, /from '@harness\/shared'/, 'allocateFifo 는 공통 패키지에서 import 해야 한다');
});

test('한 요청 품목이 여러 LOT 를 쓸 수 있다', () => {
  assert.equal(
    modal.includes('selectedMatUids'),
    false,
    '품목당 LOT 1개를 고르던 단일 선택 상태가 남아 있으면 안 된다',
  );
  assert.match(
    modal,
    /flatMap|\.map\([\s\S]{0,400}slices/,
    'items 페이로드는 품목별 slices 를 펼쳐 같은 requestItemId 로 복수 엔트리를 보내야 한다',
  );
  assert.match(
    modal,
    /requestItemId:\s*String\(/,
    'requestItemId 는 요청 품목 seq 문자열이어야 한다',
  );
});

test('qty=0 조각은 전송하지 않는다', () => {
  assert.match(
    modal,
    /qty\s*>\s*0/,
    'issueQty 는 @Min(1) 이므로 0 조각을 걸러야 한다',
  );
});

test('배분 수량 입력은 공통 QtyInput 을 쓴다', () => {
  assert.match(panel, /QtyInput/, '천단위 표시를 위해 공통 QtyInput 을 써야 한다');
  assert.equal(
    panel.includes('type="number"'),
    false,
    'type=number 는 천단위 구분 기호를 표시하지 못한다',
  );
});

test('우측 패널이 FIFO 순서와 입고일을 보여준다', () => {
  assert.match(panel, /recvDate/, '선입선출 판단 근거인 입고일을 표시해야 한다');
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```powershell
node --test apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs
```

Expected: FAIL — `LotAllocationPanel.tsx` 파일이 없어 `readFileSync`가 throw

- [ ] **Step 3: 공용 타입 파일 작성**

Create `apps/frontend/src/components/material/issue-from-request/types.ts`:

```ts
/**
 * @file components/material/issue-from-request/types.ts
 * @description 출고요청 출고 모달 하위 컴포넌트 공용 타입
 */
import type { AllocationSlice } from '@harness/shared';

/** 요청 상세의 품목 */
export interface RequestDetailItem {
  id: string;
  seq?: number;
  itemCode: string;
  itemName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
  /** 포장단위(최소 출고 단위) */
  minPackQty?: number;
  /** 출고 가능 재고(IQC 합격 또는 특채, 백엔드 집계) */
  issuableQty?: number;
  /** IQC 미검사(PENDING/HOLD) 재고(백엔드 집계) */
  pendingIqcQty?: number;
}

/** 출고 입력 행 */
export interface IssueRow extends RequestDetailItem {
  rowKey: string;
  seq: number;
  remainQty: number;
  /** 포장단위 올림 잔여 = 실출고수량(배분 목표) */
  packRemainQty: number;
}

export interface AvailableStock {
  id?: string;
  matUid: string;
  itemCode: string;
  warehouseCode: string;
  warehouseName?: string;
  availableQty?: number;
  qty?: number;
  unit?: string;
  /** 입고일(FIFO 선입선출 기준) */
  recvDate?: string | null;
}

/** 요청 품목(rowKey) → 롯트 배분 조각 목록 */
export type AllocationMap = Record<string, AllocationSlice[]>;

/** 롯트의 가용 수량 — availableQty 우선, 없으면 qty */
export const stockAvailableQty = (stock: AvailableStock): number =>
  stock.availableQty ?? stock.qty ?? 0;

/** 배분 합계 */
export const sumSlices = (slices: AllocationSlice[] | undefined): number =>
  (slices ?? []).reduce((sum, slice) => sum + slice.qty, 0);

/** 입고일 표시용 포맷 (YYYY-MM-DD) */
export const fmtRecvDate = (v?: string | null) => (v ? String(v).slice(0, 10) : '-');
```

- [ ] **Step 4: 좌측 목록 컴포넌트 작성**

Create `apps/frontend/src/components/material/issue-from-request/RequestItemList.tsx`:

```tsx
'use client';

/**
 * @file components/material/issue-from-request/RequestItemList.tsx
 * @description 출고 모달 좌측 — 요청 품목 목록. 행 클릭으로 우측 LOT 패널과 연동한다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { AllocationMap, IssueRow } from './types';
import { sumSlices } from './types';

interface Props {
  rows: IssueRow[];
  allocation: AllocationMap;
  selectedRowKey: string | null;
  onSelect: (rowKey: string) => void;
}

export default function RequestItemList({ rows, allocation, selectedRowKey, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden border border-border rounded-lg">
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-semibold text-text-muted">
          {t('material.issue.requestItems', { defaultValue: '요청 내역' })}
          <span className="ml-1 text-primary">({rows.length})</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
            <tr className="text-left text-text-muted">
              <th className="px-2 py-1.5">{t('common.partName', { defaultValue: '품목명' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.col.requestQty')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.issuedLabel')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.remainingLabel')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.targetQty', { defaultValue: '실출고' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.allocatedQty', { defaultValue: '배분' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.shortageQty', { defaultValue: '부족' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allocated = sumSlices(allocation[row.rowKey]);
              const shortage = row.packRemainQty - allocated;
              const isSelected = row.rowKey === selectedRowKey;
              return (
                <tr
                  key={row.rowKey}
                  onClick={() => onSelect(row.rowKey)}
                  className={`border-t border-border cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-text truncate">{row.itemName}</div>
                    <div className="font-mono text-[10px] text-text-muted truncate">{row.itemCode}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-text-muted whitespace-nowrap">
                    {row.requestQty.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right text-text-muted whitespace-nowrap">
                    {(row.issuedQty ?? 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right text-text whitespace-nowrap">
                    {row.remainQty.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-text whitespace-nowrap">
                    {row.packRemainQty.toLocaleString()} {row.unit}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-primary whitespace-nowrap">
                    {allocated.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {shortage > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {shortage.toLocaleString()}
                      </span>
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 inline-block" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 우측 배분 패널 작성**

Create `apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx`:

```tsx
'use client';

/**
 * @file components/material/issue-from-request/LotAllocationPanel.tsx
 * @description 출고 모달 우측 — 선택 품목의 FIFO(입고일 오름차순) LOT 배분 패널.
 *
 * 배분은 수량 계산이다. 실물 LOT 분할(신규 시리얼 발번)은 모달의 [분할 및 라벨발행] 단계에서 한다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Scissors, RotateCcw, Wand2 } from 'lucide-react';
import type { AllocationSlice } from '@harness/shared';
import { Button } from '@/components/ui';
import { QtyInput } from '@/components/shared';
import type { AvailableStock, IssueRow } from './types';
import { fmtRecvDate, stockAvailableQty } from './types';

interface Props {
  row: IssueRow | null;
  lots: AvailableStock[];
  slices: AllocationSlice[];
  isLoading: boolean;
  onChange: (matUid: string, qty: number) => void;
  onAutoAllocate: () => void;
  onReset: () => void;
}

export default function LotAllocationPanel({
  row, lots, slices, isLoading, onChange, onAutoAllocate, onReset,
}: Props) {
  const { t } = useTranslation();
  const qtyOf = (matUid: string) => slices.find((s) => s.matUid === matUid)?.qty ?? 0;

  if (!row) {
    return (
      <div className="h-full flex items-center justify-center border border-border rounded-lg text-xs text-text-muted">
        {t('material.issue.selectRequestItem', { defaultValue: '좌측에서 품목을 선택하세요.' })}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden border border-border rounded-lg">
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-semibold text-text truncate">
          {row.itemName}
          <span className="ml-1.5 font-normal text-text-muted">
            {t('material.issue.targetQty', { defaultValue: '실출고' })} {row.packRemainQty.toLocaleString()} {row.unit}
          </span>
        </span>
        <div className="ml-auto flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={onReset} className="h-7 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />
            {t('material.issue.resetAllocation', { defaultValue: '배분 초기화' })}
          </Button>
          <Button size="sm" onClick={onAutoAllocate} className="h-7 text-xs">
            <Wand2 className="w-3 h-3 mr-1" />
            {t('material.issue.autoAllocate', { defaultValue: 'FIFO 자동배분' })}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            {t('material.issue.lotLoading', { defaultValue: 'LOT 조회 중' })}
          </div>
        ) : lots.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 mx-auto mb-1" />
            {t('material.issue.noAvailableLot', { defaultValue: '출고 가능 LOT 없음 (창고재고 0)' })}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
              <tr className="text-left text-text-muted">
                <th className="px-2 py-1.5 w-8">#</th>
                <th className="px-2 py-1.5">{t('material.col.matUid', { defaultValue: 'LOT' })}</th>
                <th className="px-2 py-1.5">{t('material.col.recvDate', { defaultValue: '입고일' })}</th>
                <th className="px-2 py-1.5 text-right">{t('material.issue.availableQty', { defaultValue: '가용' })}</th>
                <th className="px-2 py-1.5 text-right w-32">{t('material.issue.allocateQty', { defaultValue: '배분수량' })}</th>
                <th className="px-2 py-1.5 text-right">{t('material.issue.lotRemainQty', { defaultValue: '잔량' })}</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, i) => {
                const available = stockAvailableQty(lot);
                const qty = qtyOf(lot.matUid);
                const lotRemain = available - qty;
                return (
                  <tr key={lot.matUid} className="border-t border-border">
                    <td className="px-2 py-1.5 text-text-muted">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="font-mono font-medium text-text truncate">{lot.matUid}</div>
                      <div className="text-[10px] text-text-muted truncate">
                        {lot.warehouseName ?? lot.warehouseCode}
                        {i === 0 && (
                          <span className="ml-1 px-1 rounded border border-primary/40 text-primary">
                            {t('material.issue.fifoFirst', { defaultValue: '선입' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">{fmtRecvDate(lot.recvDate)}</td>
                    <td className="px-2 py-1.5 text-right text-text whitespace-nowrap">{available.toLocaleString()}</td>
                    <td className="px-2 py-1.5">
                      <QtyInput
                        value={qty}
                        onChange={(next) => onChange(lot.matUid, next)}
                        maxValue={available}
                        className="text-right h-8"
                        fullWidth
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {qty > 0 && lotRemain > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Scissors className="w-3 h-3" />
                          {lotRemain.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-text-muted">{lotRemain.toLocaleString()}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 모달을 2단 구조로 재작성**

`IssueFromRequestModal.tsx`에서 다음을 바꾼다.

0. import를 다음으로 정리한다:

```tsx
import { isProductionIssueType, allocateFifo, roundUpToPack, type FifoLot } from '@harness/shared';
import RequestItemList from './issue-from-request/RequestItemList';
import LotAllocationPanel from './issue-from-request/LotAllocationPanel';
import type { AllocationMap, AvailableStock, IssueRow, RequestDetailItem } from './issue-from-request/types';
import { stockAvailableQty, sumSlices } from './issue-from-request/types';
```

1. `IssueRow` / `AvailableStock` / `RequestDetailItem` / `roundUpToPack` / `fmtRecvDate` 로컬 정의를 삭제한다. `roundUpToPack`은 `@harness/shared`에서 가져온다(`detail.items` → `issueRows` 변환에서 계속 쓴다). `DataGrid` / `ColumnDef` / `Select`(LOT 선택용) import도 쓰지 않으면 지운다.
2. `selectedMatUids` 상태와 `handleLotChange`를 **삭제**하고 `allocation` 상태로 바꾼다.
3. `columns` DataGrid 정의를 **삭제**하고 `RequestItemList` + `LotAllocationPanel` 2단으로 바꾼다.

상태와 핸들러:

```tsx
  const [allocation, setAllocation] = useState<AllocationMap>({});
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  /** 사용자가 직접 수량을 고친 품목 — 자동배분이 덮어쓰지 않는다 */
  const [manualRowKeys, setManualRowKeys] = useState<Set<string>>(new Set());

  /** 한 품목을 FIFO 자동배분한다 */
  const allocateRow = useCallback((row: IssueRow, stocks: AvailableStock[]) => {
    const fifoLots: FifoLot[] = stocks.map((stock) => ({
      matUid: stock.matUid,
      availableQty: stockAvailableQty(stock),
    }));
    return allocateFifo(row.packRemainQty, fifoLots).slices;
  }, []);

  /** 롯트별 배분수량 수동 변경 */
  const handleSliceChange = useCallback((rowKey: string, matUid: string, qty: number) => {
    setManualRowKeys((prev) => new Set(prev).add(rowKey));
    setAllocation((prev) => {
      const others = (prev[rowKey] ?? []).filter((slice) => slice.matUid !== matUid);
      const next = qty > 0 ? [...others, { matUid, qty }] : others;
      return { ...prev, [rowKey]: next };
    });
  }, []);
```

LOT 로딩 `useEffect`의 `setSelectedMatUids(...)` 블록을 자동배분으로 교체한다:

```tsx
        setAllocation((prev) => {
          const next = { ...prev };
          for (const row of issueRows) {
            if (manualRowKeys.has(row.rowKey)) continue;
            next[row.rowKey] = allocateRow(row, nextByItem[row.itemCode] ?? []);
          }
          return next;
        });
        setSelectedRowKey((prev) => prev ?? issueRows[0]?.rowKey ?? null);
```

제출 페이로드를 `slices`를 펼치는 형태로 바꾼다:

```tsx
      const items = issueRows.flatMap((row) =>
        (allocation[row.rowKey] ?? [])
          .filter((slice) => slice.qty > 0)
          .map((slice) => ({
            requestItemId: String(row.seq),
            matUid: slice.matUid,
            issueQty: slice.qty,
          })),
      );
      if (items.length === 0) return;
      const res = await api.post(`/material/issue-requests/${requestId}/issue`, {
        items,
        issueType,
        processCode: processCode || undefined,
      });
```

`totalIssueQty`를 배분 합계로 바꾼다:

```tsx
  const totalIssueQty = useMemo(
    () => issueRows.reduce((sum, row) => sum + sumSlices(allocation[row.rowKey]), 0),
    [issueRows, allocation],
  );
```

본문 레이아웃:

```tsx
        {/* 좌: 요청 내역 / 우: 선택 품목의 FIFO LOT 배분 */}
        <div className="flex gap-3 h-[420px]">
          <div className="w-[45%] min-w-0">
            <RequestItemList
              rows={issueRows}
              allocation={allocation}
              selectedRowKey={selectedRowKey}
              onSelect={setSelectedRowKey}
            />
          </div>
          <div className="flex-1 min-w-0">
            <LotAllocationPanel
              row={selectedRow}
              lots={selectedRow ? (availableStocksByItem[selectedRow.itemCode] ?? []) : []}
              slices={selectedRow ? (allocation[selectedRow.rowKey] ?? []) : []}
              isLoading={isLoadingLots}
              onChange={(matUid, qty) => selectedRow && handleSliceChange(selectedRow.rowKey, matUid, qty)}
              onAutoAllocate={() => {
                if (!selectedRow) return;
                setManualRowKeys((prev) => {
                  const next = new Set(prev);
                  next.delete(selectedRow.rowKey);
                  return next;
                });
                setAllocation((prev) => ({
                  ...prev,
                  [selectedRow.rowKey]: allocateRow(selectedRow, availableStocksByItem[selectedRow.itemCode] ?? []),
                }));
              }}
              onReset={() => {
                if (!selectedRow) return;
                setManualRowKeys((prev) => new Set(prev).add(selectedRow.rowKey));
                setAllocation((prev) => ({ ...prev, [selectedRow.rowKey]: [] }));
              }}
            />
          </div>
        </div>
```

`selectedRow`:

```tsx
  const selectedRow = useMemo(
    () => issueRows.find((row) => row.rowKey === selectedRowKey) ?? null,
    [issueRows, selectedRowKey],
  );
```

- [ ] **Step 7: i18n 4개 파일에 키 추가**

`ko.json`의 `material.issue` 아래에 추가하고, 같은 키를 `en.json` / `zh.json` / `vi.json`에도 넣는다.

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| `material.issue.requestItems` | 요청 내역 | Request Items | 请求明细 | Chi tiết yêu cầu |
| `material.issue.targetQty` | 실출고 | Target | 实际出库 | SL xuất |
| `material.issue.allocatedQty` | 배분 | Allocated | 已分配 | Đã phân bổ |
| `material.issue.shortageQty` | 부족 | Short | 不足 | Thiếu |
| `material.issue.selectRequestItem` | 좌측에서 품목을 선택하세요. | Select an item on the left. | 请在左侧选择品目。 | Chọn mặt hàng ở bên trái. |
| `material.issue.autoAllocate` | FIFO 자동배분 | Auto Allocate (FIFO) | FIFO 自动分配 | Tự phân bổ FIFO |
| `material.issue.resetAllocation` | 배분 초기화 | Reset | 重置分配 | Đặt lại |
| `material.issue.availableQty` | 가용 | Available | 可用 | Khả dụng |
| `material.issue.allocateQty` | 배분수량 | Allocate Qty | 分配数量 | SL phân bổ |
| `material.issue.lotRemainQty` | 잔량 | Remaining | 余量 | Còn lại |
| `material.issue.fifoFirst` | 선입 | First In | 先入 | Vào trước |
| `material.col.recvDate` | 입고일 | Received | 入库日 | Ngày nhập |

> `material.col.recvDate`는 2026-09-15 기준 **존재하지 않는다**(확인 완료). 다른 `recvDate` 키가
> 별도 경로에 있으니 혼동하지 말고 `material.col` 아래에 새로 넣는다.

BOM 없이 저장한다.

- [ ] **Step 8: 테스트 + 타입체크 통과 확인**

```powershell
node --test apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs
node --test apps/frontend/src/components/material/issue-from-request-modal-contract.structure.test.mjs
pnpm.cmd run typecheck:frontend
```

Expected:
- 신규 테스트 5건 PASS
- **기존 `issue-from-request-modal-contract.structure.test.mjs`는 `selectedMatUids`를 요구하므로 FAIL한다.** 그 단언 2개(`selectedMatUids`, `matUid: selectedMatUids[r.rowKey]`)를 새 구조에 맞게 고친다:

```js
  assert.match(
    source,
    /allocation\[row\.rowKey\]/,
    'modal should keep FIFO allocation slices per request item',
  );

  assert.match(
    source,
    /matUid:\s*slice\.matUid/,
    'payload must include each allocated lot matUid',
  );
```

나머지 단언(`/material/stocks/available`, `requestItemId`, `itemId: r.id` 부재)은 그대로 통과해야 한다.

- [ ] **Step 9: 커밋**

```bash
git add apps/frontend/src/components/material/issue-from-request/types.ts apps/frontend/src/components/material/issue-from-request/RequestItemList.tsx apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx apps/frontend/src/components/material/IssueFromRequestModal.tsx apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs apps/frontend/src/components/material/issue-from-request-modal-contract.structure.test.mjs apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F <임시 메시지 파일>
```

메시지:
```
feat(material): 출고 모달을 요청내역+FIFO 롯트 2단 구조로 바꾼다

한 요청 품목이 여러 LOT 에서 선입선출 순서로 수량을 끌어올 수 있게 한다.
요청 900, 선입 200 / 후입 1000 이면 200 + 700 으로 자동 배분한다.
배분 계산은 @harness/shared 의 allocateFifo 단일 출처를 쓴다.
```

---

### Task 7: 분할 + 라벨 발행 2단계 흐름

**Files:**
- Create: `apps/frontend/src/components/material/issue-from-request/SplitLabelSequence.tsx`
- Modify: `apps/frontend/src/components/material/IssueFromRequestModal.tsx`
- Modify: `apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`
- Test: `apps/frontend/src/components/material/issue-from-request-split-step.structure.test.mjs`

**Interfaces:**
- Consumes: Task 4의 `POST /material/issue-requests/:requestNo/split-for-issue`, Task 5의 `@/components/material/MatLabelPreviewModal`, Task 6의 `AllocationMap` / `AvailableStock`
- Produces:
  - `interface SplitGroup { sourceMatUid: string; itemCode: string; itemName: string; arrivalNo: string | null; results: Array<{ matUid: string; qty: number }>; label: { arrivalNo: string; serials: Array<{ matUid: string; initQty: number; arrivalSeq: number; itemCode: string }> } }`
  - `SplitLabelSequence` props: `{ groups: SplitGroup[]; onClose: () => void }`

- [ ] **Step 1: 실패하는 구조 테스트 작성**

Create `apps/frontend/src/components/material/issue-from-request-split-step.structure.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const sequence = readFileSync('apps/frontend/src/components/material/issue-from-request/SplitLabelSequence.tsx', 'utf8');

test('분할은 전용 엔드포인트를 호출한다', () => {
  assert.match(modal, /split-for-issue/, '분할은 출고 준비 전용 API 를 써야 한다');
});

test('부분 사용 롯트만 분할 대상이다', () => {
  assert.match(
    modal,
    /qty\s*<\s*available|available\s*>\s*slice\.qty/,
    '전량 사용 롯트는 분할하지 않아야 한다',
  );
});

test('분할 후에는 LOT 목록을 재조회한다', () => {
  assert.match(
    modal,
    /reloadLots|loadAvailableLots/,
    '분할로 생긴 신규 시리얼을 반영하려면 LOT 목록을 다시 읽어야 한다',
  );
  assert.equal(
    modal.includes('// 분할 결과를 그대로 출고 payload 로 재사용'),
    false,
    '2단계는 클라이언트 메모리 상태를 재생하지 않는다',
  );
});

test('라벨 미리보기는 원본 롯트별 그룹으로 순차 표시한다', () => {
  assert.match(sequence, /MatLabelPreviewModal/, '기존 라벨 미리보기 컴포넌트를 재사용해야 한다');
  assert.match(sequence, /groups\[/, '원본 롯트별 그룹을 순서대로 넘겨야 한다');
});

test('분할 완료 후 라벨 재출력이 가능하다', () => {
  assert.match(
    modal,
    /reprintLabel|splitGroups/,
    '출력 실패에 대비해 분할 결과를 보관하고 재출력할 수 있어야 한다',
  );
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```powershell
node --test apps/frontend/src/components/material/issue-from-request-split-step.structure.test.mjs
```

Expected: FAIL — `SplitLabelSequence.tsx` 파일이 없어 `readFileSync`가 throw

- [ ] **Step 3: 라벨 순차 표시 컴포넌트 작성**

Create `apps/frontend/src/components/material/issue-from-request/SplitLabelSequence.tsx`:

```tsx
'use client';

/**
 * @file components/material/issue-from-request/SplitLabelSequence.tsx
 * @description 분할 결과 라벨을 원본 LOT 그룹 단위로 순차 미리보기/출력한다.
 *
 * MatLabelPreviewModal 은 단일 arrivalNo / itemName 만 받으므로 여러 품목의 분할 결과를
 * 하나로 합칠 수 없다. 그래서 그룹을 하나씩 넘기고 진행 상황을 표시한다.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MatLabelPreviewModal from '@/components/material/MatLabelPreviewModal';

export interface SplitGroup {
  sourceMatUid: string;
  itemCode: string;
  itemName: string;
  arrivalNo: string | null;
  results: Array<{ matUid: string; qty: number }>;
  label: {
    arrivalNo: string;
    serials: Array<{ matUid: string; initQty: number; arrivalSeq: number; itemCode: string }>;
  };
}

interface Props {
  groups: SplitGroup[];
  onClose: () => void;
}

export default function SplitLabelSequence({ groups, onClose }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const group = groups[index];

  if (!group) return null;

  const handleClose = () => {
    if (index + 1 < groups.length) {
      setIndex(index + 1);
      return;
    }
    setIndex(0);
    onClose();
  };

  return (
    <MatLabelPreviewModal
      isOpen
      data={group.label as never}
      itemName={`${group.itemName} (${index + 1}/${groups.length})`}
      onClose={handleClose}
    />
  );
}
```

> `data` 는 `PoLineReceiptResponse` 타입을 기대한다. 백엔드 `label` 페이로드가 `arrivalNo` + `serials` 형태로 호환되므로 `as never` 로 넘긴다. 타입체크에서 막히면 `PoLineReceiptResponse` 에서 필요한 필드만 뽑은 좁은 타입을 `types.ts` 에 정의해 쓰고 `as never` 는 지운다.

- [ ] **Step 4: 모달에 2단계 흐름 추가**

`IssueFromRequestModal.tsx`에 import를 추가한다:

```tsx
import { Scissors, Printer } from 'lucide-react';
import SplitLabelSequence, { type SplitGroup } from './issue-from-request/SplitLabelSequence';
```

`SplitLabelSequence.tsx`는 `SplitGroup`을 named export 해야 한다(Step 3의 `export interface SplitGroup`).

분할 대상 계산:

```tsx
  /** 부분 사용 롯트만 분할 대상이다 — 전량 사용 롯트는 그대로 출고한다 */
  const splitTargets = useMemo(() => {
    const targets: Array<{ sourceMatUid: string; issueQty: number }> = [];
    for (const row of issueRows) {
      const stocks = availableStocksByItem[row.itemCode] ?? [];
      for (const slice of allocation[row.rowKey] ?? []) {
        const stock = stocks.find((s) => s.matUid === slice.matUid);
        if (!stock) continue;
        const available = stockAvailableQty(stock);
        if (slice.qty > 0 && slice.qty < available) {
          targets.push({ sourceMatUid: slice.matUid, issueQty: slice.qty });
        }
      }
    }
    return targets;
  }, [issueRows, allocation, availableStocksByItem]);
```

상태:

```tsx
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
```

Step 6의 LOT 로딩 `useEffect` 본문을 `reloadLots`라는 `useCallback`으로 꺼내 분할 후에도 다시 부를 수 있게 한다. `useEffect`는 `void reloadLots();`만 호출한다.

분할 핸들러:

```tsx
  const handleSplit = useCallback(async () => {
    if (splitTargets.length === 0) return;
    setIsSplitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/material/issue-requests/${requestId}/split-for-issue`, {
        splits: splitTargets,
      });
      const groups = (res.data?.data?.splits ?? []) as SplitGroup[];
      setSplitGroups(groups);
      setIsLabelOpen(true);
      // 분할로 생긴 신규 시리얼을 반영한다. 클라이언트 배분 상태는 버리고 다시 계산한다.
      setManualRowKeys(new Set());
      setAllocation({});
      await reloadLots();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || 'LOT 분할에 실패했습니다.');
    } finally {
      setIsSplitting(false);
    }
  }, [splitTargets, requestId, reloadLots]);
```

하단 버튼을 단계에 따라 바꾼다:

```tsx
            {splitTargets.length > 0 ? (
              <Button onClick={handleSplit} isLoading={isSplitting}>
                <Scissors className="w-4 h-4 mr-1" />
                {t('material.issue.splitAndPrint', { defaultValue: '분할 및 라벨발행' })}
                <span className="ml-1 opacity-70">({splitTargets.length})</span>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={totalIssueQty <= 0 || isLoadingLots || processMissing}
                disabledReason={/* 기존 그대로 */}
                isLoading={isSubmitting}
              >
                <Package className="w-4 h-4 mr-1" />
                {t('material.issue.issueAction')}
              </Button>
            )}
            {splitGroups.length > 0 && (
              <Button variant="secondary" onClick={() => setIsLabelOpen(true)}>
                <Printer className="w-4 h-4 mr-1" />
                {t('material.issue.reprintLabel', { defaultValue: '라벨 재출력' })}
              </Button>
            )}
```

모달 끝에 라벨 시퀀스를 붙인다:

```tsx
      {isLabelOpen && (
        <SplitLabelSequence groups={splitGroups} onClose={() => setIsLabelOpen(false)} />
      )}
```

- [ ] **Step 5: 우측 패널에 분할불가 경고 추가**

`LotAllocationPanel.tsx`의 잔량 셀 아래 또는 테이블 상단에, 분할이 막힌 롯트를 알리는 배너를 넣는다. 분할 실패는 서버가 판정하므로 프론트는 **분할 시도 실패 메시지**를 그대로 노출한다. 별도 사전 판정 로직은 만들지 않는다(추측성 폴백 금지).

`Props`에 `warning?: string | null`을 추가하고 헤더 아래에 렌더한다:

```tsx
      {warning && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 border-b border-border">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {warning}
        </div>
      )}
```

모달에서 `warning={errorMsg}`로 넘긴다.

- [ ] **Step 6: i18n 4개 파일에 키 추가**

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| `material.issue.splitAndPrint` | 분할 및 라벨발행 | Split & Print Labels | 分割并打印标签 | Tách & In nhãn |
| `material.issue.reprintLabel` | 라벨 재출력 | Reprint Labels | 重新打印标签 | In lại nhãn |
| `material.issue.splitNotice` | 분할 후 라벨 2장을 출고분과 잔량분에 각각 부착하세요. | Attach the two printed labels to the issued and remaining lots. | 分割后请将两张标签分别贴在出库分和余量分上。 | Dán hai nhãn lên phần xuất và phần còn lại. |

BOM 없이 저장한다.

- [ ] **Step 7: 테스트 + 타입체크 통과 확인**

```powershell
node --test apps/frontend/src/components/material/issue-from-request-split-step.structure.test.mjs
node --test apps/frontend/src/components/material/issue-from-request-multi-lot.structure.test.mjs
node --test apps/frontend/src/components/material/issue-from-request-modal-contract.structure.test.mjs
pnpm.cmd run typecheck:frontend
```

Expected: 전부 PASS

- [ ] **Step 8: 커밋**

메시지:
```
feat(material): 출고 전 LOT 분할과 라벨 2장 발행 단계를 추가한다

부분 사용 롯트를 출고분/잔량분 신규 시리얼로 쪼개고 라벨을 원본 롯트별로
순차 미리보기·출력한다. 라벨을 붙인 뒤 출고하도록 2단계로 나눈다.
분할 후에는 클라이언트 배분 상태를 버리고 LOT 목록을 재조회한다.
```

---

### Task 8: 전체 검증

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~7 전부
- Produces: 없음

- [ ] **Step 1: 백엔드 전체 테스트**

```powershell
pnpm.cmd run test:backend:ci
```

Expected: PASS. 실패가 있으면 이 계획의 변경이 원인인지 먼저 확인하고, 무관한 기존 실패면 그대로 보고한다.

- [ ] **Step 2: 타입체크 양쪽**

```powershell
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
```

Expected: PASS

- [ ] **Step 3: 프론트 구조 테스트 전체**

```powershell
node --test apps/frontend/src/components/material/*.structure.test.mjs
```

Expected: PASS

- [ ] **Step 4: i18n 누락 점검**

```powershell
node scripts/find_missing_i18n.js
```

Expected: 이번에 추가한 키가 4개 파일에 모두 있어야 한다. 빠진 게 있으면 `node scripts/apply_missing_i18n.js`로 채운다.

- [ ] **Step 5: 실화면 확인 (claude-in-chrome)**

`http://localhost:3002/material/issue`에서 승인된 출고요청의 출고 모달을 연다. 확인 항목:

1. 좌측에 요청 품목, 우측에 선택 품목의 FIFO 롯트가 뜨는가
2. 모달 진입 시 자동 배분되어 있는가
3. 여러 롯트가 있는 품목에서 첫 롯트 소진 후 다음 롯트로 넘어가 나뉘는가
4. 부분 사용 롯트가 있으면 `[분할 및 라벨발행]`이 뜨고, 없으면 `[출고]`가 바로 뜨는가
5. 분할 후 라벨 미리보기가 그룹 수만큼 순차로 뜨는가
6. 분할 후 LOT 목록에 신규 시리얼이 입고일 순서 자리에 나타나는가

DB로 결과를 확인한다:

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT MAT_UID, ITEM_CODE, INIT_QTY, ORIGIN, STATUS, TO_CHAR(RECV_DATE,'YYYY-MM-DD') RECV FROM MAT_LOTS WHERE ORIGIN IS NOT NULL AND CREATED_AT > SYSDATE - 1 ORDER BY CREATED_AT DESC"
```

- [ ] **Step 6: 미완료 사항 기록**

검증에서 막힌 항목이 있으면 `docs/standards/unfinished-work-record.md` 기준으로 `docs/reports/unfinished-work/`에 기록하고, 최종 응답에 경로를 포함한다.

---

## 실행 순서 요약

1 → 2 → 3 → 4 (백엔드) → 5 → 6 (여기서 이미 동작하는 복수 롯트 출고) → 7 (분할/라벨) → 8 (검증)

Task 6까지만 해도 배포 가능한 상태다. Task 7은 그 위에 얹는다.
