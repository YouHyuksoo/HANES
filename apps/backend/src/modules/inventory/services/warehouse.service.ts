/**
 * @file src/modules/inventory/services/warehouse.service.ts
 * @description 창고 마스터 서비스 (TypeORM)
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
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

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /**
   * 창고 목록 조회
   */
  async findAll(warehouseType?: string, company?: string, plant?: string) {
    const where: FindOptionsWhere<Warehouse> = {
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
  async findOne(warehouseCode: string, company?: string, plant?: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...this.tenantWhere(company, plant) },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    return warehouse;
  }

  /**
   * 창고 코드로 조회
   */
  async findByCode(warehouseCode: string, company?: string, plant?: string) {
    return this.warehouseRepository.findOne({
      where: { warehouseCode, ...this.tenantWhere(company, plant) },
    });
  }

  /**
   * 창고 생성
   */
  async create(dto: CreateWarehouseDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    // 중복 코드 확인
    const existing = await this.warehouseRepository.findOne({
      where: { warehouseCode: dto.warehouseCode, ...tenantWhere },
    });

    if (existing) {
      throw new ConflictException('이미 존재하는 창고 코드입니다.');
    }

    const warehouse = this.warehouseRepository.create({
      warehouseCode: dto.warehouseCode,
      warehouseName: dto.warehouseName,
      warehouseType: dto.warehouseType,
      plantCode: dto.plantCode || plant || null,
      lineCode: dto.lineCode || null,
      processCode: dto.processCode || null,
      vendorCode: dto.vendorCode || null,
      isDefault: dto.isDefault ? 'Y' : 'N',
      useYn: 'Y',
      company: company || null,
      plant: plant || null,
    });

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * 창고 수정
   */
  async update(warehouseCode: string, dto: UpdateWarehouseDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...tenantWhere },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    await this.warehouseRepository.update({ warehouseCode, ...tenantWhere }, {
      ...(dto.warehouseName && { warehouseName: dto.warehouseName }),
      ...(dto.warehouseType && { warehouseType: dto.warehouseType }),
      ...(dto.plantCode !== undefined && { plantCode: dto.plantCode || null }),
      ...(dto.lineCode !== undefined && { lineCode: dto.lineCode || null }),
      ...(dto.processCode !== undefined && { processCode: dto.processCode || null }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault ? 'Y' : 'N' }),
      ...(dto.useYn && { useYn: dto.useYn }),
    });

    return this.warehouseRepository.findOne({ where: { warehouseCode, ...tenantWhere } });
  }

  /**
   * 창고 삭제 (소프트 삭제)
   */
  async remove(warehouseCode: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...tenantWhere },
    });

    if (!warehouse) {
      throw new NotFoundException('창고를 찾을 수 없습니다.');
    }

    // 해당 창고에 재고가 있는지 확인
    const stockCount = await this.stockRepository.count({
      where: { warehouseCode: warehouse.warehouseCode, ...tenantWhere },
    });

    if (stockCount > 0) {
      throw new ConflictException('해당 창고에 재고가 존재하여 삭제할 수 없습니다.');
    }

    await this.warehouseRepository.delete({ warehouseCode, ...tenantWhere });

    return { warehouseCode, deleted: true };
  }

  /**
   * 기본 창고 조회 (유형별)
   */
  async getDefaultWarehouse(warehouseType: string, company?: string, plant?: string) {
    return this.warehouseRepository.findOne({
      where: {
        warehouseType,
        isDefault: 'Y',
        useYn: 'Y',
        ...this.tenantWhere(company, plant),
      },
    });
  }

  /**
   * 공정재공 창고 조회 또는 생성
   */
  async getOrCreateFloorWarehouse(lineCode: string, processCode: string, company?: string, plant?: string) {
    const warehouseCode = `FLOOR_${lineCode}_${processCode}`;
    const tenantWhere = this.tenantWhere(company, plant);

    let warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...tenantWhere },
    });

    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        warehouseCode,
        warehouseName: `${lineCode} ${processCode} 공정재공`,
        warehouseType: 'WIP',
        plantCode: plant || null,
        lineCode,
        processCode,
        useYn: 'Y',
        isDefault: 'N',
        company: company || null,
        plant: plant || null,
      });

      warehouse = await this.warehouseRepository.save(warehouse);
    }

    return warehouse;
  }

  /**
   * 외주 창고 조회 또는 생성
   */
  async getOrCreateSubconWarehouse(vendorCode: string, vendorName: string, company?: string, plant?: string) {
    const warehouseCode = `SUBCON_${vendorCode}`;
    const tenantWhere = this.tenantWhere(company, plant);

    let warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...tenantWhere },
    });

    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        warehouseCode,
        warehouseName: `${vendorName} 외주`,
        warehouseType: 'SUBCON',
        plantCode: plant || null,
        vendorCode,
        useYn: 'Y',
        isDefault: 'N',
        company: company || null,
        plant: plant || null,
      });

      warehouse = await this.warehouseRepository.save(warehouse);
    }

    return warehouse;
  }

  /**
   * 기본 창고 초기화
   */
  async initDefaultWarehouses(company?: string, plant?: string) {
    const defaultWarehouses = [
      { code: 'RM_MAIN', name: '원자재 메인창고', type: 'RM', isDefault: true },
      { code: 'RM_SUB', name: '원자재 서브창고', type: 'RM', isDefault: false },
      { code: 'FG_WIP', name: '완제품 공정창고', type: 'WIP', isDefault: false },
      { code: 'SFG_WIP', name: '반제품 공정창고', type: 'WIP', isDefault: true },
      { code: 'FG_MAIN', name: '완제품 메인창고', type: 'FG', isDefault: true },
      { code: 'FG_SHIP', name: '출하대기창고', type: 'FG', isDefault: false },
      { code: 'DEFECT', name: '불량품창고', type: 'DEFECT', isDefault: true },
      { code: 'SCRAP', name: '폐기창고', type: 'SCRAP', isDefault: true },
      { code: 'SUBCON_MAIN', name: '외주 메인창고', type: 'SUBCON', isDefault: true },
    ];

    const allCodes = defaultWarehouses.map((wh) => wh.code);
    const tenantWhere = this.tenantWhere(company, plant);
    const existingList = await this.warehouseRepository.find({
      where: allCodes.map((code) => ({ warehouseCode: code, ...tenantWhere })),
      select: ['warehouseCode'],
    });
    const existingSet = new Set(existingList.map((w) => w.warehouseCode));

    const results = [];
    const toCreate: Warehouse[] = [];

    for (const wh of defaultWarehouses) {
      if (existingSet.has(wh.code)) {
        results.push({ code: wh.code, status: 'exists', id: wh.code });
      } else {
        toCreate.push(
          this.warehouseRepository.create({
            warehouseCode: wh.code,
            warehouseName: wh.name,
            warehouseType: wh.type,
            plantCode: plant || null,
            isDefault: wh.isDefault ? 'Y' : 'N',
            useYn: 'Y',
            company: company || null,
            plant: plant || null,
          }),
        );
        results.push({ code: wh.code, status: 'created', id: wh.code });
      }
    }

    if (toCreate.length > 0) {
      await this.warehouseRepository.save(toCreate);
    }

    return {
      message: '기본 창고 초기화 완료',
      results,
    };
  }
}
