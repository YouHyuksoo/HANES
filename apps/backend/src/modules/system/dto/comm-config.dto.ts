/**
 * @file src/modules/system/dto/comm-config.dto.ts
 * @description 통신설정 CRUD DTO
 *
 * 초보자 가이드:
 * 1. **CreateCommConfigDto**: 통신설정 생성 시 필수/선택 필드 정의
 * 2. **UpdateCommConfigDto**: 수정 시 모든 필드 선택적
 * 3. **CommConfigQueryDto**: 목록 조회 시 페이지네이션+필터
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  COMM_TYPE_VALUES,
  BAUD_RATE_VALUES,
  DATA_BITS_VALUES,
  STOP_BITS_VALUES,
  PARITY_VALUES,
  FLOW_CONTROL_VALUES,
  USE_YN_VALUES,
} from '@harness/shared';

/** 통신설정 생성 DTO */
export class CreateCommConfigDto {
  @ApiProperty({ description: '설정 이름', example: '절단기1호 시리얼' })
  @IsString()
  @IsNotEmpty({ message: '설정 이름은 필수입니다.' })
  configName: string;

  @ApiProperty({ description: '통신 유형', enum: COMM_TYPE_VALUES })
  @IsString()
  @IsIn([...COMM_TYPE_VALUES], { message: '유효한 통신 유형이 아닙니다.' })
  commType: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP/호스트' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ description: '포트 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  port?: number;

  @ApiPropertyOptional({ description: '시리얼 포트명', example: 'COM1' })
  @IsOptional()
  @IsString()
  portName?: string;

  @ApiPropertyOptional({ description: '보드레이트', enum: BAUD_RATE_VALUES })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...BAUD_RATE_VALUES])
  baudRate?: number;

  @ApiPropertyOptional({ description: '데이터 비트', enum: DATA_BITS_VALUES })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...DATA_BITS_VALUES])
  dataBits?: number;

  @ApiPropertyOptional({ description: '스톱 비트', enum: STOP_BITS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...STOP_BITS_VALUES])
  stopBits?: string;

  @ApiPropertyOptional({ description: '패리티', enum: PARITY_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...PARITY_VALUES])
  parity?: string;

  @ApiPropertyOptional({ description: '흐름 제어', enum: FLOW_CONTROL_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...FLOW_CONTROL_VALUES])
  flowControl?: string;

  @ApiPropertyOptional({ description: '라인엔딩', enum: ['NONE', 'CR', 'LF', 'CRLF'] })
  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'CR', 'LF', 'CRLF'])
  lineEnding?: string;

  @ApiPropertyOptional({ description: '프로토콜별 추가 설정 (JSON)' })
  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

/** 통신설정 수정 DTO */
export class UpdateCommConfigDto {
  @ApiPropertyOptional({ description: '설정 이름' })
  @IsOptional()
  @IsString()
  configName?: string;

  @ApiPropertyOptional({ description: '통신 유형', enum: COMM_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...COMM_TYPE_VALUES])
  commType?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP/호스트' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ description: '포트 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  port?: number;

  @ApiPropertyOptional({ description: '시리얼 포트명' })
  @IsOptional()
  @IsString()
  portName?: string;

  @ApiPropertyOptional({ description: '보드레이트' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...BAUD_RATE_VALUES])
  baudRate?: number;

  @ApiPropertyOptional({ description: '데이터 비트' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...DATA_BITS_VALUES])
  dataBits?: number;

  @ApiPropertyOptional({ description: '스톱 비트' })
  @IsOptional()
  @IsString()
  @IsIn([...STOP_BITS_VALUES])
  stopBits?: string;

  @ApiPropertyOptional({ description: '패리티' })
  @IsOptional()
  @IsString()
  @IsIn([...PARITY_VALUES])
  parity?: string;

  @ApiPropertyOptional({ description: '흐름 제어' })
  @IsOptional()
  @IsString()
  @IsIn([...FLOW_CONTROL_VALUES])
  flowControl?: string;

  @ApiPropertyOptional({ description: '라인엔딩' })
  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'CR', 'LF', 'CRLF'])
  lineEnding?: string;

  @ApiPropertyOptional({ description: '프로토콜별 추가 설정 (JSON)' })
  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '사용 여부' })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

/** 통신설정 목록 조회 DTO */
export class CommConfigQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '통신 유형 필터', enum: COMM_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...COMM_TYPE_VALUES])
  commType?: string;

  @ApiPropertyOptional({ description: '검색어 (설정명/설명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '사용 여부 필터' })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
