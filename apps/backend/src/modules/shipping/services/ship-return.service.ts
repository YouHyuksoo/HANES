/**
 * @file src/modules/shipping/services/ship-return.service.ts
 * @description 출하반품 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 반품 생성/조회/수정/삭제 + 품목 관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> COMPLETED
 * 3. **처리유형**: RESTOCK(재입고), SCRAP(폐기), REPAIR(수리)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShipReturnDto, UpdateShipReturnDto, ShipReturnQueryDto } from '../dto/ship-return.dto';

@Injectable()
export class ShipReturnService {
  constructor(private readonly prisma: PrismaService) {}

  /** 반품 목록 조회 */
  async findAll(query: ShipReturnQueryDto) {
    const { page = 1, limit = 10, search, status, returnDateFrom, returnDateTo } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [{ returnNo: { contains: search, mode: 'insensitive' as const } }],
      }),
      ...(returnDateFrom || returnDateTo
        ? {
            returnDate: {
              ...(returnDateFrom && { gte: new Date(returnDateFrom) }),
              ...(returnDateTo && { lte: new Date(returnDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.shipmentReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          shipOrder: { select: { id: true, shipOrderNo: true, customerName: true } },
          items: {
            include: { part: { select: { id: true, partCode: true, partName: true } } },
          },
        },
      }),
      this.prisma.shipmentReturn.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 반품 단건 조회 */
  async findById(id: string) {
    const ret = await this.prisma.shipmentReturn.findFirst({
      where: { id, deletedAt: null },
      include: {
        shipOrder: { select: { id: true, shipOrderNo: true, customerName: true } },
        items: {
          include: { part: { select: { id: true, partCode: true, partName: true } } },
        },
      },
    });
    if (!ret) throw new NotFoundException(`반품을 찾을 수 없습니다: ${id}`);
    return ret;
  }

  /** 반품 생성 */
  async create(dto: CreateShipReturnDto) {
    const existing = await this.prisma.shipmentReturn.findFirst({
      where: { returnNo: dto.returnNo, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 반품 번호입니다: ${dto.returnNo}`);

    return this.prisma.shipmentReturn.create({
      data: {
        returnNo: dto.returnNo,
        shipmentId: dto.shipmentId,
        returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
        returnReason: dto.returnReason,
        remark: dto.remark,
        status: 'DRAFT',
        items: {
          create: dto.items.map((item) => ({
            partId: item.partId,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
          })),
        },
      },
      include: {
        shipOrder: { select: { id: true, shipOrderNo: true, customerName: true } },
        items: {
          include: { part: { select: { id: true, partCode: true, partName: true } } },
        },
      },
    });
  }

  /** 반품 수정 */
  async update(id: string, dto: UpdateShipReturnDto) {
    const ret = await this.findById(id);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.shipmentReturnItem.deleteMany({ where: { returnId: id } });
        await tx.shipmentReturnItem.createMany({
          data: dto.items.map((item) => ({
            returnId: id,
            partId: item.partId,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
          })),
        });
      }

      return tx.shipmentReturn.update({
        where: { id },
        data: {
          ...(dto.returnNo !== undefined && { returnNo: dto.returnNo }),
          ...(dto.shipmentId !== undefined && { shipmentId: dto.shipmentId }),
          ...(dto.returnDate !== undefined && { returnDate: dto.returnDate ? new Date(dto.returnDate) : null }),
          ...(dto.returnReason !== undefined && { returnReason: dto.returnReason }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.remark !== undefined && { remark: dto.remark }),
        },
        include: {
          shipOrder: { select: { id: true, shipOrderNo: true, customerName: true } },
          items: {
            include: { part: { select: { id: true, partCode: true, partName: true } } },
          },
        },
      });
    });
  }

  /** 반품 삭제 (소프트 삭제) */
  async delete(id: string) {
    const ret = await this.findById(id);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }
    return this.prisma.shipmentReturn.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
