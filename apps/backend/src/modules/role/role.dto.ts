/**
 * @file src/modules/role/role.dto.ts
 * @description 역할 관리 DTO (Data Transfer Object)
 *
 * 초보자 가이드:
 * 1. **CreateRoleDto**: 역할 생성 시 필요한 데이터 (code, name 필수)
 * 2. **UpdateRoleDto**: 역할 수정 시 데이터 (모두 선택)
 * 3. **UpdatePermissionsDto**: 메뉴 권한 일괄 업데이트 (접근 허용할 메뉴 코드 배열)
 * 4. **class-validator**: 데코레이터로 입력값 자동 검증
 */

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 역할 생성 DTO */
export class CreateRoleDto {
  @ApiProperty({ description: '역할 코드 (고유)', example: 'MANAGER' })
  @IsNotEmpty({ message: '역할 코드는 필수입니다.' })
  @IsString()
  code: string;

  @ApiProperty({ description: '역할 이름', example: '관리자' })
  @IsNotEmpty({ message: '역할 이름은 필수입니다.' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '역할 설명', example: '공장 관리자 역할' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '정렬 순서', example: 10 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

/** 역할 수정 DTO */
export class UpdateRoleDto {
  @ApiPropertyOptional({ description: '역할 이름', example: '관리자' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '역할 설명', example: '공장 관리자 역할' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '정렬 순서', example: 10 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

/** 메뉴 권한 일괄 업데이트 DTO */
export class UpdatePermissionsDto {
  @ApiProperty({
    description: '접근 허용할 메뉴 코드 배열',
    example: ['dashboard', 'production', 'quality'],
    type: [String],
  })
  @IsArray({ message: 'menuCodes는 배열이어야 합니다.' })
  @IsString({ each: true, message: '메뉴 코드는 문자열이어야 합니다.' })
  menuCodes: string[];
}
