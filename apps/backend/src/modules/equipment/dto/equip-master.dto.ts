/**
 * @file src/modules/equipment/dto/equip-master.dto.ts
 * @description 설비마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateEquipMasterDto**: 설비 등록 시 사용
 * 2. **UpdateEquipMasterDto**: 설비 수정 시 사용
 * 3. **EquipMasterQueryDto**: 설비 목록 조회 필터링
 *
 * 설비 상태 흐름:
 * NORMAL(정상) <-> MAINT(정비중) <-> STOP(가동중지)
 *
 * 통신 방식:
 * - MQTT: IoT 프로토콜 (실시간 데이터)
 * - SERIAL: 직렬 통신
 * - TCP: TCP/IP 소켓 통신
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsJSON,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsIP,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EQUIP_STATUS_VALUES, COMM_TYPE_VALUES, EQUIP_TYPE_VALUES, USE_YN_VALUES } from '@harness/shared';

/**
 * 설비마스터 생성 DTO
 */
export class CreateEquipMasterDto {
  @ApiProperty({ description: '설비 코드', example: 'EQ-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  equipCode: string;

  @ApiProperty({ description: '설비명', example: '자동압착기 1호', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  equipName: string;

  @ApiPropertyOptional({
    description: '설비 유형',
    enum: EQUIP_TYPE_VALUES,
    example: 'AUTO_CRIMP',
  })
  @IsOptional()
  @IsString()
  @IsIn([...EQUIP_TYPE_VALUES])
  equipType?: string;

  @ApiPropertyOptional({ description: '모델명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelName?: string;

  @ApiPropertyOptional({ description: '제조사', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  maker?: string;

  @ApiPropertyOptional({ description: '소속 라인 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiPropertyOptional({ description: 'IP 주소', example: '192.168.1.100' })
  @IsOptional()
  @ValidateIf((o) => o.ipAddress !== null && o.ipAddress !== '')
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({ description: '포트 번호', example: 502, minimum: 1, maximum: 65535 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    description: '통신 방식',
    enum: COMM_TYPE_VALUES,
    example: 'TCP',
  })
  @IsOptional()
  @IsString()
  @IsIn([...COMM_TYPE_VALUES])
  commType?: string;

  @ApiPropertyOptional({
    description: '통신 상세 설정 (JSON)',
    example: '{"baudRate": 9600, "dataBits": 8}',
  })
  @IsOptional()
  commConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: '설치일 (ISO 8601)', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  installDate?: string;

  @ApiPropertyOptional({
    description: '설비 상태',
    enum: EQUIP_STATUS_VALUES,
    default: 'NORMAL',
  })
  @IsOptional()
  @IsString()
  @IsIn([...EQUIP_STATUS_VALUES])
  status?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

/**
 * 설비마스터 수정 DTO
 */
export class UpdateEquipMasterDto extends PartialType(CreateEquipMasterDto) {}

/**
 * 설비 상태 변경 DTO
 */
export class ChangeEquipStatusDto {
  @ApiProperty({
    description: '변경할 상태',
    enum: EQUIP_STATUS_VALUES,
    example: 'MAINT',
  })
  @IsString()
  @IsIn([...EQUIP_STATUS_VALUES])
  status: string;

  @ApiPropertyOptional({ description: '변경 사유', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * 설비마스터 목록 조회 쿼리 DTO
 */
export class EquipMasterQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '설비 유형', enum: EQUIP_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...EQUIP_TYPE_VALUES])
  equipType?: string;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '상태', enum: EQUIP_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...EQUIP_STATUS_VALUES])
  status?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '검색어 (코드, 이름, 모델명)' })
  @IsOptional()
  @IsString()
  search?: string;
}
