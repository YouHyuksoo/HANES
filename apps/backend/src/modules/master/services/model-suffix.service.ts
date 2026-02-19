/**
 * @file src/modules/master/services/model-suffix.service.ts
 * @description 모델접미사 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ModelSuffix } from '../../../entities/model-suffix.entity';
import { CreateModelSuffixDto, UpdateModelSuffixDto, ModelSuffixQueryDto } from '../dto/model-suffix.dto';

@Injectable()
export class ModelSuffixService {
  constructor(
    @InjectRepository(ModelSuffix)
    private readonly modelSuffixRepository: Repository<ModelSuffix>,
  ) {}

  async findAll(query: ModelSuffixQueryDto) {
    const { page = 1, limit = 10, modelCode, customer, search, useYn } = query;

    const queryBuilder = this.modelSuffixRepository.createQueryBuilder('suffix')
      .where('suffix.deletedAt IS NULL');

    if (modelCode) {
      queryBuilder.andWhere('suffix.modelCode = :modelCode', { modelCode });
    }

    if (customer) {
      queryBuilder.andWhere('suffix.customer = :customer', { customer });
    }

    if (useYn) {
      queryBuilder.andWhere('suffix.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(suffix.modelCode LIKE :search OR suffix.suffixCode LIKE :search OR suffix.suffixName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('suffix.modelCode', 'ASC')
      .addOrderBy('suffix.suffixCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const suffix = await this.modelSuffixRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!suffix) {
      throw new NotFoundException('모델접미사를 찾을 수 없습니다.');
    }

    return suffix;
  }

  async create(dto: CreateModelSuffixDto) {
    const existing = await this.modelSuffixRepository.findOne({
      where: {
        modelCode: dto.modelCode,
        suffixCode: dto.suffixCode,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException('이미 존재하는 모델접미사 조합입니다.');
    }

    const entity = this.modelSuffixRepository.create(dto);
    const saved = await this.modelSuffixRepository.save(entity);
    return saved;
  }

  async update(id: string, dto: UpdateModelSuffixDto) {
    const suffix = await this.findById(id);

    if (dto.modelCode && dto.suffixCode) {
      const existing = await this.modelSuffixRepository.findOne({
        where: {
          modelCode: dto.modelCode,
          suffixCode: dto.suffixCode,
          deletedAt: IsNull(),
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('이미 존재하는 모델접미사 조합입니다.');
      }
    }

    const updated = await this.modelSuffixRepository.save({
      ...suffix,
      ...dto,
      id,
    });

    return updated;
  }

  async delete(id: string) {
    const suffix = await this.findById(id);

    await this.modelSuffixRepository.softRemove(suffix);

    return { id, deleted: true };
  }
}
