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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

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

  async findByCompositeKey(itemCode: string, partnerId: string, company?: string, plant?: string) {
    const link = await this.linkRepo.findOne({
      where: { itemCode, partnerId, ...this.tenantWhere(company, plant) },
      relations: ['part', 'partner', 'group', 'group.items', 'group.items.inspItem'],
    });

    if (!link) {
      throw new NotFoundException('IQC 연결 정보를 찾을 수 없습니다.');
    }

    return link;
  }

  /**
   * 품목별 유효 IQC 검사항목 해석 (검사결과 등록 모달용)
   * 체인: IQC_PART_LINKS → IQC_GROUPS → IQC_GROUP_ITEMS → IQC_ITEM_POOL
   * - 거래처(partnerId) 지정 시 거래처 전용 링크 우선, 없으면 '*'(기본), 그래도 없으면 품목의 첫 링크
   * - 사용중(USE_YN='Y') 링크/항목만, 그룹항목 SEQ 순으로 반환
   * - 반환 형태는 모달이 쓰는 검사항목 계약: { itemCode, seq, inspectItem, spec, lsl, usl, unit, judgeMethod }
   */
  async resolveInspectItems(itemCode: string, partnerId?: string, company?: string, plant?: string) {
    const tenant = this.tenantWhere(company, plant);

    const links = await this.linkRepo.find({
      where: { itemCode, useYn: 'Y', ...tenant },
      relations: ['group', 'group.items', 'group.items.inspItem'],
    });
    if (links.length === 0) return [];

    // 거래처 전용 → 기본('*') → 그 외 첫 링크 순으로 선택
    const link =
      (partnerId && links.find((l) => l.partnerId === partnerId)) ||
      links.find((l) => l.partnerId === '*') ||
      links[0];

    const groupItems = link.group?.items ?? [];
    return groupItems
      .filter((gi) => gi.inspItem && gi.inspItem.useYn !== 'N')
      .sort((a, b) => a.seq - b.seq)
      .map((gi) => ({
        itemCode,
        seq: gi.seq,
        inspectItem: gi.inspItem.inspItemName,
        spec: gi.inspItem.criteria ?? null,
        lsl: gi.inspItem.lsl ?? null,
        usl: gi.inspItem.usl ?? null,
        unit: gi.inspItem.unit ?? null,
        judgeMethod: gi.inspItem.judgeMethod,
      }));
  }

  async create(dto: CreateIqcPartLinkDto, company?: string, plant?: string) {
    const resolvedPartnerId = dto.partnerId || '*';

    const exists = await this.linkRepo.findOne({
      where: { itemCode: dto.itemCode, partnerId: resolvedPartnerId, ...this.tenantWhere(company, plant) },
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
    return this.findByCompositeKey(entity.itemCode, entity.partnerId, company, plant);
  }

  async update(itemCode: string, partnerId: string, dto: UpdateIqcPartLinkDto, company?: string, plant?: string) {
    // 존재 여부 확인
    await this.findByCompositeKey(itemCode, partnerId, company, plant);

    // 관계 로딩 없이 직접 UPDATE (partner=null 시 PK 손상 방지)
    const updateData: Record<string, unknown> = {};
    if (dto.groupCode !== undefined) updateData.groupCode = dto.groupCode;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.linkRepo.update({ itemCode, partnerId, ...this.tenantWhere(company, plant) }, updateData);
    return this.findByCompositeKey(itemCode, partnerId, company, plant);
  }

  async delete(itemCode: string, partnerId: string, company?: string, plant?: string) {
    await this.findByCompositeKey(itemCode, partnerId, company, plant);
    await this.linkRepo.delete({ itemCode, partnerId, ...this.tenantWhere(company, plant) });
    return { itemCode, partnerId, deleted: true };
  }
}
