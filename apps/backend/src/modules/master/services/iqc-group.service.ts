/**
 * @file src/modules/master/services/iqc-group.service.ts
 * @description IQC 검사그룹 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. 그룹 CRUD + 그룹-항목 매핑 관리
 * 2. 생성/수정 시 items 배열로 항목 매핑을 일괄 처리
 * 3. 조회 시 items를 JOIN해서 항목 정보 포함
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { IqcGroup } from '../../../entities/iqc-group.entity';
import { IqcGroupItem } from '../../../entities/iqc-group-item.entity';
import { CreateIqcGroupDto, UpdateIqcGroupDto, IqcGroupQueryDto } from '../dto/iqc-group.dto';

@Injectable()
export class IqcGroupService {
  constructor(
    @InjectRepository(IqcGroup)
    private readonly groupRepo: Repository<IqcGroup>,
    @InjectRepository(IqcGroupItem)
    private readonly groupItemRepo: Repository<IqcGroupItem>,
  ) {}

  async findAll(query: IqcGroupQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectMethod, useYn } = query;

    const qb = this.groupRepo.createQueryBuilder('g')
      .leftJoinAndSelect('g.items', 'gi')
      .where('g.deletedAt IS NULL');

    if (company) {
      qb.andWhere('g.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('g.plant = :plant', { plant });
    }

    if (search) {
      qb.andWhere(
        '(g.groupCode LIKE :search OR g.groupName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (inspectMethod) {
      qb.andWhere('g.inspectMethod = :inspectMethod', { inspectMethod });
    }

    if (useYn) {
      qb.andWhere('g.useYn = :useYn', { useYn });
    }

    const [data, total] = await qb
      .orderBy('g.groupCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['items'],
    });

    if (!group) {
      throw new NotFoundException('IQC 검사그룹을 찾을 수 없습니다.');
    }

    return group;
  }

  async create(dto: CreateIqcGroupDto) {
    const exists = await this.groupRepo.findOne({
      where: { groupCode: dto.groupCode, deletedAt: IsNull() },
    });
    if (exists) {
      throw new ConflictException(`그룹코드 ${dto.groupCode}가 이미 존재합니다.`);
    }

    const group = this.groupRepo.create({
      groupCode: dto.groupCode,
      groupName: dto.groupName,
      inspectMethod: dto.inspectMethod,
      sampleQty: dto.inspectMethod === 'SAMPLE' ? dto.sampleQty : null,
      useYn: dto.useYn ?? 'Y',
    });

    const saved = await this.groupRepo.save(group);

    if (dto.items?.length) {
      const items = dto.items.map(i =>
        this.groupItemRepo.create({
          groupId: saved.id,
          itemId: i.itemId,
          seq: i.seq,
        }),
      );
      await this.groupItemRepo.save(items);
    }

    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateIqcGroupDto) {
    const group = await this.findById(id);

    if (dto.groupCode && dto.groupCode !== group.groupCode) {
      const exists = await this.groupRepo.findOne({
        where: { groupCode: dto.groupCode, deletedAt: IsNull() },
      });
      if (exists) {
        throw new ConflictException(`그룹코드 ${dto.groupCode}가 이미 존재합니다.`);
      }
    }

    if (dto.groupName !== undefined) group.groupName = dto.groupName;
    if (dto.inspectMethod !== undefined) group.inspectMethod = dto.inspectMethod;
    if (dto.inspectMethod === 'SAMPLE' && dto.sampleQty !== undefined) {
      group.sampleQty = dto.sampleQty ?? null;
    } else if (dto.inspectMethod && dto.inspectMethod !== 'SAMPLE') {
      group.sampleQty = null;
    }
    if (dto.useYn !== undefined) group.useYn = dto.useYn;

    await this.groupRepo.save(group);

    if (dto.items !== undefined) {
      await this.groupItemRepo.delete({ groupId: id });

      if (dto.items.length) {
        const items = dto.items.map(i =>
          this.groupItemRepo.create({
            groupId: id,
            itemId: i.itemId,
            seq: i.seq,
          }),
        );
        await this.groupItemRepo.save(items);
      }
    }

    return this.findById(id);
  }

  async delete(id: string) {
    const group = await this.findById(id);
    await this.groupRepo.softRemove(group);
    return { id, deleted: true };
  }
}
