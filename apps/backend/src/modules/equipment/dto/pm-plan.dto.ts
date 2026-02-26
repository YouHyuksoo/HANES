/**
 * @file src/modules/equipment/dto/pm-plan.dto.ts
 * @description PM(예방보전) 계획 및 Work Order 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreatePmPlanDto**: PM 계획 생성 (items 배열 포함)
 * 2. **CreatePmWorkOrderDto**: WO 수동 생성
 * 3. **ExecutePmWorkOrderDto**: WO 실행 (항목별 결과 포함)
 * 4. **PmCalendarQueryDto**: 캘린더 월별 조회
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

const PM_TYPE = ['TIME_BASED', 'USAGE_BASED'] as const;
const CYCLE_TYPE = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM'] as const;
const ITEM_TYPE = ['CHECK', 'REPLACE', 'CLEAN', 'ADJUST', 'LUBRICATE'] as const;
const WO_TYPE = ['PLANNED', 'EMERGENCY', 'BREAKDOWN'] as const;
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const OVERALL_RESULT = ['PASS', 'FAIL', 'CONDITIONAL'] as const;

/** PM 계획 항목 DTO */
export class PmPlanItemDto {
  @ApiProperty({ description: '순서' })
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '항목명' })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({ description: '항목 유형', enum: ITEM_TYPE, default: 'CHECK' })
  @IsOptional()
  @IsString()
  @IsIn([...ITEM_TYPE])
  itemType?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '판정 기준' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  criteria?: string;

  @ApiPropertyOptional({ description: '예비부품 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sparePartCode?: string;

  @ApiPropertyOptional({ description: '예비부품 수량' })
  @IsOptional()
  @IsNumber()
  sparePartQty?: number;

  @ApiPropertyOptional({ description: '예상 소요 시간(분)' })
  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number;
}

/** PM 계획 생성 DTO */
export class CreatePmPlanDto {
  @ApiProperty({ description: '설비 ID' })
  @IsString()
  equipCode: string;

  @ApiProperty({ description: '계획 코드' })
  @IsString()
  @MaxLength(50)
  planCode: string;

  @ApiProperty({ description: '계획명' })
  @IsString()
  @MaxLength(200)
  planName: string;

  @ApiPropertyOptional({ description: 'PM 유형', enum: PM_TYPE, default: 'TIME_BASED' })
  @IsOptional()
  @IsString()
  @IsIn([...PM_TYPE])
  pmType?: string;

  @ApiPropertyOptional({ description: '주기 유형', enum: CYCLE_TYPE, default: 'MONTHLY' })
  @IsOptional()
  @IsString()
  @IsIn([...CYCLE_TYPE])
  cycleType?: string;

  @ApiPropertyOptional({ description: '주기 값', default: 1 })
  @IsOptional()
  @IsNumber()
  cycleValue?: number;

  @ApiPropertyOptional({ description: '주기 단위 (CUSTOM 시)', default: 'MONTH' })
  @IsOptional()
  @IsString()
  cycleUnit?: string;

  @ApiPropertyOptional({ description: '시즌 월 (ANNUAL 시)' })
  @IsOptional()
  @IsNumber()
  seasonMonth?: number;

  @ApiPropertyOptional({ description: '예상 소요시간(분)' })
  @IsOptional()
  @IsNumber()
  estimatedTime?: number;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: '보전 항목 목록', type: [PmPlanItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmPlanItemDto)
  items?: PmPlanItemDto[];
}

/** PM 계획 수정 DTO */
export class UpdatePmPlanDto extends PartialType(CreatePmPlanDto) {}

/** PM 계획 목록 조회 DTO */
export class PmPlanQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: 'PM 유형', enum: PM_TYPE })
  @IsOptional()
  @IsString()
  @IsIn([...PM_TYPE])
  pmType?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '다음예정일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: '다음예정일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dueDateTo?: string;
}

/** WO 수동 생성 DTO */
export class CreatePmWorkOrderDto {
  @ApiPropertyOptional({ description: 'PM 계획 ID' })
  @IsOptional()
  @IsString()
  pmPlanId?: string;

  @ApiProperty({ description: '설비 ID' })
  @IsString()
  equipCode: string;

  @ApiPropertyOptional({ description: 'WO 유형', enum: WO_TYPE, default: 'PLANNED' })
  @IsOptional()
  @IsString()
  @IsIn([...WO_TYPE])
  woType?: string;

  @ApiProperty({ description: '예정일 (YYYY-MM-DD)' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ description: '우선순위', enum: PRIORITY, default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  @IsIn([...PRIORITY])
  priority?: string;

  @ApiPropertyOptional({ description: '담당자 ID' })
  @IsOptional()
  @IsString()
  assignedWorkerId?: string;
}

/** WO 실행 항목별 결과 DTO */
export class WoItemResultDto {
  @ApiPropertyOptional({ description: '항목 ID (PM Plan Item ID)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  itemId?: number;

  @ApiProperty({ description: '순서' })
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '항목명' })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({ description: '항목 유형', enum: ITEM_TYPE, default: 'CHECK' })
  @IsOptional()
  @IsString()
  @IsIn([...ITEM_TYPE])
  itemType?: string;

  @ApiPropertyOptional({ description: '판정 기준' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  criteria?: string;

  @ApiProperty({ description: '결과 (PASS/FAIL)', enum: ['PASS', 'FAIL'] })
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;
}

/** WO 실행 DTO */
export class ExecutePmWorkOrderDto {
  @ApiPropertyOptional({ description: '담당 작업자 ID' })
  @IsOptional()
  @IsString()
  assignedWorkerId?: string;

  @ApiProperty({ description: '종합 결과', enum: OVERALL_RESULT })
  @IsString()
  @IsIn([...OVERALL_RESULT])
  overallResult: string;

  @ApiProperty({ description: '항목별 실행 결과', type: [WoItemResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WoItemResultDto)
  items: WoItemResultDto[];

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;
}

/** PM 캘린더 월별 조회 DTO */
export class PmCalendarQueryDto {
  @ApiProperty({ description: '년도' })
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiProperty({ description: '월' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: '라인코드 필터' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비유형 필터' })
  @IsOptional()
  @IsString()
  equipType?: string;
}

/** PM 캘린더 일별 조회 DTO */
export class PmDayScheduleQueryDto {
  @ApiProperty({ description: '날짜 (YYYY-MM-DD)' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ description: '라인코드 필터' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비유형 필터' })
  @IsOptional()
  @IsString()
  equipType?: string;
}

/** WO 일괄 생성 DTO */
export class GenerateWorkOrdersDto {
  @ApiProperty({ description: '년도' })
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiProperty({ description: '월' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

/** WO 목록 조회 DTO */
export class PmWorkOrderQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;
}
