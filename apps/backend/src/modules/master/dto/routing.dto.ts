/**
 * @file src/modules/master/dto/routing.dto.ts
 * @description 공정라우팅(ProcessMap) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateRoutingDto**: 품목별 공정순서 생성
 * 2. **RoutingQueryDto**: partId 기반 필터링 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoutingDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '공정 순서', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '공정 코드', example: 'CUT-01' })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '공정명', example: '절단' })
  @IsString()
  @MaxLength(200)
  processName: string;

  @ApiPropertyOptional({ description: '공정 유형' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processType?: string;

  @ApiPropertyOptional({ description: '설비 타입 그룹' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipType?: string;

  @ApiPropertyOptional({ description: '표준 시간' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stdTime?: number;

  @ApiPropertyOptional({ description: '셋업 시간' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  setupTime?: number;

  @ApiPropertyOptional({ description: '전선길이 (mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  wireLength?: number;

  @ApiPropertyOptional({ description: '탈피길이 (mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stripLength?: number;

  @ApiPropertyOptional({ description: '압착높이 (mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  crimpHeight?: number;

  @ApiPropertyOptional({ description: '압착폭 (mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  crimpWidth?: number;

  @ApiPropertyOptional({ description: '융착조건' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  weldCondition?: string;

  @ApiPropertyOptional({ description: '기타 공정 파라미터 (JSON)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  processParams?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateRoutingDto extends PartialType(CreateRoutingDto) {}

export class RoutingQueryDto {
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
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '품목 ID 필터' })
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
