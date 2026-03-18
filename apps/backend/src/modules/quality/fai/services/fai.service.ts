/**
 * @file fai.service.ts
 * @description 초물검사(FAI) 서비스 — IATF 16949 8.3.4.4 신규/변경 품목 첫 생산품 검증
 *
 * 초보자 가이드:
 * 1. **FAI 요청 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **상태 흐름**: REQUESTED → SAMPLING → INSPECTING → PASS / FAIL / CONDITIONAL
 * 3. **검사항목**: FaiItem 으로 항목별 규격/측정값/판정 관리
 * 4. **자동 판정**: complete() 시 모든 항목 OK이면 PASS, NG 있으면 FAIL
 * 5. **faiNo 자동채번**: FAI-YYYYMMDD-NNN 형식
 *
 * 주요 메서드:
 * - findAll / findById: 목록/단건 조회 (items 포함)
 * - create / update / delete: 기본 CRUD
 * - start: 검사 시작 (REQUESTED → SAMPLING)
 * - complete: 검사 완료 + 자동 판정 (INSPECTING → PASS/FAIL/CONDITIONAL)
 * - approve: 승인
 * - addItems: 검사항목 일괄 등록
 * - getStats: 상태별 통계
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaiRequest } from '../../../../entities/fai-request.entity';
import { FaiItem } from '../../../../entities/fai-item.entity';
import {
  CreateFaiDto,
  UpdateFaiDto,
  FaiQueryDto,
  CompleteFaiDto,
  FaiItemDto,
} from '../dto/fai.dto';

@Injectable()
export class FaiService {
  private readonly logger = new Logger(FaiService.name);

  constructor(
    @InjectRepository(FaiRequest)
    private readonly faiRepo: Repository<FaiRequest>,
    @InjectRepository(FaiItem)
    private readonly itemRepo: Repository<FaiItem>,
  ) {}

  // =============================================
  // FAI 번호 자동채번
  // =============================================

  /**
   * FAI 번호 자동채번: FAI-YYYYMMDD-NNN
   */
  private async generateFaiNo(company: string, plant: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `FAI-${dateStr}-`;

    const last = await this.faiRepo
      .createQueryBuilder('f')
      .where('f.company = :company', { company })
      .andWhere('f.plant = :plant', { plant })
      .andWhere('f.faiNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('f.faiNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.faiNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // FAI 요청 CRUD
  // =============================================

  /**
   * FAI 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: FaiQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      triggerType,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.faiRepo.createQueryBuilder('f');

    if (company) qb.andWhere('f.company = :company', { company });
    if (plant) qb.andWhere('f.plant = :plant', { plant });
    if (status) qb.andWhere('f.status = :status', { status });
    if (triggerType) qb.andWhere('f.triggerType = :triggerType', { triggerType });
    if (search) {
      qb.andWhere(
        '(UPPER(f.faiNo) LIKE UPPER(:s) OR UPPER(f.itemCode) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('f.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('f.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * FAI 단건 조회 (검사항목 포함)
   */
  async findById(id: number) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) {
      throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    }
    const items = await this.itemRepo.find({
      where: { faiId: id },
      order: { seq: 'ASC' },
    });
    return { ...fai, items };
  }

  /**
   * FAI 요청 등록
   */
  async create(
    dto: CreateFaiDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const faiNo = await this.generateFaiNo(company, plant);
    const { items, ...requestFields } = dto;

    const entity = this.faiRepo.create({
      ...requestFields,
      faiNo,
      status: 'REQUESTED',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.faiRepo.save(entity) as FaiRequest;

    if (items && items.length > 0) {
      await this.saveItems(saved.id, items);
    }

    this.logger.log(`초물검사 등록: ${faiNo} (itemCode: ${dto.itemCode})`);
    return saved;
  }

  /**
   * FAI 요청 수정 (REQUESTED 상태에서만 가능)
   */
  async update(id: number, dto: UpdateFaiDto, userId: string) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    if (fai.status !== 'REQUESTED') {
      throw new BadRequestException('요청 상태에서만 수정할 수 있습니다.');
    }
    const { items, ...updateFields } = dto;
    Object.assign(fai, updateFields, { updatedBy: userId });
    return this.faiRepo.save(fai);
  }

  /**
   * FAI 요청 삭제 (REQUESTED 상태에서만 가능)
   */
  async delete(id: number) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    if (fai.status !== 'REQUESTED') {
      throw new BadRequestException('요청 상태에서만 삭제할 수 있습니다.');
    }
    await this.itemRepo.delete({ faiId: id });
    await this.faiRepo.remove(fai);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 검사 시작 (REQUESTED → SAMPLING)
   */
  async start(id: number, userId: string) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    if (fai.status !== 'REQUESTED') {
      throw new BadRequestException('요청 상태에서만 검사를 시작할 수 있습니다.');
    }
    fai.status = 'SAMPLING';
    fai.updatedBy = userId;
    return this.faiRepo.save(fai);
  }

  /**
   * 검사 완료 — 자동 판정 기반
   *
   * items 전체 OK이면 PASS, NG가 하나라도 있으면 FAIL.
   * dto.result로 CONDITIONAL(조건부 합격) 수동 지정 가능.
   */
  async complete(id: number, dto: CompleteFaiDto, userId: string) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    if (!['SAMPLING', 'INSPECTING'].includes(fai.status)) {
      throw new BadRequestException('샘플링 또는 검사중 상태에서만 완료할 수 있습니다.');
    }

    // 자동 판정: items 기반
    const items = await this.itemRepo.find({ where: { faiId: id } });
    let autoResult = dto.result;
    if (items.length > 0 && dto.result !== 'CONDITIONAL') {
      const hasNg = items.some((item) => item.result === 'NG');
      autoResult = hasNg ? 'FAIL' : 'PASS';
    }

    fai.status = autoResult;
    fai.result = autoResult;
    fai.inspectDate = new Date();
    fai.remarks = dto.remarks ?? fai.remarks;
    fai.updatedBy = userId;

    this.logger.log(`초물검사 완료: ${fai.faiNo}, 판정=${autoResult}`);
    return this.faiRepo.save(fai);
  }

  /**
   * 승인 (PASS/FAIL/CONDITIONAL 상태에서)
   */
  async approve(id: number, userId: string) {
    const fai = await this.faiRepo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    if (!['PASS', 'FAIL', 'CONDITIONAL'].includes(fai.status)) {
      throw new BadRequestException('판정 완료 상태에서만 승인할 수 있습니다.');
    }
    fai.approvalCode = userId;
    fai.approvedAt = new Date();
    fai.updatedBy = userId;
    return this.faiRepo.save(fai);
  }

  // =============================================
  // 검사항목 관리
  // =============================================

  /**
   * 검사항목 일괄 등록 (기존 항목 삭제 후 재등록)
   */
  async addItems(faiId: number, items: FaiItemDto[], userId?: string) {
    const fai = await this.faiRepo.findOne({ where: { id: faiId } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');

    await this.itemRepo.delete({ faiId });
    const saved = await this.saveItems(faiId, items);

    // REQUESTED → INSPECTING 자동 전이
    if (fai.status === 'REQUESTED' || fai.status === 'SAMPLING') {
      fai.status = 'INSPECTING';
      fai.updatedBy = userId ?? fai.updatedBy;
      await this.faiRepo.save(fai);
    }

    return saved;
  }

  /**
   * 검사항목 저장 헬퍼
   */
  private async saveItems(faiId: number, items: FaiItemDto[]) {
    const entities = items.map((item) =>
      this.itemRepo.create({
        faiId,
        seq: item.seq,
        inspectItem: item.inspectItem,
        specMin: item.specMin ?? null,
        specMax: item.specMax ?? null,
        measuredValue: item.measuredValue ?? null,
        unit: item.unit ?? null,
        result: item.result ?? null,
        remarks: item.remarks ?? null,
      }),
    );
    return this.itemRepo.save(entities);
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 상태별 통계 (건수)
   */
  async getStats(company?: string, plant?: string) {
    const qb = this.faiRepo
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (company) qb.andWhere('f.company = :company', { company });
    if (plant) qb.andWhere('f.plant = :plant', { plant });

    qb.groupBy('f.status');
    return qb.getRawMany();
  }
}
