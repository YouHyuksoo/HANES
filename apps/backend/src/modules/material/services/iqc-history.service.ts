import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, DataSource, IsNull, QueryRunner } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CreateArrivalIqcResultDto, PendingArrivalQueryDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

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
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
    private readonly sysConfigService: SysConfigService,
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

  private buildDateRange(fromDate?: string, toDate?: string) {
    if (!fromDate || !toDate) return null;

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      from.setUTCHours(0, 0, 0, 0);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      to.setUTCHours(23, 59, 59, 999);
    }

    return { from, to };
  }

  private normalizeIqcInspectClass(inspectClass?: string | null) {
    return inspectClass ?? null;
  }

  async findAll(query: IqcHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;
    const dateRange = this.buildDateRange(fromDate, toDate);

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(inspectType && { inspectType }),
      ...(result && { result }),
      ...(dateRange && { inspectDate: Between(dateRange.from, dateRange.to) }),
    };

    let data: IqcLog[];
    let total: number;

    if (search) {
      const parts = await this.partMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`), ...(company && { company }), ...(plant && { plant }) },
          { itemName: Like(`%${search}%`), ...(company && { company }), ...(plant && { plant }) },
        ],
      });
      const searchItemCodes = parts.map((p) => p.itemCode);

      const queryBuilder = this.iqcLogRepository.createQueryBuilder('iqc');

      if (company) queryBuilder.andWhere('iqc.company = :company', { company });
      if (plant) queryBuilder.andWhere('iqc.plant = :plant', { plant });
      if (inspectType) queryBuilder.andWhere('iqc.inspectType = :inspectType', { inspectType });
      if (result) queryBuilder.andWhere('iqc.result = :result', { result });
      if (dateRange) {
        queryBuilder.andWhere('iqc.inspectDate BETWEEN :fromDate AND :toDate', {
          fromDate: dateRange.from,
          toDate: dateRange.to,
        });
      }

      if (searchItemCodes.length > 0) {
        queryBuilder.andWhere('iqc.itemCode IN (:...searchItemCodes)', { searchItemCodes });
      } else {
        queryBuilder.andWhere('(iqc.arrivalNo LIKE :search OR iqc.itemCode LIKE :search)', {
          search: `%${search}%`,
        });
      }

      [data, total] = await Promise.all([
        queryBuilder.orderBy('iqc.inspectDate', 'DESC').skip(skip).take(limit).getMany(),
        queryBuilder.getCount(),
      ]);
    } else {
      [data, total] = await Promise.all([
        this.iqcLogRepository.find({
          where,
          skip,
          take: limit,
          order: { inspectDate: 'DESC' },
        }),
        this.iqcLogRepository.count({ where }),
      ]);
    }

    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const partsResult = itemCodes.length > 0
      ? await this.partMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partMap = new Map(partsResult.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: log.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
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

    const part = await this.partMasterRepository.findOne({
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
  async findPendingArrivals(query: PendingArrivalQueryDto, company?: string, plant?: string) {
    const iqcStatus = query.iqcStatus || 'PENDING';

    const qb = this.matLotRepository
      .createQueryBuilder('lot')
      .select('lot.arrivalNo', 'arrivalNo')
      .addSelect('lot.itemCode', 'itemCode')
      .addSelect('lot.vendor', 'vendor')
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
      .orderBy('MIN(lot.createdAt)', 'DESC');

    const rows = await qb.getRawMany<{
      arrivalNo: string;
      itemCode: string;
      vendor: string;
      totalQty: string;
      serialCount: string;
      recvDate: Date | null;
      createdAt: Date | null;
    }>();

    const itemCodes = [...new Set(rows.map((r) => r.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({
        where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
      })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return rows.map((r) => {
      const part = partMap.get(r.itemCode);
      return {
        arrivalNo: r.arrivalNo,
        itemCode: r.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        inspectMethod: part?.inspectMethod ?? null,
        vendor: r.vendor,
        totalQty: Number(r.totalQty) || 0,
        serialCount: Number(r.serialCount) || 0,
        recvDate: r.recvDate,
        createdAt: r.createdAt,
        iqcStatus,
      };
    });
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

    // 1) 입하건의 PENDING 시리얼 전체 일괄 판정
    await this.matLotRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { iqcStatus: dto.result },
    );
    await this.matArrivalRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'PENDING',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { iqcStatus: dto.result },
    );

    // 2) 검사 이력 1건 생성 (matUid=null → 입하단위 검사 표식)
    const log = this.iqcLogRepository.create({
      arrivalNo: dto.arrivalNo,
      matUid: null,
      itemCode: dto.itemCode,
      inspectType: dto.inspectType || 'INITIAL',
      result: dto.result,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      inspectClass: this.normalizeIqcInspectClass(dto.inspectClass) || null,
      destructSampleQty: dto.sampleQty || null,
      sampleBarcode: dto.sampleBarcode || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: tenantCompany,
      plant: tenantPlant,
    });
    const saved = await this.iqcLogRepository.save(log);

    const part = await this.partMasterRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(tenantCompany, tenantPlant) },
    });

    // 3) PASS + 품목에 유효기간 설정 시 → 각 시리얼 expireDate 자동 계산
    if (dto.result === 'PASS' && part && (part.expiryDate ?? 0) > 0) {
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
    if (dto.result === 'FAIL') {
      for (const lot of lots) {
        await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
      }
    }

    // 5) PASS + 샘플수량 → 파괴검사 시료 자동출고 (AUTO_ISSUE 모드, 시리얼 순서대로 차감)
    if (dto.result === 'PASS' && dto.sampleQty && dto.sampleQty > 0) {
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

    return {
      ...saved,
      arrivalNo: dto.arrivalNo,
      itemCode: dto.itemCode,
      itemName: part?.itemName ?? null,
      affectedSerials: lots.length,
    };
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
    const log = await this.iqcLogRepository.findOne({
      where: { inspectDate: new Date(inspectDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!log) throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${inspectDate}/${seq}`);
    await this.iqcLogRepository.update(
      { inspectDate: new Date(inspectDate), seq, ...this.tenantWhere(log.company, log.plant) },
      { certFilePath: filePath },
    );
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
          { iqcStatus: 'PENDING' },
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
