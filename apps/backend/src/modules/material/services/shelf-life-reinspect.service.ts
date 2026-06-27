/**
 * @file services/shelf-life-reinspect.service.ts
 * @description G11: 유수명자재 재검사 서비스 — IQC_LOGS(inspectType='RETEST') 활용
 *
 * 초보자 가이드:
 * 1. create(): IqcLog에 inspectType='RETEST'로 기록 + 합격/불합격 후속 처리
 * 2. 합격: 새 만료일 = 검사일 + 적용연장일(item.expiryExtDays 상한)
 * 3. 불합격: 불용창고 이동 + MatLot.status = 'DISCARDED'
 * 4. 회차: 해당 시리얼의 이전 RETEST IqcLog 수 + 1
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

interface CreateReInspectDto {
  matUid: string;
  inspectorName?: string;
  result: 'PASS' | 'FAIL';
  extendDays?: number;
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
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepo: Repository<ItemMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    row: { company?: string | null; plant?: string | null } | null | undefined,
    company?: string | null,
    plant?: string | null,
    context = '데이터',
  ) {
    if (company && row?.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row?.company ?? 'NULL'}`);
    }
    if (plant && row?.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row?.plant ?? 'NULL'}`);
    }
  }

  /** 재검사 이력 조회 (inspectType = RETEST) */
  async findAll(query: { page?: number; limit?: number; matUid?: string; result?: string }, company?: string, plant?: string) {
    const { page = 1, limit = 20 } = query;
    const where: FindOptionsWhere<IqcLog> = {
      inspectType: 'RETEST',
      ...(company && { company }),
      ...(plant && { plant }),
      ...(query.matUid && { matUid: query.matUid }),
      ...(query.result && { result: query.result }),
    };
    const [data, total] = await this.iqcLogRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { inspectDate: 'DESC' },
    });

    // 품목명 보강
    const itemCodes = [...new Set(data.map(d => d.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepo.find({ where: itemCodes.map(code => ({ itemCode: code, ...(company && { company }), ...(plant && { plant }) })) })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    return {
      data: data.map(d => ({
        ...d,
        itemName: partMap.get(d.itemCode)?.itemName ?? null,
        unit: partMap.get(d.itemCode)?.unit ?? null,
      })),
      total, page, limit,
    };
  }

  /** 재검사 실적 등록 + 후속처리 */
  async create(dto: CreateReInspectDto, company?: string, plant?: string) {
    const lot = await this.matLotRepo.findOne({
      where: { matUid: dto.matUid, ...this.tenantWhere(company, plant) },
    });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    this.assertSameTenant(lot, company, plant, 'LOT');

    if (lot.status === 'DISCARDED') {
      throw new BadRequestException('이미 폐기 처리된 LOT입니다.');
    }

    const lotTenant = this.tenantWhere(lot.company, lot.plant);

    // 품목 조회 (최대 연장일 확인)
    const item = await this.itemMasterRepo.findOne({
      where: { itemCode: lot.itemCode, ...lotTenant },
    });
    const maxExtDays = item?.expiryExtDays ?? 0;

    // 연장일 검증 및 결정
    if (dto.extendDays !== undefined && dto.extendDays !== null) {
      if (dto.extendDays < 0) {
        throw new BadRequestException('연장일은 0 이상이어야 합니다.');
      }
      if (maxExtDays > 0 && dto.extendDays > maxExtDays) {
        throw new BadRequestException(
          `적용연장일(${dto.extendDays}일)이 품목의 최대 연장일(${maxExtDays}일)을 초과합니다.`,
        );
      }
    }
    const extendDays = dto.extendDays ?? maxExtDays;

    // 회차 계산: 이 시리얼의 기존 RETEST 이력 수 + 1
    const prevCount = await this.iqcLogRepo.count({
      where: { matUid: dto.matUid, inspectType: 'RETEST', ...lotTenant },
    });
    const retestRound = prevCount + 1;

    const inspectionDate = new Date();
    inspectionDate.setHours(0, 0, 0, 0);

    // IqcLog 기록 (matUid + retestRound 포함)
    const log = this.iqcLogRepo.create({
      arrivalNo: null,
      matUid: dto.matUid,
      itemCode: lot.itemCode,
      inspectType: 'RETEST',
      result: dto.result,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      destructSampleQty: dto.destructSampleQty || null,
      remark: dto.remark || null,
      retestRound,
      inspectDate: new Date(),
      company: lot.company,
      plant: lot.plant,
    });
    const saved = await this.iqcLogRepo.save(log);

    // 합격: 새 만료일 = 검사일 + 연장일 (prevExpiry 기준 아님)
    if (dto.result === 'PASS' && extendDays > 0) {
      const newExpiry = new Date(inspectionDate.getTime() + extendDays * 24 * 60 * 60 * 1000);
      await this.matLotRepo.update({ matUid: lot.matUid, ...lotTenant }, { expireDate: newExpiry });
    }

    // 불합격: 불용창고 이동 + DISCARDED 처리
    if (dto.result === 'FAIL') {
      await this.handleFail(lot.matUid, lot.itemCode, lot.company, lot.plant);
    }

    return { ...saved, matUid: dto.matUid, retestRound };
  }

  /** 불합격 처리: 불용창고 자동이동 + status = DISCARDED */
  private async handleFail(matUid: string, itemCode: string, company?: string | null, plant?: string | null) {
    const tenantWhere = this.tenantWhere(company, plant);
    const defectWh = await this.warehouseRepo.findOne({
      where: { warehouseType: 'DEFECT', useYn: 'Y', ...tenantWhere },
    });
    if (!defectWh) return;
    this.assertSameTenant(defectWh, company, plant, '불용창고');

    const stock = await this.matStockRepo.findOne({
      where: { matUid, itemCode, ...tenantWhere },
    });
    if (!stock || stock.qty <= 0) {
      // 재고 없어도 DISCARDED 처리는 진행
      await this.matLotRepo.update({ matUid, ...tenantWhere }, { status: 'DISCARDED' });
      return;
    }
    this.assertSameTenant(stock, company, plant, '재검 대상 재고');

    if ((stock.availableQty ?? stock.qty) < stock.qty) {
      throw new BadRequestException(
        `예약된 수량이 남아 있어 폐기 처리를 할 수 없습니다. 가용수량: ${stock.availableQty ?? 0}`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      // 양품창고 출고(-) / 불용창고 입고(+) 각각 별도 채번 (수불이력에 창고별 +/- 2건으로 표기)
      const transNoOut = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
      const transNoIn = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');

      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode, matUid, ...tenantWhere },
        { qty: 0 },
      );

      const existing = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: defectWh.warehouseCode, itemCode, matUid, ...tenantWhere },
      });
      if (existing) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: defectWh.warehouseCode, itemCode, matUid, ...tenantWhere },
          { qty: existing.qty + stock.qty },
        );
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: defectWh.warehouseCode, itemCode, matUid,
          qty: stock.qty, reservedQty: 0, company, plant,
        });
      }

      // 양품창고 출고(-): from=양품창고, to=null, 음수 수량
      await queryRunner.manager.save(StockTransaction, {
        transNo: transNoOut,
        transType: 'MAT_MOVE_OUT',
        fromWarehouseId: stock.warehouseCode,
        toWarehouseId: null,
        itemCode, matUid,
        qty: -stock.qty,
        remark: '유수명 재검 불합격 출고 (양품→불용)',
        refType: 'REINSPECT_FAIL',
        company, plant,
      });
      // 불용창고 입고(+): from=null, to=불용창고, 양수 수량
      await queryRunner.manager.save(StockTransaction, {
        transNo: transNoIn,
        transType: 'MAT_MOVE_IN',
        fromWarehouseId: null,
        toWarehouseId: defectWh.warehouseCode,
        itemCode, matUid,
        qty: stock.qty,
        remark: '유수명 재검 불합격 입고 (불용창고)',
        refType: 'REINSPECT_FAIL',
        company, plant,
      });

      await queryRunner.manager.update(MatLot, { matUid, ...tenantWhere }, { status: 'DISCARDED' });
    });
  }
}
