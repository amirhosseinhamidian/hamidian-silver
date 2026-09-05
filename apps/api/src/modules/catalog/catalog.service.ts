import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculatePlatingPriceToman } from '../../common/plating-price';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';
import { PublicCatalogQueryDto, PublicCatalogSort } from './dto/public-catalog-query.dto';
import { PublicMediaUrlService } from './public-media-url.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async createCategory(dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.requireCategory(dto.parentId);
    }

    if (dto.imageId) {
      await this.requireMedia(dto.imageId);
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        imageId: dto.imageId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        image: true,
      },
    });
  }

  async createBrand(dto: CreateBrandDto) {
    if (dto.imageId) {
      await this.requireMedia(dto.imageId);
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageId: dto.imageId,
        isActive: dto.isActive ?? true,
      },
      include: {
        image: true,
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

  createSize(dto: CreateSizeDto) {
    return this.prisma.size.create({
      data: {
        code: dto.code,
        label: dto.label,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async createProduct(dto: CreateProductDto) {
    this.validateProductShape(dto);

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
        },
      });
    });
  }

  listCategories() {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        image: true,
      },
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

  listSizes() {
    return this.prisma.size.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  listProducts() {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
      },
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
      },
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
      },
    });

    return categories.map((category) => ({
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
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
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
    }));
  }

  async listPublicProducts(query: PublicCatalogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;
    const sort = query.sort ?? PublicCatalogSort.NEWEST;
    const search = query.q?.trim();
    const category = query.category?.trim();
    const brand = query.brand?.trim();
    const categoryIds = category ? await this.resolvePublicCategoryIds(category) : undefined;

    const where = {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { shortDescription: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
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

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
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
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: products.map((product) => {
        const availableQuantity = product.variants.reduce(
          (productTotal, variant) =>
            productTotal +
            variant.inventories.reduce((variantTotal, inventory) => {
              if (!inventory.warehouse.isActive || inventory.warehouse.deletedAt) {
                return variantTotal;
              }

              return variantTotal + Math.max(0, inventory.onHand - inventory.reserved);
            }, 0),
          0,
        );
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
    };
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
}
