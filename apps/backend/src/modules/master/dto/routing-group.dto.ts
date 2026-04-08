/**
 * @file src/modules/master/dto/routing-group.dto.ts
 * @description 라우팅 그룹 + 공정순서 + 양품조건 DTO
 *
 * 초보자 가이드:
 * 1. CreateRoutingGroupDto: 라우팅 그룹 생성
 * 2. CreateRoutingProcessDto: 그룹 내 공정순서 생성
 * 3. BulkSaveConditionDto: 양품조건 일괄 저장
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, IsNumber, IsIn,
  IsArray, ValidateNested, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

// ─── 라우팅 그룹 ───

export class CreateRoutingGroupDto {
  @ApiProperty({ description: '라우팅 그룹 코드' })
  @IsString() @MaxLength(50)
  routingCode: string;

  @ApiProperty({ description: '라우팅 그룹명' })
  @IsString() @MaxLength(200)
  routingName: string;

  @ApiPropertyOptional({ description: '연결 품목 코드' })
  @IsOptional() @IsString() @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional() @IsString() @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateRoutingGroupDto extends PartialType(CreateRoutingGroupDto) {}

export class RoutingGroupQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsIn(['Y', 'N'])
  useYn?: string;
}

// ─── 공정순서 ───

export class CreateRoutingProcessDto {
  @ApiProperty({ description: '라우팅 그룹 코드' })
  @IsString()
  routingCode: string;

  @ApiProperty({ description: '공정 순서' })
  @Type(() => Number) @IsInt() @Min(1)
  seq: number;

  @ApiProperty({ description: '공정 코드' })
  @IsString() @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '공정명' })
  @IsString() @MaxLength(200)
  processName: string;

  @ApiPropertyOptional({ description: '공정 유형' })
  @IsOptional() @IsString() @MaxLength(50)
  processType?: string;

  @ApiPropertyOptional({ description: '설비 타입' })
  @IsOptional() @IsString() @MaxLength(50)
  equipType?: string;

  @ApiPropertyOptional({ description: '표준 시간' })
  @IsOptional() @Type(() => Number) @IsNumber()
  stdTime?: number;

  @ApiPropertyOptional({ description: '셋업 시간' })
  @IsOptional() @Type(() => Number) @IsNumber()
  setupTime?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional() @IsString() @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateRoutingProcessDto extends PartialType(CreateRoutingProcessDto) {}

// ─── 양품조건 ───

export class ConditionItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  conditionSeq: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  conditionCode?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  minValue?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  unit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['Y', 'N'])
  equipInterfaceYn?: string;
}

export class BulkSaveConditionDto {
  @ApiProperty({ type: [ConditionItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ConditionItemDto)
  conditions: ConditionItemDto[];
}
