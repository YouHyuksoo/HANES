import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, DataSource, IsNull, QueryRunner } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CreateArrivalIqcResultDto, PendingArrivalQueryDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { SysConfigService } from '../../system/services/sys-config.service';
import { AqlService } from '../../quality/aql/services/aql.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

export interface DebugSql {
  sql: string;
  parameters: Record<string, unknown>;
}

export interface PendingArrivalsResult {
  data: Array<{
    arrivalNo: string;
    itemCode: string;
    itemName: string | null;
    unit: string | null;
    inspectMethod: string | null;
    defectModelGroup: string | null;
    vendor: string;
    vendorName: string | null;
    poNo: string | null;
    totalQty: number;
    serialCount: number;
    recvDate: Date | null;
    createdAt: Date | null;
    iqcStatus: string;
  }>;
  debugSql: DebugSql;
}

@Injectable()
export class IqcHistoryService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(MatArrival)
    private readonly matArrivalRepository: Repository<MatArrival>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatReceiving)
    private readonly matReceivingRepository: Repository<MatReceiving>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    private readonly dataSource: DataSource,
    private readonly sysConfigService: SysConfigService,
    private readonly aqlService: AqlService,
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
    actual: { company?: string | null; plant?: string | null } | null | undefined,
  ) {
    if (requested.company && actual?.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual?.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual?.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual?.plant ?? 'NULL'}`,
      );
    }
  }

  private normalizeIqcInspectClass(inspectClass?: string | null) {
    return inspectClass ?? null;
  }

  private formatKstTimestamp(date: Date) {
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('검사일시 형식이 올바르지 않습니다.');
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
    const millis = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}.${millis}`;
  }

  private normalizeOracleTimestampParam(inspectDate: string) {
    const value = inspectDate.trim();
    if (!value) {
      throw new BadRequestException('검사일시가 비어 있습니다.');
    }

    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
      return this.formatKstTimestamp(new Date(value));
    }

    const normalized = value.replace('T', ' ');
    const [datePart, rawTimePart = '00:00:00.000'] = normalized.split(' ');
    const [timePart, fraction = '000'] = rawTimePart.split('.');
    const [hour = '00', minute = '00', second = '00'] = timePart.split(':');
    return `${datePart} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}.${fraction.padEnd(3, '0').slice(0, 3)}`;
  }

  private inspectDateEquals(alias: string, parameterName: string) {
    return `${alias}.inspectDate = TO_TIMESTAMP(:${parameterName}, 'YYYY-MM-DD HH24:MI:SS.FF3')`;
  }

  private inspectDateColumnEquals(parameterName: string) {
    return `INSPECT_DATE = TO_TIMESTAMP(:${parameterName}, 'YYYY-MM-DD HH24:MI:SS.FF3')`;
  }

  private async findIqcLogByInspectKey(inspectDate: string, seq: number, company?: string, plant?: string) {
    const parsed = new Date(inspectDate);
    if (!Number.isNaN(parsed.getTime())) {
      const direct = await this.iqcLogRepository.findOne({
        where: { inspectDate: parsed, seq, ...this.tenantWhere(company, plant) },
      });
      if (direct) return direct;
    }

    const inspectTs = this.normalizeOracleTimestampParam(inspectDate);
    const qb = this.iqcLogRepository
      .createQueryBuilder('iqc')
      .where(this.inspectDateEquals('iqc', 'inspectTs'), { inspectTs })
      .andWhere('iqc.seq = :seq', { seq });
    if (company) qb.andWhere('iqc.company = :company', { company });
    if (plant) qb.andWhere('iqc.plant = :plant', { plant });
    return qb.getOne();
  }

  async findAll(query: IqcHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.iqcLogRepository.createQueryBuilder('iqc');

    if (company) qb.andWhere('iqc.company = :company', { company });
    if (plant) qb.andWhere('iqc.plant = :plant', { plant });
    if (inspectType) qb.andWhere('iqc.inspectType = :inspectType', { inspectType });
    if (result) qb.andWhere('iqc.result = :result', { result });

    // 날짜 필터: 컬럼에 함수 미적용 → 인덱스 유지
    // TO_DATE(:toDate) + 1 = 다음날 00:00:00 → 당일 23:59:59.999 까지 포함
    if (fromDate && toDate) {
      qb.andWhere(
        "iqc.inspectDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND iqc.inspectDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
        { fromDate, toDate },
      );
    } else if (fromDate) {
      qb.andWhere("iqc.inspectDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    } else if (toDate) {
      qb.andWhere("iqc.inspectDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
    }

    if (search) {
      const parts = await this.itemMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`), ...(company && { company }), ...(plant && { plant }) },
          { itemName: Like(`%${search}%`), ...(company && { company }), ...(plant && { plant }) },
        ],
      });
      const searchItemCodes = parts.map((p) => p.itemCode);

      if (searchItemCodes.length > 0) {
        qb.andWhere('iqc.itemCode IN (:...searchItemCodes)', { searchItemCodes });
      } else {
        qb.andWhere('(iqc.arrivalNo LIKE :search OR iqc.itemCode LIKE :search)', {
          search: `%${search}%`,
        });
      }
    }

    const [data, total] = await Promise.all([
      qb.orderBy('iqc.inspectDate', 'DESC').skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const partsResult = itemCodes.length > 0
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partMap = new Map(partsResult.map((p) => [p.itemCode, p]));

    const vendorCodes = Array.from(
      new Set(data.map((log) => log.vendorCode).filter((code): code is string => !!code)),
    );
    const partnersResult = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({
        where: { partnerCode: In(vendorCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partnerMap = new Map(partnersResult.map((p) => [p.partnerCode, p.partnerName]));

    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: log.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        vendorCode: log.vendorCode,
        vendorName: log.vendorCode ? (partnerMap.get(log.vendorCode) ?? log.vendorCode) : null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async createResult(dto: CreateIqcResultDto, company?: string, plant?: string) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid, ...this.tenantWhere(company, plant) },
    });
    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    }
    this.assertSameTenant('LOT', { company, plant }, lot);

    const lotTenantWhere = this.tenantWhere(lot.company, lot.plant);

    await this.matLotRepository.update({ matUid: dto.matUid, ...lotTenantWhere }, {
      iqcStatus: dto.result,
    });

    const log = this.iqcLogRepository.create({
      arrivalNo: lot.arrivalNo || null,
      matUid: dto.matUid,
      itemCode: lot.itemCode,
      inspectType: dto.inspectType || 'INITIAL',
      result: dto.result,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      inspectClass: this.normalizeIqcInspectClass(dto.inspectClass) || null,
      destructSampleQty: dto.destructSampleQty || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: lot.company,
      plant: lot.plant,
    });
    const saved = await this.iqcLogRepository.save(log);

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: lot.itemCode, ...lotTenantWhere },
    });

    // IQC PASS + 품목에 유효기간이 설정된 경우 → expireDate 자동 계산
    if (dto.result === 'PASS' && part && (part.expiryDate ?? 0) > 0) {
      const baseDate = lot.recvDate ? new Date(lot.recvDate) : new Date();
      baseDate.setHours(0, 0, 0, 0);
      const expireDate = new Date(baseDate.getTime() + part.expiryDate * 24 * 60 * 60 * 1000);
      await this.matLotRepository.update({ matUid: dto.matUid, ...lotTenantWhere }, { expireDate });
    }

    if (dto.result === 'FAIL') {
      await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
    }

    if (dto.result === 'PASS' && dto.destructSampleQty && dto.destructSampleQty > 0) {
      const issueMode = await this.sysConfigService.getValue('IQC_SAMPLE_ISSUE_MODE');
      if (issueMode === 'AUTO_ISSUE') {
        await this.autoIssueDestructSample(
          lot.matUid,
          lot.itemCode,
          dto.destructSampleQty,
          lot.company,
          lot.plant,
        );
      }
    }

    return {
      ...saved,
      matUid: lot.matUid,
      itemCode: lot.itemCode,
      itemName: part?.itemName ?? null,
    };
  }

  /**
   * 입하+품목의 PENDING(검사대기) 시리얼 목록 조회 — 시리얼별 개별 판정용
   */
  async findPendingSerials(arrivalNo: string, itemCode: string, company?: string, plant?: string) {
    const lots = await this.matLotRepository.find({
      where: { arrivalNo, itemCode, iqcStatus: 'PENDING', ...this.tenantWhere(company, plant) },
      order: { matUid: 'ASC' },
    });
    return lots.map((l) => ({
      matUid: l.matUid,
      itemCode: l.itemCode,
      initQty: l.initQty,
      currentQty: l.currentQty,
      recvDate: l.recvDate,
      vendor: l.vendor,
    }));
  }


  /**
   * 입하단위 IQC 검사 대상 목록 (입하번호 + 품목 단위 그룹 집계)
   * - 개별 시리얼이 아니라 ARRIVAL_NO + ITEM_CODE 로 묶어서 1행으로 반환
   * - 집계는 SQL GROUP BY 로 수행 (메모리 집계 금지)
   */
  async findPendingArrivals(query: PendingArrivalQueryDto, company?: string, plant?: string): Promise<PendingArrivalsResult> {
    const iqcStatus = query.iqcStatus || 'PENDING';

    const qb = this.matLotRepository
      .createQueryBuilder('lot')
      .leftJoin(
        ItemMaster,
        'part',
        'part.itemCode = lot.itemCode AND part.company = lot.company AND part.plant = lot.plant',
      )
      .leftJoin(
        PartnerMaster,
        'partner',
        'partner.partnerCode = lot.vendor AND partner.company = lot.company AND partner.plant = lot.plant',
      )
      .select('lot.arrivalNo', 'arrivalNo')
      .addSelect('lot.itemCode', 'itemCode')
      .addSelect('part.itemName', 'itemName')
      .addSelect('part.unit', 'unit')
      .addSelect('part.inspectMethod', 'inspectMethod')
      .addSelect('part.defectModelGroup', 'defectModelGroup')
      .addSelect('lot.vendor', 'vendor')
      .addSelect('partner.partnerName', 'vendorName')
      .addSelect('MIN(lot.poNo)', 'poNo')
      .addSelect('SUM(lot.initQty)', 'totalQty')
      .addSelect('COUNT(*)', 'serialCount')
      .addSelect('MIN(lot.recvDate)', 'recvDate')
      .addSelect('MIN(lot.createdAt)', 'createdAt')
      .where('lot.arrivalNo IS NOT NULL')
      .andWhere('lot.iqcStatus = :iqcStatus', { iqcStatus });

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (query.search) {
      qb.andWhere('(lot.arrivalNo LIKE :search OR lot.itemCode LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.groupBy('lot.arrivalNo')
      .addGroupBy('lot.itemCode')
      .addGroupBy('lot.vendor')
      .addGroupBy('partner.partnerName')
      .addGroupBy('part.itemName')
      .addGroupBy('part.unit')
      .addGroupBy('part.inspectMethod')
      .addGroupBy('part.defectModelGroup')
      .orderBy('MIN(lot.createdAt)', 'DESC');

    const debugSql = {
      sql: qb.getSql(),
      parameters: qb.getParameters(),
    };
    const rows = await qb.getRawMany<{
      arrivalNo: string;
      itemCode: string;
      itemName: string | null;
      unit: string | null;
      inspectMethod: string | null;
      defectModelGroup: string | null;
      vendor: string;
      vendorName: string | null;
      poNo: string | null;
      totalQty: string;
      serialCount: string;
      recvDate: Date | null;
      createdAt: Date | null;
    }>();

    return {
      data: rows.map((r) => ({
        arrivalNo: r.arrivalNo,
        itemCode: r.itemCode,
        itemName: r.itemName ?? null,
        unit: r.unit ?? null,
        inspectMethod: r.inspectMethod ?? null,
        defectModelGroup: r.defectModelGroup ?? null,
        vendor: r.vendor,
        vendorName: r.vendorName ?? null,
        poNo: r.poNo ?? null,
        totalQty: Number(r.totalQty) || 0,
        serialCount: Number(r.serialCount) || 0,
        recvDate: r.recvDate,
        createdAt: r.createdAt,
        iqcStatus,
      })),
      debugSql,
    };
  }

  /**
   * 입하단위 IQC 검사결과 등록
   * - 입하번호 + 품목에 속한 PENDING 시리얼 전체를 일괄 판정 (전수검사 아님, 샘플검사)
   * - PASS → 전체 시리얼 iqcStatus=PASS
   * - FAIL → 전체 시리얼 iqcStatus=FAIL + 각 시리얼 불용창고 이동
   * - 검사 이력(IqcLog)은 입하건당 1건 (matUid=null, arrivalNo+itemCode 기준)
   */
  async createArrivalResult(dto: CreateArrivalIqcResultDto, company?: string, plant?: string) {
    const lots = await this.matLotRepository.find({
      where: {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(company, plant),
      },
    });
    if (lots.length === 0) {
      throw new NotFoundException(
        `검사 대상(PENDING) 시리얼이 없습니다: 입하 ${dto.arrivalNo} / 품목 ${dto.itemCode}`,
      );
    }

    const tenantCompany = lots[0].company;
    const tenantPlant = lots[0].plant;
    const vendorCode = lots[0].vendor ?? null;
    const lotQty = lots.reduce((sum, lot) => sum + (Number(lot.initQty) || 0), 0);
    const defectCounts = this.resolveDefectCounts(dto);
    const itemDefectCounts = this.countFailByInspItem(dto.details);
    const destructive = this.parseDestructive(dto.details);
    for (const [seq, qty] of Object.entries(destructive.defects)) {
      itemDefectCounts[Number(seq)] = (itemDefectCounts[Number(seq)] ?? 0) + qty;
    }
    this.assertDefectCodesHaveFailedInspection(dto, itemDefectCounts);
    // 검사항목별(각 항목 검사수준/등급/AQL) 판정. 등급 설정 항목이 없으면 내부에서 품목 단일로 폴백.
    const aqlPolicy = await this.aqlService.resolveIqcPolicyByItem({
      itemCode: dto.itemCode,
      vendorCode,
      lotQty,
      itemDefectCounts,
      itemInspectedCounts: destructive.inspected,
      fallbackDefectCounts: defectCounts,
      fallbackDefectCodes: dto.defects,
      company: tenantCompany,
      plant: tenantPlant,
    });
    const finalResult = aqlPolicy.result;

    // 1) 입하건의 PENDING 시리얼 전체 일괄 판정
    await this.matLotRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { iqcStatus: finalResult },
    );
    await this.matArrivalRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { iqcStatus: finalResult },
    );

    // 2) 검사 이력 1건 생성 (matUid=null → 입하단위 검사 표식)
    const log = this.iqcLogRepository.create({
      arrivalNo: dto.arrivalNo,
      matUid: null,
      itemCode: dto.itemCode,
      vendorCode,
      inspectType: dto.inspectType || 'INITIAL',
      result: finalResult,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      inspectClass: this.normalizeIqcInspectClass(dto.inspectClass) || null,
      destructSampleQty: dto.sampleQty || null,
      sampleBarcode: this.compactSampleBarcode(dto.sampleBarcode, dto.details),
      lotQty: aqlPolicy.lotQty,
      aqlInspectionLevel: aqlPolicy.inspectionLevel,
      aqlInspectionMode: aqlPolicy.inspectionMode,
      aqlSampleQty: aqlPolicy.sampleQty || null,
      aqlMajorCode: aqlPolicy.majorRule?.aqlCode ?? null,
      aqlMajorAc: aqlPolicy.majorRule?.acceptQty ?? null,
      aqlMajorRe: aqlPolicy.majorRule?.rejectQty ?? null,
      aqlMinorCode: aqlPolicy.minorRule?.aqlCode ?? null,
      aqlMinorAc: aqlPolicy.minorRule?.acceptQty ?? null,
      aqlMinorRe: aqlPolicy.minorRule?.rejectQty ?? null,
      defectCritical: aqlPolicy.defectCritical,
      defectMajor: aqlPolicy.defectMajor,
      defectMinor: aqlPolicy.defectMinor,
      aqlJudgeReason: aqlPolicy.judgeReason,
      itemResults: aqlPolicy.itemResults?.length ? JSON.stringify(aqlPolicy.itemResults) : null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: tenantCompany,
      plant: tenantPlant,
    });
    const saved = await this.iqcLogRepository.save(log);

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(tenantCompany, tenantPlant) },
    });

    // 3) PASS + 품목에 유효기간 설정 시 → 각 시리얼 expireDate 자동 계산
    if (finalResult === 'PASS' && part && (part.expiryDate ?? 0) > 0) {
      for (const lot of lots) {
        const baseDate = lot.recvDate ? new Date(lot.recvDate) : new Date();
        baseDate.setHours(0, 0, 0, 0);
        const expireDate = new Date(baseDate.getTime() + part.expiryDate * 24 * 60 * 60 * 1000);
        await this.matLotRepository.update(
          { matUid: lot.matUid, ...this.tenantWhere(lot.company, lot.plant) },
          { expireDate },
        );
      }
    }

    // 4) FAIL → 입하건 전체 시리얼을 불용창고로 이동
    if (finalResult === 'FAIL') {
      for (const lot of lots) {
        await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
      }
    }

    // 5) PASS + 샘플수량 → 파괴검사 시료 자동출고 (AUTO_ISSUE 모드, 시리얼 순서대로 차감)
    if (finalResult === 'PASS' && dto.sampleQty && dto.sampleQty > 0) {
      const issueMode = await this.sysConfigService.getValue('IQC_SAMPLE_ISSUE_MODE');
      if (issueMode === 'AUTO_ISSUE') {
        let remaining = dto.sampleQty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const stock = await this.matStockRepository.findOne({
            where: { matUid: lot.matUid, itemCode: lot.itemCode, ...this.tenantWhere(lot.company, lot.plant) },
          });
          const avail = stock?.qty ?? 0;
          if (avail <= 0) continue;
          const take = Math.min(avail, remaining);
          await this.autoIssueDestructSample(lot.matUid, lot.itemCode, take, lot.company, lot.plant);
          remaining -= take;
        }
      }
    }

    await this.aqlService.updateVendorInspectionModeAfterLot({
      vendorCode,
      arrivalNo: dto.arrivalNo,
      itemCode: dto.itemCode,
      company: tenantCompany,
      plant: tenantPlant,
    });

    return {
      ...saved,
      arrivalNo: dto.arrivalNo,
      itemCode: dto.itemCode,
      itemName: part?.itemName ?? null,
      affectedSerials: lots.length,
      result: finalResult,
      aql: aqlPolicy,
    };
  }

  private resolveDefectCounts(dto: CreateArrivalIqcResultDto) {
    const providedMajor = dto.defectMajor != null;
    const counts = {
      critical: this.toNonNegativeInt(dto.defectCritical),
      major: this.toNonNegativeInt(dto.defectMajor),
      minor: this.toNonNegativeInt(dto.defectMinor),
    };

    if (!providedMajor && counts.critical === 0 && counts.minor === 0 && dto.details) {
      counts.major = this.countFailedSerials(dto.details);
    }
    return counts;
  }

  private countFailedSerials(details: string) {
    try {
      const parsed = JSON.parse(details) as { serials?: Array<{ result?: string }> };
      return (parsed.serials ?? []).filter((serial) => serial.result === 'FAIL').length;
    } catch {
      return 0;
    }
  }

  /**
   * 검사 details(SERIAL_INSPECTION)에서 검사항목(seq)별 FAIL 샘플 수를 집계한다.
   * itemId 포맷은 `${itemCode}::${seq}` (IqcModal createMeasurementRows).
   */
  private countFailByInspItem(details?: string | null): Record<number, number> {
    const out: Record<number, number> = {};
    if (!details) return out;
    try {
      const parsed = JSON.parse(details) as {
        serials?: Array<{ items?: Array<{ itemId?: string; judge?: string }> }>;
      };
      for (const serial of parsed.serials ?? []) {
        for (const item of serial.items ?? []) {
          if (item.judge !== 'FAIL') continue;
          const seq = Number(String(item.itemId ?? '').split('::')[1]);
          if (Number.isFinite(seq)) out[seq] = (out[seq] ?? 0) + 1;
        }
      }
    } catch {
      return out;
    }
    return out;
  }

  private assertDefectCodesHaveFailedInspection(
    dto: CreateArrivalIqcResultDto,
    itemDefectCounts: Record<number, number>,
  ) {
    if (!dto.details) return;
    const defectCodeQty = (dto.defects ?? []).reduce((sum, defect) => sum + this.toNonNegativeInt(defect.qty), 0);
    if (defectCodeQty <= 0) return;

    const itemFailedQty = Object.values(itemDefectCounts).reduce(
      (sum, qty) => sum + this.toNonNegativeInt(qty),
      0,
    );
    const failedInspectionQty = itemFailedQty + this.countFailedSerials(dto.details);
    if (failedInspectionQty <= 0) {
      throw new BadRequestException('불량코드는 FAIL 판정 항목과 함께 입력해야 합니다.');
    }
  }

  private compactSampleBarcode(value?: string | null, details?: string | null) {
    const raw = value?.trim();
    if (!raw) return null;
    if (this.fitsUtf8Bytes(raw, 500)) return raw;

    const detailSerials = this.extractSerialsFromDetails(details);
    const source = detailSerials.length > 0
      ? detailSerials
      : raw.split(',').map((item) => item.trim()).filter(Boolean);

    if (source.length === 0) return this.truncateUtf8Bytes(raw, 500);
    return this.compactListForVarchar2(source, 500);
  }

  private extractSerialsFromDetails(details?: string | null) {
    if (!details) return [];
    try {
      const parsed = JSON.parse(details) as { serials?: Array<{ matUid?: string }> };
      return (parsed.serials ?? [])
        .map((serial) => String(serial.matUid ?? '').trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private compactListForVarchar2(values: string[], maxBytes: number) {
    const normalized = values.map((value) => value.trim()).filter(Boolean);
    const joined = normalized.join(',');
    if (this.fitsUtf8Bytes(joined, maxBytes)) return joined;

    const kept: string[] = [];
    for (const value of normalized) {
      const next = [...kept, value];
      const remaining = normalized.length - next.length;
      const suffix = remaining > 0 ? `...(+${remaining} more)` : '';
      const candidate = suffix ? `${next.join(',')},${suffix}` : next.join(',');
      if (!this.fitsUtf8Bytes(candidate, maxBytes)) break;
      kept.push(value);
    }

    const remaining = normalized.length - kept.length;
    const compacted = remaining > 0
      ? `${kept.length > 0 ? `${kept.join(',')},` : ''}...(+${remaining} more)`
      : kept.join(',');
    return this.truncateUtf8Bytes(compacted, maxBytes);
  }

  private fitsUtf8Bytes(value: string, maxBytes: number) {
    return Buffer.byteLength(value, 'utf8') <= maxBytes;
  }

  private truncateUtf8Bytes(value: string, maxBytes: number) {
    let out = '';
    for (const char of value) {
      if (Buffer.byteLength(out + char, 'utf8') > maxBytes) break;
      out += char;
    }
    return out;
  }

  /**
   * details(SERIAL_INSPECTION)의 destructive 섹션에서 검사항목(seq)별 검사수량/불량수를 집계한다.
   */
  private parseDestructive(details?: string | null): {
    defects: Record<number, number>;
    inspected: Record<number, number>;
  } {
    const defects: Record<number, number> = {};
    const inspected: Record<number, number> = {};
    if (!details) return { defects, inspected };
    try {
      const parsed = JSON.parse(details) as {
        destructive?: Array<{ seq?: number; inspectedQty?: number; defectQty?: number }>;
      };
      for (const d of parsed.destructive ?? []) {
        const seq = Number(d.seq);
        if (!Number.isFinite(seq)) continue;
        defects[seq] = (defects[seq] ?? 0) + this.toNonNegativeInt(d.defectQty);
        inspected[seq] = (inspected[seq] ?? 0) + this.toNonNegativeInt(d.inspectedQty);
      }
    } catch {
      return { defects, inspected };
    }
    return { defects, inspected };
  }

  private toNonNegativeInt(value: unknown) {
    const n = Math.trunc(Number(value ?? 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private async handleIqcFail(
    matUid: string,
    itemCode: string,
    company?: string | null,
    plant?: string | null,
  ) {
    const defectWarehouse = await this.warehouseRepository.findOne({
      where: { warehouseType: 'DEFECT', useYn: 'Y', ...this.tenantWhere(company, plant) },
    });
    if (!defectWarehouse) return;
    this.assertSameTenant('불용창고', { company, plant }, defectWarehouse);

    const stock = await this.matStockRepository.findOne({
      where: { matUid, itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!stock || stock.qty <= 0) return;
    this.assertSameTenant('IQC 대상 재고', { company, plant }, stock);

    return this.tx.run(async (queryRunner) => {
      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');

      await queryRunner.manager.update(
        MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) },
        { qty: 0 },
      );

      const existing = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: defectWarehouse.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) },
      });
      if (existing) {
        await queryRunner.manager.update(
          MatStock,
          { warehouseCode: defectWarehouse.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) },
          { qty: existing.qty + stock.qty },
        );
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: defectWarehouse.warehouseCode,
          itemCode,
          matUid,
          qty: stock.qty,
          reservedQty: 0,
          company,
          plant,
        });
      }

      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_MOVE',
        fromWarehouseId: stock.warehouseCode,
        toWarehouseId: defectWarehouse.warehouseCode,
        itemCode,
        matUid,
        qty: stock.qty,
        remark: 'IQC 불합격 자동이동 (불용창고)',
        refType: 'IQC_FAIL',
        company,
        plant,
      });
    });
  }

  private async autoIssueDestructSample(
    matUid: string,
    itemCode: string,
    sampleQty: number,
    company?: string | null,
    plant?: string | null,
  ) {
    const stock = await this.matStockRepository.findOne({
      where: { matUid, itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!stock || stock.qty < sampleQty) return;
    this.assertSameTenant('IQC 파괴검사 재고', { company, plant }, stock);

    return this.tx.run(async (queryRunner) => {
      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');

      await queryRunner.manager.update(
        MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) },
        { qty: stock.qty - sampleQty },
      );

      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_OUT',
        fromWarehouseId: stock.warehouseCode,
        itemCode,
        matUid,
        qty: -sampleQty,
        remark: 'IQC 파괴검사 시료 자동출고',
        refType: 'IQC_DESTRUCT',
        company,
        plant,
      });
    });
  }

  async uploadCert(inspectDate: string, seq: number, filePath: string, company?: string, plant?: string) {
    const log = await this.findIqcLogByInspectKey(inspectDate, seq, company, plant);
    if (!log) throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${inspectDate}/${seq}`);
    const inspectTs = this.normalizeOracleTimestampParam(inspectDate);
    const updateQb = this.iqcLogRepository
      .createQueryBuilder()
      .update(IqcLog)
      .set({ certFilePath: filePath })
      .where(this.inspectDateColumnEquals('inspectTs'), { inspectTs })
      .andWhere('SEQ = :seq', { seq });
    if (log.company) updateQb.andWhere('COMPANY = :company', { company: log.company });
    if (log.plant) updateQb.andWhere('PLANT_CD = :plant', { plant: log.plant });
    await updateQb.execute();
    return { ...log, certFilePath: filePath };
  }

  async cancel(inspectDate: string, seq: number, dto: CancelIqcResultDto, company?: string, plant?: string) {
    const log = await this.iqcLogRepository.findOne({
      where: { inspectDate: new Date(inspectDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!log) {
      throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${inspectDate}/${seq}`);
    }
    if (log.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 판정입니다.');
    }

    if (log.matUid) {
      const receiving = await this.matReceivingRepository.findOne({
        where: { matUid: log.matUid, status: 'DONE', ...this.tenantWhere(log.company, log.plant) },
      });
      if (receiving) {
        throw new BadRequestException(
          `이미 입고된 LOT입니다. LOT ${log.matUid}의 입고부터 먼저 정리한 뒤 IQC 판정을 취소해 주세요.`,
        );
      }
    } else if (log.arrivalNo) {
      // 입하단위 검사 이력 → 해당 입하건에 입고 DONE이 있으면 취소 불가
      const receiving = await this.matReceivingRepository.findOne({
        where: { arrivalNo: log.arrivalNo, status: 'DONE', ...this.tenantWhere(log.company, log.plant) },
      });
      if (receiving) {
        throw new BadRequestException(
          `이미 입고된 입하건입니다. 입하 ${log.arrivalNo}의 입고부터 먼저 정리한 뒤 IQC 판정을 취소해 주세요.`,
        );
      }
    } else if (log.itemCode) {
      const receiving = await this.matReceivingRepository.findOne({
        where: { itemCode: log.itemCode, status: 'DONE', ...this.tenantWhere(log.company, log.plant) },
      });
      if (receiving) {
        throw new BadRequestException(
          '이미 입고된 LOT입니다. 입고부터 먼저 정리한 뒤 IQC 판정을 취소해 주세요.',
        );
      }
    }

    if (log.matUid && log.result === 'PASS') {
      const sampleIssue = await this.stockTransactionRepository.findOne({
        where: {
          matUid: log.matUid,
          itemCode: log.itemCode,
          refType: 'IQC_DESTRUCT',
          cancelRefId: IsNull(),
          status: 'DONE',
          ...this.tenantWhere(log.company, log.plant),
        },
        order: { createdAt: 'DESC' },
      });
      if (sampleIssue) {
        throw new BadRequestException(
          `파괴검사 시료 자동출고(${sampleIssue.transNo})가 이미 반영되어 있습니다. 시료 출고를 먼저 정리한 뒤 IQC 판정을 취소해 주세요.`,
        );
      }
    } else if (!log.matUid && log.arrivalNo && log.itemCode && log.result === 'PASS') {
      const arrivalLots = await this.matLotRepository.find({
        where: {
          arrivalNo: log.arrivalNo,
          itemCode: log.itemCode,
          ...this.tenantWhere(log.company, log.plant),
        },
      });
      // 입하건 전체 시리얼의 파괴검사 시료 자동출고 여부를 단일 쿼리로 확인 (N+1 방지)
      const arrivalMatUids = (arrivalLots ?? []).map((lot) => lot.matUid);
      if (arrivalMatUids.length > 0) {
        const sampleIssue = await this.stockTransactionRepository.findOne({
          where: {
            matUid: In(arrivalMatUids),
            itemCode: log.itemCode,
            refType: 'IQC_DESTRUCT',
            cancelRefId: IsNull(),
            status: 'DONE',
            ...this.tenantWhere(log.company, log.plant),
          },
          order: { createdAt: 'DESC' },
        });
        if (sampleIssue) {
          throw new BadRequestException(
            `파괴검사 시료 자동출고(${sampleIssue.transNo})가 이미 반영되어 있습니다. 시료 출고를 먼저 정리한 뒤 IQC 판정을 취소해 주세요.`,
          );
        }
      }
    }

    await this.tx.run(async (queryRunner) => {
      if (log.matUid && log.result === 'FAIL') {
        await this.reverseIqcFailMove(queryRunner, log.matUid, log.itemCode, log.company, log.plant);
      }

      // 입하단위 검사(matUid=null) FAIL → 입하건 전체 시리얼의 불용창고 이동을 원복
      if (!log.matUid && log.arrivalNo && log.itemCode && log.result === 'FAIL') {
        const failedLots = await queryRunner.manager.find(MatLot, {
          where: {
            arrivalNo: log.arrivalNo,
            itemCode: log.itemCode,
            iqcStatus: 'FAIL',
            ...this.tenantWhere(log.company, log.plant),
          },
        });
        for (const lot of failedLots) {
          await this.reverseIqcFailMove(queryRunner, lot.matUid, lot.itemCode, lot.company, lot.plant);
        }
      }

      await queryRunner.manager.update(
        IqcLog,
        { inspectDate: new Date(inspectDate), seq, ...this.tenantWhere(log.company, log.plant) },
        { status: 'CANCELED', remark: dto.reason },
      );

      if (log.matUid) {
        await queryRunner.manager.update(
          MatLot,
          { matUid: log.matUid, ...this.tenantWhere(log.company, log.plant) },
          { iqcStatus: 'PENDING' },
        );
      } else if (log.arrivalNo && log.itemCode) {
        // 입하단위 검사 → 해당 입하건 전체 시리얼을 일괄 PENDING 복원
        await queryRunner.manager.update(
          MatLot,
          {
            arrivalNo: log.arrivalNo,
            itemCode: log.itemCode,
            iqcStatus: log.result,
            ...this.tenantWhere(log.company, log.plant),
          },
          { iqcStatus: 'PENDING', expireDate: null },
        );
        await queryRunner.manager.update(
          MatArrival,
          {
            arrivalNo: log.arrivalNo,
            itemCode: log.itemCode,
            iqcStatus: log.result,
            ...this.tenantWhere(log.company, log.plant),
          },
          { iqcStatus: 'PENDING' },
        );
      } else if (log.itemCode) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { itemCode: log.itemCode, iqcStatus: log.result, ...this.tenantWhere(log.company, log.plant) },
          order: { createdAt: 'DESC' },
        });
        if (lot) {
          await queryRunner.manager.update(
            MatLot,
            { matUid: lot.matUid, ...this.tenantWhere(log.company, log.plant) },
            { iqcStatus: 'PENDING' },
          );
        }
      }
    });

    await this.aqlService.revertVendorInspectionModeForCanceledLot({
      vendorCode: log.vendorCode,
      arrivalNo: log.arrivalNo,
      itemCode: log.itemCode,
      company: log.company,
      plant: log.plant,
    });

    return { inspectDate, seq, status: 'CANCELED' };
  }

  private async reverseIqcFailMove(
    queryRunner: QueryRunner,
    matUid: string,
    itemCode: string,
    company?: string | null,
    plant?: string | null,
  ) {
    const failMove = await queryRunner.manager.findOne(StockTransaction, {
      where: {
        matUid,
        itemCode,
        refType: 'IQC_FAIL',
        cancelRefId: IsNull(),
        status: 'DONE',
        ...this.tenantWhere(company, plant),
      },
      order: { createdAt: 'DESC' },
    });

    if (!failMove || !failMove.fromWarehouseId || !failMove.toWarehouseId || failMove.qty <= 0) {
      return;
    }

    const defectStock = await queryRunner.manager.findOne(MatStock, {
      where: { warehouseCode: failMove.toWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) },
    });
    if (!defectStock || defectStock.qty < failMove.qty) {
      throw new BadRequestException(
        `불량창고 재고가 이미 변경되어 IQC 불합격 취소를 자동 처리할 수 없습니다. LOT: ${matUid}`,
      );
    }

    const sourceStock = await queryRunner.manager.findOne(MatStock, {
      where: { warehouseCode: failMove.fromWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) },
    });

    await queryRunner.manager.update(
      MatStock,
      { warehouseCode: failMove.toWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) },
      { qty: defectStock.qty - failMove.qty },
    );

    if (sourceStock) {
      await queryRunner.manager.update(
        MatStock,
        { warehouseCode: failMove.fromWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) },
        { qty: sourceStock.qty + failMove.qty },
      );
    } else {
      await queryRunner.manager.save(MatStock, {
        warehouseCode: failMove.fromWarehouseId,
        itemCode,
        matUid,
        qty: failMove.qty,
        reservedQty: 0,
        company,
        plant,
      });
    }

    const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
    await queryRunner.manager.save(StockTransaction, {
      transNo,
      transType: 'MAT_MOVE',
      fromWarehouseId: failMove.toWarehouseId,
      toWarehouseId: failMove.fromWarehouseId,
      itemCode,
      matUid,
      qty: failMove.qty,
      remark: 'IQC 불합격 취소 원복',
      refType: 'IQC_FAIL_CANCEL',
      cancelRefId: failMove.transNo,
      company,
      plant,
    });
  }
}
