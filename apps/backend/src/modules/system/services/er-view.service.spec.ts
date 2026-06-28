import { BadRequestException } from '@nestjs/common';
import { ErViewService } from './er-view.service';

function createDataSourceMock() {
  return {
    query: jest.fn(),
    transaction: jest.fn(),
  };
}

describe('ErViewService', () => {
  let dataSource: ReturnType<typeof createDataSourceMock>;
  let service: ErViewService;

  beforeEach(() => {
    dataSource = createDataSourceMock();
    service = new ErViewService(dataSource as any);
  });

  it('prefers tenant-aware inferred relationships when both tables have tenant columns', () => {
    const rels = service.inferRelationshipsForSnapshot({
      tables: [
        { tableName: 'ITEM_MASTERS', tableComment: '품목마스터', numRows: 10 },
        { tableName: 'MAT_LOTS', tableComment: '자재 LOT', numRows: 100 },
      ],
      columns: [
        { tableName: 'ITEM_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        {
          tableName: 'ITEM_MASTERS',
          constraintName: 'UK_ITEM_MASTERS_TENANT_ITEM',
          constraintType: 'U',
          columns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
        },
      ],
      foreignKeys: [],
    });

    expect(rels).toContainEqual(expect.objectContaining({
      relationshipType: 'INFERRED',
      childTable: 'MAT_LOTS',
      parentTable: 'ITEM_MASTERS',
      childColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentKeyReady: true,
      tenantIncluded: true,
      confidence: 'HIGH',
    }));
  });

  it('keeps standard NO-style child columns aligned with NO-style parent keys', () => {
    const rels = service.inferRelationshipsForSnapshot({
      tables: [
        { tableName: 'BOX_MASTERS', tableComment: '박스', numRows: 10 },
        { tableName: 'TRACE_LOGS', tableComment: '추적 로그', numRows: 100 },
      ],
      columns: [
        { tableName: 'BOX_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'BOX_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'BOX_MASTERS', columnName: 'BOX_NO', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'TRACE_LOGS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'TRACE_LOGS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'TRACE_LOGS', columnName: 'BOX_NO', columnId: 3, dataType: 'VARCHAR2', nullable: 'Y' },
      ],
      keys: [
        { tableName: 'BOX_MASTERS', constraintName: 'PK_BOX_MASTERS', constraintType: 'P', columns: ['BOX_NO'] },
      ],
      foreignKeys: [],
    });

    expect(rels).toContainEqual(expect.objectContaining({
      childTable: 'TRACE_LOGS',
      childColumns: ['COMPANY', 'PLANT_CD', 'BOX_NO'],
      parentTable: 'BOX_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'BOX_NO'],
    }));
  });

  it('maps WORKER_CODE child columns to WORKER_MASTERS.WORKER_CODE', () => {
    const rels = service.inferRelationshipsForSnapshot({
      tables: [
        { tableName: 'WORKER_MASTERS', tableComment: '작업자', numRows: 10 },
        { tableName: 'PROD_RESULTS', tableComment: '생산실적', numRows: 100 },
      ],
      columns: [
        { tableName: 'WORKER_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'WORKER_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'WORKER_MASTERS', columnName: 'WORKER_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'PROD_RESULTS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'PROD_RESULTS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'PROD_RESULTS', columnName: 'WORKER_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'Y' },
      ],
      keys: [
        { tableName: 'WORKER_MASTERS', constraintName: 'PK_WORKER_MASTERS', constraintType: 'P', columns: ['COMPANY', 'PLANT_CD', 'WORKER_CODE'] },
      ],
      foreignKeys: [],
    });

    expect(rels).toContainEqual(expect.objectContaining({
      childTable: 'PROD_RESULTS',
      childColumns: ['COMPANY', 'PLANT_CD', 'WORKER_CODE'],
      parentTable: 'WORKER_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'WORKER_CODE'],
      parentKeyReady: true,
    }));
  });

  it('maps ACTIVITY_LOGS.EMAIL to USERS.EMAIL without treating NAME as an FK column', () => {
    const rels = service.inferRelationshipsForSnapshot({
      tables: [
        { tableName: 'USERS', tableComment: '사용자', numRows: 10 },
        { tableName: 'ACTIVITY_LOGS', tableComment: '활동로그', numRows: 100 },
      ],
      columns: [
        { tableName: 'USERS', columnName: 'EMAIL', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'USERS', columnName: 'NAME', columnId: 2, dataType: 'VARCHAR2', nullable: 'Y' },
        { tableName: 'USERS', columnName: 'COMPANY', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'USERS', columnName: 'PLANT_CD', columnId: 4, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'ACTIVITY_DATE', columnId: 1, dataType: 'DATE', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'SEQ', columnId: 2, dataType: 'NUMBER', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'EMAIL', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'NAME', columnId: 4, dataType: 'VARCHAR2', nullable: 'Y' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'COMPANY', columnId: 5, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'PLANT_CD', columnId: 6, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'USERS', constraintName: 'PK_USERS', constraintType: 'P', columns: ['EMAIL'] },
      ],
      foreignKeys: [],
    });

    expect(rels).toContainEqual(expect.objectContaining({
      relationshipType: 'INFERRED',
      childTable: 'ACTIVITY_LOGS',
      childColumns: ['EMAIL'],
      parentTable: 'USERS',
      parentColumns: ['EMAIL'],
      parentKeyReady: true,
      tenantIncluded: false,
      confidence: 'HIGH',
    }));
    expect(rels).not.toContainEqual(expect.objectContaining({
      childTable: 'ACTIVITY_LOGS',
      childColumns: expect.arrayContaining(['NAME']),
    }));
  });

  it('does not infer relationships when the resolved parent table is missing', () => {
    const rels = service.inferRelationshipsForSnapshot({
      tables: [
        { tableName: 'ORDER_MASTERS', tableComment: '주문', numRows: 10 },
        { tableName: 'TRACE_LOGS', tableComment: '추적 로그', numRows: 100 },
      ],
      columns: [
        { tableName: 'ORDER_MASTERS', columnName: 'ORDER_NO', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'TRACE_LOGS', columnName: 'CUSTOMER_ID', columnId: 1, dataType: 'VARCHAR2', nullable: 'Y' },
      ],
      keys: [],
      foreignKeys: [],
    });

    expect(rels).toHaveLength(0);
  });

  it('marks inferred relationships blocked when parent key is missing or orphan rows exist', () => {
    const risk = service.scoreRelationshipRisk({
      relationshipType: 'INFERRED',
      childTable: 'MAT_LOTS',
      childColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentTable: 'ITEM_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentKeyReady: false,
      tenantIncluded: true,
      confidence: 'HIGH',
      orphanCount: 3,
    });

    expect(risk.level).toBe('BLOCKED');
    expect(risk.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ORPHAN_EXISTS', score: 50 }),
      expect.objectContaining({ code: 'PARENT_KEY_MISSING', score: 40 }),
    ]));
  });

  it('marks physical FKs as already existing without negative risk score penalties', () => {
    const risk = service.scoreRelationshipRisk({
      relationshipType: 'PHYSICAL_FK',
      constraintName: 'FK_CONSUMABLE_STOCKS_MASTER',
      childTable: 'CONSUMABLE_STOCKS',
      childColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
      parentTable: 'CONSUMABLE_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
      parentKeyReady: true,
      tenantIncluded: true,
      confidence: 'HIGH',
    });

    expect(risk).toEqual(expect.objectContaining({
      score: 0,
      level: 'LOW',
      executable: false,
      recommendation: '신규 생성 불필요',
    }));
    expect(risk.reasons).toContainEqual(expect.objectContaining({
      code: 'PHYSICAL_FK_EXISTS',
      score: 0,
    }));
    expect(risk.reasons.some((reason) => reason.score < 0)).toBe(false);
  });

  it('returns ER graph table nodes with columns and PK metadata', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'ITEM_MASTERS', tableComment: '품목마스터', numRows: 10 },
        { tableName: 'MAT_LOTS', tableComment: '자재 LOT', numRows: 100 },
      ],
      columns: [
        { tableName: 'ITEM_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'LOT_NO', columnId: 4, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'ITEM_MASTERS', constraintName: 'PK_ITEM', constraintType: 'P', columns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'] },
        { tableName: 'MAT_LOTS', constraintName: 'PK_LOT', constraintType: 'P', columns: ['COMPANY', 'PLANT_CD', 'LOT_NO'] },
      ],
      foreignKeys: [],
    });

    const graph = await service.getGraph('MAT_LOTS');
    const matLots = graph.nodes.find((node) => node.id === 'MAT_LOTS');

    expect(matLots).toEqual(expect.objectContaining({
      id: 'MAT_LOTS',
      label: 'MAT_LOTS',
      comment: '자재 LOT',
      pkColumns: ['COMPANY', 'PLANT_CD', 'LOT_NO'],
    }));
    expect(matLots?.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ columnName: 'LOT_NO', isPk: true, isFkCandidate: false }),
      expect.objectContaining({ columnName: 'ITEM_CODE', isPk: false, isFkCandidate: true }),
    ]));
  });

  it('returns physical FK constraint names in graph edges and relationship details', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'CONSUMABLE_MASTERS', tableComment: '소모품마스터', numRows: 10 },
        { tableName: 'CONSUMABLE_STOCKS', tableComment: '소모품재고', numRows: 100 },
      ],
      columns: [
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'CONSUMABLE_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'CONSUMABLE_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'CONSUMABLE_MASTERS', constraintName: 'UK_CONSUMABLE_MASTERS_CODE', constraintType: 'U', columns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'] },
      ],
      foreignKeys: [
        {
          constraintName: 'FK_CONSUMABLE_STOCKS_MASTER',
          childTable: 'CONSUMABLE_STOCKS',
          childColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
          parentTable: 'CONSUMABLE_MASTERS',
          parentColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
        },
      ],
    });

    const graph = await service.getGraph('CONSUMABLE_STOCKS');

    expect(graph.relationships).toContainEqual(expect.objectContaining({
      relationshipType: 'PHYSICAL_FK',
      constraintName: 'FK_CONSUMABLE_STOCKS_MASTER',
    }));
    expect(graph.edges).toContainEqual(expect.objectContaining({
      relationshipType: 'PHYSICAL_FK',
      constraintName: 'FK_CONSUMABLE_STOCKS_MASTER',
      riskLevel: 'LOW',
    }));
  });

  it('builds ADD_FK preview from structured payload using ENABLE VALIDATE only', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'ITEM_MASTERS', tableComment: '', numRows: 1 },
        { tableName: 'MAT_LOTS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'ITEM_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ITEM_MASTERS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'MAT_LOTS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'ITEM_MASTERS', constraintName: 'UK_ITEM', constraintType: 'U', columns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'] },
      ],
      foreignKeys: [],
    });
    jest.spyOn(service, 'scanOrphans').mockResolvedValue({
      relationshipId: 'INFERRED:MAT_LOTS:ITEM_MASTERS:COMPANY,PLANT_CD,ITEM_CODE',
      orphanCount: 0,
      sampleLimit: 20,
      samples: [],
      sql: 'SELECT ...',
    });

    const preview = await service.previewAction({
      actionType: 'ADD_FK',
      constraintName: 'FK_MAT_LOTS_ITEM',
      childTable: 'MAT_LOTS',
      childColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentTable: 'ITEM_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
    });

    expect(preview.sql).toContain('ALTER TABLE MAT_LOTS ADD CONSTRAINT FK_MAT_LOTS_ITEM');
    expect(preview.sql).toContain('ENABLE VALIDATE');
    expect(preview.confirmationPhrase).toBe('실행');
    expect(preview.rawSqlAccepted).toBe(false);
  });

  it('builds ADD_UK preview for a parent key prerequisite using ENABLE VALIDATE', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'VENDOR_MASTERS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'VENDOR_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'VENDOR_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'VENDOR_MASTERS', columnName: 'VENDOR_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [],
      foreignKeys: [],
    });
    dataSource.query
      .mockResolvedValueOnce([{ duplicateCount: 0 }])
      .mockResolvedValueOnce([{ nullCount: 0 }]);

    const preview = await service.previewAction({
      actionType: 'ADD_UK',
      constraintName: 'UK_VENDOR_TENANT_CODE',
      tableName: 'VENDOR_MASTERS',
      columns: ['COMPANY', 'PLANT_CD', 'VENDOR_CODE'],
    });

    expect(preview.actionType).toBe('ADD_UK');
    expect(preview.sql).toBe('ALTER TABLE VENDOR_MASTERS ADD CONSTRAINT UK_VENDOR_TENANT_CODE UNIQUE (COMPANY, PLANT_CD, VENDOR_CODE) ENABLE VALIDATE');
    expect(preview.confirmationPhrase).toBe('실행');
    expect(preview.rawSqlAccepted).toBe(false);
  });

  it('builds DROP_FK preview only for an existing physical FK constraint', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'USERS', tableComment: '', numRows: 1 },
        { tableName: 'ACTIVITY_LOGS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'USERS', columnName: 'EMAIL', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'ACTIVITY_LOGS', columnName: 'EMAIL', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'USERS', constraintName: 'PK_USERS', constraintType: 'P', columns: ['EMAIL'] },
      ],
      foreignKeys: [
        {
          constraintName: 'FK_ACTIVITY_LOGS_EMAIL',
          childTable: 'ACTIVITY_LOGS',
          childColumns: ['EMAIL'],
          parentTable: 'USERS',
          parentColumns: ['EMAIL'],
        },
      ],
    });

    const preview = await service.previewAction({
      actionType: 'DROP_FK' as any,
      constraintName: 'FK_ACTIVITY_LOGS_EMAIL',
      childTable: 'ACTIVITY_LOGS',
    });

    expect(preview.actionType).toBe('DROP_FK');
    expect(preview.sql).toBe('ALTER TABLE ACTIVITY_LOGS DROP CONSTRAINT FK_ACTIVITY_LOGS_EMAIL');
    expect(preview.confirmationPhrase).toBe('실행');
    expect(preview.riskLevel).toBe('HIGH');
    expect(preview.rawSqlAccepted).toBe(false);
  });

  it('rejects ADD_UK preview before SQL execution when requested columns do not exist', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'BOX_MASTERS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'BOX_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'BOX_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'BOX_MASTERS', columnName: 'BOX_NO', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'BOX_MASTERS', constraintName: 'PK_BOX_MASTERS', constraintType: 'P', columns: ['BOX_NO'] },
      ],
      foreignKeys: [],
    });

    await expect(service.previewAction({
      actionType: 'ADD_UK',
      constraintName: 'UK_BOX_MASTERS_MISSING',
      tableName: 'BOX_MASTERS',
      columns: ['COMPANY', 'PLANT_CD', 'MISSING_BOX_COLUMN'],
    })).rejects.toThrow('존재하지 않는 컬럼');
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rejects ADD_FK preview before orphan scan when requested columns do not exist', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'BOX_MASTERS', tableComment: '', numRows: 1 },
        { tableName: 'TRACE_LOGS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'BOX_MASTERS', columnName: 'BOX_NO', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'TRACE_LOGS', columnName: 'BOX_NO', columnId: 1, dataType: 'VARCHAR2', nullable: 'Y' },
      ],
      keys: [
        { tableName: 'BOX_MASTERS', constraintName: 'PK_BOX_MASTERS', constraintType: 'P', columns: ['BOX_NO'] },
      ],
      foreignKeys: [],
    });
    const scanSpy = jest.spyOn(service, 'scanOrphans');

    await expect(service.previewAction({
      actionType: 'ADD_FK',
      constraintName: 'FK_TRACE_BOX',
      childTable: 'TRACE_LOGS',
      childColumns: ['BOX_NO'],
      parentTable: 'BOX_MASTERS',
      parentColumns: ['MISSING_BOX_COLUMN'],
    })).rejects.toThrow('존재하지 않는 컬럼');
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('rejects ADD_FK preview when the same physical FK already exists', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'CONSUMABLE_MASTERS', tableComment: '', numRows: 1 },
        { tableName: 'CONSUMABLE_STOCKS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'CONSUMABLE_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_STOCKS', columnName: 'CONSUMABLE_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'CONSUMABLE_MASTERS', constraintName: 'UK_CONSUMABLE_M_CONSUMABLE_C', constraintType: 'U', columns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'] },
      ],
      foreignKeys: [
        {
          constraintName: 'FK_CONSUMABLE_S_CONSUMABLE_C',
          childTable: 'CONSUMABLE_STOCKS',
          childColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
          parentTable: 'CONSUMABLE_MASTERS',
          parentColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
        },
      ],
    });
    const scanSpy = jest.spyOn(service, 'scanOrphans');

    await expect(service.previewAction({
      actionType: 'ADD_FK',
      constraintName: 'FK_CONSUMABLE_S_CONSUMABLE_C',
      childTable: 'CONSUMABLE_STOCKS',
      childColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
      parentTable: 'CONSUMABLE_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
    })).rejects.toThrow('동일한 FK가 이미 존재합니다');
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('rejects ADD_UK preview when the same key columns already exist', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'CONSUMABLE_MASTERS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'CONSUMABLE_MASTERS', columnName: 'CONSUMABLE_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [
        { tableName: 'CONSUMABLE_MASTERS', constraintName: 'UK_CONSUMABLE_M_CONSUMABLE_C', constraintType: 'U', columns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'] },
      ],
      foreignKeys: [],
    });

    await expect(service.previewAction({
      actionType: 'ADD_UK',
      constraintName: 'UK_CONSUMABLE_M_CONSUMABLE_C_2',
      tableName: 'CONSUMABLE_MASTERS',
      columns: ['COMPANY', 'PLANT_CD', 'CONSUMABLE_CODE'],
    })).rejects.toThrow('동일한 PK/UK가 이미 존재합니다');
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('invalidates the schema snapshot cache after DDL execution', async () => {
    jest.spyOn(service as any, 'loadSnapshot').mockResolvedValue({
      tables: [
        { tableName: 'VENDOR_MASTERS', tableComment: '', numRows: 1 },
      ],
      columns: [
        { tableName: 'VENDOR_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'VENDOR_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
        { tableName: 'VENDOR_MASTERS', columnName: 'VENDOR_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
      ],
      keys: [],
      foreignKeys: [],
    });
    dataSource.query
      .mockResolvedValueOnce([{ duplicateCount: 0 }])
      .mockResolvedValueOnce([{ nullCount: 0 }]);
    jest.spyOn(service as any, 'writeMigrationFile').mockReturnValue('apps/backend/src/migrations/test.sql');
    jest.spyOn(service as any, 'regenerateErd').mockReturnValue({ status: 'SUCCESS' });
    jest.spyOn(service as any, 'writeActionLog').mockImplementation(() => undefined);
    (service as any).snapshotCache = {
      at: Date.now(),
      snapshot: { tables: [], columns: [], keys: [], foreignKeys: [] },
    };

    await service.executeAction({
      actionType: 'ADD_UK',
      constraintName: 'UK_VENDOR_TENANT_CODE',
      tableName: 'VENDOR_MASTERS',
      columns: ['COMPANY', 'PLANT_CD', 'VENDOR_CODE'],
      confirmationPhrase: '실행',
    });

    expect(dataSource.query).toHaveBeenCalledWith('ALTER TABLE VENDOR_MASTERS ADD CONSTRAINT UK_VENDOR_TENANT_CODE UNIQUE (COMPANY, PLANT_CD, VENDOR_CODE) ENABLE VALIDATE');
    expect((service as any).snapshotCache).toBeNull();
  });

  it('maps duplicate Oracle constraint errors to BadRequestException during execute', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('ORA-02275: 참조 제약이 이미 테이블에 존재합니다'));
    jest.spyOn(service as any, 'loadSnapshot')
      .mockResolvedValueOnce({
        tables: [
          { tableName: 'ITEM_MASTERS', tableComment: '', numRows: 1 },
          { tableName: 'MAT_LOTS', tableComment: '', numRows: 1 },
        ],
        columns: [
          { tableName: 'ITEM_MASTERS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
          { tableName: 'ITEM_MASTERS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
          { tableName: 'ITEM_MASTERS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
          { tableName: 'MAT_LOTS', columnName: 'COMPANY', columnId: 1, dataType: 'VARCHAR2', nullable: 'N' },
          { tableName: 'MAT_LOTS', columnName: 'PLANT_CD', columnId: 2, dataType: 'VARCHAR2', nullable: 'N' },
          { tableName: 'MAT_LOTS', columnName: 'ITEM_CODE', columnId: 3, dataType: 'VARCHAR2', nullable: 'N' },
        ],
        keys: [
          { tableName: 'ITEM_MASTERS', constraintName: 'UK_ITEM', constraintType: 'U', columns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'] },
        ],
        foreignKeys: [],
      });
    jest.spyOn(service, 'scanOrphans').mockResolvedValue({
      relationshipId: 'INFERRED:MAT_LOTS:ITEM_MASTERS:COMPANY,PLANT_CD,ITEM_CODE',
      orphanCount: 0,
      sampleLimit: 20,
      samples: [],
      sql: 'SELECT ...',
    });
    jest.spyOn(service as any, 'writeActionLog').mockImplementation(() => undefined);

    await expect(service.executeAction({
      actionType: 'ADD_FK',
      constraintName: 'FK_MAT_LOTS_ITEM',
      childTable: 'MAT_LOTS',
      childColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      parentTable: 'ITEM_MASTERS',
      parentColumns: ['COMPANY', 'PLANT_CD', 'ITEM_CODE'],
      confirmationPhrase: '실행',
    })).rejects.toThrow(BadRequestException);
  });

  it('resolves schema governance migration directory from repo or backend cwd', () => {
    const cwdSpy = jest.spyOn(process, 'cwd');

    cwdSpy.mockReturnValue('C:\\Project\\HANES');
    expect((service as any).backendMigrationsDir()).toBe('C:\\Project\\HANES\\apps\\backend\\src\\migrations');

    cwdSpy.mockReturnValue('C:\\Project\\HANES\\apps\\backend');
    expect((service as any).backendMigrationsDir()).toBe('C:\\Project\\HANES\\apps\\backend\\src\\migrations');

    cwdSpy.mockRestore();
  });

  it('rejects unsafe identifiers in structured action payloads', async () => {
    await expect(service.previewAction({
      actionType: 'ADD_FK',
      constraintName: 'FK_BAD;DROP',
      childTable: 'MAT_LOTS',
      childColumns: ['ITEM_CODE'],
      parentTable: 'ITEM_MASTERS',
      parentColumns: ['ITEM_CODE'],
    })).rejects.toThrow(BadRequestException);
  });
});
