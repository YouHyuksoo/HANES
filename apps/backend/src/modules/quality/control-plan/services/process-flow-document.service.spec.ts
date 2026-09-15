import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { ProcessFlowDocumentService } from './process-flow-document.service';

describe('ProcessFlowDocumentService', () => {
  let tx: DeepMocked<TransactionService>;
  let query: jest.Mock;
  let service: ProcessFlowDocumentService;

  beforeEach(() => {
    tx = createMock<TransactionService>();
    query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new ProcessFlowDocumentService(tx);
  });

  it('발행 Revision의 행 변경을 거부한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'PUBLISHED', DOCUMENT_TYPE: 'PFD' }]);
    await expect(service.createRow(1, { processNo: '10', processName: '절단', lane: 'MAIN', symbol: 'OPERATION' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('현재 tenant에 없는 공정코드를 거부한다', async () => {
    query
      .mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFD' }])
      .mockResolvedValueOnce([]);
    await expect(service.createRow(1, { processNo: '10', processCode: 'BAD', processName: '절단', lane: 'MAIN', symbol: 'OPERATION' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('lane과 symbol이 공통코드에 없으면 거부한다', async () => {
    query
      .mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFD' }])
      .mockResolvedValueOnce([]);
    await expect(service.createRow(1, { processNo: '10', processName: '절단', lane: 'INVALID' as any, symbol: 'OPERATION' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('재정렬은 임시 음수 순번 후 새 ROW_SEQ를 같은 트랜잭션에서 저장한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFD' }]).mockResolvedValueOnce([{ ROW_ID: 10 }, { ROW_ID: 20 }]).mockResolvedValue([]);
    await service.reorder(1, [20, 10], '40', '1000', 'tester');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET ROW_SEQ = -ROW_SEQ'))).toBe(true);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('SET ROW_SEQ=:1'))).toHaveLength(2);
    expect(tx.run).toHaveBeenCalledTimes(1);
  });

  it('재정렬 목록이 현재 행 전체와 일치하지 않으면 거부한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFD' }]).mockResolvedValueOnce([{ ROW_ID: 10 }, { ROW_ID: 20 }]);
    await expect(service.reorder(1, [10, 10], '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET ROW_SEQ = -ROW_SEQ'))).toBe(false);
  });

  it('조회 결과에 행 순서 기반 연결선 모델을 포함한다', async () => {
    query.mockResolvedValueOnce([{ ROW_ID: 10, ROW_SEQ: 1 }, { ROW_ID: 20, ROW_SEQ: 2 }]);
    const result = await service.findRows(1, '40', '1000');
    expect(result.connections).toEqual([{ fromRowId: 10, toRowId: 20 }]);
  });
});
