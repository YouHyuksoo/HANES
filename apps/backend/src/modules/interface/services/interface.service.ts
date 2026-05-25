/**
 * @file src/modules/interface/services/interface.service.ts
 * @description ERP 인터페이스 비즈니스 로직 서비스
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In, EntityManager } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { OracleService } from '../../../common/services/oracle.service';
import { InterLog } from '../../../entities/inter-log.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import {
  InterLogQueryDto,
  CreateInterLogDto,
  JobOrderInboundDto,
  BomSyncDto,
  PartSyncDto,
  ProdResultOutboundDto,
} from '../dto/interface.dto';

@Injectable()
export class InterfaceService {
  private readonly logger = new Logger(InterfaceService.name);

  constructor(
    @InjectRepository(InterLog)
    private readonly interLogRepository: Repository<InterLog>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepository: Repository<BomMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly tx: TransactionService,
    private readonly oracleService: OracleService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private applyTenantFilter<T extends { andWhere: (condition: string, parameters?: Record<string, unknown>) => T }>(
    queryBuilder: T,
    alias: string,
    company?: string,
    plant?: string,
  ) {
    if (company) {
      queryBuilder.andWhere(`${alias}.company = :company`, { company });
    }
    if (plant) {
      queryBuilder.andWhere(`${alias}.plant = :plant`, { plant });
    }
    return queryBuilder;
  }

  /** 오늘 날짜 기준 다음 SEQ 번호 조회 */
  private async getNextSeq(manager: EntityManager, transDate: Date): Promise<number> {
    const dateStr = transDate.toISOString().slice(0, 10);
    const result = await manager.query(
      `SELECT NVL(MAX("SEQ"), 0) + 1 AS "nextSeq" FROM "INTER_LOGS" WHERE "TRANS_DATE" = TO_DATE(:1, 'YYYY-MM-DD')`,
      [dateStr],
    );
    return result[0].nextSeq;
  }

  // ============================================================================
  // 인터페이스 로그 관리
  // ============================================================================

  async findAllLogs(query: InterLogQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, direction, messageType, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(direction && { direction }),
      ...(messageType && { messageType }),
      ...(status && { status }),
      ...(startDate && endDate && {
        createdAt: Between(new Date(startDate), new Date(endDate)),
      }),
    };

    const [data, total] = await Promise.all([
      this.interLogRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.interLogRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findLogById(transDate: Date, seq: number, company?: string, plant?: string) {
    const log = await this.interLogRepository.findOne({
      where: { transDate, seq, ...this.tenantWhere(company, plant) },
    });

    if (!log) {
      throw new NotFoundException(`인터페이스 로그를 찾을 수 없습니다: ${transDate}/${seq}`);
    }

    return log;
  }

  async createLog(dto: CreateInterLogDto, company?: string, plant?: string) {
    const transDate = new Date();
    transDate.setHours(0, 0, 0, 0);

    return this.tx.run(async (queryRunner) => {
      await queryRunner.manager.query('LOCK TABLE "INTER_LOGS" IN EXCLUSIVE MODE');
      const seq = await this.getNextSeq(queryRunner.manager, transDate);

      const log = queryRunner.manager.create(InterLog, {
        transDate,
        seq,
        direction: dto.direction,
        messageType: dto.messageType,
        interfaceId: dto.interfaceId,
        payload: dto.payload ? JSON.stringify(dto.payload) : null,
        status: 'PENDING',
        company,
        plant,
      });

      return queryRunner.manager.save(InterLog, log);
    });
  }

  async updateLogStatus(transDate: Date, seq: number, status: string, errorMsg?: string, company?: string, plant?: string) {
    await this.findLogById(transDate, seq, company, plant);

    const updateData: Partial<InterLog> = { status };
    if (errorMsg) updateData.errorMsg = errorMsg;
    if (status === 'SUCCESS') updateData.recvAt = new Date();

    await this.interLogRepository.update({ transDate, seq, ...this.tenantWhere(company, plant) }, updateData);
    return this.findLogById(transDate, seq, company, plant);
  }

  async retryLog(transDate: Date, seq: number, company?: string, plant?: string) {
    const log = await this.findLogById(transDate, seq, company, plant);
    const pk = { transDate: log.transDate, seq: log.seq, ...this.tenantWhere(company, plant) };

    if (log.status !== 'FAIL') {
      throw new BadRequestException('실패한 로그만 재시도할 수 있습니다.');
    }

    // 재시도 횟수 증가
    await this.interLogRepository.update(pk, {
      status: 'RETRY',
      retryCount: log.retryCount + 1,
    });

    // 실제 전송 로직 (타입별로 분기)
    try {
      if (log.direction === 'OUT') {
        await this.processOutbound(log.messageType, log.payload ? JSON.parse(log.payload) : {});
      }

      await this.interLogRepository.update(pk, {
        status: 'SUCCESS',
        recvAt: new Date(),
      });

      return this.findLogById(transDate, seq, company, plant);
    } catch (error) {
      await this.interLogRepository.update(pk, {
        status: 'FAIL',
        errorMsg: error instanceof Error ? error.message : '알 수 없는 오류',
      });
      return this.findLogById(transDate, seq, company, plant);
    }
  }

  async bulkRetry(logKeys: { transDate: Date; seq: number }[], company?: string, plant?: string) {
    const results = await Promise.all(
      logKeys.map(async (key) => {
        try {
          await this.retryLog(key.transDate, key.seq, company, plant);
          return { transDate: key.transDate, seq: key.seq, success: true };
        } catch (error) {
          return { transDate: key.transDate, seq: key.seq, success: false, error: error instanceof Error ? error.message : '오류' };
        }
      })
    );

    return results;
  }

  // ============================================================================
  // Inbound 처리 (ERP → MES)
  // ============================================================================

  async receiveJobOrder(dto: JobOrderInboundDto, company?: string, plant?: string) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'JOB_ORDER',
      interfaceId: dto.erpOrderNo,
      payload: dto as unknown as Record<string, unknown>,
    }, company, plant);

    try {
      // 품목 확인
      const part = await this.partMasterRepository.findOne({
        where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
      });

      if (!part) {
        throw new BadRequestException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);
      }

      // 작업지시 생성
      const jobOrder = this.jobOrderRepository.create({
        orderNo: dto.erpOrderNo,
        itemCode: part.itemCode,
        planQty: dto.planQty,
        lineCode: dto.lineCode,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        erpSyncYn: 'Y',
        company,
        plant,
      });

      await this.jobOrderRepository.save(jobOrder);

      await this.updateLogStatus(log.transDate, log.seq, 'SUCCESS', undefined, company, plant);

      return jobOrder;
    } catch (error) {
      await this.updateLogStatus(
        log.transDate,
        log.seq,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류',
        company,
        plant,
      );
      throw error;
    }
  }

  async syncBom(dtos: BomSyncDto[], company?: string, plant?: string) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'BOM_SYNC',
      payload: { items: dtos } as unknown as Record<string, unknown>,
    }, company, plant);

    try {
      // 관련 품목코드 일괄 선조회 (N+1 제거)
      const allItemCodes = [...new Set(dtos.flatMap((d) => [d.parentItemCode, d.childItemCode]))];
      const allParts = allItemCodes.length > 0
        ? await this.partMasterRepository.find({ where: { itemCode: In(allItemCodes), ...this.tenantWhere(company, plant) } })
        : [];
      const partMap = new Map(allParts.map((p) => [p.itemCode, p]));

      // 기존 BOM 일괄 선조회 (N+1 제거)
      const bomKeys = dtos.map((d) => ({
        parentItemCode: d.parentItemCode,
        childItemCode: d.childItemCode,
        revision: d.revision ?? 'A',
        ...this.tenantWhere(company, plant),
      }));
      const existingBoms = bomKeys.length > 0
        ? await this.bomMasterRepository.find({ where: bomKeys })
        : [];
      const bomKeySet = new Set(
        existingBoms.map((b) => `${b.parentItemCode}::${b.childItemCode}::${b.revision}`),
      );

      const results = [];
      for (const dto of dtos) {
        const parentPart = partMap.get(dto.parentItemCode);
        const childPart = partMap.get(dto.childItemCode);

        if (!parentPart || !childPart) {
          results.push({ success: false, dto, error: '품목을 찾을 수 없습니다' });
          continue;
        }

        const rev = dto.revision ?? 'A';
        const key = `${parentPart.itemCode}::${childPart.itemCode}::${rev}`;

        if (bomKeySet.has(key)) {
          await this.bomMasterRepository.update(
            { parentItemCode: parentPart.itemCode, childItemCode: childPart.itemCode, revision: rev, ...this.tenantWhere(company, plant) },
            { qtyPer: dto.qtyPer, ecoNo: dto.ecoNo },
          );
        } else {
          const newBom = this.bomMasterRepository.create({
            parentItemCode: parentPart.itemCode,
            childItemCode: childPart.itemCode,
            qtyPer: dto.qtyPer,
            revision: rev,
            ecoNo: dto.ecoNo,
            company,
            plant,
          });
          await this.bomMasterRepository.save(newBom);
          bomKeySet.add(key);
        }

        results.push({ success: true, dto });
      }

      await this.updateLogStatus(log.transDate, log.seq, 'SUCCESS', undefined, company, plant);

      return results;
    } catch (error) {
      await this.updateLogStatus(
        log.transDate,
        log.seq,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류',
        company,
        plant,
      );
      throw error;
    }
  }

  async syncPart(dtos: PartSyncDto[], company?: string, plant?: string) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'PART_SYNC',
      payload: { items: dtos } as unknown as Record<string, unknown>,
    }, company, plant);

    try {
      // 기존 품목 일괄 선조회 (N+1 제거)
      const itemCodes = dtos.map((d) => d.itemCode);
      const existingParts = itemCodes.length > 0
        ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
        : [];
      const existingSet = new Set(existingParts.map((p) => p.itemCode));

      const results = [];
      for (const dto of dtos) {
        if (existingSet.has(dto.itemCode)) {
          await this.partMasterRepository.update(
            { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
            {
              itemName: dto.itemName,
              itemType: dto.itemType,
              spec: dto.spec,
              unit: dto.unit ?? 'EA',
              drawNo: dto.drawNo,
              customer: dto.customer,
            },
          );
        } else {
          const newPart = this.partMasterRepository.create({
            itemCode: dto.itemCode,
            itemName: dto.itemName,
            itemType: dto.itemType,
            spec: dto.spec,
            unit: dto.unit ?? 'EA',
            drawNo: dto.drawNo,
            customer: dto.customer,
            company,
            plant,
          });
          await this.partMasterRepository.save(newPart);
          existingSet.add(dto.itemCode);
        }

        results.push({ success: true, itemCode: dto.itemCode });
      }

      await this.updateLogStatus(log.transDate, log.seq, 'SUCCESS', undefined, company, plant);

      return results;
    } catch (error) {
      await this.updateLogStatus(
        log.transDate,
        log.seq,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류',
        company,
        plant,
      );
      throw error;
    }
  }

  // ============================================================================
  // Outbound 처리 (MES → ERP)
  // ============================================================================

  async sendProdResult(dto: ProdResultOutboundDto, company?: string, plant?: string) {
    const log = await this.createLog({
      direction: 'OUT',
      messageType: 'PROD_RESULT',
      interfaceId: dto.orderNo,
      payload: dto as any,
    }, company, plant);

    try {
      // 실제 ERP 전송 로직 자리. 전송 어댑터가 연결되기 전까지는 로그만 남긴다.
      await this.processOutbound('PROD_RESULT', dto);

      // 작업지시 동기화 상태 업데이트
      const jobOrder = await this.jobOrderRepository.findOne({
        where: { orderNo: dto.orderNo, ...this.tenantWhere(company, plant) },
      });

      if (jobOrder) {
        await this.jobOrderRepository.update(
          { orderNo: jobOrder.orderNo, ...this.tenantWhere(company, plant) },
          { erpSyncYn: 'Y' },
        );
      }

      await this.updateLogStatus(log.transDate, log.seq, 'SUCCESS', undefined, company, plant);

      return { success: true, transDate: log.transDate, seq: log.seq };
    } catch (error) {
      await this.updateLogStatus(
        log.transDate,
        log.seq,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류',
        company,
        plant,
      );
      throw error;
    }
  }

  private async processOutbound(messageType: string, payload: Record<string, any>) {
    // 실제로는 HTTP 요청이나 메시지 큐로 ERP에 전송
    this.logger.log(`[${messageType}] ERP 전송: ${JSON.stringify(payload)}`);

    return true;
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getSummary(company?: string, plant?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const statusQb = this.applyTenantFilter(
      this.interLogRepository
        .createQueryBuilder('log')
        .select('COUNT(*)', 'total')
        .addSelect("SUM(CASE WHEN log.createdAt >= :today THEN 1 ELSE 0 END)", 'todayCount')
        .addSelect("SUM(CASE WHEN log.status = 'PENDING' THEN 1 ELSE 0 END)", 'pending')
        .addSelect("SUM(CASE WHEN log.status = 'FAIL' THEN 1 ELSE 0 END)", 'failed')
        .setParameter('today', today),
      'log',
      company,
      plant,
    );
    const byTypeQb = this.applyTenantFilter(
      this.interLogRepository
        .createQueryBuilder('log')
        .select('log.messageType', 'messageType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.messageType'),
      'log',
      company,
      plant,
    );
    const byDirectionQb = this.applyTenantFilter(
      this.interLogRepository
        .createQueryBuilder('log')
        .select('log.direction', 'direction')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.direction'),
      'log',
      company,
      plant,
    );

    // 4번 count → 1번 집계 쿼리로 통합 + 타입/방향별 집계는 병렬 유지
    const [statusCounts, byType, byDirection] = await Promise.all([
      statusQb.getRawOne(),
      byTypeQb.getRawMany(),
      byDirectionQb.getRawMany(),
    ]);
    const total = Number(statusCounts.total) || 0;
    const todayCount = Number(statusCounts.todayCount) || 0;
    const pending = Number(statusCounts.pending) || 0;
    const failed = Number(statusCounts.failed) || 0;

    return {
      total,
      todayCount,
      pending,
      failed,
      byType: byType.map((t) => ({
        messageType: t.messageType,
        count: Number(t.count),
      })),
      byDirection: byDirection.map((d) => ({
        direction: d.direction,
        count: Number(d.count),
      })),
    };
  }

  async getFailedLogs(company?: string, plant?: string) {
    return this.interLogRepository.find({
      where: { status: 'FAIL', ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getRecentLogs(limit: number = 20, company?: string, plant?: string) {
    return this.interLogRepository.find({
      where: this.tenantWhere(company, plant),
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ============================================================================
  // 스케줄러용 래퍼 메서드
  // ============================================================================

  /**
   * 스케줄러용: PENDING 상태 BOM 동기화 로그를 조회 후 재시도
   * @returns 처리 건수
   */
  async scheduledSyncBom(company?: string, plant?: string): Promise<{ affectedRows: number }> {
    try {
      const pendingLogs = await this.interLogRepository.find({
        where: { status: 'PENDING', messageType: 'BOM_SYNC', ...this.tenantWhere(company, plant) },
        order: { createdAt: 'ASC' },
        take: 50,
      });

      if (!pendingLogs || pendingLogs.length === 0) {
        return { affectedRows: 0 };
      }

      let processed = 0;
      for (const log of pendingLogs) {
        try {
          if (log.payload) {
            const payload = JSON.parse(log.payload);
            if (payload.items && Array.isArray(payload.items)) {
              await this.syncBom(payload.items, log.company ?? company, log.plant ?? plant);
            }
          }
          processed++;
        } catch (error: unknown) {
          this.logger.warn(
            `BOM 동기화 재처리 실패 (seq=${log.seq}): ${error instanceof Error ? error.message : '오류'}`,
          );
        }
      }

      return { affectedRows: processed };
    } catch (error: unknown) {
      this.logger.error(
        `scheduledSyncBom 실패: ${error instanceof Error ? error.message : '오류'}`,
      );
      return { affectedRows: 0 };
    }
  }

  /**
   * ERP → MES 품목 마스터 동기화 (스케줄러/수동 공용)
   * IF_ITEM_MASTER 프로시저 호출 — 변경 건만 MERGE, 미변경 건 SKIP
   */
  async scheduledSyncItemMaster(): Promise<{ affectedRows: number; insert: number; update: number }> {
    this.logger.log('ERP 품목 마스터 동기화 시작 (IF_ITEM_MASTER)');

    const out = await this.oracleService.callProcScalar(
      'IF_ITEM_MASTER',
      [
        { name: 'n_return', type: 'NUMBER' },
        { name: 'v_return', type: 'STRING', maxSize: 500 },
        { name: 'n_insert', type: 'NUMBER' },
        { name: 'n_update', type: 'NUMBER' },
      ],
    );

    if (Number(out['n_return']) !== 0) {
      throw new InternalServerErrorException(`IF_ITEM_MASTER 실패: ${out['v_return']}`);
    }

    const insert = Number(out['n_insert'] ?? 0);
    const update = Number(out['n_update'] ?? 0);

    this.logger.log(`ERP 품목 마스터 동기화 완료 — INSERT: ${insert}, UPDATE: ${update}`);

    return { affectedRows: insert + update, insert, update };
  }

  /**
   * 스케줄러용: 실패 로그를 자동 조회 후 bulkRetry() 호출
   * @returns 처리 건수
   */
  async scheduledBulkRetry(company?: string, plant?: string): Promise<{ affectedRows: number }> {
    try {
      const failedLogs = await this.getFailedLogs(company, plant);
      if (!failedLogs || failedLogs.length === 0) {
        return { affectedRows: 0 };
      }

      const keys = failedLogs.map((l) => ({
        transDate: l.transDate,
        seq: l.seq,
      }));
      const results = await this.bulkRetry(keys, company, plant);
      return { affectedRows: Array.isArray(results) ? results.length : 0 };
    } catch (error: unknown) {
      this.logger.error(
        `scheduledBulkRetry 실패: ${error instanceof Error ? error.message : '오류'}`,
      );
      return { affectedRows: 0 };
    }
  }
}
