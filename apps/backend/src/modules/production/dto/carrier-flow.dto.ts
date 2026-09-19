/**
 * @file carrier-flow.dto.ts
 * @description 대차 흐름 API DTO — 출력 대차 지정/해제, 현황 목록 필터, 자동투입 조회
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class SelectCarrierDto {
  @ApiProperty({ description: '출력 대차를 지정할 설비코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;
}

export class ReleaseCarrierDto extends SelectCarrierDto {}

export class CarrierAutoInputQueryDto {
  @ApiProperty({ description: '투입할 설비코드 (설비 공정의 CARRIER_AUTO_INPUT_YN 검사)' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;
}

export class CarrierProcessFlagsQueryDto {
  @ApiProperty({ description: '작업지시번호 (라우팅 도출)' })
  @IsString() @IsNotEmpty()
  orderNo: string;

  @ApiProperty({ description: '공정코드' })
  @IsString() @IsNotEmpty()
  processCode: string;
}

export class CarrierListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (대차번호/표시명)' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '도출 상태 필터', enum: ['EMPTY', 'LOADING', 'IN_TRANSIT', 'ACTIVE'] })
  @IsOptional() @IsIn(['EMPTY', 'LOADING', 'IN_TRANSIT', 'ACTIVE'])
  carrierStatus?: string;

  @ApiPropertyOptional({ description: '적재 공정코드 필터' })
  @IsOptional() @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: '바코드로 대차 찾기 (SG/FG/LOT 바코드)' })
  @IsOptional() @IsString()
  barcode?: string;
}
