/**
 * @file src/modules/master/services/iqc-part-link.service.ts
 * @description IQC 품목-거래처-검사그룹 연결 서비스
 *
 * 초보자 가이드:
 * 1. 연결 CRUD — Part, Partner, IqcGroup을 JOIN하여 조회
 * 2. 중복 체크: 같은 품목+거래처 조합은 하나만 허용
 * 3. partnerId가 없으면 '*'(기본 검사그룹)으로 등록
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IqcPartLink } from '../../../entities/iqc-part-link.entity';
import { CreateIqcPartLinkDto, UpdateIqcPartLinkDto, IqcPartLinkQueryDto } from '../dto/iqc-part-link.dto';

@Injectable()
export class IqcPartLinkService {
  constructor(
    @InjectRepository(IqcPartLink)
    private readonly linkRepo: Repository<IqcPartLink>,
  ) {}

  async findAll(query: IqcPartLinkQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, partnerId, useYn } = query;

    const qb = this.linkRepo.createQueryBuilder('link')
      .leftJoinAndSelect('link.part', 'part')
      .leftJoinAndSelect('link.partner', 'partner')
      .leftJoinAndSelect('link.group', 'grp')
      .leftJoinAndSelect('grp.items', 'gi')
      .leftJoinAndSelect('gi.inspItem', 'pool');

    if (company) {
      qb.andWhere('link.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('link.plant = :plant', { plant });
    }

    if (search) {
      qb.andWhere(
        '(part.itemCode LIKE :search OR part.itemName LIKE :search OR partner.partnerName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (partnerId) {
      qb.andWhere('link.partnerId = :partnerId', { partnerId });
    }

    if (useYn) {
      qb.andWhere('link.useYn = :useYn', { useYn });
    }

    const [data, total] = await qb
      .orderBy('part.itemCode', 'ASC')
      .addOrderBy('link.partnerId', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findByCompositeKey(itemCode: string, partnerId: string) {
    const link = await this.linkRepo.findOne({
      where: { itemCode, partnerId },
      relations: ['part', 'partner', 'group', 'group.items', 'group.items.inspItem'],
    });

    if (!link) {
      throw new NotFoundException('IQC 연결 정보를 찾을 수 없습니다.');
    }

    return link;
  }

  async create(dto: CreateIqcPartLinkDto, company?: string, plant?: string) {
    const resolvedPartnerId = dto.partnerId || '*';

    const exists = await this.linkRepo.findOne({
      where: { itemCode: dto.itemCode, partnerId: resolvedPartnerId },
    });
    if (exists) {
      throw new ConflictException('이미 동일한 품목-거래처 연결이 존재합니다.');
    }

    const entity = this.linkRepo.create({
      itemCode: dto.itemCode,
      partnerId: resolvedPartnerId,
      groupCode: dto.groupCode,
      remark: dto.remark || null,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });

    await this.linkRepo.save(entity);
    return this.findByCompositeKey(entity.itemCode, entity.partnerId);
  }

  async update(itemCode: string, partnerId: string, dto: UpdateIqcPartLinkDto) {
    // 존재 여부 확인
    await this.findByCompositeKey(itemCode, partnerId);

    // 관계 로딩 없이 직접 UPDATE (partner=null 시 PK 손상 방지)
    const updateData: Record<string, unknown> = {};
    if (dto.groupCode !== undefined) updateData.groupCode = dto.groupCode;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.linkRepo.update({ itemCode, partnerId }, updateData);
    return this.findByCompositeKey(itemCode, partnerId);
  }

  async delete(itemCode: string, partnerId: string) {
    await this.findByCompositeKey(itemCode, partnerId);
    await this.linkRepo.delete({ itemCode, partnerId });
    return { itemCode, partnerId, deleted: true };
  }
}
