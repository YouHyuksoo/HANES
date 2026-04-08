/**
 * @file dto/sensor-monitor.dto.ts
 * @description 센서 데이터 수신 및 조건 규칙 관리 DTO
 *
 * 초보자 가이드:
 * 1. PostSensorDataDto: 외부 시스템에서 센서 데이터를 일괄 전송할 때 사용
 * 2. CreateConditionRuleDto: 설비별 임계치 규칙 생성
 * 3. SensorDataQueryDto: 센서 데이터 이력 조회 필터
 */
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class SensorDataItemDto {
  @ApiProperty({ description: '설비 코드' })
  @IsString()
  equipCode: string;

  @ApiProperty({ description: '센서 타입 (TEMPERATURE, VIBRATION 등)' })
  @IsString()
  sensorType: string;

  @ApiProperty({ description: '측정값' })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ description: '단위' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: '측정 시각 (ISO 8601)' })
  @IsOptional()
  @IsString()
  measuredAt?: string;
}

export class PostSensorDataDto {
  @ApiProperty({ description: '센서 데이터 항목 배열', type: [SensorDataItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorDataItemDto)
  items: SensorDataItemDto[];
}

export class CreateConditionRuleDto {
  @ApiProperty({ description: '설비 코드' })
  @IsString()
  equipCode: string;

  @ApiProperty({ description: '센서 타입' })
  @IsString()
  sensorType: string;

  @ApiPropertyOptional({ description: '경고 임계값' })
  @IsOptional()
  @IsNumber()
  warningValue?: number;

  @ApiPropertyOptional({ description: '위험 임계값' })
  @IsOptional()
  @IsNumber()
  criticalValue?: number;

  @ApiPropertyOptional({ description: '비교 연산자', enum: ['GT', 'GTE', 'LT', 'LTE'] })
  @IsOptional()
  @IsString()
  @IsIn(['GT', 'GTE', 'LT', 'LTE'])
  compareOp?: string;

  @ApiPropertyOptional({ description: '조치 유형', enum: ['ALERT', 'AUTO_WO', 'INTERLOCK'] })
  @IsOptional()
  @IsString()
  @IsIn(['ALERT', 'AUTO_WO', 'INTERLOCK'])
  actionType?: string;

  @ApiPropertyOptional({ description: 'AUTO_WO 시 PM 계획 코드' })
  @IsOptional()
  @IsString()
  pmPlanCode?: string;
}

export class UpdateConditionRuleDto {
  @ApiPropertyOptional({ description: '경고 임계값' })
  @IsOptional()
  @IsNumber()
  warningValue?: number;

  @ApiPropertyOptional({ description: '위험 임계값' })
  @IsOptional()
  @IsNumber()
  criticalValue?: number;

  @ApiPropertyOptional({ description: '비교 연산자' })
  @IsOptional()
  @IsString()
  compareOp?: string;

  @ApiPropertyOptional({ description: '조치 유형' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional({ description: 'PM 계획 코드' })
  @IsOptional()
  @IsString()
  pmPlanCode?: string;

  @ApiPropertyOptional({ description: '사용 여부' })
  @IsOptional()
  @IsString()
  useYn?: string;
}

export class SensorDataQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '센서 타입' })
  @IsOptional()
  @IsString()
  sensorType?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (ISO 8601)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (ISO 8601)' })
  @IsOptional()
  @IsString()
  to?: string;


}

export class ConditionRuleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '센서 타입' })
  @IsOptional()
  @IsString()
  sensorType?: string;


}
