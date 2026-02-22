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
import { Repository, DataSource, IsNull, Like, Between, In } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  UpdateShotCountDto,
  ResetShotCountDto,
} from '../dto/consumables.dto';

@Injectable()
export class ConsumablesService {
  private readonly logger = new Logger(ConsumablesService.name);

  constructor(
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableLog)
    private readonly consumableLogRepository: Repository<ConsumableLog>,
    private readonly dataSource: DataSource,
  ) {}

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 소모품 목록 조회 (페이지네이션)
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

    const where: any = {
      deletedAt: IsNull(),
    };

    if (company) {
      where.company = company;
    }
    if (plant) {
      where.plant = plant;
    }
    if (category) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    }
    if (useYn) {
      where.useYn = useYn;
    }

    const [data, total] = await Promise.all([
      this.consumableMasterRepository.find({
        where,
        skip,
        take: limit,
        order: { consumableCode: 'ASC' },
      }),
      this.consumableMasterRepository.count({ where }),
    ]);

    // 검색어 필터링 (코드, 이름, 위치)
    let filteredData = data;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = data.filter(
        (item) =>
          item.consumableCode.toLowerCase().includes(searchLower) ||
          item.consumableName.toLowerCase().includes(searchLower) ||
          (item.location && item.location.toLowerCase().includes(searchLower)) ||
          (item.vendor && item.vendor.toLowerCase().includes(searchLower)),
      );
    }

    return {
      data: filteredData,
      total: search ? filteredData.length : total,
      page,
      limit,
    };
  }

  /**
   * 소모품 단건 조회 (ID)
   */
  async findById(id: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    return consumable;
  }

  /**
   * 소모품 생성
   */
  async create(dto: CreateConsumableDto) {
    // 중복 코드 확인
    const existing = await this.consumableMasterRepository.findOne({
      where: { consumableCode: dto.consumableCode, deletedAt: IsNull() },
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
    });

    return this.consumableMasterRepository.save(consumable);
  }

  /**
   * 소모품 수정
   */
  async update(id: string, dto: UpdateConsumableDto) {
    await this.findById(id);

    // 코드 변경 시 중복 확인
    if (dto.consumableCode) {
      const existing = await this.consumableMasterRepository.findOne({
        where: {
          consumableCode: dto.consumableCode,
          deletedAt: IsNull(),
          id: id, // exclude current id
        },
      });

      if (existing) {
        throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
      }
    }

    const updateData: Partial<ConsumableMaster> = {};

    if (dto.consumableCode !== undefined) updateData.consumableCode = dto.consumableCode;
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

    await this.consumableMasterRepository.update(id, updateData);
    return this.findById(id);
  }

  /**
   * 소모품 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id);

    await this.consumableMasterRepository.softDelete(id);
    return { id, deleted: true };
  }

  /**
   * 소모품 삭제 (remove - controller 호환용)
   */
  async remove(id: string) {
    return this.delete(id);
  }

  // =============================================
  // 현황 및 통계
  // =============================================

  /**
   * 소모품 현황 요약
   */
  async getSummary() {
    const [total, warning, replace] = await Promise.all([
      this.consumableMasterRepository.count({
        where: { deletedAt: IsNull(), useYn: 'Y' },
      }),
      this.consumableMasterRepository.count({
        where: { status: 'WARNING', deletedAt: IsNull(), useYn: 'Y' },
      }),
      this.consumableMasterRepository.count({
        where: { status: 'REPLACE', deletedAt: IsNull(), useYn: 'Y' },
      }),
    ]);

    return { total, warning, replace };
  }

  /**
   * 경고/교체 필요 소모품 목록
   */
  async getWarningList() {
    return this.consumableMasterRepository.find({
      where: {
        status: In(['WARNING', 'REPLACE']),
        deletedAt: IsNull(),
        useYn: 'Y',
      },
      order: { status: 'DESC', currentCount: 'DESC' },
    });
  }

  /**
   * 소모품 수명 현황
   */
  async getLifeStatus() {
    const consumables = await this.consumableMasterRepository.find({
      where: { deletedAt: IsNull(), useYn: 'Y' },
    });

    let good = 0;
    let warning = 0;
    let replace = 0;

    for (const item of consumables) {
      if (item.status === 'REPLACE') {
        replace++;
      } else if (item.status === 'WARNING') {
        warning++;
      } else {
        good++;
      }
    }

    return { good, warning, replace };
  }

  /**
   * 소모품 재고 현황 조회
   */
  async getStockStatus(query?: ConsumableQueryDto) {
    const {
      page = 1,
      limit = 10,
      category,
      search,
    } = query || {};
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: IsNull(),
      useYn: 'Y',
    };

    if (category) {
      where.category = category;
    }

    const [data, total] = await Promise.all([
      this.consumableMasterRepository.find({
        where,
        skip,
        take: limit,
        order: { stockQty: 'ASC', consumableCode: 'ASC' },
      }),
      this.consumableMasterRepository.count({ where }),
    ]);

    // 검색어 필터링
    let filteredData = data;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = data.filter(
        (item) =>
          item.consumableCode.toLowerCase().includes(searchLower) ||
          item.consumableName.toLowerCase().includes(searchLower),
      );
    }

    return {
      data: filteredData,
      total: search ? filteredData.length : total,
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
  async findAllLogs(query?: ConsumableLogQueryDto) {
    const {
      page = 1,
      limit = 10,
      consumableId,
      logType,
      logTypeGroup,
      startDate,
      endDate,
    } = query || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (consumableId) {
      where.consumableId = consumableId;
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

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = Between(new Date(startDate), new Date());
    }

    const [data, total] = await Promise.all([
      this.consumableLogRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.consumableLogRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 입출고 이력 등록
   */
  async createLog(dto: CreateConsumableLogDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 소모품 존재 확인
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: { id: dto.consumableId, deletedAt: IsNull() },
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
      const log = queryRunner.manager.create(ConsumableLog, {
        consumableId: dto.consumableId,
        logType: dto.logType,
        qty: dto.qty || 1,
        workerId: dto.workerId || null,
        remark: dto.remark || null,
        vendorCode: dto.vendorCode || null,
        vendorName: dto.vendorName || null,
        unitPrice: dto.unitPrice || null,
        incomingType: dto.incomingType || null,
        department: dto.department || null,
        lineId: dto.lineId || null,
        equipId: dto.equipId || null,
        issueReason: dto.issueReason || null,
        returnReason: dto.returnReason || null,
      });

      const savedLog = await queryRunner.manager.save(ConsumableLog, log);

      // 재고 업데이트
      await queryRunner.manager.update(
        ConsumableMaster,
        dto.consumableId,
        {
          stockQty: consumable.stockQty + stockDelta,
          lastReplaceAt: dto.logType === 'IN' ? new Date() : consumable.lastReplaceAt,
        },
      );

      await queryRunner.commitTransaction();
      return savedLog;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // =============================================
  // 타수 관리
  // =============================================

  /**
   * 타수 업데이트 (사용 횟수 증가)
   */
  async updateShotCount(dto: UpdateShotCountDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: { id: dto.consumableId, deletedAt: IsNull() },
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

      await queryRunner.manager.update(ConsumableMaster, dto.consumableId, {
        currentCount: newCount,
        status: newStatus,
      });

      // 로그 기록 (선택적)
      if (dto.equipId) {
        const log = queryRunner.manager.create(ConsumableLog, {
          consumableId: dto.consumableId,
          logType: 'USAGE',
          qty: dto.addCount,
          equipId: dto.equipId,
          remark: `타수 업데이트: +${dto.addCount}`,
        });
        await queryRunner.manager.save(ConsumableLog, log);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        consumableId: dto.consumableId,
        previousCount: consumable.currentCount,
        currentCount: newCount,
        previousStatus: consumable.status,
        currentStatus: newStatus,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 타수 리셋 (교체 시)
   */
  async resetShotCount(dto: ResetShotCountDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: { id: dto.consumableId, deletedAt: IsNull() },
      });

      if (!consumable) {
        throw new NotFoundException(`소모품을 찾을 수 없습니다: ${dto.consumableId}`);
      }

      const previousCount = consumable.currentCount;
      const now = new Date();

      // 교체 이력 로그 생성
      const log = queryRunner.manager.create(ConsumableLog, {
        consumableId: dto.consumableId,
        logType: 'REPLACE',
        qty: previousCount,
        remark: dto.remark || '소모품 교체 (타수 리셋)',
      });
      await queryRunner.manager.save(ConsumableLog, log);

      // 타수 리셋 및 상태 초기화
      await queryRunner.manager.update(ConsumableMaster, dto.consumableId, {
        currentCount: 0,
        status: 'NORMAL',
        lastReplaceAt: now,
        nextReplaceAt: consumable.expectedLife
          ? new Date(now.getTime() + consumable.expectedLife * 24 * 60 * 60 * 1000)
          : null,
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        consumableId: dto.consumableId,
        previousCount,
        currentCount: 0,
        previousStatus: consumable.status,
        currentStatus: 'NORMAL',
        replacedAt: now,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
