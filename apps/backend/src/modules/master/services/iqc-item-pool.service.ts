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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

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

  async findByCode(inspItemCode: string, company?: string, plant?: string) {
    const item = await this.repo.findOne({
      where: { inspItemCode, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('검사항목을 찾을 수 없습니다.');
    }
    return item;
  }

  async create(dto: CreateIqcItemPoolDto, company?: string, plant?: string) {
    const existing = await this.repo.findOne({
      where: { inspItemCode: dto.inspItemCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 항목코드입니다: ${dto.inspItemCode}`);
    }

    const entity = this.repo.create({
      inspItemCode: dto.inspItemCode,
      inspItemName: dto.inspItemName,
      judgeMethod: dto.judgeMethod,
      criteria: dto.criteria ?? null,
      lsl: dto.lsl ?? null,
      usl: dto.usl ?? null,
      unit: dto.unit ?? null,
      revision: dto.revision ?? 1,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
      company: company || null,
      plant: plant || null,
    });
    return this.repo.save(entity);
  }

  async update(inspItemCode: string, dto: UpdateIqcItemPoolDto, company?: string, plant?: string) {
    const item = await this.findByCode(inspItemCode, company, plant);

    const updateData: Partial<IqcItemPool> = {
      ...(dto.inspItemName !== undefined ? { inspItemName: dto.inspItemName } : {}),
      ...(dto.judgeMethod !== undefined ? { judgeMethod: dto.judgeMethod } : {}),
      ...(dto.criteria !== undefined ? { criteria: dto.criteria } : {}),
      ...(dto.lsl !== undefined ? { lsl: dto.lsl } : {}),
      ...(dto.usl !== undefined ? { usl: dto.usl } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.revision !== undefined ? { revision: dto.revision } : {}),
      ...(dto.effectiveDate !== undefined ? { effectiveDate: new Date(dto.effectiveDate) } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    Object.assign(item, updateData);
    return this.repo.save(item);
  }

  async delete(inspItemCode: string, company?: string, plant?: string) {
    const item = await this.findByCode(inspItemCode, company, plant);
    await this.repo.remove(item);
    return { inspItemCode, deleted: true };
  }
}
