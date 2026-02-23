/**
 * @file src/modules/equipment/services/consumable.service.ts
 * @description 소모품(금형/지그/공구) 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **CRUD**: 소모품 생성, 조회, 수정, 삭제
 * 2. **수명 관리**:
 *    - increaseCount: 사용 횟수 증가
 *    - registerReplacement: 교체 등록
 *    - updateWarningStatus: 경고 상태 자동 업데이트
 * 3. **이력 관리**: 입출고, 수리, 폐기 이력 기록
 *
 * 상태 자동 변경 로직:
 * - currentCount >= warningCount -> WARNING
 * - currentCount >= expectedLife -> REPLACE
 * - 교체 등록 시 -> NORMAL (currentCount 리셋)
 *
 * 사용 시나리오:
 * 1. 금형 출고 시: createLog(OUT) + increaseCount
 * 2. 금형 반납 시: createLog(RETURN)
 * 3. 금형 교체 시: registerReplacement -> createLog(IN)
 * 4. 금형 수리 시: createLog(REPAIR)
 * 5. 금형 폐기 시: createLog(SCRAP) + useYn='N'
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource, In } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { User } from '../../../entities/user.entity';
import {
  EquipCreateConsumableDto,
  EquipUpdateConsumableDto,
  ConsumableQueryDto,
  EquipCreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
  MountToEquipDto,
  UnmountFromEquipDto,
  SetRepairDto,
} from '../dto/consumable.dto';

@Injectable()
export class ConsumableService {
  private readonly logger = new Logger(ConsumableService.name);

  constructor(
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableLog)
    private readonly consumableLogRepository: Repository<ConsumableLog>,
    @InjectRepository(ConsumableMountLog)
    private readonly mountLogRepository: Repository<ConsumableMountLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 소모품 목록 조회 (페이지네이션)
   */
  async findAll(query: ConsumableQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      vendor,
      useYn,
      search,
      nextReplaceBefore,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.consumableMasterRepository.createQueryBuilder('consumable')
      .where('consumable.deletedAt IS NULL');

    if (company) {
      queryBuilder.andWhere('consumable.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('consumable.plant = :plant', { plant });
    }
    if (category) {
      queryBuilder.andWhere('consumable.category = :category', { category });
    }
    if (status) {
      queryBuilder.andWhere('consumable.status = :status', { status });
    }
    if (vendor) {
      queryBuilder.andWhere('LOWER(consumable.vendor) LIKE LOWER(:vendor)', { vendor: `%${vendor}%` });
    }
    if (useYn) {
      queryBuilder.andWhere('consumable.useYn = :useYn', { useYn });
    }
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(consumable.consumableCode) LIKE LOWER(:search) OR LOWER(consumable.consumableName) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }
    if (nextReplaceBefore) {
      queryBuilder.andWhere('consumable.nextReplaceAt <= :nextReplaceBefore', {
        nextReplaceBefore: new Date(nextReplaceBefore),
      });
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('consumable.consumableCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
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

    // Get recent logs with worker info
    const logs = await this.consumableLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect(User, 'worker', 'log.workerId = worker.id')
      .where('log.consumableId = :consumableId', { consumableId: id })
      .orderBy('log.createdAt', 'DESC')
      .take(10)
      .select([
        'log',
        'worker.id AS worker_id',
        'worker.name AS worker_name',
        'worker.empNo AS worker_empNo',
      ])
      .getRawMany();

    return {
      ...consumable,
      consumableLogs: logs.map((log) => ({
        ...log.log,
        worker: log.worker_id ? {
          id: log.worker_id,
          name: log.worker_name,
          empNo: log.worker_empNo,
        } : null,
      })),
    };
  }

  /**
   * 소모품 단건 조회 (코드)
   */
  async findByCode(consumableCode: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode, deletedAt: IsNull() },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${consumableCode}`);
    }

    return consumable;
  }

  /**
   * 소모품 생성
   */
  async create(dto: EquipCreateConsumableDto) {
    // 중복 코드 확인
    const existing = await this.consumableMasterRepository.findOne({
      where: { consumableCode: dto.consumableCode, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
    }

    const consumable = this.consumableMasterRepository.create({
      consumableCode: dto.consumableCode,
      consumableName: dto.name,
      category: dto.category,
      expectedLife: dto.expectedLife,
      currentCount: dto.currentCount ?? 0,
      warningCount: dto.warningCount,
      location: dto.location,
      lastReplaceAt: dto.lastReplaceAt ? new Date(dto.lastReplaceAt) : null,
      nextReplaceAt: dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null,
      unitPrice: dto.unitPrice,
      vendor: dto.vendor,
      status: dto.status ?? 'NORMAL',
      useYn: dto.useYn ?? 'Y',
    });

    return this.consumableMasterRepository.save(consumable);
  }

  /**
   * 소모품 수정
   */
  async update(id: string, dto: EquipUpdateConsumableDto) {
    await this.findById(id);

    // 코드 변경 시 중복 확인
    if (dto.consumableCode) {
      const existing = await this.consumableMasterRepository.findOne({
        where: {
          consumableCode: dto.consumableCode,
          deletedAt: IsNull(),
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
      }
    }

    const updateData: Partial<ConsumableMaster> = {};

    if (dto.consumableCode !== undefined) updateData.consumableCode = dto.consumableCode;
    if (dto.name !== undefined) updateData.consumableName = dto.name;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.expectedLife !== undefined) updateData.expectedLife = dto.expectedLife;
    if (dto.currentCount !== undefined) updateData.currentCount = dto.currentCount;
    if (dto.warningCount !== undefined) updateData.warningCount = dto.warningCount;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.lastReplaceAt !== undefined) updateData.lastReplaceAt = dto.lastReplaceAt ? new Date(dto.lastReplaceAt) : null;
    if (dto.nextReplaceAt !== undefined) updateData.nextReplaceAt = dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null;
    if (dto.unitPrice !== undefined) updateData.unitPrice = dto.unitPrice;
    if (dto.vendor !== undefined) updateData.vendor = dto.vendor;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.consumableMasterRepository.update(id, updateData);

    // 상태 자동 업데이트
    await this.updateWarningStatus(id);

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

  // =============================================
  // 수명 관리
  // =============================================

  /**
   * 사용 횟수 증가
   */
  async increaseCount(id: string, dto: IncreaseCountDto) {
    const consumable = await this.findById(id);
    const newCount = consumable.currentCount + dto.count;

    await this.consumableMasterRepository.update(id, { currentCount: newCount });

    // 상태 자동 업데이트
    await this.updateWarningStatus(id);

    this.logger.log(
      `소모품 사용 횟수 증가: ${consumable.consumableCode} (${consumable.currentCount} -> ${newCount})`
    );

    return this.findById(id);
  }

  /**
   * 교체 등록
   */
  async registerReplacement(id: string, dto: RegisterReplacementDto) {
    const consumable = await this.findById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 소모품 정보 업데이트
      await queryRunner.manager.update(ConsumableMaster, id, {
        currentCount: 0,
        lastReplaceAt: new Date(),
        nextReplaceAt: dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null,
        status: 'NORMAL',
      });

      // 입고 로그 생성
      await queryRunner.manager.save(ConsumableLog, {
        consumableId: id,
        logType: 'IN',
        qty: 1,
        workerId: dto.workerId,
        remark: dto.remark ?? '교체 입고',
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `소모품 교체 등록: ${consumable.consumableCode}, 이전 사용 횟수: ${consumable.currentCount}`
      );

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 경고 상태 자동 업데이트
   */
  async updateWarningStatus(id: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { id },
    });

    if (!consumable) return;

    let newStatus = 'NORMAL';

    if (consumable.expectedLife && consumable.currentCount >= consumable.expectedLife) {
      newStatus = 'REPLACE';
    } else if (consumable.warningCount && consumable.currentCount >= consumable.warningCount) {
      newStatus = 'WARNING';
    }

    if (consumable.status !== newStatus) {
      await this.consumableMasterRepository.update(id, { status: newStatus });

      this.logger.log(
        `소모품 상태 자동 변경: ${consumable.consumableCode} (${consumable.status} -> ${newStatus})`
      );
    }
  }

  // =============================================
  // 소모품 로그 관리
  // =============================================

  /**
   * 소모품 로그 생성
   */
  async createLog(dto: EquipCreateConsumableLogDto) {
    // 소모품 존재 확인
    const consumable = await this.findById(dto.consumableId);

    const log = this.consumableLogRepository.create({
      consumableId: dto.consumableId,
      logType: dto.logType,
      qty: dto.qty ?? 1,
      workerId: dto.workerId,
      remark: dto.remark,
    });

    const saved = await this.consumableLogRepository.save(log);

    // Get worker info
    let workerInfo = null;
    if (dto.workerId) {
      const worker = await this.userRepository.findOne({
        where: { id: dto.workerId },
        select: ['id', 'name', 'empNo'],
      });
      workerInfo = worker || null;
    }

    // SCRAP인 경우 소모품 비활성화
    if (dto.logType === 'SCRAP') {
      await this.consumableMasterRepository.update(dto.consumableId, { useYn: 'N' });

      this.logger.log(`소모품 폐기 처리: ${consumable.consumableCode}`);
    }

    return {
      ...saved,
      worker: workerInfo,
      consumable: {
        consumableCode: consumable.consumableCode,
        consumableName: consumable.consumableName,
      },
    };
  }

  /**
   * 소모품 로그 목록 조회
   */
  async findLogs(query: ConsumableLogQueryDto) {
    const {
      page = 1,
      limit = 20,
      consumableId,
      logType,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.consumableLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect(User, 'worker', 'log.workerId = worker.id')
      .leftJoinAndSelect(ConsumableMaster, 'consumable', 'log.consumableId = consumable.id')
      .select([
        'log',
        'worker.id AS worker_id',
        'worker.name AS worker_name',
        'worker.empNo AS worker_empNo',
        'consumable.consumableCode AS consumable_code',
        'consumable.consumableName AS consumable_name',
        'consumable.category AS consumable_category',
      ]);

    if (consumableId) {
      queryBuilder.andWhere('log.consumableId = :consumableId', { consumableId });
    }
    if (logType) {
      queryBuilder.andWhere('log.logType = :logType', { logType });
    }
    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    const [logs, total] = await Promise.all([
      queryBuilder
        .orderBy('log.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getRawMany(),
      queryBuilder.getCount(),
    ]);

    const data = logs.map((log) => ({
      ...log.log,
      worker: log.worker_id ? {
        id: log.worker_id,
        name: log.worker_name,
        empNo: log.worker_empNo,
      } : null,
      consumable: {
        consumableCode: log.consumable_code,
        consumableName: log.consumable_name,
        category: log.consumable_category,
      },
    }));

    return { data, total, page, limit };
  }

  /**
   * 특정 소모품의 로그 조회
   */
  async findLogsByConsumableId(consumableId: string) {
    await this.findById(consumableId); // 존재 확인

    const logs = await this.consumableLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect(User, 'worker', 'log.workerId = worker.id')
      .where('log.consumableId = :consumableId', { consumableId })
      .orderBy('log.createdAt', 'DESC')
      .select([
        'log',
        'worker.id AS worker_id',
        'worker.name AS worker_name',
        'worker.empNo AS worker_empNo',
      ])
      .getRawMany();

    return logs.map((log) => ({
      ...log.log,
      worker: log.worker_id ? {
        id: log.worker_id,
        name: log.worker_name,
        empNo: log.worker_empNo,
      } : null,
    }));
  }

  // =============================================
  // 필터링 조회
  // =============================================

  /**
   * 카테고리별 소모품 목록 조회
   */
  async findByCategory(category: string) {
    return this.consumableMasterRepository.find({
      where: { category, useYn: 'Y', deletedAt: IsNull() },
      order: { consumableCode: 'ASC' },
    });
  }

  /**
   * 교체 예정 목록 조회
   */
  async findReplacementSchedule(days: number = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .where('consumable.deletedAt IS NULL')
      .andWhere('consumable.useYn = :useYn', { useYn: 'Y' })
      .andWhere(
        '(consumable.status IN (:...statuses) OR consumable.nextReplaceAt <= :targetDate)',
        { statuses: ['WARNING', 'REPLACE'], targetDate }
      )
      .orderBy('consumable.status', 'DESC') // REPLACE > WARNING > NORMAL
      .addOrderBy('consumable.nextReplaceAt', 'ASC')
      .getMany();
  }

  /**
   * 경고/교체필요 상태 소모품 목록 조회
   */
  async findWarningConsumables() {
    return this.consumableMasterRepository.find({
      where: {
        status: In(['WARNING', 'REPLACE']),
        useYn: 'Y',
        deletedAt: IsNull(),
      },
      order: { status: 'DESC' },
    });
  }

  // =============================================
  // 통계
  // =============================================

  // =============================================
  // 금형 장착/해제/수리 관리
  // =============================================

  /**
   * 금형을 설비에 장착
   */
  async mountToEquip(id: string, dto: MountToEquipDto) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    if (consumable.operStatus === 'MOUNTED') {
      throw new ConflictException(
        `이미 설비에 장착된 금형입니다. 현재 장착 설비: ${consumable.mountedEquipId}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(ConsumableMaster, id, {
        operStatus: 'MOUNTED',
        mountedEquipId: dto.equipId,
      });

      await queryRunner.manager.save(ConsumableMountLog, {
        consumableId: id,
        equipId: dto.equipId,
        action: 'MOUNT',
        workerId: dto.workerId ?? null,
        remark: dto.remark ?? null,
        company: consumable.company,
        plant: consumable.plant,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `금형 장착: ${consumable.consumableCode} → 설비 ${dto.equipId}`,
      );

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 금형을 설비에서 해제
   */
  async unmountFromEquip(id: string, dto: UnmountFromEquipDto) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    if (consumable.operStatus !== 'MOUNTED') {
      throw new BadRequestException(
        `장착 상태가 아닌 금형은 해제할 수 없습니다. 현재 상태: ${consumable.operStatus}`,
      );
    }

    const previousEquipId = consumable.mountedEquipId;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(ConsumableMaster, id, {
        operStatus: 'WAREHOUSE',
        mountedEquipId: null,
      });

      await queryRunner.manager.save(ConsumableMountLog, {
        consumableId: id,
        equipId: previousEquipId,
        action: 'UNMOUNT',
        workerId: dto.workerId ?? null,
        remark: dto.remark ?? null,
        company: consumable.company,
        plant: consumable.plant,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `금형 해제: ${consumable.consumableCode} ← 설비 ${previousEquipId}`,
      );

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 금형을 수리 상태로 전환 (장착 상태면 자동 해제)
   */
  async setRepairStatus(id: string, dto: SetRepairDto) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 장착 상태면 먼저 해제 로그 기록
      if (consumable.operStatus === 'MOUNTED' && consumable.mountedEquipId) {
        await queryRunner.manager.save(ConsumableMountLog, {
          consumableId: id,
          equipId: consumable.mountedEquipId,
          action: 'UNMOUNT',
          workerId: dto.workerId ?? null,
          remark: '수리 전환으로 인한 자동 해제',
          company: consumable.company,
          plant: consumable.plant,
        });
      }

      await queryRunner.manager.update(ConsumableMaster, id, {
        operStatus: 'REPAIR',
        mountedEquipId: null,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `금형 수리 전환: ${consumable.consumableCode} (이전 상태: ${consumable.operStatus})`,
      );

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 금형 장착/해제 이력 조회
   */
  async getMountHistory(consumableId: string) {
    await this.findById(consumableId);

    return this.mountLogRepository.find({
      where: { consumableId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 특정 설비에 장착된 금형 목록 조회
   */
  async findMountedByEquip(equipId: string) {
    return this.consumableMasterRepository.find({
      where: {
        mountedEquipId: equipId,
        operStatus: 'MOUNTED',
        deletedAt: IsNull(),
      },
      order: { consumableCode: 'ASC' },
    });
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 예방보전 캘린더 월별 요약
   * - 각 날짜별로 교체 예정/경고/완료된 소모품 수를 집계
   */
  async getPmCalendarSummary(year: number, month: number, category?: string) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59);

    // 교체 예정일이 해당 월에 있는 소모품 조회
    const qb = this.consumableMasterRepository
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL')
      .andWhere('c.useYn = :yn', { yn: 'Y' })
      .andWhere('c.nextReplaceAt IS NOT NULL')
      .andWhere('c.nextReplaceAt BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (category) {
      qb.andWhere('c.category = :category', { category });
    }

    const consumables = await qb.getMany();

    // 날짜별 집계
    const dateMap = new Map<string, { total: number; warning: number; replace: number; normal: number }>();
    for (const c of consumables) {
      const d = new Date(c.nextReplaceAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap.has(key)) dateMap.set(key, { total: 0, warning: 0, replace: 0, normal: 0 });
      const entry = dateMap.get(key)!;
      entry.total++;
      if (c.status === 'REPLACE') entry.replace++;
      else if (c.status === 'WARNING') entry.warning++;
      else entry.normal++;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = dateMap.get(dateStr) || { total: 0, warning: 0, replace: 0, normal: 0 };
      const dateObj = new Date(year, month - 1, day);

      let status = 'NONE';
      if (entry.total === 0) {
        status = 'NONE';
      } else if (entry.replace > 0) {
        status = 'HAS_FAIL';
      } else if (entry.warning > 0) {
        status = 'IN_PROGRESS';
      } else if (dateObj < today) {
        status = 'OVERDUE';
      } else {
        status = 'ALL_PASS';
      }

      result.push({
        date: dateStr,
        total: entry.total,
        completed: entry.normal,
        pass: entry.normal,
        fail: entry.replace + entry.warning,
        status,
      });
    }

    return result;
  }

  /**
   * 예방보전 캘린더 일별 상세 스케줄
   * - 특정 날짜에 교체 예정인 소모품 목록 반환
   */
  async getPmDaySchedule(date: string, category?: string) {
    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

    const qb = this.consumableMasterRepository
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL')
      .andWhere('c.useYn = :yn', { yn: 'Y' })
      .andWhere('c.nextReplaceAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay });

    if (category) {
      qb.andWhere('c.category = :category', { category });
    }

    qb.orderBy('c.status', 'DESC').addOrderBy('c.consumableCode', 'ASC');

    return qb.getMany();
  }

  /**
   * 소모품 현황 통계
   */
  async getConsumableStats() {
    // 상태별 통계
    const statusStats = await this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .select('consumable.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('consumable.deletedAt IS NULL')
      .andWhere('consumable.useYn = :useYn', { useYn: 'Y' })
      .groupBy('consumable.status')
      .getRawMany();

    // 카테고리별 통계
    const categoryStats = await this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .select('consumable.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('consumable.deletedAt IS NULL')
      .andWhere('consumable.useYn = :useYn', { useYn: 'Y' })
      .groupBy('consumable.category')
      .getRawMany();

    // 전체 개수
    const totalCount = await this.consumableMasterRepository.count({
      where: { deletedAt: IsNull(), useYn: 'Y' },
    });

    return {
      total: totalCount,
      byStatus: statusStats.map((s) => ({
        status: s.status,
        count: parseInt(s.count, 10),
      })),
      byCategory: categoryStats.map((c) => ({
        category: c.category ?? 'UNKNOWN',
        count: parseInt(c.count, 10),
      })),
    };
  }
}
