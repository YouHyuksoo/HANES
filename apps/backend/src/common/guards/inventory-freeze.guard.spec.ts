import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { InventoryFreezeGuard } from './inventory-freeze.guard';

@Controller('guard-test')
class GuardTestController {
  @Post('apply')
  @UseGuards(InventoryFreezeGuard)
  apply(@Body() body: any) {
    return { ok: true, body };
  }
}

describe('InventoryFreezeGuard (HTTP)', () => {
  let app: INestApplication;
  let dataSourceMock: { query: jest.Mock };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GuardTestController],
      providers: [
        InventoryFreezeGuard,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('blocks request when IN_PROGRESS inventory session exists', async () => {
    dataSourceMock.query.mockResolvedValue([{ CNT: 1 }]);

    await request(app.getHttpServer())
      .post('/guard-test/apply')
      .set('x-company', 'HANES')
      .set('x-plant', 'P01')
      .send({ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 })
      .expect(400);
  });

  it('allows request when no IN_PROGRESS session exists', async () => {
    dataSourceMock.query.mockResolvedValue([{ CNT: 0 }]);

    const res = await request(app.getHttpServer())
      .post('/guard-test/apply')
      .set('x-company', 'HANES')
      .set('x-plant', 'P01')
      .send({ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
    expect(dataSourceMock.query.mock.calls[0][1]).toEqual(['HANES', 'P01']);
  });

  it('uses JwtAuthGuard user tenant when tenant headers are absent', async () => {
    dataSourceMock.query.mockResolvedValue([{ CNT: 0 }]);
    const guard = app.get(InventoryFreezeGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          user: { company: 'HANES', plant: 'P01' },
          path: '/guard-test/apply',
        }),
      }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(dataSourceMock.query.mock.calls[0][1]).toEqual(['HANES', 'P01']);
  });

  it('blocks request when freeze status query throws', async () => {
    dataSourceMock.query.mockRejectedValue(new Error('db unavailable'));

    await request(app.getHttpServer())
      .post('/guard-test/apply')
      .set('x-company', 'HANES')
      .set('x-plant', 'P01')
      .send({ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 })
      .expect(400);
  });
});
