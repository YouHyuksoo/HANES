/**
 * @file src/modules/material/services/issue-request-allocation.service.ts
 * @description 스캔 출고 수량을 승인/부분출고 상태의 출고요청에 배분(ISSUED_QTY 가산)하는 서비스
 *
 * 초보자 가이드:
 * 1. 스캔 출고는 요청번호 없이 LOT만 찍는다. 출고된 수량을 같은 품목의 미완료 요청에 자동 배분한다.
 * 2. 배분 우선순위: 같은 작업지시 요청 → 같은 공정 요청 → 나머지. 같은 순위 안에서는 요청일 오름차순(FIFO).
 * 3. 요청 헤더는 전 품목 충족 시 COMPLETED, 아니면 PARTIAL 로 갱신한다.
 * 4. 매칭되는 요청이 없거나 남는 수량은 배분하지 않고(무매칭 허용) warn 로그만 남긴다.
 * 5. MatIssueService ↔ IssueRequestService 순환 의존을 피하려고 별도 서비스로 둔다(Repository 주입 없이 QueryRunner 만 사용).
 * 6. 묶음 출고요청(MAT_ISSUE_REQUEST_ITEM_ORDERS 행이 있는 요청)은 품목 배분량을 작업지시별 행에도 계획일 빠른 순으로 나눠 가산한다
 *    (allocateToItemOrdersInTx — 요청 기반 출고 issueFromRequest 도 같은 메서드를 쓴다).
 */

import { Injectable, Logger } from '@nestjs/common';
import { In, QueryRunner } from 'typeorm';
import { isProductionIssueType, deriveIssueRequestStatusFromItems } from '@harness/shared';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { MatIssueRequestItemOrder } from '../../../entities/mat-issue-request-item-order.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { distributeQtyToOrders, OrderIssueTake } from './issue-request-order-split';

export const ALLOCATABLE_REQUEST_STATUSES = ['APPROVED', 'PARTIAL'] as const;

export interface AllocateIssuedQtyParams {
  itemCode: string;
  qty: number;
  issueType: string;
  processCode?: string | null;
  orderNo?: string | null;
  company?: string | null;
  plant?: string | null;
}

export interface IssueRequestAllocation {
  requestNo: string;
  seq: number;
  orderNo: string | null;
  allocatedQty: number;
  /** 배분 후 요청 헤더 상태 */
  requestStatus: 'PARTIAL' | 'COMPLETED';
}

export interface AllocateIssuedQtyResult {
  allocations: IssueRequestAllocation[];
  allocatedQty: number;
  /** 매칭 요청이 없어 배분되지 않은 잔량(무매칭 허용) */
  unallocatedQty: number;
}

@Injectable()
export class IssueRequestAllocationService {
  private readonly logger = new Logger(IssueRequestAllocationService.name);

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 요청 유형이 스캔 출고 유형과 호환되는지. 요청 issueType NULL 은 생산 출고로 본다(issueFromRequest 기본값과 동일). */
  private matchesIssueType(requestIssueType: string | null | undefined, issueType: string): boolean {
    if (isProductionIssueType(issueType)) {
      return !requestIssueType || isProductionIssueType(requestIssueType);
    }
    return (requestIssueType ?? '').trim().toUpperCase() === issueType.trim().toUpperCase();
  }

  /** 0=같은 작업지시(1:1 헤더 또는 묶음 포함), 1=같은 공정, 2=나머지 */
  private priorityOf(header: MatIssueRequest, params: AllocateIssuedQtyParams, bundledRequestNos: Set<string>): number {
    if (params.orderNo && (header.orderNo === params.orderNo || bundledRequestNos.has(header.requestNo))) return 0;
    if (params.processCode && header.processCode === params.processCode) return 1;
    return 2;
  }

