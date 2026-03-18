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
import { PaginationQueryDto } from '@common/dto/base-query.dto';

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

/**
 * 활동 로그 조회 쿼리 DTO
 * - PaginationQueryDto에서 page, limit 상속
 * - startDate/endDate는 서비스에서 별도 처리하므로 유지
 */
export class ActivityLogQueryDto extends PaginationQueryDto {
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
