import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IQC_INSPECT_LOT_MODE_KEY, allowsIqcRequestLot } from '@harness/shared';
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
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { IqcLogTarget } from '../../../entities/iqc-log-target.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CreateArrivalIqcResultDto, PendingArrivalQueryDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { SysConfigService } from '../../system/services/sys-config.service';
import { AqlService } from '../../quality/aql/services/aql.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { calcLotExpireDate } from '../rules/fifo.rules';

export interface DebugSql {
  sql: string;
  parameters: Record<string, unknown>;
}

export interface PendingArrivalsResult {
  data: Array<{
    /**
     * 검사의뢰 LOT 번호. REQUEST 모드의 의뢰 LOT 묶음 행에만 값이 있고 입하단위 행은 null이다.
     * 프론트는 이 값으로 제출 엔드포인트를 가른다(request-lot/:requestNo vs arrival).
     */
    requestNo: string | null;
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

/** IQC 불합격 재고 처리 모드 설정 키 — AUTO: FAIL 저장 시 불량창고 자동이동 / MANUAL(기본): 불량창고 수동입고 화면에서 처리 */
export const IQC_FAIL_DEFECT_MOVE_MODE_KEY = 'IQC_FAIL_DEFECT_MOVE_MODE';
/** 불량창고 수동입고 트랜잭션 REF_TYPE */
export const IQC_DEFECT_RECEIVE_REF_TYPE = 'IQC_DEFECT_RECEIVE';

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
    @InjectRepository(IqcRequestLot)
    private readonly iqcRequestLotRepository: Repository<IqcRequestLot>,
    @InjectRepository(IqcRequestLotLine)
    private readonly iqcRequestLotLineRepository: Repository<IqcRequestLotLine>,
    @InjectRepository(IqcLogTarget)
    private readonly iqcLogTargetRepository: Repository<IqcLogTarget>,
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

  /**
   * REQUESTED 상태 의뢰 LOT에 담긴 입하 행을 입하단위/단건 경로로 판정하지 못하게 막는다.
   *
   * 막지 않으면 MAT_LOTS/MAT_ARRIVALS만 PASS/FAIL이 되고 IQC_REQUEST_LOTS.STATUS는 REQUESTED로
   * 영구 잔존하는 고아가 된다(의뢰 헤더를 갱신하는 곳은 createRequestLotResult 뿐이다).
   * 모드를 REQUEST에서 ARRIVAL로 되돌렸거나 API를 직접 호출한 경우에도 같은 일이 생긴다.
   */
  private static requestLotRowKey(arrivalNo: string | null, arrivalSeq: number | null | undefined) {
    return `${arrivalNo}#${Number(arrivalSeq)}`;
  }

  /** 대상 입하 행 중 REQUESTED 의뢰에 담긴 것을 {행키 → 의뢰번호}로 돌려준다. */
  private async findRequestLotHolds(
    targets: Array<{ arrivalNo: string | null; arrivalSeq: number | null | undefined; itemCode: string }>,
    company?: string,
    plant?: string,
  ): Promise<Map<string, string>> {
    const rows = targets.filter((t) => !!t.arrivalNo && t.arrivalSeq != null);
    if (rows.length === 0) return new Map();
    const arrivalNos = [...new Set(rows.map((t) => t.arrivalNo as string))];
    const itemCodes = [...new Set(rows.map((t) => t.itemCode))];
    // 주의: 조인 조건 문자열에 줄바꿈을 넣지 말 것. TypeORM이 alias.프로퍼티를 못 풀어 ORA-00904가 난다.
    const lines = await this.iqcRequestLotLineRepository
      .createQueryBuilder('ln')
      .innerJoin(IqcRequestLot, 'rq', "rq.requestNo = ln.requestNo AND rq.company = ln.company AND rq.plant = ln.plant AND rq.status = 'REQUESTED'")
      .select('ln.requestNo', 'requestNo')
      .addSelect('ln.arrivalNo', 'arrivalNo')
      .addSelect('ln.arrivalSeq', 'arrivalSeq')
      .where('ln.arrivalNo IN (:...arrivalNos)', { arrivalNos })
      .andWhere('ln.itemCode IN (:...itemCodes)', { itemCodes })
      .andWhere(company ? 'ln.company = :company' : '1=1', company ? { company } : {})
      .andWhere(plant ? 'ln.plant = :plant' : '1=1', plant ? { plant } : {})
      .getRawMany<{ requestNo: string; arrivalNo: string; arrivalSeq: number }>();
    if (lines.length === 0) return new Map();
    const heldKeys = new Map<string, string>(
      lines.map((l) => [IqcHistoryService.requestLotRowKey(l.arrivalNo, l.arrivalSeq), l.requestNo]),
    );
    const holds = new Map<string, string>();
    for (const target of rows) {
      const key = IqcHistoryService.requestLotRowKey(target.arrivalNo, target.arrivalSeq);
      const requestNo = heldKeys.get(key);
      if (requestNo) holds.set(key, requestNo);
    }
    return holds;
  }

  private static describeRequestLotHolds(holds: Map<string, string>) {
    const byRequest = new Map<string, string[]>();
    for (const [key, requestNo] of holds) {
      const list = byRequest.get(requestNo) ?? [];
      list.push(key);
      byRequest.set(requestNo, list);
    }
    return [...byRequest.entries()].map(([requestNo, keys]) => `${requestNo}(${keys.join(', ')})`).join(', ');
  }

  /** 단건 판정용. 대상이 하나뿐이라 제외하면 남는 게 없으므로 항상 거절이다. */
  private async assertNotHeldByRequestLot(
    targets: Array<{ arrivalNo: string | null; arrivalSeq: number | null | undefined; itemCode: string }>,
    company?: string,
    plant?: string,
  ) {
    const holds = await this.findRequestLotHolds(targets, company, plant);
    if (holds.size === 0) return;
    throw new BadRequestException(
      `검사의뢰 LOT에 포함된 입하 행입니다. 의뢰 단위로 검사하거나 의뢰를 취소하세요: ${IqcHistoryService.describeRequestLotHolds(holds)}`,
    );
  }

  async createResult(dto: CreateIqcResultDto, company?: string, plant?: string) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid, ...this.tenantWhere(company, plant) },
    });
    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    }
    this.assertSameTenant('LOT', { company, plant }, lot);
    await this.assertNotHeldByRequestLot(
      [{ arrivalNo: lot.arrivalNo ?? null, arrivalSeq: lot.arrivalSeq, itemCode: lot.itemCode }],
      lot.company,
      lot.plant,
    );

    const lotTenantWhere = this.tenantWhere(lot.company, lot.plant);

    const destructive = this.parseDestructive(dto.details);
    // 입하단위 경로(createArrivalResult)와 같은 규칙: 파괴/전수 불량 합류 + 불량코드 수량 귀속 (2026-09-09 결함 03 동일 유형)
    const itemDefectCounts = this.countFailByInspItem(dto.details);
    for (const [seq, qty] of Object.entries(destructive.defects)) {
      itemDefectCounts[Number(seq)] = (itemDefectCounts[Number(seq)] ?? 0) + qty;
    }
    // 단건 DTO(CreateIqcResultDto)에는 불량코드 수량 입력이 없어 귀속 대상은 0 — 파괴/전수 불량 합류만 적용된다
    const singleDefectQtyTotal = 0;
    const aqlPolicy = await this.aqlService.resolveIqcPolicyByItem({
      itemCode: lot.itemCode,
      vendorCode: lot.vendor ?? null,
      lotQty: Math.max(1, Number(lot.initQty) || 1),
      itemDefectCounts: this.aqlService.attributeDefectQtyToFailedItems(itemDefectCounts, singleDefectQtyTotal),
      itemInspectedCounts: destructive.inspected,
      fallbackDefectCounts: { critical: 0, major: 0, minor: 0 },
      company: lot.company,
      plant: lot.plant,
    });
    const finalResult = aqlPolicy.result;

    await this.matLotRepository.update({ matUid: dto.matUid, ...lotTenantWhere }, {
      iqcStatus: finalResult,
    });

    const log = this.iqcLogRepository.create({
      arrivalNo: lot.arrivalNo || null,
      matUid: dto.matUid,
      itemCode: lot.itemCode,
      inspectType: dto.inspectType || 'INITIAL',
      result: finalResult,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      inspectClass: this.normalizeIqcInspectClass(dto.inspectClass) || null,
      destructSampleQty: dto.destructSampleQty || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: lot.company,
      plant: lot.plant,
    });
    // 자재 시리얼 단건 판정 — 대상은 그 시리얼이 달린 입하 행 하나다.
    const saved = await this.saveIqcLogWithTargets(log, [
      {
        arrivalNo: lot.arrivalNo,
        arrivalSeq: lot.arrivalSeq,
        itemCode: lot.itemCode,
        matUid: lot.matUid,
      },
    ]);

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: lot.itemCode, ...lotTenantWhere },
    });

    // IQC PASS + 품목에 유효기간이 설정된 경우 → expireDate 자동 계산
    if (finalResult === 'PASS' && part && (part.expiryDate ?? 0) > 0) {
      const expireDate = calcLotExpireDate(lot, part.expiryDate, new Date());
      await this.matLotRepository.update({ matUid: dto.matUid, ...lotTenantWhere }, { expireDate });
    }

    if (finalResult === 'FAIL') {
      await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
    }

    if (finalResult === 'PASS' && dto.destructSampleQty && dto.destructSampleQty > 0) {
      const issueMode = await this.sysConfigService.getValue('IQC_SAMPLE_ISSUE_MODE', lot.company, lot.plant);
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
   *
   * requestNo가 오면 검사의뢰 LOT에 담긴 (ARRIVAL_NO, ARRIVAL_SEQ) 행으로 한정한다.
   * 같은 ARRIVAL_NO에 수십 행이 붙을 수 있어 입하번호만으로는 모집단을 특정할 수 없다.
   */
  async findPendingSerials(
    arrivalNo: string,
    itemCode: string,
    company?: string,
    plant?: string,
    requestNo?: string,
  ) {
    const lots = requestNo
      ? await this.findRequestLotPendingSerials(requestNo, company, plant)
      : await this.matLotRepository.find({
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

  /** 의뢰 LOT에 담긴 입하 행의 PENDING 시리얼 */
  private async findRequestLotPendingSerials(requestNo: string, company?: string, plant?: string) {
    const header = await this.iqcRequestLotRepository.findOne({
      where: { requestNo, ...this.tenantWhere(company, plant) },
    });
    if (!header) return [];
    const lines = await this.iqcRequestLotLineRepository.find({
      where: { requestNo, ...this.tenantWhere(company, plant) },
    });
    if (lines.length === 0) return [];
    const lineKeys = new Set(lines.map((l) => `${l.arrivalNo}#${l.arrivalSeq}`));
    const candidates = await this.matLotRepository.find({
      where: {
        arrivalNo: In([...new Set(lines.map((l) => l.arrivalNo))]),
        itemCode: header.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(company, plant),
      },
      order: { matUid: 'ASC' },
    });
    return candidates.filter((lot) => lineKeys.has(`${lot.arrivalNo}#${lot.arrivalSeq}`));
  }


  /**
   * 바코드 1개로 검사의뢰서 출력 대상 그룹(입하번호+품목)을 해석한다 — 본 발행·재발행 공용.
   * 우선순위: 자재 시리얼(MAT_UID) → 입하번호(ARRIVAL_NO) → PO번호(PO_NO).
   * 검사 상태는 제한하지 않는다(검사 완료 후 재발행 허용). 취소된 LOT은 제외.
   * 매칭이 없으면 예외 대신 빈 그룹을 돌려 화면이 안내 메시지를 내도록 한다.
   */
  async resolveRequestTargetsByBarcode(
    barcode: string,
    company?: string,
    plant?: string,
  ): Promise<{ barcode: string; matchedBy: 'MAT_UID' | 'ARRIVAL_NO' | 'PO_NO' | null; groups: Array<{ arrivalNo: string; itemCode: string; iqcStatus: string | null }> }> {
    const code = (barcode ?? '').trim();
    if (!code) return { barcode: code, matchedBy: null, groups: [] };

    const attempts: Array<{ matchedBy: 'MAT_UID' | 'ARRIVAL_NO' | 'PO_NO'; column: string }> = [
      { matchedBy: 'MAT_UID', column: 'lot.matUid' },
      { matchedBy: 'ARRIVAL_NO', column: 'lot.arrivalNo' },
      { matchedBy: 'PO_NO', column: 'lot.poNo' },
    ];
    for (const attempt of attempts) {
      const qb = this.matLotRepository
        .createQueryBuilder('lot')
        .select('lot.arrivalNo', 'arrivalNo')
        .addSelect('lot.itemCode', 'itemCode')
        .addSelect('MAX(lot.iqcStatus)', 'iqcStatus')
        .where(`${attempt.column} = :code`, { code })
        .andWhere('lot.arrivalNo IS NOT NULL')
        .andWhere("lot.status <> 'CANCELED'");
      if (company) qb.andWhere('lot.company = :company', { company });
      if (plant) qb.andWhere('lot.plant = :plant', { plant });
      qb.groupBy('lot.arrivalNo').addGroupBy('lot.itemCode').orderBy('lot.arrivalNo', 'ASC').addOrderBy('lot.itemCode', 'ASC');
      const rows = await qb.getRawMany<{ arrivalNo: string; itemCode: string; iqcStatus: string | null }>();
      if (rows.length > 0) {
        return {
          barcode: code,
          matchedBy: attempt.matchedBy,
          groups: rows.map((r) => ({ arrivalNo: r.arrivalNo, itemCode: r.itemCode, iqcStatus: r.iqcStatus ?? null })),
        };
      }
    }
    return { barcode: code, matchedBy: null, groups: [] };
  }

  /**
   * 입하단위 IQC 검사 대상 목록 (입하번호 + 품목 단위 그룹 집계)
   * - 개별 시리얼이 아니라 ARRIVAL_NO + ITEM_CODE 로 묶어서 1행으로 반환
   * - 집계는 SQL GROUP BY 로 수행 (메모리 집계 금지)
   */
  async findPendingArrivals(query: PendingArrivalQueryDto, company?: string, plant?: string): Promise<PendingArrivalsResult> {
    const iqcStatus = query.iqcStatus || 'PENDING';
    // IQC_INSPECT_LOT_MODE=REQUEST 일 때만 의뢰 LOT 묶음 행을 섮는다. 기본값 ARRIVAL은 기존 동작 그대로다.
    const lotMode = await this.sysConfigService.getValue(IQC_INSPECT_LOT_MODE_KEY, company, plant);
    const requestMode = allowsIqcRequestLot(lotMode) && iqcStatus === 'PENDING';

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
    if (requestMode) {
      // 의뢰에 담긴 입하 행은 개별 행에서 뺀다. 아래에서 의뢰 LOT 묶음 행으로 대신 내려간다.
      // 외부 alias를 참조하는 상관 서브쿼리는 TypeORM이 alias를 물리 컬럼명으로 풀지 못해 ORA-00904가 난다.
      // 좌변만 엔티티 속성(lot.matUid)으로 두고, 서브쿼리는 외부 참조 없는 독립 raw SQL로 쓴다.
      qb.andWhere(`lot.matUid NOT IN (
        SELECT taken.MAT_UID
          FROM MAT_LOTS taken
          JOIN IQC_REQUEST_LOT_LINES ln
            ON ln.ARRIVAL_NO = taken.ARRIVAL_NO
           AND ln.ARRIVAL_SEQ = taken.ARRIVAL_SEQ
           AND ln.ITEM_CODE = taken.ITEM_CODE
           AND ln.COMPANY = taken.COMPANY
           AND ln.PLANT_CD = taken.PLANT_CD
          JOIN IQC_REQUEST_LOTS rq
            ON rq.REQUEST_NO = ln.REQUEST_NO
         WHERE rq.STATUS = 'REQUESTED'
      )`);
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

    const arrivalRows = rows.map((r) => ({
      requestNo: null as string | null,
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
    }));

    if (!requestMode) {
      return { data: arrivalRows, debugSql };
    }
    const requestRows = await this.findPendingRequestLots(query, company, plant);
    return { data: [...requestRows, ...arrivalRows], debugSql };
  }

  /**
   * REQUEST 모드에서 검사대기 목록에 섮을 의뢰 LOT 묶음 행.
   * 수량은 의뢰 확정 시 합의된 모집단(LOT_QTY)이 아니라 실제 PENDING 시리얼 기준으로 집계한다.
   */
  private async findPendingRequestLots(query: PendingArrivalQueryDto, company?: string, plant?: string) {
    const qb = this.iqcRequestLotRepository
      .createQueryBuilder('rq')
      .innerJoin(IqcRequestLotLine, 'ln', 'ln.requestNo = rq.requestNo AND ln.company = rq.company AND ln.plant = rq.plant')
      // 주의: 조인 조건은 한 줄로 쓴다. 줄바꿈이 들어가면 TypeORM이 alias.프로퍼티를
      // 실제 컬럼명으로 치환하지 못해 ORA-00904(예: "LN"."ITEMCODE")가 난다.
      .innerJoin(
        MatLot,
        'lot',
        "lot.arrivalNo = ln.arrivalNo AND lot.arrivalSeq = ln.arrivalSeq AND lot.itemCode = ln.itemCode AND lot.company = ln.company AND lot.plant = ln.plant AND lot.iqcStatus = 'PENDING'",
      )
      .leftJoin(ItemMaster, 'part', 'part.itemCode = rq.itemCode AND part.company = rq.company AND part.plant = rq.plant')
      .leftJoin(PartnerMaster, 'partner', 'partner.partnerCode = rq.vendorCode AND partner.company = rq.company AND partner.plant = rq.plant')
      .select('rq.requestNo', 'requestNo')
      .addSelect('rq.itemCode', 'itemCode')
      .addSelect('rq.lotQty', 'lotQty')
      .addSelect('part.itemName', 'itemName')
      .addSelect('part.unit', 'unit')
      .addSelect('part.inspectMethod', 'inspectMethod')
      .addSelect('part.defectModelGroup', 'defectModelGroup')
      .addSelect('rq.vendorCode', 'vendor')
      .addSelect('partner.partnerName', 'vendorName')
      .addSelect('MIN(lot.poNo)', 'poNo')
      .addSelect('SUM(lot.initQty)', 'totalQty')
      .addSelect('COUNT(*)', 'serialCount')
      .addSelect('MIN(lot.recvDate)', 'recvDate')
      .addSelect('MIN(rq.createdAt)', 'createdAt')
      .where("rq.status = 'REQUESTED'");

    if (company) qb.andWhere('rq.company = :company', { company });
    if (plant) qb.andWhere('rq.plant = :plant', { plant });
    if (query.search) {
      qb.andWhere('(rq.requestNo LIKE :search OR rq.itemCode LIKE :search)', { search: `%${query.search}%` });
    }

    qb.groupBy('rq.requestNo')
      .addGroupBy('rq.itemCode')
      .addGroupBy('rq.lotQty')
      .addGroupBy('rq.vendorCode')
      .addGroupBy('partner.partnerName')
      .addGroupBy('part.itemName')
      .addGroupBy('part.unit')
      .addGroupBy('part.inspectMethod')
      .addGroupBy('part.defectModelGroup')
      .orderBy('MIN(rq.createdAt)', 'DESC');

    const raw = await qb.getRawMany<{
      requestNo: string;
      itemCode: string;
      lotQty: string;
      itemName: string | null;
      unit: string | null;
      inspectMethod: string | null;
      defectModelGroup: string | null;
      vendor: string | null;
      vendorName: string | null;
      poNo: string | null;
      totalQty: string;
      serialCount: string;
      recvDate: Date | null;
      createdAt: Date | null;
    }>();

    return raw.map((r) => ({
      requestNo: r.requestNo,
      arrivalNo: r.requestNo,
      itemCode: r.itemCode,
      itemName: r.itemName ?? null,
      unit: r.unit ?? null,
      inspectMethod: r.inspectMethod ?? null,
      defectModelGroup: r.defectModelGroup ?? null,
      vendor: r.vendor ?? '',
      vendorName: r.vendorName ?? null,
      poNo: r.poNo ?? null,
      totalQty: Number(r.totalQty) || 0,
      serialCount: Number(r.serialCount) || 0,
      recvDate: r.recvDate,
      createdAt: r.createdAt,
      iqcStatus: 'PENDING',
    }));
  }

  /**
   * 입하단위 IQC 검사결과 등록
   * - 입하번호 + 품목에 속한 PENDING 시리얼 전체를 일괄 판정 (전수검사 아님, 샘플검사)
   * - PASS → 전체 시리얼 iqcStatus=PASS
   * - FAIL → 전체 시리얼 iqcStatus=FAIL + 각 시리얼 불량창고 이동
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
    // 같은 ARRIVAL_NO의 일부 행만 의뢰 LOT에 담겨 있을 수 있다.
    // REQUEST 모드의 검사대기 목록은 담긴 행을 빼고 잔여 행만 보여주므로, 판정 대상도 같은 집합이어야 한다.
    // 담긴 행까지 싸잡아 판정하면 의뢰 헤더가 REQUESTED로 남는 고아가 생기고,
    // 반대로 전체를 거절하면 화면에 보이는 잔여 행을 검사할 방법이 없어진다.
    const holds = await this.findRequestLotHolds(
      lots.map((lot) => ({ arrivalNo: lot.arrivalNo ?? null, arrivalSeq: lot.arrivalSeq, itemCode: lot.itemCode })),
      lots[0].company,
      lots[0].plant,
    );
    let targets = lots;
    if (holds.size > 0) {
      const detail = IqcHistoryService.describeRequestLotHolds(holds);
      const lotMode = await this.sysConfigService.getValue(IQC_INSPECT_LOT_MODE_KEY, company, plant);
      if (!allowsIqcRequestLot(lotMode)) {
        // 입하단위 모드인데 REQUESTED 의뢰가 남아 있다 = 모드를 되돌린 상태다.
        // 이때는 조용히 일부만 판정하지 않고 의뢰를 정리하게 한다.
        throw new BadRequestException(
          `검사의뢰 LOT에 포함된 입하 행입니다. 의뢰 단위로 검사하거나 의뢰를 취소하세요: ${detail}`,
        );
      }
      targets = lots.filter(
        (lot) => !holds.has(IqcHistoryService.requestLotRowKey(lot.arrivalNo ?? null, lot.arrivalSeq)),
      );
      if (targets.length === 0) {
        throw new BadRequestException(
          `이 입하의 검사대기 시리얼이 모두 검사의뢰 LOT에 포함되어 있습니다. 의뢰 단위로 검사하세요: ${detail}`,
        );
      }
    }

    const targetSeqs = targets
      .map((lot) => lot.arrivalSeq)
      .filter((seq): seq is number => seq != null);

    return this.judgeLotsWithAql({
      lots: targets,
      itemCode: dto.itemCode,
      representativeArrivalNo: dto.arrivalNo,
      dto,
      applyArrivalStatus: async (status, tenantCompany, tenantPlant) => {
        await this.matArrivalRepository.update(
          {
            arrivalNo: dto.arrivalNo,
            itemCode: dto.itemCode,
            iqcStatus: 'PENDING',
            // 의뢰에 담긴 행을 뺐다면 입하 행 갱신도 같은 범위로 좁힌다. 안 그러면 판정하지 않은 행까지 상태가 바뀐다.
            ...(holds.size > 0 && targetSeqs.length === targets.length ? { seq: In(targetSeqs) } : {}),
            ...this.tenantWhere(tenantCompany, tenantPlant),
          },
          { iqcStatus: status },
        );
      },
    });
  }

  /**
   * 검사의뢰 LOT(여러 입하 행을 한 모집단으로 묶은 단위) IQC 판정.
   *
   * 입하단위 판정(createArrivalResult)과 동일하게 'AqlService.resolveIqcPolicyByItem' 결과로
   * 합불을 결정한다. 차이는 두 가지다.
   * 1. 판정 대상이 의뢰에 담긴 (ARRIVAL_NO, ARRIVAL_SEQ) 행으로 한정된다.
   * 2. AQL 모집단 수량이 의뢰 확정 시 합의된 LOT_QTY다.
   */
  async createRequestLotResult(
    requestNo: string,
    dto: CreateArrivalIqcResultDto,
    company?: string,
    plant?: string,
  ) {
    const header = await this.iqcRequestLotRepository.findOne({
      where: { requestNo, ...this.tenantWhere(company, plant) },
    });
    if (!header) throw new NotFoundException(`의뢰 LOT이 없습니다: ${requestNo}`);
    if (header.status !== 'REQUESTED') {
      throw new BadRequestException('이미 판정되었거나 취소된 의뢰입니다.');
    }
    const lines = await this.iqcRequestLotLineRepository.find({
      where: { requestNo, ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });
    if (lines.length === 0) {
      throw new BadRequestException('의뢰 LOT에 구성 입하가 없습니다.');
    }

    // MAT_ARRIVALS/MAT_LOT 모두 입하 행 식별은 (ARRIVAL_NO, SEQ) 복합키다. ARRIVAL_NO만으로 좌허지 않는다.
    const lineKeys = new Set(lines.map((l) => `${l.arrivalNo}#${l.arrivalSeq}`));
    const candidates = await this.matLotRepository.find({
      where: {
        arrivalNo: In([...new Set(lines.map((l) => l.arrivalNo))]),
        itemCode: header.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(company, plant),
      },
    });
    const lots = candidates.filter((lot) => lineKeys.has(`${lot.arrivalNo}#${lot.arrivalSeq}`));
    if (lots.length === 0) {
      throw new NotFoundException(`검사 대상(PENDING) 시리얼이 없습니다: 의뢰 ${requestNo}`);
    }

    const sampleLine = lines.find((l) => l.lineRole === 'SAMPLE') ?? lines[0];

    // 모집단은 '의뢰 확정 시점의 스냅샷'(header.lotQty)이 정본이다. 판정 시점 시리얼 합과 갈라질 수 있다
    // (확정 후 시리얼이 취소되거나 분할되면 줄어든다). 이건 버그가 아니라 의도다 — AQL Ac/Re는 담당자가
    // 합의한 모집단 기준으로 뽑아야 하고, 검사 중에 모집단이 흔들리면 기준이 바뀐다.
    // 다만 나중에 추적이 되도록 어긋난 사실은 IQC_LOGS.REMARK에 남긴다.
    const judgedLotQty = lots.reduce((sum, lot) => sum + (Number(lot.initQty) || 0), 0);
    const snapshotLotQty = Number(header.lotQty) || 0;
    const driftNote =
      snapshotLotQty > 0 && judgedLotQty !== snapshotLotQty
        ? `[모집단드리프트:확정 ${snapshotLotQty} vs 판정시점 ${judgedLotQty}]`
        : '';

    const judged = await this.judgeLotsWithAql({
      lots,
      itemCode: header.itemCode,
      representativeArrivalNo: sampleLine.arrivalNo,
      dto,
      lotQtyOverride: Number(header.lotQty) || null,
      logRemarkPrefix: `[IQL:${requestNo}]${driftNote}`,
      requestNo,
      applyArrivalStatus: async (status, tenantCompany, tenantPlant) => {
        for (const line of lines) {
          await this.matArrivalRepository.update(
            {
              arrivalNo: line.arrivalNo,
              seq: line.arrivalSeq,
              itemCode: header.itemCode,
              iqcStatus: 'PENDING',
              ...this.tenantWhere(tenantCompany, tenantPlant),
            },
            { iqcStatus: status },
          );
        }
      },
    });

    header.status = judged.result;
    header.sampleQty = judged.aql?.sampleQty ?? header.sampleQty;
    await this.iqcRequestLotRepository.save(header);
    return { ...judged, requestNo };
  }

  /**
   * IQC 판정 공통 코어. 입하단위와 의뢰 LOT 단위가 같은 AQL 경로를 타도록 한 곳에 모은다.
   *
   * 프론트가 보낸 판정을 그대로 쓰지 않는다. 항상 aqlPolicy.result로 재정의한다.
   */
  private async judgeLotsWithAql(input: {
    lots: MatLot[];
    itemCode: string;
    /** IQC_LOGS에 남길 대표 입하번호 */
    representativeArrivalNo: string;
    dto: CreateArrivalIqcResultDto;
    /** 모집단 수량. 없으면 lots의 INIT_QTY 합을 쓴다. */
    lotQtyOverride?: number | null;
    /** IQC_LOGS.REMARK 접두어 (의뢰 LOT 추적용). REQUEST_NO 컬럼과 별개로 남긴다 — 기존 조회가 REMARK를 본다. */
    logRemarkPrefix?: string | null;
    /** IQC_LOGS.REQUEST_NO. 의뢰 LOT 판정에만 채운다. 역추적의 정본이다. */
    requestNo?: string | null;
    applyArrivalStatus: (
      status: 'PASS' | 'FAIL',
      tenantCompany: string,
      tenantPlant: string,
    ) => Promise<void>;
  }) {
    const { lots, itemCode, dto } = input;
    const tenantCompany = lots[0].company;
    const tenantPlant = lots[0].plant;
    const vendorCode = lots[0].vendor ?? null;
    const lotQty =
      Number(input.lotQtyOverride) > 0
        ? Number(input.lotQtyOverride)
        : lots.reduce((sum, lot) => sum + (Number(lot.initQty) || 0), 0);
    const defectCounts = this.resolveDefectCounts(dto);
    const itemDefectCounts = this.countFailByInspItem(dto.details);
    const destructive = this.parseDestructive(dto.details);
    for (const [seq, qty] of Object.entries(destructive.defects)) {
      itemDefectCounts[Number(seq)] = (itemDefectCounts[Number(seq)] ?? 0) + qty;
    }
    this.assertDefectCodesHaveFailedInspection(dto, itemDefectCounts);
    // 불량코드 수량을 FAIL 항목의 불량수에 귀속 — 시리얼 1개가 대량 LOT 인 경우 시리얼 FAIL 1건 ≠ 불량 1개(2026-09-09 결함 03)
    const defectQtyTotal = (dto.defects ?? []).reduce((sum, defect) => sum + this.toNonNegativeInt(defect.qty), 0);
    const attributedDefectCounts = this.aqlService.attributeDefectQtyToFailedItems(itemDefectCounts, defectQtyTotal);
    // 검사항목별(각 항목 검사수준/등급/AQL) 판정. 등급 설정 항목이 없으면 내부에서 품목 단일로 폴백.
    const aqlPolicy = await this.aqlService.resolveIqcPolicyByItem({
      itemCode,
      vendorCode,
      lotQty,
      itemDefectCounts: attributedDefectCounts,
      itemInspectedCounts: destructive.inspected,
      fallbackDefectCounts: defectCounts,
      fallbackDefectCodes: dto.defects,
      company: tenantCompany,
      plant: tenantPlant,
    });
    const finalResult = aqlPolicy.result;

    // 1) 판정 대상 시리얼 전체 일괄 판정. 입하단위는 입하건 전체, 의뢰 LOT은 담긴 행만 대상이다.
    await this.matLotRepository.update(
      {
        matUid: In(lots.map((lot) => lot.matUid)),
        iqcStatus: 'PENDING',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { iqcStatus: finalResult },
    );
    await input.applyArrivalStatus(finalResult, tenantCompany, tenantPlant);

    // 2) 검사 이력 1건 생성 (matUid=null → 입하단위 검사 표식)
    const log = this.iqcLogRepository.create({
      arrivalNo: input.representativeArrivalNo,
      matUid: null,
      itemCode,
      vendorCode,
      requestNo: input.requestNo ?? null,
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
      remark: [input.logRemarkPrefix, dto.remark].filter(Boolean).join(' ').trim() || null,
      inspectDate: new Date(),
      company: tenantCompany,
      plant: tenantPlant,
    });
    // 판정 대상은 이번에 실제로 판정한 시리얼이 달린 입하 행들이다.
    // 입하단위면 그 입하번호+품목 전체, 의뢰면 의뢰에 담긴 행만 남는다.
    const saved = await this.saveIqcLogWithTargets(
      log,
      lots.map((lot) => ({
        arrivalNo: lot.arrivalNo,
        arrivalSeq: lot.arrivalSeq,
        itemCode: lot.itemCode,
        matUid: null,
      })),
    );

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode, ...this.tenantWhere(tenantCompany, tenantPlant) },
    });

    // 3) PASS + 품목에 유효기간 설정 시 → 각 시리얼 expireDate 자동 계산
    if (finalResult === 'PASS' && part && (part.expiryDate ?? 0) > 0) {
      for (const lot of lots) {
        const expireDate = calcLotExpireDate(lot, part.expiryDate, new Date());
        await this.matLotRepository.update(
          { matUid: lot.matUid, ...this.tenantWhere(lot.company, lot.plant) },
          { expireDate },
        );
      }
    }

    // 4) FAIL → 입하건 전체 시리얼을 불량창고로 이동
    if (finalResult === 'FAIL') {
      for (const lot of lots) {
        await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
      }
    }

    // 5) PASS + 샘플수량 → 파괴검사 시료 자동출고 (AUTO_ISSUE 모드, 시리얼 순서대로 차감)
    if (finalResult === 'PASS' && dto.sampleQty && dto.sampleQty > 0) {
      const issueMode = await this.sysConfigService.getValue('IQC_SAMPLE_ISSUE_MODE', tenantCompany, tenantPlant);
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
      arrivalNo: input.representativeArrivalNo,
      itemCode,
      company: tenantCompany,
      plant: tenantPlant,
    });

    return {
      ...saved,
      arrivalNo: input.representativeArrivalNo,
      itemCode,
      itemName: part?.itemName ?? null,
      affectedSerials: lots.length,
      result: finalResult,
      aql: aqlPolicy,
    };
  }


  /**
   * IQC 판정 저장의 유일한 진입점. 판정 1건과 그 판정이 덮은 입하 행을 한 트랜잭션으로 함께 쓴다.
   *
   * 판정 대상 없는 판정이 생기면 역추적의 정본이 깨진다(입하취소 가드가 조용히 열린다).
   * 그래서 대상이 비면 저장하지 않고 막는다.
   * **판정 경로에서 iqcLogRepository.save() 를 직접 호출하지 말 것.** ADR 0004 참고.
   */
  private async saveIqcLogWithTargets(
    log: IqcLog,
    targets: Array<{ arrivalNo: string | null; arrivalSeq: number | null; itemCode: string; matUid: string | null }>,
  ): Promise<IqcLog> {
    // 같은 입하 행이 두 번 들어오면 PK 충돌이 난다. 판정 1건은 한 입하 행에 한 줄만 쓴다.
    const unique = new Map<string, { arrivalNo: string; arrivalSeq: number; itemCode: string; matUid: string | null }>();
    for (const t of targets) {
      if (!t.arrivalNo || !t.itemCode) continue;
      const arrivalSeq = Number(t.arrivalSeq) > 0 ? Number(t.arrivalSeq) : 1;
      const key = `${t.arrivalNo}#${arrivalSeq}#${t.itemCode}`;
      if (!unique.has(key)) {
        unique.set(key, { arrivalNo: t.arrivalNo, arrivalSeq, itemCode: t.itemCode, matUid: t.matUid ?? null });
      }
    }
    if (unique.size === 0) {
      throw new BadRequestException(
        'IQC 판정 대상(입하 행)을 특정할 수 없어 판정을 저장할 수 없습니다. 입하 정보를 확인하세요.',
      );
    }

    return this.tx.run(async (queryRunner) => {
      const saved = await queryRunner.manager.save(IqcLog, log);
      const rows = [...unique.values()].map((t) =>
        queryRunner.manager.create(IqcLogTarget, {
          inspectDate: saved.inspectDate,
          seq: saved.seq,
          arrivalNo: t.arrivalNo,
          arrivalSeq: t.arrivalSeq,
          itemCode: t.itemCode,
          matUid: t.matUid,
          company: saved.company,
          plant: saved.plant,
        }),
      );
      await queryRunner.manager.save(IqcLogTarget, rows);
      return saved;
    });
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

  /**
   * IQC FAIL 후처리.
   * - MANUAL(기본): 재고를 입하재고에 그대로 두고 「IQC불합격자재 불량창고입고」 화면에서 사용자가 입고한다(2026-09-11 06번).
   * - AUTO: 종전처럼 FAIL 저장 시 불량창고로 자동이동(REF_TYPE=IQC_FAIL).
   */
  private async handleIqcFail(
    matUid: string,
    itemCode: string,
    company?: string | null,
    plant?: string | null,
  ) {
    const mode = (await this.sysConfigService.getValue(IQC_FAIL_DEFECT_MOVE_MODE_KEY, company ?? undefined, plant ?? undefined)) ?? 'MANUAL';
    if (String(mode).toUpperCase() !== 'AUTO') return;
    const defectWarehouse = await this.warehouseRepository.findOne({
      where: { warehouseType: 'DEFECT', useYn: 'Y', isDefault: 'Y', ...this.tenantWhere(company, plant) },
    });
    if (!defectWarehouse) return;
    this.assertSameTenant('불량창고', { company, plant }, defectWarehouse);
    await this.moveLotToDefectWarehouse({
      matUid, itemCode, defectWarehouseCode: defectWarehouse.warehouseCode,
      refType: 'IQC_FAIL', remark: 'IQC 불합격 자동이동 (불량창고)', workerId: null, company, plant,
    });
  }

  /**
   * LOT 재고(창고재고 또는 입하재고)를 불량창고로 이동한다 — 자동이동(IQC_FAIL)·수동입고(IQC_DEFECT_RECEIVE) 공용.
   * @returns 생성된 STOCK_TRANSACTIONS.TRANS_NO (이동할 재고가 없으면 null)
   */
  async moveLotToDefectWarehouse(p: {
    matUid: string;
    itemCode: string;
    defectWarehouseCode: string;
    refType: string;
    remark: string;
    workerId?: string | null;
    company?: string | null;
    plant?: string | null;
  }): Promise<string | null> {
    const { matUid, itemCode, company, plant } = p;
    const defectWarehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode: p.defectWarehouseCode, ...this.tenantWhere(company, plant) },
    });
    if (!defectWarehouse) throw new NotFoundException(`불량창고를 찾을 수 없습니다: ${p.defectWarehouseCode}`);
    this.assertSameTenant('불량창고', { company, plant }, defectWarehouse);

    const stock = await this.matStockRepository.findOne({
      where: { matUid, itemCode, ...this.tenantWhere(company, plant) },
    });
    if (stock && stock.qty > 0 && stock.warehouseCode !== defectWarehouse.warehouseCode) {
      this.assertSameTenant('IQC 대상 재고', { company, plant }, stock);
      return this.moveQtyToDefectWarehouse({
        qty: stock.qty,
        fromWarehouseId: stock.warehouseCode,
        defectWarehouseCode: defectWarehouse.warehouseCode,
        itemCode,
        matUid,
        refType: p.refType,
        remark: p.remark,
        workerId: p.workerId ?? null,
        company,
        plant,
        clearSource: async (queryRunner) => {
          await queryRunner.manager.update(
            MatStock,
            { warehouseCode: stock.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) },
            { qty: 0 },
          );
        },
      });
    }

    const arrivalStock = await this.dataSource.getRepository(MatArrivalStock).findOne({
      where: { matUid, itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!arrivalStock || arrivalStock.qty <= 0) return null;
    this.assertSameTenant('IQC 대상 입하재고', { company, plant }, arrivalStock);

    return this.moveQtyToDefectWarehouse({
      qty: arrivalStock.qty,
      fromWarehouseId: arrivalStock.warehouseCode,
      defectWarehouseCode: defectWarehouse.warehouseCode,
      itemCode,
      matUid,
      refType: p.refType,
      remark: p.remark,
      workerId: p.workerId ?? null,
      company,
      plant,
      clearSource: async (queryRunner) => {
        await queryRunner.manager.update(
          MatArrivalStock,
          {
            company: arrivalStock.company,
            plant: arrivalStock.plant,
            matUid: arrivalStock.matUid,
          },
          { qty: 0, availableQty: 0, status: 'DEPLETED' },
        );
      },
    });
  }

  private async moveQtyToDefectWarehouse(p: {
    qty: number;
    fromWarehouseId: string;
    defectWarehouseCode: string;
    itemCode: string;
    matUid: string;
    refType: string;
    remark: string;
    workerId?: string | null;
    company?: string | null;
    plant?: string | null;
    clearSource: (queryRunner: QueryRunner) => Promise<void>;
  }): Promise<string> {
    return this.tx.run(async (queryRunner) => {
      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
      await p.clearSource(queryRunner);

      const existing = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode: p.defectWarehouseCode,
          itemCode: p.itemCode,
          matUid: p.matUid,
          ...this.tenantWhere(p.company, p.plant),
        },
      });
      if (existing) {
        await queryRunner.manager.createQueryBuilder().update(MatStock)
          .set({ qty: () => '"QTY" + :stockDelta', availableQty: () => '"AVAILABLE_QTY" + :stockDelta' })
          .where({
            warehouseCode: p.defectWarehouseCode,
            itemCode: p.itemCode,
            matUid: p.matUid,
            ...this.tenantWhere(p.company, p.plant),
          }).setParameters({ stockDelta: p.qty }).execute();
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: p.defectWarehouseCode,
          itemCode: p.itemCode,
          matUid: p.matUid,
          qty: p.qty,
          reservedQty: 0,
          availableQty: p.qty,
          company: p.company,
          plant: p.plant,
        });
      }

      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_MOVE',
        transDate: new Date(),
        fromWarehouseId: p.fromWarehouseId,
        toWarehouseId: p.defectWarehouseCode,
        itemCode: p.itemCode,
        matUid: p.matUid,
        qty: p.qty,
        remark: p.remark,
        refType: p.refType,
        workerId: p.workerId ?? null,
        status: 'DONE',
        company: p.company,
        plant: p.plant,
      });
      return transNo;
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

      const changed = await queryRunner.manager.createQueryBuilder().update(MatStock)
        .set({ qty: () => '"QTY" - :stockDelta', availableQty: () => '"AVAILABLE_QTY" - :stockDelta' })
        .where({ warehouseCode: stock.warehouseCode, itemCode, matUid, ...this.tenantWhere(company, plant) })
        .andWhere('"QTY" >= :stockDelta AND "AVAILABLE_QTY" >= :stockDelta')
        .setParameters({ stockDelta: sampleQty }).execute();
      if ((changed.affected ?? 0) !== 1) throw new BadRequestException('동시 처리로 IQC 파괴검사 재고가 변경되었습니다.');

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

      // 복원 범위는 그 판정이 덮은 입하 행(IQC_LOG_TARGETS)이 정한다.
      // 구성 라인(IQC_REQUEST_LOT_LINES)으로 정하면 안 된다 — 그건 판정 *전*의 계획이라
      // 판정 이후 의뢰가 바뀌면 사라지고, 대표 입하번호 전체로 정하면 의뢰 밖 행까지
      // 되돌아간다. 판정 대상은 판정 *후*의 불변 스냅샷이다. ADR 0004 참고.
      // 재검사(RETEST)는 시리얼 스코프 판정이라 ARRIVAL_NO도 판정 대상도 없다.
      // 대상을 요구하는 것은 입하 스코프 판정(ARRIVAL_NO 보유)뿐이다.
      const targets = log.arrivalNo
        ? await queryRunner.manager.find(IqcLogTarget, {
            where: { inspectDate: log.inspectDate, seq: log.seq, ...this.tenantWhere(log.company, log.plant) },
          })
        : [];
      if (log.arrivalNo && targets.length === 0) {
        // 대상 없는 입하 스코프 판정은 복원 범위를 알 수 없다. 조용히 아무것도 안 되돌리면
        // 시리얼이 FAIL/불량창고에 남은 채 판정만 취소돼 상태가 어긋난다.
        throw new BadRequestException(
          `판정 대상(입하 행) 정보가 없어 취소할 수 없습니다: ${inspectDate}/${seq}`,
        );
      }

      if (!log.matUid && log.result === 'FAIL') {
        for (const target of targets) {
          const failedLots = await queryRunner.manager.find(MatLot, {
            where: {
              arrivalNo: target.arrivalNo,
              arrivalSeq: target.arrivalSeq,
              itemCode: target.itemCode,
              iqcStatus: 'FAIL',
              ...this.tenantWhere(log.company, log.plant),
            },
          });
          for (const lot of failedLots) {
            await this.reverseIqcFailMove(queryRunner, lot.matUid, lot.itemCode, lot.company, lot.plant);
          }
        }
      }

      await queryRunner.manager.update(
        IqcLog,
        { inspectDate: new Date(inspectDate), seq, ...this.tenantWhere(log.company, log.plant) },
        { status: 'CANCELED', remark: dto.reason },
      );

      if (log.matUid) {
        // EXPIRE_DATE는 PASS 판정 시 계산되는 파생값이라 취소하면 같이 지워야 한다(입하단위 경로와 동일).
        await queryRunner.manager.update(
          MatLot,
          { matUid: log.matUid, ...this.tenantWhere(log.company, log.plant) },
          { iqcStatus: 'PENDING', expireDate: null },
        );
      } else {
        // 입하단위/의뢰 판정 → 판정 대상 행만 PENDING으로 되돌린다.
        // 검사 단위가 무엇이었든 복원 범위는 대상 스냅샷 하나로 결정된다.
        for (const target of targets) {
          await queryRunner.manager.update(
            MatLot,
            {
              arrivalNo: target.arrivalNo,
              arrivalSeq: target.arrivalSeq,
              itemCode: target.itemCode,
              iqcStatus: log.result,
              ...this.tenantWhere(log.company, log.plant),
            },
            { iqcStatus: 'PENDING', expireDate: null },
          );
          await queryRunner.manager.update(
            MatArrival,
            {
              arrivalNo: target.arrivalNo,
              seq: target.arrivalSeq,
              itemCode: target.itemCode,
              iqcStatus: log.result,
              ...this.tenantWhere(log.company, log.plant),
            },
            { iqcStatus: 'PENDING' },
          );
        }
        if (log.requestNo) {
          // 헤더를 안 되돌리면 STATUS가 PASS/FAIL로 남아 재검사가 영영 막힌다
          // (createRequestLotResult는 REQUESTED만 받는다).
          await queryRunner.manager.update(
            IqcRequestLot,
            { requestNo: log.requestNo, ...this.tenantWhere(log.company, log.plant) },
            { status: 'REQUESTED', sampleQty: null },
          );
        }
      }
    });

    await this.aqlService.revertVendorInspectionModeForCanceledLot({
      vendorCode: log.vendorCode,
      arrivalNo: log.arrivalNo,
      itemCode: log.itemCode,
      // 이 판정이 만든 모드 이력만 되돌리도록 검사일시를 넘긴다
      inspectedAt: log.inspectDate,
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
        refType: In(['IQC_FAIL', IQC_DEFECT_RECEIVE_REF_TYPE]),
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

    const decreased = await queryRunner.manager.createQueryBuilder().update(MatStock)
      .set({ qty: () => '"QTY" - :stockDelta', availableQty: () => '"AVAILABLE_QTY" - :stockDelta' })
      .where({ warehouseCode: failMove.toWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) })
      .andWhere('"QTY" >= :stockDelta AND "AVAILABLE_QTY" >= :stockDelta')
      .setParameters({ stockDelta: failMove.qty }).execute();
    if ((decreased.affected ?? 0) !== 1) throw new BadRequestException(`불량창고 재고가 동시에 변경되었습니다. LOT: ${matUid}`);

    if (sourceStock) {
      await queryRunner.manager.createQueryBuilder().update(MatStock)
        .set({ qty: () => '"QTY" + :stockDelta', availableQty: () => '"AVAILABLE_QTY" + :stockDelta' })
        .where({ warehouseCode: failMove.fromWarehouseId, itemCode, matUid, ...this.tenantWhere(company, plant) })
        .setParameters({ stockDelta: failMove.qty }).execute();
    } else {
      await queryRunner.manager.save(MatStock, {
        warehouseCode: failMove.fromWarehouseId,
        itemCode,
        matUid,
        qty: failMove.qty,
        reservedQty: 0,
        availableQty: failMove.qty,
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
