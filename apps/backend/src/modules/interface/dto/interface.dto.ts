/**
 * @file src/modules/interface/dto/interface.dto.ts
 * @description ERP 인터페이스 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// 인터페이스 로그 Query DTOs
// ============================================================================

export class InterLogQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '방향 필터', enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional({ description: '메시지 유형' })
  @IsOptional()
  @IsString()
  messageType?: string;

  @ApiPropertyOptional({ description: '상태', enum: ['PENDING', 'SUCCESS', 'FAIL', 'RETRY'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ============================================================================
// 인터페이스 전송 DTOs
// ============================================================================

export class CreateInterLogDto {
  @ApiProperty({ description: '방향', enum: ['IN', 'OUT'] })
  @IsString()
  direction: string;

  @ApiProperty({ description: '메시지 유형', example: 'JOB_ORDER' })
  @IsString()
  messageType: string;

  @ApiPropertyOptional({ description: '인터페이스 ID (ERP 참조 키)' })
  @IsOptional()
  @IsString()
  interfaceId?: string;

  @ApiPropertyOptional({ description: '전문 내용 (JSON)' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}

export class RetryInterLogDto {
  @ApiProperty({ description: '로그 ID' })
  @IsString()
  logId: string;
}

export class BulkRetryDto {
  @ApiProperty({ description: '로그 ID 목록' })
  @IsString({ each: true })
  logIds: string[];
}

// ============================================================================
// 작업지시 수신 DTO (Inbound)
// ============================================================================

export class JobOrderInboundDto {
  @ApiProperty({ description: 'ERP 작업지시 번호' })
  @IsString()
  erpOrderNo: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  partCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  partName?: string;

  @ApiProperty({ description: '계획 수량' })
  @IsInt()
  @Min(1)
  planQty: number;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '계획일' })
  @IsOptional()
  @IsDateString()
  planDate?: string;

  @ApiPropertyOptional({ description: '우선순위', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;
}

// ============================================================================
// BOM 동기화 DTO (Inbound)
// ============================================================================

export class BomSyncDto {
  @ApiProperty({ description: '상위 품목 코드' })
  @IsString()
  parentPartCode: string;

  @ApiProperty({ description: '하위 품목 코드' })
  @IsString()
  childPartCode: string;

  @ApiProperty({ description: '소요량' })
  @Type(() => Number)
  qtyPer: number;

  @ApiPropertyOptional({ description: '리비전', default: 'A' })
  @IsOptional()
  @IsString()
  revision?: string;

  @ApiPropertyOptional({ description: 'ECO 번호' })
  @IsOptional()
  @IsString()
  ecoNo?: string;
}

// ============================================================================
// 품목 마스터 동기화 DTO (Inbound)
// ============================================================================

export class PartSyncDto {
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  partCode: string;

  @ApiProperty({ description: '품목명' })
  @IsString()
  partName: string;

  @ApiProperty({ description: '품목 유형', enum: ['RAW', 'WIP', 'FG'] })
  @IsString()
  partType: string;

  @ApiPropertyOptional({ description: '규격' })
  @IsOptional()
  @IsString()
  spec?: string;

  @ApiPropertyOptional({ description: '단위', default: 'EA' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: '도면 번호' })
  @IsOptional()
  @IsString()
  drawNo?: string;

  @ApiPropertyOptional({ description: '고객사' })
  @IsOptional()
  @IsString()
  customer?: string;
}

// ============================================================================
// 생산실적 전송 DTO (Outbound)
// ============================================================================

export class ProdResultOutboundDto {
  @ApiProperty({ description: '작업지시 번호' })
  @IsString()
  orderNo: string;

  @ApiProperty({ description: '양품 수량' })
  @IsInt()
  @Min(0)
  goodQty: number;

  @ApiPropertyOptional({ description: '불량 수량' })
  @IsOptional()
  @IsInt()
  @Min(0)
  defectQty?: number;

  @ApiPropertyOptional({ description: '완료 시간' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
