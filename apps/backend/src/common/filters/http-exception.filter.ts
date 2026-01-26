/**
 * @file src/common/filters/http-exception.filter.ts
 * @description 글로벌 HTTP 예외 필터
 *
 * 초보자 가이드:
 * 1. **목적**: 모든 HTTP 예외를 일관된 형식으로 변환
 * 2. **적용**: main.ts에서 app.useGlobalFilters()로 등록
 * 3. **로깅**: 500 에러는 스택 트레이스 포함하여 로깅
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: boolean;
  message: string;
  errorCode: string;
  statusCode: number;
  timestamp: string;
  path: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = `HTTP_${status}`;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        errorCode = (responseObj.errorCode as string) || `HTTP_${status}`;
        details = responseObj.details;
      } else {
        message = exception.message;
        errorCode = `HTTP_${status}`;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '서버 내부 오류가 발생했습니다.';
      errorCode = 'INTERNAL_SERVER_ERROR';

      // 500 에러는 상세 로깅
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '알 수 없는 오류가 발생했습니다.';
      errorCode = 'UNKNOWN_ERROR';
    }

    const errorResponse: ErrorResponse = {
      success: false,
      message,
      errorCode,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details) {
      errorResponse.details = details;
    }

    // 요청 정보 로깅 (개발 환경에서 유용)
    this.logger.warn(
      `[${request.method}] ${request.url} - ${status} ${message}`,
    );

    response.status(status).json(errorResponse);
  }
}
