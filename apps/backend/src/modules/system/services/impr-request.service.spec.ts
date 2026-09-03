/**
 * @file src/modules/system/services/impr-request.service.spec.ts
 * @description 개선요청 상태 변경 — DONE 전이 근거(커밋 해시·테스트 근거·배포 SHA) 필수 규칙 단위 테스트
 */
import { BadRequestException } from '@nestjs/common';
import { ImprRequestService } from './impr-request.service';
import { ImprRequest } from '../../../entities/impr-request.entity';

describe('ImprRequestService.updateStatus — 처리됨(DONE) 근거 필수', () => {
  const makeService = () => {
    const item = { imprId: 'I1', status: 'IN_PROGRESS', company: '40', plantCd: '1000' } as ImprRequest;
    const repo = {
      findOne: jest.fn().mockResolvedValue(item),
      save: jest.fn().mockImplementation(async (e: ImprRequest) => e),
    };
    return { svc: new ImprRequestService(repo as any), repo, item };
  };

  it('근거 없이 DONE으로 바꾸면 400이고 저장하지 않는다', async () => {
    const { svc, repo } = makeService();
    await expect(svc.updateStatus('I1', { status: 'DONE' }, '40', '1000')).rejects.toThrow(BadRequestException);
    await expect(svc.updateStatus('I1', { status: 'DONE' }, '40', '1000')).rejects.toThrow('fixCommit, fixTest, deploySha');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('커밋 해시 형식이 틀리면 해당 필드만 누락으로 알린다', async () => {
    const { svc } = makeService();
    await expect(
      svc.updateStatus('I1', { status: 'DONE', fixCommit: 'not-a-sha', fixTest: 'x.spec.ts 3 pass', deploySha: '14dc81c0' }, '40', '1000'),
    ).rejects.toThrow('누락/형식오류: fixCommit');
  });

  it('근거 3개가 모두 있으면 DONE으로 저장하고 근거·완료시각을 기록한다', async () => {
    const { svc, repo } = makeService();
    const saved = await svc.updateStatus(
      'I1',
      { status: 'DONE', fixCommit: ' 82ef6433 ', fixTest: 'mat-issue.service.spec.ts 27 pass', deploySha: '14dc81c0' },
      '40', '1000',
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved.status).toBe('DONE');
    expect(saved.fixCommit).toBe('82ef6433');
    expect(saved.deploySha).toBe('14dc81c0');
    expect(saved.doneAt).toBeInstanceOf(Date);
  });

  it('IN_PROGRESS 전이는 근거를 요구하지 않는다', async () => {
    const { svc } = makeService();
    const saved = await svc.updateStatus('I1', { status: 'IN_PROGRESS' }, '40', '1000');
    expect(saved.status).toBe('IN_PROGRESS');
  });
});
