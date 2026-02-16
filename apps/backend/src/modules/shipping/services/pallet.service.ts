/**
 * @file src/modules/shipping/services/pallet.service.ts
 * @description 팔레트 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **박스 관리**: addBox, removeBox로 박스 추가/제거
 * 3. **상태 관리**: closePallet로 팔레트 닫기, 출하 할당
 * 4. **Prisma 사용**: PrismaService를 통해 DB 접근
 *
 * 실제 DB 스키마 (pallet_masters 테이블):
 * - palletNo가 유니크 키
 * - status: OPEN, CLOSED, LOADED, SHIPPED
 * - shipmentId로 ShipmentLog와 연결 (nullable)
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
  CreatePalletDto,
  UpdatePalletDto,
  PalletQueryDto,
  AddBoxToPalletDto,
  RemoveBoxFromPalletDto,
  AssignPalletToShipmentDto,
  PalletStatus,
} from '../dto/pallet.dto';

@Injectable()
export class PalletService {
  private readonly logger = new Logger(PalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 팔레트 목록 조회
   */
  async findAll(query: PalletQueryDto, company?: string) {
    const {
      page = 1,
      limit = 10,
      palletNo,
      shipmentId,
      status,
      unassigned,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(palletNo && { palletNo: { contains: palletNo, mode: 'insensitive' as const } }),
      ...(shipmentId && { shipmentId }),
      ...(status && { status }),
      ...(unassigned && { shipmentId: null }),
    };

    const [data, total] = await Promise.all([
      this.prisma.palletMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          shipment: {
            select: {
              id: true,
              shipNo: true,
              status: true,
            },
          },
          boxes: {
            where: { deletedAt: null },
            select: {
              id: true,
              boxNo: true,
              qty: true,
              status: true,
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
      }),
      this.prisma.palletMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 팔레트 단건 조회 (ID)
   */
  async findById(id: string) {
    const pallet = await this.prisma.palletMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        shipment: true,
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${id}`);
    }

    return pallet;
  }

  /**
   * 팔레트 단건 조회 (팔레트번호)
   */
  async findByPalletNo(palletNo: string) {
    const pallet = await this.prisma.palletMaster.findFirst({
      where: { palletNo, deletedAt: null },
      include: {
        shipment: true,
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${palletNo}`);
    }

    return pallet;
  }

  /**
   * 팔레트 생성
   */
  async create(dto: CreatePalletDto) {
    // 중복 체크
    const existing = await this.prisma.palletMaster.findFirst({
      where: { palletNo: dto.palletNo, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 팔레트번호입니다: ${dto.palletNo}`);
    }

    return this.prisma.palletMaster.create({
      data: {
        palletNo: dto.palletNo,
        boxCount: 0,
        totalQty: 0,
        status: 'OPEN',
      },
    });
  }

  /**
   * 팔레트 수정
   */
  async update(id: string, dto: UpdatePalletDto) {
    const pallet = await this.findById(id);

    // SHIPPED 상태에서는 수정 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 수정할 수 없습니다.');
    }

    return this.prisma.palletMaster.update({
      where: { id },
      data: {
        ...(dto.shipmentId !== undefined && { shipmentId: dto.shipmentId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        shipment: {
          select: {
            id: true,
            shipNo: true,
          },
        },
      },
    });
  }

  /**
   * 팔레트 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const pallet = await this.findById(id);

    // SHIPPED 상태에서는 삭제 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 삭제할 수 없습니다.');
    }

    // 박스가 있으면 삭제 불가
    if (pallet.boxCount > 0) {
      throw new BadRequestException('박스가 포함된 팔레트는 삭제할 수 없습니다. 먼저 박스를 제거해주세요.');
    }

    // 출하에 할당되어 있으면 삭제 불가
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 삭제할 수 없습니다. 먼저 출하에서 제거해주세요.');
    }

    return this.prisma.palletMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ===== 박스 관리 =====

  /**
   * 팔레트에 박스 추가
   */
  async addBox(id: string, dto: AddBoxToPalletDto) {
    const pallet = await this.findById(id);

    // OPEN 상태에서만 박스 추가 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 추가할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스 존재 및 상태 확인
    const boxes = await this.prisma.boxMaster.findMany({
      where: {
        id: { in: dto.boxIds },
        deletedAt: null,
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundIds = boxes.map(b => b.id);
      const notFound = dto.boxIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    // 박스 상태 확인
    const invalidBoxes = boxes.filter(b => b.status !== 'CLOSED');
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 박스가 있습니다: ${invalidBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // 이미 다른 팔레트에 할당된 박스 확인
    const assignedBoxes = boxes.filter(b => b.palletId && b.palletId !== id);
    if (assignedBoxes.length > 0) {
      throw new BadRequestException(`이미 다른 팔레트에 할당된 박스가 있습니다: ${assignedBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // 트랜잭션으로 박스 할당 및 팔레트 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 박스 업데이트
      await tx.boxMaster.updateMany({
        where: { id: { in: dto.boxIds } },
        data: { palletId: id },
      });

      // 팔레트 집계 업데이트
      const palletSummary = await tx.boxMaster.aggregate({
        where: { palletId: id, deletedAt: null },
        _count: true,
        _sum: { qty: true },
      });

      return tx.palletMaster.update({
        where: { id },
        data: {
          boxCount: palletSummary._count,
          totalQty: palletSummary._sum.qty ?? 0,
        },
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
      });
    });
  }

  /**
   * 팔레트에서 박스 제거
   */
  async removeBox(id: string, dto: RemoveBoxFromPalletDto) {
    const pallet = await this.findById(id);

    // OPEN 상태에서만 박스 제거 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 제거할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스가 이 팔레트에 있는지 확인
    const boxes = await this.prisma.boxMaster.findMany({
      where: {
        id: { in: dto.boxIds },
        palletId: id,
        deletedAt: null,
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundIds = boxes.map(b => b.id);
      const notFound = dto.boxIds.filter(boxId => !foundIds.includes(boxId));
      throw new NotFoundException(`이 팔레트에 없는 박스입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 박스 제거 및 팔레트 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 박스 업데이트
      await tx.boxMaster.updateMany({
        where: { id: { in: dto.boxIds } },
        data: { palletId: null },
      });

      // 팔레트 집계 업데이트
      const palletSummary = await tx.boxMaster.aggregate({
        where: { palletId: id, deletedAt: null },
        _count: true,
        _sum: { qty: true },
      });

      return tx.palletMaster.update({
        where: { id },
        data: {
          boxCount: palletSummary._count,
          totalQty: palletSummary._sum.qty ?? 0,
        },
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
      });
    });
  }

  // ===== 상태 관리 =====

  /**
   * 팔레트 닫기 (OPEN -> CLOSED)
   */
  async closePallet(id: string) {
    const pallet = await this.findById(id);

    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 닫을 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 빈 팔레트는 닫을 수 없음
    if (pallet.boxCount <= 0) {
      throw new BadRequestException('빈 팔레트는 닫을 수 없습니다.');
    }

    return this.prisma.palletMaster.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closeAt: new Date(),
      },
      include: {
        boxes: {
          where: { deletedAt: null },
          select: {
            id: true,
            boxNo: true,
            qty: true,
          },
        },
      },
    });
  }

  /**
   * 팔레트 다시 열기 (CLOSED -> OPEN)
   */
  async reopenPallet(id: string) {
    const pallet = await this.findById(id);

    if (pallet.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 다시 열 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 출하에 할당되어 있으면 다시 열 수 없음
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 다시 열 수 없습니다.');
    }

    return this.prisma.palletMaster.update({
      where: { id },
      data: {
        status: 'OPEN',
        closeAt: null,
      },
      include: {
        boxes: {
          where: { deletedAt: null },
          select: {
            id: true,
            boxNo: true,
            qty: true,
          },
        },
      },
    });
  }

  // ===== 출하 할당 =====

  /**
   * 팔레트를 출하에 할당
   */
  async assignToShipment(id: string, dto: AssignPalletToShipmentDto) {
    const pallet = await this.findById(id);

    // CLOSED 상태에서만 출하 할당 가능
    if (pallet.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 출하에 할당할 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 이미 다른 출하에 할당되어 있는 경우
    if (pallet.shipmentId && pallet.shipmentId !== dto.shipmentId) {
      throw new BadRequestException('이미 다른 출하에 할당된 팔레트입니다.');
    }

    // 출하 존재 및 상태 확인
    const shipment = await this.prisma.shipmentLog.findFirst({
      where: { id: dto.shipmentId, deletedAt: null },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${dto.shipmentId}`);
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에만 팔레트를 할당할 수 있습니다.`);
    }

    // 트랜잭션으로 팔레트 할당 및 출하 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 업데이트
      const updatedPallet = await tx.palletMaster.update({
        where: { id },
        data: {
          shipmentId: dto.shipmentId,
          status: 'LOADED',
        },
        include: {
          shipment: {
            select: {
              id: true,
              shipNo: true,
            },
          },
          boxes: {
            where: { deletedAt: null },
            select: {
              id: true,
              boxNo: true,
              qty: true,
            },
          },
        },
      });

      // 출하 집계 업데이트
      const shipmentSummary = await tx.palletMaster.aggregate({
        where: { shipmentId: dto.shipmentId, deletedAt: null },
        _count: true,
        _sum: { boxCount: true, totalQty: true },
      });

      await tx.shipmentLog.update({
        where: { id: dto.shipmentId },
        data: {
          palletCount: shipmentSummary._count,
          boxCount: shipmentSummary._sum.boxCount ?? 0,
          totalQty: shipmentSummary._sum.totalQty ?? 0,
        },
      });

      return updatedPallet;
    });
  }

  /**
   * 팔레트를 출하에서 제거
   */
  async removeFromShipment(id: string) {
    const pallet = await this.findById(id);

    if (!pallet.shipmentId) {
      throw new BadRequestException('출하에 할당되지 않은 팔레트입니다.');
    }

    // 출하가 PREPARING 상태일 때만 제거 가능
    const shipment = await this.prisma.shipmentLog.findFirst({
      where: { id: pallet.shipmentId, deletedAt: null },
    });

    if (!shipment) {
      throw new NotFoundException('출하를 찾을 수 없습니다.');
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에서만 팔레트를 제거할 수 있습니다.`);
    }

    const shipmentId = pallet.shipmentId;

    // 트랜잭션으로 팔레트 제거 및 출하 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 팔레트 업데이트
      const updatedPallet = await tx.palletMaster.update({
        where: { id },
        data: {
          shipmentId: null,
          status: 'CLOSED',
        },
        include: {
          boxes: {
            where: { deletedAt: null },
            select: {
              id: true,
              boxNo: true,
              qty: true,
            },
          },
        },
      });

      // 출하 집계 업데이트
      const shipmentSummary = await tx.palletMaster.aggregate({
        where: { shipmentId, deletedAt: null },
        _count: true,
        _sum: { boxCount: true, totalQty: true },
      });

      await tx.shipmentLog.update({
        where: { id: shipmentId },
        data: {
          palletCount: shipmentSummary._count,
          boxCount: shipmentSummary._sum.boxCount ?? 0,
          totalQty: shipmentSummary._sum.totalQty ?? 0,
        },
      });

      return updatedPallet;
    });
  }

  // ===== 조회 유틸리티 =====

  /**
   * 출하별 팔레트 목록 조회
   */
  async findByShipmentId(shipmentId: string) {
    return this.prisma.palletMaster.findMany({
      where: { shipmentId, deletedAt: null },
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
    });
  }

  /**
   * 미할당 팔레트 목록 조회 (출하에 할당되지 않은 CLOSED 상태)
   */
  async findUnassignedPallets() {
    return this.prisma.palletMaster.findMany({
      where: {
        shipmentId: null,
        status: 'CLOSED',
        deletedAt: null,
      },
      include: {
        boxes: {
          where: { deletedAt: null },
          select: {
            id: true,
            boxNo: true,
            qty: true,
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
    });
  }

  /**
   * 팔레트 요약 정보 조회
   */
  async getPalletSummary(id: string) {
    const pallet = await this.findById(id);

    // 품목별 수량 집계
    const partSummary = await this.prisma.boxMaster.groupBy({
      by: ['partId'],
      where: { palletId: id, deletedAt: null },
      _count: true,
      _sum: { qty: true },
    });

    // 품목 정보 조회
    const partIds = partSummary.map(p => p.partId);
    const parts = await this.prisma.partMaster.findMany({
      where: { id: { in: partIds } },
      select: {
        id: true,
        partCode: true,
        partName: true,
      },
    });

    const partsMap = new Map(parts.map(p => [p.id, p]));

    return {
      palletId: id,
      palletNo: pallet.palletNo,
      status: pallet.status,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      closeAt: pallet.closeAt,
      partBreakdown: partSummary.map(ps => ({
        part: partsMap.get(ps.partId),
        boxCount: ps._count,
        qty: ps._sum.qty ?? 0,
      })),
    };
  }
}
