/**
 * @file capa.service.spec.ts
 * @description CapaService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CapaService } from './capa.service';
import { CAPARequest } from '../../../../entities/capa-request.entity';
import { CAPAAction } from '../../../../entities/capa-action.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';

describe('CapaService', () => {
  let target: CapaService;
  let mockCapaRepo: DeepMocked<Repository<CAPARequest>>;
  let mockActionRepo: DeepMocked<Repository<CAPAAction>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockCapaRepo = createMock<Repository<CAPARequest>>();
    mockActionRepo = createMock<Repository<CAPAAction>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapaService,
        { provide: getRepositoryToken(CAPARequest), useValue: mockCapaRepo },
        { provide: getRepositoryToken(CAPAAction), useValue: mockActionRepo },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<CapaService>(CapaService);
  });
  afterEach(() => jest.clearAllMocks());

  /** 트랜잭션·공통코드·참조 조회용 매니저 모의: 쿼리는 건수 1(참조 확인은 빈 목록), 트랜잭션은 같은 저장소를 돌려준다 */
  const stubManager = (queryResult: unknown = [{ cnt: 1 }]) => {
    const manager: any = {
      query: jest.fn().mockResolvedValue(queryResult),
      getRepository: jest.fn((entity: unknown) => (entity === CAPAAction ? mockActionRepo : mockCapaRepo)),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    };
    (mockCapaRepo as any).manager = manager;
    return manager;
  };

  describe('findById', () => {
    it('should return capa with actions', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, capaNo: 'CA-001' } as any);
      mockActionRepo.find.mockResolvedValue([]);
      const r = await target.findById('CA-001');
      expect(r.capaNo).toBe('CA-001');
      expect(r.actions).toEqual([]);
    });
    it('should throw NotFoundException', async () => {
      mockCapaRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });

    it('scopes CAPA lookup and actions by tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'CO', plant: 'P01' } as any);
      mockActionRepo.find.mockResolvedValue([]);

      await target.findById('CA-001', 'CO', 'P01');

      expect(mockCapaRepo.findOne).toHaveBeenCalledWith({
        where: { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
      });
      expect(mockActionRepo.find).toHaveBeenCalledWith({
        where: { capaId: 'CA-001' },
        order: { seq: 'ASC' },
      });
    });
  });

  describe('analyze', () => {
    it('should analyze from OPEN', async () => {
      const item = { id: 1, status: 'OPEN' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'ANALYZING' });
      const r = await target.analyze('CA-001', { rootCause: 'test' } as any, 'user');
      expect(r.status).toBe('ANALYZING');
    });
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'CLOSED' } as any);
      await expect(target.analyze('CA-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });

    it('rejects analyze when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.analyze('CA-001', { rootCause: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('plan and start and verify', () => {
    it('rejects plan when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'ANALYZING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.plan('CA-001', { actionPlan: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects start when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'ACTION_PLANNED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.start('CA-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects verify when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'IN_PROGRESS', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.verify('CA-001', { verificationResult: 'ok' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close from VERIFYING', async () => {
      mockActionRepo.count.mockResolvedValue(0);
      const item = { id: 1, status: 'VERIFYING' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close('CA-001', 'user');
      expect(r.status).toBe('CLOSED');
    });

    it('rejects close when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'VERIFYING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.close('CA-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'ANALYZING' } as any);
      mockActionRepo.find.mockResolvedValue([]);
      await expect(target.delete('CA-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('CA-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.delete).not.toHaveBeenCalled();
      expect(mockCapaRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('결함 수정', () => {
    const capa = (over: Record<string, unknown> = {}) => ({ capaNo: 'CA-001', capaType: 'CORRECTIVE', status: 'IN_PROGRESS', company: 'CO', plant: 'P01', ...over }) as any;

    it('미완료 조치 항목이 있으면 검증·종료할 수 없다', async () => {
      mockCapaRepo.findOne.mockResolvedValue(capa());
      mockActionRepo.count.mockResolvedValue(2);
      await expect(target.verify('CA-001', { verificationResult: 'x' } as any, 'user')).rejects.toThrow('완료(DONE)되지 않은 조치 항목이 2건 있어 검증할 수 없습니다.');
      mockCapaRepo.findOne.mockResolvedValue(capa({ status: 'VERIFYING' }));
      await expect(target.close('CA-001', 'user')).rejects.toThrow('완료(DONE)되지 않은 조치 항목이 2건 있어 종료할 수 없습니다.');
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('조치 항목 순번이 겹치면 추가를 거부한다(save 가 기존 항목을 덮어쓰던 것)', async () => {
      stubManager();
      mockCapaRepo.findOne.mockResolvedValue(capa());
      mockActionRepo.findOne.mockResolvedValue({ capaId: 'CA-001', seq: 1 } as any);
      await expect(target.addAction('CA-001', { seq: 1, actionDesc: 'x' } as any, 'user')).rejects.toThrow('이미 있는 조치 항목 순번입니다: 1');
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('검증 중이거나 종료된 CAPA 에는 조치 항목을 추가할 수 없고, 종료된 CAPA 의 항목은 바꿀 수 없다', async () => {
      stubManager();
      mockCapaRepo.findOne.mockResolvedValue(capa({ status: 'VERIFYING' }));
      await expect(target.addAction('CA-001', { seq: 9, actionDesc: 'x' } as any, 'user')).rejects.toThrow('검증 중이거나 종료된 CAPA');
      mockCapaRepo.findOne.mockResolvedValue(capa({ status: 'CLOSED' }));
      await expect(target.updateAction('CA-001', 1, { status: 'PENDING' } as any, 'user')).rejects.toThrow('종료된 CAPA 의 조치 항목은 바꿀 수 없습니다.');
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('조치 항목 상태가 DONE 이 아니게 되면 완료 일시를 비운다', async () => {
      stubManager();
      mockCapaRepo.findOne.mockResolvedValue(capa());
      const action = { capaId: 'CA-001', seq: 1, status: 'DONE', completedAt: new Date() } as any;
      mockActionRepo.findOne.mockResolvedValue(action);
      mockActionRepo.save.mockImplementation(async (v: any) => v);
      const r = await target.updateAction('CA-001', 1, { status: 'PENDING', actionDesc: null } as any, 'user');
      expect(r.completedAt).toBeNull();
      expect(r.status).toBe('PENDING');
    });

    it('다른 문서(NCR·심사·클레임)가 참조하는 CAPA 는 삭제할 수 없다', async () => {
      const manager = stubManager([{ label: 'NCR N-1' }]);
      mockCapaRepo.findOne.mockResolvedValue(capa({ status: 'OPEN' }));
      await expect(target.delete('CA-001', 'CO', 'P01')).rejects.toThrow('다른 문서가 참조하는 CAPA 는 삭제할 수 없습니다: NCR N-1');
      expect(manager.transaction).not.toHaveBeenCalled();
      expect(mockCapaRepo.remove).not.toHaveBeenCalled();

      manager.query.mockResolvedValue([]);
      await target.delete('CA-001', 'CO', 'P01');
      expect(manager.transaction).toHaveBeenCalledTimes(1);
      expect(mockCapaRepo.remove).toHaveBeenCalled();
    });

    it('수정은 유형 변경을 막고, 비울 수 없는 칸의 null 은 그대로 두며, 목표일 ISO 를 날짜로 바꾼다', async () => {
      mockCapaRepo.findOne.mockResolvedValue(capa({ status: 'OPEN', title: '제목' }));
      await expect(target.update('CA-001', { capaType: 'PREVENTIVE' } as any, 'user')).rejects.toThrow('CAPA 유형은 번호(CA-001)가 정해진 뒤에는 바꿀 수 없습니다.');

      mockCapaRepo.save.mockImplementation(async (v: any) => v);
      const r = await target.update('CA-001', { capaType: null, title: null, targetDate: '2026-12-31T09:00:00.000Z', description: '메모' } as any, 'user');
      expect(r).toMatchObject({ capaType: 'CORRECTIVE', title: '제목', description: '메모' });
      expect(r.targetDate).toBeInstanceOf(Date);
    });

    it('등록은 조치 항목 순번 중복을 거부하고, 요청과 항목을 한 트랜잭션으로 저장한다', async () => {
      const manager = stubManager();
      mockNumbering.next.mockResolvedValue('CA-20261030-001');
      mockCapaRepo.create.mockImplementation((v: any) => v);
      mockActionRepo.create.mockImplementation((v: any) => v);
      mockCapaRepo.save.mockImplementation(async (v: any) => v);
      mockActionRepo.save.mockImplementation(async (v: any) => v);

      await expect(target.create({ capaType: 'CORRECTIVE', title: 't', actions: [{ seq: 1, actionDesc: 'a' }, { seq: 1, actionDesc: 'b' }] } as any, 'CO', 'P01', 'user'))
        .rejects.toThrow('조치 항목 순번이 중복되었습니다: 1');
      expect(manager.transaction).not.toHaveBeenCalled();

      const saved = await target.create({ capaType: 'CORRECTIVE', title: 't', actions: [{ seq: 1, actionDesc: 'a' }] } as any, 'CO', 'P01', 'user');
      expect(manager.transaction).toHaveBeenCalledTimes(1);
      expect(saved.capaNo).toBe('CA-20261030-001');
      expect(mockActionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('목록의 기간은 시작일·종료일 중 하나만 와도 걸린다', async () => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]),
      };
      mockCapaRepo.createQueryBuilder.mockReturnValue(qb);
      await target.findAll({ fromDate: '2026-11-05T00:00:00.000Z' } as any, 'CO', 'P01');
      expect(qb.andWhere).toHaveBeenCalledWith('c.createdAt >= :fromDate', { fromDate: expect.any(Date) });
      expect(qb.andWhere).not.toHaveBeenCalledWith('c.createdAt <= :toDate', expect.anything());
    });
  });

  describe('update and actions', () => {
    it('rejects update when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('CA-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects addAction when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.addAction('CA-001', { seq: 1, actionDesc: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects updateAction when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'OTHER', plant: 'P01' } as any);

      await expect(
        target.updateAction('CA-001', 1, { actionDesc: 'x' } as any, 'user', 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.findOne).not.toHaveBeenCalled();
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('updates action only after CAPA tenant is validated', async () => {
      stubManager();
      const action = { capaId: 'CA-001', seq: 1, actionDesc: 'old' } as CAPAAction;
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'CO', plant: 'P01' } as any);
      mockActionRepo.findOne.mockResolvedValue(action);
      mockActionRepo.save.mockImplementation(async (value) => value as CAPAAction);

      const result = await target.updateAction(
        'CA-001',
        1,
        { actionDesc: 'new' } as any,
        'user',
        'CO',
        'P01',
      );

      expect(mockCapaRepo.findOne).toHaveBeenCalledWith({
        where: { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
      });
      expect(mockCapaRepo.update).toHaveBeenCalledWith(
        { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
        { updatedBy: 'user' },
      );
      expect(result.actionDesc).toBe('new');
    });
  });
});
