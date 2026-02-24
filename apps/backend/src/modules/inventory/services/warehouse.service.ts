/**
 * @file src/modules/inventory/services/warehouse.service.ts
 * @description 창고 마스터 서비스 (TypeORM)
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { CreateWarehouseDto, UpdateWarehouseDto } from '../dto/inventory.dto';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(MatStock)
    private readonly stockRepository: Repository<MatStock>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 창고 목록 조회
   */
  async findAll(warehouseType?: string, company?: string, plant?: string) {
    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (warehouseType) {
      where.warehouseType = warehouseType;
    }

    const [data, total] = await Promise.all([
      this.warehouseRepository.find({
        where,
        order: { warehouseCode: 'ASC' },
      }),
      this.warehouseRepository.count({ where }),
    ]);

    return { data, total, page: 1, limit: total };
  }

  /**
   * 창고 상세 조회
   */
  async findOne(id: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    return warehouse;
  }

  /**
   * 창고 코드로 조회
   */
  async findByCode(warehouseCode: string) {
    return this.warehouseRepository.findOne({
      where: { warehouseCode },
    });
  }

  /**
   * 창고 생성
   */
  async create(dto: CreateWarehouseDto) {
    // 중복 코드 확인
    const existing = await this.warehouseRepository.findOne({
      where: { warehouseCode: dto.warehouseCode },
    });

    if (existing) {
      throw new ConflictException('이미 존재하는 창고 코드입니다.');
    }

    const warehouse = this.warehouseRepository.create({
      warehouseCode: dto.warehouseCode,
      warehouseName: dto.warehouseName,
      warehouseType: dto.warehouseType,
      plantCode: dto.plantCode || null,
      lineCode: dto.lineCode || null,
      processCode: dto.processCode || null,
      vendorId: dto.vendorId || null,
      isDefault: dto.isDefault ? 'Y' : 'N',
      useYn: 'Y',
    });

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * 창고 수정
   */
  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    await this.warehouseRepository.update(id, {
      ...(dto.warehouseName && { warehouseName: dto.warehouseName }),
      ...(dto.warehouseType && { warehouseType: dto.warehouseType }),
      ...(dto.plantCode !== undefined && { plantCode: dto.plantCode || null }),
      ...(dto.lineCode !== undefined && { lineCode: dto.lineCode || null }),
      ...(dto.processCode !== undefined && { processCode: dto.processCode || null }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault ? 'Y' : 'N' }),
      ...(dto.useYn && { useYn: dto.useYn }),
    });

    return this.warehouseRepository.findOne({ where: { id } });
  }

  /**
   * 창고 삭제 (소프트 삭제)
   */
  async remove(id: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    // 해당 창고에 재고가 있는지 확인
    const stockCount = await this.stockRepository.count({
      where: { warehouseCode: warehouse.warehouseCode },
    });

    if (stockCount > 0) {
      throw new ConflictException('해당 창고에 재고가 존재하여 삭제할 수 없습니다.');
    }

    await this.warehouseRepository.delete(id);

    return { id, deleted: true };
  }

  /**
   * 기본 창고 조회 (유형별)
   */
  async getDefaultWarehouse(warehouseType: string) {
    return this.warehouseRepository.findOne({
      where: {
        warehouseType,
        isDefault: 'Y',
        useYn: 'Y',
      },
    });
  }

  /**
   * 공정재공 창고 조회 또는 생성
   */
  async getOrCreateFloorWarehouse(lineCode: string, processCode: string) {
    const warehouseCode = `FLOOR_${lineCode}_${processCode}`;

    let warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode },
    });

    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        warehouseCode,
        warehouseName: `${lineCode} ${processCode} 공정재공`,
        warehouseType: 'WIP',
        lineCode,
        processCode,
        useYn: 'Y',
        isDefault: 'N',
      });

      warehouse = await this.warehouseRepository.save(warehouse);
    }

    return warehouse;
  }

  /**
   * 외주 창고 조회 또는 생성
   */
  async getOrCreateSubconWarehouse(vendorId: string, vendorName: string) {
    const warehouseCode = `SUBCON_${vendorId}`;

    let warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode },
    });

    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        warehouseCode,
        warehouseName: `${vendorName} 외주`,
        warehouseType: 'SUBCON',
        vendorId,
        useYn: 'Y',
        isDefault: 'N',
      });

      warehouse = await this.warehouseRepository.save(warehouse);
    }

    return warehouse;
  }

  /**
   * 기본 창고 초기화
   */
  async initDefaultWarehouses() {
    const defaultWarehouses = [
      // 원자재 창고
      { code: 'RM_MAIN', name: '원자재 메인창고', type: 'RM', isDefault: true },
      { code: 'RM_SUB', name: '원자재 서브창고', type: 'RM', isDefault: false },
      // 반제품 창고
      { code: 'WIP_MAIN', name: '반제품 메인창고', type: 'WIP', isDefault: true },
      // 완제품 창고
      { code: 'FG_MAIN', name: '완제품 메인창고', type: 'FG', isDefault: true },
      { code: 'FG_SHIP', name: '출하대기창고', type: 'FG', isDefault: false },
      // 불량 창고
      { code: 'DEFECT', name: '불량품창고', type: 'DEFECT', isDefault: true },
      // 폐기 창고
      { code: 'SCRAP', name: '폐기창고', type: 'SCRAP', isDefault: true },
      // 외주 창고
      { code: 'SUBCON_MAIN', name: '외주 메인창고', type: 'SUBCON', isDefault: true },
    ];

    const results = [];

    for (const wh of defaultWarehouses) {
      const existing = await this.warehouseRepository.findOne({
        where: { warehouseCode: wh.code },
      });

      if (!existing) {
        const warehouse = this.warehouseRepository.create({
          warehouseCode: wh.code,
          warehouseName: wh.name,
          warehouseType: wh.type,
          isDefault: wh.isDefault ? 'Y' : 'N',
          useYn: 'Y',
        });

        const saved = await this.warehouseRepository.save(warehouse) as Warehouse;
        results.push({ code: wh.code, status: 'created', id: saved.id });
      } else {
        results.push({ code: wh.code, status: 'exists', id: existing.id });
      }
    }

    return {
      message: '기본 창고 초기화 완료',
      results,
    };
  }
}
