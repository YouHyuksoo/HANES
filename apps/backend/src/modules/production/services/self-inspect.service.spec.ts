import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { SelfInspectItem } from '../../../entities/self-inspect-item.entity';
import { SelfInspectResult } from '../../../entities/self-inspect-result.entity';
import { SelfInspectService } from './self-inspect.service';

describe('SelfInspectService', () => {
  let service: SelfInspectService;
  let itemRepo: DeepMocked<Repository<SelfInspectItem>>;
  let resultRepo: DeepMocked<Repository<SelfInspectResult>>;

  beforeEach(async () => {
    itemRepo = createMock<Repository<SelfInspectItem>>();
    resultRepo = createMock<Repository<SelfInspectResult>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfInspectService,
        { provide: getRepositoryToken(SelfInspectItem), useValue: itemRepo },
        { provide: getRepositoryToken(SelfInspectResult), useValue: resultRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(SelfInspectService);
  });

  afterEach(() => jest.clearAllMocks());

  it('checks pending delegate within tenant only', async () => {
    resultRepo.count.mockResolvedValue(1);

    const result = await service.hasPendingDelegate('JO-001', 'C1', 'P1');

    expect(result).toEqual({ hasPending: true, pendingCount: 1 });
    expect(resultRepo.count).toHaveBeenCalledWith({
      where: { orderNo: 'JO-001', inspectMethod: 'DELEGATE', status: 'PENDING', company: 'C1', plant: 'P1' },
    });
  });

  it('finds self inspect results by order within tenant only', async () => {
    resultRepo.find.mockResolvedValue([]);

    await service.findResults('JO-001', 'C1', 'P1');

    expect(resultRepo.find).toHaveBeenCalledWith({
      where: { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('updates result status within tenant only', async () => {
    const row = { id: 'R1', status: 'PENDING', company: 'C1', plant: 'P1' } as SelfInspectResult;
    resultRepo.findOne.mockResolvedValue(row);
    resultRepo.update.mockResolvedValue({ affected: 1 } as never);

    const updated = await service.updateResultStatus('R1', 'PASS', 'ok', 12, 'C1', 'P1');

    expect(resultRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'R1', company: 'C1', plant: 'P1' },
    });
    expect(resultRepo.update).toHaveBeenCalledWith(
      { id: 'R1', company: 'C1', plant: 'P1', status: 'PENDING' },
      expect.objectContaining({ status: 'PASS', remark: 'ok', measureValue: 12 }),
    );
    expect(updated.status).toBe('PASS');
  });

  it('rejects status change of an already judged result', async () => {
    resultRepo.findOne.mockResolvedValue({ id: 'R1', status: 'PASS', company: 'C1', plant: 'P1' } as SelfInspectResult);

    await expect(service.updateResultStatus('R1', 'FAIL', undefined, undefined, 'C1', 'P1'))
      .rejects.toThrow(BadRequestException);
    expect(resultRepo.update).not.toHaveBeenCalled();
  });

  it('rejects when another request judged the result first (0 rows updated)', async () => {
    resultRepo.findOne.mockResolvedValue({ id: 'R1', status: 'PENDING', company: 'C1', plant: 'P1' } as SelfInspectResult);
    resultRepo.update.mockResolvedValue({ affected: 0 } as never);

    await expect(service.updateResultStatus('R1', 'PASS', undefined, undefined, 'C1', 'P1'))
      .rejects.toThrow(BadRequestException);
  });

  it('throws when result status target is missing in tenant', async () => {
    resultRepo.findOne.mockResolvedValue(null);

    await expect(service.updateResultStatus('R404', 'PASS', undefined, undefined, 'C1', 'P1'))
      .rejects.toThrow(NotFoundException);
  });

  it('keeps tenant and id columns from the matched self inspect item when update payload contains them', async () => {
    const item = { id: 'SI-001', itemName: 'Old', company: 'C1', plant: 'P1' } as SelfInspectItem;
    itemRepo.findOne.mockResolvedValue(item);
    itemRepo.save.mockImplementation(async (value) => value as SelfInspectItem);

    const result = await service.updateItem('SI-001', {
      id: 'SI-999',
      itemName: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(result).toEqual(expect.objectContaining({
      id: 'SI-001',
      itemName: 'New',
      company: 'C1',
      plant: 'P1',
    }));
  });
});
