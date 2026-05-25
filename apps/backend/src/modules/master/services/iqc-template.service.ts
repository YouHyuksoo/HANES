/**
 * @file iqc-template.service.ts
 * @description IQC 항목 템플릿 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findAll: 템플릿 목록(항목 포함) 조회
 * 2. findById: 템플릿 단건(항목 + 검사항목 정보) 조회 — 미리보기용
 * 3. create: TEMPLATE_ID 자동 채번(T0001..) 후 헤더 + 항목 저장
 * 4. delete: 헤더 삭제 (CASCADE로 항목 자동 삭제)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { IqcTemplate } from '../../../entities/iqc-template.entity';
import { IqcTemplateItem } from '../../../entities/iqc-template-item.entity';
import { CreateIqcTemplateDto } from '../dto/iqc-template.dto';

@Injectable()
export class IqcTemplateService {
  constructor(
    @InjectRepository(IqcTemplate)
    private readonly templateRepo: Repository<IqcTemplate>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  async findAll(company?: string, plant?: string): Promise<IqcTemplate[]> {
    const qb = this.templateRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.items', 'i')
      .leftJoinAndSelect('i.inspItem', 'p')
      .orderBy('t.templateId', 'ASC')
      .addOrderBy('i.seq', 'ASC');

    if (company) qb.andWhere('t.company = :company', { company });
    if (plant) qb.andWhere('t.plant = :plant', { plant });

    return qb.getMany();
  }

  async findById(templateId: string, company?: string, plant?: string): Promise<IqcTemplate> {
    const tpl = await this.templateRepo.findOne({
      where: { templateId, ...this.tenantWhere(company, plant) },
      relations: ['items', 'items.inspItem'],
      order: { items: { seq: 'ASC' } },
    });
    if (!tpl) throw new NotFoundException(`템플릿이 없습니다: ${templateId}`);
    return tpl;
  }

  /** 다음 TEMPLATE_ID 채번 — 테넌트별 MAX(TEMPLATE_ID) + 1, T0001 형식 */
  private async nextTemplateId(company: string, plant: string): Promise<string> {
    const row = await this.templateRepo
      .createQueryBuilder('t')
      .select('MAX(t.templateId)', 'maxId')
      .where('t.company = :company', { company })
      .andWhere('t.plant = :plant', { plant })
      .getRawOne<{ maxId: string | null }>();

    const max = row?.maxId ?? null;
    const next = max ? parseInt(max.replace(/^T/, ''), 10) + 1 : 1;
    return `T${String(next).padStart(4, '0')}`;
  }

  async create(
    dto: CreateIqcTemplateDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<IqcTemplate> {
    return this.tx.run(async (queryRunner) => {
      const templateId = await this.nextTemplateId(company, plant);

      const tpl = queryRunner.manager.create(IqcTemplate, {
        templateId,
        templateName: dto.templateName,
        sampleQty: dto.sampleQty,
        isDest: dto.isDest,
        useYn: 'Y',
        company,
        plant,
        createdBy: userId,
        updatedBy: userId,
      });
      await queryRunner.manager.save(IqcTemplate, tpl);

      if (dto.items.length > 0) {
        const items = dto.items.map((it) =>
          queryRunner.manager.create(IqcTemplateItem, {
            templateId,
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            lsl: it.lsl ?? null,
            usl: it.usl ?? null,
            judgeCriteria: it.judgeCriteria ?? null,
            useYn: it.useYn ?? 'Y',
            company,
            plant,
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        await queryRunner.manager.save(IqcTemplateItem, items);
      }

      const saved = await queryRunner.manager.findOne(IqcTemplate, {
        where: { templateId, company, plant },
        relations: ['items', 'items.inspItem'],
        order: { items: { seq: 'ASC' } },
      });
      if (!saved) throw new NotFoundException(`템플릿이 없습니다: ${templateId}`);
      return saved;
    });
  }

  async delete(templateId: string, company?: string, plant?: string): Promise<void> {
    const tpl = await this.templateRepo.findOne({
      where: { templateId, ...this.tenantWhere(company, plant) },
    });
    if (!tpl) throw new NotFoundException(`템플릿이 없습니다: ${templateId}`);
    await this.templateRepo.remove(tpl);
  }
}
