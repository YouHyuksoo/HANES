import { CanActivate, ExecutionContext, Injectable, INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MoldController } from './mold.controller';
import { MoldService } from '../services/mold.service';

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: 'tester@hanes.local',
      email: 'tester@hanes.local',
      company: 'CO',
      plant: 'P01',
    };
    return true;
  }
}

describe('MoldController (HTTP)', () => {
  let app: INestApplication;
  let moldServiceMock: {
    findById: jest.Mock;
    addUsage: jest.Mock;
    retire: jest.Mock;
  };

  beforeEach(async () => {
    moldServiceMock = {
      findById: jest.fn(),
      addUsage: jest.fn(),
      retire: jest.fn(),
    };

    // JwtAuthGuard는 APP_GUARD로 전역 등록되었으므로 같은 토큰으로 mock을 끼워 넣는다.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MoldController],
      providers: [
        { provide: MoldService, useValue: moldServiceMock },
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('passes tenant scope to findById', async () => {
    moldServiceMock.findById.mockResolvedValue({ moldCode: 'M-001' });

    await request(app.getHttpServer())
      .get('/equipment/molds/M-001')
      .expect(200);

    expect(moldServiceMock.findById).toHaveBeenCalledWith('M-001', 'CO', 'P01');
  });

  it('returns 404 when scoped mold is not found', async () => {
    moldServiceMock.findById.mockRejectedValue(new NotFoundException('Mold not found.'));

    await request(app.getHttpServer())
      .get('/equipment/molds/M-001')
      .expect(404);
  });

  it('passes tenant and user to addUsage', async () => {
    moldServiceMock.addUsage.mockResolvedValue({ ok: true });

    const payload = {
      usageDate: '2026-04-12T00:00:00.000Z',
      shotCount: 12,
      equipCode: 'EQ-001',
    };

    await request(app.getHttpServer())
      .post('/equipment/molds/M-001/usage')
      .send(payload)
      .expect(201);

    expect(moldServiceMock.addUsage).toHaveBeenCalledWith(
      'M-001',
      payload,
      'CO',
      'P01',
      'tester@hanes.local',
    );
  });

  it('passes tenant and user to retire', async () => {
    moldServiceMock.retire.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' });

    await request(app.getHttpServer())
      .patch('/equipment/molds/M-001/retire')
      .expect(200);

    expect(moldServiceMock.retire).toHaveBeenCalledWith(
      'M-001',
      'tester@hanes.local',
      'CO',
      'P01',
    );
  });
});
