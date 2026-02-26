/**
 * @file dto/label-print.dto.ts
 * @description 라벨 인쇄 관련 DTO
 *
 * 초보자 가이드:
 * - GenerateZplDto: ZPL 변수 치환 요청
 * - TcpPrintDto: TCP/IP 프린터 전송 요청
 * - CreatePrintLogDto: 발행 이력 저장
 * - PrintLogQueryDto: 발행 이력 조회
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsArray, IsInt, IsIn, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** ZPL 생성 요청 (변수 치환) */
export class GenerateZplDto {
  @ApiProperty({ description: '템플릿 ID' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: '자재 UID 배열', type: [String] })
  @IsArray()
  @IsString({ each: true })
  matUids: string[];
}

/** TCP/IP 프린터 전송 요청 */
export class TcpPrintDto {
  @ApiProperty({ description: '프린터 IP 주소' })
  @IsString()
  printerIp: string;

  @ApiProperty({ description: '프린터 포트', default: 9100 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: '전송할 ZPL 데이터' })
  @IsString()
  zplData: string;
}

/** 발행 이력 저장 */
export class CreatePrintLogDto {
  @ApiPropertyOptional({ description: '템플릿 ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ description: '카테고리', default: 'mat_lot' })
  @IsString()
  category: string;

  @ApiProperty({ description: '출력 방식', enum: ['BROWSER', 'ZPL_USB', 'ZPL_TCP'] })
  @IsString()
  @IsIn(['BROWSER', 'ZPL_USB', 'ZPL_TCP'])
  printMode: string;

  @ApiPropertyOptional({ description: '프린터명' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  printerName?: string;

  @ApiProperty({ description: '자재 UID 배열', type: [String] })
  @IsArray()
  @IsString({ each: true })
  uidList: string[];

  @ApiProperty({ description: '출력 매수' })
  @IsInt()
  @Min(1)
  labelCount: number;

  @ApiPropertyOptional({ description: '상태', enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' })
  @IsOptional()
  @IsString()
  @IsIn(['SUCCESS', 'FAILED'])
  status?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMsg?: string;
}

/** 발행 이력 조회 */
export class PrintLogQueryDto {
  @ApiPropertyOptional({ description: '카테고리' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '출력 방식' })
  @IsOptional()
  @IsString()
  printMode?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
