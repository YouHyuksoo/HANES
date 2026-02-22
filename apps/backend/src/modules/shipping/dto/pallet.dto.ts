/**
 * @file src/modules/shipping/dto/pallet.dto.ts
 * @description 팔레트 관리 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreatePalletDto**: 팔레트 생성 시 필요한 필드 정의
 * 2. **PalletQueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 * 3. **AddBoxToPalletDto**: 팔레트에 박스 추가 시 사용
 *
 * 실제 DB 스키마 (pallet_masters 테이블):
 * - palletNo가 유니크 키
 * - status: OPEN, CLOSED, LOADED, SHIPPED
 * - boxCount, totalQty는 박스 추가/제거 시 자동 계산
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsIn,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PALLET_STATUS_VALUES } from '@harness/shared';

export type PalletStatus = typeof PALLET_STATUS_VALUES[number];

/**
 * 팔레트 생성 DTO
 */
export class CreatePalletDto {
  @ApiProperty({ description: '팔레트 번호 (QR)', example: 'PLT-20250126-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  palletNo: string;
}

/**
 * 팔레트 수정 DTO
 */
export class UpdatePalletDto {
  @ApiPropertyOptional({ description: '출하 ID' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({
    description: '상태',
    enum: [...PALLET_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...PALLET_STATUS_VALUES])
  status?: PalletStatus;
}

/**
 * 팔레트 목록 조회 쿼리 DTO
 */
export class PalletQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 5000, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 5000;

  @ApiPropertyOptional({ description: '팔레트번호 검색' })
  @IsOptional()
  @IsString()
  palletNo?: string;

  @ApiPropertyOptional({ description: '출하 ID 필터' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: [...PALLET_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...PALLET_STATUS_VALUES])
  status?: PalletStatus;

  @ApiPropertyOptional({ description: '출하 미할당 팔레트만', default: false })
  @IsOptional()
  @Type(() => Boolean)
  unassigned?: boolean;
}

/**
 * 팔레트에 박스 추가 DTO
 */
export class AddBoxToPalletDto {
  @ApiProperty({ description: '추가할 박스 ID 목록', type: [String], example: ['clxxx...', 'clyyy...'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  boxIds: string[];
}

/**
 * 팔레트에서 박스 제거 DTO
 */
export class RemoveBoxFromPalletDto {
  @ApiProperty({ description: '제거할 박스 ID 목록', type: [String], example: ['clxxx...', 'clyyy...'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  boxIds: string[];
}

/**
 * 팔레트 닫기 DTO
 */
export class ClosePalletDto {
  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 팔레트 출하 할당 DTO
 */
export class AssignPalletToShipmentDto {
  @ApiProperty({ description: '출하 ID', example: 'clxxx...' })
  @IsString()
  shipmentId: string;
}
