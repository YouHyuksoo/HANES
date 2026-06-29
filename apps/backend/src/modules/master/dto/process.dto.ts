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
import { IsString, IsOptional, IsNotEmpty, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

import { USE_YN_VALUES } from '@harness/shared';
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

  @ApiProperty({ description: '공정 대분류 (ASSY, INSP 등)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  processCategory: string;

  @ApiProperty({ description: '라인구분: LV=저전압 HV=고전압 CM=공통' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['LV', 'HV', 'CM'])
  lineType: string;

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
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateProcessDto extends PartialType(CreateProcessDto) {}

export class ProcessQueryDto extends PaginationQueryDto {


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
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
