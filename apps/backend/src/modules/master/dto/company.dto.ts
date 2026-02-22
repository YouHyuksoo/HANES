/**
 * @file src/modules/master/dto/company.dto.ts
 * @description 회사마스터 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';

export class CreateCompanyDto {
  @ApiProperty({ description: '회사 코드', example: 'COMP-001' })
  @IsString()
  @MaxLength(50)
  companyCode: string;

  @ApiProperty({ description: '회사명', example: 'HANES Vietnam' })
  @IsString()
  @MaxLength(200)
  companyName: string;

  @ApiPropertyOptional({ description: '사업자번호', example: '123-45-67890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bizNo?: string;

  @ApiPropertyOptional({ description: '대표자명' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ceoName?: string;

  @ApiPropertyOptional({ description: '주소' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: '전화번호' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tel?: string;

  @ApiPropertyOptional({ description: '팩스번호' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  fax?: string;

  @ApiPropertyOptional({ description: '이메일' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class CompanyQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
