/**
 * @file ppap.service.ts
 * @description PPAP(Production Part Approval Process) 서비스 — IATF 16949 PPAP 승인
 *
 * 초보자 가이드:
 * 1. **PPAP CRUD**: 등록, 조회, 수정, 삭제
 * 2. **상태 흐름**: DRAFT → SUBMITTED → APPROVED / REJECTED / INTERIM
 * 3. **ppapNo 자동채번**: PPAP-YYYYMMDD-NNN
 * 4. **PPAP Level별 필수 요소**: getRequiredElements(level)로 확인
 * 5. **완성률 계산**: getCompletionRate(id)로 필수 요소 대비 완료율 계산
 *
 * 주요 메서드:
 * - generatePpapNo(): 자동채번
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - submit(): 제출 (DRAFT → SUBMITTED)
 * - approve(): 승인 (SUBMITTED → APPROVED)
 * - reject(): 반려 (SUBMITTED → REJECTED)
 * - getRequiredElements(): Level별 필수 요소 목록
 * - getCompletionRate(): 완성률 계산
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PpapSubmission } from '../../../../entities/ppap-submission.entity';
import {
  CreatePpapDto,
  UpdatePpapDto,
  PpapFilterDto,
} from '../dto/ppap.dto';

/** 18 PPAP 요소 키 목록 */
const PPAP_ELEMENT_KEYS = [
  'designRecords',
  'ecnDocuments',
  'customerApproval',
  'dfmea',
  'processFlowDiagram',
  'pfmea',
  'controlPlan',
  'msaStudies',
  'dimensionalResults',
  'materialTestResults',
  'initialProcessStudies',
  'qualifiedLabDoc',
  'appearanceApproval',
  'sampleProduct',
  'masterSample',
  'checkingAids',
  'customerSpecificReq',
  'partSubmissionWarrant',
] as const;

/**
 * PPAP Level별 필수 요소 매트릭스 (AIAG PPAP 4th Edition 기준)
 * true = 필수(제출), false = 보관만
 */
const PPAP_LEVEL_MATRIX: Record<number, Record<string, boolean>> = {
  1: {
    designRecords: false,
    ecnDocuments: false,
    customerApproval: false,
    dfmea: false,
    processFlowDiagram: false,
    pfmea: false,
    controlPlan: false,
    msaStudies: false,
    dimensionalResults: false,
    materialTestResults: false,
    initialProcessStudies: false,
    qualifiedLabDoc: false,
    appearanceApproval: false,
    sampleProduct: false,
    masterSample: false,
    checkingAids: false,
    customerSpecificReq: false,
    partSubmissionWarrant: true,
  },
  2: {
    designRecords: false,
    ecnDocuments: false,
    customerApproval: false,
    dfmea: false,
    processFlowDiagram: false,
    pfmea: false,
    controlPlan: false,
    msaStudies: false,
    dimensionalResults: true,
    materialTestResults: true,
    initialProcessStudies: false,
    qualifiedLabDoc: false,
    appearanceApproval: true,
    sampleProduct: true,
    masterSample: false,
    checkingAids: false,
    customerSpecificReq: false,
    partSubmissionWarrant: true,
  },
  3: {
    designRecords: true,
    ecnDocuments: true,
    customerApproval: true,
    dfmea: true,
    processFlowDiagram: true,
    pfmea: true,
    controlPlan: true,
    msaStudies: true,
    dimensionalResults: true,
    materialTestResults: true,
    initialProcessStudies: true,
    qualifiedLabDoc: true,
    appearanceApproval: true,
    sampleProduct: true,
    masterSample: false,
    checkingAids: false,
    customerSpecificReq: true,
    partSubmissionWarrant: true,
  },
  4: {
    designRecords: true,
    ecnDocuments: true,
    customerApproval: true,
    dfmea: true,
    processFlowDiagram: true,
    pfmea: true,
    controlPlan: true,
    msaStudies: true,
    dimensionalResults: true,
    materialTestResults: true,
    initialProcessStudies: true,
    qualifiedLabDoc: true,
    appearanceApproval: true,
    sampleProduct: true,
    masterSample: true,
    checkingAids: true,
    customerSpecificReq: true,
    partSubmissionWarrant: true,
  },
  5: {
    designRecords: true,
    ecnDocuments: true,
    customerApproval: true,
    dfmea: true,
    processFlowDiagram: true,
    pfmea: true,
    controlPlan: true,
    msaStudies: true,
    dimensionalResults: true,
    materialTestResults: true,
    initialProcessStudies: true,
    qualifiedLabDoc: true,
    appearanceApproval: true,
    sampleProduct: true,
    masterSample: true,
    checkingAids: true,
    customerSpecificReq: true,
    partSubmissionWarrant: true,
  },
};

@Injectable()
export class PpapService {
  private readonly logger = new Logger(PpapService.name);

  constructor(
    @InjectRepository(PpapSubmission)
    private readonly ppapRepo: Repository<PpapSubmission>,
  ) {}

  // =============================================
  // PPAP 번호 자동채번
  // =============================================

