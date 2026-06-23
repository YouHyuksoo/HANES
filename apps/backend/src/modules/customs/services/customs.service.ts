/**
 * @file src/modules/customs/services/customs.service.ts
 * @description 보세관리 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. CustomsLot은 복합 PK (entryNo + matUid) 사용
 * 2. CustomsUsageReport는 lotEntryNo + lotMatUid 로 Lot 참조
 * 3. Map 키로 `${entryNo}::${matUid}` 복합 문자열 사용
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';
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

/** 복합키를 Map 키 문자열로 변환 */
function lotKey(entryNo: string, matUid: string): string {
  return `${entryNo}::${matUid}`;
}

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
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  // ============================================================================
  // 수입신고 (Customs Entry)
  // ============================================================================

  async findAllEntries(query: CustomsEntryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.customsEntryRepository
      .createQueryBuilder('ce')
      .select([
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
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(ce.entryNo LIKE :search OR ce.invoiceNo LIKE :search OR ce.blNo LIKE :search)',
        { search: `%${upper}%` },
      );
    }

    if (fromDate && toDate) {
      queryBuilder.andWhere(
        "ce.declarationDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND ce.declarationDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
        { fromDate, toDate },
      );
    }

    queryBuilder.orderBy('ce.createdAt', 'DESC').skip(skip).take(limit);

    // Get total count
    const countQuery = this.customsEntryRepository
      .createQueryBuilder('ce')

    if (company) {
      countQuery.andWhere('ce.company = :company', { company });
    }
    if (plant) {
      countQuery.andWhere('ce.plant = :plant', { plant });
    }
    if (status) {
      countQuery.andWhere('ce.status = :status', { status });
    }

    if (search) {
      const upper2 = search.toUpperCase();
      countQuery.andWhere(
        '(ce.entryNo LIKE :search OR ce.invoiceNo LIKE :search OR ce.blNo LIKE :search)',
        { search: `%${upper2}%` },
      );
    }

    if (fromDate && toDate) {
      countQuery.andWhere(
        "ce.declarationDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND ce.declarationDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
        { fromDate, toDate },
      );
    }

    const [entries, total] = await Promise.all([
      queryBuilder.getMany(),
      countQuery.getCount(),
    ]);

    // 일괄 조회로 N+1 방지
    const entryNos = entries.map((e) => e.entryNo);
    const lots = entryNos.length > 0
      ? await this.customsLotRepository.find({
          where: { entryNo: In(entryNos), ...this.tenantWhere(company, plant) },
          select: ['entryNo', 'matUid', 'itemCode', 'qty', 'usedQty', 'remainQty', 'status'],
        })
      : [];

    const lotsByEntryNo = new Map<string, CustomsLot[]>();
    for (const lot of lots) {
      if (!lotsByEntryNo.has(lot.entryNo)) lotsByEntryNo.set(lot.entryNo, []);
      lotsByEntryNo.get(lot.entryNo)!.push(lot);
    }

    const data = entries.map((entry) => ({
      ...entry,
      customsLots: lotsByEntryNo.get(entry.entryNo) || [],
    }));

    return { data, total, page, limit };
  }

  async findAllStock(query: CustomsEntryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;
    const qb = this.customsLotRepository
      .createQueryBuilder('cl')
      .leftJoin(CustomsEntry, 'ce', 'ce.entryNo = cl.entryNo AND ce.company = cl.company AND ce.plant = cl.plant');

    if (company) qb.andWhere('cl.company = :company', { company });
    if (plant) qb.andWhere('cl.plant = :plant', { plant });
    if (status) qb.andWhere('cl.status = :status', { status });
    if (search) {
      qb.andWhere('(cl.entryNo LIKE :search OR cl.matUid LIKE :search OR cl.itemCode LIKE :search)', {
        search: `%${search.toUpperCase()}%`,
      });
    }

    qb.orderBy('cl.createdAt', 'DESC').skip(skip).take(limit);
    const [lots, total] = await Promise.all([qb.getMany(), qb.clone().skip(0).take(undefined).getCount()]);
    const entryNos = [...new Set(lots.map((lot) => lot.entryNo))];
    const entries = entryNos.length
      ? await this.customsEntryRepository.find({
          where: { entryNo: In(entryNos), ...this.tenantWhere(company, plant) },
          select: ['entryNo', 'origin', 'declarationDate'],
        })
      : [];
    const entryMap = new Map(entries.map((entry) => [entry.entryNo, entry]));
    const data = lots.map((lot) => ({
      ...lot,
      origin: entryMap.get(lot.entryNo)?.origin ?? '',
      declarationDate: entryMap.get(lot.entryNo)?.declarationDate ?? null,
    }));
    return { data, total, page, limit };
  }

  async findEntryById(entryNo: string, company?: string, plant?: string) {
    const entry = await this.customsEntryRepository.findOne({
      where: { entryNo, ...this.tenantWhere(company, plant) },
    });

    if (!entry) {
      throw new NotFoundException(`수입신고를 찾을 수 없습니다: ${entryNo}`);
    }

    const lots = await this.customsLotRepository.find({
      where: { entryNo, ...this.tenantWhere(company, plant) },
    });

    // 일괄 조회로 N+1 방지: lotEntryNo + lotMatUid 복합키로 조회
    const lotKeys = lots.map((l) => ({ lotEntryNo: l.entryNo, lotMatUid: l.matUid }));
    const reports = lotKeys.length > 0
      ? await this.customsUsageReportRepository.find({
          where: lotKeys.map((k) => ({
            lotEntryNo: k.lotEntryNo,
            lotMatUid: k.lotMatUid,
            ...this.tenantWhere(company, plant),
          })),
        })
      : [];

    const reportsByLotKey = new Map<string, CustomsUsageReport[]>();
    for (const report of reports) {
      const key = lotKey(report.lotEntryNo, report.lotMatUid);
      if (!reportsByLotKey.has(key)) reportsByLotKey.set(key, []);
      reportsByLotKey.get(key)!.push(report);
    }

    const lotsWithReports = lots.map((lot) => ({
      ...lot,
      usageReports: reportsByLotKey.get(lotKey(lot.entryNo, lot.matUid)) || [],
    }));

    return { ...entry, customsLots: lotsWithReports };
  }

  async createEntry(dto: CreateCustomsEntryDto, company?: string, plant?: string) {
    const existing = await this.customsEntryRepository.findOne({
      where: { entryNo: dto.entryNo, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 수입신고번호입니다: ${dto.entryNo}`);
    }

    const entry = this.customsEntryRepository.create({
      entryNo: dto.entryNo,
      blNo: dto.blNo,
      invoiceNo: dto.invoiceNo,
      declarationDate: parseDateStart(dto.declarationDate),
      clearanceDate: parseDateStart(dto.clearanceDate),
      origin: dto.origin,
      hsCode: dto.hsCode,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      remark: dto.remark,
      ...this.tenantWhere(company, plant),
    });

    return this.customsEntryRepository.save(entry);
  }

  async updateEntry(entryNo: string, dto: UpdateCustomsEntryDto, company?: string, plant?: string) {
    await this.findEntryById(entryNo, company, plant);

    const updateData: Partial<CustomsEntry> = {};
    if (dto.blNo !== undefined) updateData.blNo = dto.blNo;
    if (dto.invoiceNo !== undefined) updateData.invoiceNo = dto.invoiceNo;
    if (dto.declarationDate !== undefined) updateData.declarationDate = parseDateStart(dto.declarationDate);
    if (dto.clearanceDate !== undefined) updateData.clearanceDate = parseDateStart(dto.clearanceDate);
    if (dto.origin !== undefined) updateData.origin = dto.origin;
    if (dto.hsCode !== undefined) updateData.hsCode = dto.hsCode;
    if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.customsEntryRepository.update({ entryNo, ...this.tenantWhere(company, plant) }, updateData);
    return this.findEntryById(entryNo, company, plant);
  }

  async deleteEntry(entryNo: string, company?: string, plant?: string) {
    await this.findEntryById(entryNo, company, plant);

    await this.customsEntryRepository.delete({ entryNo, ...this.tenantWhere(company, plant) });
    return { entryNo };
  }

  // ============================================================================
  // 보세자재 LOT (Customs Lot) - 복합 PK: entryNo + matUid
  // ============================================================================

  async findLotsByEntryId(entryNo: string, company?: string, plant?: string) {
    const lots = await this.customsLotRepository.find({
      where: { entryNo, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });

    // 일괄 조회로 N+1 방지
    const lotKeys = lots.map((l) => ({ lotEntryNo: l.entryNo, lotMatUid: l.matUid }));
    const reports = lotKeys.length > 0
      ? await this.customsUsageReportRepository.find({
          where: lotKeys.map((k) => ({
            lotEntryNo: k.lotEntryNo,
            lotMatUid: k.lotMatUid,
            ...this.tenantWhere(company, plant),
          })),
        })
      : [];

    const reportsByLotKey = new Map<string, CustomsUsageReport[]>();
    for (const report of reports) {
      const key = lotKey(report.lotEntryNo, report.lotMatUid);
      if (!reportsByLotKey.has(key)) reportsByLotKey.set(key, []);
      reportsByLotKey.get(key)!.push(report);
    }

    return lots.map((lot) => ({
      ...lot,
      usageReports: reportsByLotKey.get(lotKey(lot.entryNo, lot.matUid)) || [],
    }));
  }

  async findLotByKey(entryNo: string, matUid: string, company?: string, plant?: string) {
    const lot = await this.customsLotRepository.findOne({
      where: { entryNo, matUid, ...this.tenantWhere(company, plant) },
    });

    if (!lot) {
      throw new NotFoundException(`보세자재 LOT을 찾을 수 없습니다: entryNo=${entryNo}, matUid=${matUid}`);
    }

    const entry = await this.customsEntryRepository.findOne({
      where: { entryNo: lot.entryNo, ...this.tenantWhere(company, plant) },
    });

    const reports = await this.customsUsageReportRepository.find({
      where: { lotEntryNo: entryNo, lotMatUid: matUid, ...this.tenantWhere(company, plant) },
    });

    return { ...lot, entry, usageReports: reports };
  }

  async createLot(dto: CreateCustomsLotDto, company?: string, plant?: string) {
    const existing = await this.customsLotRepository.findOne({
      where: { entryNo: dto.entryNo, matUid: dto.matUid, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException(
        `이미 존재하는 보세자재 LOT입니다: entryNo=${dto.entryNo}, matUid=${dto.matUid}`,
      );
    }

    const lot = this.customsLotRepository.create({
      entryNo: dto.entryNo,
      matUid: dto.matUid,
      itemCode: dto.itemCode,
      qty: dto.qty,
      remainQty: dto.qty,
      unitPrice: dto.unitPrice,
      ...this.tenantWhere(company, plant),
    });

    return this.customsLotRepository.save(lot);
  }

  async updateLot(entryNo: string, matUid: string, dto: UpdateCustomsLotDto, company?: string, plant?: string) {
    await this.findLotByKey(entryNo, matUid, company, plant);

    const updateData: Partial<CustomsLot> = {};
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.customsLotRepository.update({ entryNo, matUid, ...this.tenantWhere(company, plant) }, updateData);
    return this.findLotByKey(entryNo, matUid, company, plant);
  }

  // ============================================================================
  // 사용신고 (Usage Report)
  // ============================================================================

  async findAllUsageReports(query: UsageReportQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.customsUsageReportRepository
      .createQueryBuilder('cur')
      .leftJoinAndSelect(
        CustomsLot,
        'cl',
        'cl.ENTRY_NO = cur.LOT_ENTRY_NO AND cl.MAT_UID = cur.LOT_MAT_UID',
      )
      .leftJoinAndSelect(
        CustomsEntry,
        'ce',
        'ce.ENTRY_NO = cl.ENTRY_NO AND ce.COMPANY = cl.COMPANY AND ce.PLANT_CD = cl.PLANT_CD',
      )
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

    if (fromDate && toDate) {
      queryBuilder.andWhere(
        "cur.usageDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND cur.usageDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
        { fromDate, toDate },
      );
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
    const lotKeysSet = new Set<string>();
    for (const r of reports) {
      if (r.lotEntryNo && r.lotMatUid) {
        lotKeysSet.add(lotKey(r.lotEntryNo, r.lotMatUid));
      }
    }

    const lotKeysArr = [...lotKeysSet].map((k) => {
      const [entryNo, matUid] = k.split('::');
      return { entryNo, matUid };
    });

    const lots = lotKeysArr.length > 0
      ? await this.customsLotRepository.find({
          where: lotKeysArr.map((k) => ({ entryNo: k.entryNo, matUid: k.matUid, ...this.tenantWhere(company, plant) })),
        })
      : [];
    const lotMap = new Map(lots.map((l) => [lotKey(l.entryNo, l.matUid), l]));

    const entryNos = [...new Set(lots.map((l) => l.entryNo).filter(Boolean))];
    const entries = entryNos.length > 0
      ? await this.customsEntryRepository.find({ where: { entryNo: In(entryNos), ...this.tenantWhere(company, plant) } })
      : [];
    const entryMap = new Map(entries.map((e) => [e.entryNo, e]));

    const data = reports.map((report) => {
      const lot = lotMap.get(lotKey(report.lotEntryNo, report.lotMatUid));
      return {
        ...report,
        customsLot: lot ? { ...lot, entry: entryMap.get(lot.entryNo) || null } : null,
      };
    });

    return { data, total, page, limit };
  }

  async createUsageReport(dto: CreateUsageReportDto, company?: string, plant?: string) {
    const lot = await this.findLotByKey(dto.lotEntryNo, dto.lotMatUid, company, plant);

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
    return this.tx.run(async (queryRunner) => {
      const report = queryRunner.manager.create(CustomsUsageReport, {
        reportNo,
        lotEntryNo: dto.lotEntryNo,
        lotMatUid: dto.lotMatUid,
        orderNo: dto.orderNo ?? null,
        usageQty: dto.usageQty,
        workerId: dto.workerId,
        remark: dto.remark,
        ...this.tenantWhere(company, plant),
      });

      await queryRunner.manager.save(report);

      // LOT 잔여수량 업데이트
      const newUsedQty = lot.usedQty + dto.usageQty;
      const newRemainQty = lot.qty - newUsedQty;
      const newStatus = newRemainQty === 0 ? 'RELEASED' : 'PARTIAL';

      await queryRunner.manager.update(
        CustomsLot,
        { entryNo: dto.lotEntryNo, matUid: dto.lotMatUid, ...this.tenantWhere(company, plant) },
        {
          usedQty: newUsedQty,
          remainQty: newRemainQty,
          status: newStatus,
        },
      );

      return report;
    });
  }

  async updateUsageReport(reportNo: string, dto: UpdateUsageReportDto, company?: string, plant?: string) {
    const report = await this.customsUsageReportRepository.findOne({
      where: { reportNo, ...this.tenantWhere(company, plant) },
    });

    if (!report) {
      throw new NotFoundException(`사용신고를 찾을 수 없습니다: ${reportNo}`);
    }

    const updateData: Partial<CustomsUsageReport> = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.status === 'REPORTED') updateData.reportDate = new Date();
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.customsUsageReportRepository.update({ reportNo, ...this.tenantWhere(company, plant) }, updateData);
    return this.customsUsageReportRepository.findOne({
      where: { reportNo, ...this.tenantWhere(company, plant) },
    });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getCustomsSummary(company?: string, plant?: string) {
    const [totalEntries, pendingEntries, bondedLots, totalBondedQty] = await Promise.all([
      this.customsEntryRepository.count({ where: this.tenantWhere(company, plant) }),
      this.customsEntryRepository.count({
        where: { status: 'PENDING', ...this.tenantWhere(company, plant) },
      }),
      this.customsLotRepository.count({ where: { status: 'BONDED', ...this.tenantWhere(company, plant) } }),
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
