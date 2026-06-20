/**
 * @file iqc-part-spec.dto.ts
 * @description 품목별 IQC 기준 DTO
 */
import {
  IsString, IsNumber, IsOptional, IsArray,
  ValidateNested, IsIn, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IqcPartSpecItemDto {
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
  useYn?: string;
}

export class UpsertIqcPartSpecDto {
  @IsString()
  itemCode: string;

  @IsNumber()
  @Min(1)
  sampleQty: number;

  @IsIn(['Y', 'N'])
  isDest: string;

  @IsOptional()
  @IsString()
  useYn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IqcPartSpecItemDto)
  items: IqcPartSpecItemDto[];
}

export class IqcPartSpecQueryDto {
  @IsOptional()
  @IsString()
  itemCode?: string;
}
