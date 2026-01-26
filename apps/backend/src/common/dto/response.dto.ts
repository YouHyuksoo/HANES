/**
 * @file src/common/dto/response.dto.ts
 * @description API 응답 규격 DTO 정의
 *
 * 초보자 가이드:
 * 1. **ApiResponse**: 모든 API 응답의 표준 형식
 * 2. **PagedResponse**: 페이지네이션이 적용된 목록 응답
 * 3. **사용법**: 컨트롤러에서 ResponseUtil 헬퍼 함수 사용
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 페이지네이션 메타 정보
 */
export class PaginationMeta {
  @ApiProperty({ description: '현재 페이지 번호', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지 당 항목 수', example: 10 })
  limit: number;

  @ApiProperty({ description: '전체 항목 수', example: 100 })
  total: number;

  @ApiProperty({ description: '전체 페이지 수', example: 10 })
  totalPages: number;

  @ApiProperty({ description: '다음 페이지 존재 여부', example: true })
  hasNext: boolean;

  @ApiProperty({ description: '이전 페이지 존재 여부', example: false })
  hasPrev: boolean;
}

/**
 * 표준 API 응답 DTO
 */
export class ApiResponse<T> {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: '응답 데이터' })
  data?: T;

  @ApiPropertyOptional({ description: '에러 메시지', example: null })
  message?: string;

  @ApiPropertyOptional({ description: '에러 코드', example: null })
  errorCode?: string;

  @ApiProperty({ description: '응답 타임스탬프', example: '2025-01-25T12:00:00.000Z' })
  timestamp: string;
}

/**
 * 페이지네이션 응답 DTO
 */
export class PagedResponse<T> extends ApiResponse<T[]> {
  @ApiProperty({ description: '페이지네이션 메타 정보', type: PaginationMeta })
  meta: PaginationMeta;
}

/**
 * API 응답 생성 유틸리티
 */
export class ResponseUtil {
  /**
   * 성공 응답 생성
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 에러 응답 생성
   */
  static error(message: string, errorCode?: string): ApiResponse<null> {
    return {
      success: false,
      data: null,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 페이지네이션 응답 생성
   */
  static paged<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PagedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
