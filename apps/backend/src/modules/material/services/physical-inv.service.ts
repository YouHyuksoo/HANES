/**
 * @file src/modules/material/services/physical-inv.service.ts
 * @description ?ш퀬?ㅼ궗 鍮꾩쫰?덉뒪 濡쒖쭅 ??Stock ???+ InvAdjLog 湲곕줉 + ?ㅼ궗 ?몄뀡 愿由?
 *
 * 珥덈낫??媛?대뱶:
 * 1. startSession(): ?ㅼ궗 媛쒖떆 ??PHYSICAL_INV_SESSIONS ?뚯씠釉붿뿉 IN_PROGRESS ?덉퐫???앹꽦
 * 2. getSessionStatus(): ?ㅼ궗 ?몄뀡 ?곹깭 議고쉶 ??InventoryFreezeGuard媛 ???뚯씠釉붿쓣 李몄“
 * 3. completeSession(): ?ㅼ궗 ?꾨즺 ??status瑜?COMPLETED濡??낅뜲?댄듃 (李⑤떒 ?댁젣)
 * 4. applyCount(): ?ㅼ궗 寃곌낵 諛섏쁺 ??MatStock ?섎웾 ?낅뜲?댄듃 + InvAdjLog 湲곕줉
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like, FindOptionsWhere, QueryRunner } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { TransactionService } from '../../../shared/transaction.service';
import {
  CreatePhysicalInvDto,
  PhysicalInvQueryDto,
  PhysicalInvHistoryQueryDto,
  StartPhysicalInvSessionDto,
  CompletePhysicalInvSessionDto,
  PdaScanCountDto,
  PhysicalInvCountQueryDto,
} from '../dto/physical-inv.dto';

@Injectable()
export class PhysicalInvService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(PhysicalInvSession)
    private readonly sessionRepository: Repository<PhysicalInvSession>,
    @InjectRepository(PhysicalInvCountDetail)
    private readonly countDetailRepository: Repository<PhysicalInvCountDetail>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
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

  // ??? ?ㅼ궗 ?몄뀡 愿由?????????????????????????????????????????????????

  /**
   * ?꾩옱 ?ㅼ궗 ?몄뀡 ?곹깭 議고쉶
   * ?꾨줎?몄뿏??諛곕꼫 ?쒖떆, InventoryFreezeGuard 寃利앹뿉 ?쒖슜
   */
  async getSessionStatus(company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { status: 'IN_PROGRESS' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where });
    return {
      isFreeze: !!session,
      session: session ?? null,
    };
  }

  /**
   * ?ㅼ궗 媛쒖떆 ??IN_PROGRESS ?몄뀡 ?앹꽦
   * ?대? 吏꾪뻾 以묒씤 ?ㅼ궗媛 ?덉쑝硫?BadRequestException
   */
  async startSession(
    dto: StartPhysicalInvSessionDto,
    company?: string,
    plant?: string,
  ): Promise<PhysicalInvSession> {
    // SESSION_DATE 는 시분초 없이 날짜만 사용한다.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 동시 호출 두 건이 둘 다 IN_PROGRESS 부재를 보고 INSERT 하는 race 를 막기 위해
    // 검증 + SEQ + INSERT 를 한 트랜잭션에 묶고, DB 의 partial unique index
    // (UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS, migrations/2026-05-26_physical_inv_session_uniq.sql)
    // 위반은 BadRequestException 으로 변환한다.
    return this.tx.run<PhysicalInvSession>(async (queryRunner) => {
      const existing = await queryRunner.manager.findOne(PhysicalInvSession, {
        where: { status: 'IN_PROGRESS', ...(company && { company }), ...(plant && { plant }) },
      });
      if (existing) {
        throw new BadRequestException(
          `이미 진행 중인 재고조사 세션이 있습니다. (${existing.sessionDate}-${existing.seq})`,
        );
      }

      const seqResult = await queryRunner.manager.query(
        `SELECT SEQ_PHYSICAL_INV_SESSIONS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const nextSeq = seqResult[0].nextSeq;

      const session = queryRunner.manager.create(PhysicalInvSession, {
        sessionDate: today,
        seq: nextSeq,
        invType: dto.invType,
        countMonth: dto.countMonth,
        status: 'IN_PROGRESS',
        warehouseCode: dto.warehouseCode ?? null,
        company: company ?? null,
        plant: plant ?? null,
        startedBy: dto.startedBy ?? null,
        remark: dto.remark ?? null,
      });

      try {
        return await queryRunner.manager.save(PhysicalInvSession, session);
      } catch (error: unknown) {
        if (this.isUniqueViolation(error)) {
          throw new BadRequestException(
            '동시 다른 사용자가 이미 재고조사 세션을 시작했습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
        throw error;
      }
    });
  }

  /** Oracle 고유 제약 위반(ORA-00001) 여부 */
  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.includes('ORA-00001');
  }

  /**
   * ?ㅼ궗 ?꾨즺 ??IN_PROGRESS ??COMPLETED ?꾪솚
   * ??硫붿꽌???ㅽ뻾 ??InventoryFreezeGuard 李⑤떒???댁젣?⑸땲??
   */
  async completeSession(
    sessionDate: string,
    seq: number,
    dto: CompletePhysicalInvSessionDto,
  ): Promise<PhysicalInvSession> {
    // Oracle DATE 鍮꾧탳 ??踰붿쐞 議곌굔?쇰줈 ?몃뜳???쒖슜 (TRUNC ?쒓굅)
    const sdStart = new Date(`${sessionDate}T00:00:00`);
    const sdEnd = new Date(`${sessionDate}T23:59:59.999`);
    const session = await this.sessionRepository
      .createQueryBuilder('s')
      .where('s.sessionDate >= :sdStart AND s.sessionDate < :sdEnd', {
        sdStart,
        sdEnd: new Date(sdEnd.getTime() + 1),
      })
      .andWhere('s.seq = :seq', { seq })
      .getOne();
    if (!session) {
      throw new NotFoundException(`?ㅼ궗 ?몄뀡??李얠쓣 ???놁뒿?덈떎. (${sessionDate}-${seq})`);
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`吏꾪뻾 以묒씤 ?ㅼ궗 ?몄뀡???꾨떃?덈떎. (?꾩옱 ?곹깭: ${session.status})`);
    }

    session.status = 'COMPLETED';
    session.completedBy = dto.completedBy ?? null;
    session.completedAt = new Date();
    if (dto.remark) session.remark = dto.remark;

    return this.sessionRepository.save(session);
  }

  async findStocks(query: PhysicalInvQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, warehouseId } = query;
    const skip = (page - 1) * limit;

    const qb = this.matStockRepository.createQueryBuilder('stock');
    if (company) qb.andWhere('stock.company = :company', { company });
    if (plant) qb.andWhere('stock.plant = :plant', { plant });
    if (warehouseId) qb.andWhere('stock.warehouseCode = :warehouseId', { warehouseId });

    // 寃?됱뼱媛 ?덉쑝硫?DB?먯꽌 ?꾪꽣 (硫붾え由??꾪꽣 ?쒓굅)
    if (search) {
      const upper = search.toUpperCase();
      qb.leftJoin(PartMaster, 'part', 'part.itemCode = stock.itemCode AND part.company = stock.company AND part.plant = stock.plant')
        .andWhere(
          '(stock.itemCode LIKE :search OR part.itemName LIKE :searchRaw)',
          { search: `%${upper}%`, searchRaw: `%${search}%` },
        );
    }

    qb.orderBy('stock.updatedAt', 'DESC');

    const [data, total] = await Promise.all([
      qb.clone().skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    // part, lot ?뺣낫 議고쉶
    const itemCodes = data.map((stock) => stock.itemCode).filter(Boolean);
    const matUids = data.map((stock) => stock.matUid).filter(Boolean) as string[];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    const [parts, lots] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const result = data.map((stock) => {
      const part = partMap.get(stock.itemCode);
      const lot = stock.matUid ? lotMap.get(stock.matUid) : null;
      return {
        ...stock,
        itemCode: stock.itemCode,
        itemName: part?.itemName ?? null,
        matUid: stock.matUid,
      };
    });

    return { data: result, total, page, limit };
  }

  async findHistory(query: PhysicalInvHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, warehouseCode, startDate, endDate } = query;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(PartMaster, 'part', 'part.itemCode = log.itemCode AND part.company = log.company AND part.plant = log.plant')
      .leftJoin(MatLot, 'lot', 'lot.matUid = log.matUid AND lot.company = log.company AND lot.plant = log.plant')
      .select([
        'log.adjDate AS "adjDate"',
        'log.seq AS "seq"',
        'log.warehouseCode AS "warehouseCode"',
        'log.itemCode AS "itemCode"',
        'part.itemCode AS "itemCode"',
        'part.itemName AS "itemName"',
        'part.unit AS "unit"',
        'log.matUid AS "matUid"',
        'lot.matUid AS "matUid"',
        'log.beforeQty AS "beforeQty"',
        'log.afterQty AS "afterQty"',
        'log.diffQty AS "diffQty"',
        'log.reason AS "reason"',
        'log.createdBy AS "createdBy"',
        'log.createdAt AS "createdAt"',
      ])
      .where('log.adjType = :adjType', { adjType: 'PHYSICAL_COUNT' });

    if (company) qb.andWhere('log.company = :company', { company });
    if (plant) qb.andWhere('log.plant = :plant', { plant });

    if (warehouseCode) {
      qb.andWhere('log.warehouseCode = :warehouseCode', { warehouseCode });
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      qb.andWhere('log.createdAt < :endDate', { endDate: end });
    }
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(part.itemCode LIKE :search OR part.itemName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return { data, total, page, limit };
  }

  // ??? PDA ?꾩슜 API ?????????????????????????????????????????????????

  /**
   * PDA?????쒖꽦 ?ㅼ궗 ?몄뀡 議고쉶 (IN_PROGRESS ?곹깭)
   * PDA ?낆뿉??留덉슫?????몄텧
   */
  async getActiveSession(company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { status: 'IN_PROGRESS', invType: 'MATERIAL' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where, order: { createdAt: 'DESC' } });
    if (!session) return null;

    // 李쎄퀬紐?議고쉶
    let warehouseName = '';
    if (session.warehouseCode) {
      const wh = await this.warehouseRepository.findOne({
        where: { warehouseCode: session.warehouseCode, ...this.tenantWhere(company, plant) },
      });
      warehouseName = wh?.warehouseName ?? session.warehouseCode;
    } else {
      warehouseName = '?꾩껜 李쎄퀬';
    }

    // sessionDate瑜?YYYY-MM-DD 臾몄옄?대줈 蹂??(??꾩〈 ?댁뒋 諛⑹?)
    const dateStr = session.sessionDate instanceof Date
      ? session.sessionDate.toISOString().split('T')[0]
      : String(session.sessionDate).split('T')[0];

    return {
      sessionDate: dateStr,
      seq: session.seq,
      sessionNo: `${dateStr}-${session.seq}`,
      warehouseCode: session.warehouseCode,
      warehouseName,
      countMonth: session.countMonth,
      status: session.status,
    };
  }

  /**
   * PDA????濡쒖??댁뀡蹂??덈ぉ ?꾪솴 議고쉶
   * ?대떦 ?몄뀡 + 濡쒖??댁뀡??MatStock 紐⑸줉 + 湲곗〈 移댁슫???곸꽭 JOIN
   */
  async getLocationItems(
    sessionDate: string,
    seq: number,
    locationCode: string,
    company?: string,
    plant?: string,
  ) {
    const where: FindOptionsWhere<MatStock> = { locationCode };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const stocks = await this.matStockRepository.find({ where });
    const itemCodes = stocks.map(s => s.itemCode).filter(Boolean);

    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 湲곗〈 移댁슫???곸꽭 議고쉶
    const details = await this.countDetailRepository.find({
      where: {
        sessionDate: new Date(sessionDate),
        seq,
        locationCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const detailMap = new Map(
      details.map(d => [`${d.warehouseCode}::${d.itemCode}::${d.matUid}`, d]),
    );

    return stocks.map(stock => {
      const part = partMap.get(stock.itemCode);
      const detail = detailMap.get(`${stock.warehouseCode}::${stock.itemCode}::${stock.matUid}`);
      return {
        itemCode: stock.itemCode,
        itemName: part?.itemName ?? '',
        unit: part?.unit ?? '',
        systemQty: stock.qty,
        countedQty: detail?.countedQty ?? 0,
      };
    });
  }

  /**
   * PDA????諛붿퐫???ㅼ틪 ???ㅼ궗?섎웾 +1
   * PHYSICAL_INV_COUNT_DETAILS ?뚯씠釉붿뿉 INSERT or UPDATE
   */
  async scanCount(dto: PdaScanCountDto, company?: string, plant?: string) {
    const { sessionDate, seq, locationCode, barcode, countedBy } = dto;

    const sessionStart = new Date(`${sessionDate}T00:00:00`);
    const sessionEnd = new Date(`${sessionDate}T23:59:59.999`);
    const sessionQb = this.sessionRepository
      .createQueryBuilder('s')
      .where('s.sessionDate >= :sessionStart AND s.sessionDate < :sessionEnd', {
        sessionStart,
        sessionEnd: new Date(sessionEnd.getTime() + 1),
      })
      .andWhere('s.seq = :seq', { seq });

    if (company) sessionQb.andWhere('s.company = :company', { company });
    if (plant) sessionQb.andWhere('s.plant = :plant', { plant });

    const session = await sessionQb.getOne();
    if (!session) {
      throw new NotFoundException(`?? ??? ?? ? ????. (${sessionDate}-${seq})`);
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `?? ?? ?? ??? ????. (?? ??: ${session.status})`,
      );
    }

    // lot + stock + part瑜?JOIN 1?뚮줈 議고쉶 (湲곗〈 4????1??
    const qb = this.matStockRepository
      .createQueryBuilder('s')
      .innerJoin('MAT_LOTS', 'l', 's.itemCode = l.ITEM_CODE AND s.matUid = l.MAT_UID AND s.company = l.COMPANY AND s.plant = l.PLANT_CD')
      .leftJoin('ITEM_MASTERS', 'p', 's.itemCode = p.ITEM_CODE AND s.company = p.COMPANY AND s.plant = p.PLANT_CD')
      .select([
        's.warehouseCode AS "warehouseCode"',
        's.itemCode AS "itemCode"',
        's.locationCode AS "locationCode"',
        's.matUid AS "matUid"',
        's.qty AS "qty"',
        'p.ITEM_NAME AS "itemName"',
      ])
      .where('l.MAT_UID = :barcode', { barcode });
    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });

    const row = await qb.getRawOne();
    if (!row) {
      throw new NotFoundException(`?먯옱?쒕━???먮뒗 ?ш퀬瑜?李얠쓣 ???놁뒿?덈떎: ${barcode}`);
    }
    if (session.warehouseCode && row.warehouseCode !== session.warehouseCode) {
      throw new BadRequestException(
        `실사 세션 창고(${session.warehouseCode})와 스캔 재고 창고(${row.warehouseCode})가 일치하지 않습니다.`,
      );
    }
    if (row.locationCode !== locationCode) {
      throw new BadRequestException(
        `요청 로케이션(${locationCode})과 재고 로케이션(${row.locationCode})이 일치하지 않습니다.`,
      );
    }

    // 移댁슫???곸꽭 UPSERT
    const detailKey = {
      sessionDate: new Date(sessionDate),
      seq,
      warehouseCode: row.warehouseCode,
      itemCode: row.itemCode,
      matUid: row.matUid,
    };
    let detail = await this.countDetailRepository.findOne({ where: detailKey });

    if (detail) {
      detail.countedQty += 1;
      detail.countedBy = countedBy ?? detail.countedBy;
    } else {
      detail = this.countDetailRepository.create({
        ...detailKey,
        locationCode,
        systemQty: row.qty,
        countedQty: 1,
        countedBy: countedBy ?? null,
      });
    }
    await this.countDetailRepository.save(detail);

    return {
      itemCode: row.itemCode,
      itemName: row.itemName ?? '',
      countedQty: detail.countedQty,
    };
  }

  // ??? PC ?????몄뀡蹂??ㅼ궗?섎웾 議고쉶 ????????????????????????????????

  /**
   * PC ?뱀뿉??PDA媛 ??ν븳 ?ㅼ궗?섎웾??議고쉶
   * ?몄뀡(湲곗??꾩썡) 湲곕컲?쇰줈 MatStock + CountDetail JOIN
   */
  async findStocksWithCounts(query: PhysicalInvCountQueryDto, company?: string, plant?: string) {
    const { countMonth, warehouseCode, search, limit = 5000 } = query;

    // ?대떦 湲곗??꾩썡??紐⑤뱺 ?몄뀡 李얘린
    let sessions: PhysicalInvSession[] = [];
    if (countMonth) {
      const sessionWhere: FindOptionsWhere<PhysicalInvSession> = { countMonth };
      if (company) sessionWhere.company = company;
      if (plant) sessionWhere.plant = plant;
      sessions = await this.sessionRepository.find({
        where: sessionWhere,
        order: { createdAt: 'DESC' },
      });
    }

    // 吏꾪뻾 以??몄뀡 (?ㅼ궗 媛쒖떆/?꾨즺 ?먮떒??
    const activeSession = sessions.find(s => s.status === 'IN_PROGRESS') ?? null;

    // ?ш퀬 紐⑸줉 議고쉶 (寃?됱뼱 ?꾪꽣瑜?DB濡??대룞)
    const stockQb = this.matStockRepository.createQueryBuilder('stock');
    if (company) stockQb.andWhere('stock.company = :company', { company });
    if (plant) stockQb.andWhere('stock.plant = :plant', { plant });
    if (warehouseCode) stockQb.andWhere('stock.warehouseCode = :warehouseCode', { warehouseCode });

    if (search) {
      const upper = search.toUpperCase();
      stockQb.leftJoin(PartMaster, 'sp', 'sp.itemCode = stock.itemCode AND sp.company = stock.company AND sp.plant = stock.plant')
        .andWhere(
          '(stock.itemCode LIKE :search OR sp.itemName LIKE :searchRaw)',
          { search: `%${upper}%`, searchRaw: `%${search}%` },
        );
    }

    const stocks = await stockQb
      .orderBy('stock.updatedAt', 'DESC')
      .take(limit)
      .getMany();

    // ?덈ぉ ?뺣낫
    const itemCodes = [...new Set(stocks.map(s => s.itemCode).filter(Boolean))];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 李쎄퀬紐?議고쉶
    const whCodes = [...new Set(stocks.map(s => s.warehouseCode).filter(Boolean))];
    const warehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes), ...tenantWhere } })
      : [];
    const whMap = new Map(warehouses.map(w => [w.warehouseCode, w.warehouseName]));

    // ?대떦 ?붿쓽 紐⑤뱺 ?몄뀡 PDA ?ㅼ궗?섎웾 議고쉶 (?섎웾 + ?ㅼ틪 ?쒓컙)
    const detailMap = new Map<string, { countedQty: number; countedAt: Date | null }>();
    if (sessions.length > 0) {
      const allDetails = await this.countDetailRepository.find({
        where: sessions.map(s => ({
          sessionDate: s.sessionDate,
          seq: s.seq,
          ...(s.company ? { company: s.company } : tenantWhere.company ? { company: tenantWhere.company } : {}),
          ...(s.plant ? { plant: s.plant } : tenantWhere.plant ? { plant: tenantWhere.plant } : {}),
        })),
      });
      for (const d of allDetails) {
        const key = `${d.warehouseCode}::${d.itemCode}::${d.matUid}`;
        const existing = detailMap.get(key);
        if (existing) {
          existing.countedQty += d.countedQty;
          if (d.updatedAt && (!existing.countedAt || d.updatedAt > existing.countedAt)) {
            existing.countedAt = d.updatedAt;
          }
        } else {
          detailMap.set(key, { countedQty: d.countedQty, countedAt: d.updatedAt ?? null });
        }
      }
    }

    const result = stocks.map(stock => {
      const part = partMap.get(stock.itemCode);
      const key = `${stock.warehouseCode}::${stock.itemCode}::${stock.matUid}`;
      const detail = detailMap.get(key);
      return {
        id: key,
        warehouseCode: stock.warehouseCode,
        warehouseName: whMap.get(stock.warehouseCode) ?? stock.warehouseCode,
        itemCode: stock.itemCode,
        itemName: part?.itemName ?? '',
        matUid: stock.matUid,
        unit: part?.unit ?? '',
        qty: stock.qty,
        countedQty: detail?.countedQty ?? null,
        countedAt: detail?.countedAt ?? null,
        lastCountAt: stock.lastCountAt,
      };
    });

    // ?몄뀡 紐⑸줉 吏곷젹??
    const formatDate = (d: Date | string) =>
      d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];

    const sessionList = sessions.map(s => ({
      sessionDate: formatDate(s.sessionDate),
      seq: s.seq,
      countMonth: s.countMonth,
      status: s.status,
      warehouseCode: s.warehouseCode,
    }));

    return {
      data: result,
      total: result.length,
      sessions: sessionList,
      activeSession: activeSession ? {
        sessionDate: formatDate(activeSession.sessionDate),
        seq: activeSession.seq,
        countMonth: activeSession.countMonth,
        status: activeSession.status,
        warehouseCode: activeSession.warehouseCode,
      } : null,
    };
  }

  /**
   * ?ㅼ궗 諛섏쁺 ??遺덉씪移???ぉ留?異쒓퀬/?낃퀬 ?몃옖??뀡?쇰줈 ?ш퀬 議곗젙
   *
   * 遺議??쒖뒪??> ?ㅼ궗): PHYSCOUNT_OUT 異쒓퀬 ?몃옖??뀡 ???ш퀬 媛먯냼
   * 怨쇱엵(?ㅼ궗 > ?쒖뒪??: PHYSCOUNT_IN ?낃퀬 ?몃옖??뀡 ???ш퀬 利앷?
   * ?쇱튂(李⑥씠=0): ?ㅽ궢
   */
  async applyCount(dto: CreatePhysicalInvDto, company?: string, plant?: string) {
    const { items, createdBy } = dto;
    const uniqueStockIds = new Set(items.map((item) => item.stockId));
    if (uniqueStockIds.size !== items.length) {
      throw new BadRequestException('동일 stockId가 실사 반영 요청에 중복 포함되어 있습니다.');
    }

    const activeSession = await this.sessionRepository.findOne({
      where: { status: 'IN_PROGRESS', ...(company && { company }), ...(plant && { plant }) },
      order: { createdAt: 'DESC' },
    });

    if (!activeSession) {
      throw new BadRequestException('?? ?? ???? ??? ?? ?? ??? ? ? ????.');
    }
    this.assertSameTenant('실사 세션', activeSession, company, plant);

    return this.tx.run(async (queryRunner) => {
      // IN 諛곗튂 ?좎“?뚮줈 N+1 諛⑹? ??stockId ?뚯떛 ???쇨큵 議고쉶
      const stockKeys = items.map((item) => {
        const [whCode, itCode, ltNo] = item.stockId.split('::');
        return { warehouseCode: whCode, itemCode: itCode, matUid: ltNo || '' };
      });
      const tenantWhere = this.tenantWhere(company, plant);
      const allStocks = stockKeys.length > 0
        ? await queryRunner.manager.find(MatStock, {
            where: stockKeys.map((k) => ({
              warehouseCode: k.warehouseCode,
              itemCode: k.itemCode,
              matUid: k.matUid,
              ...tenantWhere,
            })),
          })
        : [];
      const stockMap = new Map(
        allStocks.map((s) => [`${s.warehouseCode}::${s.itemCode}::${s.matUid}`, s] as const),
      );

      const results = [];

      for (const item of items) {
        const [whCode, itCode, ltNo] = item.stockId.split('::');
        const stock = stockMap.get(`${whCode}::${itCode}::${ltNo || ''}`) ?? null;

        if (!stock) {
          throw new NotFoundException(`?ш퀬瑜?李얠쓣 ???놁뒿?덈떎: ${item.stockId}`);
        }
        this.assertSameTenant('실사 대상 재고', stock, company, plant);
        if (activeSession.warehouseCode && stock.warehouseCode !== activeSession.warehouseCode) {
          throw new BadRequestException(
            `실사 세션 창고(${activeSession.warehouseCode})와 반영 대상 창고(${stock.warehouseCode})가 일치하지 않습니다: ${item.stockId}`,
          );
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;
        const reservedQty = stock.reservedQty ?? 0;

        if (afterQty < reservedQty) {
          throw new BadRequestException(
            `?ㅼ궗 諛섏쁺 ?섎웾(${afterQty})???덉빟?섎웾(${reservedQty})蹂대떎 ?묒븘 諛섏쁺?????놁뒿?덈떎: ${item.stockId}`,
          );
        }

        // ?쇱튂 ??ぉ? ?ㅽ궢
        if (diffQty === 0) continue;

        // 1) MatStock ?낅뜲?댄듃
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
          { qty: afterQty, availableQty: afterQty - reservedQty, lastCountAt: new Date() },
        );

        // 2) StockTransaction ?앹꽦 (異쒓퀬 ?먮뒗 ?낃퀬 ?몃옖??뀡)
        const transNo = await this.generatePhysCountTransNo(queryRunner);
        const stockTransaction = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: diffQty > 0 ? 'PHYSCOUNT_IN' : 'PHYSCOUNT_OUT',
          transDate: new Date(),
          fromWarehouseId: diffQty < 0 ? stock.warehouseCode : null,
          toWarehouseId: diffQty > 0 ? stock.warehouseCode : null,
          itemCode: stock.itemCode,
          matUid: stock.matUid || null,
          qty: Math.abs(diffQty),
          refType: 'PHYSICAL_COUNT',
          refId: item.stockId,
          remark: item.remark || '?ш퀬?ㅼ궗 議곗젙',
          status: 'DONE',
          createdBy,
          company: stock.company,
          plant: stock.plant,
        });
        await queryRunner.manager.save(stockTransaction);

        // 4) InvAdjLog 湲곕줉 (?대젰 異붿쟻??
        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.matUid,
          adjType: 'PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          reason: item.remark || '?ш퀬?ㅼ궗 議곗젙',
          createdBy,
          company: stock.company,
          plant: stock.plant,
        });
        const savedLog = await queryRunner.manager.save(invAdjLog);
        results.push(savedLog);
      }

      return results;
    });
  }

  /** ?ㅼ궗 ?몃옖??뀡 踰덊샇 梨꾨쾲 (PHCyyyyMMdd + 4?먮━ seq) */
  private async generatePhysCountTransNo(queryRunner?: QueryRunner): Promise<string> {
    const today = new Date();
    const prefix = `PHC${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const repo = queryRunner?.manager?.getRepository(StockTransaction) ?? this.dataSource.getRepository(StockTransaction);
    const lastTrans = await repo.findOne({
      where: { transNo: Like(`${prefix}%`) },
      order: { transNo: 'DESC' },
    });

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
