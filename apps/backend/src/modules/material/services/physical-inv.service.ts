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
import { Repository, DataSource, In } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import {
  CreatePhysicalInvDto,
  PhysicalInvQueryDto,
  PhysicalInvHistoryQueryDto,
  StartPhysicalInvSessionDto,
  CompletePhysicalInvSessionDto,
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

    const session = this.sessionRepository.create({
      invType: dto.invType,
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
    const session = await this.sessionRepository.findOne({ where: { sessionDate: new Date(sessionDate), seq } });
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

  async applyCount(dto: CreatePhysicalInvDto) {
    const { items, createdBy } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of items) {
        // stockId는 "warehouseCode::itemCode::matUid" 형태의 복합키 문자열
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

        // 재고 업데이트
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty, lastCountAt: new Date() },
        );

        // 조정 이력 기록
        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.matUid,
          adjType: 'PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          reason: item.remark || '재고실사',
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
}
