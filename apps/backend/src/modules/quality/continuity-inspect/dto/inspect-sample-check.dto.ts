/**
 * @file inspect-sample-check.dto.ts
 * @description 양불마스터 대조 DTO — 견본별 검사기 실제결과만 받고 OK/NG는 서버가 산출한다.
 *
 * 초보자 가이드:
 * 1. sampleCode는 견본 바코드 스캔값(LIMIT_SAMPLES.SAMPLE_CODE)이다.
 * 2. actualResult는 작업자가 검사기 화면을 보고 입력한 PASS/FAIL이다.
 * 3. 기대값 비교(양품=PASS, 불량=FAIL)와 종합판정은 서버가 한다. 프론트 판정을 신뢰하지 않는다.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const SAMPLE_CHECK_INSPECT_TYPES = ['CONTINUITY', 'TERMINAL'] as const;
export const SAMPLE_ACTUAL_RESULTS = ['PASS', 'FAIL'] as const;

export class SampleCheckItemDto {
  @ApiProperty({ description: '견본 코드 (LIMIT_SAMPLES.SAMPLE_CODE, 바코드 스캔값)' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  sampleCode: string;

  @ApiProperty({ description: '검사기 실제 결과', enum: SAMPLE_ACTUAL_RESULTS })
  @IsIn([...SAMPLE_ACTUAL_RESULTS])
  actualResult: string;

  @ApiPropertyOptional({ description: '바코드 스캔 시각 (ISO)' })
  @IsOptional() @IsString()
  scannedAt?: string | null;

  @ApiPropertyOptional({ description: '비고 / NG 사유' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}

export class CreateSampleCheckDto {
  @ApiProperty({ description: '작업지시번호' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '검사유형', enum: SAMPLE_CHECK_INSPECT_TYPES })
  @IsIn([...SAMPLE_CHECK_INSPECT_TYPES])
  inspectType: string;

  @ApiProperty({ description: '검사기 설비코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;

  @ApiProperty({ description: '품목코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '견본별 결과', type: [SampleCheckItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SampleCheckItemDto)
  items: SampleCheckItemDto[];

  @ApiPropertyOptional({ description: '대표 작업자 ID (대조 판정자로 기록)' })
  @IsOptional() @IsString() @MaxLength(50)
  workerId?: string | null;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}
