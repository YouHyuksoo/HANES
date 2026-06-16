/**
 * @file src/modules/master/services/work-instruction.service.ts
 * @description 작업지도서 비즈니스 로직 서비스 - TypeORM
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

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
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(wi.itemCode LIKE :searchCode OR wi.title LIKE :searchRaw OR wi.processCode LIKE :searchCode)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` }
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

  /**
   * id 문자열에서 복합키 파싱 ("itemCode::processCode::revision" 형식)
   */
  private parseCompositeId(id: string): { itemCode: string; processCode: string; revision: string } {
    const parts = id.split('::');
    if (parts.length === 3) {
      return { itemCode: parts[0], processCode: parts[1], revision: parts[2] };
    }
    throw new NotFoundException(`잘못된 작업지도서 ID 형식입니다: ${id}`);
  }

  async findById(id: string, company?: string, plant?: string) {
    const key = this.parseCompositeId(id);
    const workInstruction = await this.workInstructionRepository.findOne({
      where: { ...key, ...this.tenantWhere(company, plant) },
    });
    if (!workInstruction) throw new NotFoundException(`작업지도서를 찾을 수 없습니다: ${id}`);
    return workInstruction;
  }

  async create(dto: CreateWorkInstructionDto, company?: string, plant?: string) {
    const key = {
      itemCode: dto.itemCode,
      processCode: dto.processCode ?? '',
      revision: dto.revision ?? 'A',
    };
    const existing = await this.workInstructionRepository.findOne({
      where: { ...key, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 등록된 작업지도서입니다: ${key.itemCode}/${key.processCode}/${key.revision}`);
    }

    const workInstruction = this.workInstructionRepository.create({
      itemCode: key.itemCode,
      processCode: key.processCode,
      title: dto.title,
      content: dto.content,
      imageUrl: dto.imageUrl,
      revision: key.revision,
      useYn: dto.useYn ?? 'Y',
      company: company || null,
      plant: plant || null,
    });

    return this.workInstructionRepository.save(workInstruction);
  }

  async update(id: string, dto: UpdateWorkInstructionDto, company?: string, plant?: string) {
    await this.findById(id, company, plant);
    const key = this.parseCompositeId(id);
    const updateData: Partial<WorkInstruction> = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.workInstructionRepository.update({ ...key, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(id, company, plant);
  }

  async delete(id: string, company?: string, plant?: string) {
    await this.findById(id, company, plant);
    const key = this.parseCompositeId(id);
    await this.workInstructionRepository.delete({ ...key, ...this.tenantWhere(company, plant) });
    return { id };
  }
}
