import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';

export class AqlRuleDto {
  @ApiProperty({ description: 'LOT 수량 From' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lotQtyFrom: number;

  @ApiProperty({ description: 'LOT 수량 To' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lotQtyTo: number;

  @ApiProperty({ description: '시료수' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sampleSize: number;

  @ApiProperty({ description: '합격 허용수(Ac)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptQty: number;

  @ApiProperty({ description: '불합격 판정수(Re)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectQty: number;

  @ApiPropertyOptional({ description: '정렬순서' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

export class CreateAqlDto {
  @ApiProperty({ description: 'AQL 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  aqlCode: string;

  @ApiProperty({ description: 'AQL 명칭', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  aqlName: string;

  @ApiPropertyOptional({ description: '검사수준', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  inspectionLevel?: string;

  @ApiPropertyOptional({ description: 'AQL 값' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  aqlValue?: number;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: 'LOT 수량별 sampling rule', type: [AqlRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AqlRuleDto)
  rules?: AqlRuleDto[];
}

export class UpdateAqlDto extends PartialType(CreateAqlDto) {}

export class CreateIqcAqlPolicyDto {
  @ApiProperty({ description: 'IQC AQL 정책 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  policyCode: string;

  @ApiProperty({ description: 'IQC AQL 정책명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  policyName: string;

  @ApiPropertyOptional({ description: '검사수준', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  inspectionLevel?: string;

  @ApiPropertyOptional({ description: 'Major AQL 기준 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  majorAqlCode?: string;

  @ApiPropertyOptional({ description: 'Minor AQL 기준 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  minorAqlCode?: string;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateIqcAqlPolicyDto extends PartialType(CreateIqcAqlPolicyDto) {}

export class AqlQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '사용여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
