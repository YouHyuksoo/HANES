/**
 * @file measurement.dto.ts
 * @description 계측기 수치 수신 DTO — POST /quality/measurements
 *
 * 초보자 가이드:
 * 1. itemCode/processCode/characteristicName 으로 활성 SPC 관리도를 찾는다.
 * 2. values 를 직접 보내거나, protocolId + rawData 를 보내면 EQUIP_PROTOCOLS 파서가 수치를 뽑는다.
 * 3. 압착고·인장력 게이지 등 모든 계측기 수신의 단일 진입점이다.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReceiveMeasurementDto {
  @ApiProperty({ description: '품목 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '공정 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '관리 특성명 (SPC_CHARTS.CHARACTERISTIC_NAME)', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  characteristicName: string;

  @ApiPropertyOptional({
    description: '측정값 배열 (rawData+protocolId 를 보내면 생략 가능)',
    example: [1.23, 1.25, 1.24],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  values?: number[];

  @ApiPropertyOptional({ description: '계측기/설비 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업지시 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNo?: string;

  @ApiPropertyOptional({ description: '측정일시 (ISO 8601, 생략 시 서버 현재 시각)' })
  @IsOptional()
  @IsDateString()
  sampleDate?: string;

  @ApiPropertyOptional({ description: 'EQUIP_PROTOCOLS.PROTOCOL_ID (rawData 파싱용)', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  protocolId?: string;

  @ApiPropertyOptional({ description: '계측기 원문 데이터 (protocolId 와 함께 사용)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rawData?: string;
}
