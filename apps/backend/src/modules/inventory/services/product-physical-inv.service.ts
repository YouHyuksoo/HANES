import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, In } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { TransactionService } from '../../../shared/transaction.service';
import {
  CreateProductPhysicalInvDto,
  ProductPhysicalInvQueryDto,
  ProductPhysicalInvHistoryQueryDto,
  ScanProductCountDto,
  StartProductPhysicalInvSessionDto,
} from '../dto/product-physical-inv.dto';

@Injectable()
export class ProductPhysicalInvService {
  constructor(
    @InjectRepository(ProductStock)
    private readonly stockRepository: Repository<ProductStock>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(PhysicalInvSession)
    private readonly sessionRepository: Repository<PhysicalInvSession>,
    @InjectRepository(PhysicalInvCountDetail)
    private readonly countDetailRepository: Repository<PhysicalInvCountDetail>,
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
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  async findStocks(query: ProductPhysicalInvQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search } = query;
    const warehouseCode = query.warehouseCode ?? query.warehouseId;
    const skip = (page - 1) * limit;

    const qb = this.stockRepository
      .createQueryBuilder('s')
      .leftJoin(ItemMaster, 'p', 'p.itemCode = s.itemCode AND p.company = s.company AND p.plant = s.plant')
      .leftJoin(Warehouse, 'w', 'w.warehouseCode = s.warehouseCode AND w.company = s.company AND w.plant = s.plant')
      .select([
        's.warehouseCode || \'::\' || s.itemCode AS "id"',
        's.warehouseCode AS "warehouseCode"',
        's.warehouseCode AS "warehouseId"',
        'w.warehouseName AS "warehouseName"',
        's.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'p.unit AS "unit"',
        'p.itemType AS "itemType"',
        's.qty AS "qty"',
        's.reservedQty AS "reservedQty"',
        's.availableQty AS "availableQty"',
        's.lastCountAt AS "lastCountAt"',
      ])
      .where('s.qty > 0');

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });
    if (warehouseCode) qb.andWhere('s.warehouseCode = :warehouseCode', { warehouseCode });

    if (search) {
      qb.andWhere(
        '(LOWER(p.itemCode) LIKE :search OR LOWER(p.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('p.itemCode', 'ASC').addOrderBy('s.warehouseCode', 'ASC');

    const total = await qb.getCount();
    const data = await qb.offset(skip).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  async findHistory(query: ProductPhysicalInvHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, fromDate, toDate } = query;
    const warehouseCode = query.warehouseCode ?? query.warehouseId;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(ItemMaster, 'part', 'part.itemCode = log.itemCode AND part.company = log.company AND part.plant = log.plant')
      .leftJoin(MatLot, 'lot', 'lot.matUid = log.matUid AND lot.company = log.company AND lot.plant = log.plant')
      .leftJoin(Warehouse, 'wh', 'wh.warehouseCode = log.warehouseCode AND wh.company = log.company AND wh.plant = log.plant')
      .select([
        'log.adjDate AS "adjDate"',
        'log.seq AS "seq"',
        'log.warehouseCode AS "warehouseCode"',
        'log.warehouseCode AS "warehouseId"',
        'wh.warehouseName AS "warehouseName"',
        'log.itemCode AS "itemCode"',
        'part.itemName AS "itemName"',
        'part.unit AS "unit"',
        'log.matUid AS "prdUid"',
        'log.beforeQty AS "beforeQty"',
        'log.afterQty AS "afterQty"',
        'log.diffQty AS "diffQty"',
        'log.reason AS "reason"',
        'log.createdBy AS "createdBy"',
        'log.createdAt AS "createdAt"',
      ])
      .where('log.adjType = :adjType', { adjType: 'PRODUCT_PHYSICAL_COUNT' });

    if (company) qb.andWhere('log.company = :company', { company });
    if (plant) qb.andWhere('log.plant = :plant', { plant });
    if (warehouseCode) qb.andWhere('log.warehouseCode = :warehouseCode', { warehouseCode });
    if (fromDate) qb.andWhere('log.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      qb.andWhere('log.createdAt < :toDate', { toDate: end });
    }
    if (search) {
      qb.andWhere(
        '(LOWER(part.itemCode) LIKE :search OR LOWER(part.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.offset((page - 1) * limit).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  async applyCount(dto: CreateProductPhysicalInvDto, company?: string, plant?: string, actor?: string) {
    const { items, countMonth, countType } = dto;
    const createdBy = actor || dto.createdBy || 'system';

    return this.tx.run(async (queryRunner) => {
      const results = [];

      for (const item of items) {
        const [warehouseCode, itemCode] = item.stockId.split('::');
        if (!warehouseCode || !itemCode) {
          throw new NotFoundException(`잘못된 재고 ID 형식입니다: ${item.stockId}`);
        }

        const scopedKey: FindOptionsWhere<ProductStock> = {
          warehouseCode,
          itemCode,
          ...(company && { company }),
          ...(plant && { plant }),
        };

        const stock = await queryRunner.manager.findOne(ProductStock, {
          where: scopedKey,
        });

        if (!stock) {
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
        }
        this.assertSameTenant('제품 실사 대상 재고', stock, company, plant);

        const reservedQty = stock.reservedQty ?? 0;
        if (item.countedQty < reservedQty) {
          throw new BadRequestException(
            `실사수량(${item.countedQty})은 예약수량(${reservedQty})보다 작을 수 없습니다: ${item.stockId}`,
          );
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;

        await queryRunner.manager.update(ProductStock, scopedKey, {
          qty: afterQty,
          availableQty: afterQty - reservedQty,
          lastCountAt: new Date(),
          updatedBy: createdBy,
        });

        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.prdUid,
          adjType: 'PRODUCT_PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          company: stock.company,
          plant: stock.plant,
          reason: [
            countType === 'CANCEL' ? '[취소]' : null,
            countMonth ? `[${countMonth}]` : null,
            item.remark || '제품재고실사',
          ].filter(Boolean).join(' '),
          createdBy,
        });

        const savedLog = await queryRunner.manager.save(invAdjLog);
        results.push(savedLog);
      }

      return results;
    });
  }

  // ───── PDA 제품 재고실사 세션 (invType='PRODUCT') ─────────────────────────

  private formatSessionDate(d: Date | string): string {
    return d instanceof Date
      ? d.toISOString().split('T')[0]
      : String(d).split('T')[0];
  }

  /**
   * PDA: 진행 중 제품 실사 세션 조회 (IN_PROGRESS & invType='PRODUCT')
   * 프론트가 기대하는 형태 반환. PK가 sessionDate+seq라 단일 sessionId가 없으므로
   * sessionId=seq(시퀀스라 고유), sessionNo='YYYY-MM-DD-seq'로 매핑한다.
   * 세션이 없으면 null(컨트롤러는 200 + null).
   */
  async getActiveSession(company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { status: 'IN_PROGRESS', invType: 'PRODUCT' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where, order: { createdAt: 'DESC' } });
    if (!session) return null;

    let warehouseName = '전체 창고';
    if (session.warehouseCode) {
      const wh = await this.warehouseRepository.findOne({
        where: { warehouseCode: session.warehouseCode, ...this.tenantWhere(company, plant) },
      });
      warehouseName = wh?.warehouseName ?? session.warehouseCode;
    }

    const dateStr = this.formatSessionDate(session.sessionDate);
    return {
      sessionId: session.seq,
      sessionNo: `${dateStr}-${session.seq}`,
      warehouseName,
      countMonth: session.countMonth,
      status: session.status,
    };
  }

  /**
   * 제품 실사 세션 개시 (invType='PRODUCT')
   * 이미 진행 중인 PRODUCT 세션이 있으면 BadRequestException.
   * 검증 + SEQ + INSERT 를 한 트랜잭션에 묶어 race 를 막는다.
   */
  async startSession(
    dto: StartProductPhysicalInvSessionDto,
    company?: string,
    plant?: string,
    actor?: string,
  ): Promise<PhysicalInvSession> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.tx.run<PhysicalInvSession>(async (queryRunner) => {
      const existing = await queryRunner.manager.findOne(PhysicalInvSession, {
        where: { status: 'IN_PROGRESS', invType: 'PRODUCT', ...(company && { company }), ...(plant && { plant }) },
      });
      if (existing) {
        throw new BadRequestException(
          `이미 진행 중인 제품 재고실사 세션이 있습니다. (${this.formatSessionDate(existing.sessionDate)}-${existing.seq})`,
        );
      }

      const seqResult = await queryRunner.manager.query(
        `SELECT SEQ_PHYSICAL_INV_SESSIONS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const nextSeq = seqResult[0].nextSeq;

      const session = queryRunner.manager.create(PhysicalInvSession, {
        sessionDate: today,
        seq: nextSeq,
        invType: 'PRODUCT',
        countMonth: dto.countMonth,
        status: 'IN_PROGRESS',
        warehouseCode: dto.warehouseCode ?? null,
        company: company ?? null,
        plant: plant ?? null,
        startedBy: dto.startedBy ?? actor ?? null,
        remark: dto.remark ?? null,
      } as Partial<PhysicalInvSession>);

      try {
        return await queryRunner.manager.save(PhysicalInvSession, session);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('ORA-00001')) {
          throw new BadRequestException(
            '동시 다른 사용자가 이미 제품 재고실사 세션을 시작했습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
        throw error;
      }
    });
  }

  /**
   * 현재 제품 실사 세션 상태 조회 (IN_PROGRESS & invType='PRODUCT')
   */
  async getSessionStatus(company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { status: 'IN_PROGRESS', invType: 'PRODUCT' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where, order: { createdAt: 'DESC' } });
    return {
      isFreeze: !!session,
      session: session ?? null,
    };
  }

  /**
   * 진행 중 제품 실사 세션을 sessionId(=seq)로 찾는다.
   */
  private async findActiveSessionBySeq(sessionId: number, company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { seq: sessionId, invType: 'PRODUCT' };
    if (company) where.company = company;
    if (plant) where.plant = plant;
    return this.sessionRepository.findOne({ where });
  }

  /**
   * PDA: 제품 바코드(시리얼) 스캔 → 실사수량 +1 (비파괴, COUNT_DETAILS 집계만)
   *
   * 바코드 해석:
   * 1. barcode = FG_LABELS.FG_BARCODE → itemCode 조회 (못 찾으면 NotFound)
   * 2. PRODUCT_STOCKS 에서 (company,plant,itemCode) 로 재고 행 조회 → warehouseCode/systemQty 해석
   *    - 세션 창고가 지정돼 있으면 해당 창고 재고를 우선, 없으면 첫 재고 행
   * 3. 세션 창고와 불일치 시 에러
   * 4. PHYSICAL_INV_COUNT_DETAILS upsert(+1). MAT_UID 컬럼에 제품 시리얼(FG_BARCODE)을 저장
   */
  async scanCount(dto: ScanProductCountDto, company?: string, plant?: string) {
    const { sessionId, barcode, countedBy } = dto;

    const session = await this.findActiveSessionBySeq(sessionId, company, plant);
    if (!session) {
      throw new NotFoundException(`진행 중인 제품 실사 세션을 찾을 수 없습니다. (sessionId=${sessionId})`);
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`진행 중인 제품 실사 세션이 아닙니다. (현재 상태: ${session.status})`);
    }

    // 1) 바코드 → 제품 라벨(FG_LABELS) → itemCode
    const label = await this.fgLabelRepository.findOne({
      where: { fgBarcode: barcode, ...this.tenantWhere(company, plant) },
    });
    if (!label) {
      throw new NotFoundException(`존재하지 않는 제품 바코드입니다: ${barcode}`);
    }
    const itemCode = label.itemCode;

    // 2) PRODUCT_STOCKS 에서 itemCode 로 창고/시스템수량 해석
    const stockWhere: FindOptionsWhere<ProductStock> = {
      itemCode,
      ...this.tenantWhere(company, plant),
      ...(session.warehouseCode ? { warehouseCode: session.warehouseCode } : {}),
    };
    const stock = await this.stockRepository.findOne({ where: stockWhere });
    if (!stock) {
      throw new NotFoundException(
        `제품 재고를 찾을 수 없습니다: ${itemCode}` +
          (session.warehouseCode ? ` (창고: ${session.warehouseCode})` : ''),
      );
    }
    if (session.warehouseCode && stock.warehouseCode !== session.warehouseCode) {
      throw new BadRequestException(
        `실사 세션 창고(${session.warehouseCode})와 스캔 재고 창고(${stock.warehouseCode})가 일치하지 않습니다.`,
      );
    }

    // 3) 품목명 조회
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
    });
    const itemName = part?.itemName ?? '';

    // 4) PHYSICAL_INV_COUNT_DETAILS upsert (+1) — MAT_UID 에 제품 시리얼(FG_BARCODE) 저장
    const detailKey = {
      sessionDate: session.sessionDate,
      seq: session.seq,
      warehouseCode: stock.warehouseCode,
      itemCode,
      matUid: barcode,
    };
    let detail = await this.countDetailRepository.findOne({ where: detailKey });
    if (detail) {
      detail.countedQty += 1;
      detail.countedBy = countedBy ?? detail.countedBy;
    } else {
      detail = this.countDetailRepository.create({
        ...detailKey,
        locationCode: stock.locationCode ?? null,
        systemQty: stock.qty,
        countedQty: 1,
        countedBy: countedBy ?? null,
      });
    }
    await this.countDetailRepository.save(detail);

    // 5) 세션 품목별 집계(items) 구성
    const items = await this.buildSessionItems(session, company, plant);

    return {
      itemCode,
      itemName,
      countedQty: detail.countedQty,
      items,
    };
  }

  /**
   * 세션의 품목별 실사 현황 집계 {itemCode,itemName,systemQty,countedQty}
   * COUNT_DETAILS 를 itemCode 단위로 합산하고, 시스템수량은 PRODUCT_STOCKS 에서 보강한다.
   */
  private async buildSessionItems(
    session: PhysicalInvSession,
    company?: string,
    plant?: string,
  ): Promise<Array<{ itemCode: string; itemName: string; systemQty: number; countedQty: number }>> {
    const details = await this.countDetailRepository.find({
      where: {
        sessionDate: session.sessionDate,
        seq: session.seq,
        ...this.tenantWhere(company, plant),
      },
    });
    if (details.length === 0) return [];

    const agg = new Map<string, { countedQty: number; systemQty: number }>();
    for (const d of details) {
      const cur = agg.get(d.itemCode);
      if (cur) {
        cur.countedQty += d.countedQty;
      } else {
        agg.set(d.itemCode, { countedQty: d.countedQty, systemQty: d.systemQty ?? 0 });
      }
    }

    const itemCodes = [...agg.keys()];
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p.itemName]));

    return itemCodes.map(itemCode => {
      const a = agg.get(itemCode)!;
      return {
        itemCode,
        itemName: partMap.get(itemCode) ?? '',
        systemQty: a.systemQty,
        countedQty: a.countedQty,
      };
    });
  }
}
