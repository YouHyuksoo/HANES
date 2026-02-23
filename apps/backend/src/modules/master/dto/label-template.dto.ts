/**
 * @file src/modules/master/dto/label-template.dto.ts
 * @description 라벨 템플릿 DTO - 라벨 디자인 저장/조회/수정 요청 검증
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLabelTemplateDto {
  @ApiProperty({ description: '템플릿 이름', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  templateName: string;

  @ApiProperty({ description: '카테고리', enum: ['equip', 'jig', 'worker', 'part', 'mat_lot'] })
  @IsString()
  @IsIn(['equip', 'jig', 'worker', 'part', 'mat_lot'])
  category: string;

  @ApiProperty({ description: '라벨 디자인 설정 (JSON)' })
  @IsObject()
  designData: Record<string, unknown>;

  @ApiPropertyOptional({ description: '기본 템플릿 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateLabelTemplateDto extends PartialType(CreateLabelTemplateDto) {}

export class LabelTemplateQueryDto {
  @ApiPropertyOptional({ description: '카테고리 필터', enum: ['equip', 'jig', 'worker', 'part', 'mat_lot'] })
  @IsOptional()
  @IsString()
  @IsIn(['equip', 'jig', 'worker', 'part', 'mat_lot'])
  category?: string;

  @ApiPropertyOptional({ description: '검색어 (템플릿명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;
}
