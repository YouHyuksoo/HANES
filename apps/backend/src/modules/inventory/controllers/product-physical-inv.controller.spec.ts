import { CanActivate, ExecutionContext, Injectable, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ProductPhysicalInvController } from './product-physical-inv.controller';
import { ProductPhysicalInvService } from '../services/product-physical-inv.service';

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'tester@hanes.local', company: 'CO', plant: 'P01' };
    return true;
  }
}

describe('ProductPhysicalInvController (HTTP)', () => {
  let app: INestApplication;
  let serviceMock: {
    findStocks: jest.Mock;
    findHistory: jest.Mock;
    applyCount: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      findStocks: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
      findHistory: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
      applyCount: jest.fn().mockResolvedValue([{ ok: true }]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductPhysicalInvController],
      providers: [
        { provide: ProductPhysicalInvService, useValue: serviceMock },
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    jest.clearAllMocks();
  });

  it('passes tenant and actor to applyCount', async () => {
    const payload = {
      items: [{ stockId: 'WH::IT::LOT1', countedQty: 10 }],
      createdBy: 'manual-user',
    };

    await request(app.getHttpServer())
      .post('/inventory/product-physical-inv')
      .send(payload)
      .expect(201);

    expect(serviceMock.applyCount).toHaveBeenCalledWith(payload, 'CO', 'P01', 'manual-user');
  });

  it('uses authenticated user when createdBy is omitted', async () => {
    const payload = {
      items: [{ stockId: 'WH::IT::LOT1', countedQty: 10 }],
    };

    await request(app.getHttpServer())
      .post('/inventory/product-physical-inv')
      .send(payload)
      .expect(201);

    expect(serviceMock.applyCount).toHaveBeenCalledWith(payload, 'CO', 'P01', 'tester@hanes.local');
  });
});
