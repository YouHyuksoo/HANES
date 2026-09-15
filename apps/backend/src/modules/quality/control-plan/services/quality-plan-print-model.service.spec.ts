import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { QualityPlanPrintModelService } from './quality-plan-print-model.service';

describe('QualityPlanPrintModelService', () => {
  it('발행 Revision snapshot만 조회하고 현재 마스터를 재조합하지 않는다', async () => {
    const tx: DeepMocked<TransactionService> = createMock<TransactionService>();
    const query = jest.fn().mockResolvedValueOnce([{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'PFD', REVISION_ID: 10 }]).mockResolvedValue([]);
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    await new QualityPlanPrintModelService(tx).getPackagePrintModel(1, '40', '1000');
    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain("R.STATUS='PUBLISHED'");
    expect(sql).not.toMatch(/ITEM_MASTERS|ROUTING_|PROCESS_MASTERS|EQUIP_MASTERS/);
  });
});
