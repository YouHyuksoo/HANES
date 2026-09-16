/**
 * @file equip-stop.service.spec.ts
 * @description 설비정지 서비스 규칙 테스트
 *
 * 여기서 지키는 규칙:
 * 1. 같은 설비에 진행중 정지가 있으면 새 정지를 거부한다(409).
 * 2. 사유가 확정되지 않은 정지는 해제할 수 없다(400).
 * 3. 해제 시 사유를 함께 보내면 그 사유로 확정하며 해제된다.
 * 4. 이미 해제된 정지는 다시 해제할 수 없다(409).
 * 5. 해제 시 설비 상태를 정지 직전 상태(PREV_EQUIP_STATUS)로 되돌리되,
 *    아직 STOP일 때만 되돌린다. 정지 중에 걸린 INTERLOCK을 조용히 풀면 안 된다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EquipStopService } from './equip-stop.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('EquipStopService', () => {
  let service: EquipStopService;
  let query: jest.Mock;

  const TENANT = ['40', '1000'] as const;

  beforeEach(async () => {
    query = jest.fn();
    const manager = { query };
    const tx = { run: jest.fn(async (cb: (qr: unknown) => unknown) => cb({ manager })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipStopService,
        { provide: DataSource, useValue: { query, manager } },
        { provide: TransactionService, useValue: tx },
      ],
    }).compile();

    service = module.get(EquipStopService);
  });

  describe('startStop', () => {
    it('이미 정지 중인 설비면 409로 거부한다', async () => {
      query.mockResolvedValueOnce([{ STOP_ID: 7 }]); // 진행중 정지 존재

      await expect(
        service.startStop({ equipCode: 'EQ-1' }, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('설비가 없으면 404로 거부한다', async () => {
      query.mockResolvedValueOnce([]); // 진행중 정지 없음
      query.mockResolvedValueOnce([]); // 설비 조회 결과 없음

      await expect(
        service.startStop({ equipCode: 'NOPE' }, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('사유 없이도 정지가 시작되고 설비 상태가 STOP으로 바뀐다', async () => {
      query.mockResolvedValueOnce([]);                          // 진행중 정지 없음
      query.mockResolvedValueOnce([{ STATUS: 'NORMAL' }]);      // 설비 현재 상태
      query.mockResolvedValueOnce([{ nextId: 11 }]);            // 채번
      query.mockResolvedValueOnce(undefined);                   // INSERT
      query.mockResolvedValueOnce(undefined);                   // EQUIP_MASTERS UPDATE
      query.mockResolvedValueOnce([{ stopId: 11, status: 'OPEN', stopReason: null }]);

      const result = await service.startStop({ equipCode: 'EQ-1' }, ...TENANT, 'u1');

      expect(result.stopId).toBe(11);
      expect(result.stopReason).toBeNull();
      // 정지 직전 상태(NORMAL)를 PREV_EQUIP_STATUS 로 넘긴다
      const insertBinds = query.mock.calls[3][1] as unknown[];
      expect(insertBinds).toContain('NORMAL');
      const statusUpdateSql = query.mock.calls[4][0] as string;
      expect(statusUpdateSql).toContain("STATUS = 'STOP'");
      // NORMAL일 때만 STOP으로 바꾼다 — MAINT/INTERLOCK을 정지가 덮어쓰면 안 된다
      expect(statusUpdateSql).toContain("AND STATUS = 'NORMAL'");
    });
  });

  describe('releaseStop', () => {
    it('사유미정 정지는 해제를 거부한다(400)', async () => {
      query.mockResolvedValueOnce([
        { STOP_ID: 5, EQUIP_CODE: 'EQ-1', STOP_REASON: null, STATUS: 'OPEN', PREV_EQUIP_STATUS: 'NORMAL' },
      ]);

      await expect(
        service.releaseStop(5, {}, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('해제 시 사유를 함께 보내면 그 사유로 확정하며 해제된다', async () => {
      query.mockResolvedValueOnce([
        { STOP_ID: 5, EQUIP_CODE: 'EQ-1', STOP_REASON: null, STATUS: 'OPEN', PREV_EQUIP_STATUS: 'INTERLOCK' },
      ]);
      query.mockResolvedValueOnce(undefined); // 해제 UPDATE
      query.mockResolvedValueOnce(undefined); // 설비 상태 복원
      query.mockResolvedValueOnce([{ stopId: 5, status: 'CLOSED', lossSeconds: 120 }]);

      const result = await service.releaseStop(5, { stopReason: 'FAILURE' }, ...TENANT, 'u1');

      expect(result.lossSeconds).toBe(120);
      const releaseBinds = query.mock.calls[1][1] as unknown[];
      expect(releaseBinds[0]).toBe('FAILURE');
      // 유실시간은 클라이언트가 보낸 값이 아니라 서버 SYSTIMESTAMP 로 계산한다
      expect(query.mock.calls[1][0]).toContain('LOSS_SECONDS = ROUND((CAST(SYSTIMESTAMP AS DATE)');
      // 정지 직전 상태로 되돌린다
      expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining(['INTERLOCK']));
      // 단, 아직 STOP일 때만 되돌린다(정지 중 걸린 인터록 보존)
      expect(query.mock.calls[2][0]).toContain("AND STATUS = 'STOP'");
    });

    it('이미 해제된 정지는 409로 거부한다', async () => {
      query.mockResolvedValueOnce([
        { STOP_ID: 5, EQUIP_CODE: 'EQ-1', STOP_REASON: 'FAILURE', STATUS: 'CLOSED', PREV_EQUIP_STATUS: 'NORMAL' },
      ]);

      await expect(
        service.releaseStop(5, {}, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('없는 정지번호는 404로 거부한다', async () => {
      query.mockResolvedValueOnce([]);

      await expect(
        service.releaseStop(999, { stopReason: 'FAILURE' }, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createCall', () => {
    it('이미 호출 중이면 409로 거부한다', async () => {
      query.mockResolvedValueOnce([{ CALL_ID: 3 }]);

      await expect(
        service.createCall({ equipCode: 'EQ-1', callType: 'EQUIP' }, ...TENANT, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
