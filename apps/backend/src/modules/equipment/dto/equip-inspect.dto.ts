/**
 * @file src/modules/equipment/dto/equip-inspect.dto.ts
 * @description 설비 점검 관련 DTO 정의 (일상점검 + 정기점검 공용)
 *
 * 초보자 가이드:
 * 1. **CreateEquipInspectDto**: 점검 결과 등록 시 사용
 * 2. **UpdateEquipInspectDto**: 점검 결과 수정 시 사용
 * 3. **EquipInspectQueryDto**: 점검 이력 조회 필터링
 *
 * inspectType: DAILY(일상) / PERIODIC(정기)
 * overallResult: PASS / FAIL / CONDITIONAL
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

const INSPECT_TYPE = ['DAILY', 'PERIODIC'] as const;
const OVERALL_RESULT = ['PASS', 'FAIL', 'CONDITIONAL'] as const;

/** 설비 점검 생성 DTO */
export class CreateEquipInspectDto {
  @ApiProperty({ description: '설비 ID' })
  @IsString()
  equipId: string;

  @ApiProperty({ description: '점검 유형', enum: INSPECT_TYPE })
  @IsString()
  @IsIn([...INSPECT_TYPE])
  inspectType: string;

  @ApiProperty({ description: '점검일 (YYYY-MM-DD)' })
  @IsDateString()
  inspectDate: string;

  @ApiPropertyOptional({ description: '점검자명', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  inspectorName?: string;

  @ApiPropertyOptional({ description: '종합 결과', enum: OVERALL_RESULT, default: 'PASS' })
  @IsOptional()
  @IsString()
  @IsIn([...OVERALL_RESULT])
  overallResult?: string;

  @ApiPropertyOptional({ description: '점검 상세 (항목별 결과 JSON)' })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 설비 점검 수정 DTO */
export class UpdateEquipInspectDto extends PartialType(CreateEquipInspectDto) {}

/** 설비 점검 목록 조회 쿼리 DTO */
export class EquipInspectQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 5000;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: '점검 유형', enum: INSPECT_TYPE })
  @IsOptional()
  @IsString()
  @IsIn([...INSPECT_TYPE])
  inspectType?: string;

  @ApiPropertyOptional({ description: '종합 결과', enum: OVERALL_RESULT })
  @IsOptional()
  @IsString()
  @IsIn([...OVERALL_RESULT])
  overallResult?: string;

  @ApiPropertyOptional({ description: '검색어 (설비코드, 점검자명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '점검일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  inspectDateFrom?: string;

  @ApiPropertyOptional({ description: '점검일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  inspectDateTo?: string;
}
