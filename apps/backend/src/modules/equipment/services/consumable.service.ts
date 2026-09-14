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
import { Repository, DataSource, In, QueryRunner } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { User } from '../../../entities/user.entity';
import {
  EquipCreateConsumableDto,
  EquipUpdateConsumableDto,
  ConsumableQueryDto,
  EquipCreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
  UnmountFromEquipDto,
  SetRepairDto,
} from '../dto/consumable.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { resolveConsumableLifeStatus } from '@harness/shared';

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
    @InjectRepository(ConsumableStock)
    private readonly consumableStockRepository: Repository<ConsumableStock>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
  ) {}

  /** CONSUMABLE_LOGS 테이블 다음 SEQ */
  private async getNextLogSeq(qr?: QueryRunner): Promise<number> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  /** CONSUMABLE_MOUNT_LOGS 테이블 다음 SEQ */
  private async getNextMountSeq(qr?: QueryRunner): Promise<number> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      `SELECT SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
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

    const queryBuilder = this.consumableMasterRepository.createQueryBuilder('consumable');

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
      queryBuilder.andWhere('consumable.vendor LIKE :vendor', { vendor: `%${vendor}%` });
    }
    if (useYn) {
      queryBuilder.andWhere('consumable.useYn = :useYn', { useYn });
    }
    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(consumable.consumableCode LIKE :searchCode OR consumable.consumableName LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }
    if (nextReplaceBefore) {
      queryBuilder.andWhere('consumable.nextReplaceAt <= :nextReplaceBefore', {
        nextReplaceBefore: parseDateEnd(nextReplaceBefore)!,
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
  async findById(consumableCode: string, company?: string, plant?: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode, ...this.tenantWhere(company, plant) },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${consumableCode}`);
    }
    this.assertSameTenant('소모품', { company, plant }, consumable);

    // Get recent logs with worker info
    const logs = await this.consumableLogRepository
      .createQueryBuilder('log')
      .where('log.consumableCode = :consumableCode', { consumableCode })
      .orderBy('log.createdAt', 'DESC')
      .take(10)
      .getMany();

    return {
      ...consumable,
      consumableLogs: logs,
    };
  }

  /**
   * 소모품 단건 조회 (코드)
   */
  async findByCode(consumableCode: string, company?: string, plant?: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode, ...this.tenantWhere(company, plant) },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${consumableCode}`);
    }
    this.assertSameTenant('소모품', { company, plant }, consumable);

    return consumable;
  }

  /**
   * 소모품 생성
   */
  async create(dto: EquipCreateConsumableDto, company?: string, plant?: string) {
    // 중복 코드 확인
    const existing = await this.consumableMasterRepository.findOne({
      where: { consumableCode: dto.consumableCode, ...this.tenantWhere(company, plant) },
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
      lastReplaceAt: parseDateStart(dto.lastReplaceAt),
      nextReplaceAt: parseDateStart(dto.nextReplaceAt),
      unitPrice: dto.unitPrice,
      vendor: dto.vendor,
      status: dto.status ?? 'NORMAL',
      useYn: dto.useYn ?? 'Y',
      company: company ?? null,
      plant: plant ?? null,
    });

    return this.consumableMasterRepository.save(consumable);
  }

  async update(consumableCode: string, dto: EquipUpdateConsumableDto, company?: string, plant?: string) {
    await this.findById(consumableCode, company, plant);

    const updateData: Partial<ConsumableMaster> = {};

    if (dto.name !== undefined) updateData.consumableName = dto.name;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.expectedLife !== undefined) updateData.expectedLife = dto.expectedLife;
    if (dto.currentCount !== undefined) updateData.currentCount = dto.currentCount;
    if (dto.warningCount !== undefined) updateData.warningCount = dto.warningCount;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.lastReplaceAt !== undefined) updateData.lastReplaceAt = parseDateStart(dto.lastReplaceAt);
    if (dto.nextReplaceAt !== undefined) updateData.nextReplaceAt = parseDateStart(dto.nextReplaceAt);
    if (dto.unitPrice !== undefined) updateData.unitPrice = dto.unitPrice;
    if (dto.vendor !== undefined) updateData.vendor = dto.vendor;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.consumableMasterRepository.update(
      { consumableCode, ...this.tenantWhere(company, plant) },
      updateData,
    );

    // 상태 자동 업데이트
    await this.updateWarningStatus(consumableCode, company, plant);

    return this.findById(consumableCode, company, plant);
  }

  /**
   * 소모품 삭제 (소프트 삭제)
   */
  async delete(consumableCode: string, company?: string, plant?: string) {
    await this.findById(consumableCode, company, plant);

    await this.consumableMasterRepository.delete({ consumableCode, ...this.tenantWhere(company, plant) });
    return { consumableCode, deleted: true };
  }

  // =============================================
  // 이미지 관리
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

  // =============================================
  // 수명 관리
  // =============================================

  /**
   * 사용 횟수 증가
   */
  async increaseCount(consumableCode: string, dto: IncreaseCountDto, company?: string, plant?: string) {
    const consumable = await this.findById(consumableCode, company, plant);
    const newCount = consumable.currentCount + dto.count;

    await this.consumableMasterRepository.update(
      { consumableCode, ...this.tenantWhere(company, plant) },
      { currentCount: newCount },
    );

    // 상태 자동 업데이트
    await this.updateWarningStatus(consumableCode, company, plant);

    this.logger.log(
      `소모품 사용 횟수 증가: ${consumable.consumableCode} (${consumable.currentCount} -> ${newCount})`
    );

    return this.findById(consumableCode, company, plant);
  }

  /**
   * 교체 등록
   */
  async registerReplacement(consumableCode: string, dto: RegisterReplacementDto, company?: string, plant?: string) {
    const consumable = await this.findById(consumableCode, company, plant);

    await this.tx.run(async (queryRunner) => {
      // 소모품 정보 업데이트
      await queryRunner.manager.update(
        ConsumableMaster,
        { consumableCode, ...this.tenantWhere(company, plant) },
        {
          currentCount: 0,
          lastReplaceAt: new Date(),
          nextReplaceAt: parseDateStart(dto.nextReplaceAt),
          status: 'NORMAL',
        },
      );

      // 입고 로그 생성
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeq = await this.getNextLogSeq(queryRunner);
      await queryRunner.manager.save(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: consumableCode,
        logType: 'IN',
        qty: 1,
        workerId: dto.workerId,
        remark: dto.remark ?? '교체 입고',
        company: company ?? consumable.company ?? null,
        plant: plant ?? consumable.plant ?? null,
      });
    });

    this.logger.log(
      `소모품 교체 등록: ${consumable.consumableCode}, 이전 사용 횟수: ${consumable.currentCount}`
    );

    return this.findById(consumableCode, company, plant);
  }

  /**
   * 경고 상태 자동 업데이트
   */
  async updateWarningStatus(consumableCode: string, company?: string, plant?: string) {
    const consumable = await this.consumableMasterRepository.findOne({
      where: { consumableCode, ...this.tenantWhere(company, plant) },
    });

    if (!consumable) return;

    // 수명 상태 재판정 — shared 공통 규칙(수명 외 상태는 덮어쓰지 않음)
    const newStatus = resolveConsumableLifeStatus(
      consumable.currentCount, consumable.warningCount, consumable.expectedLife, consumable.status,
    );

    if (consumable.status !== newStatus) {
      await this.consumableMasterRepository.update(
        { consumableCode, ...this.tenantWhere(company, plant) },
        { status: newStatus },
      );

      this.logger.log(
        `소모품 상태 자동 변경: ${consumable.consumableCode} (${consumable.status} -> ${newStatus})`
      );

      // 설비 인터락은 실물 롯트(CONSUMABLE_STOCKS) 기준으로 생산실적 저장 시 처리한다.
      // (ProdResultService.accrueConsumableUsageInTx — 2026-09 인스턴스 전환)
    }
  }

  // =============================================
  // 소모품 로그 관리
  // =============================================

  /**
   * 소모품 로그 생성
   */
  async createLog(dto: EquipCreateConsumableLogDto, company?: string, plant?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 검증, SEQ 채번, 로그 INSERT, (SCRAP이면) 마스터 useYn='N' 까지를 하나의 트랜잭션에 묶는다.
    // - findById 를 tx 안으로 옮겨 read-modify-write race condition 차단.
    // - SCRAP 마스터 갱신은 항상 (consumable.company, consumable.plant)로 잠금 → 호출자가 tenant 헤더를
    //   생략해도 다른 테넌트의 동일 consumableCode 마스터가 함께 비활성화되지 않는다.
    const { saved, consumable } = await this.tx.run(async (queryRunner) => {
      const consumable = await queryRunner.manager.findOne(ConsumableMaster, {
        where: { consumableCode: dto.consumableId, ...this.tenantWhere(company, plant) },
      });
      if (!consumable) {
        throw new NotFoundException(`소모품을 찾을 수 없습니다: ${dto.consumableId}`);
      }
      this.assertSameTenant('소모품', { company, plant }, consumable);

      const logSeq = await this.getNextLogSeq(queryRunner);

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: dto.consumableId,
        logType: dto.logType,
        qty: dto.qty ?? 1,
        workerId: dto.workerId,
        remark: dto.remark,
        company: company ?? consumable.company ?? null,
        plant: plant ?? consumable.plant ?? null,
      });
      const persisted = await queryRunner.manager.save(ConsumableLog, log);

      if (dto.logType === 'SCRAP') {
        // tenantWhere 가 빈 객체가 되어도 마스터에서 확보한 tenant 로 강제 한정한다.
        await queryRunner.manager.update(
          ConsumableMaster,
          {
            consumableCode: dto.consumableId,
            company: consumable.company,
            plant: consumable.plant,
          },
          { useYn: 'N' },
        );
      }

      return { saved: persisted, consumable };
    });

    if (dto.logType === 'SCRAP') {
      this.logger.log(`소모품 폐기 처리: ${consumable.consumableCode}`);
    }

    // 작업자 표시용 정보는 트랜잭션 밖에서 조회하며, 실패해도 본 응답을 깨트리지 않는다.
    // (post-commit 예외 → caller 가 같은 SCRAP 을 재시도해 중복 로그가 쌓이던 회귀 방지)
    let workerInfo = null;
    if (dto.workerId) {
      try {
        const worker = await this.userRepository.findOne({
          where: { email: dto.workerId },
          select: ['email', 'name', 'empNo'],
        });
        workerInfo = worker || null;
      } catch (error: unknown) {
        this.logger.warn(
          `소모품 로그 응답용 worker 조회 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        );
      }
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
  async findLogs(query: ConsumableLogQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 20,
      consumableId,
      logType,
      fromDate,
      toDate,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.consumableLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect(
        ConsumableMaster,
        'consumable',
        'log.consumableCode = consumable.consumableCode AND log.company = consumable.company AND log.plant = consumable.plant',
      )
      .select([
        'log',
        'consumable.consumableCode AS consumable_code',
        'consumable.consumableName AS consumable_name',
        'consumable.category AS consumable_category',
      ]);

    if (consumableId) {
      queryBuilder.andWhere('log.consumableCode = :consumableId', { consumableId });
    }
    if (company) {
      queryBuilder.andWhere('log.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('log.plant = :plant', { plant });
    }
    if (logType) {
      queryBuilder.andWhere('log.logType = :logType', { logType });
    }
    if (fromDate) {
      queryBuilder.andWhere("log.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere("log.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });
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
  async findLogsByConsumableId(consumableCode: string, company?: string, plant?: string) {
    await this.findById(consumableCode, company, plant); // 존재 확인

    return this.consumableLogRepository.find({
      where: { consumableCode, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });
  }

  // =============================================
  // 필터링 조회
  // =============================================

  /**
   * 카테고리별 소모품 목록 조회
   */
  async findByCategory(category: string, company?: string, plant?: string) {
    return this.consumableMasterRepository.find({
      where: { category, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { consumableCode: 'ASC' },
    });
  }

  /**
   * 교체 예정 목록 조회
   */
  async findReplacementSchedule(days: number = 30, company?: string, plant?: string) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const qb = this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .where('consumable.useYn = :useYn', { useYn: 'Y' })
      .andWhere(
        '(consumable.status IN (:...statuses) OR consumable.nextReplaceAt <= :targetDate)',
        { statuses: ['WARNING', 'REPLACE'], targetDate }
      )
      .orderBy('consumable.status', 'DESC') // REPLACE > WARNING > NORMAL
      .addOrderBy('consumable.nextReplaceAt', 'ASC');

    if (company) qb.andWhere('consumable.company = :company', { company });
    if (plant) qb.andWhere('consumable.plant = :plant', { plant });

    return qb.getMany();
  }

  /**
   * 경고/교체필요 상태 소모품 목록 조회
   */
  async findWarningConsumables(company?: string, plant?: string) {
    return this.consumableMasterRepository.find({
      where: {
        status: In(['WARNING', 'REPLACE']),
        useYn: 'Y',
        ...this.tenantWhere(company, plant),
      },
      order: { status: 'DESC' },
    });
  }

  // =============================================
  // 통계
  // =============================================

  // =============================================
  // 소모품 장착현황 / 강제해제 / 수리 관리 — 실물 롯트(conUid) 기준
  // =============================================
  //
  // 장착(MOUNT)은 현장 키오스크 바코드 스캔에서만 일어난다(KioskConsumableService.scanMount).
  // 이 서비스는 장착된 롯트를 조회하고, 현장에서 내리지 못한 건을 강제 해제하거나
  // 수리 상태로 전환하는 예외 창구 역할만 한다.
  // (2026-09 전환: 소모품 마스터 장착(OPER_STATUS / MOUNTED_EQUIP_ID) 경로 폐기)

  /** 해제 후 허용 상태 */
  private static readonly UNMOUNT_RETURN_STATUSES = ['PROC_WAIT', 'ACTIVE', 'REPAIR'] as const;

  /** 장착 이력 1건 기록 (MOUNT_DATE + SEQ 복합키) */
  private async writeMountLog(
    queryRunner: QueryRunner,
    row: {
      conUid: string;
      consumableCode: string;
      equipCode: string;
      action: 'MOUNT' | 'UNMOUNT';
      workerId?: string | null;
      remark?: string | null;
      company: string;
      plant: string;
    },
  ) {
    const mountDate = new Date();
    mountDate.setHours(0, 0, 0, 0);
    const seq = await this.getNextMountSeq(queryRunner);
    await queryRunner.manager.save(ConsumableMountLog, {
      mountDate,
      seq,
      conUid: row.conUid,
      consumableCode: row.consumableCode,
      equipCode: row.equipCode,
      action: row.action,
      workerId: row.workerId ?? null,
      remark: row.remark ?? null,
      company: row.company,
      plant: row.plant,
    });
  }

  private async findStockOrFail(conUid: string, company?: string, plant?: string) {
    const stock = await this.consumableStockRepository.findOne({
      where: { conUid, ...(company ? { company } : {}), ...(plant ? { plantCd: plant } : {}) },
    });
    if (!stock) {
      throw new NotFoundException(`소모품 롯트를 찾을 수 없습니다: ${conUid}`);
    }
    return stock;
  }

  /**
   * 장착 강제 해제 — 현장에서 내리지 못한 롯트를 관리자가 해제한다.
   * returnTo: PROC_WAIT(공정대기, 기본) / ACTIVE(창고 반납) / REPAIR(수리중)
   */
  async forceUnmount(conUid: string, dto: UnmountFromEquipDto, company?: string, plant?: string) {
    const stock = await this.findStockOrFail(conUid, company, plant);

    if (stock.status !== 'MOUNTED') {
      throw new BadRequestException(
        `장착 상태가 아닌 롯트는 해제할 수 없습니다. 현재 상태: ${stock.status}`,
      );
    }

    const returnTo = dto.returnTo ?? 'PROC_WAIT';
    if (!ConsumableService.UNMOUNT_RETURN_STATUSES.includes(returnTo as never)) {
      throw new BadRequestException(
        `해제 후 상태가 올바르지 않습니다: ${returnTo} (허용: ${ConsumableService.UNMOUNT_RETURN_STATUSES.join(', ')})`,
      );
    }

    const previousEquipCode = stock.mountedEquipCode;

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        ConsumableStock,
        { conUid },
        {
          status: returnTo,
          mountedEquipCode: null,
          // 창고 반납·수리 전환은 공정 배정도 함께 해제한다(공정대기 복귀는 공정 유지)
          ...(returnTo === 'PROC_WAIT' ? {} : { processCode: null }),
        },
      );

      await this.writeMountLog(queryRunner, {
        conUid,
        consumableCode: stock.consumableCode,
        equipCode: previousEquipCode ?? '-',
        action: 'UNMOUNT',
        workerId: dto.workerId,
        remark: dto.remark ?? `강제 해제 → ${returnTo}`,
        company: stock.company,
        plant: stock.plantCd,
      });
    });

    this.logger.log(
      `소모품 강제 해제: ${conUid}(${stock.consumableCode}) ← 설비 ${previousEquipCode ?? '-'} → ${returnTo}`,
    );

    return this.findStockOrFail(conUid, company, plant);
  }

  /** 수리 상태로 전환 (장착 중이면 자동 해제) */
  async setRepairStatus(conUid: string, dto: SetRepairDto, company?: string, plant?: string) {
    const stock = await this.findStockOrFail(conUid, company, plant);

    if (stock.status === 'REPAIR') {
      throw new BadRequestException('이미 수리중인 롯트입니다.');
    }

    await this.tx.run(async (queryRunner) => {
      if (stock.status === 'MOUNTED' && stock.mountedEquipCode) {
        await this.writeMountLog(queryRunner, {
          conUid,
          consumableCode: stock.consumableCode,
          equipCode: stock.mountedEquipCode,
          action: 'UNMOUNT',
          workerId: dto.workerId,
          remark: '수리 전환으로 인한 자동 해제',
          company: stock.company,
          plant: stock.plantCd,
        });
      }

      await queryRunner.manager.update(
        ConsumableStock,
        { conUid },
        { status: 'REPAIR', mountedEquipCode: null, processCode: null },
      );
    });

    this.logger.log(
      `소모품 수리 전환: ${conUid}(${stock.consumableCode}) (이전 상태: ${stock.status})`,
    );

    return this.findStockOrFail(conUid, company, plant);
  }

  /** 수리 완료 → 창고(ACTIVE) 복귀 */
  async completeRepair(conUid: string, dto: SetRepairDto, company?: string, plant?: string) {
    const stock = await this.findStockOrFail(conUid, company, plant);

    if (stock.status !== 'REPAIR') {
      throw new BadRequestException(
        `수리 상태가 아닌 롯트는 복귀할 수 없습니다. 현재 상태: ${stock.status}`,
      );
    }

    await this.consumableStockRepository.update(
      { conUid },
      { status: 'ACTIVE', ...(dto.remark ? { remark: dto.remark } : {}) },
    );

    this.logger.log(`소모품 수리 완료 복귀: ${conUid}(${stock.consumableCode}) → ACTIVE`);

    return this.findStockOrFail(conUid, company, plant);
  }

  /** 장착/해제 이력 조회 — 실물 롯트 기준 */
  async getMountHistory(conUid: string, company?: string, plant?: string) {
    await this.findStockOrFail(conUid, company, plant);

    return this.mountLogRepository.find({
      where: { conUid, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });
  }

  /** 특정 설비에 장착된 소모품 롯트 목록 */
  async findMountedByEquip(equipCode: string, company?: string, plant?: string) {
    return this.consumableStockRepository.find({
      where: {
        mountedEquipCode: equipCode,
        status: 'MOUNTED',
        ...(company ? { company } : {}),
        ...(plant ? { plantCd: plant } : {}),
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
  async getPmCalendarSummary(year: number, month: number, category?: string, company?: string, plant?: string) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // 교체 예정일이 해당 월에 있는 소모품 조회
    const qb = this.consumableMasterRepository
      .createQueryBuilder('c')
      .where('c.useYn = :yn', { yn: 'Y' })
      .andWhere('c.nextReplaceAt IS NOT NULL')
      .andWhere("c.nextReplaceAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate: startDateStr })
      .andWhere("c.nextReplaceAt < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate: endDateStr });

    if (category) {
      qb.andWhere('c.category = :category', { category });
    }
    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

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
  async getPmDaySchedule(date: string, category?: string, company?: string, plant?: string) {
    const qb = this.consumableMasterRepository
      .createQueryBuilder('c')
      .where('c.useYn = :yn', { yn: 'Y' })
      .andWhere("c.nextReplaceAt >= TO_DATE(:date, 'YYYY-MM-DD')", { date })
      .andWhere("c.nextReplaceAt < TO_DATE(:date, 'YYYY-MM-DD') + 1", { date });

    if (category) {
      qb.andWhere('c.category = :category', { category });
    }
    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

    qb.orderBy('c.status', 'DESC').addOrderBy('c.consumableCode', 'ASC');

    return qb.getMany();
  }

  /**
   * 소모품 현황 통계
   */
  async getConsumableStats(company?: string, plant?: string) {
    // 상태별 통계
    const statusQb = this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .select('consumable.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('consumable.useYn = :useYn', { useYn: 'Y' });
    if (company) statusQb.andWhere('consumable.company = :company', { company });
    if (plant) statusQb.andWhere('consumable.plant = :plant', { plant });
    const statusStats = await statusQb.groupBy('consumable.status').getRawMany();

    // 카테고리별 통계
    const categoryQb = this.consumableMasterRepository
      .createQueryBuilder('consumable')
      .select('consumable.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('consumable.useYn = :useYn', { useYn: 'Y' });
    if (company) categoryQb.andWhere('consumable.company = :company', { company });
    if (plant) categoryQb.andWhere('consumable.plant = :plant', { plant });
    const categoryStats = await categoryQb.groupBy('consumable.category').getRawMany();

    // 전체 개수
    const totalCount = await this.consumableMasterRepository.count({
      where: { useYn: 'Y', ...this.tenantWhere(company, plant) },
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
