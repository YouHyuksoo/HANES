/**
 * @file dto/warehouse-location.dto.ts
 * @description 창고 로케이션 CRUD DTO
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateWarehouseLocationDto {
  @ApiProperty({ description: '창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: '로케이션 코드' })
  @IsString()
  locationCode: string;

  @ApiProperty({ description: '로케이션명' })
  @IsString()
  locationName: string;

  @ApiPropertyOptional({ description: '존(구역)' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ description: '행' })
  @IsOptional()
  @IsString()
  rowNo?: string;

  @ApiPropertyOptional({ description: '열' })
  @IsOptional()
  @IsString()
  colNo?: string;

  @ApiPropertyOptional({ description: '단(층)' })
  @IsOptional()
  @IsString()
  levelNo?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateWarehouseLocationDto {
  @ApiPropertyOptional({ description: '로케이션명' })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ description: '존(구역)' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ description: '행' })
  @IsOptional()
  @IsString()
  rowNo?: string;

  @ApiPropertyOptional({ description: '열' })
  @IsOptional()
  @IsString()
  colNo?: string;

  @ApiPropertyOptional({ description: '단(층)' })
  @IsOptional()
  @IsString()
  levelNo?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}
