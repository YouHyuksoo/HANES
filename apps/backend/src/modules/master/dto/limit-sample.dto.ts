/**
 * @file limit-sample.dto.ts
 * @description 양불마스터 DTO — 목록 필터/생성/수정/사진 메타/만료임박 조회
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export const LIMIT_SAMPLE_TYPES = ['OK', 'NG'] as const;
export const LIMIT_SAMPLE_STATUSES = ['ACTIVE', 'EXPIRED', 'RETIRED'] as const;
/** 양불마스터 대조를 적용할 검사유형 (COM_CODES INSPECT_TYPE 중 검사화면이 쓰는 값) */
export const LIMIT_SAMPLE_INSPECT_TYPES = ['CONTINUITY', 'TERMINAL'] as const;

export class CreateLimitSampleDto {
  @ApiProperty({ description: '견본 코드', example: 'LS-OK-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sampleCode: string;

  @ApiProperty({ description: '견본 유형 (LIMIT_SAMPLE_TYPE)', enum: LIMIT_SAMPLE_TYPES })
  @IsString()
  @IsIn([...LIMIT_SAMPLE_TYPES])
  sampleType: string;

  @ApiProperty({ description: '견본 명칭' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sampleName: string;

  @ApiPropertyOptional({ description: '대상 품목코드 (비우면 공용 견본)' })
  @IsOptional() @IsString() @MaxLength(50)
  itemCode?: string | null;

  @ApiPropertyOptional({ description: '적용 공정코드' })
  @IsOptional() @IsString() @MaxLength(50)
  processCode?: string | null;

  @ApiPropertyOptional({ description: '대표 불량코드 (불량견본 NG 전용)' })
  @IsOptional() @IsString() @MaxLength(50)
  defectCode?: string | null;

  @ApiPropertyOptional({ description: '적용 검사유형 (비우면 전 검사유형 공통)', enum: LIMIT_SAMPLE_INSPECT_TYPES })
  @IsOptional() @IsIn([...LIMIT_SAMPLE_INSPECT_TYPES])
  inspectType?: string | null;

  @ApiPropertyOptional({ description: '보관 위치' })
  @IsOptional() @IsString() @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional({ description: '유효기간 시작일 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional({ description: '유효기간 종료일 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional({ description: '승인자' })
  @IsOptional() @IsString() @MaxLength(50)
  approvedBy?: string | null;

  @ApiPropertyOptional({ description: '승인일시 (ISO)' })
  @IsOptional() @IsDateString()
  approvedAt?: string | null;

  @ApiPropertyOptional({ description: '상태', enum: LIMIT_SAMPLE_STATUSES, default: 'ACTIVE' })
  @IsOptional() @IsIn([...LIMIT_SAMPLE_STATUSES])
  status?: string;

  @ApiPropertyOptional({ description: '검사 전 대조 필수 여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  requiredYn?: string;

  @ApiPropertyOptional({ description: '대조 모달 표시 순서', default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateLimitSampleDto extends PartialType(CreateLimitSampleDto) {}

export class LimitSampleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (코드/명칭/품목/위치)' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '견본 유형', enum: LIMIT_SAMPLE_TYPES })
  @IsOptional() @IsIn([...LIMIT_SAMPLE_TYPES])
  sampleType?: string;

  @ApiPropertyOptional({ description: '상태', enum: LIMIT_SAMPLE_STATUSES })
  @IsOptional() @IsIn([...LIMIT_SAMPLE_STATUSES])
  status?: string;

  @ApiPropertyOptional({ description: '품목코드' })
  @IsOptional() @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '공정코드' })
  @IsOptional() @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '적용 검사유형', enum: LIMIT_SAMPLE_INSPECT_TYPES })
  @IsOptional() @IsIn([...LIMIT_SAMPLE_INSPECT_TYPES])
  inspectType?: string;
}

export class LimitSampleExpiringQueryDto {
  @ApiPropertyOptional({ description: '임박 기준 일수 (기본 30)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  days: number = 30;
}

export class UpdateLimitSampleImageDto {
  @ApiPropertyOptional({ description: '사진 설명' })
  @IsOptional() @IsString() @MaxLength(200)
  caption?: string | null;

  @ApiPropertyOptional({ description: '대표 사진 지정 (Y로 바꾸면 기존 대표는 N으로 내려간다)' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  isPrimary?: string;

  @ApiPropertyOptional({ description: '표시 순서' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}
