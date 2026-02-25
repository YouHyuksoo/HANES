/**
 * @file src/modules/customs/services/customs.service.ts
 * @description 보세관리 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { CustomsEntry } from '../../../entities/customs-entry.entity';
import { CustomsLot } from '../../../entities/customs-lot.entity';
import { CustomsUsageReport } from '../../../entities/customs-usage-report.entity';
import {
  CreateCustomsEntryDto,
  UpdateCustomsEntryDto,
  CustomsEntryQueryDto,
  CreateCustomsLotDto,
  UpdateCustomsLotDto,
  CreateUsageReportDto,
  UpdateUsageReportDto,
  UsageReportQueryDto,
} from '../dto/customs.dto';

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);

  constructor(
    @InjectRepository(CustomsEntry)
    private readonly customsEntryRepository: Repository<CustomsEntry>,
    @InjectRepository(CustomsLot)
    private readonly customsLotRepository: Repository<CustomsLot>,
    @InjectRepository(CustomsUsageReport)
    private readonly customsUsageReportRepository: Repository<CustomsUsageReport>,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================================
  // 수입신고 (Customs Entry)
  // ============================================================================

  async findAllEntries(query: CustomsEntryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.customsEntryRepository
      .createQueryBuilder('ce')
      .leftJoinAndSelect(
        'customs_lot',
        'cl',
        'cl.ENTRY_ID = ce.ID',
      )
      .select([
        'ce.id',
        'ce.entryNo',
        'ce.blNo',
        'ce.invoiceNo',
        'ce.declarationDate',
        'ce.clearanceDate',
        'ce.origin',
        'ce.hsCode',
        'ce.totalAmount',
        'ce.currency',
        'ce.status',
        'ce.remark',
        'ce.createdAt',
        'ce.updatedAt',
      ])
      .addSelect([
        'cl.id AS cl_id',
        'cl.LOT_NO AS cl_lotNo',
        'cl.ITEM_CODE AS cl_itemCode',
        'cl.QTY AS cl_qty',
        'cl.USED_QTY AS cl_usedQty',
        'cl.REMAIN_QTY AS cl_remainQty',
        'cl.STATUS AS cl_status',
      ])

    if (company) {
      queryBuilder.andWhere('ce.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('ce.plant = :plant', { plant });
    }
    if (status) {
      queryBuilder.andWhere('ce.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(ce.entryNo) LIKE UPPER(:search) OR UPPER(ce.invoiceNo) LIKE UPPER(:search) OR UPPER(ce.blNo) LIKE UPPER(:search))',
        { search: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('ce.declarationDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    queryBuilder.orderBy('ce.createdAt', 'DESC').skip(skip).take(limit);

    // Get total count
    const countQuery = this.customsEntryRepository
      .createQueryBuilder('ce')

    if (status) {
      countQuery.andWhere('ce.status = :status', { status });
    }

    if (search) {
      countQuery.andWhere(
        '(UPPER(ce.entryNo) LIKE UPPER(:search) OR UPPER(ce.invoiceNo) LIKE UPPER(:search) OR UPPER(ce.blNo) LIKE UPPER(:search))',
        { search: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      countQuery.andWhere('ce.declarationDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [entries, total] = await Promise.all([
      queryBuilder.getMany(),
      countQuery.getCount(),
    ]);

    // 일괄 조회로 N+1 방지
    const entryIds = entries.map((e) => e.id);
    const lots = entryIds.length > 0
      ? await this.customsLotRepository.find({
          where: { entryId: In(entryIds) },
          select: ['id', 'entryId', 'lotNo', 'itemCode', 'qty', 'usedQty', 'remainQty', 'status'],
        })
      : [];

    const lotsByEntryId = new Map<number, CustomsLot[]>();
    for (const lot of lots) {
      if (!lotsByEntryId.has(lot.entryId)) lotsByEntryId.set(lot.entryId, []);
      lotsByEntryId.get(lot.entryId)!.push(lot);
    }

    const data = entries.map((entry) => ({
      ...entry,
      customsLots: lotsByEntryId.get(entry.id) || [],
    }));

    return { data, total, page, limit };
  }

  async findEntryById(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    const entry = await this.customsEntryRepository.findOne({
      where: { id: numId },
    });

    if (!entry) {
      throw new NotFoundException(`수입신고를 찾을 수 없습니다: ${id}`);
    }

    const lots = await this.customsLotRepository.find({
      where: { entryId: numId },
    });

    // 일괄 조회로 N+1 방지
    const lotIds = lots.map((l) => l.id);
    const reports = lotIds.length > 0
      ? await this.customsUsageReportRepository.find({ where: { customsLotId: In(lotIds) } })
      : [];

    const reportsByLotId = new Map<number, CustomsUsageReport[]>();
    for (const report of reports) {
      if (!reportsByLotId.has(report.customsLotId)) reportsByLotId.set(report.customsLotId, []);
      reportsByLotId.get(report.customsLotId)!.push(report);
    }

    const lotsWithReports = lots.map((lot) => ({
      ...lot,
      usageReports: reportsByLotId.get(lot.id) || [],
    }));

    return { ...entry, customsLots: lotsWithReports };
  }

  async createEntry(dto: CreateCustomsEntryDto) {
    const existing = await this.customsEntryRepository.findOne({
      where: { entryNo: dto.entryNo },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 수입신고번호입니다: ${dto.entryNo}`);
    }

    const entry = this.customsEntryRepository.create({
      entryNo: dto.entryNo,
      blNo: dto.blNo,
      invoiceNo: dto.invoiceNo,
      declarationDate: dto.declarationDate ? new Date(dto.declarationDate) : null,
      clearanceDate: dto.clearanceDate ? new Date(dto.clearanceDate) : null,
      origin: dto.origin,
      hsCode: dto.hsCode,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      remark: dto.remark,
    });

    return this.customsEntryRepository.save(entry);
  }

  async updateEntry(id: string | number, dto: UpdateCustomsEntryDto) {
    await this.findEntryById(id);

    const updateData: Partial<CustomsEntry> = {};
    if (dto.blNo !== undefined) updateData.blNo = dto.blNo;
    if (dto.invoiceNo !== undefined) updateData.invoiceNo = dto.invoiceNo;
    if (dto.declarationDate !== undefined) updateData.declarationDate = new Date(dto.declarationDate);
    if (dto.clearanceDate !== undefined) updateData.clearanceDate = new Date(dto.clearanceDate);
    if (dto.origin !== undefined) updateData.origin = dto.origin;
    if (dto.hsCode !== undefined) updateData.hsCode = dto.hsCode;
    if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    await this.customsEntryRepository.update(numId, updateData);
    return this.findEntryById(numId);
  }

  async deleteEntry(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    await this.findEntryById(numId);

    await this.customsEntryRepository.delete(numId);
    return { id };
  }

  // ============================================================================
  // 보세자재 LOT (Customs Lot)
  // ============================================================================

  async findLotsByEntryId(entryId: string | number) {
    const numEntryId = typeof entryId === 'string' ? parseInt(entryId, 10) : entryId;
    const lots = await this.customsLotRepository.find({
      where: { entryId: numEntryId },
      order: { createdAt: 'DESC' },
    });

    // 일괄 조회로 N+1 방지
    const lotIds = lots.map((l) => l.id);
    const reports = lotIds.length > 0
      ? await this.customsUsageReportRepository.find({ where: { customsLotId: In(lotIds) } })
      : [];

    const reportsByLotId = new Map<number, CustomsUsageReport[]>();
    for (const report of reports) {
      if (!reportsByLotId.has(report.customsLotId)) reportsByLotId.set(report.customsLotId, []);
      reportsByLotId.get(report.customsLotId)!.push(report);
    }

    return lots.map((lot) => ({
      ...lot,
      usageReports: reportsByLotId.get(lot.id) || [],
    }));
  }

  async findLotById(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    const lot = await this.customsLotRepository.findOne({
      where: { id: numId },
    });

    if (!lot) {
      throw new NotFoundException(`보세자재 LOT을 찾을 수 없습니다: ${id}`);
    }

    const entry = await this.customsEntryRepository.findOne({
      where: { id: lot.entryId },
    });

    const reports = await this.customsUsageReportRepository.find({
      where: { customsLotId: numId },
    });

    return { ...lot, entry, usageReports: reports };
  }

  async createLot(dto: CreateCustomsLotDto) {
    const lot = this.customsLotRepository.create({
      entryId: typeof dto.entryId === 'string' ? parseInt(dto.entryId, 10) : dto.entryId,
      lotNo: dto.lotNo,
      itemCode: dto.itemCode,
      qty: dto.qty,
      remainQty: dto.qty,
      unitPrice: dto.unitPrice,
    });

    return this.customsLotRepository.save(lot);
  }

  async updateLot(id: string | number, dto: UpdateCustomsLotDto) {
    await this.findLotById(id);

    const updateData: Partial<CustomsLot> = {};
    if (dto.status !== undefined) updateData.status = dto.status;

    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    await this.customsLotRepository.update(numId, updateData);
    return this.findLotById(numId);
  }

  // ============================================================================
  // 사용신고 (Usage Report)
  // ============================================================================

  async findAllUsageReports(query: UsageReportQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.customsUsageReportRepository
      .createQueryBuilder('cur')
      .leftJoinAndSelect(CustomsLot, 'cl', 'cl.ID = cur.CUSTOMS_LOT_ID')
      .leftJoinAndSelect(CustomsEntry, 'ce', 'ce.ID = cl.ENTRY_ID')
      .where('1=1');

    if (company) {
      queryBuilder.andWhere('cur.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('cur.plant = :plant', { plant });
    }
    if (status) {
      queryBuilder.andWhere('cur.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('cur.usageDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [reports, total] = await Promise.all([
      queryBuilder
        .orderBy('cur.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // 일괄 조회로 N+1 방지 (reports → lots → entries)
    const lotIds = [...new Set(reports.map((r) => r.customsLotId).filter(Boolean))];
    const lots = lotIds.length > 0
      ? await this.customsLotRepository.find({ where: { id: In(lotIds) } })
      : [];
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    const entryIds = [...new Set(lots.map((l) => l.entryId).filter(Boolean))];
    const entries = entryIds.length > 0
      ? await this.customsEntryRepository.find({ where: { id: In(entryIds) } })
      : [];
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    const data = reports.map((report) => {
      const lot = lotMap.get(report.customsLotId);
      return {
        ...report,
        customsLot: lot ? { ...lot, entry: entryMap.get(lot.entryId) || null } : null,
      };
    });

    return { data, total, page, limit };
  }

  async createUsageReport(dto: CreateUsageReportDto) {
    const numLotId = typeof dto.customsLotId === 'string' ? parseInt(dto.customsLotId, 10) : dto.customsLotId;
    const lot = await this.findLotById(numLotId);

    if (lot.remainQty < dto.usageQty) {
      throw new BadRequestException(
        `사용 가능 수량(${lot.remainQty})을 초과했습니다.`,
      );
    }

    // 시퀀스 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.customsUsageReportRepository.count({
      where: {
        reportNo: `USG${today}%`,
      },
    });
    const reportNo = `USG${today}${String(count + 1).padStart(4, '0')}`;

    // 트랜잭션으로 사용신고 생성 및 LOT 업데이트
    return this.dataSource.transaction(async (manager) => {
      const report = manager.create(CustomsUsageReport, {
        reportNo,
        customsLotId: numLotId,
        usageQty: dto.usageQty,
        workerCode: dto.workerId,
        remark: dto.remark,
      });

      await manager.save(report);

      // LOT 잔여수량 업데이트
      const newUsedQty = lot.usedQty + dto.usageQty;
      const newRemainQty = lot.qty - newUsedQty;
      const newStatus = newRemainQty === 0 ? 'RELEASED' : 'PARTIAL';

      await manager.update(
        CustomsLot,
        { id: numLotId },
        {
          usedQty: newUsedQty,
          remainQty: newRemainQty,
          status: newStatus,
        },
      );

      return report;
    });
  }

  async updateUsageReport(id: string | number, dto: UpdateUsageReportDto) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    const report = await this.customsUsageReportRepository.findOne({
      where: { id: numId },
    });

    if (!report) {
      throw new NotFoundException(`사용신고를 찾을 수 없습니다: ${id}`);
    }

    const updateData: Partial<CustomsUsageReport> = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.status === 'REPORTED') updateData.reportDate = new Date();
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.customsUsageReportRepository.update(numId, updateData);
    return this.customsUsageReportRepository.findOne({ where: { id: numId } });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getCustomsSummary() {
    const [totalEntries, pendingEntries, bondedLots, totalBondedQty] = await Promise.all([
      this.customsEntryRepository.count({ where: {} }),
      this.customsEntryRepository.count({
        where: { status: 'PENDING' },
      }),
      this.customsLotRepository.count({ where: { status: 'BONDED' } }),
      this.customsLotRepository
        .createQueryBuilder('cl')
        .select('SUM(cl.remainQty)', 'total')
        .where('cl.status IN (:...statuses)', { statuses: ['BONDED', 'PARTIAL'] })
        .getRawOne(),
    ]);

    return {
      totalEntries,
      pendingEntries,
      bondedLots,
      totalBondedQty: totalBondedQty?.total || 0,
    };
  }
}
