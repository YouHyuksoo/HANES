/**
 * @file services/shelf-life-reinspect.service.ts
 * @description G11: 유수명자재 재검사 서비스 — IQC_LOGS(inspectType='RETEST') 활용
 *
 * 초보자 가이드:
 * 1. create(): IqcLog에 inspectType='RETEST'로 기록 + 합격/불합격 후속 처리
 * 2. 합격: 품목 EXTEND_SHELF_DAYS만큼 MatLot.expireDate 연장
 * 3. 불합격: G6과 동일한 불합격 자동처리 (불용창고 이동)
 * 4. 별도 테이블 없이 기존 IQC_LOGS 재사용 (심플이즈베스트)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';

interface CreateReInspectDto {
  matUid: string;
  inspectorName?: string;
  result: 'PASS' | 'FAIL';
  destructSampleQty?: number;
  details?: string;
  remark?: string;
}

@Injectable()
export class ShelfLifeReInspectService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepo: Repository<IqcLog>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}

  /** 재검사 이력 조회 (inspectType = RETEST) */
  async findAll(query: { page?: number; limit?: number }, company?: string, plant?: string) {
    const { page = 1, limit = 20 } = query;
    const where: any = {
      inspectType: 'RETEST',
      ...(company && { company }),
      ...(plant && { plant }),
    };
    const [data, total] = await this.iqcLogRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { inspectDate: 'DESC' },
    });
    return { data, total, page, limit };
  }

  /** 재검사 실적 등록 + 후속처리 */
  async create(dto: CreateReInspectDto) {
    const lot = await this.matLotRepo.findOne({ where: { matUid: dto.matUid } });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);

    const part = await this.partMasterRepo.findOne({ where: { itemCode: lot.itemCode } });

    // IqcLog에 RETEST로 기록
    const log = this.iqcLogRepo.create({
      arrivalNo: null,
      itemCode: lot.itemCode,
      inspectType: 'RETEST',
      result: dto.result,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      destructSampleQty: dto.destructSampleQty || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
      company: lot.company,
      plant: lot.plant,
    });
    const saved = await this.iqcLogRepo.save(log);

    // 합격: 만료기간 연장
    if (dto.result === 'PASS' && lot.expireDate) {
      const extendDays = (part as any)?.extendShelfDays ?? 90;
      const prevExpiry = new Date(lot.expireDate);
      const newExpiry = new Date(prevExpiry.getTime() + extendDays * 24 * 60 * 60 * 1000);
      await this.matLotRepo.update(lot.matUid, { expireDate: newExpiry });
    }

    // 불합격: 불용창고 자동이동
    if (dto.result === 'FAIL') {
      await this.handleFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
    }

    return { ...saved, matUid: dto.matUid };
  }

  /** 불합격 처리: 불용창고 자동이동 (G6과 동일 로직) */
  private async handleFail(matUid: string, itemCode: string, company?: string | null, plant?: string | null) {
    const defectWh = await this.warehouseRepo.findOne({ where: { warehouseType: 'DEFECT', useYn: 'Y' } });
    if (!defectWh) return;

    const stock = await this.matStockRepo.findOne({ where: { matUid, itemCode } });
    if (!stock || stock.qty <= 0) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid },
        { qty: 0 },
      );

      const existing = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: defectWh.warehouseCode, itemCode, matUid },
      });
      if (existing) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: defectWh.warehouseCode, itemCode, matUid },
          { qty: existing.qty + stock.qty },
        );
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: defectWh.warehouseCode, itemCode, matUid,
          qty: stock.qty, reservedQty: 0, company, plant,
        });
      }

      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_MOVE',
        fromWarehouseId: stock.warehouseCode,
        toWarehouseId: defectWh.warehouseCode,
        itemCode, matUid,
        qty: stock.qty,
        remark: '유수명 재검 불합격 자동이동 (불용창고)',
        refType: 'REINSPECT_FAIL',
        company, plant,
      });

      await queryRunner.manager.update(MatLot, matUid, { status: 'SCRAPPED' });

      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
