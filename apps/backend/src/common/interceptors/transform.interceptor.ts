/**
 * @file src/common/interceptors/transform.interceptor.ts
 * @description API 응답 변환 인터셉터
 *
 * 초보자 가이드:
 * 1. **목적**: 모든 API 응답을 표준 형식으로 변환
 * 2. **적용**: main.ts에서 app.useGlobalInterceptors()로 등록
 * 3. **형식**: { success, data, message, timestamp } 구조로 래핑
 *
 * 주의사항:
 * - 이미 ApiResponse 형식인 응답은 변환하지 않음
 * - 에러 응답은 HttpExceptionFilter에서 처리
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 표준 API 응답 인터페이스
 */
export interface TransformedResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // 이미 표준 형식인 경우 그대로 반환
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // 표준 형식으로 변환
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
