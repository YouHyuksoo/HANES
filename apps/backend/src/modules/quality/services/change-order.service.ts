/**
 * @file change-order.service.ts
 * @description 4M 변경점관리 서비스 — IATF 16949 8.5.6 변경 관리
 *
 * 초보자 가이드:
 * 1. **변경점 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **상태 흐름**: DRAFT → SUBMITTED → REVIEWING → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
 *               REVIEWING → REJECTED (반려 시)
 * 3. **changeNo 자동채번**: ECN-YYYYMMDD-NNN
 *
 * 주요 메서드:
 * - generateChangeNo(): 자동채번
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - submit(): 제출 (DRAFT → SUBMITTED)
 * - review(): 검토 (SUBMITTED → REVIEWING → APPROVED/REJECTED)
 * - approve(): 최종 승인
 * - start(): 시행 시작 (APPROVED → IN_PROGRESS)
 * - complete(): 완료 (IN_PROGRESS → COMPLETED)
 * - getStats(): 상태별 건수
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeOrder } from '../../../entities/change-order.entity';
import {
  CreateChangeOrderDto,
  UpdateChangeOrderDto,
  ChangeOrderQueryDto,
  ReviewChangeOrderDto,
} from '../dto/change-order.dto';

@Injectable()
export class ChangeOrderService {
  private readonly logger = new Logger(ChangeOrderService.name);

  constructor(
    @InjectRepository(ChangeOrder)
    private readonly changeRepo: Repository<ChangeOrder>,
  ) {}

  // =============================================
  // 변경번호 자동채번
  // =============================================

  /**
   * 변경번호 자동채번: ECN-YYYYMMDD-NNN
   */
  private async generateChangeNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ECN-${dateStr}-`;

    const last = await this.changeRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.changeNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.changeNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.changeNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 변경점 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(
    query: ChangeOrderQueryDto,
    company?: string,
    plant?: string,
  ) {
    const {
      page = 1,
      limit = 50,
      status,
      changeType,
      priority,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.changeRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (status) qb.andWhere('c.status = :status', { status });
    if (changeType) qb.andWhere('c.changeType = :changeType', { changeType });
    if (priority) qb.andWhere('c.priority = :priority', { priority });
    if (search) {
      qb.andWhere(
        '(UPPER(c.changeNo) LIKE UPPER(:s) OR UPPER(c.title) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('c.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('c.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 변경점 단건 조회
   */
  async findById(changeNo: string) {
    const item = await this.changeRepo.findOne({ where: { changeNo } });
    if (!item) {
      throw new NotFoundException('변경점을 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 변경점 등록 (DRAFT 상태로 생성)
   */
  async create(
    dto: CreateChangeOrderDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const changeNo = await this.generateChangeNo(company, plant);
    const entity = this.changeRepo.create({
      ...dto,
      changeNo,
      status: 'DRAFT',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.changeRepo.save(entity);
    this.logger.log(`변경점 등록: ${changeNo}`);
    return saved;
  }

  /**
   * 변경점 수정 (DRAFT 또는 REJECTED 상태에서만 가능)
   */
  async update(changeNo: string, dto: UpdateChangeOrderDto, userId: string) {
    const item = await this.findById(changeNo);
    if (!['DRAFT', 'REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '초안 또는 반려 상태에서만 수정할 수 있습니다.',
      );
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.changeRepo.save(item);
  }

  /**
   * 변경점 삭제 (DRAFT 상태에서만 가능)
   */
  async delete(changeNo: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 삭제할 수 있습니다.');
    }
    await this.changeRepo.remove(item);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 제출 (DRAFT → SUBMITTED)
   */
  async submit(changeNo: string, userId: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 제출할 수 있습니다.');
    }
    item.status = 'SUBMITTED';
    item.requestedAt = new Date();
    item.requestedBy = item.requestedBy ?? userId;
    item.updatedBy = userId;
    const saved = await this.changeRepo.save(item);
    this.logger.log(`변경점 제출: ${item.changeNo}`);
    return saved;
  }

  /**
   * 검토 (SUBMITTED → APPROVED 또는 REJECTED)
   */
  async review(changeNo: string, dto: ReviewChangeOrderDto, userId: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'SUBMITTED') {
      throw new BadRequestException('제출된 상태에서만 검토할 수 있습니다.');
    }
    item.reviewerCode = userId;
    item.reviewedAt = new Date();
    item.reviewComment = dto.comment ?? null;
    if (dto.action === 'APPROVE') {
      item.status = 'APPROVED';
    } else {
      item.status = 'REJECTED';
    }
    item.updatedBy = userId;
    const saved = await this.changeRepo.save(item);
    this.logger.log(
      `변경점 검토: ${item.changeNo} → ${item.status}`,
    );
    return saved;
  }

  /**
   * 최종 승인 (APPROVED 상태에서 승인자 기록)
   */
  async approve(changeNo: string, dto: ReviewChangeOrderDto, userId: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'APPROVED') {
      throw new BadRequestException('승인된 상태에서만 최종 승인할 수 있습니다.');
    }
    item.approverCode = userId;
    item.approvedAt = new Date();
    item.approveComment = dto.comment ?? null;
    item.updatedBy = userId;
    const saved = await this.changeRepo.save(item);
    this.logger.log(`변경점 최종 승인: ${item.changeNo}`);
    return saved;
  }

  /**
   * 시행 시작 (APPROVED → IN_PROGRESS)
   */
  async start(changeNo: string, userId: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'APPROVED') {
      throw new BadRequestException(
        '승인 상태에서만 시행을 시작할 수 있습니다.',
      );
    }
    item.status = 'IN_PROGRESS';
    item.updatedBy = userId;
    const saved = await this.changeRepo.save(item);
    this.logger.log(`변경점 시행 시작: ${item.changeNo}`);
    return saved;
  }

  /**
   * 완료 (IN_PROGRESS → COMPLETED)
   */
  async complete(changeNo: string, userId: string) {
    const item = await this.findById(changeNo);
    if (item.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        '진행중 상태에서만 완료할 수 있습니다.',
      );
    }
    item.status = 'COMPLETED';
    item.completionDate = new Date();
    item.updatedBy = userId;
    const saved = await this.changeRepo.save(item);
    this.logger.log(`변경점 완료: ${item.changeNo}`);
    return saved;
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 상태별 건수
   */
  async getStats(company?: string, plant?: string) {
    const qb = this.changeRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

    qb.groupBy('c.status');
    return qb.getRawMany();
  }
}
