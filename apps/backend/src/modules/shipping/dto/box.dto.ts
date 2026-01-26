/**
 * @file src/modules/shipping/dto/box.dto.ts
 * @description 박스 관리 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateBoxDto**: 박스 생성 시 필요한 필드 정의
 * 2. **UpdateBoxDto**: 박스 수정 시 필요한 필드 (모두 선택적)
 * 3. **BoxQueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 * 4. **AddSerialToBoxDto**: 박스에 시리얼 추가 시 사용
 *
 * 실제 DB 스키마 (box_masters 테이블):
 * - boxNo가 유니크 키
 * - status: OPEN, CLOSED, SHIPPED
 * - serialList: JSON 배열로 시리얼 번호 목록 저장
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

/**
 * 박스 상태 enum
 */
export const BOX_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  SHIPPED: 'SHIPPED',
} as const;

export type BoxStatus = (typeof BOX_STATUS)[keyof typeof BOX_STATUS];

/**
 * 박스 생성 DTO
 */
export class CreateBoxDto {
  @ApiProperty({ description: '박스 번호 (QR)', example: 'BOX-20250126-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  boxNo: string;

  @ApiProperty({ description: '품목 ID', example: 'clxxx...' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '수량', example: 100, minimum: 0 })
  @IsInt()
  @Min(0)
  qty: number;

  @ApiPropertyOptional({ description: '시리얼 리스트', type: [String], example: ['SN-001', 'SN-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialList?: string[];
}

/**
 * 박스 수정 DTO
 */
export class UpdateBoxDto extends PartialType(CreateBoxDto) {
  @ApiPropertyOptional({ description: '팔레트 ID' })
  @IsOptional()
  @IsString()
  palletId?: string;

  @ApiPropertyOptional({
    description: '상태',
    enum: Object.values(BOX_STATUS),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(BOX_STATUS))
  status?: BoxStatus;
}

/**
 * 박스 목록 조회 쿼리 DTO
 */
export class BoxQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '박스번호 검색' })
  @IsOptional()
  @IsString()
  boxNo?: string;

  @ApiPropertyOptional({ description: '품목 ID 필터' })
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiPropertyOptional({ description: '팔레트 ID 필터' })
  @IsOptional()
  @IsString()
  palletId?: string;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: Object.values(BOX_STATUS),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(BOX_STATUS))
  status?: BoxStatus;

  @ApiPropertyOptional({ description: '팔레트 미할당 박스만', default: false })
  @IsOptional()
  @Type(() => Boolean)
  unassigned?: boolean;
}

/**
 * 박스에 시리얼 추가 DTO
 */
export class AddSerialToBoxDto {
  @ApiProperty({ description: '추가할 시리얼 번호 목록', type: [String], example: ['SN-003', 'SN-004'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  serials: string[];
}

/**
 * 박스 닫기 DTO
 */
export class CloseBoxDto {
  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 박스 팔레트 할당 DTO
 */
export class AssignBoxToPalletDto {
  @ApiProperty({ description: '팔레트 ID', example: 'clxxx...' })
  @IsString()
  palletId: string;
}
