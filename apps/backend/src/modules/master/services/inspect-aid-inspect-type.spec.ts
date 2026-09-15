import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInspectAidDto, InspectAidQueryDto } from '../dto/inspect-aid.dto';

describe('CreateInspectAidDto 검사유형 필드', () => {
  it('CONTINUITY / TERMINAL 을 허용한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본', inspectType: 'TERMINAL', requiredYn: 'Y', sortOrder: 3,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('검사유형을 비우면 전 검사유형 공통으로 허용한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('알 수 없는 검사유형은 거부한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본', inspectType: 'XRAY',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'inspectType')).toBe(true);
  });

  it('표시순서는 음수를 거부한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본', sortOrder: -1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('목록 조회에 검사유형 필터를 허용한다', async () => {
    const dto = plainToInstance(InspectAidQueryDto, { inspectType: 'CONTINUITY' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'inspectType')).toBe(false);
  });
});
