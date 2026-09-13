/**
 * @file modules/system/dto/activity-log.dto.ts
 * @description 활동 로그 DTO - 생성/조회 요청 규격
 *
 * 초보자 가이드:
 * 1. **CreateActivityLogDto**: 프론트엔드에서 페이지 접속 로그 전송 시 사용
 * 2. **ActivityLogQueryDto**: 관리 화면에서 활동 로그 조회 시 필터/페이지네이션
 */
import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@common/dto/base-query.dto';
// 활동 유형·기록주체 목록은 @harness/shared 가 단일 출처다(프론트와 같이 봐야 한다)
import { ACTIVITY_EVENT_TYPES, ACTIVITY_ACTOR_KINDS } from '@harness/shared';

export class CreateActivityLogDto {
  @ApiProperty({ description: '활동 유형', example: 'PAGE_ACCESS' })
  @IsString()
  @IsIn(ACTIVITY_EVENT_TYPES as unknown as string[])
  activityType: string;

  @ApiPropertyOptional({ description: '토스트/에러 메시지 본문' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: '기록 주체', example: 'HUMAN' })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY_ACTOR_KINDS as unknown as string[])
  actorKind?: string;

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
 * - fromDate/endDate는 서비스에서 별도 처리하므로 유지
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
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료 날짜 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  toDate?: string;
}
