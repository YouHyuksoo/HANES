import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { WorkCalendarService } from './work-calendar.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('WorkCalendarService', () => {
  let target: WorkCalendarService;
  let calendarRepo: DeepMocked<Repository<WorkCalendar>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    calendarRepo = createMock<Repository<WorkCalendar>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkCalendarService,
        { provide: getRepositoryToken(WorkCalendar), useValue: calendarRepo },
        { provide: getRepositoryToken(WorkCalendarDay), useValue: createMock<Repository<WorkCalendarDay>>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(WorkCalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds a calendar within tenant only', async () => {
    calendarRepo.findOne.mockResolvedValue({ calendarId: 'CAL-2026', company: 'C1', plant: 'P1' } as WorkCalendar);

    await target.findById('CAL-2026', 'C1', 'P1');

    expect(calendarRepo.findOne).toHaveBeenCalledWith({
      where: { calendarId: 'CAL-2026', company: 'C1', plant: 'P1' },
    });
  });

  it('throws when tenant scoped calendar is missing', async () => {
    calendarRepo.findOne.mockResolvedValue(null);

    await expect(target.findById('CAL-2026', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('checks duplicate calendar id within tenant when creating', async () => {
    calendarRepo.findOne.mockResolvedValue(null);
    calendarRepo.create.mockReturnValue({ calendarId: 'CAL-2026', company: 'C1', plant: 'P1' } as WorkCalendar);
    calendarRepo.save.mockResolvedValue({ calendarId: 'CAL-2026', company: 'C1', plant: 'P1' } as WorkCalendar);

    await target.create({ calendarId: 'CAL-2026', calendarYear: '2026' } as any, 'C1', 'P1');

    expect(calendarRepo.findOne).toHaveBeenCalledWith({
      where: { calendarId: 'CAL-2026', company: 'C1', plant: 'P1' },
    });
    expect(calendarRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: 'CAL-2026',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('updates a calendar within tenant and strips key columns from payload', async () => {
    calendarRepo.findOne.mockResolvedValue({ calendarId: 'CAL-2026', status: 'DRAFT', company: 'C1', plant: 'P1' } as WorkCalendar);
    calendarRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('CAL-2026', {
      calendarId: 'OTHER',
      calendarYear: '2027',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(calendarRepo.update).toHaveBeenCalledWith(
      { calendarId: 'CAL-2026', company: 'C1', plant: 'P1' },
      { calendarYear: '2027' },
    );
  });

  it('does not pass arbitrary fields from update payload to the repository', async () => {
    calendarRepo.findOne.mockResolvedValue({ calendarId: 'CAL-2026', status: 'DRAFT', company: 'C1', plant: 'P1' } as WorkCalendar);
    calendarRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('CAL-2026', {
      calendarYear: '2027',
      externalSource: 'ERP',
    } as any, 'C1', 'P1');

    expect(calendarRepo.update).toHaveBeenCalledWith(
      { calendarId: 'CAL-2026', company: 'C1', plant: 'P1' },
      { calendarYear: '2027' },
    );
  });

  it('deletes a calendar and its days within tenant only', async () => {
    const manager = createMock<Pick<Repository<WorkCalendar>, 'delete'>>();
    calendarRepo.findOne.mockResolvedValue({ calendarId: 'CAL-2026', status: 'DRAFT', company: 'C1', plant: 'P1' } as WorkCalendar);
    tx.run.mockImplementation(async (callback) => callback({ manager } as any));

    await target.delete('CAL-2026', 'C1', 'P1');

    expect(manager.delete).toHaveBeenNthCalledWith(1, WorkCalendarDay, {
      calendarId: 'CAL-2026',
      company: 'C1',
      plant: 'P1',
    });
    expect(manager.delete).toHaveBeenNthCalledWith(2, WorkCalendar, {
      calendarId: 'CAL-2026',
      company: 'C1',
      plant: 'P1',
    });
  });

  it('confirms and unconfirms a calendar within tenant only', async () => {
    calendarRepo.findOne.mockResolvedValue({ calendarId: 'CAL-2026', company: 'C1', plant: 'P1' } as WorkCalendar);

    await target.confirm('CAL-2026', 'C1', 'P1');
    await target.unconfirm('CAL-2026', 'C1', 'P1');

    expect(calendarRepo.update).toHaveBeenNthCalledWith(1, {
      calendarId: 'CAL-2026',
      company: 'C1',
      plant: 'P1',
    }, { status: 'CONFIRMED' });
    expect(calendarRepo.update).toHaveBeenNthCalledWith(2, {
      calendarId: 'CAL-2026',
      company: 'C1',
      plant: 'P1',
    }, { status: 'DRAFT' });
  });
});
