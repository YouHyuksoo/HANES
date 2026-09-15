import { BadRequestException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { QualityPlanParticipantService } from './quality-plan-participant.service';

describe('QualityPlanParticipantService', () => {
  let tx: DeepMocked<TransactionService>; let query: jest.Mock; let service: QualityPlanParticipantService;
  beforeEach(() => {
    tx = createMock<TransactionService>(); query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new QualityPlanParticipantService(tx);
  });

  it('DRAFT PFMEA에 CFT 참여자를 추가한다', async () => {
    query.mockResolvedValueOnce([{ REVISION_ID: 2 }]).mockResolvedValueOnce([{ NEXT_SEQ: 9 }]).mockResolvedValueOnce([]);
    await expect(service.create(2, { userName: '김품질', organization: '품질팀' }, '40', '1000')).resolves.toMatchObject({ participantId: 9, role: 'KEY_CONTACT' });
    expect(query.mock.calls.some(([sql, params]) => String(sql).includes("'KEY_CONTACT'") && params.includes('김품질'))).toBe(true);
  });

  it('발행 PFMEA에서는 CFT 참여자를 추가하지 않는다', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.create(2, { userName: '김품질' }, '40', '1000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('DRAFT PFMEA 참여자만 삭제한다', async () => {
    query.mockResolvedValueOnce([{ PARTICIPANT_ID: 9 }]).mockResolvedValueOnce([]);
    await expect(service.delete(9, '40', '1000')).resolves.toEqual({ participantId: 9 });
  });
});
