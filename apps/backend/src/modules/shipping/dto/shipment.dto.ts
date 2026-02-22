/**
 * @file src/modules/shipping/dto/shipment.dto.ts
 * @description 출하 관리 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateShipmentDto**: 출하 생성 시 필요한 필드 정의
 * 2. **UpdateShipmentDto**: 출하 수정 시 필요한 필드 (모두 선택적)
 * 3. **ShipmentQueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 * 4. **LoadPalletsDto**: 출하에 팔레트 적재 시 사용
 *
 * 실제 DB 스키마 (shipment_logs 테이블):
 * - shipNo가 유니크 키
 * - status: PREPARING, LOADED, SHIPPED, DELIVERED, CANCELED
 * - palletCount, boxCount, totalQty는 팔레트 적재 시 자동 계산
 * - erpSyncYn: ERP 연동 여부 ('Y'/'N')
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsIn,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SHIPMENT_STATUS_VALUES, USE_YN_VALUES } from '@harness/shared';

export type ShipmentStatus = typeof SHIPMENT_STATUS_VALUES[number];

/**
 * 출하 생성 DTO
 */
export class CreateShipmentDto {
  @ApiProperty({ description: '출하 번호', example: 'SHP-20250126-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  shipNo: string;

  @ApiPropertyOptional({ description: '출하일 (YYYY-MM-DD)', example: '2025-01-26' })
  @IsOptional()
  @IsDateString()
  shipDate?: string;

  @ApiPropertyOptional({ description: '차량 번호', example: '12가 3456', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleNo?: string;

  @ApiPropertyOptional({ description: '운전자명', example: '홍길동', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  driverName?: string;

  @ApiPropertyOptional({ description: '배송지', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;

  @ApiPropertyOptional({ description: '고객사', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 출하 수정 DTO
 */
export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @ApiPropertyOptional({
    description: '상태',
    enum: [...SHIPMENT_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...SHIPMENT_STATUS_VALUES])
  status?: ShipmentStatus;
}

/**
 * 출하 목록 조회 쿼리 DTO
 */
export class ShipmentQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '출하번호 검색' })
  @IsOptional()
  @IsString()
  shipNo?: string;

  @ApiPropertyOptional({ description: '고객사 검색' })
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: [...SHIPMENT_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...SHIPMENT_STATUS_VALUES])
  status?: ShipmentStatus;

  @ApiPropertyOptional({ description: '출하일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateFrom?: string;

  @ApiPropertyOptional({ description: '출하일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateTo?: string;

  @ApiPropertyOptional({ description: 'ERP 동기화 여부', enum: [...USE_YN_VALUES] })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  erpSyncYn?: string;
}

/**
 * 팔레트 적재 DTO
 */
export class LoadPalletsDto {
  @ApiProperty({ description: '적재할 팔레트 ID 목록', type: [String], example: ['clxxx...', 'clyyy...'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  palletIds: string[];
}

/**
 * 팔레트 하차 DTO
 */
export class UnloadPalletsDto {
  @ApiProperty({ description: '하차할 팔레트 ID 목록', type: [String], example: ['clxxx...', 'clyyy...'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  palletIds: string[];
}

/**
 * 출하 상태 변경 DTO
 */
export class ChangeShipmentStatusDto {
  @ApiProperty({
    description: '변경할 상태',
    enum: [...SHIPMENT_STATUS_VALUES],
    example: 'SHIPPED',
  })
  @IsString()
  @IsIn([...SHIPMENT_STATUS_VALUES])
  status: ShipmentStatus;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * ERP 동기화 플래그 변경 DTO
 */
export class UpdateErpSyncDto {
  @ApiProperty({ description: 'ERP 동기화 여부', enum: [...USE_YN_VALUES], example: 'Y' })
  @IsString()
  @IsIn([...USE_YN_VALUES])
  erpSyncYn: string;
}

/**
 * 일자별 출하 통계 조회 DTO
 */
export class ShipmentStatsQueryDto {
  @ApiProperty({ description: '조회 시작일 (YYYY-MM-DD)', example: '2025-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '조회 종료일 (YYYY-MM-DD)', example: '2025-01-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: '고객사 필터' })
  @IsOptional()
  @IsString()
  customer?: string;
}
