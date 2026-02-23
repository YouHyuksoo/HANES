/**
 * @file src/modules/master/dto/bom.dto.ts
 * @description BOM 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBomDto {
  @ApiProperty({ description: '상위 품목 ID' })
  @IsString()
  parentPartId: string;

  @ApiProperty({ description: '하위 품목 ID' })
  @IsString()
  childPartId: string;

  @ApiProperty({ description: '단위 소요량', example: 1.5 })
  @IsNumber()
  @Min(0)
  qtyPer: number;

  @ApiPropertyOptional({ description: 'BOM 순서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seq?: number;

  @ApiPropertyOptional({ description: 'BOM 리비전', default: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  revision?: string;

  @ApiPropertyOptional({ description: 'BOM 그룹코드 (Oracle BOMGRP)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bomGrp?: string;

  @ApiPropertyOptional({ description: '공정코드 (Oracle OPER)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  processCode?: string;

  @ApiPropertyOptional({ description: '사이드 (N/L/R)' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  side?: string;

  @ApiPropertyOptional({ description: 'ECO 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ecoNo?: string;

  @ApiPropertyOptional({ description: '유효 시작일' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: '유효 종료일' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  useYn?: string;
}

export class UpdateBomDto extends PartialType(CreateBomDto) {}

export class BomQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '상위 품목 ID' })
  @IsOptional()
  @IsString()
  parentPartId?: string;

  @ApiPropertyOptional({ description: '하위 품목 ID' })
  @IsOptional()
  @IsString()
  childPartId?: string;

  @ApiPropertyOptional({ description: '리비전' })
  @IsOptional()
  @IsString()
  revision?: string;
}
