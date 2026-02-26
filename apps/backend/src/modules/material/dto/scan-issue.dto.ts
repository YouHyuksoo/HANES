/**
 * @file src/modules/material/dto/scan-issue.dto.ts
 * @description 바코드 스캔 기반 자재 출고 DTO
 *
 * 초보자 가이드:
 * - 현장에서 자재 바코드를 스캔하여 즉시 출고 처리할 때 사용
 * - matUid: 스캔한 자재 UID
 * - issueType: 출고 유형 (PROD=생산출고, SAMPLE=샘플출고 등)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/** 바코드 스캔 출고 DTO */
export class ScanIssueDto {
  @ApiProperty({ description: '스캔한 자재 UID' })
  @IsString()
  matUid: string;

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiProperty({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  issueType: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
