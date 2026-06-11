/**
 * @file src/modules/material/dto/iqc-history.dto.ts
 * @description IQC 이력 조회 전용 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsIn, IsNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/** 입하+품목의 PENDING 시리얼 목록 조회 */
export class PendingSerialsQueryDto {
  @ApiProperty({ description: '입하번호' })
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ description: '품목코드' })
  @IsString()
  @IsNotEmpty()
  itemCode: string;
}

export class CreateIqcResultDto {
  @ApiProperty({ description: '자재 UID' })
  @IsString()
  matUid: string;

  @ApiProperty({ description: '검사 결과', enum: ['PASS', 'FAIL'] })
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional({ description: '검사자' })
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '검사유형', enum: ['INITIAL', 'RETEST'], default: 'INITIAL' })
  @IsOptional()
  @IsString()
  @IsIn(['INITIAL', 'RETEST'])
  inspectType?: string;

  @ApiPropertyOptional({ description: '검사항목별 계측값 상세 (JSON)' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: '검사방법', enum: ['FULL', 'SAMPLE', 'SKIP'] })
  @IsOptional()
  @IsString()
  @IsIn(['FULL', 'SAMPLE', 'SKIP', 'NONE'])
  inspectClass?: string;

  @ApiPropertyOptional({ description: '파괴검사 시료 수량' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  destructSampleQty?: number;
}

export class CreateArrivalIqcResultDto {
  @ApiProperty({ description: '입하번호 (ARRIVAL_NO)' })
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ description: '품목코드 (ITEM_CODE)' })
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @ApiProperty({ description: '검사 결과', enum: ['PASS', 'FAIL'] })
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional({ description: '검사자' })
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '검사유형', enum: ['INITIAL', 'RETEST'], default: 'INITIAL' })
  @IsOptional()
  @IsString()
  @IsIn(['INITIAL', 'RETEST'])
  inspectType?: string;

  @ApiPropertyOptional({ description: '검사항목별 계측값 상세 (JSON)' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: '검사방법', enum: ['FULL', 'SAMPLE', 'SKIP'] })
  @IsOptional()
  @IsString()
  @IsIn(['FULL', 'SAMPLE', 'SKIP', 'NONE'])
  inspectClass?: string;

  @ApiPropertyOptional({ description: '샘플 수량 (검사자 수동 입력 시료 개수)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sampleQty?: number;

  @ApiPropertyOptional({ description: '검사 시료 바코드(시리얼). 여러 개는 콤마 구분' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sampleBarcode?: string;
}

export class PendingArrivalQueryDto {
  @ApiPropertyOptional({ description: 'IQC 상태 필터', enum: ['PENDING', 'PASS', 'FAIL'], default: 'PENDING' })
  @IsOptional()
  @IsString()
  iqcStatus?: string;

  @ApiPropertyOptional({ description: '검색어 (입하번호/품목)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CancelIqcResultDto {
  @ApiProperty({ description: '취소 사유' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class IqcHistoryQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['INITIAL', 'RETEST'] })
  @IsOptional()
  @IsString()
  @IsIn(['INITIAL', 'RETEST'])
  inspectType?: string;

  @ApiPropertyOptional({ enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
