import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculatePlatingPriceToman } from '../../common/plating-price';
import { Prisma } from '../../generated/prisma/client';
import { ProductStatus, SeoRedirectEntityType, SizeMode } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { recordSeoSlugChange } from '../seo/seo-redirects.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { AdminCatalogProductsQueryDto } from './dto/admin-catalog-products-query.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { PublicCatalogQueryDto, PublicCatalogSort } from './dto/public-catalog-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PublicMediaUrlService } from './public-media-url.service';
import { normalizeCatalogSearch } from './catalog-search';

type PublicProductSearchRow = {
  id: string;
  availableQuantity: bigint;
  total: bigint;
};

type PublicProductSuggestionRow = {
  id: string;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async createBrand(dto: CreateBrandDto) {
    if (dto.imageId) {
      await this.requireMedia(dto.imageId);
    }

    if (dto.originCountryId) {
      await this.requireCountry(dto.originCountryId);
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageId: dto.imageId,
        originCountryId: dto.originCountryId,
        isActive: dto.isActive ?? true,
      },
      include: {
        image: true,
        originCountry: true,
      },
    });
  }

  async createCountry(dto: CreateCountryDto) {
    if (dto.imageId) {
      await this.requireMedia(dto.imageId);
    }

    return this.prisma.country.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        isoCode: dto.isoCode.toUpperCase(),
        imageId: dto.imageId,
        isActive: dto.isActive ?? true,
      },
      include: {
        image: true,
      },
    });
  }

  async createProduct(dto: CreateProductDto) {
    this.validateProductShape(dto);
    const attributes = this.normalizeProductAttributes(dto.attributes);

    return this.prisma.$transaction(async (transaction) => {
      if (dto.brandId) {
        const brand = await transaction.brand.findFirst({
          where: {
            id: dto.brandId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!brand) {
          throw new NotFoundException('Brand was not found.');
        }
      }

      if (dto.countryId) {
        const country = await transaction.country.findFirst({
          where: {
            id: dto.countryId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!country) {
          throw new NotFoundException('Country was not found.');
        }
      }

      if (dto.seoOgMediaId) {
        await this.requireSeoImage(transaction, dto.seoOgMediaId);
      }

      const categoryIds = dto.categoryIds ?? [];

      if (categoryIds.length > 0) {
        const categories = await transaction.category.findMany({
          where: {
            id: { in: categoryIds },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (categories.length !== categoryIds.length) {
          throw new NotFoundException('One or more categories were not found.');
        }
      }

      const sizeIds = [
        ...new Set(
          dto.variants
            .map((variant) => variant.sizeId)
            .filter((sizeId): sizeId is string => Boolean(sizeId)),
        ),
      ];

      if (sizeIds.length > 0) {
        const sizes = await transaction.size.findMany({
          where: {
            id: { in: sizeIds },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (sizes.length !== sizeIds.length) {
          throw new NotFoundException('One or more sizes were not found.');
        }
      }

      const productMedia = dto.media ?? [];
      const mediaIds = productMedia.map(({ mediaId }) => mediaId);

      if (mediaIds.length > 0) {
        const media = await transaction.media.findMany({
          where: {
            id: { in: mediaIds },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (media.length !== mediaIds.length) {
          throw new NotFoundException('One or more media items were not found.');
        }
      }

      if (
        dto.compareAtPriceToman !== undefined &&
        dto.salePriceToman !== undefined &&
        dto.compareAtPriceToman <= dto.salePriceToman
      ) {
        throw new BadRequestException('Compare price must be greater than sale price.');
      }

      if (
        dto.compareAtPriceToman !== undefined &&
        dto.salePriceToman !== undefined &&
        dto.compareAtPriceToman <= dto.salePriceToman
      ) {
        throw new BadRequestException('Compare price must be greater than sale price.');
      }

      const product = await transaction.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          salePriceToman: dto.salePriceToman,
          compareAtPriceToman: dto.compareAtPriceToman,
          shortDescription: dto.shortDescription,
          description: dto.description,
          seoTitle: dto.seoTitle?.trim() || null,
          seoDescription: dto.seoDescription?.trim() || null,
          seoCanonicalPath: dto.seoCanonicalPath?.trim() || null,
          seoNoIndex: dto.seoNoIndex ?? false,
          seoOgMediaId: dto.seoOgMediaId,
          status: dto.status ?? ProductStatus.DRAFT,
          sizeMode: dto.sizeMode,
          brandId: dto.brandId,
          countryId: dto.countryId,
        },
        select: {
          id: true,
        },
      });

      if (categoryIds.length > 0) {
        await transaction.productCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            productId: product.id,
            categoryId,
          })),
        });
      }

      await transaction.productVariant.createMany({
        data: dto.variants.map((variant) => ({
          productId: product.id,
          sizeId: variant.sizeId,
          sku: variant.sku,
          name: variant.name,
          weightGrams: variant.weightGrams,
          isActive: variant.isActive ?? true,
        })),
      });

      if (productMedia.length > 0) {
        await transaction.productMedia.createMany({
          data: productMedia.map((item) => ({
            productId: product.id,
            mediaId: item.mediaId,
            sortOrder: item.sortOrder ?? 0,
            isPrimary: item.isPrimary ?? false,
            altText: item.altText,
          })),
        });
      }

      if (attributes.length > 0) {
        await transaction.productAttribute.createMany({
          data: attributes.map((attribute) => ({
            productId: product.id,
            ...attribute,
          })),
        });
      }

      return transaction.product.findUniqueOrThrow({
        where: {
          id: product.id,
        },
        include: {
          brand: true,
          country: true,
          categories: {
            include: {
              category: {
                include: {
                  image: true,
                },
              },
            },
          },
          variants: {
            include: {
              size: true,
            },
          },
          media: {
            orderBy: {
              sortOrder: 'asc',
            },
            include: {
              media: true,
            },
          },
          attributes: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          seoOgMedia: true,
        },
      });
    });
  }

  listBrands() {
    return this.prisma.brand.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        image: true,
        originCountry: true,
      },
    });
  }

  listCountries() {
    return this.prisma.country.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        image: true,
      },
    });
  }

  async listProducts(query: AdminCatalogProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.q?.trim();
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
              {
                variants: {
                  some: {
                    deletedAt: null,
                    sku: { contains: search, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          brand: true,
          country: true,
          categories: {
            include: {
              category: true,
            },
          },
          variants: {
            where: {
              deletedAt: null,
            },
            include: {
              size: true,
            },
          },
          media: {
            orderBy: {
              sortOrder: 'asc',
            },
            include: {
              media: true,
            },
          },
          attributes: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          seoOgMedia: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((product) => this.withAdminMediaUrls(product)),
      total,
      page,
      limit,
    };
  }

  async getProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        brand: true,
        country: true,
        categories: { include: { category: true } },
        variants: {
          where: { deletedAt: null },
          include: { size: true },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
          include: { media: true },
        },
        attributes: {
          orderBy: { sortOrder: 'asc' },
        },
        seoOgMedia: true,
      },
    });

    if (!product) throw new NotFoundException('Product was not found.');
    return this.withAdminMediaUrls(product);
  }

  async updateProduct(productId: string, dto: UpdateProductDto) {
    const attributes =
      dto.attributes === undefined ? undefined : this.normalizeProductAttributes(dto.attributes);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { id: true, slug: true, salePriceToman: true, compareAtPriceToman: true },
      });

      if (!current) throw new NotFoundException('Product was not found.');

      if (dto.brandId) {
        const brand = await transaction.brand.findFirst({
          where: { id: dto.brandId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (!brand) throw new NotFoundException('Brand was not found.');
      }

      if (dto.countryId) {
        const country = await transaction.country.findFirst({
          where: { id: dto.countryId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (!country) throw new NotFoundException('Country was not found.');
      }
      if (dto.seoOgMediaId) {
        await this.requireSeoImage(transaction, dto.seoOgMediaId);
      }

      if (dto.categoryIds) {
        const categories = await transaction.category.findMany({
          where: { id: { in: dto.categoryIds }, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (categories.length !== dto.categoryIds.length) {
          throw new NotFoundException('One or more categories were not found.');
        }
      }

      const salePriceToman =
        dto.salePriceToman === undefined ? current.salePriceToman : dto.salePriceToman;
      const compareAtPriceToman =
        dto.compareAtPriceToman === undefined
          ? current.compareAtPriceToman
          : dto.compareAtPriceToman;
      if (
        salePriceToman !== null &&
        compareAtPriceToman !== null &&
        compareAtPriceToman <= salePriceToman
      ) {
        throw new BadRequestException('Compare price must be greater than sale price.');
      }

      const nextSlug = dto.slug?.trim();

      await transaction.product.update({
        where: { id: productId },
        data: {
          name: dto.name,
          slug: nextSlug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          seoTitle: dto.seoTitle === undefined ? undefined : dto.seoTitle?.trim() || null,
          seoDescription:
            dto.seoDescription === undefined ? undefined : dto.seoDescription?.trim() || null,
          seoCanonicalPath:
            dto.seoCanonicalPath === undefined ? undefined : dto.seoCanonicalPath?.trim() || null,
          seoNoIndex: dto.seoNoIndex,
          seoOgMediaId: dto.seoOgMediaId,
          brandId: dto.brandId,
          countryId: dto.countryId,
          salePriceToman: dto.salePriceToman,
          compareAtPriceToman: dto.compareAtPriceToman,
        },
      });

      if (nextSlug && nextSlug !== current.slug) {
        await recordSeoSlugChange(
          transaction,
          SeoRedirectEntityType.PRODUCT,
          productId,
          current.slug,
          nextSlug,
        );
      }

      if (dto.categoryIds) {
        await transaction.productCategory.deleteMany({ where: { productId } });
        if (dto.categoryIds.length > 0) {
          await transaction.productCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({ productId, categoryId })),
          });
        }
      }

      if (attributes !== undefined) {
        await transaction.productAttribute.deleteMany({ where: { productId } });
        if (attributes.length > 0) {
          await transaction.productAttribute.createMany({
            data: attributes.map((attribute) => ({ productId, ...attribute })),
          });
        }
      }

      return transaction.product.findUniqueOrThrow({
        where: { id: productId },
        include: {
          brand: true,
          country: true,
          categories: { include: { category: true } },
          variants: { where: { deletedAt: null }, include: { size: true } },
          media: { orderBy: { sortOrder: 'asc' }, include: { media: true } },
          attributes: { orderBy: { sortOrder: 'asc' } },
          seoOgMedia: true,
        },
      });
    });

    return this.withAdminMediaUrls(updated);
  }

  async updateProductStatus(productId: string, status: ProductStatus) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product was not found.');

    return this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });
  }

  async listPublicCategories() {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalPath: true,
        seoNoIndex: true,
        parentId: true,
        sortOrder: true,
        image: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
        seoOgMedia: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      seoCanonicalPath: category.seoCanonicalPath,
      seoNoIndex: category.seoNoIndex,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      image:
        category.image && !category.image.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(category.image.storageKey),
              mimeType: category.image.mimeType,
              altText: category.image.altText,
              width: category.image.width,
              height: category.image.height,
            }
          : null,
      seoOgMedia:
        category.seoOgMedia && !category.seoOgMedia.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(category.seoOgMedia.storageKey),
              mimeType: category.seoOgMedia.mimeType,
              altText: category.seoOgMedia.altText,
              width: category.seoOgMedia.width,
              height: category.seoOgMedia.height,
            }
          : null,
    }));
  }

  async listPublicBrands() {
    const brands = await this.prisma.brand.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalPath: true,
        seoNoIndex: true,
        originCountry: {
          select: {
            id: true,
            name: true,
            slug: true,
            isoCode: true,
            isActive: true,
            deletedAt: true,
          },
        },
        image: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
        heroImage: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
        seoOgMedia: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
      },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      seoTitle: brand.seoTitle,
      seoDescription: brand.seoDescription,
      seoCanonicalPath: brand.seoCanonicalPath,
      seoNoIndex: brand.seoNoIndex,
      originCountry:
        brand.originCountry?.isActive && !brand.originCountry.deletedAt
          ? {
              id: brand.originCountry.id,
              name: brand.originCountry.name,
              slug: brand.originCountry.slug,
              isoCode: brand.originCountry.isoCode,
            }
          : null,
      image:
        brand.image && !brand.image.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(brand.image.storageKey),
              mimeType: brand.image.mimeType,
              altText: brand.image.altText,
              width: brand.image.width,
              height: brand.image.height,
            }
          : null,
      heroImage:
        brand.heroImage && !brand.heroImage.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(brand.heroImage.storageKey),
              mimeType: brand.heroImage.mimeType,
              altText: brand.heroImage.altText,
              width: brand.heroImage.width,
              height: brand.heroImage.height,
            }
          : null,
      seoOgMedia:
        brand.seoOgMedia && !brand.seoOgMedia.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(brand.seoOgMedia.storageKey),
              mimeType: brand.seoOgMedia.mimeType,
              altText: brand.seoOgMedia.altText,
              width: brand.seoOgMedia.width,
              height: brand.seoOgMedia.height,
            }
          : null,
    }));
  }

  async listPublicProducts(query: PublicCatalogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;
    const sort = query.sort ?? PublicCatalogSort.NEWEST;
    const search = normalizeCatalogSearch(query.q ?? '') || undefined;
    const category = query.category?.trim();
    const brand = query.brand?.trim();
    const country = query.country?.trim();
    const categoryIds = category ? await this.resolvePublicCategoryIds(category) : undefined;

    const where = {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(categoryIds
        ? {
            categories: {
              some: {
                categoryId: {
                  in: categoryIds,
                },
              },
            },
          }
        : {}),
      ...(brand
        ? {
            brand: {
              is: {
                slug: brand,
                isActive: true,
                deletedAt: null,
              },
            },
          }
        : {}),
      ...(country
        ? {
            country: {
              is: {
                slug: country,
                isActive: true,
                deletedAt: null,
              },
            },
          }
        : {}),
    };

    const orderBy =
      sort === PublicCatalogSort.PRICE_ASC
        ? [
            {
              salePriceToman: {
                sort: 'asc' as const,
                nulls: 'last' as const,
              },
            },
            { createdAt: 'desc' as const },
            { id: 'asc' as const },
          ]
        : sort === PublicCatalogSort.PRICE_DESC
          ? [
              {
                salePriceToman: {
                  sort: 'desc' as const,
                  nulls: 'last' as const,
                },
              },
              { createdAt: 'desc' as const },
              { id: 'asc' as const },
            ]
          : sort === PublicCatalogSort.NAME_ASC
            ? [{ name: 'asc' as const }, { id: 'asc' as const }]
            : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const availabilityByProductId = new Map<string, number>();
    let total: number;
    let pageProductIds: string[];

    if (search) {
      const searchRows = await this.searchPublicProductIds({
        search,
        page,
        pageSize,
        sort,
        categoryIds,
        brand,
        country,
      });
      pageProductIds = searchRows.map(({ id }) => id);
      total = Number(searchRows[0]?.total ?? 0);
      for (const row of searchRows) {
        availabilityByProductId.set(row.id, Number(row.availableQuantity));
      }
    } else {
      const orderedProducts = await this.prisma.product.findMany({
        where,
        orderBy,
        select: {
          id: true,
          variants: {
            where: {
              isActive: true,
              deletedAt: null,
            },
            select: {
              inventories: {
                select: {
                  onHand: true,
                  reserved: true,
                  warehouse: {
                    select: {
                      isActive: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      for (const product of orderedProducts) {
        availabilityByProductId.set(
          product.id,
          product.variants.reduce(
            (productTotal, variant) =>
              productTotal +
              variant.inventories.reduce((variantTotal, inventory) => {
                if (!inventory.warehouse.isActive || inventory.warehouse.deletedAt) {
                  return variantTotal;
                }

                return variantTotal + Math.max(0, inventory.onHand - inventory.reserved);
              }, 0),
            0,
          ),
        );
      }
      const prioritizedProductIds = [
        ...orderedProducts.filter((product) => (availabilityByProductId.get(product.id) ?? 0) > 0),
        ...orderedProducts.filter(
          (product) => (availabilityByProductId.get(product.id) ?? 0) === 0,
        ),
      ].map((product) => product.id);
      total = prioritizedProductIds.length;
      pageProductIds = prioritizedProductIds.slice((page - 1) * pageSize, page * pageSize);
    }
    const products =
      pageProductIds.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: {
              id: {
                in: pageProductIds,
              },
            },
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
              seoCanonicalPath: true,
              seoNoIndex: true,
              salePriceToman: true,
              compareAtPriceToman: true,
              sizeMode: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                  isActive: true,
                  deletedAt: true,
                  originCountry: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      isoCode: true,
                      isActive: true,
                      deletedAt: true,
                    },
                  },
                  image: {
                    select: {
                      storageKey: true,
                      mimeType: true,
                      altText: true,
                      width: true,
                      height: true,
                      deletedAt: true,
                    },
                  },
                },
              },
              categories: {
                select: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      description: true,
                      parentId: true,
                      sortOrder: true,
                      isActive: true,
                      deletedAt: true,
                      image: {
                        select: {
                          storageKey: true,
                          mimeType: true,
                          altText: true,
                          width: true,
                          height: true,
                          deletedAt: true,
                        },
                      },
                    },
                  },
                },
              },
              media: {
                orderBy: {
                  sortOrder: 'asc',
                },
                select: {
                  isPrimary: true,
                  altText: true,
                  media: {
                    select: {
                      storageKey: true,
                      mimeType: true,
                      altText: true,
                      width: true,
                      height: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          });
    const productById = new Map(products.map((product) => [product.id, product] as const));
    const orderedPageProducts = pageProductIds.flatMap((productId) => {
      const product = productById.get(productId);

      return product ? [product] : [];
    });

    return {
      items: orderedPageProducts.map((product) => {
        const availableQuantity = availabilityByProductId.get(product.id) ?? 0;
        const primaryMedia =
          product.media.find((item) => item.isPrimary && !item.media.deletedAt) ??
          product.media.find((item) => !item.media.deletedAt);
        const brand =
          product.brand?.isActive && !product.brand.deletedAt
            ? {
                id: product.brand.id,
                name: product.brand.name,
                slug: product.brand.slug,
                description: product.brand.description,
                originCountry:
                  product.brand.originCountry?.isActive && !product.brand.originCountry.deletedAt
                    ? {
                        id: product.brand.originCountry.id,
                        name: product.brand.originCountry.name,
                        slug: product.brand.originCountry.slug,
                        isoCode: product.brand.originCountry.isoCode,
                      }
                    : null,
                image:
                  product.brand.image && !product.brand.image.deletedAt
                    ? {
                        url: this.publicMediaUrl.resolve(product.brand.image.storageKey),
                        mimeType: product.brand.image.mimeType,
                        altText: product.brand.image.altText,
                        width: product.brand.image.width,
                        height: product.brand.image.height,
                      }
                    : null,
              }
            : null;

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          seoCanonicalPath: product.seoCanonicalPath,
          seoNoIndex: product.seoNoIndex,
          salePriceToman: product.salePriceToman,
          compareAtPriceToman: product.compareAtPriceToman,
          sizeMode: product.sizeMode,
          brand,
          categories: product.categories
            .filter(({ category }) => category.isActive && !category.deletedAt)
            .map(({ category }) => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              parentId: category.parentId,
              sortOrder: category.sortOrder,
              image:
                category.image && !category.image.deletedAt
                  ? {
                      url: this.publicMediaUrl.resolve(category.image.storageKey),
                      mimeType: category.image.mimeType,
                      altText: category.image.altText,
                      width: category.image.width,
                      height: category.image.height,
                    }
                  : null,
            })),
          primaryMedia: primaryMedia
            ? {
                url: this.publicMediaUrl.resolve(primaryMedia.media.storageKey),
                mimeType: primaryMedia.media.mimeType,
                altText: primaryMedia.altText ?? primaryMedia.media.altText,
                width: primaryMedia.media.width,
                height: primaryMedia.media.height,
              }
            : null,
          availableQuantity,
          isAvailable: availableQuantity > 0,
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listPublicProductSuggestions(query: string, limit = 8) {
    const search = normalizeCatalogSearch(query);
    if (search.length < 2) return { items: [] };

    const rows = await this.prisma.$queryRaw<PublicProductSuggestionRow[]>(Prisma.sql`
      WITH ${this.publicSearchMatchesSql(search)},
      ranked_search AS (
        SELECT "productId", MAX(score) AS score
        FROM search_matches
        GROUP BY "productId"
      )
      SELECT product.id
      FROM ranked_search
      JOIN "products" AS product ON product.id = ranked_search."productId"
      WHERE product."status" = 'ACTIVE'
        AND product."deletedAt" IS NULL
      ORDER BY ranked_search.score DESC, product."createdAt" DESC, product.id ASC
      LIMIT ${Math.min(Math.max(limit, 1), 8)}
    `);
    const productIds = rows.map(({ id }) => id);
    if (productIds.length === 0) return { items: [] };

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        salePriceToman: true,
        compareAtPriceToman: true,
        media: {
          orderBy: { sortOrder: 'asc' },
          select: {
            isPrimary: true,
            altText: true,
            media: {
              select: {
                storageKey: true,
                mimeType: true,
                altText: true,
                width: true,
                height: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
    const productById = new Map(products.map((product) => [product.id, product] as const));

    return {
      items: productIds.flatMap((productId) => {
        const product = productById.get(productId);
        if (!product) return [];
        const primaryMedia =
          product.media.find((item) => item.isPrimary && !item.media.deletedAt) ??
          product.media.find((item) => !item.media.deletedAt);

        return [
          {
            id: product.id,
            name: product.name,
            slug: product.slug,
            salePriceToman: product.salePriceToman,
            compareAtPriceToman: product.compareAtPriceToman,
            primaryMedia: primaryMedia
              ? {
                  url: this.publicMediaUrl.resolve(primaryMedia.media.storageKey),
                  mimeType: primaryMedia.media.mimeType,
                  altText: primaryMedia.altText ?? primaryMedia.media.altText,
                  width: primaryMedia.media.width,
                  height: primaryMedia.media.height,
                }
              : null,
          },
        ];
      }),
    };
  }

  async getPublicProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalPath: true,
        seoNoIndex: true,
        salePriceToman: true,
        compareAtPriceToman: true,
        sizeMode: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            isActive: true,
            deletedAt: true,
            originCountry: {
              select: {
                id: true,
                name: true,
                slug: true,
                isoCode: true,
                isActive: true,
                deletedAt: true,
              },
            },
            image: {
              select: {
                storageKey: true,
                mimeType: true,
                altText: true,
                width: true,
                height: true,
                deletedAt: true,
              },
            },
          },
        },
        seoOgMedia: {
          select: {
            storageKey: true,
            mimeType: true,
            altText: true,
            width: true,
            height: true,
            deletedAt: true,
          },
        },
        country: {
          select: {
            id: true,
            name: true,
            slug: true,
            isoCode: true,
            isActive: true,
            deletedAt: true,
          },
        },
        categories: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                parentId: true,
                sortOrder: true,
                isActive: true,
                deletedAt: true,
                image: {
                  select: {
                    storageKey: true,
                    mimeType: true,
                    altText: true,
                    width: true,
                    height: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
        variants: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            name: true,
            weightGrams: true,
            platingEligible: true,
            platingOptions: {
              where: {
                isActive: true,
                platingRate: {
                  isActive: true,
                },
              },
              select: {
                platingRate: {
                  select: {
                    type: true,
                    pricePerGramToman: true,
                    leadTimeDays: true,
                  },
                },
              },
            },
            size: {
              select: {
                id: true,
                code: true,
                label: true,
                isActive: true,
                deletedAt: true,
              },
            },
            inventories: {
              select: {
                onHand: true,
                reserved: true,
                warehouse: {
                  select: {
                    isActive: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
        media: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            isPrimary: true,
            altText: true,
            media: {
              select: {
                storageKey: true,
                mimeType: true,
                altText: true,
                width: true,
                height: true,
                deletedAt: true,
              },
            },
          },
        },
        attributes: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            key: true,
            value: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product was not found.');
    }

    const variants = product.variants.map((variant) => {
      const availableQuantity = variant.inventories.reduce((total, inventory) => {
        if (!inventory.warehouse.isActive || inventory.warehouse.deletedAt) {
          return total;
        }

        return total + Math.max(0, inventory.onHand - inventory.reserved);
      }, 0);
      const weightGrams = variant.weightGrams;
      const platingOptions =
        variant.platingEligible && weightGrams
          ? variant.platingOptions
              .map(({ platingRate }) => ({
                type: platingRate.type,
                unitPriceToman: calculatePlatingPriceToman(
                  weightGrams.toString(),
                  platingRate.pricePerGramToman,
                ),
                leadTimeDays: platingRate.leadTimeDays,
              }))
              .sort((left, right) => left.type.localeCompare(right.type))
          : [];

      return {
        id: variant.id,
        name: variant.name,
        weightGrams: variant.weightGrams === null ? null : Number(variant.weightGrams),
        size:
          variant.size?.isActive && !variant.size.deletedAt
            ? {
                id: variant.size.id,
                code: variant.size.code,
                label: variant.size.label,
              }
            : null,
        availableQuantity,
        isAvailable: availableQuantity > 0,
        platingOptions,
      };
    });
    const availableQuantity = variants.reduce(
      (total, variant) => total + variant.availableQuantity,
      0,
    );
    const media = product.media
      .filter((item) => !item.media.deletedAt)
      .map((item) => ({
        url: this.publicMediaUrl.resolve(item.media.storageKey),
        mimeType: item.media.mimeType,
        altText: item.altText ?? item.media.altText,
        width: item.media.width,
        height: item.media.height,
      }));
    const primaryMediaItem =
      product.media.find((item) => item.isPrimary && !item.media.deletedAt) ??
      product.media.find((item) => !item.media.deletedAt);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoCanonicalPath: product.seoCanonicalPath,
      seoNoIndex: product.seoNoIndex,
      seoOgMedia:
        product.seoOgMedia && !product.seoOgMedia.deletedAt
          ? {
              url: this.publicMediaUrl.resolve(product.seoOgMedia.storageKey),
              mimeType: product.seoOgMedia.mimeType,
              altText: product.seoOgMedia.altText,
              width: product.seoOgMedia.width,
              height: product.seoOgMedia.height,
            }
          : null,
      salePriceToman: product.salePriceToman,
      compareAtPriceToman: product.compareAtPriceToman,
      sizeMode: product.sizeMode,
      brand:
        product.brand?.isActive && !product.brand.deletedAt
          ? {
              id: product.brand.id,
              name: product.brand.name,
              slug: product.brand.slug,
              description: product.brand.description,
              originCountry:
                product.brand.originCountry?.isActive && !product.brand.originCountry.deletedAt
                  ? {
                      id: product.brand.originCountry.id,
                      name: product.brand.originCountry.name,
                      slug: product.brand.originCountry.slug,
                      isoCode: product.brand.originCountry.isoCode,
                    }
                  : null,
              image:
                product.brand.image && !product.brand.image.deletedAt
                  ? {
                      url: this.publicMediaUrl.resolve(product.brand.image.storageKey),
                      mimeType: product.brand.image.mimeType,
                      altText: product.brand.image.altText,
                      width: product.brand.image.width,
                      height: product.brand.image.height,
                    }
                  : null,
            }
          : null,
      categories: product.categories
        .filter(({ category }) => category.isActive && !category.deletedAt)
        .map(({ category }) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
          image:
            category.image && !category.image.deletedAt
              ? {
                  url: this.publicMediaUrl.resolve(category.image.storageKey),
                  mimeType: category.image.mimeType,
                  altText: category.image.altText,
                  width: category.image.width,
                  height: category.image.height,
                }
              : null,
        })),
      primaryMedia: primaryMediaItem
        ? {
            url: this.publicMediaUrl.resolve(primaryMediaItem.media.storageKey),
            mimeType: primaryMediaItem.media.mimeType,
            altText: primaryMediaItem.altText ?? primaryMediaItem.media.altText,
            width: primaryMediaItem.media.width,
            height: primaryMediaItem.media.height,
          }
        : null,
      availableQuantity,
      isAvailable: availableQuantity > 0,
      country:
        product.country?.isActive && !product.country.deletedAt
          ? {
              id: product.country.id,
              name: product.country.name,
              slug: product.country.slug,
              isoCode: product.country.isoCode,
            }
          : null,
      variants,
      media,
      attributes: product.attributes,
    };
  }

  private async searchPublicProductIds(input: {
    search: string;
    page: number;
    pageSize: number;
    sort: PublicCatalogSort;
    categoryIds: string[] | undefined;
    brand: string | undefined;
    country: string | undefined;
  }): Promise<PublicProductSearchRow[]> {
    const categoryFilter =
      input.categoryIds === undefined
        ? Prisma.empty
        : input.categoryIds.length === 0
          ? Prisma.sql`AND FALSE`
          : Prisma.sql`
              AND EXISTS (
                SELECT 1
                FROM "product_categories" AS filter_category
                WHERE filter_category."productId" = product.id
                  AND filter_category."categoryId" IN (${Prisma.join(input.categoryIds)})
              )
            `;
    const brandFilter = input.brand
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM "brands" AS filter_brand
            WHERE filter_brand.id = product."brandId"
              AND filter_brand.slug = ${input.brand}
              AND filter_brand."isActive" = true
              AND filter_brand."deletedAt" IS NULL
          )
        `
      : Prisma.empty;
    const countryFilter = input.country
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM "countries" AS filter_country
            WHERE filter_country.id = product."countryId"
              AND filter_country.slug = ${input.country}
              AND filter_country."isActive" = true
              AND filter_country."deletedAt" IS NULL
          )
        `
      : Prisma.empty;
    const secondaryOrder =
      input.sort === PublicCatalogSort.PRICE_ASC
        ? Prisma.sql`"salePriceToman" ASC NULLS LAST, "createdAt" DESC, id ASC`
        : input.sort === PublicCatalogSort.PRICE_DESC
          ? Prisma.sql`"salePriceToman" DESC NULLS LAST, "createdAt" DESC, id ASC`
          : input.sort === PublicCatalogSort.NAME_ASC
            ? Prisma.sql`name ASC, id ASC`
            : Prisma.sql`"createdAt" DESC, id DESC`;

    return this.prisma.$queryRaw<PublicProductSearchRow[]>(Prisma.sql`
      WITH ${this.publicSearchMatchesSql(input.search)},
      ranked_search AS (
        SELECT "productId", MAX(score) AS score
        FROM search_matches
        GROUP BY "productId"
      ),
      filtered_search AS (
        SELECT
          product.id,
          product.name,
          product."salePriceToman",
          product."createdAt",
          ranked_search.score,
          COALESCE((
            SELECT SUM(GREATEST(inventory."onHand" - inventory."reserved", 0))
            FROM "product_variants" AS variant
            JOIN "inventory" AS inventory ON inventory."variantId" = variant.id
            JOIN "warehouses" AS warehouse ON warehouse.id = inventory."warehouseId"
            WHERE variant."productId" = product.id
              AND variant."isActive" = true
              AND variant."deletedAt" IS NULL
              AND warehouse."isActive" = true
              AND warehouse."deletedAt" IS NULL
          ), 0)::bigint AS "availableQuantity"
        FROM ranked_search
        JOIN "products" AS product ON product.id = ranked_search."productId"
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          ${categoryFilter}
          ${brandFilter}
          ${countryFilter}
      )
      SELECT id, "availableQuantity", COUNT(*) OVER () AS total
      FROM filtered_search
      ORDER BY ("availableQuantity" > 0) DESC, score DESC, ${secondaryOrder}
      LIMIT ${input.pageSize}
      OFFSET ${(input.page - 1) * input.pageSize}
    `);
  }

  private publicSearchMatchesSql(search: string): Prisma.Sql {
    return Prisma.sql`
      search_query AS (
        SELECT normalize_fa_search(${search}) AS value
      ),
      search_matches AS (
        SELECT
          product.id AS "productId",
          similarity(normalize_fa_search(product.name), search_query.value)
            + CASE
                WHEN normalize_fa_search(product.name) = search_query.value THEN 2
                WHEN normalize_fa_search(product.name) LIKE search_query.value || '%' THEN 1
                WHEN normalize_fa_search(product.name) LIKE '%' || search_query.value || '%' THEN 0.4
                ELSE 0
              END AS score
        FROM "products" AS product
        CROSS JOIN search_query
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          AND (
            normalize_fa_search(product.name) % search_query.value
            OR normalize_fa_search(product.name) LIKE '%' || search_query.value || '%'
          )

        UNION ALL

        SELECT
          product.id AS "productId",
          similarity(normalize_fa_search(product."shortDescription"), search_query.value) * 0.25
            AS score
        FROM "products" AS product
        CROSS JOIN search_query
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          AND (
            normalize_fa_search(product."shortDescription") % search_query.value
            OR normalize_fa_search(product."shortDescription") LIKE '%' || search_query.value || '%'
          )

        UNION ALL

        SELECT
          product.id AS "productId",
          similarity(normalize_fa_search(brand.name), search_query.value) * 0.65 AS score
        FROM "products" AS product
        JOIN "brands" AS brand ON brand.id = product."brandId"
        CROSS JOIN search_query
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          AND brand."isActive" = true
          AND brand."deletedAt" IS NULL
          AND (
            normalize_fa_search(brand.name) % search_query.value
            OR normalize_fa_search(brand.name) LIKE '%' || search_query.value || '%'
          )

        UNION ALL

        SELECT
          product.id AS "productId",
          similarity(normalize_fa_search(category.name), search_query.value) * 0.55 AS score
        FROM "products" AS product
        JOIN "product_categories" AS product_category
          ON product_category."productId" = product.id
        JOIN "categories" AS category ON category.id = product_category."categoryId"
        CROSS JOIN search_query
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          AND category."isActive" = true
          AND category."deletedAt" IS NULL
          AND (
            normalize_fa_search(category.name) % search_query.value
            OR normalize_fa_search(category.name) LIKE '%' || search_query.value || '%'
          )

        UNION ALL

        SELECT
          product.id AS "productId",
          similarity(normalize_fa_search(variant.sku), search_query.value) * 0.4 AS score
        FROM "products" AS product
        JOIN "product_variants" AS variant ON variant."productId" = product.id
        CROSS JOIN search_query
        WHERE product."status" = 'ACTIVE'
          AND product."deletedAt" IS NULL
          AND variant."isActive" = true
          AND variant."deletedAt" IS NULL
          AND (
            normalize_fa_search(variant.sku) % search_query.value
            OR normalize_fa_search(variant.sku) LIKE '%' || search_query.value || '%'
          )
      )
    `;
  }

  private async resolvePublicCategoryIds(slug: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        parentId: true,
      },
    });
    const root = categories.find((category) => category.slug === slug);

    if (!root) {
      return [];
    }

    const childIdsByParent = new Map<string, string[]>();

    for (const category of categories) {
      if (!category.parentId) {
        continue;
      }

      const childIds = childIdsByParent.get(category.parentId) ?? [];
      childIds.push(category.id);
      childIdsByParent.set(category.parentId, childIds);
    }

    const categoryIds: string[] = [];
    const visitedIds = new Set<string>();
    const pendingIds = [root.id];

    while (pendingIds.length > 0) {
      const categoryId = pendingIds.pop();

      if (!categoryId || visitedIds.has(categoryId)) {
        continue;
      }

      visitedIds.add(categoryId);
      categoryIds.push(categoryId);
      pendingIds.push(...(childIdsByParent.get(categoryId) ?? []));
    }

    return categoryIds;
  }

  private async requireMedia(mediaId: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!media) {
      throw new NotFoundException('Media was not found.');
    }
  }

  private async requireSeoImage(
    transaction: Pick<PrismaService, 'media'>,
    mediaId: string,
  ): Promise<void> {
    const media = await transaction.media.findFirst({
      where: { id: mediaId, deletedAt: null, mimeType: { startsWith: 'image/' } },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('SEO social image was not found.');
  }

  private async requireCountry(countryId: string): Promise<void> {
    const country = await this.prisma.country.findFirst({
      where: {
        id: countryId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!country) {
      throw new NotFoundException('Country was not found.');
    }
  }

  private async requireCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Parent category was not found.');
    }
  }

  private validateProductShape(dto: CreateProductDto): void {
    if (dto.variants.length === 0) {
      throw new BadRequestException('A product must have at least one variant.');
    }

    const skus = dto.variants.map(({ sku }) => sku);

    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('Variant SKUs must be unique within a product.');
    }

    if (dto.sizeMode === SizeMode.SIZED) {
      if (dto.variants.some((variant) => !variant.sizeId)) {
        throw new BadRequestException('Every variant of a sized product must have a size.');
      }

      const sizeIds = dto.variants.map(({ sizeId }) => sizeId as string);

      if (new Set(sizeIds).size !== sizeIds.length) {
        throw new BadRequestException('A sized product cannot repeat the same size.');
      }
    } else if (dto.variants.some((variant) => variant.sizeId)) {
      throw new BadRequestException('Only sized products can assign sizes to variants.');
    }

    const primaryMediaCount = (dto.media ?? []).filter(({ isPrimary }) => isPrimary).length;

    if (primaryMediaCount > 1) {
      throw new BadRequestException('A product can have only one primary media item.');
    }
  }

  private normalizeProductAttributes(
    attributes: readonly { key: string; value: string; sortOrder: number }[] | undefined,
  ): { key: string; value: string; sortOrder: number }[] {
    const normalized = (attributes ?? []).map((attribute) => ({
      key: attribute.key.trim().replace(/\s+/g, ' '),
      value: attribute.value.trim(),
      sortOrder: attribute.sortOrder,
    }));

    if (normalized.some(({ key, value }) => !key || !value)) {
      throw new BadRequestException('Product attribute keys and values cannot be blank.');
    }

    if (normalized.some(({ key, value }) => key.length > 100 || value.length > 500)) {
      throw new BadRequestException('Product attribute key or value exceeds its length limit.');
    }

    const normalizedKeys = normalized.map(({ key }) => key.toLocaleLowerCase('fa-IR'));
    if (new Set(normalizedKeys).size !== normalizedKeys.length) {
      throw new BadRequestException('Product attribute keys must be unique.');
    }

    const sortOrders = normalized.map(({ sortOrder }) => sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      throw new BadRequestException('Product attribute display orders must be unique.');
    }

    return normalized.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private withAdminMediaUrls<
    T extends {
      media: readonly {
        media: { storageKey: string };
      }[];
      seoOgMedia?: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        deletedAt: Date | null;
      } | null;
    },
  >(product: T) {
    return {
      ...product,
      media: product.media.map((item) => ({
        ...item,
        url: this.publicMediaUrl.resolve(item.media.storageKey),
      })),
      ...(Object.prototype.hasOwnProperty.call(product, 'seoOgMedia')
        ? {
            seoOgMedia:
              product.seoOgMedia && !product.seoOgMedia.deletedAt
                ? {
                    id: product.seoOgMedia.id,
                    url: this.publicMediaUrl.resolve(product.seoOgMedia.storageKey),
                    mimeType: product.seoOgMedia.mimeType,
                    altText: product.seoOgMedia.altText,
                  }
                : null,
          }
        : {}),
    };
  }
}
