/**
 * @file src/modules/material/services/physical-inv.service.ts
 * @description 재고실사 비즈니스 로직 — Stock 대사 + InvAdjLog 기록 + 실사 세션 관리
 *
 * 초보자 가이드:
 * 1. startSession(): 실사 개시 — PHYSICAL_INV_SESSIONS 테이블에 IN_PROGRESS 레코드 생성
 * 2. getSessionStatus(): 실사 세션 상태 조회 — InventoryFreezeGuard가 이 테이블을 참조
 * 3. completeSession(): 실사 완료 — status를 COMPLETED로 업데이트 (차단 해제)
 * 4. applyCount(): 실사 결과 반영 — MatStock 수량 업데이트 + InvAdjLog 기록
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
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
  ) {}

  // ─── 실사 세션 관리 ────────────────────────────────────────────────

  /**
   * 현재 실사 세션 상태 조회
   * 프론트엔드 배너 표시, InventoryFreezeGuard 검증에 활용
   */
  async getSessionStatus(company?: string, plant?: string) {
    const where: any = { status: 'IN_PROGRESS' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where });
    return {
      isFreeze: !!session,
      session: session ?? null,
    };
  }

  /**
   * 실사 개시 — IN_PROGRESS 세션 생성
   * 이미 진행 중인 실사가 있으면 BadRequestException
   */
  async startSession(
    dto: StartPhysicalInvSessionDto,
    company?: string,
    plant?: string,
  ): Promise<PhysicalInvSession> {
    // 이미 진행 중인 세션이 있으면 예외
    const existing = await this.sessionRepository.findOne({
      where: { status: 'IN_PROGRESS', ...(company && { company }), ...(plant && { plant }) },
    });
    if (existing) {
      throw new BadRequestException(
        `이미 진행 중인 재고실사 세션이 있습니다. (${existing.sessionDate}-${existing.seq})`,
      );
    }

    // SESSION_DATE는 시분초 없이 날짜만 저장
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 같은 날짜의 최대 seq 조회 → +1
    const maxSeqRow = await this.sessionRepository
      .createQueryBuilder('s')
      .select('MAX(s.seq)', 'maxSeq')
      .where('s.sessionDate = :today', { today })
      .getRawOne();
    const nextSeq = (maxSeqRow?.maxSeq ?? 0) + 1;

    const session = this.sessionRepository.create({
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
    return this.sessionRepository.save(session);
  }

  /**
   * 실사 완료 — IN_PROGRESS → COMPLETED 전환
   * 이 메서드 실행 후 InventoryFreezeGuard 차단이 해제됩니다.
   */
  async completeSession(
    sessionDate: string,
    seq: number,
    dto: CompletePhysicalInvSessionDto,
  ): Promise<PhysicalInvSession> {
    // 날짜를 시분초 없이 비교 (Oracle DATE 컬럼은 TRUNC된 날짜만 저장)
    const dateOnly = new Date(sessionDate);
    dateOnly.setHours(0, 0, 0, 0);
    const session = await this.sessionRepository.findOne({ where: { sessionDate: dateOnly, seq } });
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

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };
    if (warehouseId) {
      where.warehouseCode = warehouseId;
    }

    const [data, total] = await Promise.all([
      this.matStockRepository.find({
        where,
        skip,
        take: limit,
        order: { updatedAt: 'DESC' },
      }),
      this.matStockRepository.count({ where }),
    ]);

    // part, lot 정보 조회
    const itemCodes = data.map((stock) => stock.itemCode).filter(Boolean);
    const matUids = data.map((stock) => stock.matUid).filter(Boolean) as string[];

    const [parts, lots] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    let result = data.map((stock) => {
      const part = partMap.get(stock.itemCode);
      const lot = stock.matUid ? lotMap.get(stock.matUid) : null;
      return {
        ...stock,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        matUid: lot?.matUid,
      };
    });

    // 검색어 필터링
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (stock) =>
          stock.itemCode.toLowerCase().includes(searchLower) ||
          stock.itemName.toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }

  async findHistory(query: PhysicalInvHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, warehouseCode, startDate, endDate } = query;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(PartMaster, 'part', 'part.itemCode = log.itemCode')
      .leftJoin(MatLot, 'lot', 'lot.matUid = log.matUid')
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
      qb.andWhere(
        '(LOWER(part.itemCode) LIKE :search OR LOWER(part.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
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
   * PDA용 — 활성 실사 세션 조회 (IN_PROGRESS 상태)
   * PDA 훅에서 마운트 시 호출
   */
  async getActiveSession(company?: string, plant?: string) {
    const where: any = { status: 'IN_PROGRESS', invType: 'MATERIAL' };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const session = await this.sessionRepository.findOne({ where, order: { createdAt: 'DESC' } });
    if (!session) return null;

    // 창고명 조회
    let warehouseName = '';
    if (session.warehouseCode) {
      const wh = await this.warehouseRepository.findOne({
        where: { warehouseCode: session.warehouseCode },
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
   * PDA용 — 로케이션별 품목 현황 조회
   * 해당 세션 + 로케이션의 MatStock 목록 + 기존 카운트 상세 JOIN
   */
  async getLocationItems(
    sessionDate: string,
    seq: number,
    locationCode: string,
    company?: string,
    plant?: string,
  ) {
    const where: any = { locationCode };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const stocks = await this.matStockRepository.find({ where });
    const itemCodes = stocks.map(s => s.itemCode).filter(Boolean);

    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 기존 카운트 상세 조회
    const details = await this.countDetailRepository.find({
      where: { sessionDate: new Date(sessionDate), seq, locationCode },
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
   * PDA용 — 바코드 스캔 → 실사수량 +1
   * PHYSICAL_INV_COUNT_DETAILS 테이블에 INSERT or UPDATE
   */
  async scanCount(dto: PdaScanCountDto, company?: string, plant?: string) {
    const { sessionDate, seq, locationCode, barcode, countedBy } = dto;

    // 바코드로 MatLot 조회 (barcode = matUid)
    const lot = await this.matLotRepository.findOne({ where: { matUid: barcode } });
    if (!lot) {
      throw new NotFoundException(`자재시리얼을 찾을 수 없습니다: ${barcode}`);
    }

    // 해당 자재의 재고 찾기
    const stockWhere: any = { itemCode: lot.itemCode, matUid: lot.matUid };
    if (company) stockWhere.company = company;
    if (plant) stockWhere.plant = plant;
    const stock = await this.matStockRepository.findOne({ where: stockWhere });
    if (!stock) {
      throw new NotFoundException(`해당 자재의 재고를 찾을 수 없습니다: ${barcode}`);
    }

    // 카운트 상세 UPSERT
    const detailKey = {
      sessionDate: new Date(sessionDate),
      seq,
      warehouseCode: stock.warehouseCode,
      itemCode: stock.itemCode,
      matUid: stock.matUid,
    };
    let detail = await this.countDetailRepository.findOne({ where: detailKey });

    if (detail) {
      detail.countedQty += 1;
      detail.countedBy = countedBy ?? detail.countedBy;
    } else {
      detail = this.countDetailRepository.create({
        ...detailKey,
        locationCode,
        systemQty: stock.qty,
        countedQty: 1,
        countedBy: countedBy ?? null,
      });
    }
    await this.countDetailRepository.save(detail);

    const part = await this.partMasterRepository.findOne({ where: { itemCode: stock.itemCode } });

    return {
      itemCode: stock.itemCode,
      itemName: part?.itemName ?? '',
      countedQty: detail.countedQty,
    };
  }

  // ─── PC 웹 — 세션별 실사수량 조회 ────────────────────────────────

  /**
   * PC 웹에서 PDA가 저장한 실사수량을 조회
   * 세션(기준년월) 기반으로 MatStock + CountDetail JOIN
   */
  async findStocksWithCounts(query: PhysicalInvCountQueryDto, company?: string, plant?: string) {
    const { countMonth, warehouseCode, search, limit = 5000 } = query;

    // 해당 기준년월의 모든 세션 찾기
    let sessions: PhysicalInvSession[] = [];
    if (countMonth) {
      const sessionWhere: any = { countMonth };
      if (company) sessionWhere.company = company;
      if (plant) sessionWhere.plant = plant;
      sessions = await this.sessionRepository.find({
        where: sessionWhere,
        order: { createdAt: 'DESC' },
      });
    }

    // 진행 중 세션 (실사 개시/완료 판단용)
    const activeSession = sessions.find(s => s.status === 'IN_PROGRESS') ?? null;

    // 재고 목록 조회
    const stockWhere: any = {};
    if (company) stockWhere.company = company;
    if (plant) stockWhere.plant = plant;
    if (warehouseCode) stockWhere.warehouseCode = warehouseCode;

    const stocks = await this.matStockRepository.find({
      where: stockWhere,
      take: limit,
      order: { updatedAt: 'DESC' },
    });

    // 품목 정보
    const itemCodes = [...new Set(stocks.map(s => s.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    // 창고명 조회
    const whCodes = [...new Set(stocks.map(s => s.warehouseCode).filter(Boolean))];
    const warehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes) } })
      : [];
    const whMap = new Map(warehouses.map(w => [w.warehouseCode, w.warehouseName]));

    // 해당 월의 모든 세션 PDA 실사수량 조회 (수량 + 스캔 시간)
    const detailMap = new Map<string, { countedQty: number; countedAt: Date | null }>();
    if (sessions.length > 0) {
      const allDetails = await this.countDetailRepository.find({
        where: sessions.map(s => ({ sessionDate: s.sessionDate, seq: s.seq })),
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

    let result = stocks.map(stock => {
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

    // 검색어 필터링
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        r => r.itemCode.toLowerCase().includes(s) || r.itemName.toLowerCase().includes(s),
      );
    }

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
   * 실사 반영 — 불일치 항목만 출고/입고 트랜잭션으로 재고 조정
   *
   * 부족(시스템 > 실사): PHYSCOUNT_OUT 출고 트랜잭션 → 재고 감소
   * 과잉(실사 > 시스템): PHYSCOUNT_IN 입고 트랜잭션 → 재고 증가
   * 일치(차이=0): 스킵
   */
  async applyCount(dto: CreatePhysicalInvDto) {
    const { items, createdBy } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of items) {
        const [whCode, itCode, ltNo] = item.stockId.split('::');
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: { warehouseCode: whCode, itemCode: itCode, matUid: ltNo || '' },
          lock: { mode: 'pessimistic_write' },
        });

        if (!stock) {
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;

        // 일치 항목은 스킵
        if (diffQty === 0) continue;

        // 1) MatStock 업데이트
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty, lastCountAt: new Date() },
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
        });
        const savedLog = await queryRunner.manager.save(invAdjLog);
        results.push(savedLog);
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 실사 트랜잭션 번호 채번 (PHCyyyyMMdd + 4자리 seq) */
  private async generatePhysCountTransNo(queryRunner?: any): Promise<string> {
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
