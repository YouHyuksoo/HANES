/**
 * @file src/modules/master/services/label-template.service.ts
 * @description 라벨 템플릿 서비스 - DB CRUD + 기본 템플릿 관리
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabelTemplate } from '../../../entities/label-template.entity';
import {
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  LabelTemplateQueryDto,
} from '../dto/label-template.dto';

@Injectable()
export class LabelTemplateService {
  constructor(
    @InjectRepository(LabelTemplate)
    private readonly labelTemplateRepository: Repository<LabelTemplate>,
  ) {}

  async findAll(query: LabelTemplateQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, category, search } = query;

    const queryBuilder = this.labelTemplateRepository.createQueryBuilder('template');

    if (company) {
      queryBuilder.andWhere('template.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('template.plant = :plant', { plant });
    }

    if (category) {
      queryBuilder.andWhere('template.category = :category', { category });
    }

    if (search) {
      queryBuilder.andWhere('template.templateName LIKE :search', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await queryBuilder
      .orderBy('template.category', 'ASC')
      .addOrderBy('template.templateName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const template = await this.labelTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('라벨 템플릿을 찾을 수 없습니다.');
    }

    return template;
  }

  async create(dto: CreateLabelTemplateDto) {
    if (dto.isDefault) {
      await this.clearDefaultByCategory(dto.category);
    }

    const entity = this.labelTemplateRepository.create({
      ...dto,
      designData: JSON.stringify(dto.designData),
    });
    const saved = await this.labelTemplateRepository.save(entity);
    return saved;
  }

  async update(id: string, dto: UpdateLabelTemplateDto) {
    const template = await this.findById(id);

    if (dto.isDefault) {
      await this.clearDefaultByCategory(dto.category || template.category);
    }

    // Build update data manually to handle type conversion
    const updateData: Partial<LabelTemplate> = {
      templateName: dto.templateName,
      category: dto.category,
      isDefault: dto.isDefault,
      remark: dto.remark,
    };
    
    if (dto.designData) {
      updateData.designData = JSON.stringify(dto.designData);
    }

    const updated = await this.labelTemplateRepository.save({
      ...template,
      ...updateData,
      id,
    });

    return updated;
  }

  async delete(id: string) {
    const template = await this.findById(id);

    await this.labelTemplateRepository.remove(template);

    return { id, deleted: true };
  }

  private async clearDefaultByCategory(category: string): Promise<void> {
    await this.labelTemplateRepository
      .createQueryBuilder()
      .update(LabelTemplate)
      .set({ isDefault: false })
      .where('category = :category', { category })
      .andWhere('isDefault = :isDefault', { isDefault: true })
      .execute();
  }
}
