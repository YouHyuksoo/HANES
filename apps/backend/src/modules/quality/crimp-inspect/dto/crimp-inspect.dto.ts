/**
 * @file crimp-inspect.dto.ts
 * @description 절압물검사 DTO — 압착 작업지시 1건에 대해 단자(BOM SIDE)별 실측값 + 외관 판정을 등록한다.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { CRIMP_INSPECT_TIMING_VALUES } from '@harness/shared';

export class CrimpSideMeasureDto {
  @ApiProperty({ description: 'BOM 단자 사이드 키 (조회 API의 sideKey)' })
  @IsString()
  @MaxLength(100)
  sideKey: string;

  @ApiPropertyOptional({ description: '도체부 압착고(CH) mm' })
  @IsOptional()
  @IsNumber()
  crimpHeight?: number | null;

  @ApiPropertyOptional({ description: '도체부 압착폭(CW) mm' })
  @IsOptional()
  @IsNumber()
  crimpWidth?: number | null;

  @ApiPropertyOptional({ description: '절연부 압착고 mm' })
  @IsOptional()
  @IsNumber()
  insCrimpHeight?: number | null;

  @ApiPropertyOptional({ description: '인장력 N' })
  @IsOptional()
  @IsNumber()
  pullForce?: number | null;

  @ApiPropertyOptional({ description: '탈피길이 mm' })
  @IsOptional()
  @IsNumber()
  stripLength?: number | null;
}

export class CrimpVisualCheckDto {
  @ApiProperty({ description: '공통코드 CRIMP_VISUAL_CHECK 코드' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ enum: ['OK', 'NG'] })
  @IsIn(['OK', 'NG'])
  result: 'OK' | 'NG';
}

export class CreateCrimpInspectDto {
  @ApiProperty({ description: '압착 작업지시 번호' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ enum: CRIMP_INSPECT_TIMING_VALUES, description: '초물/중물/종물' })
  @IsIn([...CRIMP_INSPECT_TIMING_VALUES])
  timing: string;

  @ApiProperty({ description: '검사자(작업자) 코드' })
  @IsString()
  @MaxLength(36)
  workerId: string;

  @ApiProperty({ type: [CrimpSideMeasureDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CrimpSideMeasureDto)
  sides: CrimpSideMeasureDto[];

  @ApiProperty({ type: [CrimpVisualCheckDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrimpVisualCheckDto)
  visualChecks: CrimpVisualCheckDto[];

  @ApiPropertyOptional({ description: '비고/불량 상세' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  remark?: string;
}
