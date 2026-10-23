import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { EntityTarget, FindManyOptions, ObjectLiteral, QueryRunner } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { IssueRequestAllocationService } from './issue-request-allocation.service';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { MatIssueRequestItemOrder } from '../../../entities/mat-issue-request-item-order.entity';
import { JobOrder } from '../../../entities/job-order.entity';

describe('IssueRequestAllocationService', () => {
  let service: IssueRequestAllocationService;
  let qr: DeepMocked<QueryRunner>;
  let headers: MatIssueRequest[];
  let items: MatIssueRequestItem[];
  let itemOrders: MatIssueRequestItemOrder[];
  let jobOrders: Array<Pick<JobOrder, 'orderNo' | 'planDate'>>;

  const header = (partial: Partial<MatIssueRequest>): MatIssueRequest => ({
    status: 'APPROVED',
    issueType: null,
    orderNo: null,
    processCode: null,
    company: 'C1',
    plant: 'P1',
    ...partial,
  } as MatIssueRequest);

  const item = (partial: Partial<MatIssueRequestItem>): MatIssueRequestItem => ({
    seq: 1,
    itemCode: 'RM-001',
    issuedQty: 0,
    company: 'C1',
    plant: 'P1',
    ...partial,
  } as MatIssueRequestItem);

  beforeEach(async () => {
    qr = createMock<QueryRunner>();
    headers = [];
    items = [];
    itemOrders = [];
    jobOrders = [];

    // DB 흉내: 헤더/품목 배열을 in-memory 로 두고 increment 가 실제 값을 바꾼다
    qr.manager.find.mockImplementation(async (entity: EntityTarget<ObjectLiteral>, options?: FindManyOptions<ObjectLiteral>) => {
      const where = (options?.where ?? {}) as Record<string, unknown>;
      if (entity === MatIssueRequest) return headers;
      if (entity === JobOrder) return jobOrders;
      if (entity === MatIssueRequestItemOrder) {
        const ids = (where.requestId as { value?: string[] } | string | undefined);
        const idList = typeof ids === 'string' ? [ids] : ids?.value ?? [];
        const seqs = (where.itemSeq as { value?: number[] } | undefined)?.value;
        return itemOrders.filter((row) =>
          idList.includes(row.requestId)
          && (seqs === undefined || seqs.includes(row.itemSeq))
          && (where.orderNo === undefined || row.orderNo === where.orderNo),
        );
      }
      const requestIds = (where.requestId as { value?: string[] } | undefined)?.value ?? [];
      return items.filter((row) =>
        requestIds.includes(row.requestId)
        && (where.itemCode === undefined || row.itemCode === where.itemCode),
      );
    });
    qr.manager.increment.mockImplementation(async (entity: EntityTarget<ObjectLiteral>, where: Record<string, unknown>, _prop: string, value: string | number) => {
      if (entity === MatIssueRequestItemOrder) {
        const row = itemOrders.find((o) => o.requestId === where.requestId && o.itemSeq === where.itemSeq && o.orderNo === where.orderNo);
        if (row) row.issuedQty += Number(value);
        return { affected: row ? 1 : 0, raw: [], generatedMaps: [] };
      }
      const target = items.find((row) => row.requestId === where.requestId && row.seq === where.seq);
      if (target) target.issuedQty += Number(value);
      return { affected: target ? 1 : 0, raw: [], generatedMaps: [] };
    });
    qr.manager.update.mockResolvedValue({ affected: 1 } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [IssueRequestAllocationService],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(IssueRequestAllocationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('요청일 오름차순(FIFO)으로 배분하고 전량 충족 요청은 COMPLETED, 일부만 채운 요청은 PARTIAL 로 갱신한다', async () => {
    headers = [
      header({ requestNo: 'REQ-NEW', requestDate: new Date('2026-09-02'), orderNo: 'WO-002' }),
      header({ requestNo: 'REQ-OLD', requestDate: new Date('2026-09-01'), orderNo: 'WO-001' }),
    ];
    items = [
      item({ requestId: 'REQ-NEW', requestQty: 10 }),
      item({ requestId: 'REQ-OLD', requestQty: 6 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 10, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations).toEqual([
      expect.objectContaining({ requestNo: 'REQ-OLD', allocatedQty: 6, requestStatus: 'COMPLETED' }),
      expect.objectContaining({ requestNo: 'REQ-NEW', allocatedQty: 4, requestStatus: 'PARTIAL' }),
    ]);
    expect(result.allocatedQty).toBe(10);
    expect(result.unallocatedQty).toBe(0);
    expect(qr.manager.update).toHaveBeenCalledWith(
      MatIssueRequest,
      expect.objectContaining({ requestNo: expect.objectContaining({ value: ['REQ-OLD'] }), company: 'C1', plant: 'P1' }),
      { status: 'COMPLETED' },
    );
    expect(qr.manager.update).toHaveBeenCalledWith(
      MatIssueRequest,
      expect.objectContaining({ requestNo: expect.objectContaining({ value: ['REQ-NEW'] }) }),
      { status: 'PARTIAL' },
    );
  });

  it('작업지시가 지정되면 같은 작업지시 요청을 더 오래된 다른 요청보다 우선한다', async () => {
    headers = [
      header({ requestNo: 'REQ-OTHER', requestDate: new Date('2026-09-01'), orderNo: 'WO-OTHER' }),
      header({ requestNo: 'REQ-MINE', requestDate: new Date('2026-09-03'), orderNo: 'WO-001' }),
    ];
    items = [
      item({ requestId: 'REQ-OTHER', requestQty: 10 }),
      item({ requestId: 'REQ-MINE', requestQty: 3 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 5, issueType: 'PROD', orderNo: 'WO-001', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations.map((a) => [a.requestNo, a.allocatedQty])).toEqual([
      ['REQ-MINE', 3],
      ['REQ-OTHER', 2],
    ]);
  });

  it('작업지시 매칭이 없으면 같은 공정 요청을 다음 우선순위로 잡는다', async () => {
    headers = [
      header({ requestNo: 'REQ-A', requestDate: new Date('2026-09-01'), processCode: 'PRC-A' }),
      header({ requestNo: 'REQ-B', requestDate: new Date('2026-09-02'), processCode: 'PRC-B' }),
    ];
    items = [
      item({ requestId: 'REQ-A', requestQty: 10 }),
      item({ requestId: 'REQ-B', requestQty: 10 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 4, issueType: 'PRODUCTION', processCode: 'PRC-B', orderNo: 'WO-NONE', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations).toEqual([
      expect.objectContaining({ requestNo: 'REQ-B', allocatedQty: 4, requestStatus: 'PARTIAL' }),
    ]);
  });

  it('요청 잔량보다 출고 수량이 많으면 남는 수량은 무매칭으로 두고 예외를 던지지 않는다', async () => {
    headers = [header({ requestNo: 'REQ-001', requestDate: new Date('2026-09-01') })];
    items = [item({ requestId: 'REQ-001', requestQty: 5, issuedQty: 2 })];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 10, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations).toEqual([
      expect.objectContaining({ requestNo: 'REQ-001', allocatedQty: 3, requestStatus: 'COMPLETED' }),
    ]);
    expect(result.allocatedQty).toBe(3);
    expect(result.unallocatedQty).toBe(7);
  });

  it('배분 가능한 요청이 없으면 아무것도 갱신하지 않고 전량 무매칭으로 반환한다', async () => {
    headers = [];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 10, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result).toEqual({ allocations: [], allocatedQty: 0, unallocatedQty: 10 });
    expect(qr.manager.increment).not.toHaveBeenCalled();
    expect(qr.manager.update).not.toHaveBeenCalled();
  });

  it('요청 잔량이 0인 품목과 다른 품목은 배분 대상에서 제외한다', async () => {
    headers = [header({ requestNo: 'REQ-001', requestDate: new Date('2026-09-01') })];
    items = [
      item({ requestId: 'REQ-001', seq: 1, requestQty: 5, issuedQty: 5 }),
      item({ requestId: 'REQ-001', seq: 2, itemCode: 'RM-OTHER', requestQty: 5 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 3, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations).toEqual([]);
    expect(result.unallocatedQty).toBe(3);
    expect(qr.manager.increment).not.toHaveBeenCalled();
  });

  it('기타출고(MANUAL) 스캔은 생산용(issueType NULL) 요청에 배분하지 않는다', async () => {
    headers = [
      header({ requestNo: 'REQ-PROD', requestDate: new Date('2026-09-01'), issueType: null }),
      header({ requestNo: 'REQ-MANUAL', requestDate: new Date('2026-09-02'), issueType: 'MANUAL' }),
    ];
    items = [
      item({ requestId: 'REQ-PROD', requestQty: 10 }),
      item({ requestId: 'REQ-MANUAL', requestQty: 10 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 4, issueType: 'MANUAL', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations).toEqual([
      expect.objectContaining({ requestNo: 'REQ-MANUAL', allocatedQty: 4 }),
    ]);
  });

  it('헤더 완료 판정은 출고처리와 같은 shared 규칙(deriveIssueRequestStatusFromItems)을 따른다 — 다른 품목이 이미 전량이면 COMPLETED', async () => {
    headers = [header({ requestNo: 'REQ-001', requestDate: new Date('2026-09-01') })];
    items = [
      item({ requestId: 'REQ-001', seq: 1, requestQty: 5 }),
      item({ requestId: 'REQ-001', seq: 2, itemCode: 'RM-OTHER', requestQty: 3, issuedQty: 3 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 5, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations[0].requestStatus).toBe('COMPLETED');
    expect(qr.manager.update).toHaveBeenCalledWith(
      MatIssueRequest,
      expect.objectContaining({ requestNo: expect.objectContaining({ value: ['REQ-001'] }) }),
      { status: 'COMPLETED' },
    );
    expect(qr.manager.update).not.toHaveBeenCalledWith(MatIssueRequest, expect.anything(), { status: 'PARTIAL' });
  });

  it('헤더 완료 판정은 배분 품목뿐 아니라 같은 요청의 다른 품목까지 본다', async () => {
    headers = [header({ requestNo: 'REQ-001', requestDate: new Date('2026-09-01') })];
    items = [
      item({ requestId: 'REQ-001', seq: 1, requestQty: 5 }),
      item({ requestId: 'REQ-001', seq: 2, itemCode: 'RM-OTHER', requestQty: 5 }),
    ];

    const result = await service.allocateIssuedQtyInTx(qr, {
      itemCode: 'RM-001', qty: 5, issueType: 'PRODUCTION', company: 'C1', plant: 'P1',
    }, 'ISS-001');

    expect(result.allocations[0].requestStatus).toBe('PARTIAL');
    expect(qr.manager.update).toHaveBeenCalledWith(
      MatIssueRequest,
      expect.anything(),
      { status: 'PARTIAL' },
    );
    expect(qr.manager.update).not.toHaveBeenCalledWith(MatIssueRequest, expect.anything(), { status: 'COMPLETED' });
  });

  describe('묶음 출고요청(작업지시별 행)', () => {
    const orderRow = (partial: Partial<MatIssueRequestItemOrder>): MatIssueRequestItemOrder => ({
      requestId: 'REQ-BUNDLE', itemSeq: 1, issuedQty: 0, company: 'C1', plant: 'P1', ...partial,
    } as MatIssueRequestItemOrder);

    beforeEach(() => {
      headers = [
        header({ requestNo: 'REQ-OLD', requestDate: new Date('2026-09-01'), orderNo: 'WO-OTHER' }),
        header({ requestNo: 'REQ-BUNDLE', requestDate: new Date('2026-09-05'), orderNo: null, processCode: 'P10' }),
      ];
      items = [
        item({ requestId: 'REQ-OLD', requestQty: 50 }),
        item({ requestId: 'REQ-BUNDLE', requestQty: 30 }),
      ];
      itemOrders = [
        orderRow({ orderNo: 'WO-B', requestQty: 20 }),
        orderRow({ orderNo: 'WO-A', requestQty: 10 }),
      ];
      jobOrders = [
        { orderNo: 'WO-A', planDate: new Date('2026-09-10') },
        { orderNo: 'WO-B', planDate: new Date('2026-09-11') },
      ];
    });

    it('스캔한 작업지시가 묶여 있는 묶음 요청을 같은 작업지시 우선순위로 먼저 채운다', async () => {
      const result = await service.allocateIssuedQtyInTx(qr, {
        itemCode: 'RM-001', qty: 30, issueType: 'PRODUCTION', orderNo: 'WO-B', company: 'C1', plant: 'P1',
      }, 'ISS-001');

      expect(result.allocations.map((a) => [a.requestNo, a.allocatedQty])).toEqual([['REQ-BUNDLE', 30]]);
    });

    it('품목 배분량을 작업지시 계획일 빠른 순으로 작업지시별 행에도 가산해 합계를 맞춘다', async () => {
      await service.allocateIssuedQtyInTx(qr, {
        itemCode: 'RM-001', qty: 15, issueType: 'PRODUCTION', orderNo: 'WO-A', company: 'C1', plant: 'P1',
      }, 'ISS-001');

      const bundleItem = items.find((row) => row.requestId === 'REQ-BUNDLE')!;
      expect(bundleItem.issuedQty).toBe(15);
      expect(itemOrders.map((row) => [row.orderNo, row.issuedQty])).toEqual([['WO-B', 5], ['WO-A', 10]]);
    });

    it('스캔한 작업지시(PDA)가 묶음에 있으면 그 작업지시 행부터 가산해 MAT_ISSUES.ORDER_NO 와 맞춘다', async () => {
      await service.allocateIssuedQtyInTx(qr, {
        itemCode: 'RM-001', qty: 15, issueType: 'PRODUCTION', orderNo: 'WO-B', company: 'C1', plant: 'P1',
      }, 'ISS-001');

      expect(itemOrders.map((row) => [row.orderNo, row.issuedQty])).toEqual([['WO-B', 15], ['WO-A', 0]]);
    });

    it('allocateToItemOrdersInTx 는 LOT 여러 개를 누적해 나누고 행이 없는 품목은 빈 배열을 돌려준다', async () => {
      const takes = await service.allocateToItemOrdersInTx(qr, 'REQ-BUNDLE', [
        { seq: 1, qty: 8 },
        { seq: 1, qty: 8 },
        { seq: 2, qty: 5 },
      ], 'C1', 'P1');

      expect(takes).toEqual([
        [{ orderNo: 'WO-A', qty: 8 }],
        [{ orderNo: 'WO-A', qty: 2 }, { orderNo: 'WO-B', qty: 6 }],
        [],
      ]);
      expect(itemOrders.map((row) => [row.orderNo, row.issuedQty])).toEqual([['WO-B', 6], ['WO-A', 10]]);
    });
  });
});
