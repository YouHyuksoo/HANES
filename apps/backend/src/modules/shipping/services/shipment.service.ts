/**
 * @file src/modules/shipping/services/shipment.service.ts
 * @description 출하 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **팔레트 관리**: loadPallets, unloadPallets로 팔레트 적재/하차
 * 3. **상태 관리**: 상태 변경 (PREPARING -> LOADED -> SHIPPED -> DELIVERED)
 * 4. **ERP 연동**: erpSyncYn 플래그 관리
 * 5. **통계**: 일자별 출하 통계 조회
 *
 * 실제 DB 스키마 (shipment_logs 테이블):
 * - shipNo가 유니크 키
 * - status: PREPARING, LOADED, SHIPPED, DELIVERED, CANCELED
 * - palletCount, boxCount, totalQty는 팔레트 적재 시 자동 계산
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
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentQueryDto,
  LoadPalletsDto,
  UnloadPalletsDto,
  ChangeShipmentStatusDto,
  UpdateErpSyncDto,
  ShipmentStatsQueryDto,
  ShipmentStatus,
} from '../dto/shipment.dto';

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 출하 목록 조회
   */
  async findAll(query: ShipmentQueryDto, company?: string) {
    const {
      page = 1,
      limit = 10,
      shipNo,
      customer,
      status,
      shipDateFrom,
      shipDateTo,
      erpSyncYn,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(shipNo && { shipNo: { contains: shipNo, mode: 'insensitive' as const } }),
      ...(customer && { customer: { contains: customer, mode: 'insensitive' as const } }),
      ...(status && { status }),
      ...(erpSyncYn && { erpSyncYn }),
      ...(shipDateFrom || shipDateTo
        ? {
            shipDate: {
              ...(shipDateFrom && { gte: new Date(shipDateFrom) }),
              ...(shipDateTo && { lte: new Date(shipDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.shipmentLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ shipDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          pallets: {
            where: { deletedAt: null },
            select: {
              id: true,
              palletNo: true,
              boxCount: true,
              totalQty: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.shipmentLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 출하 단건 조회 (ID)
   */
  async findById(id: string) {
    const shipment = await this.prisma.shipmentLog.findFirst({
      where: { id, deletedAt: null },
      include: {
        pallets: {
          where: { deletedAt: null },
          include: {
            boxes: {
              where: { deletedAt: null },
              include: {
                part: {
                  select: {
                    id: true,
                    partCode: true,
                    partName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${id}`);
    }

    return shipment;
  }

  /**
   * 출하 단건 조회 (출하번호)
   */
  async findByShipNo(shipNo: string) {
    const shipment = await this.prisma.shipmentLog.findFirst({
      where: { shipNo, deletedAt: null },
      include: {
        pallets: {
          where: { deletedAt: null },
          include: {
            boxes: {
              where: { deletedAt: null },
              include: {
                part: {
                  select: {
                    id: true,
                    partCode: true,
                    partName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${shipNo}`);
    }

    return shipment;
  }

  /**
   * 출하 생성
   */
  async create(dto: CreateShipmentDto) {
    // 중복 체크
    const existing = await this.prisma.shipmentLog.findFirst({
      where: { shipNo: dto.shipNo, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 출하번호입니다: ${dto.shipNo}`);
    }

    return this.prisma.shipmentLog.create({
      data: {
        shipNo: dto.shipNo,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
        vehicleNo: dto.vehicleNo,
        driverName: dto.driverName,
        destination: dto.destination,
        customer: dto.customer,
        remark: dto.remark,
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
        status: 'PREPARING',
        erpSyncYn: 'N',
      },
    });
  }

  /**
   * 출하 수정
   */
  async update(id: string, dto: UpdateShipmentDto) {
    const shipment = await this.findById(id);

    // SHIPPED 또는 DELIVERED 상태에서는 수정 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 수정할 수 없습니다.');
    }

    return this.prisma.shipmentLog.update({
      where: { id },
      data: {
        ...(dto.shipDate !== undefined && { shipDate: dto.shipDate ? new Date(dto.shipDate) : null }),
        ...(dto.vehicleNo !== undefined && { vehicleNo: dto.vehicleNo }),
        ...(dto.driverName !== undefined && { driverName: dto.driverName }),
        ...(dto.destination !== undefined && { destination: dto.destination }),
        ...(dto.customer !== undefined && { customer: dto.customer }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        pallets: {
          where: { deletedAt: null },
          select: {
            id: true,
            palletNo: true,
            boxCount: true,
            totalQty: true,
          },
        },
      },
    });
  }

  /**
   * 출하 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const shipment = await this.findById(id);

    // SHIPPED 또는 DELIVERED 상태에서는 삭제 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 삭제할 수 없습니다.');
    }

    // 팔레트가 있으면 삭제 불가
    if (shipment.palletCount > 0) {
      throw new BadRequestException('팔레트가 적재된 출하는 삭제할 수 없습니다. 먼저 팔레트를 하차해주세요.');
    }

    return this.prisma.shipmentLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ===== 팔레트 관리 =====

  /**
   * 팔레트 적재
   */
  async loadPallets(id: string, dto: LoadPalletsDto) {
    const shipment = await this.findById(id);

    // PREPARING 상태에서만 팔레트 적재 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 적재할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트 존재 및 상태 확인
    const pallets = await this.prisma.palletMaster.findMany({
      where: {
        id: { in: dto.palletIds },
        deletedAt: null,
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.id);
      const notFound = dto.palletIds.filter(pid => !foundIds.includes(pid));
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    // 팔레트 상태 확인
    const invalidPallets = pallets.filter(p => p.status !== 'CLOSED');
    if (invalidPallets.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 팔레트가 있습니다: ${invalidPallets.map(p => p.palletNo).join(', ')}`);
    }

    // 이미 다른 출하에 할당된 팔레트 확인
    const assignedPallets = pallets.filter(p => p.shipmentId && p.shipmentId !== id);
    if (assignedPallets.length > 0) {
      throw new BadRequestException(`이미 다른 출하에 할당된 팔레트가 있습니다: ${assignedPallets.map(p => p.palletNo).join(', ')}`);
    }

    // 트랜잭션으로 팔레트 적재 및 출하 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 업데이트
      await tx.palletMaster.updateMany({
        where: { id: { in: dto.palletIds } },
        data: {
          shipmentId: id,
          status: 'LOADED',
        },
      });

      // 출하 집계 업데이트
      const shipmentSummary = await tx.palletMaster.aggregate({
        where: { shipmentId: id, deletedAt: null },
        _count: true,
        _sum: { boxCount: true, totalQty: true },
      });

      return tx.shipmentLog.update({
        where: { id },
        data: {
          palletCount: shipmentSummary._count,
          boxCount: shipmentSummary._sum.boxCount ?? 0,
          totalQty: shipmentSummary._sum.totalQty ?? 0,
        },
        include: {
          pallets: {
            where: { deletedAt: null },
            select: {
              id: true,
              palletNo: true,
              boxCount: true,
              totalQty: true,
              status: true,
            },
          },
        },
      });
    });
  }

  /**
   * 팔레트 하차
   */
  async unloadPallets(id: string, dto: UnloadPalletsDto) {
    const shipment = await this.findById(id);

    // PREPARING 상태에서만 팔레트 하차 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 하차할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트가 이 출하에 있는지 확인
    const pallets = await this.prisma.palletMaster.findMany({
      where: {
        id: { in: dto.palletIds },
        shipmentId: id,
        deletedAt: null,
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.id);
      const notFound = dto.palletIds.filter(pid => !foundIds.includes(pid));
      throw new NotFoundException(`이 출하에 없는 팔레트입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 팔레트 하차 및 출하 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 업데이트
      await tx.palletMaster.updateMany({
        where: { id: { in: dto.palletIds } },
        data: {
          shipmentId: null,
          status: 'CLOSED',
        },
      });

      // 출하 집계 업데이트
      const shipmentSummary = await tx.palletMaster.aggregate({
        where: { shipmentId: id, deletedAt: null },
        _count: true,
        _sum: { boxCount: true, totalQty: true },
      });

      return tx.shipmentLog.update({
        where: { id },
        data: {
          palletCount: shipmentSummary._count,
          boxCount: shipmentSummary._sum.boxCount ?? 0,
          totalQty: shipmentSummary._sum.totalQty ?? 0,
        },
        include: {
          pallets: {
            where: { deletedAt: null },
            select: {
              id: true,
              palletNo: true,
              boxCount: true,
              totalQty: true,
              status: true,
            },
          },
        },
      });
    });
  }

  // ===== 상태 관리 =====

  /**
   * 출하 상태 변경: PREPARING -> LOADED
   */
  async markAsLoaded(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 적재완료 처리할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    if (shipment.palletCount <= 0) {
      throw new BadRequestException('팔레트가 없는 출하는 적재완료 처리할 수 없습니다.');
    }

    return this.prisma.shipmentLog.update({
      where: { id },
      data: { status: 'LOADED' },
      include: {
        pallets: {
          where: { deletedAt: null },
          select: {
            id: true,
            palletNo: true,
            boxCount: true,
            totalQty: true,
          },
        },
      },
    });
  }

  /**
   * 출하 상태 변경: LOADED -> SHIPPED
   */
  async markAsShipped(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 출하 처리할 수 없습니다. LOADED 상태여야 합니다.`);
    }

    // 트랜잭션으로 출하 상태 및 팔레트/박스 상태 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 상태 업데이트
      await tx.palletMaster.updateMany({
        where: { shipmentId: id, deletedAt: null },
        data: { status: 'SHIPPED' },
      });

      // 박스 상태 업데이트
      const pallets = await tx.palletMaster.findMany({
        where: { shipmentId: id, deletedAt: null },
        select: { id: true },
      });

      const palletIds = pallets.map(p => p.id);
      await tx.boxMaster.updateMany({
        where: { palletId: { in: palletIds }, deletedAt: null },
        data: { status: 'SHIPPED' },
      });

      // 출하 상태 업데이트
      return tx.shipmentLog.update({
        where: { id },
        data: {
          status: 'SHIPPED',
          shipAt: new Date(),
        },
        include: {
          pallets: {
            where: { deletedAt: null },
            select: {
              id: true,
              palletNo: true,
              boxCount: true,
              totalQty: true,
              status: true,
            },
          },
        },
      });
    });
  }

  /**
   * 출하 상태 변경: SHIPPED -> DELIVERED
   */
  async markAsDelivered(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'SHIPPED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 배송완료 처리할 수 없습니다. SHIPPED 상태여야 합니다.`);
    }

    return this.prisma.shipmentLog.update({
      where: { id },
      data: { status: 'DELIVERED' },
      include: {
        pallets: {
          where: { deletedAt: null },
          select: {
            id: true,
            palletNo: true,
            boxCount: true,
            totalQty: true,
          },
        },
      },
    });
  }

  /**
   * 출하 취소 (PREPARING/LOADED -> CANCELED)
   */
  async cancel(id: string, remark?: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'PREPARING' && shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 취소할 수 없습니다. PREPARING 또는 LOADED 상태여야 합니다.`);
    }

    // 트랜잭션으로 출하 취소 및 팔레트/박스 상태 복원
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 상태 복원 (CLOSED로)
      await tx.palletMaster.updateMany({
        where: { shipmentId: id, deletedAt: null },
        data: {
          shipmentId: null,
          status: 'CLOSED',
        },
      });

      // 출하 상태 업데이트
      return tx.shipmentLog.update({
        where: { id },
        data: {
          status: 'CANCELED',
          palletCount: 0,
          boxCount: 0,
          totalQty: 0,
          ...(remark && { remark }),
        },
      });
    });
  }

  /**
   * 상태 직접 변경 (관리자용)
   */
  async changeStatus(id: string, dto: ChangeShipmentStatusDto) {
    await this.findById(id); // 존재 확인

    return this.prisma.shipmentLog.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.remark && { remark: dto.remark }),
      },
      include: {
        pallets: {
          where: { deletedAt: null },
          select: {
            id: true,
            palletNo: true,
            boxCount: true,
            totalQty: true,
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

    return this.prisma.shipmentLog.update({
      where: { id },
      data: { erpSyncYn: dto.erpSyncYn },
    });
  }

  /**
   * ERP 미동기화 출하 목록 조회
   */
  async findUnsyncedForErp() {
    return this.prisma.shipmentLog.findMany({
      where: {
        erpSyncYn: 'N',
        status: { in: ['SHIPPED', 'DELIVERED'] },
        deletedAt: null,
      },
      include: {
        pallets: {
          where: { deletedAt: null },
          select: {
            id: true,
            palletNo: true,
            boxCount: true,
            totalQty: true,
          },
        },
      },
      orderBy: { shipAt: 'asc' },
    });
  }

  /**
   * ERP 동기화 완료 처리 (일괄)
   */
  async markAsSynced(ids: string[]) {
    return this.prisma.shipmentLog.updateMany({
      where: { id: { in: ids } },
      data: { erpSyncYn: 'Y' },
    });
  }

  // ===== 통계/집계 =====

  /**
   * 일자별 출하 통계
   */
  async getShipmentStats(query: ShipmentStatsQueryDto) {
    const { startDate, endDate, customer } = query;

    const shipments = await this.prisma.shipmentLog.findMany({
      where: {
        deletedAt: null,
        shipDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { in: ['SHIPPED', 'DELIVERED'] },
        ...(customer && { customer: { contains: customer, mode: 'insensitive' as const } }),
      },
      select: {
        id: true,
        shipNo: true,
        shipDate: true,
        customer: true,
        palletCount: true,
        boxCount: true,
        totalQty: true,
        status: true,
      },
      orderBy: { shipDate: 'asc' },
    });

    // 일자별 집계
    const dailyStats = new Map<string, {
      date: string;
      shipmentCount: number;
      palletCount: number;
      boxCount: number;
      totalQty: number;
    }>();

    shipments.forEach(s => {
      const dateKey = s.shipDate ? s.shipDate.toISOString().split('T')[0] : 'unknown';
      const existing = dailyStats.get(dateKey) || {
        date: dateKey,
        shipmentCount: 0,
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
      };

      dailyStats.set(dateKey, {
        date: dateKey,
        shipmentCount: existing.shipmentCount + 1,
        palletCount: existing.palletCount + s.palletCount,
        boxCount: existing.boxCount + s.boxCount,
        totalQty: existing.totalQty + s.totalQty,
      });
    });

    // 전체 합계
    const totals = shipments.reduce(
      (acc, s) => ({
        shipmentCount: acc.shipmentCount + 1,
        palletCount: acc.palletCount + s.palletCount,
        boxCount: acc.boxCount + s.boxCount,
        totalQty: acc.totalQty + s.totalQty,
      }),
      { shipmentCount: 0, palletCount: 0, boxCount: 0, totalQty: 0 },
    );

    return {
      period: { startDate, endDate },
      customer: customer || 'ALL',
      dailyStats: Array.from(dailyStats.values()),
      totals,
    };
  }

  /**
   * 고객사별 출하 통계
   */
  async getCustomerStats(startDate: string, endDate: string) {
    const shipments = await this.prisma.shipmentLog.findMany({
      where: {
        deletedAt: null,
        shipDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { in: ['SHIPPED', 'DELIVERED'] },
      },
      select: {
        customer: true,
        palletCount: true,
        boxCount: true,
        totalQty: true,
      },
    });

    // 고객사별 집계
    const customerStats = new Map<string, {
      customer: string;
      shipmentCount: number;
      palletCount: number;
      boxCount: number;
      totalQty: number;
    }>();

    shipments.forEach(s => {
      const customerKey = s.customer || 'UNKNOWN';
      const existing = customerStats.get(customerKey) || {
        customer: customerKey,
        shipmentCount: 0,
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
      };

      customerStats.set(customerKey, {
        customer: customerKey,
        shipmentCount: existing.shipmentCount + 1,
        palletCount: existing.palletCount + s.palletCount,
        boxCount: existing.boxCount + s.boxCount,
        totalQty: existing.totalQty + s.totalQty,
      });
    });

    return {
      period: { startDate, endDate },
      customerStats: Array.from(customerStats.values()).sort((a, b) => b.totalQty - a.totalQty),
    };
  }

  /**
   * 출하 상세 요약 정보 조회
   */
  async getShipmentSummary(id: string) {
    const shipment = await this.findById(id);

    // 품목별 수량 집계
    const boxesWithParts = await this.prisma.boxMaster.findMany({
      where: {
        pallet: { shipmentId: id },
        deletedAt: null,
      },
      select: {
        partId: true,
        qty: true,
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });

    // 품목별 집계
    const partSummary = new Map<string, {
      part: { id: string; partCode: string; partName: string };
      boxCount: number;
      qty: number;
    }>();

    boxesWithParts.forEach(box => {
      const existing = partSummary.get(box.partId) || {
        part: box.part,
        boxCount: 0,
        qty: 0,
      };

      partSummary.set(box.partId, {
        part: box.part,
        boxCount: existing.boxCount + 1,
        qty: existing.qty + box.qty,
      });
    });

    return {
      shipmentId: id,
      shipNo: shipment.shipNo,
      status: shipment.status,
      customer: shipment.customer,
      destination: shipment.destination,
      shipDate: shipment.shipDate,
      shipAt: shipment.shipAt,
      vehicleNo: shipment.vehicleNo,
      driverName: shipment.driverName,
      palletCount: shipment.palletCount,
      boxCount: shipment.boxCount,
      totalQty: shipment.totalQty,
      erpSyncYn: shipment.erpSyncYn,
      partBreakdown: Array.from(partSummary.values()),
    };
  }
}
