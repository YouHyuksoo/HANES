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

  async findById(processCode: string) {
    const process = await this.processRepository.findOne({
      where: { processCode },
    });
    if (!process) throw new NotFoundException(`공정을 찾을 수 없습니다: ${processCode}`);
    return process;
  }

  async create(dto: CreateProcessDto) {
    const existing = await this.processRepository.findOne({
      where: { processCode: dto.processCode },
    });
    if (existing) throw new ConflictException(`이미 존재하는 공정 코드입니다: ${dto.processCode}`);

    const process = this.processRepository.create({
      processCode: dto.processCode,
      processName: dto.processName,
      processType: dto.processType,
      sortOrder: dto.sortOrder ?? 0,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.processRepository.save(process);
  }

  async update(processCode: string, dto: UpdateProcessDto) {
    await this.findById(processCode);
    await this.processRepository.update({ processCode }, dto);
    return this.findById(processCode);
  }

  async delete(processCode: string) {
    await this.findById(processCode);
    await this.processRepository.delete({ processCode });
    return { processCode };
  }

  async findEquipments(processCode: string) {
    await this.findById(processCode);

    const assignments = await this.processEquipmentRepository.find({
      where: { processCode, useYn: 'Y' },
      relations: ['equipment'],
      order: { equipCode: 'ASC' },
    });

    return assignments
      .map((assignment) => assignment.equipment)
      .filter((equipment): equipment is EquipMaster => !!equipment);
  }

  async getEquipmentCounts(): Promise<Record<string, number>> {
    const rows = await this.processEquipmentRepository
      .createQueryBuilder('pe')
      .select('pe.processCode', 'processCode')
      .addSelect('COUNT(*)', 'count')
      .where('pe.useYn = :useYn', { useYn: 'Y' })
      .groupBy('pe.processCode')
      .getRawMany<{ processCode: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.processCode] = Number(row.count);
      return acc;
    }, {});
  }

  async assignEquipment(processCode: string, equipCode: string) {
    await this.findById(processCode);

    const equipment = await this.equipRepository.findOne({ where: { equipCode } });
    if (!equipment) {
      throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    }

    const existing = await this.processEquipmentRepository.findOne({
      where: { processCode, equipCode },
    });

    if (existing) {
      if (existing.useYn === 'Y') {
        return existing;
      }
      await this.processEquipmentRepository.update({ processCode, equipCode }, { useYn: 'Y' });
      return this.processEquipmentRepository.findOne({ where: { processCode, equipCode } });
    }

    const assignment = this.processEquipmentRepository.create({
      processCode,
      equipCode,
      useYn: 'Y',
    });

    return this.processEquipmentRepository.save(assignment);
  }

  async removeEquipment(processCode: string, equipCode: string) {
    await this.findById(processCode);
    await this.processEquipmentRepository.delete({ processCode, equipCode });
    return { processCode, equipCode };
  }
}