  /**
   * PPAP 번호 자동채번: PPAP-YYYYMMDD-NNN
   */
  private async generatePpapNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PPAP-${dateStr}-`;

    const last = await this.ppapRepo
      .createQueryBuilder('p')
      .where('p.company = :company', { company })
      .andWhere('p.plant = :plant', { plant })
      .andWhere('p.ppapNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.ppapNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.ppapNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * PPAP 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: PpapFilterDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      itemCode,
      customerCode,
      reason,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.ppapRepo.createQueryBuilder('p');

    if (company) qb.andWhere('p.company = :company', { company });
    if (plant) qb.andWhere('p.plant = :plant', { plant });
    if (status) qb.andWhere('p.status = :status', { status });
    if (itemCode) qb.andWhere('p.itemCode = :itemCode', { itemCode });
    if (customerCode)
      qb.andWhere('p.customerCode = :customerCode', { customerCode });
    if (reason) qb.andWhere('p.reason = :reason', { reason });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(p.ppapNo LIKE :sCode OR p.itemCode LIKE :sCode OR p.itemName LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('p.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('p.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * PPAP 단건 조회
   */
  async findById(ppapNo: string) {
    const item = await this.ppapRepo.findOne({ where: { ppapNo } });
    if (!item) {
      throw new NotFoundException('PPAP 제출을 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * PPAP 등록 (DRAFT 상태로 생성)
   */
  async create(
    dto: CreatePpapDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const ppapNo = await this.generatePpapNo(company, plant);
    const entity = this.ppapRepo.create({
      ...dto,
      ppapNo,
      status: 'DRAFT',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.ppapRepo.save(entity);
    this.logger.log(`PPAP 등록: ${ppapNo}`);
    return saved;
  }

  /**
   * PPAP 수정 (DRAFT 또는 REJECTED 상태에서만 가능)
   */
  async update(ppapNo: string, dto: UpdatePpapDto, userId: string) {
    const item = await this.findById(ppapNo);
    if (!['DRAFT', 'REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '초안 또는 반려 상태에서만 수정할 수 있습니다.',
      );
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.ppapRepo.save(item);
  }

  /**
   * PPAP 삭제 (DRAFT 상태에서만 가능)
   */
  async delete(ppapNo: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 삭제할 수 있습니다.');
    }
    await this.ppapRepo.remove(item);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 제출 (DRAFT → SUBMITTED)
   */
  async submit(ppapNo: string, userId: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 제출할 수 있습니다.');
    }
    item.status = 'SUBMITTED';
    item.submittedAt = new Date();
    item.updatedBy = userId;
    const saved = await this.ppapRepo.save(item);
    this.logger.log(`PPAP 제출: ${item.ppapNo}`);
    return saved;
  }

  /**
   * 승인 (SUBMITTED → APPROVED)
   */
  async approve(ppapNo: string, userId: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'SUBMITTED') {
      throw new BadRequestException(
        '제출된 상태에서만 승인할 수 있습니다.',
      );
    }
    item.status = 'APPROVED';
    item.approvedAt = new Date();
    item.approvedBy = userId;
    item.updatedBy = userId;
    const saved = await this.ppapRepo.save(item);
    this.logger.log(`PPAP 승인: ${item.ppapNo}`);
    return saved;
  }

  /**
   * 반려 (SUBMITTED → REJECTED)
   */
  async reject(ppapNo: string, reason: string, userId: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'SUBMITTED') {
      throw new BadRequestException(
        '제출된 상태에서만 반려할 수 있습니다.',
      );
    }
    item.status = 'REJECTED';
    item.rejectedReason = reason;
    item.updatedBy = userId;
    const saved = await this.ppapRepo.save(item);
    this.logger.log(`PPAP 반려: ${item.ppapNo}`);
    return saved;
  }

  /**
   * 승인 취소 (APPROVED → SUBMITTED)
   */
  async cancelApproval(ppapNo: string, userId: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'APPROVED') {
      throw new BadRequestException(
        '승인 상태에서만 승인취소할 수 있습니다.',
      );
    }
    item.status = 'SUBMITTED';
    item.approvedAt = null;
    item.approvedBy = null;
    item.updatedBy = userId;
    const saved = await this.ppapRepo.save(item);
    this.logger.log(`PPAP 승인취소: ${item.ppapNo}`);
    return saved;
  }

  /**
   * 제출 취소 (SUBMITTED → DRAFT)
   */
  async cancelSubmit(ppapNo: string, userId: string) {
    const item = await this.findById(ppapNo);
    if (item.status !== 'SUBMITTED') {
      throw new BadRequestException(
        '제출 상태에서만 제출취소할 수 있습니다.',
      );
    }
    item.status = 'DRAFT';
    item.submittedAt = null;
    item.updatedBy = userId;
    const saved = await this.ppapRepo.save(item);
    this.logger.log(`PPAP 제출취소: ${item.ppapNo}`);
    return saved;
  }

  // =============================================
  // PPAP Level별 필수 요소 / 완성률
  // =============================================

  /**
   * Level별 필수 요소 목록 반환
   */
  getRequiredElements(level: number) {
    if (level < 1 || level > 5) {
      throw new BadRequestException('PPAP Level은 1~5 사이여야 합니다.');
    }
    const matrix = PPAP_LEVEL_MATRIX[level];
    const required = PPAP_ELEMENT_KEYS.filter((key) => matrix[key]);
    const retained = PPAP_ELEMENT_KEYS.filter((key) => !matrix[key]);
    return { level, required, retained, totalRequired: required.length };
  }

  /**
   * 완성률 계산 (필수 요소 대비 완료된 비율)
   */
  async getCompletionRate(ppapNo: string) {
    const item = await this.findById(ppapNo);
    const matrix = PPAP_LEVEL_MATRIX[item.ppapLevel] ?? PPAP_LEVEL_MATRIX[3];
    const requiredKeys = PPAP_ELEMENT_KEYS.filter((key) => matrix[key]);
    if (requiredKeys.length === 0) {
      return { ppapNo: item.ppapNo, level: item.ppapLevel, rate: 100, completed: 0, total: 0 };
    }

    const completed = requiredKeys.filter(
      (key) => (item as any)[key] === 1,
    ).length;
    const rate = Math.round((completed / requiredKeys.length) * 100);

    return {
      ppapNo: item.ppapNo,
      level: item.ppapLevel,
      rate,
      completed,
      total: requiredKeys.length,
    };
  }
}
