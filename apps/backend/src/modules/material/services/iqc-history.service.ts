/**
 * @file src/modules/material/services/iqc-history.service.ts
 * @description IQC 이력 조회 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * - IqcLog 엔티티는 arrivalNo 필드로 MatArrival과 연결 (matUid 필드 없음)
 * - CreateIqcResultDto의 matUid는 MatLot 조회용이며, IqcLog에는 arrivalNo로 저장
 * - 검색 시 MatLot(matUid)과 IqcLog(arrivalNo)를 각각 조회하여 매칭
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, DataSource } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumRuleService } from '../../num-rule/num-rule.service';

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
    private readonly numRuleService: NumRuleService,
  ) {}

  async findAll(query: IqcHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (inspectType) {
      where.inspectType = inspectType;
    }

    if (result) {
      where.result = result;
    }

    if (fromDate && toDate) {
      where.inspectDate = Between(new Date(fromDate), new Date(toDate));
    }

    let data: IqcLog[];
    let total: number;

    if (search) {
      // 검색어가 있으면 품목 검색 후 필터링
      const parts = await this.partMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`) },
          { itemName: Like(`%${search}%`) },
        ],
      });
      const searchItemCodes = parts.map((p) => p.itemCode);

      // 복합 조건으로 IQC 로그 검색
      const queryBuilder = this.iqcLogRepository.createQueryBuilder('iqc');

      if (company) queryBuilder.andWhere('iqc.company = :company', { company });
      if (plant) queryBuilder.andWhere('iqc.plant = :plant', { plant });

      if (inspectType) {
        queryBuilder.andWhere('iqc.inspectType = :inspectType', { inspectType });
      }
      if (result) {
        queryBuilder.andWhere('iqc.result = :result', { result });
      }
      if (fromDate && toDate) {
        queryBuilder.andWhere('iqc.inspectDate BETWEEN :fromDate AND :toDate', {
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
        });
      }

      if (searchItemCodes.length > 0) {
        queryBuilder.andWhere('iqc.itemCode IN (:...searchItemCodes)', { searchItemCodes });
      } else {
        // arrivalNo로도 검색
        queryBuilder.andWhere('(iqc.arrivalNo LIKE :search OR iqc.itemCode LIKE :search)', { search: `%${search}%` });
      }

      [data, total] = await Promise.all([
        queryBuilder
          .orderBy('iqc.inspectDate', 'DESC')
          .skip(skip)
          .take(limit)
          .getMany(),
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

    // 관련 정보 조회
    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const arrivalNos = data.map((log) => log.arrivalNo).filter(Boolean) as string[];

    const [partsResult] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(partsResult.map((p) => [p.itemCode, p]));

    // 중첩 객체 평면화
    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async createResult(dto: CreateIqcResultDto) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid },
    });
    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    }

    // LOT iqcStatus 업데이트
    await this.matLotRepository.update(dto.matUid, {
      iqcStatus: dto.result,
    });

    // G4: IqcLog 생성 — inspectClass, destructSampleQty, certFilePath 포함
    const log = this.iqcLogRepository.create({
      arrivalNo: null,
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

    // G6: 불합격 시 자동처리 — 불용창고(DEFECT)로 자동이동
    if (dto.result === 'FAIL') {
      await this.handleIqcFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
    }

    // G4: 합격 + 파괴검사 시료 자동출고 (사이트 설정에 따라)
    if (dto.result === 'PASS' && dto.destructSampleQty && dto.destructSampleQty > 0) {
      const issueMode = await this.sysConfigService.getValue('IQC_SAMPLE_ISSUE_MODE');
      if (issueMode === 'AUTO_ISSUE') {
        await this.autoIssueDestructSample(lot.matUid, lot.itemCode, dto.destructSampleQty, lot.company, lot.plant);
      }
    }

    const part = await this.partMasterRepository.findOne({
      where: { itemCode: lot.itemCode },
    });

    return {
      ...saved,
      matUid: lot.matUid,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
    };
  }

  /**
   * G6: IQC 불합격 자동처리 — 불용창고(DEFECT)로 자동이동
   */
  private async handleIqcFail(matUid: string, itemCode: string, company?: string | null, plant?: string | null) {
    const defectWarehouse = await this.warehouseRepository.findOne({
      where: { warehouseType: 'DEFECT', useYn: 'Y' },
    });
    if (!defectWarehouse) return;

    const stock = await this.matStockRepository.findOne({
      where: { matUid, itemCode },
    });
    if (!stock || stock.qty <= 0) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

      // 원래 창고에서 차감
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid },
        { qty: 0 },
      );

      // 불용창고에 upsert
      const existing = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: defectWarehouse.warehouseCode, itemCode, matUid },
      });
      if (existing) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: defectWarehouse.warehouseCode, itemCode, matUid },
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

      // StockTransaction 기록
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

      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * G4: 파괴검사 시료 자동출고 (IQC_SAMPLE_ISSUE_MODE = AUTO_ISSUE인 경우)
   */
  private async autoIssueDestructSample(matUid: string, itemCode: string, sampleQty: number, company?: string | null, plant?: string | null) {
    const stock = await this.matStockRepository.findOne({
      where: { matUid, itemCode },
    });
    if (!stock || stock.qty < sampleQty) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid },
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

      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** G4: 검사성적서 파일 업로드 */
  async uploadCert(inspectDate: string, seq: number, filePath: string) {
    const log = await this.iqcLogRepository.findOne({
      where: { inspectDate: new Date(inspectDate), seq },
    });
    if (!log) throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${inspectDate}/${seq}`);
    await this.iqcLogRepository.update({ inspectDate: new Date(inspectDate), seq }, { certFilePath: filePath });
    return { ...log, certFilePath: filePath };
  }

  /** IQC 판정 취소 - LOT iqcStatus를 PENDING으로 복원
   *  @param inspectDate ISO 날짜 문자열 (복합 PK 일부)
   *  @param seq 시퀀스 번호 (복합 PK 일부)
   */
  async cancel(inspectDate: string, seq: number, dto: CancelIqcResultDto) {
    const log = await this.iqcLogRepository.findOne({
      where: { inspectDate: new Date(inspectDate), seq },
    });
    if (!log) {
      throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${inspectDate}/${seq}`);
    }
    if (log.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 판정입니다.');
    }

    // 이미 입고된 LOT인지 확인 (itemCode 기준으로 최근 입고 체크)
    if (log.itemCode) {
      const receiving = await this.matReceivingRepository.findOne({
        where: { itemCode: log.itemCode, status: 'DONE' },
      });
      if (receiving) {
        throw new BadRequestException('이미 입고된 LOT은 IQC 판정을 취소할 수 없습니다.');
      }
    }

    // IqcLog 상태 변경
    await this.iqcLogRepository.update(
      { inspectDate: new Date(inspectDate), seq },
      { status: 'CANCELED', remark: dto.reason },
    );

    // LOT의 iqcStatus를 PENDING으로 복원 (itemCode 기준으로 LOT 찾기)
    if (log.itemCode) {
      const lot = await this.matLotRepository.findOne({
        where: { itemCode: log.itemCode, iqcStatus: log.result },
        order: { createdAt: 'DESC' },
      });
      if (lot) {
        await this.matLotRepository.update(lot.matUid, {
          iqcStatus: 'PENDING',
        });
      }
    }

    return { inspectDate, seq, status: 'CANCELED' };
  }
}
