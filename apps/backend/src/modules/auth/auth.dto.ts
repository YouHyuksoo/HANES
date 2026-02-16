/**
 * @file src/modules/auth/auth.dto.ts
 * @description 인증 관련 DTO 정의
 */
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '이메일', example: 'admin@harness.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  email: string;

  @ApiProperty({ description: '비밀번호', example: 'admin123' })
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password: string;

  @ApiPropertyOptional({ description: '회사코드', example: 'HANES' })
  @IsOptional()
  @IsString()
  company?: string;
}

export class RegisterDto {
  @ApiProperty({ description: '이메일', example: 'user@harness.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  email: string;

  @ApiProperty({ description: '비밀번호', example: 'password123' })
  @IsString()
  @MinLength(4, { message: '비밀번호는 4자 이상이어야 합니다.' })
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
}
