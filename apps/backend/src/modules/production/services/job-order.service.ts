/**
 * @file src/modules/production/services/job-order.service.ts
 * @description 작업지시 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **상태 변경**: start, pause, complete, cancel 메서드
 * 3. **ERP 연동**: erpSyncYn 플래그 관리
 * 4. **Prisma 사용**: PrismaService를 통해 DB 접근
 *
 * 실제 DB 스키마 (job_orders 테이블):
 * - orderNo가 유니크 키
 * - status: WAITING, RUNNING, PAUSED, DONE, CANCELED
 * - partId로 PartMaster와 연결
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateJobOrderDto,
  UpdateJobOrderDto,
  JobOrderQueryDto,
  ChangeJobOrderStatusDto,
  UpdateErpSyncDto,
  JobOrderStatus,
} from '../dto/job-order.dto';

@Injectable()
export class JobOrderService {
  private readonly logger = new Logger(JobOrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 작업지시 목록 조회
   */
  async findAll(query: JobOrderQueryDto, company?: string) {
    const {
      page = 1,
      limit = 10,
      orderNo,
      partId,
      lineCode,
      status,
      planDateFrom,
      planDateTo,
      erpSyncYn,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(orderNo && { orderNo: { contains: orderNo, mode: 'insensitive' as const } }),
      ...(partId && { partId }),
      ...(lineCode && { lineCode }),
      ...(status && { status }),
      ...(erpSyncYn && { erpSyncYn }),
      ...(planDateFrom || planDateTo
        ? {
            planDate: {
              ...(planDateFrom && { gte: new Date(planDateFrom) }),
              ...(planDateTo && { lte: new Date(planDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.jobOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { planDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          part: {
            select: {
              id: true,
              partCode: true,
              partName: true,
              partType: true,
            },
          },
        },
      }),
      this.prisma.jobOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 작업지시 단건 조회 (ID)
   */
  async findById(id: string) {
    const jobOrder = await this.prisma.jobOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        part: true,
        prodResults: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${id}`);
    }

    return jobOrder;
  }

  /**
   * 작업지시 단건 조회 (작업지시번호)
   */
  async findByOrderNo(orderNo: string) {
    const jobOrder = await this.prisma.jobOrder.findFirst({
      where: { orderNo, deletedAt: null },
      include: {
        part: true,
      },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }

    return jobOrder;
  }

  /**
   * 작업지시 생성
   */
  async create(dto: CreateJobOrderDto) {
    // 중복 체크
    const existing = await this.prisma.jobOrder.findFirst({
      where: { orderNo: dto.orderNo, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 작업지시번호입니다: ${dto.orderNo}`);
    }

    // 품목 존재 확인
    const part = await this.prisma.partMaster.findFirst({
      where: { id: dto.partId, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.partId}`);
    }

    return this.prisma.jobOrder.create({
      data: {
        orderNo: dto.orderNo,
        partId: dto.partId,
        lineCode: dto.lineCode,
        planQty: dto.planQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        remark: dto.remark,
        status: 'WAITING',
        erpSyncYn: 'N',
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 작업지시 수정
   */
  async update(id: string, dto: UpdateJobOrderDto) {
    const jobOrder = await this.findById(id);

    // DONE 또는 CANCELED 상태에서는 수정 불가
    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시는 수정할 수 없습니다.`);
    }

    return this.prisma.jobOrder.update({
      where: { id },
      data: {
        ...(dto.lineCode !== undefined && { lineCode: dto.lineCode }),
        ...(dto.planQty !== undefined && { planQty: dto.planQty }),
        ...(dto.planDate !== undefined && { planDate: dto.planDate ? new Date(dto.planDate) : null }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
        ...(dto.goodQty !== undefined && { goodQty: dto.goodQty }),
        ...(dto.defectQty !== undefined && { defectQty: dto.defectQty }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 작업지시 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const jobOrder = await this.findById(id);

    // RUNNING 상태에서는 삭제 불가
    if (jobOrder.status === 'RUNNING') {
      throw new BadRequestException(`진행 중인 작업지시는 삭제할 수 없습니다.`);
    }

    return this.prisma.jobOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ===== 상태 변경 메서드 =====

  /**
   * 작업 시작 (WAITING/PAUSED -> RUNNING)
   */
  async start(id: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'WAITING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 시작할 수 없습니다. WAITING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    const updateData: any = {
      status: 'RUNNING',
    };

    // 최초 시작인 경우 시작 시간 설정
    if (!jobOrder.startAt) {
      updateData.startAt = new Date();
    }

    return this.prisma.jobOrder.update({
      where: { id },
      data: updateData,
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 작업 일시정지 (RUNNING -> PAUSED)
   */
  async pause(id: string) {
    const jobOrder = await this.findById(id);

    if (jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 일시정지할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    return this.prisma.jobOrder.update({
      where: { id },
      data: { status: 'PAUSED' },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 작업 완료 (RUNNING/PAUSED -> DONE)
   */
  async complete(id: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'RUNNING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 완료할 수 없습니다. RUNNING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    // 생산실적 집계
    const summary = await this.prisma.prodResult.aggregate({
      where: { jobOrderId: id, deletedAt: null },
      _sum: {
        goodQty: true,
        defectQty: true,
      },
    });

    return this.prisma.jobOrder.update({
      where: { id },
      data: {
        status: 'DONE',
        endAt: new Date(),
        goodQty: summary._sum.goodQty ?? 0,
        defectQty: summary._sum.defectQty ?? 0,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 작업 취소 (WAITING/PAUSED -> CANCELED)
   */
  async cancel(id: string, remark?: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'WAITING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 취소할 수 없습니다. WAITING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    return this.prisma.jobOrder.update({
      where: { id },
      data: {
        status: 'CANCELED',
        endAt: new Date(),
        ...(remark && { remark }),
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 상태 직접 변경 (관리자용)
   */
  async changeStatus(id: string, dto: ChangeJobOrderStatusDto) {
    await this.findById(id); // 존재 확인

    return this.prisma.jobOrder.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.remark && { remark: dto.remark }),
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  // ===== ERP 연동 =====

  /**
   * ERP 동기화 플래그 업데이트
   */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto) {
    await this.findById(id); // 존재 확인

    return this.prisma.jobOrder.update({
      where: { id },
      data: { erpSyncYn: dto.erpSyncYn },
    });
  }

  /**
   * ERP 미동기화 작업지시 목록 조회
   */
  async findUnsyncedForErp() {
    return this.prisma.jobOrder.findMany({
      where: {
        erpSyncYn: 'N',
        status: 'DONE',
        deletedAt: null,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
      orderBy: { endAt: 'asc' },
    });
  }

  /**
   * ERP 동기화 완료 처리 (일괄)
   */
  async markAsSynced(ids: string[]) {
    return this.prisma.jobOrder.updateMany({
      where: { id: { in: ids } },
      data: { erpSyncYn: 'Y' },
    });
  }

  // ===== 통계/집계 =====

  /**
   * 작업지시 실적 집계
   */
  async getJobOrderSummary(id: string) {
    const jobOrder = await this.findById(id);

    const summary = await this.prisma.prodResult.aggregate({
      where: { jobOrderId: id, deletedAt: null },
      _sum: {
        goodQty: true,
        defectQty: true,
      },
      _avg: {
        cycleTime: true,
      },
      _count: true,
    });

    const totalGoodQty = summary._sum.goodQty ?? 0;
    const totalDefectQty = summary._sum.defectQty ?? 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      jobOrderId: id,
      orderNo: jobOrder.orderNo,
      planQty: jobOrder.planQty,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      achievementRate: jobOrder.planQty > 0 ? (totalGoodQty / jobOrder.planQty) * 100 : 0,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary._avg.cycleTime ? Number(summary._avg.cycleTime) : null,
      resultCount: summary._count,
    };
  }
}
