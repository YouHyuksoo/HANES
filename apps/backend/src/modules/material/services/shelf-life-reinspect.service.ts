/**
 * @file services/shelf-life-reinspect.service.ts
 * @description G11: 유수명자재 재검사 서비스 — 수명만료 자재 재검 워크플로우
 *
 * 초보자 가이드:
 * 1. create(): 재검사 실적 등록 + 합격/불합격 후속 처리
 * 2. 합격: 품목 EXTEND_SHELF_DAYS만큼 MatLot.expireDate 연장
 * 3. 불합격: Phase 1 G6과 동일한 불합격 자동처리 (불용창고 이동)
 * 4. IQC와 동일 검사항목 참조, 단 검사분류/성적서 없음
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ShelfLifeReInspect } from '../../../entities/shelf-life-reinspect.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';

interface CreateReInspectDto {
  matUid: string;
  inspectorId?: string;
  inspectorName?: string;
  result: 'PASS' | 'FAIL';
  destructSampleQty?: number;
  details?: string;
  remark?: string;
}

@Injectable()
export class ShelfLifeReInspectService {
  constructor(
    @InjectRepository(ShelfLifeReInspect)
    private readonly reInspectRepo: Repository<ShelfLifeReInspect>,
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

  /** 재검사 이력 조회 */
  async findAll(query: { matUid?: string; result?: string; page?: number; limit?: number }, company?: string, plant?: string) {
    const { matUid, result, page = 1, limit = 20 } = query;
    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(matUid && { matUid }),
      ...(result && { result }),
    };
    const [data, total] = await this.reInspectRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit };
  }

  /** 재검사 실적 등록 + 합격/불합격 후속처리 */
  async create(dto: CreateReInspectDto) {
    const lot = await this.matLotRepo.findOne({ where: { matUid: dto.matUid } });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);

    const part = await this.partMasterRepo.findOne({ where: { itemCode: lot.itemCode } });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const reinspectNo = await this.numRuleService.nextNumberInTx(queryRunner, 'REINSPECT');

      const prevExpiry = lot.expireDate ? new Date(lot.expireDate) : null;
      let newExpiry: Date | null = null;

      if (dto.result === 'PASS' && prevExpiry) {
        // 합격: 품목 EXTEND_SHELF_DAYS만큼 연장 (없으면 90일 기본)
        const extendDays = (part as any)?.extendShelfDays ?? 90;
        newExpiry = new Date(prevExpiry.getTime() + extendDays * 24 * 60 * 60 * 1000);
        await queryRunner.manager.update(MatLot, lot.matUid, { expireDate: newExpiry });
      }

      const record = queryRunner.manager.create(ShelfLifeReInspect, {
        reinspectNo,
        matUid: dto.matUid,
        itemCode: lot.itemCode,
        inspectorId: dto.inspectorId,
        inspectorName: dto.inspectorName,
        inspectDate: new Date(),
        result: dto.result,
        destructSampleQty: dto.destructSampleQty,
        details: dto.details,
        prevExpiryDate: prevExpiry,
        newExpiryDate: newExpiry,
        remark: dto.remark,
        company: lot.company,
        plant: lot.plant,
      });
      await queryRunner.manager.save(record);

      // 불합격: 불용창고 자동이동 (G6과 동일)
      if (dto.result === 'FAIL') {
        await this.handleFail(queryRunner, lot.matUid, lot.itemCode, lot.company, lot.plant);
      }

      await queryRunner.commitTransaction();
      return record;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** 불합격 처리: 불용창고 자동이동 */
  private async handleFail(queryRunner: any, matUid: string, itemCode: string, company?: string | null, plant?: string | null) {
    const defectWh = await this.warehouseRepo.findOne({ where: { warehouseType: 'DEFECT', useYn: 'Y' } });
    if (!defectWh) return;

    const stock = await queryRunner.manager.findOne(MatStock, { where: { matUid, itemCode } });
    if (!stock || stock.qty <= 0) return;

    const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

    // 원래 창고에서 차감
    await queryRunner.manager.update(MatStock,
      { warehouseCode: stock.warehouseCode, itemCode, matUid },
      { qty: 0 },
    );

    // 불용창고에 upsert
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

    // LOT 상태 변경
    await queryRunner.manager.update(MatLot, matUid, { status: 'SCRAPPED' });
  }
}
