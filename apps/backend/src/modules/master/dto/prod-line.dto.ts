/**
 * @file src/modules/master/dto/prod-line.dto.ts
 * @description 생산라인마스터 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';

export class CreateProdLineDto {
  @ApiProperty({ description: '생산라인 코드', example: 'P2001' })
  @IsString()
  @MaxLength(20)
  lineCode: string;

  @ApiProperty({ description: '생산라인명', example: '압착1생산라인' })
  @IsString()
  @MaxLength(100)
  lineName: string;

  @ApiPropertyOptional({ description: '창고 위치' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whLoc?: string;

  @ApiPropertyOptional({ description: 'ERP 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  erpCode?: string;

  @ApiPropertyOptional({ description: '공정코드' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  oper?: string;

  @ApiPropertyOptional({ description: '라인 유형' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  lineType?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateProdLineDto extends PartialType(CreateProdLineDto) {}

export class ProdLineQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
