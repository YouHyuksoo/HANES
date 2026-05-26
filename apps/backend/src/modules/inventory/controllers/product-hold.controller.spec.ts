import { CanActivate, ExecutionContext, Injectable, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ProductHoldController } from './product-hold.controller';
import { ProductHoldService } from '../services/product-hold.service';

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'tester@hanes.local', company: 'CO', plant: 'P01' };
    return true;
  }
}

describe('ProductHoldController (HTTP)', () => {
  let app: INestApplication;
  let serviceMock: { hold: jest.Mock; release: jest.Mock; findAll: jest.Mock };

  beforeEach(async () => {
    serviceMock = {
      hold: jest.fn(),
      release: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductHoldController],
      providers: [
        { provide: ProductHoldService, useValue: serviceMock },
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

  it('passes tenant and user to hold', async () => {
    serviceMock.hold.mockResolvedValue({ status: 'HOLD' });
    const payload = { stockId: 'WH::IT::LOT1', reason: 'QC hold' };

    await request(app.getHttpServer())
      .post('/inventory/product-hold/hold')
      .send(payload)
      .expect(201);

    expect(serviceMock.hold).toHaveBeenCalledWith(payload, 'CO', 'P01', 'tester@hanes.local');
  });

  it('passes tenant and user to release', async () => {
    serviceMock.release.mockResolvedValue({ status: 'NORMAL' });
    const payload = { stockId: 'WH::IT::LOT1', reason: 'release' };

    await request(app.getHttpServer())
      .post('/inventory/product-hold/release')
      .send(payload)
      .expect(201);

    expect(serviceMock.release).toHaveBeenCalledWith(payload, 'CO', 'P01', 'tester@hanes.local');
  });
});
