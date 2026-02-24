/**
 * @file src/modules/master/services/process.service.ts
 * @description 공정마스터 비즈니스 로직 서비스 - TypeORM
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { CreateProcessDto, UpdateProcessDto, ProcessQueryDto } from '../dto/process.dto';

@Injectable()
export class ProcessService {
  constructor(
    @InjectRepository(ProcessMaster)
    private readonly processRepository: Repository<ProcessMaster>,
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
      queryBuilder.andWhere(
        '(UPPER(process.processCode) LIKE UPPER(:search) OR UPPER(process.processName) LIKE UPPER(:search))',
        { search: `%${search}%` }
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

  async findById(id: string) {
    const process = await this.processRepository.findOne({
      where: { id },
    });
    if (!process) throw new NotFoundException(`공정을 찾을 수 없습니다: ${id}`);
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

  async update(id: string, dto: UpdateProcessDto) {
    await this.findById(id);
    await this.processRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.processRepository.delete(id);
    return { id };
  }
}
