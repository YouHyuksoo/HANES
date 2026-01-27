/**
 * @file src/modules/user/user.dto.ts
 * @description 사용자 관리 DTO
 */
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: '비밀번호' })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiPropertyOptional({ description: '이름' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '사원번호' })
  @IsOptional()
  @IsString()
  empNo?: string;

  @ApiPropertyOptional({ description: '부서' })
  @IsOptional()
  @IsString()
  dept?: string;

  @ApiPropertyOptional({ description: '역할' })
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'])
  role?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '이름' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '비밀번호' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiPropertyOptional({ description: '사원번호' })
  @IsOptional()
  @IsString()
  empNo?: string;

  @ApiPropertyOptional({ description: '부서' })
  @IsOptional()
  @IsString()
  dept?: string;

  @ApiPropertyOptional({ description: '역할' })
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'])
  role?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
