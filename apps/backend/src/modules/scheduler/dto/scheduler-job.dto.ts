/**
 * @file src/modules/scheduler/dto/scheduler-job.dto.ts
 * @description 스케줄러 작업(Job) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateSchedulerJobDto**: 작업 생성 시 필수/선택 필드 정의
 * 2. **UpdateSchedulerJobDto**: 작업 수정 (모든 필드 optional)
 * 3. **SchedulerJobFilterDto**: 작업 목록 조회 필터 (페이지네이션, 그룹, 유형, 활성여부, 검색)
 * 4. **execType**: SERVICE/PROCEDURE/SQL/HTTP/SCRIPT 5가지 실행 유형
 * 5. **jobCode**: 대문자 영문+숫자+밑줄만 허용 (예: SYNC_BOM_01)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseListQueryDto } from '@common/dto/base-query.dto';

/** 허용되는 실행 유형 */
const EXEC_TYPES = ['SERVICE', 'PROCEDURE', 'SQL', 'HTTP', 'SCRIPT'] as const;

export class CreateSchedulerJobDto {
  @ApiProperty({ description: '작업코드 (A-Z, 0-9, _ 만 허용)', example: 'SYNC_BOM_01' })
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, { message: 'jobCode는 대문자 영문, 숫자, 밑줄만 허용됩니다.' })
  jobCode: string;

  @ApiProperty({ description: '작업명', example: 'BOM 동기화' })
  @IsString()
  @MaxLength(100)
  jobName: string;

  @ApiProperty({ description: '작업 그룹 (ComCode SCHED_GROUP)', example: 'INTERFACE' })
  @IsString()
  @MaxLength(20)
  jobGroup: string;

  @ApiProperty({
    description: '실행 유형',
    enum: EXEC_TYPES,
    example: 'SERVICE',
  })
  @IsString()
  @IsIn(EXEC_TYPES, { message: `execType은 ${EXEC_TYPES.join(', ')} 중 하나여야 합니다.` })
  execType: string;

  @ApiProperty({ description: '실행 대상 (서비스메서드/SQL/URL 등)', example: 'InterfaceService.scheduledSyncBom' })
  @IsString()
  @MaxLength(500)
  execTarget: string;

  @ApiPropertyOptional({ description: '실행 파라미터 (JSON 문자열)', example: '{"batchSize": 100}' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  execParams?: string;

  @ApiProperty({ description: 'Cron 표현식', example: '0 */10 * * * *' })
  @IsString()
  @MaxLength(50)
  cronExpr: string;

  @ApiPropertyOptional({ description: '최대 재시도 횟수', example: 3, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetry?: number;

  @ApiPropertyOptional({ description: '실행 제한 시간(초)', example: 300, default: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  timeoutSec?: number;

  @ApiPropertyOptional({ description: '작업 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSchedulerJobDto extends PartialType(CreateSchedulerJobDto) {}

/**
 * 스케줄러 작업 목록 조회 필터 DTO
 * - BaseListQueryDto에서 page, limit, search, status, fromDate, toDate 상속
 */
export class SchedulerJobFilterDto extends BaseListQueryDto {
  @ApiPropertyOptional({ description: '작업 그룹 필터' })
  @IsOptional()
  @IsString()
  jobGroup?: string;

  @ApiPropertyOptional({ description: '실행 유형 필터', enum: EXEC_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(EXEC_TYPES)
  execType?: string;

  @ApiPropertyOptional({ description: '활성 여부 (Y/N)' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;
}
