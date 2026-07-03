/**
 * @file src/modules/consumables/services/consumables.service.ts
 * @description 소모품관리 서비스 (TypeORM)
 *
 * 핵심 기능:
 * 1. **CRUD**: 소모품 생성, 조회, 수정, 삭제
 * 2. **수명 관리**: 타수 업데이트, 리셋, 경고/교체 상태 체크
 * 3. **재고 관리**: 입출고 이력 및 재고 수량 추적
 * 4. **상태 관리**: NORMAL(정상) / WARNING(경고) / REPLACE(교체필요)
 *
 * 소모품 상태 의미:
 * - NORMAL: 정상 사용 가능
 * - WARNING: 수명 임박 (warningCount에 도달)
 * - REPLACE: 교체 필요 (expectedLife 도달)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In, QueryRunner, FindOptionsWhere } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  UpdateShotCountDto,
  ResetShotCountDto,
  CreateConsumableUsageMapDto,
  UpdateConsumableUsageMapDto,
} from '../dto/consumables.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class ConsumablesService {
  private readonly logger = new Logger(ConsumablesService.name);

  constructor(
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableLog)
    private readonly consumableLogRepository: Repository<ConsumableLog>,
    @InjectRepository(ConsumableUsageMap)
    private readonly usageMapRepository: Repository<ConsumableUsageMap>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    @InjectRepository(EquipMaster)
    private readonly equipRepository: Repository<EquipMaster>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /** CONSUMABLE_LOGS 테이블 오늘 날짜 기준 다음 SEQ (타임존 안전) */
  private async getNextLogSeq(qr?: QueryRunner): Promise<number> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 소모품 목록 조회 (페이지네이션)
   * - 검색어 필터링을 DB 레벨 QueryBuilder WHERE/LIKE로 처리
   */
  async findAll(query?: ConsumableQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      useYn,
      search,
    } = query || {};
    const skip = (page - 1) * limit;

    const qb = this.consumableMasterRepository.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (category) qb.andWhere('c.category = :category', { category });
    if (status) qb.andWhere('c.status = :status', { status });
    if (useYn) qb.andWhere('c.useYn = :useYn', { useYn });

    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(c.consumableCode LIKE :searchCode OR c.consumableName LIKE :searchRaw OR c.location LIKE :searchRaw OR c.vendor LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      qb.clone()
        .orderBy('c.consumableCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      qb.clone().getCount(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * 소모품 단건 조회 (ID)
   */
  async findById(id: string, company?: string, plant?: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode: id, ...this.tenantWhere(company, plant) },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    return consumable;
  }

  /**
   * 소모품 생성
   */
  async create(dto: CreateConsumableDto, company?: string, plant?: string) {
    // 중복 코드 확인
    const existing = await this.consumableMasterRepository.findOne({
      where: { consumableCode: dto.consumableCode, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
    }

    const consumable = this.consumableMasterRepository.create({
      consumableCode: dto.consumableCode,
      consumableName: dto.consumableName,
      category: dto.category || null,
      expectedLife: dto.expectedLife || null,
      warningCount: dto.warningCount || null,
      location: dto.location || null,
      unitPrice: dto.unitPrice || null,
      vendor: dto.vendor || null,
      stockQty: 0,
      currentCount: 0,
      status: 'NORMAL',
      useYn: 'Y',
      company: company ?? null,
      plant: plant ?? null,
    });

    return this.consumableMasterRepository.save(consumable);
  }

  /**
   * 소모품 수정
   */
  async update(id: string, dto: UpdateConsumableDto, company?: string, plant?: string) {
    await this.findById(id, company, plant);

    const updateData: Partial<ConsumableMaster> = {};

    if (dto.consumableName !== undefined) updateData.consumableName = dto.consumableName;
    if (dto.category !== undefined) updateData.category = dto.category || null;
    if (dto.expectedLife !== undefined) updateData.expectedLife = dto.expectedLife || null;
    if (dto.warningCount !== undefined) updateData.warningCount = dto.warningCount || null;
    if (dto.location !== undefined) updateData.location = dto.location || null;
    if (dto.unitPrice !== undefined) updateData.unitPrice = dto.unitPrice || null;
    if (dto.vendor !== undefined) updateData.vendor = dto.vendor || null;
    if (dto.currentCount !== undefined) updateData.currentCount = dto.currentCount;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.consumableMasterRepository.update(
      { consumableCode: id, ...this.tenantWhere(company, plant) },
      updateData,
    );
    return this.findById(id, company, plant);
  }

  /**
   * 소모품 삭제 (소프트 삭제)
   */
  async delete(id: string, company?: string, plant?: string) {
    await this.findById(id, company, plant);

    await this.consumableMasterRepository.delete({ consumableCode: id, ...this.tenantWhere(company, plant) });
    return { id, deleted: true };
  }

  /**
   * 소모품 삭제 (remove - controller 호환용)
   */
  async remove(id: string, company?: string, plant?: string) {
    return this.delete(id, company, plant);
  }

  // =============================================
  // 소모품 사용 매핑
  // =============================================

  async findUsageMaps(consumableCode: string, company?: string, plant?: string) {
    await this.findById(consumableCode, company, plant);

    const params: unknown[] = [consumableCode];
    const tenantClauses: string[] = [];
    if (company) {
      tenantClauses.push(`m.COMPANY = :${params.length + 1}`);
      params.push(company);
    }
    if (plant) {
      tenantClauses.push(`m.PLANT_CD = :${params.length + 1}`);
      params.push(plant);
    }
    const tenantSql = tenantClauses.length ? ` AND ${tenantClauses.join(' AND ')}` : '';

    return this.dataSource.query(
      `SELECT m.PRODUCT_ITEM_CODE AS "productItemCode",
              p.ITEM_NAME         AS "productItemName",
              m.EQUIP_CODE        AS "equipCode",
              e.EQUIP_NAME        AS "equipName",
              m.CONSUMABLE_CODE   AS "consumableCode",
              c.NAME              AS "consumableName",
              m.USAGE_PER_UNIT    AS "usagePerUnit",
              m.USE_YN            AS "useYn",
              m.REMARK            AS "remark",
              m.CREATED_AT        AS "createdAt",
              m.UPDATED_AT        AS "updatedAt"
         FROM CONSUMABLE_USAGE_MAP m
         LEFT JOIN ITEM_MASTERS p
           ON p.COMPANY = m.COMPANY
          AND p.PLANT_CD = m.PLANT_CD
          AND p.ITEM_CODE = m.PRODUCT_ITEM_CODE
         LEFT JOIN EQUIP_MASTERS e
           ON e.COMPANY = m.COMPANY
          AND e.PLANT_CD = m.PLANT_CD
          AND e.EQUIP_CODE = m.EQUIP_CODE
         LEFT JOIN CONSUMABLE_MASTERS c
           ON c.COMPANY = m.COMPANY
          AND c.PLANT_CD = m.PLANT_CD
          AND c.CONSUMABLE_CODE = m.CONSUMABLE_CODE
        WHERE m.CONSUMABLE_CODE = :1
${tenantSql}
        ORDER BY m.USE_YN DESC, m.PRODUCT_ITEM_CODE ASC, m.EQUIP_CODE ASC`,
      params,
    );
  }

  async createUsageMap(consumableCode: string, dto: CreateConsumableUsageMapDto, company?: string, plant?: string) {
    await this.findById(consumableCode, company, plant);
    await this.assertUsageMapRefs(dto.productItemCode, dto.equipCode, company, plant);

    const key = {
      company,
      plant,
      productItemCode: dto.productItemCode,
      equipCode: dto.equipCode,
      consumableCode,
    };
    const existing = await this.usageMapRepository.findOne({ where: key });
    const entity = existing ?? this.usageMapRepository.create(key);

    entity.usagePerUnit = dto.usagePerUnit ?? 1;
    entity.useYn = dto.useYn ?? 'Y';
    entity.remark = dto.remark ?? null;
    entity.updatedAt = new Date();

    return this.usageMapRepository.save(entity);
  }

  async updateUsageMap(
    consumableCode: string,
    productItemCode: string,
    equipCode: string,
    dto: UpdateConsumableUsageMapDto,
    company?: string,
    plant?: string,
  ) {
    const map = await this.usageMapRepository.findOne({
      where: { consumableCode, productItemCode, equipCode, ...this.tenantWhere(company, plant) },
    });
    if (!map) {
      throw new NotFoundException(`소모품 사용 매핑을 찾을 수 없습니다: ${productItemCode}/${equipCode}/${consumableCode}`);
    }

    if (dto.usagePerUnit !== undefined) map.usagePerUnit = dto.usagePerUnit;
    if (dto.useYn !== undefined) map.useYn = dto.useYn;
    if (dto.remark !== undefined) map.remark = dto.remark || null;
    map.updatedAt = new Date();

    return this.usageMapRepository.save(map);
  }

  async deleteUsageMap(
    consumableCode: string,
    productItemCode: string,
    equipCode: string,
    company?: string,
    plant?: string,
  ) {
    const result = await this.usageMapRepository.delete({
      consumableCode,
      productItemCode,
      equipCode,
      ...this.tenantWhere(company, plant),
    });
    if (!result.affected) {
      throw new NotFoundException(`소모품 사용 매핑을 찾을 수 없습니다: ${productItemCode}/${equipCode}/${consumableCode}`);
    }
    return { consumableCode, productItemCode, equipCode };
  }

  private async assertUsageMapRefs(productItemCode: string, equipCode: string, company?: string, plant?: string) {
    const [part, equip] = await Promise.all([
      this.partRepository.findOne({
        where: { itemCode: productItemCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
      this.equipRepository.findOne({
        where: { equipCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
    ]);

    if (!part) {
      throw new NotFoundException(`제품/모델 품목을 찾을 수 없습니다: ${productItemCode}`);
    }
    if (!equip) {
      throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    }
  }

  // =============================================
  // 현황 및 통계
  // =============================================

  /**
   * 소모품 현황 요약
   */
  async getSummary(company?: string, plant?: string) {
    const [total, warning, replace] = await Promise.all([
      this.consumableMasterRepository.count({
        where: { useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
      this.consumableMasterRepository.count({
        where: { status: 'WARNING', useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
      this.consumableMasterRepository.count({
        where: { status: 'REPLACE', useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
    ]);

    return { total, warning, replace };
  }

  /**
   * 경고/교체 필요 소모품 목록
   */
  async getWarningList(company?: string, plant?: string) {
    return this.consumableMasterRepository.find({
      where: {
        status: In(['WARNING', 'REPLACE']),
        useYn: 'Y',
        ...this.tenantWhere(company, plant),
      },
      order: { status: 'DESC', currentCount: 'DESC' },
    });
  }

  /**
   * 소모품 수명 현황
   */
  async getLifeStatus(company?: string, plant?: string) {
    return this.consumableMasterRepository.find({
      where: { useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { status: 'DESC', currentCount: 'DESC', consumableCode: 'ASC' },
    });
  }

  /**
   * 소모품 재고 현황 조회
   * - 검색어 필터링을 DB 레벨 QueryBuilder WHERE/LIKE로 처리
   */
  async getStockStatus(query?: ConsumableQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      category,
      search,
    } = query || {};
    const skip = (page - 1) * limit;

    const qb = this.consumableMasterRepository.createQueryBuilder('c')
      .where('c.useYn = :useYn', { useYn: 'Y' });
    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

    if (category) qb.andWhere('c.category = :category', { category });

    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(c.consumableCode LIKE :searchCode OR c.consumableName LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      qb.clone()
        .orderBy('c.stockQty', 'ASC')
        .addOrderBy('c.consumableCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      qb.clone().getCount(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  // =============================================
  // 입출고 이력 관리
  // =============================================

  /**
   * 입출고 이력 목록 조회
   */
  async findAllLogs(query?: ConsumableLogQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      consumableId,
      logType,
      logTypeGroup,
      fromDate,
      toDate,
    } = query || {};
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ConsumableLog> = { ...this.tenantWhere(company, plant) };

    if (consumableId) {
      where.consumableCode = consumableId;
    }

    if (logType) {
      where.logType = logType;
    }

    if (logTypeGroup) {
      if (logTypeGroup === 'RECEIVING') {
        where.logType = In(['IN', 'IN_RETURN']);
      } else if (logTypeGroup === 'ISSUING') {
        where.logType = In(['OUT', 'OUT_RETURN']);
      }
    }

    if (fromDate && toDate) {
      where.createdAt = Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!);
    } else if (fromDate) {
      where.createdAt = Between(parseDateStart(fromDate)!, new Date());
    }

    const raw = await this.consumableLogRepository.find({
      where,
      relations: ['master'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const data = raw.map(({ master, ...log }) => ({
      ...log,
      consumableName: master?.consumableName ?? '',
    }));

    const total = await this.consumableLogRepository.count({ where });

    return { data, total, page, limit };
  }

  /**
   * 입출고 이력 등록
   */
  async createLog(dto: CreateConsumableLogDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      // 소모품 존재 확인
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (!consumable) {
        throw new NotFoundException(`소모품을 찾을 수 없습니다: ${dto.consumableId}`);
      }

      // 재고 계산
      let stockDelta = 0;
      if (dto.logType === 'IN') {
        stockDelta = dto.qty || 1;
      } else if (dto.logType === 'OUT') {
        stockDelta = -(dto.qty || 1);
      } else if (dto.logType === 'IN_RETURN') {
        stockDelta = -(dto.qty || 1);
      } else if (dto.logType === 'OUT_RETURN') {
        stockDelta = dto.qty || 1;
      }

      // 재고 부족 체크 (출고 시)
      if (stockDelta < 0 && consumable.stockQty + stockDelta < 0) {
        throw new BadRequestException(
          `재고 부족: 현재 ${consumable.stockQty}, 요청 ${Math.abs(stockDelta)}`,
        );
      }

      // 이력 생성
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeq = await this.getNextLogSeq(queryRunner);

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: dto.consumableId,
        logType: dto.logType,
        qty: dto.qty || 1,
        workerId: dto.workerId || null,
        remark: dto.remark || null,
        vendorCode: dto.vendorCode || null,
        vendorName: dto.vendorName || null,
        unitPrice: dto.unitPrice || null,
        incomingType: dto.incomingType || null,
        department: dto.department || null,
        lineCode: dto.lineCode || null,
        processCode: dto.processCode || null,
        equipCode: dto.equipCode || null,
        issueReason: dto.issueReason || null,
        returnReason: dto.returnReason || null,
        company,
        plant,
      });

      const savedLog = await queryRunner.manager.save(ConsumableLog, log);

      // 재고 업데이트
      await queryRunner.manager.update(
        ConsumableMaster,
        {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        {
          stockQty: consumable.stockQty + stockDelta,
          lastReplaceAt: dto.logType === 'IN' ? new Date() : consumable.lastReplaceAt,
        },
      );

      return savedLog;
    });
  }

  // =============================================
  // 타수 관리
  // =============================================

  /**
   * 소모품 이미지 URL 업데이트
   */
  async updateImage(consumableCode: string, imageUrl: string | null, company?: string, plant?: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode, ...this.tenantWhere(company, plant) },
    });
    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${consumableCode}`);
    }
    await this.consumableMasterRepository.update(
      { consumableCode, ...this.tenantWhere(company, plant) },
      { imageUrl },
    );
    return this.findById(consumableCode, company, plant);
  }

  /**
   * 타수 업데이트 (사용 횟수 증가)
   */
  async updateShotCount(dto: UpdateShotCountDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (!consumable) {
        throw new NotFoundException(`소모품을 찾을 수 없습니다: ${dto.consumableId}`);
      }

      const newCount = consumable.currentCount + dto.addCount;
      let newStatus = consumable.status;

      // 상태 업데이트
      if (consumable.expectedLife && newCount >= consumable.expectedLife) {
        newStatus = 'REPLACE';
      } else if (consumable.warningCount && newCount >= consumable.warningCount) {
        newStatus = 'WARNING';
      }

      await queryRunner.manager.update(
        ConsumableMaster,
        {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        {
          currentCount: newCount,
          status: newStatus,
        },
      );

      // 로그 기록 (선택적)
      if (dto.equipCode) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const logSeq = await this.getNextLogSeq(queryRunner);

        const log = queryRunner.manager.create(ConsumableLog, {
          transDate: today,
          seq: logSeq,
          consumableCode: dto.consumableId,
          logType: 'USAGE',
          qty: dto.addCount,
          equipCode: dto.equipCode,
          remark: `타수 업데이트: +${dto.addCount}`,
          company,
          plant,
        });
        await queryRunner.manager.save(ConsumableLog, log);
      }

      return {
        success: true,
        consumableId: dto.consumableId,
        previousCount: consumable.currentCount,
        currentCount: newCount,
        previousStatus: consumable.status,
        currentStatus: newStatus,
      };
    });
  }

  /**
   * 타수 리셋 (교체 시)
   */
  async resetShotCount(dto: ResetShotCountDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (!consumable) {
        throw new NotFoundException(`소모품을 찾을 수 없습니다: ${dto.consumableId}`);
      }

      const previousCount = consumable.currentCount;
      const now = new Date();

      // 교체 이력 로그 생성
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeq = await this.getNextLogSeq(queryRunner);

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: dto.consumableId,
        logType: 'REPLACE',
        qty: previousCount,
        remark: dto.remark || '소모품 교체 (타수 리셋)',
        company,
        plant,
      });
      await queryRunner.manager.save(ConsumableLog, log);

      // 타수 리셋 및 상태 초기화
      await queryRunner.manager.update(
        ConsumableMaster,
        {
          consumableCode: dto.consumableId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        {
          currentCount: 0,
          status: 'NORMAL',
          lastReplaceAt: now,
          nextReplaceAt: consumable.expectedLife
            ? new Date(now.getTime() + consumable.expectedLife * 24 * 60 * 60 * 1000)
            : null,
        },
      );

      return {
        success: true,
        consumableId: dto.consumableId,
        previousCount,
        currentCount: 0,
        previousStatus: consumable.status,
        currentStatus: 'NORMAL',
        replacedAt: now,
      };
    });
  }
}
