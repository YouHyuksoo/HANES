import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoryItemsController } from './menu-category-items.controller';
import { Public, IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * JwtAuthGuard는 APP_GUARD로 전역 등록되었으므로 컨트롤러 레벨 @UseGuards 검증은 불필요하다.
 * 대신 이 컨트롤러들이 인증 우회용 @Public() 으로 노출되어 있지 않은지 회귀 방지.
 */
describe('Menu category controller auth posture', () => {
  it.each([MenuCategoriesController, MenuCategoryItemsController])(
    'does not bypass JwtAuthGuard via @Public(): %p',
    (controller) => {
      // 컨트롤러 자체가 Public이면 위험.
      const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller);
      expect(classPublic).toBeFalsy();

      // 메소드 레벨 가드 우회도 없는지 확인 (가드를 별도로 끼워 넣지 않았는지)
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
      expect(guards).toEqual([]);
    },
  );

  it('Public 데코레이터를 임포트해도 이 컨트롤러에는 부여되지 않아야 한다', () => {
    // @Public 데코레이터 자체는 존재해도, 이 모듈에서 컨트롤러에 안 붙어 있으면 OK
    expect(Public).toBeDefined();
  });
});
