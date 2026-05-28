/**
 * @file src/modules/system/controllers/table-schema.controller.ts
 * @description Oracle 테이블 스키마 조회 API — DataGrid SQL 뷰어 명세 표시용
 */

import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TableSchemaService } from '../services/table-schema.service';

@ApiTags('system')
@Controller('system')
export class TableSchemaController {
  constructor(private readonly tableSchemaService: TableSchemaService) {}

  @Get('table-schema')
  @ApiOperation({ summary: 'Oracle 테이블 컬럼 명세 조회' })
  @ApiQuery({ name: 'table', description: '테이블명 (UPPER_SNAKE_CASE)' })
  async getTableSchema(@Query('table') tableName: string) {
    if (!tableName || !/^[A-Z0-9_]+$/i.test(tableName)) {
      throw new BadRequestException('유효하지 않은 테이블명입니다');
    }
    return this.tableSchemaService.getTableSchema(tableName);
  }
}
