import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { CreateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectItemPool)
    private readonly poolRepository: Repository<EquipInspectItemPool>,
  ) {}

  async findAll(query: EquipInspectItemQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 500, equipCode, inspectType, search, useYn } = query;

    const qb = this.poolRepository.createQueryBuilder('pool')
      .leftJoin(
        EquipInspectItemMaster,
        'master',
        'pool.company = master.company AND pool.plant = master.plant AND pool.itemCode = master.itemCode',
      )
      .select('pool.equipCode', 'equipCode')
      .addSelect('pool.itemCode', 'itemCode')
      .addSelect('pool.inspectType', 'inspectType')
      .addSelect('pool.useYn', 'useYn')
      .addSelect('pool.sortSeq', 'sortSeq')
      .addSelect('master.itemName', 'itemName')
      .addSelect('master.criteria', 'criteria')
      .addSelect('master.cycle', 'cycle')
      .addSelect('master.itemType', 'itemType')
      .addSelect('master.unit', 'unit')
      .addSelect('master.lslValue', 'lslValue')
      .addSelect('master.uslValue', 'uslValue')
      .addSelect('master.workerQrCode', 'workerQrCode')
      .addSelect('master.imageUrl', 'imageUrl');

    if (company) qb.andWhere('pool.company = :company', { company });
    if (plant) qb.andWhere('pool.plant = :plant', { plant });
    if (equipCode) qb.andWhere('pool.equipCode = :equipCode', { equipCode });
    if (inspectType) qb.andWhere('pool.inspectType = :inspectType', { inspectType });
    if (useYn) qb.andWhere('pool.useYn = :useYn', { useYn });
    if (search) {
      qb.andWhere('(master.itemName LIKE :search OR pool.itemCode LIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('pool.inspectType', 'ASC').addOrderBy('pool.sortSeq', 'ASC').addOrderBy('pool.itemCode', 'ASC');

    const total = await qb.getCount();
    const data = await qb.offset((page - 1) * limit).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  async create(dto: CreateEquipInspectItemDto, company: string, plant: string) {
    const existing = await this.poolRepository.findOne({
      where: { company, plant, equipCode: dto.equipCode, itemCode: dto.itemCode, inspectType: dto.inspectType },
    });
    if (existing) {
      throw new ConflictException(`이미 등록된 항목입니다: ${dto.equipCode}/${dto.itemCode}/${dto.inspectType}`);
    }

    const entity = this.poolRepository.create({
      company,
      plant,
      equipCode: dto.equipCode,
      itemCode: dto.itemCode,
      inspectType: dto.inspectType,
      useYn: dto.useYn ?? 'Y',
      sortSeq: dto.sortSeq ?? null,
    });
    return this.poolRepository.save(entity);
  }

  async delete(company: string, plant: string, equipCode: string, itemCode: string, inspectType: string) {
    const item = await this.poolRepository.findOne({
      where: { company, plant, equipCode, itemCode, inspectType },
    });
    if (!item) {
      throw new NotFoundException(`점검항목을 찾을 수 없습니다: ${equipCode}/${itemCode}/${inspectType}`);
    }
    await this.poolRepository.remove(item);
    return { equipCode, itemCode, inspectType, deleted: true };
  }
}
