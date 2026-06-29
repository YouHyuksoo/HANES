/**
 * @file iqc-template.dto.ts
 * @description IQC 항목 템플릿 DTO
 */
import {
  IsString, IsNumber, IsOptional, IsArray,
  ValidateNested, IsIn, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { USE_YN_VALUES } from '@harness/shared';
export class IqcTemplateItemDto {
  @IsNumber()
  seq: number;

  @IsString()
  inspItemCode: string;

  @IsOptional()
  @IsNumber()
  lsl?: number | null;

  @IsOptional()
  @IsNumber()
  usl?: number | null;

  @IsOptional()
  @IsString()
  judgeCriteria?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['CRITICAL', 'MAJOR', 'MINOR'])
  defectGrade?: string | null;

  @IsOptional()
  @IsString()
  inspectionLevel?: string | null;

  @IsOptional()
  @IsNumber()
  aql?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(['AQL', 'DESTRUCTIVE', 'FULL'])
  inspectionType?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['AQL', 'FIXED'])
  sampleMethod?: string | null;

  @IsOptional()
  @IsNumber()
  sampleQty?: number | null;

  @IsOptional()
  @IsString()
  useYn?: string;
}

export class CreateIqcTemplateDto {
  @IsString()
  templateName: string;

  @IsNumber()
  @Min(1)
  sampleQty: number;

  @IsIn([...USE_YN_VALUES])
  isDest: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IqcTemplateItemDto)
  items: IqcTemplateItemDto[];
}
