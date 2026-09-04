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
 */

import { Injectable, Logger } from '@nestjs/common';
import { In, QueryRunner } from 'typeorm';
import { isProductionIssueType, deriveIssueRequestStatusFromItems } from '@harness/shared';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';

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

  /** 0=같은 작업지시, 1=같은 공정, 2=나머지 */
  private priorityOf(header: MatIssueRequest, params: AllocateIssuedQtyParams): number {
    if (params.orderNo && header.orderNo === params.orderNo) return 0;
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
    const openItems = items
      .filter((item) => item.requestQty - item.issuedQty > 0)
      .sort((a, b) => {
        const headerA = headerMap.get(a.requestId)!;
        const headerB = headerMap.get(b.requestId)!;
        const priorityDiff = this.priorityOf(headerA, params) - this.priorityOf(headerB, params);
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
}
