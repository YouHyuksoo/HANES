/**
 * @file src/modules/material/services/physical-inv.service.ts
 * @description 재고실사 비즈니스 로직 - Stock 갱신 + InvAdjLog 기록 + 실사 세션 관리
 *
 * 초보자 가이드:
 * 1. startSession(): 실사 개시 시 PHYSICAL_INV_SESSIONS 테이블에 IN_PROGRESS 레코드 생성
 * 2. getSessionStatus(): 실사 세션 상태 조회 — InventoryFreezeGuard가 이 테이블을 참조
 * 3. completeSession(): 실사 완료 시 status를 COMPLETED로 업데이트 (차단 해제)
 * 4. applyCount(): 실사 결과 반영 시 MatStock 수량 업데이트 + InvAdjLog 기록
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like, FindOptionsWhere, QueryRunner } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';
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
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
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

  // ─── 실사 세션 관리 ───────────────────────────────────────────────

  /**
   * 현재 실사 세션 상태 조회
   * 프론트엔드 배너 표시, InventoryFreezeGuard 검증에 사용
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
   * 실사 개시 시 IN_PROGRESS 세션 생성
   * 이미 진행 중인 실사가 있으면 BadRequestException
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
   * 실사 완료 시 IN_PROGRESS → COMPLETED 전환
   * 이 메서드 실행 시 InventoryFreezeGuard 차단이 해제됩니다.
   */
  async completeSession(
    sessionDate: string,
    seq: number,
    dto: CompletePhysicalInvSessionDto,
  ): Promise<PhysicalInvSession> {
    // Oracle DATE 비교 시 범위 조건으로 인덱스 사용 (TRUNC 제거)
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
      throw new NotFoundException(`실사 세션을 찾을 수 없습니다. (${sessionDate}-${seq})`);
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`진행 중인 실사 세션이 아닙니다. (현재 상태: ${session.status})`);
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

    // 검색어가 있으면 DB에서 필터 (메모리 필터 제거)
    if (search) {
      const upper = search.toUpperCase();
      qb.leftJoin(ItemMaster, 'part', 'part.itemCode = stock.itemCode AND part.company = stock.company AND part.plant = stock.plant')
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

    // part, lot 정보 조회
    const itemCodes = data.map((stock) => stock.itemCode).filter(Boolean);
    const matUids = data.map((stock) => stock.matUid).filter(Boolean) as string[];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    const [parts, lots] = await Promise.all([
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
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
    const { page = 1, limit = 50, search, warehouseCode, fromDate, toDate } = query;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(ItemMaster, 'part', 'part.itemCode = log.itemCode AND part.company = log.company AND part.plant = log.plant')
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
    if (fromDate) {
      qb.andWhere("log.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      qb.andWhere("log.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
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

  // ─── PDA 전용 API ─────────────────────────────────────────────────

  /**
   * PDA용 활성 실사 세션 조회 (IN_PROGRESS 상태)
   * PDA 앱에서 마운트 시 호출
   */
  async getActiveSession(company?: string, plant?: string) {
    const where: FindOptionsWhere<PhysicalInvSession> = { status: 'IN_PROGRESS', invType: 'MATERIAL' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where, order: { createdAt: 'DESC' } });
    if (!session) return null;

    // 창고명 조회
    let warehouseName = '';
    if (session.warehouseCode) {
      const wh = await this.warehouseRepository.findOne({
        where: { warehouseCode: session.warehouseCode, ...this.tenantWhere(company, plant) },
      });
      warehouseName = wh?.warehouseName ?? session.warehouseCode;
    } else {
      warehouseName = '전체 창고';
    }

    // sessionDate를 YYYY-MM-DD 문자열로 변환 (타임존 이슈 방지)
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
   * PDA용 로케이션별 품목 현황 조회
   * 해당 세션 + 로케이션의 MatStock 목록 + 기존 카운트 상세 JOIN
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
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 기존 카운트 상세 조회
    const details = await this.countDetailRepository.find({
      where: {
        sessionDate: parseDateStart(sessionDate)!,
        seq,
        locationCode,
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
   * PDA용 바코드 스캔 시 실사수량 +1
   * PHYSICAL_INV_COUNT_DETAILS 테이블에 INSERT or UPDATE
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
      throw new NotFoundException(`실사 세션을 찾을 수 없습니다. (${sessionDate}-${seq})`);
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `진행 중인 실사 세션이 아닙니다. (현재 상태: ${session.status})`,
      );
    }

    // lot + stock + part를 JOIN 1번으로 조회 (기존 4번 → 1번)
    const qb = this.matStockRepository
      .createQueryBuilder('s')
      .innerJoin('MAT_LOTS', 'l', 's.ITEM_CODE = l.ITEM_CODE AND s.MAT_UID = l.MAT_UID AND s.COMPANY = l.COMPANY AND s.PLANT_CD = l.PLANT_CD')
      .leftJoin('ITEM_MASTERS', 'p', 's.ITEM_CODE = p.ITEM_CODE AND s.COMPANY = p.COMPANY AND s.PLANT_CD = p.PLANT_CD')
      .select([
        's.WAREHOUSE_CODE AS "warehouseCode"',
        's.ITEM_CODE AS "itemCode"',
        's.LOCATION_CODE AS "locationCode"',
        's.MAT_UID AS "matUid"',
        's.QTY AS "qty"',
        'p.ITEM_NAME AS "itemName"',
      ])
      .where('l.MAT_UID = :barcode', { barcode });
    if (company) qb.andWhere('s.COMPANY = :company', { company });
    if (plant) qb.andWhere('s.PLANT_CD = :plant', { plant });

    const row = await qb.getRawOne();
    if (!row) {
      throw new NotFoundException(`해당 시리얼 또는 재고를 찾을 수 없습니다: ${barcode}`);
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

    // 카운트 상세 UPSERT
    const detailKey = {
      sessionDate: parseDateStart(sessionDate)!,
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

  // ─── PC 화면용 세션별 실사수량 조회 ───────────────────────────────

  /**
   * PC 화면에서 PDA가 저장한 실사수량을 조회
   * 세션(기준연월) 기반으로 MatStock + CountDetail JOIN
   */
  async findStocksWithCounts(query: PhysicalInvCountQueryDto, company?: string, plant?: string) {
    const { countMonth, warehouseCode, search, limit = 5000 } = query;

    // 해당 기준연월의 모든 세션 찾기
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

    // 진행 중 세션 (실사 개시/완료 판단용)
    const activeSession = sessions.find(s => s.status === 'IN_PROGRESS') ?? null;

    // 재고 목록 조회 (검색어 필터를 DB로 이동)
    const stockQb = this.matStockRepository.createQueryBuilder('stock');
    if (company) stockQb.andWhere('stock.company = :company', { company });
    if (plant) stockQb.andWhere('stock.plant = :plant', { plant });
    if (warehouseCode) stockQb.andWhere('stock.warehouseCode = :warehouseCode', { warehouseCode });

    if (search) {
      const upper = search.toUpperCase();
      stockQb.leftJoin(ItemMaster, 'sp', 'sp.itemCode = stock.itemCode AND sp.company = stock.company AND sp.plant = stock.plant')
        .andWhere(
          '(stock.itemCode LIKE :search OR sp.itemName LIKE :searchRaw)',
          { search: `%${upper}%`, searchRaw: `%${search}%` },
        );
    }

    const stocks = await stockQb
      .orderBy('stock.updatedAt', 'DESC')
      .take(limit)
      .getMany();

    // 품목 정보
    const itemCodes = [...new Set(stocks.map(s => s.itemCode).filter(Boolean))];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 창고명 조회
    const whCodes = [...new Set(stocks.map(s => s.warehouseCode).filter(Boolean))];
    const warehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes), ...tenantWhere } })
      : [];
    const whMap = new Map(warehouses.map(w => [w.warehouseCode, w.warehouseName]));

    // 해당 월의 모든 세션 PDA 실사수량 조회 (수량 + 스캔 시각)
    const detailMap = new Map<string, { countedQty: number; countedAt: Date | null }>();
    if (sessions.length > 0) {
      const allDetails = await this.countDetailRepository.find({
        where: sessions.map(s => ({
          sessionDate: s.sessionDate,
          seq: s.seq,
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

    // 세션 목록 직렬화
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
   * 실사 반영 시 불일치 항목만 출고/입고 트랜잭션으로 재고 조정
   *
   * 부족(시스템 > 실사): PHYSCOUNT_OUT 출고 트랜잭션 → 재고 감소
   * 과잉(실사 > 시스템): PHYSCOUNT_IN 입고 트랜잭션 → 재고 증가
   * 일치(차이=0): 스킵
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
      throw new BadRequestException('진행 중인 실사 세션이 없어 반영할 수 없습니다.');
    }
    this.assertSameTenant('실사 세션', activeSession, company, plant);

    return this.tx.run(async (queryRunner) => {
      // IN 배치 조회로 N+1 방지 — stockId 분해 후 일괄 조회
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
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
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
            `실사 반영 수량(${afterQty})이 예약수량(${reservedQty})보다 적어 반영할 수 없습니다: ${item.stockId}`,
          );
        }

        // 일치 항목은 스킵
        if (diffQty === 0) continue;

        // 1) MatStock 업데이트
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
          { qty: afterQty, availableQty: afterQty - reservedQty, lastCountAt: new Date() },
        );

        // 2) StockTransaction 생성 (출고 또는 입고 트랜잭션)
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
          remark: item.remark || '재고실사 조정',
          status: 'DONE',
          createdBy,
          company: stock.company,
          plant: stock.plant,
        });
        await queryRunner.manager.save(stockTransaction);

        // 4) InvAdjLog 기록 (이력 추적용)
        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.matUid,
          adjType: 'PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          reason: item.remark || '재고실사 조정',
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

  /** 실사 트랜잭션 번호 채번 (PHCyyyyMMdd + 4자리 seq) */
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
