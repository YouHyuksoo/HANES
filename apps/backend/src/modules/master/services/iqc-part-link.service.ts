/**
 * @file src/modules/master/services/iqc-part-link.service.ts
 * @description IQC 품목-거래처-검사그룹 연결 서비스
 *
 * 초보자 가이드:
 * 1. 연결 CRUD — Part, Partner, IqcGroup을 JOIN하여 조회
 * 2. 중복 체크: 같은 품목+거래처 조합은 하나만 허용
 * 3. partnerId가 null이면 기본 검사그룹으로 등록
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
      .leftJoinAndSelect('link.group', 'grp');

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
      .addOrderBy('partner.partnerCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const link = await this.linkRepo.findOne({
      where: { id },
      relations: ['part', 'partner', 'group'],
    });

    if (!link) {
      throw new NotFoundException('IQC 연결 정보를 찾을 수 없습니다.');
    }

    return link;
  }

  async create(dto: CreateIqcPartLinkDto) {
    const whereCondition: any = {
      itemCode: dto.itemCode,
    };

    if (dto.partnerId) {
      whereCondition.partnerId = dto.partnerId;
    } else {
      whereCondition.partnerId = IsNull();
    }

    const exists = await this.linkRepo.findOne({ where: whereCondition });
    if (exists) {
      throw new ConflictException('이미 동일한 품목-거래처 연결이 존재합니다.');
    }

    const entity = this.linkRepo.create({
      itemCode: dto.itemCode,
      partnerId: dto.partnerId || null,
      groupId: dto.groupId,
      remark: dto.remark || null,
      useYn: dto.useYn ?? 'Y',
    });

    const saved = await this.linkRepo.save(entity);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateIqcPartLinkDto) {
    const link = await this.findById(id);

    if (dto.itemCode !== undefined) link.itemCode = dto.itemCode;
    if (dto.partnerId !== undefined) link.partnerId = dto.partnerId || null;
    if (dto.groupId !== undefined) link.groupId = dto.groupId;
    if (dto.remark !== undefined) link.remark = dto.remark || null;
    if (dto.useYn !== undefined) link.useYn = dto.useYn;

    await this.linkRepo.save(link);
    return this.findById(id);
  }

  async delete(id: string) {
    const link = await this.findById(id);
    await this.linkRepo.remove(link);
    return { id, deleted: true };
  }
}
