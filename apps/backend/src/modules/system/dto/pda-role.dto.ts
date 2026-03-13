/**
 * @file dto/pda-role.dto.ts
 * @description PDA 역할 관리 DTO — 역할 생성/수정 시 메뉴코드 배열을 함께 전달
 *
 * 초보자 가이드:
 * 1. CreatePdaRoleDto: 역할 코드(PK) + 이름 + 메뉴코드 배열
 * 2. UpdatePdaRoleDto: 이름/설명/활성여부/메뉴코드 수정
 * 3. menuCodes: PDA_MAT_RECEIVING 등 pdaMenuConfig의 menuCode 값들
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePdaRoleDto {
  @ApiProperty({ description: 'PDA 역할 코드 (PK)', example: 'PDA_ADMIN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: '역할 이름', example: 'PDA 관리자' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '역할 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '허용 메뉴 코드 배열',
    example: ['PDA_MAT_RECEIVING', 'PDA_SHIPPING'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuCodes?: string[];
}

export class UpdatePdaRoleDto {
  @ApiPropertyOptional({ description: '역할 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '역할 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '활성 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '허용 메뉴 코드 배열 (전체 교체)',
    example: ['PDA_MAT_RECEIVING', 'PDA_SHIPPING'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuCodes?: string[];
}
