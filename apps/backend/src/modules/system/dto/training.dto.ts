/**
 * @file training.dto.ts
 * @description 교육훈련 DTO — 계획 생성/수정, 결과 등록, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateTrainingPlanDto**: 교육 계획 등록 (제목, 유형, 강사, 일정 등)
 * 2. **UpdateTrainingPlanDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **CreateTrainingResultDto**: 교육 결과 등록 (작업자, 점수, 합격 여부)
 * 4. **TrainingQueryDto**: 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 교육 계획 등록 DTO
 */
export class CreateTrainingPlanDto {
  @ApiProperty({ description: '교육 제목', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: '교육 유형', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  trainingType: string;

  @ApiPropertyOptional({ description: '대상 역할', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetRole?: string;

  @ApiPropertyOptional({ description: '강사', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  instructor?: string;

  @ApiPropertyOptional({ description: '예정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: '교육 시간 (시간 단위)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: '최대 참가인원' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: '교육 내용', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

/**
 * 교육 계획 수정 DTO (전체 필드 선택적)
 */
export class UpdateTrainingPlanDto extends PartialType(CreateTrainingPlanDto) {}

/**
 * 교육 결과 등록 DTO
 */
export class CreateTrainingResultDto {
  @ApiProperty({ description: '작업자 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  workerCode: string;

  @ApiProperty({ description: '작업자 이름', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  workerName: string;

  @ApiPropertyOptional({ description: '참석일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  attendDate?: string;

  @ApiPropertyOptional({ description: '점수 (0~100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({ description: '합격 여부 (0=불합격, 1=합격)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  passed?: number;

  @ApiPropertyOptional({ description: '자격증 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificateNo?: string;

  @ApiPropertyOptional({ description: '유효기간 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * 교육 계획 목록 조회 쿼리 DTO
 */
export class TrainingQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
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
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '교육 유형 필터' })
  @IsOptional()
  @IsString()
  trainingType?: string;

  @ApiPropertyOptional({ description: '검색어 (계획번호, 제목)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
