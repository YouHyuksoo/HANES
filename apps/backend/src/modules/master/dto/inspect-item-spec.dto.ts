/**
 * @file inspect-item-spec.dto.ts
 * @description 품목별 리크/내전압/토크 스펙 DTO
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

const INSPECT_MEASURE_TYPES = ['LEAK', 'HIPOT', 'TORQUE'] as const;

export class CreateInspectItemSpecDto {
  @ApiProperty({ example: 'WH-001' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  itemCode: string;

  @ApiProperty({ enum: INSPECT_MEASURE_TYPES })
  @IsString() @IsIn([...INSPECT_MEASURE_TYPES])
  inspectType: string;

  @ApiPropertyOptional({ description: '커넥터 구분, 기본 *' })
  @IsOptional() @IsString() @MaxLength(50)
  connectorKey?: string | null;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  chargeBar?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  chargeTolBar?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  measureBar?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  measureTolBar?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  holdSeconds?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  minHoldBar?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  testVoltageKv?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  testSeconds?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  maxCurrentMa?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  torqueLsl?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  torqueUsl?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  torqueUnit?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateInspectItemSpecDto extends PartialType(CreateInspectItemSpecDto) {}

export class InspectItemSpecQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  itemCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...INSPECT_MEASURE_TYPES])
  inspectType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class InspectItemSpecResolveQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  itemCode: string;
  @ApiProperty({ enum: INSPECT_MEASURE_TYPES }) @IsString() @IsIn([...INSPECT_MEASURE_TYPES])
  inspectType: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  connectorKey?: string;
}
