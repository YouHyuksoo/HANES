import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';
import type { DefectGrade, DefectScope } from '../../../../entities/defect-code-master.entity';

export class CreateDefectCategoryDto {
  @ApiProperty({ description: '분류 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  categoryCode: string;

  @ApiProperty({ description: '분류명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  categoryName: string;

  @ApiProperty({ description: '분류 레벨', enum: [1, 2, 3] })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  levelNo: number;

  @ApiPropertyOptional({ description: '상위 분류 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCategoryCode?: string | null;

  @ApiPropertyOptional({ description: '정렬순서' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '설명', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateDefectCategoryDto extends PartialType(CreateDefectCategoryDto) {}

export class CreateDefectCodeDto {
  @ApiProperty({ description: '불량코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  defectCode: string;

  @ApiProperty({ description: '불량명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  defectName: string;

  @ApiProperty({ description: '3레벨 분류 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  categoryCode: string;

  @ApiProperty({ description: '불량 등급', enum: ['CRITICAL', 'MAJOR', 'MINOR'] })
  @IsString()
  @IsIn(['CRITICAL', 'MAJOR', 'MINOR'])
  defectGrade: DefectGrade;

  @ApiProperty({ description: '적용 범위', enum: ['RAW_MATERIAL', 'PRODUCT', 'PROCESS', 'COMMON'] })
  @IsString()
  @IsIn(['RAW_MATERIAL', 'PRODUCT', 'PROCESS', 'COMMON'])
  defectScope: DefectScope;

  @ApiPropertyOptional({ description: '모델구분별 적용 목록', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  productTypes?: string[];

  @ApiPropertyOptional({ description: '설명', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: '정렬순서' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateDefectCodeDto extends PartialType(CreateDefectCodeDto) {}

export class DefectCodeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '분류 코드' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: '불량 등급', enum: ['CRITICAL', 'MAJOR', 'MINOR'] })
  @IsOptional()
  @IsString()
  @IsIn(['CRITICAL', 'MAJOR', 'MINOR'])
  defectGrade?: DefectGrade;

  @ApiPropertyOptional({ description: '적용 범위', enum: ['RAW_MATERIAL', 'PRODUCT', 'PROCESS', 'COMMON'] })
  @IsOptional()
  @IsString()
  @IsIn(['RAW_MATERIAL', 'PRODUCT', 'PROCESS', 'COMMON'])
  defectScope?: DefectScope;

  @ApiPropertyOptional({ description: '모델구분' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
