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
import { Repository, Like, DataSource, In } from 'typeorm';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatIssueService } from './mat-issue.service';
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
    private readonly dataSource: DataSource,
  ) {}

  /** 당일 기준 요청번호 자동 생성 (REQ-YYYYMMDD-NNN) */
  private async generateRequestNo(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `REQ-${dateStr}-`;
    const count = await this.requestRepository.count({
      where: { requestNo: Like(`${prefix}%`) },
    });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  /** 품목 목록에 partCode/partName 평탄화 */
  private async flattenItems(items: MatIssueRequestItem[]) {
    const partIds = items.map((i) => i.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } }) : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    return items.map((item) => {
      const part = partMap.get(item.partId);
      return {
        ...item,
        partCode: part?.partCode ?? null,
        partName: part?.partName ?? null,
        unit: item.unit ?? part?.unit ?? null,
      };
    });
  }

  /** 요청 헤더 조회 + 존재 검증 */
  private async getRequestOrFail(id: string) {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException(`출고요청을 찾을 수 없습니다: ${id}`);
    return request;
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const requestNo = await this.generateRequestNo();
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        jobOrderId: dto.jobOrderId ?? null,
        status: 'REQUESTED',
        requester: 'SYSTEM',
        remark: dto.remark ?? null,
      });
      const saved = await queryRunner.manager.save(request);

      const items = dto.items.map((item) =>
        queryRunner.manager.create(MatIssueRequestItem, {
          requestId: saved.id,
          partId: item.partId,
          requestQty: item.requestQty,
          issuedQty: 0,
          unit: item.unit,
          remark: item.remark ?? null,
        }),
      );
      await queryRunner.manager.save(items);
      await queryRunner.commitTransaction();
      return this.findById(saved.id);
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

    const result = await Promise.all(
      data.map(async (req) => {
        const items = await this.requestItemRepository.find({ where: { requestId: req.id } });
        const flatItems = await this.flattenItems(items);
        return {
          ...req,
          itemCount: items.length,
          totalRequestQty: items.reduce((sum, i) => sum + i.requestQty, 0),
          totalIssuedQty: items.reduce((sum, i) => sum + i.issuedQty, 0),
          items: flatItems,
        };
      }),
    );

    let filtered = result;
    if (search) {
      const s = search.toLowerCase();
      filtered = result.filter(
        (r) => r.requestNo?.toLowerCase().includes(s) || r.requester?.toLowerCase().includes(s),
      );
    }
    return { data: filtered, total, page, limit };
  }

  /** 출고요청 상세 조회 (헤더 + 품목) */
  async findById(id: string) {
    const request = await this.getRequestOrFail(id);
    const items = await this.requestItemRepository.find({ where: { requestId: id } });
    const flatItems = await this.flattenItems(items);
    return { ...request, items: flatItems };
  }

  /** 출고요청 승인 (REQUESTED -> APPROVED) */
  async approve(id: string) {
    const request = await this.getRequestOrFail(id);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`승인할 수 없는 상태입니다: ${request.status}`);
    }
    await this.requestRepository.update(id, { status: 'APPROVED', approvedAt: new Date() });
    return this.findById(id);
  }

  /** 출고요청 반려 (REQUESTED -> REJECTED) */
  async reject(id: string, dto: RejectIssueRequestDto) {
    const request = await this.getRequestOrFail(id);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`반려할 수 없는 상태입니다: ${request.status}`);
    }
    await this.requestRepository.update(id, { status: 'REJECTED', rejectReason: dto.reason });
    return this.findById(id);
  }

  /**
   * 요청 기반 실출고 처리
   * - APPROVED 상태만 출고 가능
   * - MatIssueService.create()로 실제 출고 수행
   * - 모든 품목 완전 출고 시 COMPLETED 처리
   */
  async issueFromRequest(id: string, dto: RequestIssueDto) {
    const request = await this.getRequestOrFail(id);
    if (request.status !== 'APPROVED') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED만 가능): ${request.status}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const issueResult = await this.matIssueService.create({
        jobOrderId: request.jobOrderId ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType: 'PROD',
        items: dto.items.map((i) => ({ lotId: i.lotId, issueQty: i.issueQty })),
        workerId: dto.workerId,
        remark: dto.remark ?? `출고요청 ${request.requestNo} 기반 출고`,
      });

      // 각 요청 품목의 issuedQty 갱신
      for (const dtoItem of dto.items) {
        const reqItem = await this.requestItemRepository.findOne({
          where: { id: dtoItem.requestItemId },
        });
        if (reqItem) {
          await queryRunner.manager.update(MatIssueRequestItem, reqItem.id, {
            issuedQty: reqItem.issuedQty + dtoItem.issueQty,
          });
        }
      }

      // 모든 품목 완전 출고 여부 확인
      const allItems = await this.requestItemRepository.find({ where: { requestId: id } });
      const allCompleted = allItems.every((item) => {
        const addedQty = dto.items
          .filter((d) => d.requestItemId === item.id)
          .reduce((sum, d) => sum + d.issueQty, 0);
        return (item.issuedQty + addedQty) >= item.requestQty;
      });

      if (allCompleted) {
        await queryRunner.manager.update(MatIssueRequest, id, { status: 'COMPLETED' });
      }

      await queryRunner.commitTransaction();
      return { request: await this.findById(id), issueResult };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
