/**
 * @file src/modules/master/services/iqc-item-pool.service.ts
 * @description IQC 검사항목 풀(Pool) CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findAll: 전체 검사항목 풀 조회 (검색/필터)
 * 2. create: 항목코드 중복 검증 후 생성
 * 3. update/delete: 수정/소프트삭제
 */

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IqcItemPool } from '../../../entities/iqc-item-pool.entity';
import {
  CreateIqcItemPoolDto,
  UpdateIqcItemPoolDto,
  IqcItemPoolQueryDto,
} from '../dto/iqc-item-pool.dto';

@Injectable()
export class IqcItemPoolService {
  constructor(
    @InjectRepository(IqcItemPool)
    private readonly repo: Repository<IqcItemPool>,
  ) {}

  async findAll(query: IqcItemPoolQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, judgeMethod, useYn } = query;

    const qb = this.repo.createQueryBuilder('item');

    if (company) {
      qb.andWhere('item.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('item.plant = :plant', { plant });
    }

    if (judgeMethod) {
      qb.andWhere('item.judgeMethod = :judgeMethod', { judgeMethod });
    }

    if (useYn) {
      qb.andWhere('item.useYn = :useYn', { useYn });
    }

    if (search) {
      qb.andWhere(
        '(item.inspItemCode LIKE :search OR item.inspItemName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('item.inspItemCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.repo.findOne({
      where: { id: +id },
    });
    if (!item) {
      throw new NotFoundException('검사항목을 찾을 수 없습니다.');
    }
    return item;
  }

  async create(dto: CreateIqcItemPoolDto) {
    const existing = await this.repo.findOne({
      where: { inspItemCode: dto.inspItemCode },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 항목코드입니다: ${dto.inspItemCode}`);
    }

    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateIqcItemPoolDto) {
    const item = await this.findById(id);

    if (dto.inspItemCode && dto.inspItemCode !== item.inspItemCode) {
      const dup = await this.repo.findOne({
        where: { inspItemCode: dto.inspItemCode },
      });
      if (dup) {
        throw new ConflictException(`이미 존재하는 항목코드입니다: ${dto.inspItemCode}`);
      }
    }

    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async delete(id: string) {
    const item = await this.findById(id);
    await this.repo.remove(item);
    return { id, deleted: true };
  }
}
