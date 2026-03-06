/**
 * @file rework.dto.ts
 * @description 재작업 지시 DTO -- 생성, 수정, 조회, 승인, 완료, 재검사 요청
 *
 * 초보자 가이드:
 * 1. **CreateReworkOrderDto**: 재작업 지시 등록 시 사용 (품목, 수량, 방법 등)
 * 2. **UpdateReworkOrderDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **ReworkQueryDto**: 목록 조회 필터/페이지네이션 (상태, 기간, 라인 등)
 * 4. **ApproveReworkDto**: 품질/생산 승인 또는 반려 요청
 * 5. **CompleteReworkDto**: 재작업 완료 시 결과 수량 입력
 * 6. **CreateReworkInspectDto**: 재작업 후 재검사 결과 등록
 *
 * 상태 흐름:
 * REGISTERED -> QC_PENDING -> QC_APPROVED/QC_REJECTED
 * -> PROD_PENDING -> APPROVED/PROD_REJECTED
 * -> IN_PROGRESS -> REWORK_DONE -> INSPECT_PENDING
 * -> PASS / FAIL / SCRAP
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsIn,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 공정 아이템 (재작업 지시 등록 시 선택한 공정)
 */
export class ReworkProcessItemDto {
  @ApiProperty({ description: '공정 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '공정명', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  processName: string;

  @ApiProperty({ description: '공정 순서' })
  @Type(() => Number)
  @IsInt()
  seq: number;

  @ApiPropertyOptional({ description: '작업자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerCode?: string;

  @ApiPropertyOptional({ description: '라인 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;
}

/**
 * 재작업 실적 등록 DTO
 */
export class CreateReworkResultDto {
  @ApiProperty({ description: '재작업 공정 ID' })
  @Type(() => Number)
  @IsNumber()
  reworkProcessId: number;

  @ApiProperty({ description: '작업자 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  workerCode: string;

  @ApiProperty({ description: '작업 수량', minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  resultQty: number;

  @ApiProperty({ description: '양품 수량', minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  goodQty: number;

  @ApiProperty({ description: '불량 수량', minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defectQty: number;

  @ApiProperty({ description: '작업내역 (IATF: 처리 결과 기록)', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  workDetail: string;

  @ApiPropertyOptional({ description: '작업시간 (분)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workTimeMin?: number;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

/**
 * 재작업 지시 생성 DTO
 */
export class CreateReworkOrderDto {
  @ApiPropertyOptional({ description: '연결된 불량로그 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  defectLogId?: number;

  @ApiProperty({ description: '품목 코드', example: 'PART-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '제품 UID (LOT)', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  prdUid?: string;

  @ApiProperty({ description: '재작업 수량', example: 10, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  reworkQty: number;

  @ApiPropertyOptional({ description: '불량 유형 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defectType?: string;

  @ApiProperty({
    description: 'IATF 16949: 승인된 재작업 방법',
    example: '납땜 재처리 후 외관 검사',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reworkMethod: string;

  @ApiPropertyOptional({ description: '작업자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerCode?: string;

  @ApiPropertyOptional({ description: '라인 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @ApiPropertyOptional({ description: '재작업 공정 목록', type: [ReworkProcessItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReworkProcessItemDto)
  processItems?: ReworkProcessItemDto[];
}

/**
 * 재작업 지시 수정 DTO (전체 필드 선택적)
 */
export class UpdateReworkOrderDto extends PartialType(CreateReworkOrderDto) {}

/**
 * 재작업 목록 조회 쿼리 DTO
 */
export class ReworkQueryDto {
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

  @ApiPropertyOptional({ description: '상태 필터', example: 'IN_PROGRESS' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '불량 유형 필터' })
  @IsOptional()
  @IsString()
  defectType?: string;

  @ApiPropertyOptional({ description: '라인 코드 필터' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '검색어 (재작업번호, 품목코드, 품목명)' })
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

/**
 * 품질/생산 승인 또는 반려 DTO
 */
export class ApproveReworkDto {
  @ApiProperty({
    description: '승인/반려 액션',
    enum: ['APPROVE', 'REJECT'],
    example: 'APPROVE',
  })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: '반려 시 사유', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * 재작업 완료 DTO
 */
export class CompleteReworkDto {
  @ApiProperty({ description: '결과 수량', example: 8, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  resultQty: number;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

/**
 * 재작업 후 재검사 결과 등록 DTO
 */
export class CreateReworkInspectDto {
  @ApiProperty({ description: '재작업 지시 ID' })
  @Type(() => Number)
  @IsNumber()
  reworkOrderId: number;

  @ApiProperty({ description: '검사자 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  inspectorCode: string;

  @ApiPropertyOptional({ description: '검사 방법', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspectMethod?: string;

  @ApiProperty({
    description: '검사 결과',
    enum: ['PASS', 'FAIL', 'SCRAP'],
    example: 'PASS',
  })
  @IsIn(['PASS', 'FAIL', 'SCRAP'])
  inspectResult: string;

  @ApiProperty({ description: '합격 수량', example: 8, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passQty: number;

  @ApiProperty({ description: '불합격 수량', example: 2, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  failQty: number;

  @ApiPropertyOptional({ description: '불량 상세 내용', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  defectDetail?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
