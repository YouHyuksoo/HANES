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
import { Repository, DataSource, In } from 'typeorm';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatIssueService } from './mat-issue.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
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
    private readonly seqGenerator: SeqGeneratorService,
    private readonly dataSource: DataSource,
  ) {}

  /** 통합 채번 서비스를 통한 요청번호 생성 */
  private async generateRequestNo(qr?: import('typeorm').QueryRunner): Promise<string> {
    return this.seqGenerator.nextMatReqNo(qr);
  }

  /** 품목 목록에 itemCode/itemName 평탄화 */
  private async flattenItems(items: MatIssueRequestItem[]) {
    const itemCodes = items.map((i) => i.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return items.map((item) => {
      const part = partMap.get(item.itemCode);
      return {
        ...item,
        itemCode: part?.itemCode ?? null,
        itemName: part?.itemName ?? null,
        unit: item.unit ?? part?.unit ?? null,
      };
    });
  }

  /** 요청 헤더 조회 + 존재 검증 */
  private async getRequestOrFail(requestNo: string) {
    const request = await this.requestRepository.findOne({ where: { requestNo } });
    if (!request) throw new NotFoundException(`출고요청을 찾을 수 없습니다: ${requestNo}`);
    return request;
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const requestNo = await this.generateRequestNo(queryRunner);
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        jobOrderId: dto.orderNo ?? null,
        issueType: dto.issueType ?? null,
        status: 'REQUESTED',
        requester: 'SYSTEM',
        remark: dto.remark ?? null,
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
        }),
      );
      await queryRunner.manager.save(items);
      await queryRunner.commitTransaction();
      return this.findByRequestNo(saved.requestNo);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
    const allItems = requestNos.length > 0
      ? await this.requestItemRepository.find({ where: { requestId: In(requestNos) } })
      : [];

    // 품목 정보 일괄 조회
    const allItemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const allParts = allItemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(allItemCodes) } })
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
          itemCode: part?.itemCode ?? null,
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
  async findByRequestNo(requestNo: string) {
    const request = await this.getRequestOrFail(requestNo);
    const items = await this.requestItemRepository.find({ where: { requestId: requestNo } });
    const flatItems = await this.flattenItems(items);
    return { ...request, items: flatItems };
  }

  /** 출고요청 승인 (REQUESTED -> APPROVED) */
  async approve(requestNo: string) {
    const request = await this.getRequestOrFail(requestNo);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`승인할 수 없는 상태입니다: ${request.status}`);
    }
    await this.requestRepository.update({ requestNo }, { status: 'APPROVED', approvedAt: new Date() });
    return this.findByRequestNo(requestNo);
  }

  /** 출고요청 반려 (REQUESTED -> REJECTED) */
  async reject(requestNo: string, dto: RejectIssueRequestDto) {
    const request = await this.getRequestOrFail(requestNo);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`반려할 수 없는 상태입니다: ${request.status}`);
    }
    await this.requestRepository.update({ requestNo }, { status: 'REJECTED', rejectReason: dto.reason });
    return this.findByRequestNo(requestNo);
  }

  /**
   * 요청 기반 실출고 처리
   * - APPROVED 상태만 출고 가능
   * - MatIssueService.create()로 실제 출고 수행
   * - 모든 품목 완전 출고 시 COMPLETED 처리
   */
  async issueFromRequest(requestNo: string, dto: RequestIssueDto) {
    const request = await this.getRequestOrFail(requestNo);
    if (request.status !== 'APPROVED') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED만 가능): ${request.status}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const issueResult = await this.matIssueService.create({
        orderNo: request.jobOrderId ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType: dto.issueType ?? request.issueType ?? 'PRODUCTION',
        items: dto.items.map((i) => ({ matUid: i.matUid, issueQty: i.issueQty })),
        workerId: dto.workerId,
        remark: dto.remark ?? `출고요청 ${request.requestNo} 기반 출고`,
      });

      // 각 요청 품목의 issuedQty 갱신
      for (const dtoItem of dto.items) {
        // requestItemId는 seq 번호
        const reqItemSeq = Number(dtoItem.requestItemId);
        const reqItem = await this.requestItemRepository.findOne({
          where: { requestId: requestNo, seq: reqItemSeq },
        });
        if (reqItem) {
          await queryRunner.manager.update(MatIssueRequestItem, { requestId: reqItem.requestId, seq: reqItem.seq }, {
            issuedQty: reqItem.issuedQty + dtoItem.issueQty,
          });
        }
      }

      // 모든 품목 완전 출고 여부 확인
      const allItems = await this.requestItemRepository.find({ where: { requestId: requestNo } });
      const allCompleted = allItems.every((item) => {
        const addedQty = dto.items
          .filter((d) => Number(d.requestItemId) === item.seq)
          .reduce((sum, d) => sum + d.issueQty, 0);
        return (item.issuedQty + addedQty) >= item.requestQty;
      });

      if (allCompleted) {
        await queryRunner.manager.update(MatIssueRequest, { requestNo }, { status: 'COMPLETED' });
      }

      await queryRunner.commitTransaction();
      return { request: await this.findByRequestNo(requestNo), issueResult };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
