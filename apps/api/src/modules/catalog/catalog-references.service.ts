import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { PublicMediaUrlService } from './public-media-url.service';

const referenceInclude = {
  image: true,
  _count: { select: { products: { where: { deletedAt: null } } } },
} as const;

const brandReferenceInclude = {
  ...referenceInclude,
  heroImage: true,
} as const;

@Injectable()
export class CatalogReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async createBrand(dto: CreateBrandDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim();
    if (!name || !slug) throw new BadRequestException('Brand name and slug are required.');

    try {
      const brand = await this.prisma.$transaction(async (transaction) => {
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        return transaction.brand.create({
          data: {
            name,
            slug,
            description: this.optionalText(dto.description),
            imageId: dto.imageId,
            isActive: dto.isActive ?? true,
          },
          include: brandReferenceInclude,
        });
      });
      return this.projectBrand(brand);
    } catch (error) {
      this.throwUniqueConflict(error, 'brand');
    }
  }

  async listBrands() {
    const brands = await this.prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: brandReferenceInclude,
    });
    return brands.map((brand) => this.projectBrand(brand));
  }

  async updateBrand(brandId: string, dto: UpdateBrandDto) {
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Brand name cannot be empty.');
    }
    if (dto.slug !== undefined && !dto.slug.trim()) {
      throw new BadRequestException('Brand slug cannot be empty.');
    }

    try {
      const brand = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.brand.findFirst({
          where: { id: brandId, deletedAt: null },
          select: { id: true },
        });
        if (!current) throw new NotFoundException('Brand was not found.');
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        return transaction.brand.update({
          where: { id: brandId },
          data: {
            name: dto.name?.trim(),
            slug: dto.slug?.trim(),
            description:
              dto.description === undefined ? undefined : this.optionalText(dto.description),
            imageId: dto.imageId,
            isActive: dto.isActive,
          },
          include: brandReferenceInclude,
        });
      });
      return this.projectBrand(brand);
    } catch (error) {
      this.throwUniqueConflict(error, 'brand');
    }
  }

  async archiveBrand(brandId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const brand = await transaction.brand.findFirst({
        where: { id: brandId, deletedAt: null },
        select: { id: true, _count: { select: { products: { where: { deletedAt: null } } } } },
      });
      if (!brand) throw new NotFoundException('Brand was not found.');
      if (brand._count.products > 0) {
        throw new ConflictException('A brand assigned to products cannot be archived.');
      }
      await transaction.brand.update({
        where: { id: brandId },
        data: { isActive: false, deletedAt: new Date() },
      });
      return { archived: true };
    });
  }

  async createCountry(dto: CreateCountryDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim();
    if (!name || !slug) throw new BadRequestException('Country name and slug are required.');

    try {
      const country = await this.prisma.$transaction(async (transaction) => {
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        return transaction.country.create({
          data: {
            name,
            slug,
            isoCode: dto.isoCode.toUpperCase(),
            description: this.optionalText(dto.description),
            imageId: dto.imageId,
            isActive: dto.isActive ?? true,
          },
          include: referenceInclude,
        });
      });
      return this.project(country);
    } catch (error) {
      this.throwUniqueConflict(error, 'country');
    }
  }

  async listCountries() {
    const countries = await this.prisma.country.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: referenceInclude,
    });
    return countries.map((country) => this.project(country));
  }

  async updateCountry(countryId: string, dto: UpdateCountryDto) {
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Country name cannot be empty.');
    }
    if (dto.slug !== undefined && !dto.slug.trim()) {
      throw new BadRequestException('Country slug cannot be empty.');
    }

    try {
      const country = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.country.findFirst({
          where: { id: countryId, deletedAt: null },
          select: { id: true },
        });
        if (!current) throw new NotFoundException('Country was not found.');
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        return transaction.country.update({
          where: { id: countryId },
          data: {
            name: dto.name?.trim(),
            slug: dto.slug?.trim(),
            isoCode: dto.isoCode?.toUpperCase(),
            description:
              dto.description === undefined ? undefined : this.optionalText(dto.description),
            imageId: dto.imageId,
            isActive: dto.isActive,
          },
          include: referenceInclude,
        });
      });
      return this.project(country);
    } catch (error) {
      this.throwUniqueConflict(error, 'country');
    }
  }

  async archiveCountry(countryId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const country = await transaction.country.findFirst({
        where: { id: countryId, deletedAt: null },
        select: { id: true, _count: { select: { products: { where: { deletedAt: null } } } } },
      });
      if (!country) throw new NotFoundException('Country was not found.');
      if (country._count.products > 0) {
        throw new ConflictException('A country assigned to products cannot be archived.');
      }
      await transaction.country.update({
        where: { id: countryId },
        data: { isActive: false, deletedAt: new Date() },
      });
      return { archived: true };
    });
  }

  private async requireMedia(transaction: Pick<PrismaService, 'media'>, mediaId: string) {
    const media = await transaction.media.findFirst({
      where: { id: mediaId, deletedAt: null },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('Media was not found.');
  }

  private optionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  private project<
    T extends {
      _count: { products: number };
      image: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
    },
  >(reference: T) {
    const { _count, image, ...fields } = reference;
    return {
      ...fields,
      productCount: _count.products,
      image: image
        ? {
            id: image.id,
            url: this.publicMediaUrl.resolve(image.storageKey),
            mimeType: image.mimeType,
            altText: image.altText,
            width: image.width,
            height: image.height,
          }
        : null,
    };
  }

  private projectBrand<
    T extends {
      _count: { products: number };
      image: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
      heroImage: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
    },
  >(brand: T) {
    return {
      ...this.project(brand),
      heroImage: brand.heroImage
        ? {
            id: brand.heroImage.id,
            url: this.publicMediaUrl.resolve(brand.heroImage.storageKey),
            mimeType: brand.heroImage.mimeType,
            altText: brand.heroImage.altText,
            width: brand.heroImage.width,
            height: brand.heroImage.height,
          }
        : null,
    };
  }

  private throwUniqueConflict(error: unknown, entity: 'brand' | 'country'): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(
        entity === 'brand'
          ? 'A brand with this slug already exists.'
          : 'A country with this slug or ISO code already exists.',
      );
    }
    throw error;
  }
}
