import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, DataSource, IsNull } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

@Injectable()
export class IqcHistoryService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
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

  async findAll(query: IqcHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(inspectType && { inspectType }),
      ...(result && { result }),
      ...(fromDate && toDate && { inspectDate: Between(new Date(fromDate), new Date(toDate)) }),
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
      if (fromDate && toDate) {
        queryBuilder.andWhere('iqc.inspectDate BETWEEN :fromDate AND :toDate', {
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
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
      inspectClass: dto.inspectClass || null,
      destructSampleQty: dto.destructSampleQty || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: lot.company,
      plant: lot.plant,
    });
    const saved = await this.iqcLogRepository.save(log);

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

    const part = await this.partMasterRepository.findOne({
      where: { itemCode: lot.itemCode, ...lotTenantWhere },
    });

    return {
      ...saved,
      matUid: lot.matUid,
      itemCode: lot.itemCode,
      itemName: part?.itemName ?? null,
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
    queryRunner: any,
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
