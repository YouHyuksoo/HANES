/**
 * @file src/modules/inventory/services/warehouse.service.ts
 * @description 창고 마스터 서비스
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from '../dto/inventory.dto';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  /**
   * 창고 목록 조회
   */
  async findAll(warehouseType?: string) {
    const where: any = { deletedAt: null };
    if (warehouseType) where.warehouseType = warehouseType;

    return this.prisma.warehouse.findMany({
      where,
      orderBy: [{ warehouseType: 'asc' }, { warehouseCode: 'asc' }],
    });
  }

  /**
   * 창고 상세 조회
   */
  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: {
          where: { qty: { gt: 0 } },
          include: { part: true, lot: true },
          take: 10,
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    // stocks 평면화
    const flattenedStocks = warehouse.stocks.map(stock => ({
      id: stock.id,
      qty: stock.qty,
      reservedQty: stock.reservedQty,
      availableQty: stock.availableQty,
      // 품목 정보 평면화
      partId: stock.part?.id || null,
      partCode: stock.part?.partCode || null,
      partName: stock.part?.partName || null,
      partType: stock.part?.partType || null,
      unit: stock.part?.unit || null,
      // LOT 정보 평면화
      lotId: stock.lot?.id || null,
      lotNo: stock.lot?.lotNo || null,
    }));

    return {
      ...warehouse,
      stocks: flattenedStocks,
    };
  }

  /**
   * 창고 코드로 조회
   */
  async findByCode(warehouseCode: string) {
    return this.prisma.warehouse.findUnique({
      where: { warehouseCode },
    });
  }

  /**
   * 창고 생성
   */
  async create(dto: CreateWarehouseDto) {
    // 중복 체크
    const existing = await this.findByCode(dto.warehouseCode);
    if (existing) {
      throw new ConflictException('이미 존재하는 창고 코드입니다.');
    }

    // 기본 창고 설정 시 기존 기본 창고 해제
    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { warehouseType: dto.warehouseType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.create({
      data: dto,
    });
  }

  /**
   * 창고 수정
   */
  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    // 기본 창고 설정 시 기존 기본 창고 해제
    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: {
          warehouseType: dto.warehouseType || warehouse.warehouseType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 창고 삭제 (소프트 삭제)
   */
  async remove(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    // 재고가 있으면 삭제 불가
    const stockCount = await this.prisma.stock.count({
      where: { warehouseId: id, qty: { gt: 0 } },
    });

    if (stockCount > 0) {
      throw new ConflictException('재고가 있는 창고는 삭제할 수 없습니다.');
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), useYn: 'N' },
    });
  }

  /**
   * 창고 유형별 기본 창고 조회
   */
  async getDefaultWarehouse(warehouseType: string) {
    return this.prisma.warehouse.findFirst({
      where: { warehouseType, isDefault: true, useYn: 'Y' },
    });
  }

  /**
   * 공정재공 창고 조회/생성 (라인+공정 기준)
   */
  async getOrCreateFloorWarehouse(lineCode: string, processCode: string) {
    const warehouseCode = `FLOOR_${lineCode}_${processCode}`;

    let warehouse = await this.findByCode(warehouseCode);

    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          warehouseCode,
          warehouseName: `공정재공-${lineCode}-${processCode}`,
          warehouseType: 'FLOOR',
          lineCode,
          processCode,
        },
      });
    }

    return warehouse;
  }

  /**
   * 외주처 창고 조회/생성
   */
  async getOrCreateSubconWarehouse(vendorId: string, vendorName: string) {
    const warehouseCode = `SUBCON_${vendorId}`;

    let warehouse = await this.findByCode(warehouseCode);

    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          warehouseCode,
          warehouseName: `외주-${vendorName}`,
          warehouseType: 'SUBCON',
          vendorId,
        },
      });
    }

    return warehouse;
  }

  /**
   * 초기 창고 데이터 생성 (시스템 초기화용)
   */
  async initDefaultWarehouses() {
    const defaults = [
      { warehouseCode: 'WH-RAW', warehouseName: '원자재 창고', warehouseType: 'RAW', isDefault: true },
      { warehouseCode: 'WH-WIP', warehouseName: '반제품 창고', warehouseType: 'WIP', isDefault: true },
      { warehouseCode: 'WH-FG', warehouseName: '완제품 창고', warehouseType: 'FG', isDefault: true },
      { warehouseCode: 'WH-DEFECT', warehouseName: '불량 창고', warehouseType: 'DEFECT', isDefault: true },
      { warehouseCode: 'WH-SCRAP', warehouseName: '폐기 창고', warehouseType: 'SCRAP', isDefault: true },
    ];

    for (const wh of defaults) {
      const existing = await this.findByCode(wh.warehouseCode);
      if (!existing) {
        await this.prisma.warehouse.create({ data: wh });
      }
    }

    return { message: '기본 창고 초기화 완료' };
  }
}
