/**
 * @file iqc-template.dto.ts
 * @description IQC 항목 템플릿 DTO
 */
import {
  IsString, IsNumber, IsOptional, IsArray,
  ValidateNested, IsIn, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  useYn?: string;
}

export class CreateIqcTemplateDto {
  @IsString()
  templateName: string;

  @IsNumber()
  @Min(1)
  sampleQty: number;

  @IsIn(['Y', 'N'])
  isDest: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IqcTemplateItemDto)
  items: IqcTemplateItemDto[];
}
