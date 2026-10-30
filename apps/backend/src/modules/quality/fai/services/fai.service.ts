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
import { EntityManager, Repository } from 'typeorm';
import { FaiRequest } from '../../../../entities/fai-request.entity';
import { FaiItem } from '../../../../entities/fai-item.entity';
import { NumberingService } from '../../../../shared/numbering.service';
import { parseDateEnd, parseDateStart } from '../../../../shared/date.util';
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
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  // =============================================
  // FAI 번호 자동채번
  // =============================================

  /**
   * FAI 번호 자동채번: FAI-YYYYMMDD-NNN
   * NUM_RULE_MASTERS(FAI_NO) 행을 SELECT FOR UPDATE로 잠가 동시 채번을 직렬화한다.
   */
  private async generateFaiNo(): Promise<string> {
    return this.numbering.next('FAI_NO');
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
      fromDate,
      toDate,
    } = query;

    const qb = this.faiRepo.createQueryBuilder('f');

    if (company) qb.andWhere('f.company = :company', { company });
    if (plant) qb.andWhere('f.plant = :plant', { plant });
    if (status) qb.andWhere('f.status = :status', { status });
    if (triggerType) qb.andWhere('f.triggerType = :triggerType', { triggerType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(f.faiNo LIKE :s OR f.itemCode LIKE :s)',
        { s: `%${upper}%` },
      );
    }
    // 시작일·종료일은 하나만 와도 걸린다(둘 다 있어야 걸리면 하나만 보냈을 때 구간이 통째로 사라졌고, ISO 시각은 날짜 변환이 깨졌다)
    const from = parseDateStart(fromDate);
    const to = parseDateEnd(toDate);
    if (from) qb.andWhere('f.createdAt >= :fromDate', { fromDate: from });
    if (to) qb.andWhere('f.createdAt <= :toDate', { toDate: to });

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
  async findById(faiNo: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) {
      throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    }
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    const items = await this.itemRepo.find({
      where: { faiId: faiNo },
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
    const faiNo = await this.generateFaiNo();
    const { items, ...requestFields } = dto;
    if (items && items.length > 0) this.assertItemsValid(items);

    const entity = this.faiRepo.create({
      ...requestFields,
      faiNo,
      status: 'REQUESTED',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    // 요청과 검사항목은 한 트랜잭션(항목 저장이 실패하면 요청만 남던 것)
    const saved = await this.faiRepo.manager.transaction(async (manager) => {
      const created = await manager.getRepository(FaiRequest).save(entity);
      if (items && items.length > 0) {
        await this.saveItems(created.faiNo, items, manager);
      }
      return created;
    });

    this.logger.log(`초물검사 등록: ${faiNo} (itemCode: ${dto.itemCode})`);
    return saved;
  }

  /**
   * FAI 요청 수정 (REQUESTED 상태에서만 가능)
   */
  async update(faiNo: string, dto: UpdateFaiDto, userId: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    if (fai.status !== 'REQUESTED') {
      throw new BadRequestException('요청 상태에서만 수정할 수 있습니다.');
    }
    const { items, ...updateFields } = dto;
    // 비울 수 없는 칸(유형·품목·샘플 수량)에 null 이 오면 그대로 둔다(저장 시 NOT NULL 오류 500)
    for (const key of ['triggerType', 'itemCode', 'sampleQty'] as const) {
      if (updateFields[key] == null) delete updateFields[key];
    }
    Object.assign(fai, updateFields, { updatedBy: userId });
    return this.faiRepo.save(fai);
  }

  /**
   * FAI 요청 삭제 (REQUESTED 상태에서만 가능)
   */
  async delete(faiNo: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    if (fai.status !== 'REQUESTED') {
      throw new BadRequestException('요청 상태에서만 삭제할 수 있습니다.');
    }
    await this.itemRepo.delete({ faiId: faiNo });
    await this.faiRepo.remove(fai);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 검사 시작 (REQUESTED → SAMPLING)
   */
  async start(faiNo: string, userId: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
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
  async complete(faiNo: string, dto: CompleteFaiDto, userId: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    if (!['SAMPLING', 'INSPECTING'].includes(fai.status)) {
      throw new BadRequestException('샘플링 또는 검사중 상태에서만 완료할 수 있습니다.');
    }

    // 자동 판정: items 기반
    const items = await this.itemRepo.find({ where: { faiId: faiNo } });
    let autoResult = dto.result;
    if (items.length > 0 && dto.result !== 'CONDITIONAL') {
      // 판정(OK/NG)이 없는 항목이 있는데 NG 만 보고 합격시키던 것
      const unjudged = items.filter((item) => item.result !== 'OK' && item.result !== 'NG').length;
      if (unjudged > 0) {
        throw new BadRequestException(`판정(OK/NG)이 입력되지 않은 검사항목이 ${unjudged}건 있어 완료할 수 없습니다.`);
      }
      const hasNg = items.some((item) => item.result === 'NG');
      autoResult = hasNg ? 'FAIL' : 'PASS';
    }

    fai.status = autoResult;
    fai.result = autoResult;
    fai.inspectDate = new Date();
    fai.remark = dto.remark ?? fai.remark;
    fai.updatedBy = userId;

    this.logger.log(`초물검사 완료: ${fai.faiNo}, 판정=${autoResult}`);
    return this.faiRepo.save(fai);
  }

  /**
   * 승인 (PASS/FAIL/CONDITIONAL 상태에서)
   */
  async approve(faiNo: string, userId: string, company?: string, plant?: string) {
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    if (!['PASS', 'FAIL', 'CONDITIONAL'].includes(fai.status)) {
      throw new BadRequestException('판정 완료 상태에서만 승인할 수 있습니다.');
    }
    if (fai.approvedAt) {
      throw new BadRequestException('이미 승인된 초물검사입니다.');
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
  async addItems(faiNo: string, items: FaiItemDto[], userId?: string, company?: string, plant?: string) {
    this.assertItemsValid(items);
    const fai = await this.faiRepo.findOne({ where: { faiNo, ...this.tenantWhere(company, plant) } });
    if (!fai) throw new NotFoundException('초물검사 요청을 찾을 수 없습니다.');
    this.assertSameTenant('초물검사 요청', fai, company, plant);
    // 판정이 끝난 요청은 검사항목을 바꿀 수 없다(판정 뒤에 항목을 갈아 끼워 기록이 달라지던 것)
    if (['PASS', 'FAIL', 'CONDITIONAL'].includes(fai.status)) {
      throw new BadRequestException('판정이 끝난 초물검사는 검사항목을 바꿀 수 없습니다.');
    }

    // 항목 삭제·재등록·상태 전이는 한 트랜잭션(재등록이 실패하면 기존 항목만 사라지던 것)
    return this.faiRepo.manager.transaction(async (manager) => {
      await manager.getRepository(FaiItem).delete({ faiId: faiNo });
      const saved = await this.saveItems(faiNo, items, manager);

      // REQUESTED → INSPECTING 자동 전이
      if (fai.status === 'REQUESTED' || fai.status === 'SAMPLING') {
        fai.status = 'INSPECTING';
        fai.updatedBy = userId ?? fai.updatedBy;
        await manager.getRepository(FaiRequest).save(fai);
      }

      return saved;
    });
  }

  /** 검사항목 본문 검증: 배열, 순번(정수)·항목명 필수, 순번 중복 없음, 판정은 OK/NG 만 (배열 본문은 DTO 검증을 거치지 않는다) */
  private assertItemsValid(items: unknown): void {
    if (!Array.isArray(items)) {
      throw new BadRequestException('검사항목은 배열이어야 합니다.');
    }
    const seen = new Set<number>();
    for (const raw of items as Array<Record<string, unknown>>) {
      const seq = Number(raw?.seq);
      const name = typeof raw?.inspectItem === 'string' ? raw.inspectItem.trim() : '';
      if (raw?.seq == null || !Number.isInteger(seq) || !name) {
        throw new BadRequestException('검사항목의 순번(정수)과 항목명은 필수입니다.');
      }
      if (raw.result != null && raw.result !== 'OK' && raw.result !== 'NG') {
        throw new BadRequestException('검사항목의 판정은 OK 또는 NG 여야 합니다.');
      }
      if (seen.has(seq)) {
        throw new BadRequestException(`검사항목 순번이 중복되었습니다: ${seq}`);
      }
      seen.add(seq);
    }
  }

  /**
   * 검사항목 저장 헬퍼
   */
  private async saveItems(faiId: string, items: FaiItemDto[], manager?: EntityManager) {
    const repo = manager ? manager.getRepository(FaiItem) : this.itemRepo;
    const entities = items.map((item) =>
      repo.create({
        faiId,
        seq: item.seq,
        inspectItem: item.inspectItem,
        specMin: item.specMin ?? null,
        specMax: item.specMax ?? null,
        measuredValue: item.measuredValue ?? null,
        unit: item.unit ?? null,
        result: item.result ?? null,
        remark: item.remark ?? null,
      }),
    );
    return repo.save(entities);
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
