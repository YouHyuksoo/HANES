/**
 * @file carrier.dto.ts
 * @description 대차/트레이/매거진 마스터 DTO — 목록 필터/생성/수정
 */
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export const CARRIER_TYPES = ['CART', 'TRAY', 'MAGAZINE'] as const;

export class CreateCarrierDto {
  @ApiProperty({ description: '대차번호(바코드 값)', example: 'CR-001' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  carrierNo: string;

  @ApiProperty({ description: '운반구 유형 (CARRIER_TYPE)', enum: CARRIER_TYPES })
  @IsString() @IsIn([...CARRIER_TYPES])
  carrierType: string;

  @ApiPropertyOptional({ description: '표시명' })
  @IsOptional() @IsString() @MaxLength(100)
  carrierName?: string | null;

  @ApiPropertyOptional({ description: '최대 적재 수 (비우면 무제한)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}

export class UpdateCarrierDto extends PartialType(OmitType(CreateCarrierDto, ['carrierNo'] as const)) {}

export class CarrierQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (대차번호/표시명)' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '유형 필터', enum: CARRIER_TYPES })
  @IsOptional() @IsIn([...CARRIER_TYPES])
  carrierType?: string;

  @ApiPropertyOptional({ description: '사용여부 필터' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
