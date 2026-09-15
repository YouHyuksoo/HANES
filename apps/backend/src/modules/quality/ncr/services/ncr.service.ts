/**
 * @file quality/ncr/services/ncr.service.ts
 * @description 부적합 보고서(NCR) 서비스
 *
 * 초보자 가이드:
 * 1. 발행(create) → 처리방안 확정(setDisposition) → 원인·대책(setCause) → 종결(close) 순으로 진행한다.
 * 2. 상태는 OPEN → IN_PROGRESS → CLOSED 한 방향이다. 종결된 건은 수정하지 않는다
 *    (품질기록이라 사후 변경을 막는다 — 고쳐야 하면 새 NCR 을 발행한다).
 * 3. 같은 출처(sourceType+sourceId)로 중복 발행을 막는다. 같은 검사 불합격에 NCR 이 둘 생기면
 *    어느 쪽이 정본인지 알 수 없다.
 * 4. 채번은 SEQ_RULES 규칙(NCR_NO)을 쓴다 — 프로젝트 표준(PKG_SEQ_GENERATOR).
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NcrReport } from '../../../../entities/ncr-report.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { parseDateStart, parseDateEnd } from '../../../../shared/date.util';
import {
  CloseNcrDto, CreateNcrDto, NcrCauseDto, NcrDispositionDto, NcrQueryDto, UpdateNcrDto,
} from '../dto/ncr.dto';

@Injectable()
export class NcrService {
  private readonly logger = new Logger(NcrService.name);

  constructor(
    @InjectRepository(NcrReport)
    private readonly ncrRepo: Repository<NcrReport>,
    private readonly seqGenerator: SeqGeneratorService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 목록 — 발행일 구간 기준(이력성 목록이라 조건 없는 전량 조회를 하지 않는다) */
  async findAll(query: NcrQueryDto, company?: string, plant?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.ncrRepo.createQueryBuilder('n')
      .orderBy('n.issuedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (company) qb.andWhere('n.company = :company', { company });
    if (plant) qb.andWhere('n.plant = :plant', { plant });

    const from = parseDateStart(query.fromDate);
    const to = parseDateEnd(query.toDate);
    if (from && to) qb.andWhere('n.issuedAt BETWEEN :from AND :to', { from, to });

    if (query.targetType) qb.andWhere('n.targetType = :targetType', { targetType: query.targetType });
    if (query.foundStage) qb.andWhere('n.foundStage = :foundStage', { foundStage: query.foundStage });
    if (query.defectGrade) qb.andWhere('n.defectGrade = :defectGrade', { defectGrade: query.defectGrade });
    if (query.status) qb.andWhere('n.status = :status', { status: query.status });
    if (query.search?.trim()) {
      qb.andWhere(
        '(n.ncrNo LIKE :kw OR n.itemCode LIKE :kw OR n.lotNo LIKE :kw OR n.orderNo LIKE :kw)',
        { kw: `%${query.search.trim()}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(ncrNo: string, company?: string, plant?: string): Promise<NcrReport> {
    const row = await this.ncrRepo.findOne({
      where: { ncrNo, ...this.tenantWhere(company, plant) },
    });
    if (!row) throw new NotFoundException(`부적합 보고서를 찾을 수 없습니다: ${ncrNo}`);
    return row;
  }

  /** 발행 */
  async create(dto: CreateNcrDto, userId?: string, company?: string, plant?: string): Promise<NcrReport> {
    await this.assertSourceNotUsed(dto.sourceType, dto.sourceId, company, plant);

    const ncrNo = await this.seqGenerator.getNo('NCR_NO');
    const now = new Date();

    const row = this.ncrRepo.create({
      ncrNo,
      company: company ?? '40',
      plant: plant ?? '1000',
      issuedAt: now,
      writtenAt: now,
      dueDate: parseDateStart(dto.dueDate),
      issueDept: dto.issueDept ?? null,
      writerCode: dto.writerCode ?? userId ?? null,
      targetType: dto.targetType,
      foundStage: dto.foundStage,
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      itemCode: dto.itemCode,
      lotNo: dto.lotNo ?? null,
      serialNo: dto.serialNo ?? null,
      orderNo: dto.orderNo ?? null,
      poNo: dto.poNo ?? null,
      vendorCode: dto.vendorCode ?? null,
      inspectQty: dto.inspectQty ?? null,
      defectQty: dto.defectQty ?? null,
      defectCode: dto.defectCode ?? null,
      categoryCode: dto.categoryCode ?? null,
      defectGrade: dto.defectGrade ?? null,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      remark: dto.remark ?? null,
      status: 'OPEN',
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });

    const saved = await this.ncrRepo.save(row);
    this.logger.log(`NCR 발행: ${saved.ncrNo} (${dto.targetType}/${dto.foundStage}, ${dto.itemCode})`);
    return saved;
  }

  async update(ncrNo: string, dto: UpdateNcrDto, userId?: string, company?: string, plant?: string): Promise<NcrReport> {
    const row = await this.findOne(ncrNo, company, plant);
    this.assertNotClosed(row);

    // 출처를 바꾸는 경우에도 중복 발행 검사를 다시 건다
    if (dto.sourceType !== undefined || dto.sourceId !== undefined) {
      const nextType = dto.sourceType ?? row.sourceType ?? undefined;
      const nextId = dto.sourceId ?? row.sourceId ?? undefined;
      if (nextType !== row.sourceType || nextId !== row.sourceId) {
        await this.assertSourceNotUsed(nextType, nextId, company, plant, ncrNo);
      }
    }

    Object.assign(row, {
      ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
      ...(dto.foundStage !== undefined ? { foundStage: dto.foundStage } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.sourceType !== undefined ? { sourceType: dto.sourceType || null } : {}),
      ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId || null } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: parseDateStart(dto.dueDate) } : {}),
      ...(dto.issueDept !== undefined ? { issueDept: dto.issueDept || null } : {}),
      ...(dto.lotNo !== undefined ? { lotNo: dto.lotNo || null } : {}),
      ...(dto.serialNo !== undefined ? { serialNo: dto.serialNo || null } : {}),
      ...(dto.orderNo !== undefined ? { orderNo: dto.orderNo || null } : {}),
      ...(dto.poNo !== undefined ? { poNo: dto.poNo || null } : {}),
      ...(dto.vendorCode !== undefined ? { vendorCode: dto.vendorCode || null } : {}),
      ...(dto.inspectQty !== undefined ? { inspectQty: dto.inspectQty ?? null } : {}),
      ...(dto.defectQty !== undefined ? { defectQty: dto.defectQty ?? null } : {}),
      ...(dto.defectCode !== undefined ? { defectCode: dto.defectCode || null } : {}),
      ...(dto.categoryCode !== undefined ? { categoryCode: dto.categoryCode || null } : {}),
      ...(dto.defectGrade !== undefined ? { defectGrade: dto.defectGrade || null } : {}),
      ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark || null } : {}),
      updatedBy: userId ?? null,
    });
    return this.ncrRepo.save(row);
  }

  /** 처리방안 확정 — OPEN → IN_PROGRESS */
  async setDisposition(
    ncrNo: string, dto: NcrDispositionDto, userId?: string, company?: string, plant?: string,
  ): Promise<NcrReport> {
    const row = await this.findOne(ncrNo, company, plant);
    this.assertNotClosed(row);

    row.disposition = dto.disposition;
    row.dispositionDetail = dto.dispositionDetail ?? null;
    row.dueActionDate = parseDateStart(dto.dueActionDate);
    row.responsibleCode = dto.responsibleCode ?? null;
    row.respondedAt = new Date();
    row.status = 'IN_PROGRESS';
    row.updatedBy = userId ?? null;

    return this.ncrRepo.save(row);
  }

  /** 원인분석·재발방지 */
  async setCause(
    ncrNo: string, dto: NcrCauseDto, userId?: string, company?: string, plant?: string,
  ): Promise<NcrReport> {
    const row = await this.findOne(ncrNo, company, plant);
    this.assertNotClosed(row);

    if (dto.causeCategory !== undefined) row.causeCategory = dto.causeCategory || null;
    if (dto.rootCause !== undefined) row.rootCause = dto.rootCause || null;
    if (dto.preventiveAction !== undefined) row.preventiveAction = dto.preventiveAction || null;
    row.updatedBy = userId ?? null;

    return this.ncrRepo.save(row);
  }

  /**
   * 종결 — 처리방안과 원인이 모두 채워져야 닫을 수 있다.
   * 비어 있는 채로 닫으면 "종결됐는데 무엇을 어떻게 했는지 모르는" 기록이 남는다.
   */
  async close(ncrNo: string, dto: CloseNcrDto, userId?: string, company?: string, plant?: string): Promise<NcrReport> {
    const row = await this.findOne(ncrNo, company, plant);
    if (row.status === 'CLOSED') {
      throw new BadRequestException(`이미 종결된 부적합 보고서입니다: ${ncrNo}`);
    }
    if (!row.disposition) {
      throw new BadRequestException('처리방안을 먼저 확정해야 종결할 수 있습니다.');
    }
    if (!row.rootCause?.trim()) {
      throw new BadRequestException('발생 원인을 기재해야 종결할 수 있습니다.');
    }

    row.approverCode = dto.approverCode;
    row.approvedAt = new Date();
    row.status = 'CLOSED';
    row.closedAt = new Date();
    row.closedBy = userId ?? dto.approverCode;
    if (dto.remark !== undefined) row.remark = dto.remark || null;
    row.updatedBy = userId ?? null;

    this.logger.log(`NCR 종결: ${ncrNo} (처리 ${row.disposition}, 승인 ${dto.approverCode})`);
    return this.ncrRepo.save(row);
  }

  /** CAPA 연결 — 정식 시정조치가 필요한 건에만 건다 */
  async linkCapa(ncrNo: string, capaNo: string, userId?: string, company?: string, plant?: string): Promise<NcrReport> {
    const row = await this.findOne(ncrNo, company, plant);
    row.capaNo = capaNo;
    row.updatedBy = userId ?? null;
    return this.ncrRepo.save(row);
  }

  /** 같은 검사 불합격에 NCR 이 둘 생기면 어느 쪽이 정본인지 알 수 없다 */
  private async assertSourceNotUsed(
    sourceType?: string | null, sourceId?: string | null,
    company?: string, plant?: string, excludeNcrNo?: string,
  ): Promise<void> {
    if (!sourceType || !sourceId) return;

    const existing = await this.ncrRepo.findOne({
      where: { sourceType, sourceId, ...this.tenantWhere(company, plant) },
    });
    if (existing && existing.ncrNo !== excludeNcrNo) {
      throw new BadRequestException(
        `이미 부적합 보고서가 발행된 건입니다: ${existing.ncrNo} (${sourceType} ${sourceId})`,
      );
    }
  }

  private assertNotClosed(row: NcrReport): void {
    if (row.status === 'CLOSED') {
      throw new BadRequestException(
        `종결된 부적합 보고서는 수정할 수 없습니다: ${row.ncrNo}. 필요하면 새로 발행하세요.`,
      );
    }
  }
}
