/**
 * @file modules/system/dto/activity-log.dto.ts
 * @description 활동 로그 DTO - 생성/조회 요청 규격
 *
 * 초보자 가이드:
 * 1. **CreateActivityLogDto**: 프론트엔드에서 페이지 접속 로그 전송 시 사용
 * 2. **ActivityLogQueryDto**: 관리 화면에서 활동 로그 조회 시 필터/페이지네이션
 */
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateActivityLogDto {
  @ApiProperty({ description: '활동 유형', example: 'PAGE_ACCESS' })
  @IsString()
  @IsIn(['LOGIN', 'PAGE_ACCESS'])
  activityType: string;

  @ApiPropertyOptional({ description: '페이지 경로', example: '/dashboard' })
  @IsOptional()
  @IsString()
  pagePath?: string;

  @ApiPropertyOptional({ description: '페이지 이름', example: 'Dashboard' })
  @IsOptional()
  @IsString()
  pageName?: string;

  @ApiPropertyOptional({ description: '디바이스 유형', example: 'PC' })
  @IsOptional()
  @IsString()
  @IsIn(['PC', 'PDA'])
  deviceType?: string;
}

export class ActivityLogQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 당 항목 수', example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: '사용자 ID 필터' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '활동 유형 필터' })
  @IsOptional()
  @IsString()
  activityType?: string;

  @ApiPropertyOptional({ description: '시작 날짜 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료 날짜 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
