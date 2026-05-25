import { ErpMaterialController } from './erp-material.controller';
import { ErpMaterialService } from '../services/erp-material.service';

describe('ErpMaterialController', () => {
  let controller: ErpMaterialController;
  let service: jest.Mocked<ErpMaterialService>;

  beforeEach(() => {
    service = {
      importPurchaseOrder: jest.fn(),
      syncPurchaseOrders: jest.fn(),
      exportReceiving: jest.fn(),
      exportReturn: jest.fn(),
      exportIssue: jest.fn(),
      exportAdjustment: jest.fn(),
      retryFailed: jest.fn(),
      getTodayStats: jest.fn(),
    } as unknown as jest.Mocked<ErpMaterialService>;

    controller = new ErpMaterialController(service);
  });

  it('passes tenant to failed ERP retry', async () => {
    service.retryFailed.mockResolvedValue([] as any);

    await controller.retryFailed('C1', 'P1');

    expect(service.retryFailed).toHaveBeenCalledWith('C1', 'P1');
  });

  it('passes tenant to ERP stats', async () => {
    service.getTodayStats.mockResolvedValue({ total: 0 } as any);

    await controller.getStats('C1', 'P1');

    expect(service.getTodayStats).toHaveBeenCalledWith('C1', 'P1');
  });
});
