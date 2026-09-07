import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { RepairTargetService } from './repair-target.service';

describe('RepairTargetService', () => {
  let qr: DeepMocked<QueryRunner>;
  let service: RepairTargetService;
  let label: Partial<FgLabel>;
  let duplicate: Partial<RepairOrder> | null;
  let product: Partial<ItemMaster>;
  let material: Partial<ItemMaster>;
  let process: Partial<ProcessMaster> | null;
  let worker: Partial<WorkerMaster> | null;
  const draft = { itemCode: 'FG', qty: 1, fgBarcode: 'FG001', prdUid: 'FG001', sourceProcess: 'VISUAL', workerId: 'W' };
  const order = { ...draft, seq: 71, repairDate: new Date('2026-09-05'), company: 'C', plant: 'P' } as RepairOrder;

  beforeEach(() => {
    qr = createMock<QueryRunner>();
    service = new RepairTargetService();
    label = { fgBarcode: 'FG001', itemCode: 'FG', status: 'VISUAL_FAIL', company: 'C', plant: 'P', boxNo: null, replacedBy: null };
    duplicate = null;
    product = { itemCode: 'FG', itemType: 'FINISHED', useYn: 'Y' };
    material = { itemCode: 'RAW', itemType: 'RAW_MATERIAL', useYn: 'Y' };
    process = { processCode: 'VISUAL', useYn: 'Y' };
    worker = { workerCode: 'W', useYn: 'Y' };
    qr.manager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === FgLabel) return label as any;
      if (entity === RepairOrder) return duplicate as any;
      if (entity === ItemMaster) return (options.where.itemCode === 'FG' ? product : material) as any;
      if (entity === ProcessMaster) return process as any;
      if (entity === WorkerMaster) return worker as any;
      return null;
    });
  });

  it('accepts an active product, catalog references, and an unpacked visual-fail label', async () => {
    await service.validateDraftInTx(qr, { ...draft, usedParts: [{ itemCode: 'RAW', qty: 2 }] }, 'C', 'P');
    expect(qr.manager.findOne).toHaveBeenCalledWith(ItemMaster, expect.objectContaining({ where: { itemCode: 'FG', company: 'C', plant: 'P' } }));
    expect(qr.manager.update).not.toHaveBeenCalled();
  });

  it('rejects a non-product or inactive product', async () => {
    product.itemType = 'RAW_MATERIAL';
    await expect(service.validateDraftInTx(qr, draft, 'C', 'P')).rejects.toThrow();
    product.itemType = 'FINISHED'; product.useYn = 'N';
    await expect(service.validateDraftInTx(qr, draft, 'C', 'P')).rejects.toThrow();
  });

  it('rejects inactive process and worker references', async () => {
    process = null;
    await expect(service.validateDraftInTx(qr, draft, 'C', 'P')).rejects.toThrow();
    process = { useYn: 'Y' }; worker = null;
    await expect(service.validateDraftInTx(qr, draft, 'C', 'P')).rejects.toThrow();
  });

  it('rejects coded material parts that are inactive or are products', async () => {
    material.itemType = 'FINISHED';
    await expect(service.validateDraftInTx(qr, { ...draft, usedParts: [{ itemCode: 'RAW', qty: 1 }] }, 'C', 'P')).rejects.toThrow();
  });

  it.each([
    { qty: 0 }, { qty: 2 }, { prdUid: 'OTHER' }, { fgBarcode: 'X'.repeat(31) },
  ])('rejects invalid FG quantities and identifiers: %j', async (invalid) => {
    await expect(service.validateDraftInTx(qr, { ...draft, ...invalid }, 'C', 'P')).rejects.toThrow();
  });

  it.each([
    { itemCode: 'OTHER' }, { status: 'VISUAL_PASS' }, { boxNo: 'BOX' }, { replacedBy: 'NEW' },
  ])('rejects a mismatched, processed, packed, or replaced label: %j', async (invalid) => {
    Object.assign(label, invalid);
    await expect(service.validateDraftInTx(qr, draft, 'C', 'P')).rejects.toThrow();
  });

  it('allows aggregate repair without serials and refuses arbitrary manual serials', async () => {
    await expect(service.validateDraftInTx(qr, { itemCode: 'FG', qty: 3 }, 'C', 'P')).resolves.toBeUndefined();
    await expect(service.validateDraftInTx(qr, { itemCode: 'FG', qty: 3, prdUid: 'SG001' }, 'C', 'P')).rejects.toThrow();
  });

  it('serializes starts on the label and refuses another active repair of the same barcode', async () => {
    duplicate = { ...order, seq: 72, status: 'IN_REPAIR' };
    await expect(service.validateStartInTx(qr, order)).rejects.toThrow();
    expect(qr.manager.findOne).toHaveBeenCalledWith(FgLabel, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(qr.manager.findOne).toHaveBeenCalledWith(RepairOrder, expect.objectContaining({ where: expect.objectContaining({ fgBarcode: 'FG001', status: 'IN_REPAIR', company: 'C', plant: 'P' }) }));
  });

  it.each([
    { disposition: 'SCRAP', pass: false, expected: { status: 'VOIDED', inspectPassYn: 'N' } },
    { disposition: 'REINSPECT', pass: true, expected: { status: 'VISUAL_PASS', inspectPassYn: 'Y' } },
    { disposition: 'REUSE', pass: false, expected: { status: 'ISSUED', inspectPassYn: null } },
  ])('finishes label state consistently: $disposition', async ({ disposition, pass, expected }) => {
    await service.finishLabelInTx(qr, { ...order, disposition }, pass);
    expect(qr.manager.update).toHaveBeenCalledWith(FgLabel, { fgBarcode: 'FG001', company: 'C', plant: 'P' }, expect.objectContaining(expected));
  });

  it('rejects completion when the label has entered packaging meanwhile', async () => {
    label.boxNo = 'BOX001';
    await expect(service.finishLabelInTx(qr, { ...order, disposition: 'REUSE' }, false)).rejects.toThrow();
    expect(qr.manager.update).not.toHaveBeenCalled();
  });
});
