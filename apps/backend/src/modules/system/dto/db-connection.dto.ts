/**
 * @file dto/db-connection.dto.ts
 * @description DB 접속 설정 DTO
 *
 * 비밀번호는 응답에 포함하지 않는다. 요청에서 생략하면 저장된 값을 유지한다.
 */
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DbConnectionInputDto {
  @ApiProperty({ description: 'Oracle 호스트', example: '10.1.10.35' })
  @IsString()
  @MinLength(1)
  host: string;

  @ApiProperty({ description: 'Oracle 포트', example: 1521 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: '접속 계정' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiPropertyOptional({ description: '비밀번호 (생략 시 기존 값 유지)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'SID (지정 시 SERVICE_NAME 대신 사용)' })
  @IsOptional()
  @IsString()
  sid?: string;

  @ApiPropertyOptional({ description: '서비스명 (SID 미지정 시 사용)' })
  @IsOptional()
  @IsString()
  serviceName?: string;
}
