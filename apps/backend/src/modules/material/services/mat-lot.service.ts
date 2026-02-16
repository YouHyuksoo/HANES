/**
 * @file src/modules/material/services/mat-lot.service.ts
 * @description 자재LOT 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMatLotDto, UpdateMatLotDto, MatLotQueryDto } from '../dto/mat-lot.dto';

@Injectable()
export class MatLotService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MatLotQueryDto) {
    const { page = 1, limit = 10, partId, lotNo, vendor, iqcStatus, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(partId && { partId }),
      ...(lotNo && { lotNo: { contains: lotNo, mode: 'insensitive' as const } }),
      ...(vendor && { vendor: { contains: vendor, mode: 'insensitive' as const } }),
      ...(iqcStatus && { iqcStatus }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.matLot.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.matLot.count({ where }),
    ]);

    // 중첩 객체 평면화
    const flattenedData = data.map((lot) => ({
      ...lot,
      // 평면화된 필드
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
    }));

    return { data: flattenedData, total, page, limit };
  }

  async findById(id: string) {
    const lot = await this.prisma.matLot.findFirst({
      where: { id, deletedAt: null },
      include: { part: true },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${id}`);

    return {
      ...lot,
      // 평면화된 필드
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
    };
  }

  async findByLotNo(lotNo: string) {
    const lot = await this.prisma.matLot.findFirst({
      where: { lotNo, deletedAt: null },
      include: { part: true },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotNo}`);

    return {
      ...lot,
      // 평면화된 필드
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
    };
  }

  async create(dto: CreateMatLotDto) {
    const existing = await this.prisma.matLot.findFirst({
      where: { lotNo: dto.lotNo, deletedAt: null },
    });

    if (existing) throw new ConflictException(`이미 존재하는 LOT 번호입니다: ${dto.lotNo}`);

    const lot = await this.prisma.matLot.create({
      data: {
        lotNo: dto.lotNo,
        partId: dto.partId,
        initQty: dto.initQty,
        currentQty: dto.currentQty ?? dto.initQty,
        recvDate: dto.recvDate ? new Date(dto.recvDate) : new Date(),
        expireDate: dto.expireDate ? new Date(dto.expireDate) : undefined,
        origin: dto.origin,
        vendor: dto.vendor,
        invoiceNo: dto.invoiceNo,
        poNo: dto.poNo,
        iqcStatus: dto.iqcStatus ?? 'PENDING',
        status: dto.status ?? 'NORMAL',
      },
      include: { part: true },
    });

    return {
      ...lot,
      // 평면화된 필드
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
    };
  }

  async update(id: string, dto: UpdateMatLotDto) {
    await this.findById(id);
    const lot = await this.prisma.matLot.update({
      where: { id },
      data: {
        ...(dto.iqcStatus && { iqcStatus: dto.iqcStatus }),
        ...(dto.status && { status: dto.status }),
        ...(dto.expireDate && { expireDate: new Date(dto.expireDate) }),
        ...(dto.vendor && { vendor: dto.vendor }),
        ...(dto.origin && { origin: dto.origin }),
      },
      include: { part: true },
    });

    return {
      ...lot,
      // 평면화된 필드
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
    };
  }

  async delete(id: string) {
    const lot = await this.findById(id);
    if (lot.currentQty > 0) {
      throw new BadRequestException('재고가 남아있는 LOT은 삭제할 수 없습니다.');
    }
    return this.prisma.matLot.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async consumeQty(id: string, qty: number) {
    const lot = await this.findById(id);
    if (lot.currentQty < qty) {
      throw new BadRequestException(`재고 부족: 현재 ${lot.currentQty}, 요청 ${qty}`);
    }

    const newQty = lot.currentQty - qty;
    return this.prisma.matLot.update({
      where: { id },
      data: {
        currentQty: newQty,
        status: newQty === 0 ? 'DEPLETED' : lot.status,
      },
    });
  }

  async returnQty(id: string, qty: number) {
    const lot = await this.findById(id);
    const newQty = lot.currentQty + qty;

    return this.prisma.matLot.update({
      where: { id },
      data: {
        currentQty: newQty,
        status: newQty > 0 && lot.status === 'DEPLETED' ? 'NORMAL' : lot.status,
      },
    });
  }
}
