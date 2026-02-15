/**
 * @file src/modules/master/services/label-template.service.ts
 * @description 라벨 템플릿 서비스 - DB CRUD + 기본 템플릿 관리
 *
 * 초보자 가이드:
 * 1. **저장**: 라벨 디자인 설정을 JSON으로 DB에 저장
 * 2. **기본 템플릿**: 카테고리별 하나만 기본 설정 가능
 * 3. **소프트 삭제**: deletedAt으로 논리 삭제
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  LabelTemplateQueryDto,
} from '../dto/label-template.dto';

@Injectable()
export class LabelTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** 목록 조회 (카테고리 필터 + 검색) */
  async findAll(query: LabelTemplateQueryDto) {
    const { page = 1, limit = 50, category, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      useYn: 'Y',
      ...(category && { category }),
      ...(search && {
        templateName: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.labelTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.labelTemplate.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 단건 조회 */
  async findById(id: string) {
    const template = await this.prisma.labelTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundException(`라벨 템플릿을 찾을 수 없습니다: ${id}`);
    }
    return template;
  }

  /** 생성 (기본 템플릿 설정 시 기존 기본 해제) */
  async create(dto: CreateLabelTemplateDto) {
    const existing = await this.prisma.labelTemplate.findFirst({
      where: {
        templateName: dto.templateName,
        category: dto.category,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `같은 카테고리에 동일한 템플릿명이 존재합니다: ${dto.templateName}`,
      );
    }

    if (dto.isDefault) {
      await this.clearDefault(dto.category);
    }

    return this.prisma.labelTemplate.create({
      data: {
        templateName: dto.templateName,
        category: dto.category,
        designData: dto.designData as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
        remark: dto.remark,
      },
    });
  }

  /** 수정 */
  async update(id: string, dto: UpdateLabelTemplateDto) {
    await this.findById(id);

    if (dto.isDefault && dto.category) {
      await this.clearDefault(dto.category);
    } else if (dto.isDefault) {
      const current = await this.findById(id);
      await this.clearDefault(current.category);
    }

    return this.prisma.labelTemplate.update({
      where: { id },
      data: {
        ...(dto.templateName !== undefined && {
          templateName: dto.templateName,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.designData !== undefined && { designData: dto.designData as Prisma.InputJsonValue }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
    });
  }

  /** 소프트 삭제 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.labelTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** 카테고리별 기본 템플릿 해제 */
  private async clearDefault(category: string) {
    await this.prisma.labelTemplate.updateMany({
      where: { category, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }
}
