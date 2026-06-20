/**
 * @file src/modules/master/services/process.service.ts
 * @description 공정마스터 비즈니스 로직 서비스 - TypeORM
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ProcessEquipment } from '../../../entities/process-equipment.entity';
import { CreateProcessDto, UpdateProcessDto, ProcessQueryDto } from '../dto/process.dto';

@Injectable()
export class ProcessService {
  constructor(
    @InjectRepository(ProcessMaster)
    private readonly processRepository: Repository<ProcessMaster>,
    @InjectRepository(EquipMaster)
    private readonly equipRepository: Repository<EquipMaster>,
    @InjectRepository(ProcessEquipment)
    private readonly processEquipmentRepository: Repository<ProcessEquipment>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  async findAll(query: ProcessQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, processType, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.processRepository.createQueryBuilder('process')

    if (company) {
      queryBuilder.andWhere('process.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('process.plant = :plant', { plant });
    }

    if (processType) {
      queryBuilder.andWhere('process.processType = :processType', { processType });
    }

    if (useYn) {
      queryBuilder.andWhere('process.useYn = :useYn', { useYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(process.processCode LIKE :search OR process.processName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('process.sortOrder', 'ASC')
        .addOrderBy('process.processCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(processCode: string, company?: string, plant?: string) {
    const process = await this.processRepository.findOne({
      where: { processCode, ...this.tenantWhere(company, plant) },
    });
    if (!process) throw new NotFoundException(`공정을 찾을 수 없습니다: ${processCode}`);
    return process;
  }

  async create(dto: CreateProcessDto, company?: string, plant?: string) {
    const existing = await this.processRepository.findOne({
      where: { processCode: dto.processCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 공정 코드입니다: ${dto.processCode}`);

    const process = this.processRepository.create({
      processCode: dto.processCode,
      processName: dto.processName,
      processType: dto.processType,
      processCategory: dto.processCategory ?? null,
      lineType: dto.lineType ?? null,
      sortOrder: dto.sortOrder ?? 0,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });

    return this.processRepository.save(process);
  }

  async update(processCode: string, dto: UpdateProcessDto, company?: string, plant?: string) {
    await this.findById(processCode, company, plant);
    const updateData: Partial<Pick<ProcessMaster,
      | 'processName'
      | 'processType'
      | 'processCategory'
      | 'lineType'
      | 'sortOrder'
      | 'remark'
      | 'useYn'
    >> = {
      ...(dto.processName !== undefined ? { processName: dto.processName } : {}),
      ...(dto.processType !== undefined ? { processType: dto.processType } : {}),
      ...(dto.processCategory !== undefined ? { processCategory: dto.processCategory } : {}),
      ...(dto.lineType !== undefined ? { lineType: dto.lineType } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.processRepository.update({ processCode, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(processCode, company, plant);
  }

  async delete(processCode: string, company?: string, plant?: string) {
    await this.findById(processCode, company, plant);
    await this.processRepository.delete({ processCode, ...this.tenantWhere(company, plant) });
    return { processCode };
  }

  async findEquipments(processCode: string, company?: string, plant?: string) {
    await this.findById(processCode, company, plant);

    const assignments = await this.processEquipmentRepository.find({
      where: { processCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      relations: ['equipment'],
      order: { equipCode: 'ASC' },
    });

    return assignments
      .map((assignment) => assignment.equipment)
      .filter((equipment): equipment is EquipMaster => !!equipment);
  }

  async getEquipmentCounts(company?: string, plant?: string): Promise<Record<string, number>> {
    const qb = this.processEquipmentRepository
      .createQueryBuilder('pe')
      .select('pe.processCode', 'processCode')
      .addSelect('COUNT(*)', 'count')
      .where('pe.useYn = :useYn', { useYn: 'Y' });

    if (company) qb.andWhere('pe.company = :company', { company });
    if (plant) qb.andWhere('pe.plant = :plant', { plant });

    const rows = await qb
      .groupBy('pe.processCode')
      .getRawMany<{ processCode: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.processCode] = Number(row.count);
      return acc;
    }, {});
  }

  async assignEquipment(processCode: string, equipCode: string, company?: string, plant?: string) {
    await this.findById(processCode, company, plant);

    const equipment = await this.equipRepository.findOne({
      where: { equipCode, ...this.tenantWhere(company, plant) },
    });
    if (!equipment) {
      throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    }

    const existing = await this.processEquipmentRepository.findOne({
      where: { processCode, equipCode, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      if (existing.useYn === 'Y') {
        throw new ConflictException(`이미 배치된 설비입니다: ${equipCode}`);
      }
      await this.processEquipmentRepository.update(
        { processCode, equipCode, ...this.tenantWhere(company, plant) },
        { useYn: 'Y' },
      );
      return this.processEquipmentRepository.findOne({
        where: { processCode, equipCode, ...this.tenantWhere(company, plant) },
      });
    }

    const assignment = this.processEquipmentRepository.create({
      company: company || null,
      plant: plant || null,
      processCode,
      equipCode,
      useYn: 'Y',
    });

    return this.processEquipmentRepository.save(assignment);
  }

  async removeEquipment(processCode: string, equipCode: string, company?: string, plant?: string) {
    await this.findById(processCode, company, plant);
    await this.processEquipmentRepository.delete({ processCode, equipCode, ...this.tenantWhere(company, plant) });
    return { processCode, equipCode };
  }
}
