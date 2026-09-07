import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PublicMediaUrlService } from './public-media-url.service';

const categoryInclude = {
  parent: { select: { id: true, name: true } },
  image: true,
  _count: {
    select: {
      children: { where: { deletedAt: null } },
      products: true,
    },
  },
} as const;

@Injectable()
export class CatalogCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim();
    if (!name || !slug) throw new BadRequestException('Category name and slug are required.');

    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        if (dto.parentId) await this.requireActiveParent(transaction, dto.parentId);
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);

        return transaction.category.create({
          data: {
            name,
            slug,
            description: this.optionalText(dto.description),
            parentId: dto.parentId,
            imageId: dto.imageId,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
          },
          include: categoryInclude,
        });
      });
      return this.project(category);
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async list() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: categoryInclude,
    });
    return categories.map((category) => this.project(category));
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Category name cannot be empty.');
    }
    if (dto.slug !== undefined && !dto.slug.trim()) {
      throw new BadRequestException('Category slug cannot be empty.');
    }
    if (dto.parentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { id: true, isActive: true, parentId: true },
        });
        if (!current) throw new NotFoundException('Category was not found.');

        const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;
        if (parentId) {
          if (parentId !== current.parentId || dto.isActive === true) {
            await this.requireActiveParent(transaction, parentId);
          }
          if (parentId !== current.parentId) {
            await this.assertNoCycle(transaction, categoryId, parentId);
          }
        }
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);

        if (current.isActive && dto.isActive === false) {
          const activeChildren = await transaction.category.count({
            where: { parentId: categoryId, isActive: true, deletedAt: null },
          });
          if (activeChildren > 0) {
            throw new ConflictException('A category with active children cannot be deactivated.');
          }
        }

        return transaction.category.update({
          where: { id: categoryId },
          data: {
            name: dto.name?.trim(),
            slug: dto.slug?.trim(),
            description:
              dto.description === undefined ? undefined : this.optionalText(dto.description),
            parentId: dto.parentId,
            imageId: dto.imageId,
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          },
          include: categoryInclude,
        });
      });
      return this.project(category);
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async archive(categoryId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: {
          id: true,
          _count: { select: { children: { where: { deletedAt: null } }, products: true } },
        },
      });
      if (!category) throw new NotFoundException('Category was not found.');
      if (category._count.children > 0) {
        throw new ConflictException('A category with child categories cannot be archived.');
      }
      if (category._count.products > 0) {
        throw new ConflictException('A category assigned to products cannot be archived.');
      }

      await transaction.category.update({
        where: { id: categoryId },
        data: { isActive: false, deletedAt: new Date() },
      });
      return { archived: true };
    });
  }

  private async requireActiveParent(
    transaction: Pick<PrismaService, 'category'>,
    parentId: string,
  ) {
    const parent = await transaction.category.findFirst({
      where: { id: parentId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Parent category was not found or is inactive.');
  }

  private async requireMedia(transaction: Pick<PrismaService, 'media'>, mediaId: string) {
    const media = await transaction.media.findFirst({
      where: { id: mediaId, deletedAt: null },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('Media was not found.');
  }

  private async assertNoCycle(
    transaction: Pick<PrismaService, 'category'>,
    categoryId: string,
    candidateParentId: string,
  ) {
    const visited = new Set<string>();
    let cursor: string | null = candidateParentId;

    while (cursor) {
      if (cursor === categoryId) {
        throw new BadRequestException('Category parent selection would create a cycle.');
      }
      if (visited.has(cursor)) {
        throw new ConflictException('The existing category tree contains a cycle.');
      }
      visited.add(cursor);
      const parent: { parentId: string | null } | null = await transaction.category.findFirst({
        where: { id: cursor, deletedAt: null },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private optionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  private project<
    T extends {
      _count: { children: number; products: number };
      image: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
    },
  >(category: T) {
    const { _count, image, ...categoryFields } = category;
    return {
      ...categoryFields,
      childCount: _count.children,
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

  private throwUniqueConflict(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('A category with this slug already exists.');
    }
    throw error;
  }
}
