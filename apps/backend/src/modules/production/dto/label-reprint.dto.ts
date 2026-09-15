/**
 * @file production/dto/label-reprint.dto.ts
 * @description 반제품(SG)·완제품(FG) 라벨 재발행 요청 규격
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReprintLabelsDto {
  @ApiProperty({ description: '라벨 유형', enum: ['SG', 'FG'], example: 'SG' })
  @IsIn(['SG', 'FG'])
  labelType: 'SG' | 'FG';

  @ApiProperty({ description: '재발행할 라벨 바코드 목록', example: ['SG26091500001'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  barcodes: string[];

  @ApiPropertyOptional({ description: '재발행 작업자', example: 'MAG_WK01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;
}
