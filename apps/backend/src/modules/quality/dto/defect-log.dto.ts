/**
 * @file src/modules/quality/dto/defect-log.dto.ts
 * @description 불량로그 및 수리이력 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **DefectLogDto**: 불량 등록/수정 시 사용
 * 2. **RepairLogDto**: 수리 이력 등록 시 사용
 * 3. **StatusChangeDto**: 불량 상태 변경 시 사용
 *
 * 불량 상태 흐름:
 * WAIT(대기) -> REPAIR(수리중) -> DONE(완료) or SCRAP(폐기)
 * WAIT(대기) -> REWORK(재작업) -> DONE(완료)
 *
 * 실제 DB 스키마:
 * - defect_logs: 불량 발생 정보
 * - repair_logs: 수리/재작업 이력
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
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 불량 상태 enum
 */
export enum DefectStatus {
  WAIT = 'WAIT',       // 대기
  REPAIR = 'REPAIR',   // 수리중
  REWORK = 'REWORK',   // 재작업
  SCRAP = 'SCRAP',     // 폐기
  DONE = 'DONE',       // 완료
}

/**
 * 수리 결과 enum
 */
export enum RepairResult {
  PASS = 'PASS',   // 수리 성공
  FAIL = 'FAIL',   // 수리 실패
  SCRAP = 'SCRAP', // 폐기 처리
}

/**
 * 불량로그 생성 DTO
 */
export class CreateDefectLogDto {
  @ApiProperty({ description: '생산실적 ID', example: 'clx1234567890' })
  @IsString()
  prodResultId: string;

  @ApiProperty({ description: '불량 코드', example: 'DEF001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  defectCode: string;

  @ApiPropertyOptional({ description: '불량명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defectName?: string;

  @ApiPropertyOptional({ description: '불량 수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({
    description: '상태',
    default: 'WAIT',
    enum: DefectStatus,
  })
  @IsOptional()
  @IsEnum(DefectStatus)
  status?: DefectStatus;

  @ApiPropertyOptional({ description: '불량 원인', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cause?: string;

  @ApiPropertyOptional({ description: '발생 시간 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  occurTime?: string;

  @ApiPropertyOptional({ description: '현장 사진 URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}

/**
 * 불량로그 수정 DTO
 */
export class UpdateDefectLogDto extends PartialType(CreateDefectLogDto) {}

/**
 * 불량 상태 변경 DTO
 */
export class ChangeDefectStatusDto {
  @ApiProperty({
    description: '변경할 상태',
    enum: DefectStatus,
    example: 'REPAIR',
  })
  @IsEnum(DefectStatus)
  status: DefectStatus;

  @ApiPropertyOptional({ description: '비고/사유', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 불량로그 목록 조회 쿼리 DTO
 */
export class DefectLogQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '생산실적 ID로 필터링' })
  @IsOptional()
  @IsString()
  prodResultId?: string;

  @ApiPropertyOptional({ description: '불량 코드로 필터링' })
  @IsOptional()
  @IsString()
  defectCode?: string;

  @ApiPropertyOptional({ description: '상태로 필터링', enum: DefectStatus })
  @IsOptional()
  @IsEnum(DefectStatus)
  status?: DefectStatus;

  @ApiPropertyOptional({ description: '발생 시작 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '발생 종료 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '검색어 (불량명, 원인)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 수리이력 생성 DTO
 */
export class CreateRepairLogDto {
  @ApiProperty({ description: '불량로그 ID', example: 'clx1234567890' })
  @IsString()
  defectLogId: string;

  @ApiPropertyOptional({ description: '수리 작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '수리 내용', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  repairAction?: string;

  @ApiPropertyOptional({ description: '사용 자재', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialUsed?: string;

  @ApiPropertyOptional({ description: '수리 소요 시간 (분)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  repairTime?: number;

  @ApiPropertyOptional({
    description: '수리 결과',
    enum: RepairResult,
  })
  @IsOptional()
  @IsEnum(RepairResult)
  result?: RepairResult;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 불량 유형별 통계 응답 DTO
 */
export class DefectTypeStatsDto {
  @ApiProperty({ description: '불량 코드' })
  defectCode: string;

  @ApiProperty({ description: '불량명' })
  defectName: string;

  @ApiProperty({ description: '불량 건수' })
  count: number;

  @ApiProperty({ description: '불량 수량 합계' })
  totalQty: number;

  @ApiProperty({ description: '비율 (%)' })
  percentage: number;
}

/**
 * 불량 상태별 통계 응답 DTO
 */
export class DefectStatusStatsDto {
  @ApiProperty({ description: '상태', enum: DefectStatus })
  status: DefectStatus;

  @ApiProperty({ description: '건수' })
  count: number;

  @ApiProperty({ description: '수량 합계' })
  totalQty: number;
}
