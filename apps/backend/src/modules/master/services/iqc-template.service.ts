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
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
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

  async findAll(company?: string, plant?: string, page = 1, limit = 200) {
    const skip = (page - 1) * limit;

    const qb = this.templateRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.items', 'i')
      .leftJoinAndSelect('i.inspItem', 'p')
      .orderBy('t.templateId', 'ASC')
      .addOrderBy('i.seq', 'ASC');

    if (company) qb.andWhere('t.company = :company', { company });
    if (plant) qb.andWhere('t.plant = :plant', { plant });

    const countQb = this.templateRepo.createQueryBuilder('t');
    if (company) countQb.andWhere('t.company = :company', { company });
    if (plant) countQb.andWhere('t.plant = :plant', { plant });

    const [data, total] = await Promise.all([
      qb.skip(skip).take(limit).getMany(),
      countQb.getCount(),
    ]);

    return { data, total, page, limit };
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

  /**
   * 다음 TEMPLATE_ID 채번 — Oracle sequence 기반, T0001 형식.
   * 글로벌 시퀀스라 (COMPANY, PLANT_CD) PK 하위에서 채번이 dense 하지 않을 수 있다.
   * sequence 가 9999 를 넘으면 T#### 자리수가 깨지므로 명시적으로 차단하고 운영자에게 알린다.
   */
  private async nextTemplateId(queryRunner: QueryRunner): Promise<string> {
    const result = await queryRunner.manager.query(
      `SELECT SEQ_IQC_TEMPLATES.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    const nextSeq = Number(result[0].nextSeq);
    if (!Number.isFinite(nextSeq) || nextSeq <= 0) {
      throw new InternalServerErrorException(
        `IQC 템플릿 ID 시퀀스 값이 비정상입니다: ${result[0].nextSeq}`,
      );
    }
    if (nextSeq > 9999) {
      throw new InternalServerErrorException(
        `IQC 템플릿 ID 시퀀스가 9999 를 초과했습니다 (current=${nextSeq}). ` +
          `자릿수 확장(예: T#####) 또는 sequence 재설정 후 다시 시도해 주세요.`,
      );
    }
    return `T${String(nextSeq).padStart(4, '0')}`;
  }

  async create(
    dto: CreateIqcTemplateDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<IqcTemplate> {
    return this.tx.run(async (queryRunner) => {
      const templateId = await this.nextTemplateId(queryRunner);

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
            defectGrade: it.defectGrade ?? null,
            inspectionLevel: it.inspectionLevel ?? null,
            aql: it.aql ?? null,
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
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
