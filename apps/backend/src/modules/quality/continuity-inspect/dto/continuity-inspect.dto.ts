/**
 * @file src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts
 * @description 통전검사 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. ContinuityInspectDto: 통전검사 결과 등록 시 필요한 필드
 * 2. VoidLabelDto: FG 라벨 취소 시 사유 입력
 * 3. passYn='Y' → FG_BARCODE 자동 채번, 'N' → 불량 기록만
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * 통전검사 결과 등록 DTO
 */
export class ContinuityInspectDto {
  @ApiProperty({ description: '작업지시 번호', example: 'JO-20260316-001' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '품목 코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiProperty({ description: '합격 여부', enum: ['Y', 'N'] })
  @IsString()
  passYn: string;

  @ApiPropertyOptional({ description: '불량 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '불량 상세', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorDetail?: string;
}

/**
 * 장비 자동검사 DTO
 */
export class AutoInspectDto {
  @ApiProperty({ description: '프로토콜 ID (EQUIP_PROTOCOLS.PROTOCOL_ID)', example: 'CONT-01' })
  @IsString()
  @MaxLength(30)
  protocolId: string;

  @ApiProperty({ description: '작업지시번호', example: 'JO-20260316-001' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '품목코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '장비에서 수신한 raw 데이터 (시리얼/TCP에서 받은 문자열)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rawData?: string;

  @ApiPropertyOptional({ description: '이미 파싱된 결과 (JSON HTTP 방식)', enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  result?: string;

  @ApiPropertyOptional({ description: '에러코드 (파싱된 경우)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '설비코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '라인코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;
}

/**
 * FG 라벨 취소 DTO
 */
export class VoidLabelDto {
  @ApiProperty({ description: '취소 사유', example: '라벨 인쇄 오류' })
  @IsString()
  @MaxLength(200)
  reason: string;
}
