/**
 * @file src/modules/master/services/work-instruction.service.ts
 * @description 작업지도서 비즈니스 로직 서비스 - TypeORM
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkInstruction } from '../../../entities/work-instruction.entity';
import { CreateWorkInstructionDto, UpdateWorkInstructionDto, WorkInstructionQueryDto } from '../dto/work-instruction.dto';

@Injectable()
export class WorkInstructionService {
  constructor(
    @InjectRepository(WorkInstruction)
    private readonly workInstructionRepository: Repository<WorkInstruction>,
  ) {}

  async findAll(query: WorkInstructionQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, itemCode, processCode, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.workInstructionRepository.createQueryBuilder('wi')

    if (company) {
      queryBuilder.andWhere('wi.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('wi.plant = :plant', { plant });
    }

    if (itemCode) {
      queryBuilder.andWhere('wi.itemCode = :itemCode', { itemCode });
    }

    if (processCode) {
      queryBuilder.andWhere('wi.processCode = :processCode', { processCode });
    }

    if (useYn) {
      queryBuilder.andWhere('wi.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(wi.itemCode) LIKE UPPER(:search) OR UPPER(wi.title) LIKE UPPER(:search) OR UPPER(wi.processCode) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('wi.itemCode', 'ASC')
        .addOrderBy('wi.processCode', 'ASC')
        .addOrderBy('wi.revision', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const workInstruction = await this.workInstructionRepository.findOne({
      where: { id: +id },
    });
    if (!workInstruction) throw new NotFoundException(`작업지도서를 찾을 수 없습니다: ${id}`);
    return workInstruction;
  }

  async create(dto: CreateWorkInstructionDto) {
    const workInstruction = this.workInstructionRepository.create({
      itemCode: dto.itemCode,
      processCode: dto.processCode,
      title: dto.title,
      content: dto.content,
      imageUrl: dto.imageUrl,
      revision: dto.revision ?? 'A',
      useYn: dto.useYn ?? 'Y',
    });

    return this.workInstructionRepository.save(workInstruction);
  }

  async update(id: string, dto: UpdateWorkInstructionDto) {
    await this.findById(id);
    await this.workInstructionRepository.update(+id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.workInstructionRepository.delete(+id);
    return { id };
  }
}
