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
import { ItemMaster } from '../../../entities/item-master.entity';
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
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class InterfaceService {
  private readonly logger = new Logger(InterfaceService.name);

  constructor(
    @InjectRepository(InterLog)
    private readonly interLogRepository: Repository<InterLog>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
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
  private async getNextSeq(manager: EntityManager): Promise<number> {
    const result = await manager.query(
      `SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  // ============================================================================
  // 인터페이스 로그 관리
  // ============================================================================

  private logWithClientId(log: InterLog) {
    const transDate = log.transDate instanceof Date
      ? log.transDate.toISOString()
      : new Date(log.transDate).toISOString();
    return { ...log, id: `${transDate}/${log.seq}` };
  }

  async findAllLogs(query: InterLogQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, direction, messageType, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(direction && { direction }),
      ...(messageType && { messageType }),
      ...(status && { status }),
      ...(fromDate && toDate && {
        createdAt: Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!),
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

    return { data: data.map((log) => this.logWithClientId(log)), total, page, limit };
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
      // SEQ는 Oracle 시퀀스(SEQ_INTER_LOGS)로 채번하므로 LOCK TABLE 불필요.
      const seq = await this.getNextSeq(queryRunner.manager);

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
    // pk 는 caller 가 넘긴 transDate 가 아니라 DB 에서 읽어 온 log.transDate 를 사용한다.
    // (caller 가 ms/timezone 가 다른 Date 를 넘겨도 affected=0 이 되지 않도록.)
    const pk = { transDate: log.transDate, seq: log.seq, ...this.tenantWhere(company, plant) };

    if (log.status !== 'FAIL') {
      throw new BadRequestException('실패한 로그만 재시도할 수 있습니다.');
    }

    // 재시도 횟수 원자적 증가 (read-modify-write lost update 회피).
    // 레거시 행 RETRY_COUNT IS NULL 도 NVL 로 보호 — NULL+1=NULL 회귀 방지.
    const retryUpdate = await this.interLogRepository
      .createQueryBuilder()
      .update()
      .set({
        status: 'RETRY',
        retryCount: () => 'NVL("RETRY_COUNT", 0) + 1',
      })
      .where(pk)
      .execute();
    if (typeof retryUpdate.affected === 'number' && retryUpdate.affected === 0) {
      // pk 가 row 와 silent mismatch (예: transDate 정밀도) 일 때 조용히 무시되던 버그 방지.
      throw new InternalServerErrorException(
        `재시도 카운트 갱신에 실패했습니다. (transDate=${log.transDate}, seq=${log.seq})`,
      );
    }

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
      payload: { ...dto },
    }, company, plant);

    try {
      // 품목 확인
      const part = await this.itemMasterRepository.findOne({
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
        planDate: parseDateStart(dto.planDate),
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
      payload: { items: dtos },
    }, company, plant);

    try {
      // 관련 품목코드 일괄 선조회 (N+1 제거)
      const allItemCodes = [...new Set(dtos.flatMap((d) => [d.parentItemCode, d.childItemCode]))];
      const allParts = allItemCodes.length > 0
        ? await this.itemMasterRepository.find({ where: { itemCode: In(allItemCodes), ...this.tenantWhere(company, plant) } })
        : [];
      const partMap = new Map(allParts.map((p) => [p.itemCode, p]));

      // 기존 BOM 일괄 선조회 (N+1 제거) — PK는 모+자+적용일자(VALID_FROM)
      const toYmd = (v: Date | string | null | undefined): string => {
        if (!v) return '';
        const d = v instanceof Date ? v : new Date(v);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const toLocalDate = (ymd: string): Date => {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const bomPairs = dtos.map((d) => ({
        parentItemCode: d.parentItemCode,
        childItemCode: d.childItemCode,
        ...this.tenantWhere(company, plant),
      }));
      const existingBoms = bomPairs.length > 0
        ? await this.bomMasterRepository.find({ where: bomPairs })
        : [];
      // 정확 매칭(모+자+적용일자)과 페어 매칭(모+자 — validFrom 미지정 DTO용) 두 인덱스
      const bomByExactKey = new Map(existingBoms.map((b) => [`${b.parentItemCode}::${b.childItemCode}::${toYmd(b.validFrom)}`, b]));
      const bomByPair = new Map<string, (typeof existingBoms)[number]>();
      for (const b of existingBoms) {
        const pairKey = `${b.parentItemCode}::${b.childItemCode}`;
        const prev = bomByPair.get(pairKey);
        // 페어 매칭은 적용일자가 가장 최신인 행을 대상으로 갱신
        if (!prev || toYmd(b.validFrom) > toYmd(prev.validFrom)) bomByPair.set(pairKey, b);
      }

      const results = [];
      for (const dto of dtos) {
        const parentPart = partMap.get(dto.parentItemCode);
        const childPart = partMap.get(dto.childItemCode);

        if (!parentPart || !childPart) {
          results.push({ success: false, dto, error: '품목을 찾을 수 없습니다' });
          continue;
        }

        const rev = dto.revision ?? 'A';
        const dtoYmd = dto.validFrom ? toYmd(dto.validFrom) : '';
        const target = dtoYmd
          ? bomByExactKey.get(`${parentPart.itemCode}::${childPart.itemCode}::${dtoYmd}`)
          : bomByPair.get(`${parentPart.itemCode}::${childPart.itemCode}`);

        if (target) {
          await this.bomMasterRepository.update(
            { parentItemCode: parentPart.itemCode, childItemCode: childPart.itemCode, validFrom: toLocalDate(toYmd(target.validFrom)), ...this.tenantWhere(company, plant) },
            { qtyPer: dto.qtyPer, ecoNo: dto.ecoNo, revision: rev },
          );
        } else {
          const validFromYmd = dtoYmd || toYmd(new Date());
          const newBom = this.bomMasterRepository.create({
            parentItemCode: parentPart.itemCode,
            childItemCode: childPart.itemCode,
            qtyPer: dto.qtyPer,
            revision: rev,
            validFrom: toLocalDate(validFromYmd),
            ecoNo: dto.ecoNo,
            company,
            plant,
          });
          await this.bomMasterRepository.save(newBom);
          bomByExactKey.set(`${parentPart.itemCode}::${childPart.itemCode}::${validFromYmd}`, newBom);
          const pairKey = `${parentPart.itemCode}::${childPart.itemCode}`;
          const prev = bomByPair.get(pairKey);
          if (!prev || validFromYmd > toYmd(prev.validFrom)) bomByPair.set(pairKey, newBom);
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
      payload: { items: dtos },
    }, company, plant);

    try {
      // 기존 품목 일괄 선조회 (N+1 제거)
      const itemCodes = dtos.map((d) => d.itemCode);
      const existingParts = itemCodes.length > 0
        ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
        : [];
      const existingSet = new Set(existingParts.map((p) => p.itemCode));

      const results = [];
      for (const dto of dtos) {
        if (existingSet.has(dto.itemCode)) {
          await this.itemMasterRepository.update(
            { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
            {
              itemName: dto.itemName,
              itemType: dto.itemType,
              spec: dto.spec,
              unit: dto.unit ?? 'EA',
              drawNo: dto.drawNo,
            },
          );
        } else {
          const newPart = this.itemMasterRepository.create({
            itemCode: dto.itemCode,
            itemName: dto.itemName,
            // ERP는 품번을 전송하지 않으므로 품목코드로 대체 (PART_NO NOT NULL 보장)
            itemNo: dto.itemCode,
            itemType: dto.itemType,
            spec: dto.spec,
            unit: dto.unit ?? 'EA',
            drawNo: dto.drawNo,
            company,
            plant,
          });
          await this.itemMasterRepository.save(newPart);
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
      payload: {
        orderNo: dto.orderNo,
        goodQty: dto.goodQty,
        ...(dto.defectQty !== undefined ? { defectQty: dto.defectQty } : {}),
        ...(dto.endAt !== undefined ? { endAt: dto.endAt } : {}),
      },
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

  private async processOutbound(messageType: string, payload: object) {
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
      let failed = 0;
      for (const log of pendingLogs) {
        const logPk = {
          transDate: log.transDate,
          seq: log.seq,
          ...this.tenantWhere(log.company, log.plant),
        };
        try {
          if (log.payload) {
            const payload = JSON.parse(log.payload);
            if (payload.items && Array.isArray(payload.items)) {
              await this.syncBom(payload.items, log.company ?? company, log.plant ?? plant);
            }
          }
          // 처리 완료 로그는 SUCCESS 로 전이한다.
          // (전이하지 않으면 PENDING 으로 남아 다음 스케줄마다 동일 BOM 을 중복 재처리한다.)
          await this.interLogRepository.update(logPk, { status: 'SUCCESS', recvAt: new Date() });
          processed++;
        } catch (error: unknown) {
          // 실패 로그는 FAIL 로 전이한다.
          // (PENDING 으로 두면 무한 재시도(poison-pill)되어 큐를 막고, 실패가 성공으로 오인된다.)
          // errorMsg 를 보존해 운영자가 retryLog 로 재시도/원인 추적할 수 있게 한다.
          failed++;
          const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
          await this.interLogRepository.update(logPk, { status: 'FAIL', errorMsg });
          this.logger.warn(`BOM 동기화 재처리 실패 (seq=${log.seq}): ${errorMsg}`);
        }
      }

      if (failed > 0) {
        this.logger.error(
          `BOM 동기화 스케줄 완료 — 성공 ${processed}건, 실패 ${failed}건 (FAIL 전이됨, 재시도 필요)`,
        );
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
