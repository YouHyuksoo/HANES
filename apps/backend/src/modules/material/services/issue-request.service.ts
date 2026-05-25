/**
 * @file src/modules/material/services/issue-request.service.ts
 * @description 자재 출고요청 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatIssueRequest**: 출고요청 헤더 (요청번호, 상태, 요청자 등)
 * 2. **MatIssueRequestItem**: 요청 품목 상세 (품목, 수량, 출고실적)
 * 3. **상태 흐름**: REQUESTED -> APPROVED -> COMPLETED (또는 REJECTED)
 * 4. **issueFromRequest**: 승인된 요청을 실제 출고로 전환
 * 5. **요청번호**: REQ-YYYYMMDD-NNN 형식 자동 생성
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatIssueService } from './mat-issue.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import {
  CreateIssueRequestDto,
  IssueRequestQueryDto,
  RejectIssueRequestDto,
  RequestIssueDto,
} from '../dto/issue-request.dto';

@Injectable()
export class IssueRequestService {
  constructor(
    @InjectRepository(MatIssueRequest)
    private readonly requestRepository: Repository<MatIssueRequest>,
    @InjectRepository(MatIssueRequestItem)
    private readonly requestItemRepository: Repository<MatIssueRequestItem>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly matIssueService: MatIssueService,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  /** 통합 채번 서비스를 통한 요청번호 생성 */
  private async generateRequestNo(qr?: import('typeorm').QueryRunner): Promise<string> {
    return this.numbering.next('MAT_REQ', qr);
  }

  /** 품목 목록에 itemCode/itemName 평탄화 */
  private async flattenItems(items: MatIssueRequestItem[], company?: string | null, plant?: string | null) {
    const itemCodes = items.map((i) => i.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } }) : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return items.map((item) => {
      const part = partMap.get(item.itemCode);
      return {
        ...item,
        itemCode: item.itemCode,
        itemName: part?.itemName ?? null,
        unit: item.unit ?? part?.unit ?? null,
      };
    });
  }

  /** 요청 헤더 조회 + 존재 검증 */
  private async getRequestOrFail(requestNo: string, company?: string, plant?: string) {
    const request = await this.requestRepository.findOne({ where: { requestNo, ...this.tenantWhere(company, plant) } });
    if (!request) throw new NotFoundException(`출고요청을 찾을 수 없습니다: ${requestNo}`);
    this.assertSameTenant('출고요청', { company, plant }, request);
    return request;
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      const requestNo = await this.generateRequestNo(queryRunner);
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        orderNo: dto.orderNo ?? null,
        issueType: dto.issueType ?? null,
        status: 'REQUESTED',
        requester: 'SYSTEM',
        remark: dto.remark ?? null,
        company,
        plant,
      });
      const saved = await queryRunner.manager.save(request);

      const items = dto.items.map((item, idx) =>
        queryRunner.manager.create(MatIssueRequestItem, {
          requestId: saved.requestNo,
          seq: idx + 1,
          itemCode: item.itemCode,
          requestQty: item.requestQty,
          issuedQty: 0,
          unit: item.unit,
          remark: item.remark ?? null,
          company,
          plant,
        }),
      );
      await queryRunner.manager.save(items);
      return this.findByRequestNo(saved.requestNo, company, plant);
    });
  }

  /** 출고요청 목록 조회 (페이지네이션 + 필터) */
  async findAll(query: IssueRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search } = query;
    const where: any = { ...(status && { status }), ...(company && { company }), ...(plant && { plant }) };

    const [data, total] = await Promise.all([
      this.requestRepository.find({
        where, skip: (page - 1) * limit, take: limit, order: { requestDate: 'DESC' },
      }),
      this.requestRepository.count({ where }),
    ]);

    // IN 배치 선조회로 N+1 제거 (요청별 아이템 개별 조회 → 일괄 조회)
    const requestNos = data.map((r) => r.requestNo);
    const tenantWhere = this.tenantWhere(company, plant);
    const allItems = requestNos.length > 0
      ? await this.requestItemRepository.find({ where: { requestId: In(requestNos), ...tenantWhere } })
      : [];

    // 품목 정보 일괄 조회
    const allItemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const allParts = allItemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(allItemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(allParts.map((p) => [p.itemCode, p]));

    // 요청별 아이템 그룹화
    const itemsByRequest = new Map<string, MatIssueRequestItem[]>();
    for (const item of allItems) {
      const list = itemsByRequest.get(item.requestId) ?? [];
      list.push(item);
      itemsByRequest.set(item.requestId, list);
    }

    let result = data.map((req) => {
      const items = itemsByRequest.get(req.requestNo) ?? [];
      const flatItems = items.map((item) => {
        const part = partMap.get(item.itemCode);
        return {
          ...item,
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          unit: item.unit ?? part?.unit ?? null,
        };
      });
      return {
        ...req,
        itemCount: items.length,
        totalRequestQty: items.reduce((sum, i) => sum + i.requestQty, 0),
        totalIssuedQty: items.reduce((sum, i) => sum + i.issuedQty, 0),
        items: flatItems,
      };
    });

    if (search) {
      const upper = search.toUpperCase();
      result = result.filter(
        (r) => r.requestNo?.toUpperCase().includes(upper) || r.requester?.toUpperCase().includes(upper),
      );
    }
    return { data: result, total, page, limit };
  }

  /** 출고요청 상세 조회 (헤더 + 품목) */
  async findByRequestNo(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    const requestTenantWhere = this.tenantWhere(request.company, request.plant);
    const items = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
    const flatItems = await this.flattenItems(items, request.company, request.plant);
    return { ...request, items: flatItems };
  }

  /** 출고요청 승인 (REQUESTED -> APPROVED) */
  async approve(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`승인할 수 없는 상태입니다: ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);
    await this.requestRepository.update({ requestNo, ...requestTenantWhere }, { status: 'APPROVED', approvedAt: new Date() });
    return this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined);
  }

  /** 출고요청 반려 (REQUESTED -> REJECTED) */
  async reject(requestNo: string, dto: RejectIssueRequestDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`반려할 수 없는 상태입니다: ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);
    await this.requestRepository.update({ requestNo, ...requestTenantWhere }, { status: 'REJECTED', rejectReason: dto.reason });
    return this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined);
  }

  /**
   * 요청 기반 실출고 처리
   * - APPROVED 상태만 출고 가능
   * - MatIssueService.create()로 실제 출고 수행
   * - 모든 품목 완전 출고 시 COMPLETED 처리
   */
  async issueFromRequest(requestNo: string, dto: RequestIssueDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'APPROVED') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED만 가능): ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);

    return this.tx.run(async (queryRunner) => {
      const issueResult = await this.matIssueService.createInTx(queryRunner, {
        orderNo: request.orderNo ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType: dto.issueType ?? request.issueType ?? 'PRODUCTION',
        items: dto.items.map((i) => ({ matUid: i.matUid, issueQty: i.issueQty })),
        workerId: dto.workerId,
        remark: dto.remark ?? `출고요청 ${request.requestNo} 기반 출고`,
      }, effectiveCompany ?? undefined, effectivePlant ?? undefined);

      // 각 요청 품목의 issuedQty 갱신
      for (const dtoItem of dto.items) {
        // requestItemId는 seq 번호
        const reqItemSeq = Number(dtoItem.requestItemId);
        const reqItem = await this.requestItemRepository.findOne({
          where: { requestId: requestNo, seq: reqItemSeq, ...requestTenantWhere },
        });
        if (!reqItem) {
          throw new BadRequestException(`출고요청 항목을 찾을 수 없습니다: ${dtoItem.requestItemId}`);
        }
        const remainingQty = reqItem.requestQty - reqItem.issuedQty;
        if (dtoItem.issueQty > remainingQty) {
          throw new BadRequestException(
            `요청 수량을 초과해 출고할 수 없습니다. 항목 ${reqItemSeq}, 잔여: ${remainingQty}, 요청: ${dtoItem.issueQty}`,
          );
        }
        if (reqItem) {
          await queryRunner.manager.update(MatIssueRequestItem, { requestId: reqItem.requestId, seq: reqItem.seq, ...requestTenantWhere }, {
            issuedQty: reqItem.issuedQty + dtoItem.issueQty,
          });
        }
      }

      // 모든 품목 완전 출고 여부 확인
      const allItems = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
      const allCompleted = allItems.every((item) => {
        const addedQty = dto.items
          .filter((d) => Number(d.requestItemId) === item.seq)
          .reduce((sum, d) => sum + d.issueQty, 0);
        return (item.issuedQty + addedQty) >= item.requestQty;
      });

      if (allCompleted) {
        await queryRunner.manager.update(MatIssueRequest, { requestNo, ...requestTenantWhere }, { status: 'COMPLETED' });
      }

      return { request: await this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined), issueResult };
    });
  }
}
