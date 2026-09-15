/**
 * @file inspect-aid.dto.ts
 * @description 검사보조구 마스터 DTO — 목록 필터/생성/수정/만료임박 조회
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export const INSPECT_AID_TYPES = ['LIMIT_OK', 'LIMIT_NG', 'HOLDER'] as const;
export const INSPECT_AID_STATUSES = ['ACTIVE', 'EXPIRED', 'RETIRED'] as const;
/** 양불마스터 대조를 적용할 검사유형 (COM_CODES INSPECT_TYPE 중 검사화면이 쓰는 값) */
export const INSPECT_AID_INSPECT_TYPES = ['CONTINUITY', 'TERMINAL'] as const;

export class CreateInspectAidDto {
  @ApiProperty({ description: '보조구 코드', example: 'LS-OK-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  aidCode: string;

  @ApiProperty({ description: '보조구 유형 (INSPECT_AID_TYPE)', enum: INSPECT_AID_TYPES })
  @IsString()
  @IsIn([...INSPECT_AID_TYPES])
  aidType: string;

  @ApiProperty({ description: '보조구 명칭' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  aidName: string;

  @ApiPropertyOptional({ description: '대상 품목코드' })
  @IsOptional() @IsString() @MaxLength(50)
  itemCode?: string | null;

  @ApiPropertyOptional({ description: '적용 공정코드' })
  @IsOptional() @IsString() @MaxLength(50)
  processCode?: string | null;

  @ApiPropertyOptional({ description: '대표 불량코드 (불량 한도견본)' })
  @IsOptional() @IsString() @MaxLength(50)
  defectCode?: string | null;

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

  @ApiPropertyOptional({ description: '상태', enum: INSPECT_AID_STATUSES, default: 'ACTIVE' })
  @IsOptional() @IsIn([...INSPECT_AID_STATUSES])
  status?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '적용 검사유형 (비우면 전 검사유형 공통)', enum: INSPECT_AID_INSPECT_TYPES })
  @IsOptional() @IsIn([...INSPECT_AID_INSPECT_TYPES])
  inspectType?: string | null;

  @ApiPropertyOptional({ description: '검사 전 대조 필수 여부 (HOLDER는 항상 N)', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  requiredYn?: string;

  @ApiPropertyOptional({ description: '대조 모달 표시 순서', default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdateInspectAidDto extends PartialType(CreateInspectAidDto) {}

export class InspectAidQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (코드/명칭/품목/위치)' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '보조구 유형', enum: INSPECT_AID_TYPES })
  @IsOptional() @IsIn([...INSPECT_AID_TYPES])
  aidType?: string;

  @ApiPropertyOptional({ description: '상태', enum: INSPECT_AID_STATUSES })
  @IsOptional() @IsIn([...INSPECT_AID_STATUSES])
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

  @ApiPropertyOptional({ description: '적용 검사유형', enum: INSPECT_AID_INSPECT_TYPES })
  @IsOptional() @IsIn([...INSPECT_AID_INSPECT_TYPES])
  inspectType?: string;
}

export class InspectAidExpiringQueryDto {
  @ApiPropertyOptional({ description: '임박 기준 일수 (기본 30)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  days: number = 30;
}
