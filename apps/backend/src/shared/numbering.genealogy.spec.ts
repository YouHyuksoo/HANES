import { NumberingService } from './numbering.service';

describe('NumberingService.nextGenealogyId', () => {
  it('SEQ_PROD_GENEALOGY.NEXTVAL을 조회해 number를 반환한다', async () => {
    const dataSource: any = {
      manager: { query: jest.fn().mockResolvedValue([{ NEXT_SEQ: 42 }]) },
    };
    const svc = new NumberingService({} as any, {} as any, dataSource);
    const id = await svc.nextGenealogyId();
    expect(id).toBe(42);
    expect(dataSource.manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_PROD_GENEALOGY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
  });
});
