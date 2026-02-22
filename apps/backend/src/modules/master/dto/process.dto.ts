/**
 * @file src/modules/master/dto/process.dto.ts
 * @description 공정마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateProcessDto**: 공정 생성 시 필요한 필드
 * 2. **UpdateProcessDto**: 부분 수정 가능 (PartialType)
 * 3. **ProcessQueryDto**: 목록 조회 시 페이징/검색/필터
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProcessDto {
  @ApiProperty({ description: '공정 코드', example: 'CUT-01' })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '공정명', example: '절단' })
  @IsString()
  @MaxLength(200)
  processName: string;

  @ApiProperty({ description: '공정 유형', example: 'CUT' })
  @IsString()
  @MaxLength(50)
  processType: string;

  @ApiPropertyOptional({ description: '공정 대분류 (ASSY, INSP 등)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCategory?: string;

  @ApiPropertyOptional({ description: '샘플검사 필요여부', default: 'N' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  sampleInspectYn?: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateProcessDto extends PartialType(CreateProcessDto) {}

export class ProcessQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
