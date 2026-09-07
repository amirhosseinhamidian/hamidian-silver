import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  it('marks only storefront catalog handlers as public', () => {
    const prototype = CatalogController.prototype;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicCategories)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicBrands)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicProducts)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.getPublicProduct)).toBe(true);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listProducts)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.createProduct)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.getProduct)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateProduct)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateProductStatus)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.uploadProductMedia)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.reorderProductMedia)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateProductMedia)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.removeProductMedia)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.createProductVariant)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateProductVariant)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateSize)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.updateCategory)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.archiveCategory)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.uploadCategoryImage)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.removeCategoryImage)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.uploadMedia)).toBeUndefined();
  });
});
