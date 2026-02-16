/**
 * @file src/modules/interface/services/interface.service.ts
 * @description ERP 인터페이스 비즈니스 로직 서비스
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';
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
  ) {}

  // ============================================================================
  // 인터페이스 로그 관리
  // ============================================================================

  async findAllLogs(query: InterLogQueryDto, company?: string) {
    const { page = 1, limit = 10, direction, messageType, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(direction && { direction }),
      ...(messageType && { messageType }),
      ...(status && { status }),
      ...(startDate && endDate && {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
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

  async findLogById(id: string) {
    const log = await this.interLogRepository.findOne({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(`인터페이스 로그를 찾을 수 없습니다: ${id}`);
    }

    return log;
  }

  async createLog(dto: CreateInterLogDto) {
    const log = this.interLogRepository.create({
      direction: dto.direction,
      messageType: dto.messageType,
      interfaceId: dto.interfaceId,
      payload: dto.payload ? JSON.stringify(dto.payload) : null,
      status: 'PENDING',
    });

    return this.interLogRepository.save(log);
  }

  async updateLogStatus(id: string, status: string, errorMsg?: string) {
    await this.findLogById(id);

    const updateData: Partial<InterLog> = { status };
    if (errorMsg) updateData.errorMsg = errorMsg;
    if (status === 'SUCCESS') updateData.recvAt = new Date();

    await this.interLogRepository.update(id, updateData);
    return this.findLogById(id);
  }

  async retryLog(id: string) {
    const log = await this.findLogById(id);

    if (log.status !== 'FAIL') {
      throw new BadRequestException('실패한 로그만 재시도할 수 있습니다.');
    }

    // 재시도 횟수 증가
    await this.interLogRepository.update(id, {
      status: 'RETRY',
      retryCount: log.retryCount + 1,
    });

    // 실제 전송 로직 (타입별로 분기)
    try {
      if (log.direction === 'OUT') {
        await this.processOutbound(log.messageType, log.payload ? JSON.parse(log.payload) : {});
      }

      await this.interLogRepository.update(id, {
        status: 'SUCCESS',
        recvAt: new Date(),
      });

      return this.findLogById(id);
    } catch (error) {
      await this.interLogRepository.update(id, {
        status: 'FAIL',
        errorMsg: error instanceof Error ? error.message : '알 수 없는 오류',
      });
      return this.findLogById(id);
    }
  }

  async bulkRetry(logIds: string[]) {
    const results = await Promise.all(
      logIds.map(async (id) => {
        try {
          await this.retryLog(id);
          return { id, success: true };
        } catch (error) {
          return { id, success: false, error: error instanceof Error ? error.message : '오류' };
        }
      })
    );

    return results;
  }

  // ============================================================================
  // Inbound 처리 (ERP → MES)
  // ============================================================================

  async receiveJobOrder(dto: JobOrderInboundDto) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'JOB_ORDER',
      interfaceId: dto.erpOrderNo,
      payload: dto as any,
    });

    try {
      // 품목 확인
      const part = await this.partMasterRepository.findOne({
        where: { partCode: dto.partCode },
      });

      if (!part) {
        throw new BadRequestException(`품목을 찾을 수 없습니다: ${dto.partCode}`);
      }

      // 작업지시 생성
      const jobOrder = this.jobOrderRepository.create({
        orderNo: dto.erpOrderNo,
        partId: part.id,
        planQty: dto.planQty,
        lineCode: dto.lineCode,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        erpSyncYn: 'Y',
      });

      await this.jobOrderRepository.save(jobOrder);

      await this.updateLogStatus(log.id, 'SUCCESS');

      return jobOrder;
    } catch (error) {
      await this.updateLogStatus(
        log.id,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류'
      );
      throw error;
    }
  }

  async syncBom(dtos: BomSyncDto[]) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'BOM_SYNC',
      payload: { items: dtos } as any,
    });

    try {
      const results = await Promise.all(
        dtos.map(async (dto) => {
          const parentPart = await this.partMasterRepository.findOne({
            where: { partCode: dto.parentPartCode },
          });
          const childPart = await this.partMasterRepository.findOne({
            where: { partCode: dto.childPartCode },
          });

          if (!parentPart || !childPart) {
            return { success: false, dto, error: '품목을 찾을 수 없습니다' };
          }

          // upsert 대신 find -> create/update 사용
          const existingBom = await this.bomMasterRepository.findOne({
            where: {
              parentPartId: parentPart.id,
              childPartId: childPart.id,
              revision: dto.revision ?? 'A',
            },
          });

          if (existingBom) {
            // 업데이트
            await this.bomMasterRepository.update(existingBom.id, {
              qtyPer: dto.qtyPer,
              ecoNo: dto.ecoNo,
            });
          } else {
            // 생성
            const newBom = this.bomMasterRepository.create({
              parentPartId: parentPart.id,
              childPartId: childPart.id,
              qtyPer: dto.qtyPer,
              revision: dto.revision ?? 'A',
              ecoNo: dto.ecoNo,
            });
            await this.bomMasterRepository.save(newBom);
          }

          return { success: true, dto };
        })
      );

      await this.updateLogStatus(log.id, 'SUCCESS');

      return results;
    } catch (error) {
      await this.updateLogStatus(
        log.id,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류'
      );
      throw error;
    }
  }

  async syncPart(dtos: PartSyncDto[]) {
    const log = await this.createLog({
      direction: 'IN',
      messageType: 'PART_SYNC',
      payload: { items: dtos } as any,
    });

    try {
      const results = await Promise.all(
        dtos.map(async (dto) => {
          // upsert 대신 find -> create/update 사용
          const existingPart = await this.partMasterRepository.findOne({
            where: { partCode: dto.partCode },
          });

          if (existingPart) {
            // 업데이트
            await this.partMasterRepository.update(existingPart.id, {
              partName: dto.partName,
              partType: dto.partType,
              spec: dto.spec,
              unit: dto.unit ?? 'EA',
              drawNo: dto.drawNo,
              customer: dto.customer,
            });
          } else {
            // 생성
            const newPart = this.partMasterRepository.create({
              partCode: dto.partCode,
              partName: dto.partName,
              partType: dto.partType,
              spec: dto.spec,
              unit: dto.unit ?? 'EA',
              drawNo: dto.drawNo,
              customer: dto.customer,
            });
            await this.partMasterRepository.save(newPart);
          }

          return { success: true, partCode: dto.partCode };
        })
      );

      await this.updateLogStatus(log.id, 'SUCCESS');

      return results;
    } catch (error) {
      await this.updateLogStatus(
        log.id,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류'
      );
      throw error;
    }
  }

  // ============================================================================
  // Outbound 처리 (MES → ERP)
  // ============================================================================

  async sendProdResult(dto: ProdResultOutboundDto) {
    const log = await this.createLog({
      direction: 'OUT',
      messageType: 'PROD_RESULT',
      interfaceId: dto.orderNo,
      payload: dto as any,
    });

    try {
      // 실제 ERP 전송 로직 (여기서는 시뮬레이션)
      await this.processOutbound('PROD_RESULT', dto);

      // 작업지시 동기화 상태 업데이트
      const jobOrder = await this.jobOrderRepository.findOne({
        where: { orderNo: dto.orderNo },
      });

      if (jobOrder) {
        await this.jobOrderRepository.update(jobOrder.id, { erpSyncYn: 'Y' });
      }

      await this.updateLogStatus(log.id, 'SUCCESS');

      return { success: true, logId: log.id };
    } catch (error) {
      await this.updateLogStatus(
        log.id,
        'FAIL',
        error instanceof Error ? error.message : '알 수 없는 오류'
      );
      throw error;
    }
  }

  private async processOutbound(messageType: string, payload: Record<string, any>) {
    // 실제로는 HTTP 요청이나 메시지 큐로 ERP에 전송
    // 여기서는 시뮬레이션만 수행
    this.logger.log(`[${messageType}] ERP 전송: ${JSON.stringify(payload)}`);

    // 시뮬레이션: 랜덤하게 실패
    if (Math.random() < 0.1) {
      throw new Error('ERP 연결 실패 (시뮬레이션)');
    }

    return true;
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total,
      todayCount,
      pending,
      failed,
      byType,
      byDirection,
    ] = await Promise.all([
      this.interLogRepository.count(),
      this.interLogRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.interLogRepository.count({ where: { status: 'PENDING' } }),
      this.interLogRepository.count({ where: { status: 'FAIL' } }),
      this.interLogRepository
        .createQueryBuilder('log')
        .select('log.messageType', 'messageType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.messageType')
        .getRawMany(),
      this.interLogRepository
        .createQueryBuilder('log')
        .select('log.direction', 'direction')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.direction')
        .getRawMany(),
    ]);

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

  async getFailedLogs() {
    return this.interLogRepository.find({
      where: { status: 'FAIL' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getRecentLogs(limit: number = 20) {
    return this.interLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
