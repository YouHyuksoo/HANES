import { NumberingService } from './numbering.service';

describe('NumberingService.nextSgLabel', () => {
  it('SG + YYMMDD + - + 5자리 포맷으로 채번한다', async () => {
    const dataSource: any = {
      manager: { query: jest.fn().mockResolvedValue([{ NEXT_SEQ: 7 }]) },
    };
    const svc = new NumberingService({} as any, {} as any, dataSource);
    const no = await svc.nextSgLabel();
    expect(no).toMatch(/^SG\d{6}-00007$/);
    expect(dataSource.manager.query).toHaveBeenCalledWith(
      'SELECT SEQ_SG_LABEL.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
  });
});
