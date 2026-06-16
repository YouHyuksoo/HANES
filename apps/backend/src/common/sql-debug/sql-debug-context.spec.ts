import {
  extractSqlTables,
  getSqlDebugQueries,
  recordSqlDebugQuery,
  runWithSqlDebugContext,
} from './sql-debug-context';

describe('sql-debug-context', () => {
  it('extracts table names from FROM and JOIN clauses', () => {
    expect(
      extractSqlTables(
        'SELECT lot.MAT_UID FROM "MAT_LOTS" lot JOIN ITEM_MASTERS item ON item.ITEM_CODE = lot.ITEM_CODE',
      ),
    ).toEqual(['MAT_LOTS', 'ITEM_MASTERS']);
  });

  it('records SELECT statements only inside a request debug context', () => {
    runWithSqlDebugContext(() => {
      recordSqlDebugQuery('UPDATE MAT_LOTS SET STATUS = :1', ['OK']);
      recordSqlDebugQuery('SELECT * FROM MAT_LOTS WHERE MAT_UID = :1', ['LOT-001']);

      expect(getSqlDebugQueries()).toEqual([
        {
          sql: 'SELECT * FROM MAT_LOTS WHERE MAT_UID = :1',
          parameters: ['LOT-001'],
          tables: ['MAT_LOTS'],
        },
      ]);
    });

    expect(getSqlDebugQueries()).toEqual([]);
  });
});
