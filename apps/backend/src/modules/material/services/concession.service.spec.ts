import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ConcessionService } from './concession.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';

describe('ConcessionService', () => {
  let service: ConcessionService;
  let lotRepo: jest.Mocked<Partial<Repository<MatLot>>>;
  let receivingRepo: jest.Mocked<Partial<Repository<MatReceiving>>>;
  let partRepo: jest.Mocked<Partial<Repository<ItemMaster>>>;
  let workerRepo: jest.Mocked<Partial<Repository<WorkerMaster>>>;

  beforeEach(async () => {
    lotRepo = {
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    receivingRepo = {
      findOne: jest.fn(),
    };
    partRepo = {
      find: jest.fn(),
    };
    workerRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcessionService,
        { provide: getRepositoryToken(MatLot), useValue: lotRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: receivingRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
        { provide: getRepositoryToken(WorkerMaster), useValue: workerRepo },
      ],
    }).compile();

    service = module.get(ConcessionService);
  });

  it('특채 처리 시 선택한 작업자 코드를 LOT에 저장한다', async () => {
    lotRepo.find!.mockResolvedValue([
      {
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'FAIL',
        company: 'C1',
        plant: 'P1',
      } as MatLot,
    ]);
    workerRepo.findOne!.mockResolvedValue({
      workerCode: 'W001',
      workerName: '홍길동',
      useYn: 'Y',
      company: 'C1',
      plant: 'P1',
    } as WorkerMaster);

    const result = await service.apply(
      {
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        specialAcceptWorkerCode: 'W001',
      },
      'C1',
      'P1',
    );

    expect(workerRepo.findOne).toHaveBeenCalledWith({
      where: { workerCode: 'W001', useYn: 'Y', company: 'C1', plant: 'P1' },
    });
    expect(lotRepo.update).toHaveBeenCalledWith(
      { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'FAIL', company: 'C1', plant: 'P1' },
      { specialAcceptYn: 'Y', specialAcceptWorkerCode: 'W001' },
    );
    expect(result).toEqual(expect.objectContaining({ specialAcceptWorkerCode: 'W001' }));
  });

  describe('findTargets (목록 기본 조건)', () => {
    const buildQb = () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      lotRepo.createQueryBuilder!.mockReturnValue(qb as unknown as SelectQueryBuilder<MatLot>);
      return qb;
    };

    it('status 미지정은 미특채 그룹(특채 시리얼 수 < 전체 시리얼 수) HAVING 조건으로 해석한다', async () => {
      const qb = buildQb();

      await service.findTargets({}, 'C1', 'P1');

      expect(qb.having).toHaveBeenCalledWith("SUM(CASE WHEN lot.specialAcceptYn = 'Y' THEN 1 ELSE 0 END) < COUNT(*)");
      expect(qb.andWhere).not.toHaveBeenCalledWith('lot.recvDate >= :recvDateFrom', expect.anything());
    });

    it('ACCEPTED + fromDate/toDate 는 특채완료 HAVING 과 입하일 구간(종료일 당일 포함)을 함께 반영한다', async () => {
      const qb = buildQb();

      await service.findTargets({ status: 'ACCEPTED', fromDate: '2026-09-01', toDate: '2026-09-03' }, 'C1', 'P1');

      expect(qb.having).toHaveBeenCalledWith("SUM(CASE WHEN lot.specialAcceptYn = 'Y' THEN 1 ELSE 0 END) >= COUNT(*)");
      const fromCall = qb.andWhere.mock.calls.find((c) => c[0] === 'lot.recvDate >= :recvDateFrom');
      const toCall = qb.andWhere.mock.calls.find((c) => c[0] === 'lot.recvDate <= :recvDateTo');
      expect(fromCall).toBeDefined();
      expect(toCall).toBeDefined();
      const to = (toCall?.[1] as { recvDateTo: Date }).recvDateTo;
      expect(to.getDate()).toBe(3);
      expect(to.getHours()).toBe(23);
    });

    it('ALL 은 HAVING 없이 전 그룹을 조회한다', async () => {
      const qb = buildQb();

      await service.findTargets({ status: 'ALL', fromDate: '2026-09-03', toDate: '2026-09-03' }, 'C1', 'P1');

      expect(qb.having).not.toHaveBeenCalled();
    });
  });

  it('특채 처리 작업자를 선택하지 않으면 저장하지 않는다', async () => {
    await expect(
      service.apply({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as any, 'C1', 'P1'),
    ).rejects.toThrow(BadRequestException);

    expect(lotRepo.find).not.toHaveBeenCalled();
    expect(lotRepo.update).not.toHaveBeenCalled();
  });
});
