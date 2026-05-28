/**
 * @file src/modules/system/services/table-schema.service.ts
 * @description Oracle USER_TAB_COLUMNS + USER_COL_COMMENTS 조회 — DataGrid SQL 뷰어용
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ColumnInfo {
  columnId: number;
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: 'Y' | 'N';
  dataDefault: string | null;
  comments: string | null;
}

export interface TableSchemaResult {
  tableName: string;
  tableComment: string | null;
  columns: ColumnInfo[];
}

@Injectable()
export class TableSchemaService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getTableSchema(tableName: string): Promise<TableSchemaResult> {
    const upper = tableName.toUpperCase();

    const [columns, tableCommentRows] = await Promise.all([
      this.dataSource.query<ColumnInfo[]>(
        `SELECT
          c.COLUMN_ID      AS "columnId",
          c.COLUMN_NAME    AS "columnName",
          c.DATA_TYPE      AS "dataType",
          c.DATA_LENGTH    AS "dataLength",
          c.DATA_PRECISION AS "dataPrecision",
          c.DATA_SCALE     AS "dataScale",
          c.NULLABLE       AS "nullable",
          c.DATA_DEFAULT   AS "dataDefault",
          NVL(cc.COMMENTS, '') AS "comments"
        FROM USER_TAB_COLUMNS c
        LEFT JOIN USER_COL_COMMENTS cc
          ON cc.TABLE_NAME = c.TABLE_NAME
          AND cc.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_NAME = :1
        ORDER BY c.COLUMN_ID`,
        [upper],
      ),
      this.dataSource.query<{ tableComment: string }[]>(
        `SELECT NVL(COMMENTS, '') AS "tableComment"
         FROM USER_TAB_COMMENTS
         WHERE TABLE_NAME = :1`,
        [upper],
      ),
    ]);

    return {
      tableName: upper,
      tableComment: tableCommentRows[0]?.tableComment ?? null,
      columns,
    };
  }
}
