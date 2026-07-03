/**
 * @file src/modules/production/services/prod-result.service.ts
 * @description 생산실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **실적 집계**: 작업지시별, 설비별, 작업자별 실적 집계
 * 3. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 * 4. **PK**: resultNo(채번 문자열)
 *
 * 실제 DB 스키마 (PROD_RESULTS 테이블):
 * - RESULT_NO: PK (SeqGenerator 채번)
 * - ORDER_NO: 작업지시 참조
 * - status: compatibility field; production results are confirmed at registration time.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Like, Not, In, DataSource, Brackets } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  ProdOrderResultQueryDto,
  CompleteProdResultDto,
  ProdResultProductionType,
} from '../dto/prod-result.dto';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { FgLabel } from '../../../entities/fg-label.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { SelfInspectResult } from '../../../entities/self-inspect-result.entity';
import { ShiftResolver } from '../../../utils/shift-resolver';

const SELF_INSPECT_BATCH_WINDOW_MS = 10_000;

@Injectable()
export class ProdResultService {
  private readonly logger = new Logger(ProdResultService.name);
  private shiftResolver: ShiftResolver;

  constructor(
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(EquipBomRel)
    private readonly equipBomRelRepository: Repository<EquipBomRel>,
    @InjectRepository(EquipBomItem)
    private readonly equipBomItemRepository: Repository<EquipBomItem>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkerMaster)
    private readonly workerMasterRepository: Repository<WorkerMaster>,
    private readonly dataSource: DataSource,
    private readonly autoIssueService: AutoIssueService,
    private readonly productInventoryService: ProductInventoryService,
    private readonly wipMatStockService: WipMatStockService,
    private readonly numbering: NumberingService,
    private readonly sysConfigService: SysConfigService,
    @InjectRepository(ShiftPattern)
    private readonly shiftPatternRepo: Repository<ShiftPattern>,
    private readonly tx: TransactionService,
  ) {
    this.shiftResolver = new ShiftResolver(this.shiftPatternRepo);
  }

  private buildProdResultUpdate(
    dto: Omit<UpdateProdResultDto, 'status' | 'orderNo'>,
  ): Partial<Pick<ProdResult,
    | 'equipCode'
    | 'workerId'
    | 'prdUid'
    | 'processCode'
    | 'goodQty'
    | 'defectQty'
    | 'startAt'
    | 'endAt'
    | 'cycleTime'
    | 'remark'
    | 'shiftCode'
  >> {
    return {
      ...(dto.equipCode !== undefined ? { equipCode: dto.equipCode } : {}),
      ...(dto.workerId !== undefined ? { workerId: dto.workerId ?? null } : {}),
      ...(dto.prdUid !== undefined ? { prdUid: dto.prdUid } : {}),
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.goodQty !== undefined ? { goodQty: dto.goodQty } : {}),
      ...(dto.defectQty !== undefined ? { defectQty: dto.defectQty } : {}),
      ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt) } : {}),
      ...(dto.cycleTime !== undefined ? { cycleTime: dto.cycleTime } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.shiftCode !== undefined ? { shiftCode: dto.shiftCode } : {}),
    };
  }

  /**
   * 생산실적 목록 조회
   */
  async findAll(query: ProdResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      search,
      orderNo,
      equipCode,
      workerId,
      prdUid,
      processCode,
      status,
      productionType,
      shiftCode,
      startTimeFrom,
      startTimeTo,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.jobOrder', 'jobOrder')
      .leftJoinAndSelect('jobOrder.part', 'part')
      .leftJoinAndSelect('pr.equip', 'equip')
      .leftJoinAndSelect('pr.worker', 'worker');

    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    if (search) {
      const upperSearch = `%${search.toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(pr.resultNo) LIKE :search OR UPPER(pr.orderNo) LIKE :search OR UPPER(pr.prdUid) LIKE :search)',
        { search: upperSearch },
      );
    }
    if (orderNo) qb.andWhere('pr.orderNo = :orderNo', { orderNo });
    if (equipCode) qb.andWhere('pr.equipCode = :equipCode', { equipCode });
    if (workerId) qb.andWhere('pr.workerId = :workerId', { workerId });
    if (prdUid) qb.andWhere('pr.prdUid LIKE :prdUid', { prdUid: `%${prdUid}%` });
    if (processCode) qb.andWhere('pr.processCode = :processCode', { processCode });
    if (status) qb.andWhere('pr.status = :status', { status });
    if (productionType) qb.andWhere('pr.productionType = :productionType', { productionType });
    if (shiftCode) qb.andWhere('pr.shiftCode = :shiftCode', { shiftCode });
    if (startTimeFrom) qb.andWhere("pr.startAt >= TO_DATE(:startTimeFrom, 'YYYY-MM-DD')", { startTimeFrom });
    if (startTimeTo) qb.andWhere("pr.startAt < TO_DATE(:startTimeTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { startTimeTo });

    qb.orderBy('pr.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await Promise.all([
      qb.getMany(),
      qb.getCount(),
    ]);

    const toKstDate = (d: Date | null): string => {
      if (!d) return '';
      const kst = new Date(d.getTime() + 9 * 3600 * 1000);
      return kst.toISOString().slice(0, 10);
    };

    const downstreamMap = await this.computeDownstreamProgressMap(
      data.map((pr) => ({ resultNo: pr.resultNo, prdUid: pr.prdUid })),
      company,
      plant,
    );

    const mapped = data.map((pr) => ({
      ...pr,
      itemCode: pr.jobOrder?.itemCode ?? '',
      itemName: pr.jobOrder?.part?.itemName ?? '',
      lineName: pr.jobOrder?.lineCode ?? '',
      processType: pr.processCode ?? '',
      equipName: pr.equip?.equipName ?? '',
      workDate: toKstDate(pr.startAt),
      totalQty: (pr.goodQty ?? 0) + (pr.defectQty ?? 0),
      workerName: pr.worker?.workerName ?? null,
      workerDept: (pr.worker as any)?.dept ?? null,
      hasDownstreamProgress: downstreamMap.get(pr.resultNo) ?? false,
    }));

    return { data: mapped, total, page, limit };
  }

  /**
   * 작업지시 대비 실적 조회
   * - JOB_ORDERS를 기준으로 조회해 실적이 없는 작업지시도 포함한다.
   * - CANCELED 실적은 집계에서 제외한다.
   */
  async getSummaryByJobOrderList(query: ProdOrderResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      search,
      orderNo,
      itemCode,
      lineCode,
      equipCode,
      status,
      processCode,
      orderKind,
      planDateFrom,
      planDateTo,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoin('jo.part', 'part')
      .leftJoin(
        'jo.prodResults',
        'pr',
        [
          'pr.status != :canceled',
          'pr.company = jo.company',
          'pr.plant = jo.plant',
        ].join(' AND '),
        { canceled: 'CANCELED' },
      );

    if (company) qb.andWhere('jo.company = :company', { company });
    if (plant) qb.andWhere('jo.plant = :plant', { plant });
    if (orderNo) qb.andWhere('jo.orderNo LIKE :orderNo', { orderNo: `%${orderNo.toUpperCase()}%` });
    if (itemCode) qb.andWhere('jo.itemCode = :itemCode', { itemCode });
    if (lineCode) qb.andWhere('jo.lineCode = :lineCode', { lineCode });
    if (equipCode) {
      qb.andWhere(new Brackets((qb2) => {
        qb2.where('jo.equipCode = :equipCode')
          .orWhere('pr.equipCode = :equipCode');
      }), { equipCode });
    }
    if (status) qb.andWhere('jo.status = :status', { status });
    if (processCode) qb.andWhere('jo.processCode = :processCode', { processCode });
    if (orderKind) qb.andWhere('jo.orderKind = :orderKind', { orderKind });
    if (planDateFrom) qb.andWhere("jo.planDate >= TO_DATE(:planDateFrom, 'YYYY-MM-DD')", { planDateFrom });
    if (planDateTo) qb.andWhere("jo.planDate < TO_DATE(:planDateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { planDateTo });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(UPPER(jo.orderNo) LIKE :search OR UPPER(jo.itemCode) LIKE :search OR part.itemName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const countRaw = await qb.clone()
      .select('COUNT(DISTINCT jo.orderNo)', 'total')
      .getRawOne<{ total?: string | number }>();
    const total = Number(countRaw?.total ?? 0);

    const raw = await qb
      .select([
        'jo.orderNo AS "orderNo"',
        'jo.parentOrderNo AS "parentOrderNo"',
        'jo.rootOrderNo AS "rootOrderNo"',
        'jo.planNo AS "planNo"',
        'jo.itemCode AS "itemCode"',
        'part.itemName AS "itemName"',
        'part.itemType AS "itemType"',
        'jo.lineCode AS "lineCode"',
        'jo.processCode AS "processCode"',
        'jo.orderKind AS "orderKind"',
        'jo.routingSeq AS "routingSeq"',
        'jo.equipCode AS "equipCode"',
        'jo.planQty AS "planQty"',
        'jo.planDate AS "planDate"',
        'jo.status AS "status"',
        'SUM(NVL(pr.goodQty, 0)) AS "totalGoodQty"',
        'SUM(NVL(pr.defectQty, 0)) AS "totalDefectQty"',
        'COUNT(pr.resultNo) AS "resultCount"',
        'MAX(pr.startAt) AS "lastResultAt"',
      ])
      .groupBy('jo.orderNo')
      .addGroupBy('jo.parentOrderNo')
      .addGroupBy('jo.rootOrderNo')
      .addGroupBy('jo.planNo')
      .addGroupBy('jo.itemCode')
      .addGroupBy('part.itemName')
      .addGroupBy('part.itemType')
      .addGroupBy('jo.lineCode')
      .addGroupBy('jo.processCode')
      .addGroupBy('jo.orderKind')
      .addGroupBy('jo.routingSeq')
      .addGroupBy('jo.equipCode')
      .addGroupBy('jo.planQty')
      .addGroupBy('jo.planDate')
      .addGroupBy('jo.status')
      .orderBy('jo.planDate', 'DESC', 'NULLS LAST')
      .addOrderBy('jo.orderNo', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    const formatDate = (value: Date | string | null): string => {
      if (!value) return '';
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    };

    const data = raw.map((row) => {
      const planQty = Number(row.planQty ?? 0);
      const totalGoodQty = Number(row.totalGoodQty ?? 0);
      const totalDefectQty = Number(row.totalDefectQty ?? 0);
      const totalQty = totalGoodQty + totalDefectQty;
      const remainingQty = Math.max(planQty - totalGoodQty, 0);
      return {
        orderNo: row.orderNo,
        parentOrderNo: row.parentOrderNo ?? null,
        rootOrderNo: row.rootOrderNo ?? null,
        planNo: row.planNo ?? null,
        itemCode: row.itemCode ?? '',
        itemName: row.itemName ?? '',
        itemType: row.itemType ?? '',
        lineCode: row.lineCode ?? '',
        processCode: row.processCode ?? '',
        orderKind: row.orderKind ?? '',
        routingSeq: row.routingSeq !== null && row.routingSeq !== undefined ? Number(row.routingSeq) : null,
        equipCode: row.equipCode ?? '',
        planQty,
        planDate: formatDate(row.planDate),
        status: row.status ?? '',
        totalGoodQty,
        totalDefectQty,
        totalQty,
        remainingQty,
        achievementRate: planQty > 0 ? Math.round((totalGoodQty / planQty) * 1000) / 10 : 0,
        defectRate: totalQty > 0 ? Math.round((totalDefectQty / totalQty) * 1000) / 10 : 0,
        resultCount: Number(row.resultCount ?? 0),
        lastResultAt: formatDate(row.lastResultAt),
      };
    });

    return { data, total, page, limit };
  }

  /**
   * 생산실적 단건 조회 (resultNo)
   */
  async findById(resultNo: string, company?: string, plant?: string) {
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'jobOrder.part', 'equip', 'worker', 'inspectResults', 'defectLogs'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${resultNo}`);
    }

    // Filter inspectResults (only passYn = 'N') and limit to 10
    if (prodResult.inspectResults) {
      prodResult.inspectResults = prodResult.inspectResults
        .filter((r) => r.passYn === 'N')
        .slice(0, 10);
    }

    // Limit defectLogs to 10
    if (prodResult.defectLogs) {
      prodResult.defectLogs = prodResult.defectLogs.slice(0, 10);
    }

    // 자재 투입 이력 조회
    const matIssues = await this.findMatIssues(prodResult.resultNo, company, plant);

    return { ...prodResult, matIssues };
  }

  /**
   * 생산실적의 자재 투입 이력 조회
   */
  async findMatIssues(resultNo: string, company?: string, plant?: string) {
    const issues = await this.matIssueRepository.find({
      where: {
        prodResultNo: resultNo,
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { issueDate: 'DESC' },
    });

    // LOT 및 품목 정보 추가
    const matUids = issues.map(i => i.matUid).filter(Boolean);
    const lots = matUids.length > 0
      ? await this.dataSource.getRepository(MatLot).find({
          where: {
            matUid: In(matUids),
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : [];
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const itemCodes = lots.map((l) => l.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({
          where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    return issues.map(issue => {
      const lot = lotMap.get(issue.matUid);
      const part = lot ? partMap.get(lot.itemCode) : null;
      return {
        ...issue,
        matUid: issue.matUid,
        itemCode: lot?.itemCode ?? null,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
      };
    });
  }

  /**
   * 작업지시별 생산실적 목록 조회
   */
  async findByJobOrderId(orderNo: string, company?: string, plant?: string) {
    return this.prodResultRepository.find({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      order: { createdAt: 'DESC' },
      relations: ['equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        productionType: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 설비부품 인터락 체크
   * - 작업지시 품목과 설비에 장착된 부품이 일치하는지 확인
   * - 불일치 시 BadRequestException 발생
   */
  private async checkEquipBomInterlock(
    equipCode: string | null | undefined,
    orderNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    if (!equipCode) return; // 설비 미지정 시 체크 불필요

    // 작업지시 품목 조회
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
    if (!jobOrder?.part) return; // 품목 정보 없으면 체크 불필요

    const jobPartCode = jobOrder.part.itemCode;

    // 설비에 장착된 BOM 부품 조회
    const equipBomRels = await this.equipBomRelRepository.find({
      where: { equipCode, useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (equipBomRels.length === 0) return; // 설비 BOM 미설정 시 체크 불필요

    const bomItemCodes = equipBomRels.map(rel => rel.bomItemCode);
    const bomItems = await this.equipBomItemRepository.find({
      where: { bomItemCode: In(bomItemCodes), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    // 설비 BOM 품목 코드 목록
    const equipPartCodes = bomItems.map(item => item.bomItemCode);

    // 품목 코드 일치 여부 확인
    // - 작업지시 품번이 설비 BOM에 포함되거나
    // - 또는 작업지시 품번과 설비 BOM 품번이 일치하는지 확인
    const isMatched = equipPartCodes.some(code => 
      code === jobPartCode || 
      jobPartCode.includes(code) || 
      code.includes(jobPartCode)
    );

    if (!isMatched) {
      throw new BadRequestException(
        `설비부품 인터락 오류: 작업지시 품목(${jobPartCode})이 ` +
        `설비(${equipCode})의 장착부품(${equipPartCodes.join(', ')})과 일치하지 않습니다. ` +
        `설비부품을 교체하거나 작업지시를 확인하세요.`
      );
    }
  }

  private latestFirstInspectionBatchPassed(rows: Array<Pick<SelfInspectResult, 'status' | 'createdAt'>>): boolean {
    if (rows.length === 0) return false;
    const latestAt = new Date(rows[0].createdAt).getTime();
    if (!Number.isFinite(latestAt)) return false;

    const latestBatch = rows.filter((row) => {
      const rowAt = new Date(row.createdAt).getTime();
      return Number.isFinite(rowAt) && Math.abs(latestAt - rowAt) <= SELF_INSPECT_BATCH_WINDOW_MS;
    });

    return latestBatch.length > 0 && latestBatch.every((row) => row.status === 'PASS');
  }

  private async resolveProductionTypeByFirstInspect(
    orderNo: string,
    company?: string,
    plant?: string,
  ): Promise<ProdResultProductionType> {
    const rows = await this.dataSource.getRepository(SelfInspectResult).find({
      where: {
        orderNo,
        timing: 'FIRST',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 100,
      select: ['id', 'status', 'createdAt'],
    });

    return this.latestFirstInspectionBatchPassed(rows) ? 'MASS' : 'TRIAL';
  }

  /**
   * 작업지시 수량 초과 체크
   * - 기등록 실적 + 새 실적의 합이 planQty를 초과하는지 확인
   */
  private async checkJobOrderQtyLimit(
    orderNo: string,
    newGoodQty: number,
    newDefectQty: number,
    company?: string,
    plant?: string,
  ): Promise<void> {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['orderNo', 'planQty'],
    });
    
    if (!jobOrder) return; // 작업지시 없으면 체크 불필요
    if (!jobOrder.planQty || jobOrder.planQty <= 0) return; // planQty 미설정 시 체크 불필요

    // 기등록 실적 집계
    const existingSummary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGood')
      .addSelect('SUM(pr.defectQty)', 'totalDefect')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere(company ? 'pr.company = :company' : '1=1', company ? { company } : {})
      .andWhere(plant ? 'pr.plant = :plant' : '1=1', plant ? { plant } : {})
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' })
      .getRawOne();

    const existingGood = parseInt(existingSummary?.totalGood) || 0;
    const existingDefect = parseInt(existingSummary?.totalDefect) || 0;
    const existingTotal = existingGood + existingDefect;

    const willBeTotal = existingTotal + newGoodQty + newDefectQty;

    // 수량 초과 체크
    if (willBeTotal > jobOrder.planQty) {
      throw new BadRequestException(
        `작업지시(${jobOrder.orderNo}) 수량 초과: ` +
        `계획수량 ${jobOrder.planQty}, ` +
        `기등록 ${existingTotal} (양품${existingGood}/불량${existingDefect}), ` +
        `이번입력 ${newGoodQty + newDefectQty} (양품${newGoodQty}/불량${newDefectQty})`
      );
    }
  }

  /**
   * 생산실적 생성
   */
  async create(dto: CreateProdResultDto, company?: string, plant?: string) {
    // 작업지시 존재 및 상태 확인
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
    }
    this.assertTenantConsistency('생산실적 작업지시', {
      expected: { company, plant },
      sources: [{ label: 'jobOrder', company: jobOrder.company, plant: jobOrder.plant }],
    });

    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시에는 실적을 등록할 수 없습니다.`);
    }
    if (jobOrder.status === 'HOLD') {
      throw new BadRequestException(`홀딩된 작업지시에는 실적을 등록할 수 없습니다.`);
    }

    // 불량 상세가 오면 합계로 defectQty를 산정한다(상세=권위). 이중 카운트 방지를 위해
    // DefectLog는 본 트랜잭션에서 직접 저장하고 별도 증가 로직(defect-log.service)을 거치지 않는다.
    const defectDetails = dto.defects ?? [];
    const defectsTotal = defectDetails.reduce((sum, d) => sum + (d.qty ?? 1), 0);
    const effectiveDefectQty = defectDetails.length > 0 ? defectsTotal : (dto.defectQty ?? 0);

    // 작업지시 수량 초과 체크
    await this.checkJobOrderQtyLimit(dto.orderNo, dto.goodQty ?? 0, effectiveDefectQty, company, plant);

    // 설비부품 인터락 체크
    await this.checkEquipBomInterlock(dto.equipCode, dto.orderNo, company, plant);

    // 설비 존재 확인 (옵션)
    if (dto.equipCode) {
      const equip = await this.equipMasterRepository.findOne({
        where: { equipCode: dto.equipCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
      if (!equip) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
      }
      this.assertTenantConsistency('생산실적 설비', {
        expected: { company, plant },
        sources: [{ label: 'equip', company: equip.company, plant: equip.plant }],
      });
    }

    // 실적 공정이 작업지시 라우팅에 존재하는지 검증 — 엉뚱한 공정 실적 차단(예외 배제)
    if (dto.processCode) {
      if (!jobOrder.routingCode) {
        throw new BadRequestException(
          `작업지시에 라우팅이 없어 공정 실적을 등록할 수 없습니다: ${dto.orderNo}`,
        );
      }
      const step = await this.jobOrderRepository.manager.findOne(RoutingProcess, {
        where: {
          routingCode: jobOrder.routingCode,
          processCode: dto.processCode,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
      if (!step) {
        throw new BadRequestException(
          `공정 '${dto.processCode}'가 작업지시 라우팅(${jobOrder.routingCode})에 없습니다: ${dto.orderNo}`,
        );
      }
    }

    // 작업자 존재 확인 (옵션)
    // PROD_RESULTS.worker 관계는 WORKER_MASTERS.workerCode를 참조하므로 작업자마스터를 우선 조회한다.
    // (입력 화면들은 workerCode를 workerId로 전송). 과거 데이터 호환을 위해 USERS.email 폴백도 허용한다.
    if (dto.workerId) {
      const tenantWhere = {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      };
      const worker = await this.workerMasterRepository.findOne({
        where: { workerCode: dto.workerId, ...tenantWhere },
      });
      const legacyUser = worker
        ? null
        : await this.userRepository.findOne({
            where: { email: dto.workerId, ...tenantWhere },
          });
      if (!worker && !legacyUser) {
        throw new NotFoundException(`작업자를 찾을 수 없습니다: ${dto.workerId}`);
      }
    }

    const productionType = await this.resolveProductionTypeByFirstInspect(dto.orderNo, company, plant);

    let savedResultNo!: string;
    await this.tx.run(async (queryRunner) => {
      const resultNo = await this.numbering.next('PROD_RESULT', queryRunner);
      const occurredAt = dto.startAt ? new Date(dto.startAt) : new Date();
      const prodResult = queryRunner.manager.create(ProdResult, {
        resultNo,
        orderNo: dto.orderNo,
        equipCode: dto.equipCode,
        workerId: dto.workerId ?? null,
        prdUid: dto.prdUid,
        processCode: dto.processCode,
        goodQty: dto.goodQty ?? 0,
        defectQty: effectiveDefectQty,
        startAt: occurredAt,
        endAt: dto.endAt ? new Date(dto.endAt) : occurredAt,
        cycleTime: dto.cycleTime,
        status: 'DONE',
        productionType,
        remark: dto.remark,
        company: jobOrder.company,
        plant: jobOrder.plant,
      });

      // 교대 자동판별
      if (dto.shiftCode) {
        prodResult.shiftCode = dto.shiftCode;
      } else if (prodResult.startAt && jobOrder.company && jobOrder.plant) {
        prodResult.shiftCode = await this.shiftResolver.resolve(
          new Date(prodResult.startAt), jobOrder.company, jobOrder.plant,
        );
      }

      const saved = await queryRunner.manager.save(ProdResult, prodResult);
      savedResultNo = saved.resultNo;

      // 실적이 최초 등록되면 작업지시를 RUNNING으로 승격한다.
      if (jobOrder.status === 'WAITING') {
        await queryRunner.manager.update(
          JobOrder,
          { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          { status: 'RUNNING', startAt: new Date() },
        );
      }

      // FG 바코드는 조립(서브공정) 키팅 공정에서 발행한다(라우팅 ISSUE_LABEL_TYPE='FG'). 실적 등록 시 사전발행하지 않는다.

      // 불량 상세 로그 저장 (불량입력 모달에서 등록된 유형별 불량)
      // 같은 occurAt에 seq 1..N으로 복합 PK 충돌을 방지하고, defectQty는 위에서 이미 산정했으므로 재증가하지 않는다.
      if (defectDetails.length > 0) {
        const occurAt = new Date();
        for (let i = 0; i < defectDetails.length; i++) {
          const d = defectDetails[i];
          await queryRunner.manager.save(DefectLog, {
            occurAt,
            seq: i + 1,
            prodResultNo: savedResultNo,
            defectCode: d.defectCode,
            defectName: d.defectName ?? null,
            qty: d.qty ?? 1,
            status: 'WAIT',
            company: jobOrder.company,
            plant: jobOrder.plant,
          });
        }
      }

      // BOM 기반 자재 자동차감 (ON_CREATE)
      const totalQty = (dto.goodQty ?? 0) + effectiveDefectQty;
      if (totalQty > 0) {
        const autoResult = await this.autoIssueService.execute(
          'ON_CREATE', saved.resultNo, dto.orderNo, totalQty, queryRunner, dto.processCode,
        );
        if (autoResult.warnings.length > 0) {
          this.logger.warn(`자동차감 경고: ${autoResult.warnings.join(', ')}`);
        }
      }

      // 제품재고 즉시 적재 — 실적 저장 순간 양품을 WIP_MAIN 공정창고에 반영한다.
      // (별도 완료 처리 없이도 키오스크 실적입력만으로 반제품/완제품 재고가 생성됨)
      await this.adsorbProductStockInTx(queryRunner, {
        resultNo: saved.resultNo,
        orderNo: dto.orderNo,
        goodQty: dto.goodQty ?? 0,
        processCode: dto.processCode,
        company: jobOrder.company,
        plant: jobOrder.plant,
      });
      // 불량재고 즉시 적재 — 불량을 DEFECT(불량품)창고에 반영(실물 추적)
      await this.adsorbDefectStockInTx(queryRunner, {
        resultNo: saved.resultNo,
        orderNo: dto.orderNo,
        defectQty: effectiveDefectQty,
        processCode: dto.processCode,
        company: jobOrder.company,
        plant: jobOrder.plant,
      });

      // 반제품 묶음 추적라벨(SG_LABELS) 발행 — 최초 공정 양품 실적 시 1회 발행(멱등).
      // 기존 재고 적재(adsorbProductStockInTx)와 별개의 시리얼 추적 레이어 추가일 뿐 수량 이중계상이 아니다.
      await this.issueSgLabelInTx(queryRunner, {
        jobOrder,
        prodResult: saved,
        goodQty: dto.goodQty ?? 0,
        processCode: dto.processCode,
        bundleCount: dto.bundleCount,
        qtyPerBundle: dto.qtyPerBundle,
        workerId: dto.workerId ?? undefined,
      });
    });

    return this.prodResultRepository.findOne({
      where: { resultNo: savedResultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 수정
   * - 수량(goodQty/defectQty) 변경 시 자재 자동차감 재계산 (역분개 후 재차감)
   */
  async update(resultNo: string, dto: UpdateProdResultDto, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException('취소된 실적은 수정할 수 없습니다.');
    }

    // DONE 상태에서는 일부 필드만 수정 가능
    if (prodResult.status === 'DONE') {
      if (dto.orderNo || dto.equipCode || dto.workerId || dto.startAt) {
        throw new BadRequestException(`완료된 실적의 핵심 정보는 수정할 수 없습니다.`);
      }
    }

    // 수량 변경 여부 판단
    const oldTotalQty = prodResult.goodQty + prodResult.defectQty;
    const newGoodQty = dto.goodQty ?? prodResult.goodQty;
    const newDefectQty = dto.defectQty ?? prodResult.defectQty;
    const newTotalQty = newGoodQty + newDefectQty;
    const qtyChanged = (dto.goodQty !== undefined || dto.defectQty !== undefined) && oldTotalQty !== newTotalQty;

    if (qtyChanged) {
      // 이미 포장/출하까지 진행된 실적은 수량을 바꾸면 재고 역분개가 꼬인다 — delete()/cancel()과 동일 가드.
      await this.ensureNoDownstreamProgress(prodResult, company, plant);
    }

    await this.tx.run(async (queryRunner) => {
      if (dto.status !== undefined) {
        throw new BadRequestException(
          '상태(status)는 이 API로 직접 수정할 수 없습니다. 완료/취소는 별도 API를 사용하세요.',
        );
      }
      if (dto.orderNo !== undefined && dto.orderNo !== prodResult.orderNo) {
        throw new BadRequestException('생산실적의 작업지시 번호는 수정할 수 없습니다.');
      }
      const { status: _ignoredStatus, orderNo: _ignoredOrderNo, ...resultData } = dto;
      const updateData = this.buildProdResultUpdate(resultData);

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(
          ProdResult,
          {
            resultNo: prodResult.resultNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          updateData,
        );
      }

      // 수량 변경 시 자재 자동차감 재계산 (역분개 → 재차감)
      if (qtyChanged) {
        await this.reverseAutoIssue(
          queryRunner,
          resultNo,
          company ?? prodResult.company,
          plant ?? prodResult.plant,
        );
        if (newTotalQty > 0) {
          await this.autoIssueService.execute(
            'ON_CREATE', resultNo, prodResult.orderNo, newTotalQty, queryRunner, prodResult.processCode,
          );
        }
        // 제품재고 재동기화 — 적재된 WIP 재고를 역분개 후 새 양품수량으로 재적재
        // (적재를 create 시점으로 옮긴 뒤 수량 수정 시 제품재고가 stale 해지는 문제 해소)
        await this.reverseProductStock(
          queryRunner, resultNo, company ?? prodResult.company ?? undefined, plant ?? prodResult.plant ?? undefined,
        );
        await this.adsorbProductStockInTx(queryRunner, {
          resultNo,
          orderNo: prodResult.orderNo,
          goodQty: newGoodQty,
          processCode: prodResult.processCode,
          company: company ?? prodResult.company ?? undefined,
          plant: plant ?? prodResult.plant ?? undefined,
        });
        await this.adsorbDefectStockInTx(queryRunner, {
          resultNo,
          orderNo: prodResult.orderNo,
          defectQty: newDefectQty,
          processCode: prodResult.processCode,
          company: company ?? prodResult.company ?? undefined,
          plant: plant ?? prodResult.plant ?? undefined,
        });
        this.logger.log(
          `실적 수량 변경 재계산(자재+제품재고+불량재고): ${resultNo} (${oldTotalQty} → ${newTotalQty})`,
        );
      }
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** 생산실적 삭제: 연결 수불/재고를 되돌린 뒤 실적 row를 제거한다. */
  async delete(resultNo: string, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 실적입니다.');
    }
    await this.ensureNoDownstreamProgress(prodResult, company, plant);

    await this.tx.run(async (queryRunner) => {
      await this.reverseResultInTx(queryRunner, prodResult, company, plant);

      await queryRunner.manager.delete(ProdResult, {
        resultNo: prodResult.resultNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      });

      await this.syncJobOrderFromRemainingResults(queryRunner, prodResult.orderNo, company, plant);
    });

    return { resultNo };
  }

  /**
   * delete()/cancel() 공통 되돌리기: 설비 작업지시 해제 + 자재/제품재고 역분개 +
   * SG라벨 삭제(후공정 진행된 라벨이 있으면 차단) + 불량로그 삭제 + 검사결과 연결 해제.
   * 호출 전 ensureNoDownstreamProgress로 FG 포장/출하 여부는 이미 검증됐다는 전제.
   */
  private async reverseResultInTx(
    queryRunner: import('typeorm').QueryRunner,
    prodResult: ProdResult,
    company?: string,
    plant?: string,
  ): Promise<void> {
    if (prodResult.equipCode) {
      await queryRunner.manager.update(
        EquipMaster,
        { equipCode: prodResult.equipCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { currentJobOrderId: null },
      );
    }

    await this.reverseAutoIssue(queryRunner, prodResult.resultNo, company, plant);
    await this.reverseProductStock(queryRunner, prodResult.resultNo, company, plant);

    const sgLabels = await queryRunner.manager.find(SgLabel, {
      where: {
        resultNo: prodResult.resultNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const progressedSgLabel = sgLabels.find((label) => label.status !== 'IN_STOCK');
    if (progressedSgLabel) {
      throw new BadRequestException(
        `이미 후공정이 진행된 SFG 라벨입니다: ${progressedSgLabel.sgBarcode} (${progressedSgLabel.status})`,
      );
    }
    await queryRunner.manager.delete(SgLabel, {
      resultNo: prodResult.resultNo,
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    });

    await queryRunner.manager.delete(DefectLog, {
      prodResultNo: prodResult.resultNo,
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    });

    const { InspectResult } = await import('../../../entities/inspect-result.entity');
    await queryRunner.manager.update(
      InspectResult,
      { prodResultNo: prodResult.resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      { prodResultNo: null },
    );
  }

  /**
   * 생산실적 완료 (트랜잭션: 실적 완료 + 금형 타수 + 설비 해제 원자성 보장)
   */
  async complete(resultNo: string, dto: CompleteProdResultDto, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${prodResult.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      // 1. 실적 상태 → DONE
      const updateData: Partial<Pick<ProdResult, 'status' | 'endAt' | 'goodQty' | 'defectQty' | 'remark'>> = {
        status: 'DONE',
        endAt: dto.endAt ? new Date(dto.endAt) : new Date(),
      };
      if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
      if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
      if (dto.remark) updateData.remark = dto.remark;

      await queryRunner.manager.update(
        ProdResult,
        {
          resultNo: prodResult.resultNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        updateData,
      );

      // 2. 금형 타수 자동 증가 (트랜잭션 내 — 실패 시 전체 롤백)
      if (prodResult.equipCode) {
        const totalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
        if (totalQty > 0) {
          const mountedMolds = await queryRunner.manager.find(ConsumableMaster, {
            where: {
              mountedEquipCode: prodResult.equipCode,
              category: 'MOLD',
              operStatus: 'MOUNTED',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });

          for (const mold of mountedMolds) {
            const newCount = mold.currentCount + totalQty;
            let newStatus = mold.status;

            if (mold.expectedLife && newCount >= mold.expectedLife) {
              newStatus = 'REPLACE';
            } else if (mold.warningCount && newCount >= mold.warningCount) {
              newStatus = 'WARNING';
            }

            await queryRunner.manager.update(
              ConsumableMaster,
              {
                consumableCode: mold.consumableCode,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                currentCount: newCount,
                status: newStatus,
              },
            );

            this.logger.log(
              `금형 타수 자동 증가: ${mold.consumableCode} (${mold.currentCount} → ${newCount})`,
            );
          }
        }

        // 3. 설비의 현재 작업지시번호 해제
        await queryRunner.manager.update(
          EquipMaster,
          {
            equipCode: prodResult.equipCode,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          { currentJobOrderId: null },
        );
        this.logger.log(`설비 작업지시 해제: ${prodResult.equipCode}`);
      }

      // 4. BOM 기반 자재 자동차감 (ON_COMPLETE)
      const autoTotalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
      if (autoTotalQty > 0) {
        const autoResult = await this.autoIssueService.execute(
          'ON_COMPLETE', prodResult.resultNo, prodResult.orderNo, autoTotalQty, queryRunner, prodResult.processCode,
        );
        if (autoResult.warnings.length > 0) {
          this.logger.warn(`자동차감 경고: ${autoResult.warnings.join(', ')}`);
        }
      }

      // 4-2. 매핑 소모품 롯트 사용횟수 누적 (재고 차감/수불 없음 — 수명 관리용)
      //      모델(작업지시 품목)+설비 매핑(CONSUMABLE_USAGE_MAP)으로 대상 소모품을 찾고,
      //      그 설비에 장착(MOUNTED)된 롯트(conUid)의 CURRENT_COUNT를 USAGE_PER_UNIT × 생산수량만큼 누적.
      if (prodResult.equipCode && autoTotalQty > 0) {
        const consumJobOrder = await queryRunner.manager.findOne(JobOrder, {
          where: {
            orderNo: prodResult.orderNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });
        if (consumJobOrder?.itemCode) {
          const consumMaps = await queryRunner.manager.find(ConsumableUsageMap, {
            where: {
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
              productItemCode: consumJobOrder.itemCode,
              equipCode: prodResult.equipCode,
              useYn: 'Y',
            },
          });
          // N+1 제거: cmap별 개별 조회 대신 consumableCode 목록을 모아 한 번에 조회 후 코드별로 분배
          const consumableCodes = [...new Set(consumMaps.map((c) => c.consumableCode))];
          const lotsByCode = new Map<string, ConsumableStock[]>();
          if (consumableCodes.length > 0) {
            const allLots = await queryRunner.manager.find(ConsumableStock, {
              where: {
                consumableCode: In(consumableCodes),
                mountedEquipCode: prodResult.equipCode,
                status: 'MOUNTED',
                ...(company ? { company } : {}),
                ...(plant ? { plantCd: plant } : {}),
              },
            });
            for (const lot of allLots) {
              const bucket = lotsByCode.get(lot.consumableCode);
              if (bucket) bucket.push(lot);
              else lotsByCode.set(lot.consumableCode, [lot]);
            }
          }
          for (const cmap of consumMaps) {
            const lots = lotsByCode.get(cmap.consumableCode) ?? [];
            for (const lot of lots) {
              const newCount = lot.currentCount + cmap.usagePerUnit * autoTotalQty;
              await queryRunner.manager.update(
                ConsumableStock,
                { conUid: lot.conUid },
                { currentCount: newCount },
              );
              this.logger.log(
                `소모품 롯트 사용횟수 누적: ${lot.conUid} (${lot.currentCount} → ${newCount})`,
              );
            }
          }
        }
      }

      // 5. 공정창고(WIP_MAIN) 자동 적재 — 양품만 재고화
      //    create() 시점에 이미 적재됐으면 멱등 가드로 건너뛴다(이중적재 방지).
      await this.adsorbProductStockInTx(queryRunner, {
        resultNo: prodResult.resultNo,
        orderNo: prodResult.orderNo,
        goodQty: dto.goodQty ?? prodResult.goodQty,
        processCode: prodResult.processCode,
        company,
        plant,
      });
      await this.adsorbDefectStockInTx(queryRunner, {
        resultNo: prodResult.resultNo,
        orderNo: prodResult.orderNo,
        defectQty: dto.defectQty ?? prodResult.defectQty,
        processCode: prodResult.processCode,
        company,
        plant,
      });

      // 6. 작업지시 자동 완료 체크
      // 해당 작업지시의 모든 실적이 DONE이고 계획수량 달성 시 자동 완료
      const autoCompleteJobOrder = await queryRunner.manager.findOne(JobOrder, {
        where: {
          orderNo: prodResult.orderNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (autoCompleteJobOrder && !['DONE', 'CANCELED'].includes(autoCompleteJobOrder.status)) {
        const pendingResults = await queryRunner.manager.count(ProdResult, {
          where: {
            orderNo: prodResult.orderNo,
            status: In(['RUNNING', 'WAITING']),
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });

        if (pendingResults === 0) {
          const summaryQb = queryRunner.manager
            .createQueryBuilder(ProdResult, 'pr')
            .select('SUM(pr.goodQty)', 'totalGoodQty')
            .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
            .where('pr.orderNo = :orderNo AND pr.status = :status', {
              orderNo: prodResult.orderNo,
              status: 'DONE',
            });
          if (company) {
            summaryQb.andWhere('pr.company = :company', { company });
          }
          if (plant) {
            summaryQb.andWhere('pr.plant = :plant', { plant });
          }
          const summary = await summaryQb.getRawOne();

          const totalGood = parseInt(summary?.totalGoodQty) || 0;
          const totalDefect = parseInt(summary?.totalDefectQty) || 0;

          if (totalGood >= autoCompleteJobOrder.planQty) {
            await queryRunner.manager.update(
              JobOrder,
              {
                orderNo: prodResult.orderNo,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                status: 'DONE',
                endAt: new Date(),
                goodQty: totalGood,
                defectQty: totalDefect,
              },
            );
            this.logger.log(`작업지시 자동 완료: ${prodResult.orderNo} (양품 ${totalGood} >= 계획 ${autoCompleteJobOrder.planQty})`);
          }
        }
      }
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 취소: delete()와 같은 되돌리기(설비 해제/자재·제품재고 역분개/SG라벨·불량로그 정리)를
   * 수행하되, 실적 row는 지우지 않고 CANCELED 상태 + 사유(remark)로 남겨 이력을 보존한다.
   */
  async cancel(resultNo: string, remark?: string, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 실적입니다.');
    }
    await this.ensureNoDownstreamProgress(prodResult, company, plant);

    await this.tx.run(async (queryRunner) => {
      await this.reverseResultInTx(queryRunner, prodResult, company, plant);

      await queryRunner.manager.update(
        ProdResult,
        {
          resultNo: prodResult.resultNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        {
          status: 'CANCELED',
          remark: remark ? `취소: ${remark}` : '취소',
        },
      );

      await this.syncJobOrderFromRemainingResults(queryRunner, prodResult.orderNo, company, plant);
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'equip', 'worker'],
    });
  }

  /**
   * 실적별 후공정 진행 여부 판단에 쓸 후보 FG바코드 목록을 모은다.
   * - 실적 prdUid 자체(ON_PRODUCTION 모드/레거시 데이터에서 prdUid=FG바코드인 경우 대비)
   * - 이 실적에서 통전검사로 발행된 FG바코드(InspectResult.prodResultNo 링크)
   * resultNo 단위 N+1을 피하려고 여러 실적을 한 번에 받아 배치로 조회한다.
   */
  private async collectCandidateBarcodes(
    results: Array<{ resultNo: string; prdUid: string | null }>,
    company?: string,
    plant?: string,
  ): Promise<Map<string, string[]>> {
    const byResultNo = new Map<string, string[]>();
    if (results.length === 0) return byResultNo;

    const { InspectResult } = await import('../../../entities/inspect-result.entity');
    const inspectRepo = this.dataSource.getRepository(InspectResult);
    const resultNos = results.map((r) => r.resultNo);
    const inspects = await inspectRepo.find({
      where: { prodResultNo: In(resultNos), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['prodResultNo', 'fgBarcode'],
    });

    for (const r of results) {
      const own = r.prdUid ? [r.prdUid] : [];
      const linked = inspects
        .filter((i) => i.prodResultNo === r.resultNo)
        .map((i) => i.fgBarcode)
        .filter((b): b is string => !!b);
      byResultNo.set(r.resultNo, Array.from(new Set([...own, ...linked])));
    }
    return byResultNo;
  }

  /**
   * 여러 실적의 후공정(포장/출하) 진행 여부를 일괄 조회한다(N+1 방지).
   * 목록 화면에서 수정/삭제 아이콘 활성화 여부를 판단하는 데 쓴다.
   */
  async computeDownstreamProgressMap(
    results: Array<{ resultNo: string; prdUid: string | null }>,
    company?: string,
    plant?: string,
  ): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (results.length === 0) return map;

    const barcodesByResult = await this.collectCandidateBarcodes(results, company, plant);
    const allBarcodes = Array.from(new Set(Array.from(barcodesByResult.values()).flat()));
    if (allBarcodes.length === 0) {
      for (const r of results) map.set(r.resultNo, false);
      return map;
    }

    const { FgLabel } = await import('../../../entities/fg-label.entity');
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);
    const progressedLabels = await fgLabelRepo.find({
      where: {
        fgBarcode: In(allBarcodes),
        status: In(['PACKED', 'SHIPPED']),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['fgBarcode'],
    });
    const progressedSet = new Set(progressedLabels.map((l) => l.fgBarcode));

    for (const r of results) {
      const barcodes = barcodesByResult.get(r.resultNo) ?? [];
      map.set(r.resultNo, barcodes.some((b) => progressedSet.has(b)));
    }
    return map;
  }

  /** 생산실적이 이미 후공정(포장/출하)까지 진행됐으면 취소/수정/삭제를 막는다. */
  private async ensureNoDownstreamProgress(prodResult: ProdResult, company?: string, plant?: string): Promise<void> {
    const { FgLabel } = await import('../../../entities/fg-label.entity');
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);

    const barcodesByResult = await this.collectCandidateBarcodes(
      [{ resultNo: prodResult.resultNo, prdUid: prodResult.prdUid }],
      company,
      plant,
    );
    const barcodes = barcodesByResult.get(prodResult.resultNo) ?? [];
    if (barcodes.length === 0) return;

    const packedLabel = await fgLabelRepo.findOne({
      where: {
        fgBarcode: In(barcodes),
        status: In(['PACKED', 'SHIPPED']),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!packedLabel) return;

    const { BoxMaster } = await import('../../../entities/box-master.entity');
    const { PalletMaster } = await import('../../../entities/pallet-master.entity');
    const { ShipmentLog } = await import('../../../entities/shipment-log.entity');

    const boxRepo = this.dataSource.getRepository(BoxMaster);
    const palletRepo = this.dataSource.getRepository(PalletMaster);
    const shipmentRepo = this.dataSource.getRepository(ShipmentLog);

    const box = await boxRepo
      .createQueryBuilder('box')
      .where('box.serialList LIKE :serial', { serial: `%${packedLabel.fgBarcode}%` })
      .andWhere(company ? 'box.company = :company' : '1=1', { company })
      .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
      .orderBy('box.createdAt', 'DESC')
      .getOne();

    const pallet = box?.palletNo
      ? await palletRepo.findOne({
          where: {
            palletNo: box.palletNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : null;

    const shipment = pallet?.shipmentId
      ? await shipmentRepo.findOne({
          where: {
            shipNo: pallet.shipmentId,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : null;

    const details = [
      `FG 라벨: ${packedLabel.fgBarcode}`,
      box ? `박스: ${box.boxNo}` : null,
      box?.oqcStatus ? `OQC: ${box.oqcStatus}` : null,
      pallet ? `팔레트: ${pallet.palletNo}` : null,
      shipment ? `출하: ${shipment.shipNo}` : null,
    ].filter(Boolean).join(', ');

    throw new BadRequestException(
      `이미 후공정이 진행된 생산실적입니다. ${details}. 출하 -> 팔레트 -> 박스/OQC -> FG 라벨 순서로 역처리 후 다시 취소해 주세요.`,
    );
  }

  private async syncJobOrderFromRemainingResults(
    qr: import('typeorm').QueryRunner,
    orderNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    const jobOrder = await qr.manager.findOne(JobOrder, {
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!jobOrder || jobOrder.status === 'CANCELED' || jobOrder.status === 'HOLD') return;

    const summaryQb = qr.manager
      .createQueryBuilder(ProdResult, 'pr')
      .select('COUNT(pr.resultNo)', 'resultCount')
      .addSelect('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' });
    if (company) summaryQb.andWhere('pr.company = :company', { company });
    if (plant) summaryQb.andWhere('pr.plant = :plant', { plant });
    const summary = await summaryQb.getRawOne();

    const resultCount = Number(summary?.resultCount ?? 0);
    const totalGood = Number(summary?.totalGoodQty ?? 0);
    const totalDefect = Number(summary?.totalDefectQty ?? 0);
    const nextStatus = resultCount === 0
      ? 'WAITING'
      : totalGood >= Number(jobOrder.planQty ?? 0)
        ? 'DONE'
        : 'RUNNING';

    const updateData: Partial<JobOrder> = {
      status: nextStatus,
      goodQty: totalGood,
      defectQty: totalDefect,
      endAt: nextStatus === 'DONE' ? new Date() : null,
    };
    if (nextStatus === 'WAITING') {
      updateData.startAt = null;
    } else if (!jobOrder.startAt) {
      updateData.startAt = new Date();
    }

    await qr.manager.update(
      JobOrder,
      { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      updateData,
    );
  }

  private async reverseAutoIssue(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    /* ── 경로 ① 공정소비(R5) 역분개 ─────────────────────────────
     * equipCode 작업지시는 공정재고(WIP_MAT_STOCKS)에서 PROD_CONSUME으로 소비됐고
     * 그 기록은 WIP_MAT_TRANSACTIONS에만 존재한다(MatIssue 없음).
     * restoreInTx가 (PROD_RESULT, resultNo, PROD_CONSUME, DONE) 원본을 찾아
     * WIP_MAT_STOCKS 가산 + PROD_CONSUME_CANCEL 기록. 원본이 없으면 no-op.
     * WIP 재고는 (company,plant) 스코프가 필수이므로 둘 다 있을 때만 복원한다. */
    if (company && plant) {
      await this.wipMatStockService.restoreInTx(qr, {
        mode: 'ADD_BACK',
        refType: 'PROD_RESULT',
        refId: resultNo,
        cancelTransType: 'PROD_CONSUME_CANCEL',
        originTransType: 'PROD_CONSUME',
        company,
        plant,
      });
    } else {
      this.logger.warn(
        `공정소비 역분개 생략 — company/plant 미지정: resultNo=${resultNo}`,
      );
    }

    /* ── 경로 ② 설비 미배정 fallback 단순소비 역분개 ────────────────
     * MatIssue(PROD_AUTO) + STOCK_TRANSACTIONS(MAT_OUT)로 소비된 건만 처리.
     * equipCode 경로는 MatIssue가 없으므로 여기서 발견되지 않아 서로 간섭 없음. */
    const issues = await qr.manager.find(MatIssue, {
      where: {
        prodResultNo: resultNo,
        issueType: 'PROD_AUTO',
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });

    if (issues.length === 0) return;

    for (const issue of issues) {
      await qr.manager.update(
        MatIssue,
        { issueNo: issue.issueNo, seq: issue.seq, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { status: 'CANCELED' },
      );

      if (!issue.matUid || issue.issueQty <= 0) {
        continue;
      }

      const lot = await qr.manager.findOne(MatLot, {
        where: { matUid: issue.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });

      const originalTransactions = await qr.manager.find(StockTransaction, {
        where: {
          refType: 'MAT_ISSUE',
          refId: `${issue.issueNo}-${issue.seq}`,
          status: 'DONE',
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (originalTransactions.length > 0) {
        for (const originalTx of originalTransactions) {
          const restoreQty = Math.abs(Number(originalTx.qty) || 0);
          if (restoreQty <= 0 || !originalTx.fromWarehouseId) continue;
          this.assertTenantConsistency('자재 자동투입 역분개', {
            expected: { company, plant },
            sources: [
              { label: 'issue', company: issue.company, plant: issue.plant },
              { label: 'lot', company: lot?.company, plant: lot?.plant },
              { label: 'originalTx', company: originalTx.company, plant: originalTx.plant },
            ],
          });

          const stock = await qr.manager.findOne(MatStock, {
            where: {
              warehouseCode: originalTx.fromWarehouseId,
              itemCode: originalTx.itemCode,
              matUid: issue.matUid,
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });

          if (stock) {
            await qr.manager.update(
              MatStock,
              {
                warehouseCode: stock.warehouseCode,
                itemCode: stock.itemCode,
                matUid: stock.matUid,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                qty: stock.qty + restoreQty,
                availableQty: stock.availableQty + restoreQty,
              },
            );
          }

          await qr.manager.update(
            StockTransaction,
            { transNo: originalTx.transNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
            { status: 'CANCELED' },
          );

          /* 이 루프는 refType='MAT_ISSUE'인 StockTransaction만 역분개 대상으로 조회한다(위 find).
           * 그 transType은 자재출고 경로상 MAT_OUT/WIP_IN 뿐이므로 역분개는 항상 MAT_IN(원본 소비창고 복원)이다.
           * 복원 대상 창고는 원본 fromWarehouseId(소비 창고)다.
           * 설비배정 소비(PROD_CONSUME)는 WIP_MAT_TRANSACTIONS 소속이라 여기 StockTransaction 조회엔 잡히지 않으며,
           * 별도 WipMatStock 역분개 경로로 처리된다. */
          const reverseTransType = 'MAT_IN';

          const reverseTransNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
          const reverseTx = qr.manager.create(StockTransaction, {
            transNo: reverseTransNo,
            transType: reverseTransType,
            transDate: new Date(),
            toWarehouseId: originalTx.fromWarehouseId,
            itemCode: originalTx.itemCode || lot?.itemCode || '',
            matUid: issue.matUid,
            qty: restoreQty,
            refType: 'MAT_ISSUE_CANCEL',
            refId: `${issue.issueNo}-${issue.seq}`,
            cancelRefId: originalTx.transNo,
            status: 'DONE',
            company: originalTx.company ?? lot?.company ?? issue.company,
            plant: originalTx.plant ?? lot?.plant ?? issue.plant,
          });
          await qr.manager.save(StockTransaction, reverseTx);
        }

        continue;
      }

      this.assertTenantConsistency('자재 자동투입 역분개', {
        expected: { company, plant },
        sources: [
          { label: 'issue', company: issue.company, plant: issue.plant },
          { label: 'lot', company: lot?.company, plant: lot?.plant },
        ],
      });

      const fallbackStock = await qr.manager.findOne(MatStock, {
        where: { matUid: issue.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });

      if (fallbackStock) {
        await qr.manager.update(
          MatStock,
          {
            warehouseCode: fallbackStock.warehouseCode,
            itemCode: fallbackStock.itemCode,
            matUid: fallbackStock.matUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          {
            qty: fallbackStock.qty + issue.issueQty,
            availableQty: fallbackStock.availableQty + issue.issueQty,
          },
        );
      }

      const reverseTransNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
      const reverseTx = qr.manager.create(StockTransaction, {
        transNo: reverseTransNo,
        transType: 'MAT_IN',
        transDate: new Date(),
        toWarehouseId: fallbackStock?.warehouseCode,
        itemCode: lot?.itemCode ?? fallbackStock?.itemCode ?? '',
        matUid: issue.matUid,
        qty: issue.issueQty,
        refType: 'MAT_ISSUE_CANCEL',
        refId: `${issue.issueNo}-${issue.seq}`,
        status: 'DONE',
        company: lot?.company ?? issue.company,
        plant: lot?.plant ?? issue.plant,
      });
      await qr.manager.save(StockTransaction, reverseTx);
    }

    this.logger.log(`자동차감 역분개 완료 - resultNo: ${resultNo}, ${issues.length}건`);
  }

  private assertTenantConsistency(
    context: string,
    data: {
      expected?: { company?: string; plant?: string };
      sources: { label: string; company?: string | null; plant?: string | null }[];
    },
  ): void {
    this.assertSameTenantValue(context, 'company', data.expected?.company, data.sources);
    this.assertSameTenantValue(context, 'plant', data.expected?.plant, data.sources);
  }

  private assertSameTenantValue(
    context: string,
    field: 'company' | 'plant',
    expected: string | undefined,
    sources: { label: string; company?: string | null; plant?: string | null }[],
  ): void {
    if (expected) {
      const mismatch = sources.find((source) => source[field] !== expected);
      if (mismatch) {
        const details = sources.map((source) => `${source.label}=${source[field] ?? '-'}`).join(', ');
        throw new BadRequestException(
          `${context} ${field} 값이 일치하지 않습니다. expected=${expected}, ${details}`,
        );
      }
      return;
    }

    const values = sources
      .map((source) => ({ label: source.label, value: source[field] }))
      .filter((source): source is { label: string; value: string } => Boolean(source.value));
    const baseline = expected ?? values[0]?.value;
    const mismatch = values.find((source) => baseline && source.value !== baseline);

    if (mismatch) {
      const details = values.map((source) => `${source.label}=${source.value}`).join(', ');
      throw new BadRequestException(
        `${context} ${field} 값이 일치하지 않습니다. expected=${baseline ?? '-'}, ${details}`,
      );
    }
  }

  /**
   * 공정창고(WIP_MAIN) 제품재고 자동 적재 — 양품만 재고화.
   * 실적 저장(create) 즉시와 명시적 완료(complete) 양쪽에서 호출된다.
   * - 멱등: 같은 실적(refId)에 이미 적재 트랜잭션(WIP_IN/FG_IN)이 있으면 건너뛴다(이중적재 방지).
   * - 시리얼 강제: prdUid가 비면 {orderNo}-{NNN}을 채번해 sentinel '*' 집계를 막는다.
   */
  /**
   * 반제품 묶음 추적라벨(SG_LABELS) 발행 — 최초 공정 양품 실적 등록 시 1회 발행.
   *
   * 발행 조건(가드, 하나라도 불충족 시 발행하지 않고 즉시 return):
   *  1) goodQty > 0
   *  2) 반제품만(jobOrder.part?.itemType !== 'FINISHED')
   *  3) 발행 공정 판정:
   *     - 라우팅의 ROUTING_PROCESSES 중 processCode === prodResult.processCode 행의 issueLabelType 이 'SG' 또는 'BUNDLE' 이면 발행
   *       (단계 1: 묶음/회로 미분리 — 둘 다 SG_LABELS로 발행. 단계 2에서 LABEL_TYPE 분기 예정)
   *  4) 멱등: 같은 orderNo + issueProcessCode 로 이미 SgLabel 이 있으면 재발행 금지
   *
   * 수량: bundleCount·qtyPerBundle 둘 다 있으면 곱이 goodQty 와 일치해야 함(불일치 시 BadRequestException).
   *       아니면 폴백 bundleCount=1, qtyPerBundle=goodQty.
   */
  private async issueSgLabelInTx(
    qr: import('typeorm').QueryRunner,
    args: {
      jobOrder: JobOrder;
      prodResult: ProdResult;
      goodQty: number;
      processCode?: string | null;
      bundleCount?: number;
      qtyPerBundle?: number;
      workerId?: string;
    },
  ): Promise<void> {
    const { jobOrder, prodResult, goodQty, bundleCount, qtyPerBundle, workerId } = args;
    const processCode = prodResult.processCode ?? args.processCode ?? null;

    // 가드 1: 양품 수량
    if (!goodQty || goodQty <= 0) return;
    // 가드 2: 발행 공정 코드 필수
    if (!processCode) return;

    // 가드 3: 반제품만 — part 관계가 create() jobOrder 에 없을 수 있어 재조회로 itemType 확인
    const company = jobOrder.company ?? undefined;
    const plant = jobOrder.plant ?? undefined;
    const jobOrderWithPart = await qr.manager.findOne(JobOrder, {
      where: {
        orderNo: jobOrder.orderNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      relations: ['part'],
    });
    if (!jobOrderWithPart?.itemCode) return;
    if (jobOrderWithPart.part?.itemType === 'FINISHED') return;

    // 가드 3: 발행 공정 판정 — 현재 공정 ISSUE_LABEL_TYPE 이 SG/BUNDLE 이면 발행, 아니면 발행하지 않는다(폴백 없음).
    const routingCode = jobOrderWithPart.routingCode;
    if (!routingCode) return;
    const currentStep = await qr.manager.findOne(RoutingProcess, {
      where: {
        routingCode,
        processCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (currentStep?.issueLabelType !== 'SG' && currentStep?.issueLabelType !== 'BUNDLE') return;

    // 가드 4: 멱등 — 같은 실적(resultNo)으로 이미 발행됐으면 중단.
    // (배치마다 실적이 다르므로 resultNo 단위로 dedup → 다중 배치 작업지시도 배치별 묶음 발행됨)
    const existing = await qr.manager.findOne(SgLabel, {
      where: {
        resultNo: prodResult.resultNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (existing) return;

    // 수량 계산
    let resolvedBundleCount: number;
    let resolvedQtyPerBundle: number;
    if (bundleCount != null && qtyPerBundle != null) {
      if (bundleCount * qtyPerBundle !== goodQty) {
        throw new BadRequestException(
          `SFG 라벨 수량 불일치: 묶음수(${bundleCount}) × 묶음당가닥수(${qtyPerBundle}) = ${bundleCount * qtyPerBundle} ≠ 양품수량(${goodQty})`,
        );
      }
      resolvedBundleCount = bundleCount;
      resolvedQtyPerBundle = qtyPerBundle;
    } else {
      resolvedBundleCount = 1;
      resolvedQtyPerBundle = goodQty;
    }

    // bundleCount 개 SgLabel 생성
    for (let i = 0; i < resolvedBundleCount; i++) {
      const sgBarcode = await this.numbering.nextSgLabel(qr);
      await qr.manager.save(SgLabel, {
        sgBarcode,
        itemCode: jobOrderWithPart.itemCode,
        orderNo: jobOrderWithPart.orderNo,
        resultNo: prodResult.resultNo,
        issueProcessCode: processCode,
        currentProcessCode: processCode,
        initQty: resolvedQtyPerBundle,
        remainQty: resolvedQtyPerBundle,
        status: 'IN_STOCK',
        // 발행 공정 ISSUE_LABEL_TYPE 그대로 기록(가드에서 SG/BUNDLE만 통과)
        labelType: currentStep.issueLabelType,
        workerId: workerId ?? null,
        company: jobOrderWithPart.company,
        plant: jobOrderWithPart.plant,
      });
    }
    this.logger.log(
      `SFG 라벨 발행: ${jobOrderWithPart.itemCode} 공정 ${processCode} — ${resolvedBundleCount}묶음 × ${resolvedQtyPerBundle}가닥 (실적 #${prodResult.resultNo})`,
    );
  }

  private async adsorbProductStockInTx(
    qr: import('typeorm').QueryRunner,
    params: {
      resultNo: string;
      orderNo: string;
      goodQty: number;
      processCode?: string | null;
      company?: string;
      plant?: string;
    },
  ): Promise<void> {
    const { resultNo, orderNo, goodQty, processCode, company, plant } = params;
    if (!goodQty || goodQty <= 0) return;

    const { ProductTransaction } = await import('../../../entities/product-transaction.entity');
    const alreadyAdsorbed = await qr.manager.findOne(ProductTransaction, {
      where: {
        refType: 'PROD_RESULT',
        refId: resultNo,
        transType: In(['WIP_IN', 'FG_IN']),
        qualityStatus: 'GOOD',
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (alreadyAdsorbed) return;

    const jobOrder = await qr.manager.findOne(JobOrder, {
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
    if (!jobOrder?.itemCode) return;

    const itemType = jobOrder.part?.itemType === 'FINISHED' ? 'FINISHED' : 'SEMI_PRODUCT';

    // prdUid는 DB의 최신값을 재확인한다(ON_PRODUCTION FG바코드 override 반영).
    const current = await qr.manager.findOne(ProdResult, {
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['resultNo', 'prdUid'],
    });
    let prdUid = current?.prdUid?.trim() || '';
    if (!prdUid) {
      prdUid = await this.generateProductSerial(qr, orderNo, jobOrder.company, jobOrder.plant);
      await qr.manager.update(
        ProdResult,
        { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { prdUid },
      );
      this.logger.warn(
        `시리얼 미부여 실적 자동 채번: ${resultNo} → ${prdUid} (sentinel '*' 적재 방지)`,
      );
    }

    const wipWarehouse = itemType === 'FINISHED' ? 'FG_WIP' : 'SFG_WIP';
    await this.productInventoryService.receiveStockInTx(qr, {
      warehouseId: wipWarehouse,
      itemCode: jobOrder.itemCode,
      itemType,
      qty: goodQty,
      transType: 'WIP_IN',
      orderNo,
      processCode: processCode || undefined,
      refType: 'PROD_RESULT',
      refId: resultNo,
      remark: '생산실적 자동 적재',
      company: jobOrder.company,
      plant: jobOrder.plant,
    });
    this.logger.log(
      `공정재고 자동 적재: ${jobOrder.itemCode} × ${goodQty} → ${wipWarehouse} (실적 #${resultNo})`,
    );
  }

  /**
   * 불량재고 자동 적재 — 불량(defectQty)을 양품과 같은 WIP 창고에 품질상태 DEFECT로 재고화한다.
   * 불량 실물은 작업자 명시 이동 전까지 해당 공정에 남고, 후공정 투입은 품질상태 가드로 차단한다.
   * - 멱등: 같은 실적(refId)에 이미 DEFECT 품질 WIP_IN 트랜잭션이 있으면 건너뛴다.
   * - refType=PROD_RESULT 이므로 실적 취소(reverseProductStock) 시 양품과 함께 자동 역분개된다.
   */
  private async adsorbDefectStockInTx(
    qr: import('typeorm').QueryRunner,
    params: {
      resultNo: string;
      orderNo: string;
      defectQty: number;
      processCode?: string | null;
      company?: string;
      plant?: string;
    },
  ): Promise<void> {
    const { resultNo, orderNo, defectQty, processCode, company, plant } = params;
    if (!defectQty || defectQty <= 0) return;

    const { ProductTransaction } = await import('../../../entities/product-transaction.entity');
    const already = await qr.manager.findOne(ProductTransaction, {
      where: {
        refType: 'PROD_RESULT',
        refId: resultNo,
        transType: 'WIP_IN',
        qualityStatus: 'DEFECT',
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (already) return;

    const jobOrder = await qr.manager.findOne(JobOrder, {
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
    if (!jobOrder?.itemCode) return;

    const itemType = jobOrder.part?.itemType === 'FINISHED' ? 'FINISHED' : 'SEMI_PRODUCT';

    const current = await qr.manager.findOne(ProdResult, {
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['resultNo', 'prdUid'],
    });
    let prdUid = current?.prdUid?.trim() || '';
    if (!prdUid) {
      // 불량만 있는 실적(양품 0)도 추적 위해 시리얼 채번
      prdUid = await this.generateProductSerial(qr, orderNo, jobOrder.company, jobOrder.plant);
      await qr.manager.update(
        ProdResult,
        { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { prdUid },
      );
    }

    const wipWarehouse = itemType === 'FINISHED' ? 'FG_WIP' : 'SFG_WIP';
    await this.productInventoryService.receiveStockInTx(qr, {
      warehouseId: wipWarehouse,
      itemCode: jobOrder.itemCode,
      itemType,
      qty: defectQty,
      transType: 'WIP_IN',
      qualityStatus: 'DEFECT',
      orderNo,
      processCode: processCode || undefined,
      refType: 'PROD_RESULT',
      refId: resultNo,
      remark: '생산실적 불량 WIP 적재',
      company: jobOrder.company,
      plant: jobOrder.plant,
    });
    this.logger.log(
      `불량재고 WIP 적재: ${jobOrder.itemCode} × ${defectQty} → ${wipWarehouse}/DEFECT (실적 #${resultNo})`,
    );
  }

  /**
   * 제품 시리얼 강제 채번 — 키오스크가 prdUid를 전송하지 못한 실적(구버전/외부 API)을
   * 완료 적재 시 백엔드에서 보정한다. 키오스크와 동일한 {orderNo}-{NNN} 체계를 유지하되,
   * 해당 작업지시의 기존 시리얼 최대 시퀀스+1을 사용해 충돌을 피한다.
   */
  private async generateProductSerial(
    qr: import('typeorm').QueryRunner,
    orderNo: string,
    company?: string | null,
    plant?: string | null,
  ): Promise<string> {
    const rows = await qr.manager.find(ProdResult, {
      where: {
        orderNo,
        prdUid: Like(`${orderNo}-%`),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['resultNo', 'prdUid'],
    });
    let maxSeq = 0;
    for (const row of rows ?? []) {
      const matched = row.prdUid?.match(/-(\d+)$/);
      if (matched) maxSeq = Math.max(maxSeq, parseInt(matched[1], 10));
    }
    return `${orderNo}-${String(maxSeq + 1).padStart(3, '0')}`;
  }

  private async reverseProductStock(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    const { ProductTransaction } = await import('../../../entities/product-transaction.entity');
    const { ProductStock } = await import('../../../entities/product-stock.entity');

    const transactions = await qr.manager.find(ProductTransaction, {
      where: {
        refType: 'PROD_RESULT',
        refId: resultNo,
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });

    if (transactions.length === 0) return;

    for (const tx of transactions) {
      this.assertTenantConsistency('제품 재고 역분개', {
        expected: { company, plant },
        sources: [
          { label: 'productTx', company: tx.company, plant: tx.plant },
        ],
      });

      // (a) 원본 트랜잭션 → CANCELED
      await qr.manager.update(
        ProductTransaction,
        { transNo: tx.transNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { status: 'CANCELED' },
      );

      // (b) 재고 차감 (입고 취소이므로 toWarehouseId에서 감소)
      if (tx.toWarehouseId && tx.qty > 0) {
        const stock = await qr.manager.findOne(ProductStock, {
          where: {
            warehouseCode: tx.toWarehouseId,
            itemCode: tx.itemCode,
            qualityStatus: tx.qualityStatus || 'GOOD',
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });

        if (stock) {
          this.assertTenantConsistency('제품 재고 역분개', {
            expected: { company, plant },
            sources: [
              { label: 'productTx', company: tx.company, plant: tx.plant },
              { label: 'productStock', company: stock.company, plant: stock.plant },
            ],
          });
          const newQty = Math.max(stock.qty - tx.qty, 0);
          const stockKey = {
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            qualityStatus: tx.qualityStatus || 'GOOD',
            company: stock.company,
            plant: stock.plant,
          };
          // 입고 취소로 수량이 0이 되고 예약도 없으면 빈 재고행을 남기지 않는다
          // (sentinel '*' 포함, qty=0 잔재 행 누적 방지).
          if (newQty === 0 && stock.reservedQty === 0) {
            await qr.manager.delete(ProductStock, stockKey);
          } else {
            await qr.manager.update(ProductStock, stockKey,
              { qty: newQty, availableQty: Math.max(newQty - stock.reservedQty, 0) },
            );
          }
        }
      }

      // (c) 취소 트랜잭션 생성 (역분개)
      const cancelTx = qr.manager.create(ProductTransaction, {
        transNo: `${tx.transNo}_C`,
        transType: 'WIP_IN_CANCEL',
        transDate: new Date(),
        fromWarehouseId: tx.toWarehouseId,
        itemCode: tx.itemCode,
        itemType: tx.itemType,
        prdUid: tx.prdUid,
        qualityStatus: tx.qualityStatus || 'GOOD',
        orderNo: tx.orderNo,
        processCode: tx.processCode,
        qty: -tx.qty,
        refType: 'PROD_RESULT_CANCEL',
        refId: resultNo,
        cancelRefId: tx.transNo,
        remark: `생산실적 취소 역분개`,
        status: 'DONE',
        company: tx.company,
        plant: tx.plant,
      });
      await qr.manager.save(ProductTransaction, cancelTx);
    }

    this.logger.log(`공정재고 역분개 완료 — resultNo: ${resultNo}, ${transactions.length}건`);
  }

  // ===== 실적 집계 =====

  /**
   * 작업지시별 실적 집계
   */
  async getSummaryByJobOrder(orderNo: string, company?: string, plant?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    const summary = await qb.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      orderNo,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 설비별 실적 집계
   */
  async getSummaryByEquip(equipCode: string, fromDate?: string, toDate?: string, company?: string, plant?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.equipCode = :equipCode', { equipCode })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) queryBuilder.andWhere('pr.company = :company', { company });
    if (plant) queryBuilder.andWhere('pr.plant = :plant', { plant });

    if (fromDate) queryBuilder.andWhere("pr.startAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    if (toDate) queryBuilder.andWhere("pr.startAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      equipCode,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 작업자별 실적 집계
   */
  async getSummaryByWorker(workerId: string, fromDate?: string, toDate?: string, company?: string, plant?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.workerId = :workerId', { workerId })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) queryBuilder.andWhere('pr.company = :company', { company });
    if (plant) queryBuilder.andWhere('pr.plant = :plant', { plant });

    if (fromDate) queryBuilder.andWhere("pr.startAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    if (toDate) queryBuilder.andWhere("pr.startAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      workerId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 일자별 실적 집계 (대시보드용)
   */
  async getDailySummary(fromDate: string, toDate: string, company?: string, plant?: string) {
    const dailyQb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select(['pr.startAt', 'pr.goodQty', 'pr.defectQty'])
      .where('pr.status != :canceled', { canceled: 'CANCELED' })
      .andWhere("pr.startAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate })
      .andWhere("pr.startAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });
    if (company) dailyQb.andWhere('pr.company = :company', { company });
    if (plant) dailyQb.andWhere('pr.plant = :plant', { plant });
    const results = await dailyQb.getMany();

    // 일자별 그룹핑
    const dailyMap = new Map<string, { goodQty: number; defectQty: number; count: number }>();

    results.forEach((r) => {
      if (r.startAt) {
        const dateKey = r.startAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { goodQty: 0, defectQty: 0, count: 0 };
        current.goodQty += r.goodQty;
        current.defectQty += r.defectQty;
        current.count += 1;
        dailyMap.set(dateKey, current);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        goodQty: data.goodQty,
        defectQty: data.defectQty,
        totalQty: data.goodQty + data.defectQty,
        defectRate:
          data.goodQty + data.defectQty > 0
            ? (data.defectQty / (data.goodQty + data.defectQty)) * 100
            : 0,
        resultCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 완제품 기준 생산실적 통합 조회
   * - 품목별로 계획수량, 양품, 불량, 양품률을 집계
   */
  async getSummaryByProduct(fromDate?: string, toDate?: string, search?: string, company?: string, plant?: string) {
    // 날짜 범위가 없으면 당일 기준 (전량 집계 방지)
    const effectiveDateFrom = fromDate || new Date().toISOString().substring(0, 10);
    const effectiveDateTo = toDate || effectiveDateFrom;

    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .leftJoin('pr.jobOrder', 'jo')
      .leftJoin('jo.part', 'p')
      .select([
        'p.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'p.itemType AS "itemType"',
        'jo.lineCode AS "lineCode"',
        'SUM(jo.planQty) AS "totalPlanQty"',
        'SUM(pr.goodQty) AS "totalGoodQty"',
        'SUM(pr.defectQty) AS "totalDefectQty"',
        'COUNT(DISTINCT jo.orderNo) AS "orderCount"',
        'COUNT(pr.resultNo) AS "resultCount"',
      ])
      .where('pr.status != :status', { status: 'CANCELED' })
      .andWhere("pr.startAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate: effectiveDateFrom })
      .andWhere("pr.startAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate: effectiveDateTo })
      .groupBy('p.itemCode')
      .addGroupBy('p.itemName')
      .addGroupBy('p.itemType')
      .addGroupBy('jo.lineCode')
      .orderBy('"totalGoodQty"', 'DESC');
    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    if (search) {
      qb.andWhere(
        '(p.itemCode LIKE :search OR p.itemName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const raw = await qb.getRawMany();

    return raw.map((r) => {
      const totalGoodQty = parseInt(r.totalGoodQty) || 0;
      const totalDefectQty = parseInt(r.totalDefectQty) || 0;
      const totalQty = totalGoodQty + totalDefectQty;
      const totalPlanQty = parseInt(r.totalPlanQty) || 0;
      return {
        itemCode: r.itemCode,
        itemName: r.itemName,
        itemType: r.itemType,
        lineCode: r.lineCode ?? '',
        totalPlanQty,
        totalGoodQty,
        totalDefectQty,
        totalQty,
        defectRate: totalQty > 0 ? Math.round((totalDefectQty / totalQty) * 1000) / 10 : 0,
        yieldRate: totalQty > 0 ? Math.round((totalGoodQty / totalQty) * 1000) / 10 : 0,
        achieveRate: totalPlanQty > 0 ? Math.round((totalGoodQty / totalPlanQty) * 1000) / 10 : 0,
        orderCount: parseInt(r.orderCount) || 0,
        resultCount: parseInt(r.resultCount) || 0,
      };
    });
  }
}
