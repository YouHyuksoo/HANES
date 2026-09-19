import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CarrierFlowService } from './carrier-flow.service';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

const COMPANY = '40';
const PLANT = '1000';

describe('CarrierFlowService', () => {
  let service: CarrierFlowService;
  const carrierRepo = { findOne: jest.fn() };
  const equipRepo = { findOne: jest.fn(), update: jest.fn() };
  const jobOrderRepo = { findOne: jest.fn() };
  const routingRepo = { findOne: jest.fn(), find: jest.fn() };
  const itemRepo = { find: jest.fn().mockResolvedValue([]) };
  const manager = { query: jest.fn(), update: jest.fn(), findOne: jest.fn() };
  const tx = { run: jest.fn(async (cb: (qr: unknown) => Promise<unknown>) => cb({ manager })) };
  const numbering = { nextCarrierSlipNo: jest.fn().mockResolvedValue('CS260919-00001') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CarrierFlowService,
        { provide: getRepositoryToken(CarrierMaster), useValue: carrierRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipRepo },
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: routingRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
      ],
    }).compile();
    service = module.get(CarrierFlowService);
    jest.spyOn(service, 'getContents').mockResolvedValue([]);
  });

  it('select: 미등록 대차는 404', async () => {
    carrierRepo.findOne.mockResolvedValue(null);
    await expect(service.select('CR-X', 'EQ1', COMPANY, PLANT)).rejects.toThrow(NotFoundException);
  });

  it('select: 사용중지 대차는 400, 정상이면 설비 CUR_CARRIER_NO 갱신', async () => {
    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'N', capacity: null });
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ1', processCode: 'P10', currentJobOrderId: 'W1' });
    await expect(service.select('CR-001', 'EQ1', COMPANY, PLANT)).rejects.toThrow(BadRequestException);

    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'Y', capacity: null });
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'W1', itemCode: 'SFG-1', routingCode: 'R1' });
    routingRepo.find.mockResolvedValue([]);
    await service.select('CR-001', 'EQ1', COMPANY, PLANT);
    expect(equipRepo.update).toHaveBeenCalledWith(
      { equipCode: 'EQ1', company: COMPANY, plant: PLANT },
      { curCarrierNo: 'CR-001' },
    );
  });

  it('issueSlip: 빈 대차는 400, 이미 전표가 있으면 같은 번호로 재발행', async () => {
    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'Y', capacity: null });
    (service.getContents as jest.Mock).mockResolvedValue([]);
    await expect(service.issueSlip('CR-001', 'tester', COMPANY, PLANT)).rejects.toThrow(/빈 대차/);

    (service.getContents as jest.Mock).mockResolvedValue([
      { kind: 'SG', barcode: 'SG1', itemCode: 'SFG-1', itemName: null, orderNo: 'W1', qty: 10, loadedAt: new Date(), slipNo: 'CS260918-00007', issueProcessCode: 'P10' },
    ]);
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'W1', itemCode: 'SFG-1', routingCode: 'R1' });
    routingRepo.find.mockResolvedValue([{ seq: 10, processCode: 'P10', processName: '절단', useYn: 'Y', executionType: 'IN_HOUSE' }, { seq: 20, processCode: 'P20', processName: '압착', useYn: 'Y', executionType: 'IN_HOUSE' }]);
    const slip = await service.issueSlip('CR-001', 'tester', COMPANY, PLANT);
    expect(slip.slipNo).toBe('CS260918-00007');
    expect(slip.reprint).toBe(true);
    expect(slip.toProcessCode).toBe('P20');
    expect(numbering.nextCarrierSlipNo).not.toHaveBeenCalled();
  });
});
