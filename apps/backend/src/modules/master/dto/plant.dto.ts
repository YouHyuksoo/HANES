/**
 * @file src/modules/master/dto/plant.dto.ts
 * @description 공장/라인 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export const PLANT_TYPES = ['PLANT', 'SHOP', 'LINE', 'CELL'] as const;
export type PlantType = (typeof PLANT_TYPES)[number];

export class CreatePlantDto {
  @ApiProperty({ description: '공장 코드', example: 'P001' })
  @IsString()
  @MaxLength(50)
  plantCode: string;

  @ApiPropertyOptional({ description: '작업장 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shopCode?: string;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiPropertyOptional({ description: '셀 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cellCode?: string;

  @ApiProperty({ description: '공장/라인명', example: '1공장' })
  @IsString()
  @MaxLength(100)
  plantName: string;

  @ApiPropertyOptional({ description: '타입', enum: PLANT_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(PLANT_TYPES)
  plantType?: string;

  @ApiPropertyOptional({ description: '상위 위치 ID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdatePlantDto extends PartialType(CreatePlantDto) {}

export class PlantQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: PLANT_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(PLANT_TYPES)
  plantType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}
