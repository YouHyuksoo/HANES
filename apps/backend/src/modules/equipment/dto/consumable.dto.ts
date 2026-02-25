/**
 * @file src/modules/equipment/dto/consumable.dto.ts
 * @description 소모품(금형/지그/공구) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **ConsumableMaster**: 금형, 지그, 공구 등 소모품 마스터
 * 2. **ConsumableLog**: 소모품 입출고 및 상태 변경 이력
 *
 * 소모품 상태 흐름:
 * NORMAL(정상) -> WARNING(교체임박) -> REPLACE(교체필요)
 *
 * 로그 유형:
 * - IN: 입고 (신규/반납)
 * - OUT: 출고 (생산 투입)
 * - RETURN: 반납
 * - REPAIR: 수리
 * - SCRAP: 폐기
 *
 * 수명 관리:
 * - expectedLife: 기대 수명 (타수)
 * - currentCount: 현재 사용 횟수
 * - warningCount: 경고 임계치 (이 횟수 초과 시 WARNING)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsDecimal,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CONSUMABLE_CATEGORY_VALUES, CONSUMABLE_STATUS_VALUES, CONSUMABLE_LOG_TYPE_VALUES, USE_YN_VALUES } from '@harness/shared';

/**
 * 소모품마스터 생성 DTO
 */
export class EquipCreateConsumableDto {
  @ApiProperty({ description: '소모품 코드', example: 'MOLD-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  consumableCode: string;

  @ApiProperty({ description: '소모품명', example: '커넥터 금형 A타입', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: '카테고리',
    enum: CONSUMABLE_CATEGORY_VALUES,
    example: 'MOLD',
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_CATEGORY_VALUES])
  category?: string;

  @ApiPropertyOptional({ description: '기대 수명 (타수)', example: 100000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedLife?: number;

  @ApiPropertyOptional({ description: '현재 사용 횟수', default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentCount?: number;

  @ApiPropertyOptional({ description: '경고 임계치', example: 80000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  warningCount?: number;

  @ApiPropertyOptional({ description: '보관 위치', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: '최근 교체일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  lastReplaceAt?: string;

  @ApiPropertyOptional({ description: '다음 교체 예정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  nextReplaceAt?: string;

  @ApiPropertyOptional({ description: '단가', example: 500000.00 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: '공급업체', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor?: string;

  @ApiPropertyOptional({
    description: '상태',
    enum: CONSUMABLE_STATUS_VALUES,
    default: 'NORMAL',
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_STATUS_VALUES])
  status?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

/**
 * 소모품마스터 수정 DTO
 */
export class EquipUpdateConsumableDto extends PartialType(EquipCreateConsumableDto) {}

/**
 * 소모품마스터 목록 조회 쿼리 DTO
 */
export class ConsumableQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '카테고리', enum: CONSUMABLE_CATEGORY_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_CATEGORY_VALUES])
  category?: string;

  @ApiPropertyOptional({ description: '상태', enum: CONSUMABLE_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_STATUS_VALUES])
  status?: string;

  @ApiPropertyOptional({ description: '공급업체' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '검색어 (코드, 이름)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '교체 예정일 이전까지만 조회 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  nextReplaceBefore?: string;
}

/**
 * 소모품 로그 생성 DTO
 */
export class EquipCreateConsumableLogDto {
  @ApiProperty({ description: '소모품 ID', example: 'clx1234567890' })
  @IsString()
  consumableId: string;

  @ApiProperty({
    description: '로그 유형',
    enum: CONSUMABLE_LOG_TYPE_VALUES,
    example: 'OUT',
  })
  @IsString()
  @IsIn([...CONSUMABLE_LOG_TYPE_VALUES])
  logType: string;

  @ApiPropertyOptional({ description: '수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 소모품 사용 횟수 증가 DTO
 */
export class IncreaseCountDto {
  @ApiProperty({ description: '증가 횟수', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count: number;
}

/**
 * 소모품 교체 등록 DTO
 */
export class RegisterReplacementDto {
  @ApiPropertyOptional({ description: '다음 교체 예정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  nextReplaceAt?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 금형 설비 장착 DTO
 */
export class MountToEquipDto {
  @ApiProperty({ description: '설비 ID', example: 'equip-001' })
  @IsString()
  equipCode: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 금형 설비 해제 DTO
 */
export class UnmountFromEquipDto {
  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 금형 수리 전환 DTO
 */
export class SetRepairDto {
  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 소모품 로그 조회 쿼리 DTO
 */
export class ConsumableLogQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '소모품 ID' })
  @IsOptional()
  @IsString()
  consumableId?: string;

  @ApiPropertyOptional({ description: '로그 유형', enum: CONSUMABLE_LOG_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_LOG_TYPE_VALUES])
  logType?: string;

  @ApiPropertyOptional({ description: '시작 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 예방보전 캘린더 조회 쿼리 DTO
 */
export class PmCalendarQueryDto {
  @ApiProperty({ description: '조회 연도', example: 2026 })
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiProperty({ description: '조회 월', example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: '카테고리 필터', enum: CONSUMABLE_CATEGORY_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_CATEGORY_VALUES])
  category?: string;
}

/**
 * 예방보전 캘린더 일별 상세 쿼리 DTO
 */
export class PmDayScheduleQueryDto {
  @ApiProperty({ description: '조회 날짜 (YYYY-MM-DD)', example: '2026-02-23' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ description: '카테고리 필터', enum: CONSUMABLE_CATEGORY_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...CONSUMABLE_CATEGORY_VALUES])
  category?: string;
}