  async allocateIssuedQtyInTx(
    qr: QueryRunner,
    params: AllocateIssuedQtyParams,
    issueNo: string,
  ): Promise<AllocateIssuedQtyResult> {
    const empty: AllocateIssuedQtyResult = { allocations: [], allocatedQty: 0, unallocatedQty: params.qty };
    if (params.qty <= 0) return empty;

    const tenantWhere = this.tenantWhere(params.company, params.plant);
    const headers = await qr.manager.find(MatIssueRequest, {
      where: { status: In([...ALLOCATABLE_REQUEST_STATUSES]), ...tenantWhere },
      order: { requestDate: 'ASC' },
    });
    const headerMap = new Map(
      headers
        .filter((header) => this.matchesIssueType(header.issueType, params.issueType))
        .map((header) => [header.requestNo, header] as const),
    );
    if (headerMap.size === 0) {
      this.logger.warn(`스캔 출고 ${issueNo}: 배분 가능한 출고요청이 없어 ${params.itemCode} ${params.qty} 를 무매칭 처리합니다.`);
      return empty;
    }

    const items = await qr.manager.find(MatIssueRequestItem, {
      where: { requestId: In([...headerMap.keys()]), itemCode: params.itemCode, ...tenantWhere },
    });
    // 스캔한 작업지시가 묶여 있는 묶음 요청도 같은 작업지시 우선순위로 본다
    const bundledRequestNos = new Set<string>();
    if (params.orderNo && items.length > 0) {
      const bundledRows = await qr.manager.find(MatIssueRequestItemOrder, {
        where: { requestId: In([...new Set(items.map((item) => item.requestId))]), orderNo: params.orderNo, ...tenantWhere },
        select: ['requestId'],
      });
      bundledRows.forEach((row) => bundledRequestNos.add(row.requestId));
    }
    const openItems = items
      .filter((item) => item.requestQty - item.issuedQty > 0)
      .sort((a, b) => {
        const headerA = headerMap.get(a.requestId)!;
        const headerB = headerMap.get(b.requestId)!;
        const priorityDiff = this.priorityOf(headerA, params, bundledRequestNos) - this.priorityOf(headerB, params, bundledRequestNos);
        if (priorityDiff !== 0) return priorityDiff;
        const dateDiff = new Date(headerA.requestDate).getTime() - new Date(headerB.requestDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.requestId !== b.requestId) return a.requestId.localeCompare(b.requestId);
        return a.seq - b.seq;
      });

    let remaining = params.qty;
    const allocations: IssueRequestAllocation[] = [];
    const touchedRequestNos = new Set<string>();
    for (const item of openItems) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, item.requestQty - item.issuedQty);
      await qr.manager.increment(
        MatIssueRequestItem,
        { requestId: item.requestId, seq: item.seq, ...tenantWhere },
        'issuedQty',
        take,
      );
      await this.allocateToItemOrdersInTx(qr, item.requestId, [{ seq: item.seq, qty: take }], params.company, params.plant, params.orderNo);
      allocations.push({
        requestNo: item.requestId,
        seq: item.seq,
        orderNo: headerMap.get(item.requestId)?.orderNo ?? null,
        allocatedQty: take,
        requestStatus: 'PARTIAL',
      });
      touchedRequestNos.add(item.requestId);
      remaining -= take;
    }

    if (touchedRequestNos.size > 0) {
      // 가산 후 값으로 헤더 완료 판정(같은 트랜잭션이라 갱신분이 보인다)
      const refreshed = await qr.manager.find(MatIssueRequestItem, {
        where: { requestId: In([...touchedRequestNos]), ...tenantWhere },
      });
      const itemsByRequest = new Map<string, MatIssueRequestItem[]>();
      for (const item of refreshed) {
        const list = itemsByRequest.get(item.requestId) ?? [];
        list.push(item);
        itemsByRequest.set(item.requestId, list);
      }
      // 헤더 완료 판정은 출고처리(issueFromRequest)와 같은 shared 규칙을 쓴다
      const completedNos = [...touchedRequestNos].filter((requestNo) =>
        deriveIssueRequestStatusFromItems(itemsByRequest.get(requestNo) ?? []) === 'COMPLETED',
      );
      const completedSet = new Set(completedNos);
      const partialNos = [...touchedRequestNos].filter((requestNo) => !completedSet.has(requestNo));

      if (completedNos.length > 0) {
        await qr.manager.update(MatIssueRequest, { requestNo: In(completedNos), ...tenantWhere }, { status: 'COMPLETED' });
      }
      if (partialNos.length > 0) {
        await qr.manager.update(MatIssueRequest, { requestNo: In(partialNos), ...tenantWhere }, { status: 'PARTIAL' });
      }
      for (const allocation of allocations) {
        allocation.requestStatus = completedSet.has(allocation.requestNo) ? 'COMPLETED' : 'PARTIAL';
      }
    }

    if (remaining > 0) {
      this.logger.warn(
        `스캔 출고 ${issueNo}: ${params.itemCode} 출고 ${params.qty} 중 ${remaining} 는 매칭 출고요청이 없어 배분하지 않았습니다.`,
      );
    }

    return { allocations, allocatedQty: params.qty - remaining, unallocatedQty: remaining };
  }

  /**
   * 묶음 출고요청 품목 배분량을 작업지시별 행(MAT_ISSUE_REQUEST_ITEM_ORDERS)에 나눠 가산한다.
   * 계획일 빠른 작업지시의 잔여부터 채우고 포장단위 올림 초과분은 마지막 작업지시에 둔다(distributeQtyToOrders).
   * entries 는 순서대로 누적 배분한다(같은 품목에 LOT 여러 개). 행이 없는 품목(1:1 요청)은 빈 배열을 돌려준다.
   * 돌려준 takes 는 MAT_ISSUES.ORDER_NO 를 작업지시별로 남길 때 쓴다.
   */
  async allocateToItemOrdersInTx(
    qr: QueryRunner,
    requestId: string,
    entries: ReadonlyArray<{ seq: number; qty: number }>,
    company?: string | null,
    plant?: string | null,
    /** 스캔 출고에서 찍은 작업지시 — 묶음 안에 있으면 그 작업지시부터 채운다(MAT_ISSUES.ORDER_NO 와 일치) */
    preferOrderNo?: string | null,
  ): Promise<OrderIssueTake[][]> {
    const tenantWhere = this.tenantWhere(company, plant);
    const seqs = [...new Set(entries.map((entry) => entry.seq))];
    const rows = seqs.length > 0
      ? await qr.manager.find(MatIssueRequestItemOrder, { where: { requestId, itemSeq: In(seqs), ...tenantWhere } })
      : [];
    if (rows.length === 0) return entries.map(() => []);

    const orderNos = [...new Set(rows.map((row) => row.orderNo))];
    const jobOrders = await qr.manager.find(JobOrder, {
      where: { orderNo: In(orderNos), ...tenantWhere },
      select: ['orderNo', 'planDate'],
    });
    const planDateMap = new Map(jobOrders.map((order) => [order.orderNo, order.planDate]));
    // 누적 배분용 작업 사본(같은 품목에 LOT 여러 개가 오면 앞 LOT 배분을 반영해 이어서 채운다)
    const working = new Map<number, Array<{ orderNo: string; planDate: Date | null; requestQty: number; issuedQty: number }>>();
    for (const row of rows) {
      const list = working.get(row.itemSeq) ?? [];
      list.push({
        orderNo: row.orderNo,
        planDate: planDateMap.get(row.orderNo) ?? null,
        requestQty: Number(row.requestQty),
        issuedQty: Number(row.issuedQty ?? 0),
      });
      working.set(row.itemSeq, list);
    }

    const added = new Map<string, number>();
    const result = entries.map((entry) => {
      const list = working.get(entry.seq);
      if (!list || list.length === 0) return [];
      const takes = distributeQtyToOrders(list, entry.qty, preferOrderNo);
      for (const take of takes) {
        const target = list.find((row) => row.orderNo === take.orderNo)!;
        target.issuedQty += take.qty;
        const key = `${entry.seq}|${take.orderNo}`;
        added.set(key, (added.get(key) ?? 0) + take.qty);
      }
      return takes;
    });

    for (const [key, qty] of added) {
      const [seq, orderNo] = key.split('|');
      await qr.manager.increment(
        MatIssueRequestItemOrder,
        { requestId, itemSeq: Number(seq), orderNo, ...tenantWhere },
        'issuedQty',
        qty,
      );
    }
    return result;
  }
}
