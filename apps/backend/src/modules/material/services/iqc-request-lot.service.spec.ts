import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { IqcHistoryService } from './iqc-history.service';
import { IqcRequestLotService } from './iqc-request-lot.service';

describe('IqcRequestLotService', () => {
  let target: IqcRequestLotService;
  let arrivalRepo: DeepMocked<Repository<MatArrival>>;
  let requestRepo: DeepMocked<Repository<IqcRequestLot>>;
  let lineRepo: DeepMocked<Repository<IqcRequestLotLine>>;
  let itemRepo: DeepMocked<Repository<ItemMaster>>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    arrivalRepo = createMock<Repository<MatArrival>>();
    requestRepo = createMock<Repository<IqcRequestLot>>();
    lineRepo = createMock<Repository<IqcRequestLotLine>>();
    itemRepo = createMock<Repository<ItemMaster>>();
    numbering = createMock<NumberingService>();
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    lineRepo.createQueryBuilder.mockReturnValue(qb as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcRequestLotService,
        { provide: getRepositoryToken(IqcRequestLot), useValue: requestRepo },
        { provide: getRepositoryToken(IqcRequestLotLine), useValue: lineRepo },
        { provide: getRepositoryToken(MatArrival), useValue: arrivalRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: NumberingService, useValue: numbering },
        { provide: IqcHistoryService, useValue: createMock<IqcHistoryService>() },
      ],
    }).compile();
    target = module.get(IqcRequestLotService);
  });

  it('시료 없이 구성하면 거절한다', async () => {
    await expect(
      target.create(
        { itemCode: 'P1', lines: [{ arrivalNo: 'A1', lineRole: 'REPRESENTED' }] },
        '40',
        '1000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('한 품목 입하를 시료+대표로 묶고 의뢰번호를 채번한다', async () => {
    numbering.next.mockResolvedValue('IQL20260915-0001');
    arrivalRepo.find
      .mockResolvedValueOnce([
        { arrivalNo: 'A1', itemCode: 'P1', qty: 100, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
        { arrivalNo: 'A2', itemCode: 'P1', qty: 200, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
      ])
      .mockResolvedValueOnce([
        { arrivalNo: 'A1', itemCode: 'P1', qty: 100, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
        { arrivalNo: 'A2', itemCode: 'P1', qty: 200, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
      ]);
    itemRepo.findOne.mockResolvedValue({ itemCode: 'P1', itemName: 'Cable' } as ItemMaster);
    requestRepo.create.mockImplementation((v) => v as IqcRequestLot);
    requestRepo.save.mockImplementation(async (v) => v as IqcRequestLot);
    lineRepo.create.mockImplementation((v) => v as IqcRequestLotLine);
    lineRepo.save.mockResolvedValue([] as never);

    const saved = await target.create(
      {
        itemCode: 'P1',
        lines: [
          { arrivalNo: 'A1', lineRole: 'SAMPLE' },
          { arrivalNo: 'A2', lineRole: 'REPRESENTED' },
        ],
      },
      '40',
      '1000',
    );
    expect(saved.requestNo).toBe('IQL20260915-0001');
    expect(saved.lotQty).toBe(300);
    expect(saved.lines).toHaveLength(2);
  });
});
