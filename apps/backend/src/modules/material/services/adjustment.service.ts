/**
 * @file src/modules/material/services/adjustment.service.ts
 * @description ?ш퀬蹂댁젙 鍮꾩쫰?덉뒪 濡쒖쭅 - InvAdjLog ?앹꽦 + StockTransaction 湲곕줉 (TypeORM)
 *
 * 珥덈낫??媛?대뱶:
 * - create(): 利됱떆 ?뱀씤(APPROVED) 泥섎━ ??湲곗〈 PC ?붾㈃?? ?ш퀬 利됱떆 諛섏쁺
 * - createPending(): ?뱀씤 ?湲?PENDING) 泥섎━ ??PDA ?붿껌?? ?ш퀬 蹂대쪟
 * - approve(adjDate, seq): PENDING ??APPROVED, ?ㅼ젣 ?ш퀬 李④컧/利앷? ?ㅽ뻾
 * - reject(adjDate, seq): PENDING ??REJECTED, ?ш퀬 蹂???놁쓬
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between, In } from 'typeorm';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';
import { TransactionService } from '../../../shared/transaction.service';

@Injectable()
export class AdjustmentService {
  constructor(
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
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
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  async findAll(query: AdjustmentQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (search) {
      where.warehouseCode = Like(`%${search}%`);
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    }

    const [data, total] = await Promise.all([
      this.invAdjLogRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.invAdjLogRepository.count({ where }),
    ]);

    // part ?뺣낫 議고쉶 諛?以묒꺽 媛앹껜 ?됰㈃??
    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const tenantWhere = this.tenantWhere(company, plant);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

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

  /**
   * 利됱떆 ?뱀씤 蹂댁젙 ?깅줉 (PC ?붾㈃ 湲곕낯 ?숈옉)
   * - adjustStatus = 'APPROVED' 濡???ν븯怨??ш퀬瑜?利됱떆 諛섏쁺?⑸땲??
   */
  async create(dto: CreateAdjustmentDto, company?: string, plant?: string) {
    return this._executeAdjustment(dto, 'APPROVED', company, plant);
  }

  /**
   * ?뱀씤 ?湲?蹂댁젙 ?깅줉 (PDA ?붿껌??
   * - adjustStatus = 'PENDING' ?쇰줈 ??ν븯怨??ш퀬 蹂?숈? 蹂대쪟?⑸땲??
   * - approve(id) ?몄텧 ???ш퀬媛 ?ㅼ젣 諛섏쁺?⑸땲??
   */
  async createPending(dto: CreateAdjustmentDto, company?: string, plant?: string) {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      const part = await queryRunner.manager.findOne(PartMaster, { where: { itemCode, ...tenantWhere } });
      if (!part) throw new NotFoundException(`?덈ぉ??李얠쓣 ???놁뒿?덈떎: ${itemCode}`);

      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid, ...tenantWhere } });
        if (!lot) throw new NotFoundException(`LOT??李얠쓣 ???놁뒿?덈떎: ${matUid}`);
      }

      // ?ш퀬 議고쉶 (蹂???놁씠 beforeQty留?湲곕줉)
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode,
          itemCode,
          ...(matUid && { matUid }),
          ...tenantWhere,
        },
      });
      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;
      if (stock) {
        this.assertSameTenant('보정 대상 재고', { company, plant }, stock);
      }
      if (stock && afterQty < stock.reservedQty) {
        throw new BadRequestException(
          `????(${stock.reservedQty})?? ?? ??? ??? ? ????.`,
        );
      }

      const invAdjLog = queryRunner.manager.create(InvAdjLog, {
        warehouseCode,
        itemCode,
        matUid: matUid || null,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus: 'PENDING',
        createdBy,
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(invAdjLog);

      return {
        adjDate: invAdjLog.adjDate,
        seq: invAdjLog.seq,
        warehouseCode,
        itemCode: part.itemCode,
        matUid,
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus: 'PENDING',
        itemName: part.itemName,
        unit: part.unit,
      };
    });
  }

  /**
   * 蹂댁젙 ?뱀씤 泥섎━
   * - PENDING ?곹깭??蹂댁젙 ?붿껌??APPROVED濡?蹂寃쏀븯怨??ㅼ젣 ?ш퀬瑜?諛섏쁺?⑸땲??
   * @param adjDate InvAdjLog 議곗젙?쇱옄 PK
   * @param seq InvAdjLog ?쇰젴踰덊샇 PK
   * @param approvedBy ?뱀씤??ID
   */
  async approve(adjDate: string, seq: number, approvedBy?: string, company?: string, plant?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({
      where: { adjDate: new Date(adjDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!adjLog) throw new NotFoundException(`蹂댁젙 ?대젰??李얠쓣 ???놁뒿?덈떎: ${adjDate}-${seq}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`?대? 泥섎━??蹂댁젙 ?붿껌?낅땲?? ?꾩옱 ?곹깭: ${adjLog.adjustStatus}`);
    }

    const { warehouseCode, itemCode, matUid, afterQty, diffQty, reason } = adjLog;
    const adjTenantWhere = this.tenantWhere(adjLog.company, adjLog.plant);

    return this.tx.run(async (queryRunner) => {
      // ?ш퀬 ?낅뜲?댄듃
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, ...(matUid && { matUid }), ...adjTenantWhere },
      });

      if (stock) {
        if (afterQty < stock.reservedQty) {
          throw new BadRequestException(
            `????(${stock.reservedQty})?? ?? ??? ??? ? ????.`,
          );
        }
        await queryRunner.manager.update(
          MatStock,
          {
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid,
            ...adjTenantWhere,
          },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('?ш퀬媛 ?녿뒗 ?곹깭?먯꽌 ?뚯닔 議곗젙???????놁뒿?덈떎.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company: adjLog.company,
          plant: adjLog.plant,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // LOT ?곹깭 ?낅뜲?댄듃 (?ш퀬 0?대㈃ DEPLETED ??currentQty??MatStock?먯꽌留?愿由?
      if (matUid) {
        if (afterQty <= 0) {
          await queryRunner.manager.update(MatLot, { matUid, ...adjTenantWhere }, { status: 'DEPLETED' });
        }
      }

      // ?ш퀬 嫄곕옒 ?대젰 ?앹꽦
      const transNo = await this.generateTransNo();
      const stockTransaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: diffQty >= 0 ? 'ADJUST_IN' : 'ADJUST_OUT',
        transDate: new Date(),
        fromWarehouseId: diffQty < 0 ? warehouseCode : null,
        toWarehouseId: diffQty >= 0 ? warehouseCode : null,
        itemCode,
        matUid: matUid || null,
        qty: Math.abs(diffQty),
        refType: 'ADJUSTMENT',
        refId: `${adjDate}-${seq}`,
        remark: reason,
        status: 'DONE',
        createdBy: approvedBy,
        company: adjLog.company,
        plant: adjLog.plant,
      });
      await queryRunner.manager.save(stockTransaction);

      // 蹂댁젙 ?대젰 ?곹깭 ?낅뜲?댄듃
      await queryRunner.manager.update(InvAdjLog, { adjDate: new Date(adjDate), seq, ...adjTenantWhere }, {
        adjustStatus: 'APPROVED',
        approvedBy: approvedBy || null,
        approvedAt: new Date(),
      });

      return { adjDate, seq, adjustStatus: 'APPROVED', approvedBy, approvedAt: new Date() };
    });
  }

  /**
   * 蹂댁젙 諛섎젮 泥섎━
   * - PENDING ?곹깭??蹂댁젙 ?붿껌??REJECTED濡?蹂寃쏀빀?덈떎.
   * - ?ш퀬 蹂?숈? ?쇱뼱?섏? ?딆뒿?덈떎.
   * @param adjDate InvAdjLog 議곗젙?쇱옄 PK
   * @param seq InvAdjLog ?쇰젴踰덊샇 PK
   * @param rejectedBy 諛섎젮??ID
   */
  async reject(adjDate: string, seq: number, rejectedBy?: string, company?: string, plant?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({
      where: { adjDate: new Date(adjDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!adjLog) throw new NotFoundException(`蹂댁젙 ?대젰??李얠쓣 ???놁뒿?덈떎: ${adjDate}-${seq}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`?대? 泥섎━??蹂댁젙 ?붿껌?낅땲?? ?꾩옱 ?곹깭: ${adjLog.adjustStatus}`);
    }

    await this.invAdjLogRepository.update({ adjDate: new Date(adjDate), seq, ...this.tenantWhere(adjLog.company, adjLog.plant) }, {
      adjustStatus: 'REJECTED',
      updatedBy: rejectedBy || null,
    });

    return { adjDate, seq, adjustStatus: 'REJECTED', rejectedBy };
  }

  /**
   * 利됱떆 ?뱀씤 蹂댁젙???대? 怨듯넻 濡쒖쭅
   * - adjustStatus='APPROVED'???뚮쭔 ?ㅼ젣 ?ш퀬 蹂?숈씠 諛쒖깮?⑸땲??
   */
  private async _executeAdjustment(dto: CreateAdjustmentDto, adjustStatus: 'APPROVED', company?: string, plant?: string) {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      // ?덈ぉ ?뺤씤
      const part = await queryRunner.manager.findOne(PartMaster, {
        where: { itemCode, ...tenantWhere },
      });
      if (!part) {
        throw new NotFoundException(`?덈ぉ??李얠쓣 ???놁뒿?덈떎: ${itemCode}`);
      }

      // LOT ?뺤씤 (matUid媛 ?덈뒗 寃쎌슦)
      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid, ...tenantWhere },
        });
        if (!lot) {
          throw new NotFoundException(`LOT??李얠쓣 ???놁뒿?덈떎: ${matUid}`);
        }
      }

      // 湲곗〈 ?ш퀬 議고쉶
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode,
          itemCode,
          ...(matUid && { matUid }),
          ...tenantWhere,
        },
      });

      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;
      if (stock) {
        this.assertSameTenant('보정 대상 재고', { company, plant }, stock);
      }

      // ?ш퀬 ?낅뜲?댄듃 ?먮뒗 ?앹꽦
      if (stock) {
        await queryRunner.manager.update(MatStock,
          {
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid,
            ...tenantWhere,
          },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('?ш퀬媛 ?녿뒗 ?곹깭?먯꽌 ?뚯닔 議곗젙???????놁뒿?덈떎.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company,
          plant,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // LOT ?곹깭 ?낅뜲?댄듃 (?ш퀬 0?대㈃ DEPLETED ??currentQty??MatStock?먯꽌留?愿由?
      if (matUid) {
        if (afterQty <= 0) {
          await queryRunner.manager.update(MatLot, { matUid, ...tenantWhere }, { status: 'DEPLETED' });
        }
      }

      // 蹂댁젙 ?대젰 ?앹꽦
      const invAdjLog = queryRunner.manager.create(InvAdjLog, {
        warehouseCode,
        itemCode,
        matUid: matUid || null,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus,
        createdBy,
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(invAdjLog);

      // ?ш퀬 嫄곕옒 ?대젰 ?앹꽦 (?몃옖??뀡 踰덊샇 ?앹꽦)
      const transNo = await this.generateTransNo();
      const stockTransaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: diffQty >= 0 ? 'ADJUST_IN' : 'ADJUST_OUT',
        transDate: new Date(),
        fromWarehouseId: diffQty < 0 ? warehouseCode : null,
        toWarehouseId: diffQty >= 0 ? warehouseCode : null,
        itemCode,
        matUid: matUid || null,
        qty: Math.abs(diffQty),
        refType: 'ADJUSTMENT',
        refId: `${invAdjLog.adjDate}-${invAdjLog.seq}`,
        remark: reason,
        status: 'DONE',
        createdBy,
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(stockTransaction);

      return {
        adjDate: invAdjLog.adjDate,
        seq: invAdjLog.seq,
        warehouseCode,
        itemCode: part.itemCode,
        matUid,
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus,
        itemName: part.itemName,
        unit: part.unit,
      };
    });
  }

  /**
   * ?몃옖??뀡 踰덊샇 ?앹꽦
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `ADJ${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.stockTransactionRepository.findOne({
      where: { transNo: Like(`${prefix}%`) },
      order: { transNo: 'DESC' },
    });

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(-5), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }
}

