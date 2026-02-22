/**
 * @file src/common/dto/base-query.dto.ts
 * @description 공통 Query DTO 베이스 클래스
 *
 * 사용법:
 * 1. PaginationQueryDto - 페이지네이션이 필요한 목록 조회
 * 2. DateRangeQueryDto - 기간 조회가 필요한 경우
 * 3. SearchQueryDto - 검색 기능이 필요한 경우
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * 페이지네이션 공통 DTO
 * @example
 * class UserQueryDto extends PaginationQueryDto {
 *   @IsOptional()
 *   @IsString()
 *   department?: string;
 * }
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '페이지 당 항목 수', default: 5000, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit: number = 5000;
}

/**
 * 기간 조회 공통 DTO
 * @example
 * class OrderQueryDto extends PaginationQueryDto {
 *   @IsOptional()
 *   @IsDateString()
 *   fromDate?: string;
 *
 *   @IsOptional()
   @IsDateString()
 *   toDate?: string;
 * }
 */
export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: '조회 시작일 (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/**
 * 검색 공통 DTO
 */
export class SearchQueryDto {
  @ApiPropertyOptional({ description: '검색어', example: '검색어' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/**
 * 상태 필터 공통 DTO
 */
export class StatusQueryDto {
  @ApiPropertyOptional({ description: '상태 필터', example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * 작업자/감사 공통 DTO
 */
export class AuditQueryDto {
  @ApiPropertyOptional({ description: '작업자 ID', example: 'USER001' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', example: '특이사항' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 표준 목록 조회 DTO (페이지네이션 + 검색 + 기간)
 * @description 대부분의 목록 조회에서 사용할 수 있는 조합 DTO
 * @example
 * class ProductQueryDto extends BaseListQueryDto {
 *   // 추가 필드만 정의
 *   @IsOptional()
 *   @IsString()
 *   category?: string;
 * }
 */
export class BaseListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어', example: '검색어' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
