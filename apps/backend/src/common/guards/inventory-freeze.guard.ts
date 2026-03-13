/**
 * @file src/common/guards/inventory-freeze.guard.ts
 * @description 재고실사 중 자재 트랜잭션 차단 Guard
 *
 * 초보자 가이드:
 * 1. **목적**: 재고실사가 진행 중(IN_PROGRESS)일 때 재고를 변동시키는 API 요청을 차단합니다.
 *    - 실사 중에 입고/출고/보정 등이 발생하면 실사 결과가 틀어지기 때문에 차단이 필요합니다.
 * 2. **사용법**: 재고 변동 엔드포인트의 메서드 또는 컨트롤러 클래스에 `@UseGuards(InventoryFreezeGuard)` 데코레이터 적용.
 *    ```typescript
 *    @Post()
 *    @UseGuards(InventoryFreezeGuard)
 *    async create(@Body() dto: CreateReceivingDto) { ... }
 *    ```
 * 3. **조회 방식**: PHYSICAL_INV_SESSIONS 테이블에서 status='IN_PROGRESS' 레코드를 조회합니다.
 *    - DataSource를 직접 주입해 native query를 사용합니다 (Guard는 모듈 외부에서도 사용되므로).
 * 4. **에러**: 실사 중이면 400 BadRequestException을 던집니다.
 * 5. **성능**: 조회 쿼리가 단순(INDEX 사용)해 오버헤드가 작습니다.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Request } from 'express';

/**
 * 재고실사 진행 중 차단 Guard
 *
 * PHYSICAL_INV_SESSIONS 테이블에서 status = 'IN_PROGRESS'인 세션이
 * 존재하면 해당 요청을 차단(BadRequestException)합니다.
 *
 * Guard를 전역 providers에 등록하거나, 개별 컨트롤러 메서드에 데코레이터로 적용하세요.
 * 주의: @InjectRepository 대신 DataSource를 사용합니다
 *       (Guard는 다수 모듈에서 공유하므로 특정 모듈의 Repository에 의존하면 안 됩니다).
 */
@Injectable()
export class InventoryFreezeGuard implements CanActivate {
  private readonly logger = new Logger(InventoryFreezeGuard.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 요청 허용 여부 결정
   * @returns true → 요청 통과, false / throw → 요청 차단
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // X-Company, X-Plant 헤더에서 회사/사업장 정보 추출 (범위 제한용)
    const company = request.headers['x-company'] as string | undefined;
    const plant = request.headers['x-plant'] as string | undefined;

    try {
      const isFreeze = await this.checkFreezeStatus(company, plant);

      if (isFreeze) {
        this.logger.warn(
          `재고실사 진행 중 — 트랜잭션 차단: company=${company ?? 'ALL'}, plant=${plant ?? 'ALL'}, path=${request.path}`,
        );
        throw new BadRequestException(
          '재고실사 진행 중입니다. 자재 트랜잭션이 제한됩니다.',
        );
      }

      return true;
    } catch (error) {
      // BadRequestException은 그대로 re-throw
      if (error instanceof BadRequestException) {
        throw error;
      }
      // DB 오류 등 예기치 못한 에러는 로그만 남기고 통과 (서비스 중단 방지)
      this.logger.error(
        `InventoryFreezeGuard DB 조회 실패 — 통과 처리: ${(error as Error).message}`,
      );
      return true;
    }
  }

  /**
   * PHYSICAL_INV_SESSIONS 테이블에서 IN_PROGRESS 세션 존재 여부 확인
   *
   * @param company - X-Company 헤더값 (없으면 전사 조회)
   * @param plant   - X-Plant 헤더값 (없으면 전체 사업장 조회)
   * @returns true → 실사 진행 중 (트랜잭션 차단), false → 정상
   */
  private async checkFreezeStatus(
    company?: string,
    plant?: string,
  ): Promise<boolean> {
    // Native query: TypeORM 테이블명은 Oracle 대소문자 정확히 맞춰야 함
    // 파라미터 바인딩 방식은 OracleDB 드라이버 규칙(`:param`)을 따릅니다
    let sql = `
      SELECT COUNT(*) AS CNT
      FROM PHYSICAL_INV_SESSIONS
      WHERE STATUS = 'IN_PROGRESS'
    `;
    const params: string[] = [];

    if (company) {
      params.push(company);
      sql += ` AND (COMPANY = :${params.length} OR COMPANY IS NULL)`;
    }
    if (plant) {
      params.push(plant);
      sql += ` AND (PLANT_CD = :${params.length} OR PLANT_CD IS NULL)`;
    }

    const result = await this.dataSource.query(sql, params);

    // Oracle은 COUNT(*)를 숫자 또는 문자열로 반환할 수 있으므로 강제 변환
    const count = Number(result?.[0]?.CNT ?? result?.[0]?.cnt ?? 0);
    return count > 0;
  }
}
