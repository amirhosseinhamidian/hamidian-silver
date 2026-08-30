import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  createMedia(dto: CreateMediaDto) {
    return this.prisma.media.create({
      data: dto,
    });
  }

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

      const product = await transaction.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
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
