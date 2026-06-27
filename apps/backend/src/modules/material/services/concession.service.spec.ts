import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  it('특채 처리 작업자를 선택하지 않으면 저장하지 않는다', async () => {
    await expect(
      service.apply({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as any, 'C1', 'P1'),
    ).rejects.toThrow(BadRequestException);

    expect(lotRepo.find).not.toHaveBeenCalled();
    expect(lotRepo.update).not.toHaveBeenCalled();
  });
});
