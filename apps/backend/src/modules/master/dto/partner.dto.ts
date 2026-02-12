/**
 * @file src/modules/master/dto/partner.dto.ts
 * @description 거래처마스터 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { PARTNER_TYPE_VALUES, USE_YN_VALUES } from '@harness/shared';

export class CreatePartnerDto {
  @ApiProperty({ description: '거래처 코드', example: 'SUP-001' })
  @IsString()
  @MaxLength(50)
  partnerCode: string;

  @ApiProperty({ description: '거래처명', example: '대한전선' })
  @IsString()
  @MaxLength(200)
  partnerName: string;

  @ApiProperty({ description: '거래처 유형', enum: PARTNER_TYPE_VALUES })
  @IsString()
  @IsIn([...PARTNER_TYPE_VALUES])
  partnerType: string;

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

  @ApiPropertyOptional({ description: '담당자명' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPerson?: string;

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

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}

export class PartnerQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: PARTNER_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...PARTNER_TYPE_VALUES])
  partnerType?: string;

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
