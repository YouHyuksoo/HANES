import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoryItemsController } from './menu-category-items.controller';

describe('Menu category controller guard metadata', () => {
  it.each([MenuCategoriesController, MenuCategoryItemsController])(
    'applies JwtAuthGuard at controller level: %p',
    (controller) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];

      expect(guards).toContain(JwtAuthGuard);
    },
  );
});
