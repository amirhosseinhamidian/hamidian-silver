import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PlatingType, ProductStatus, SizeMode } from '../src/generated/prisma/enums';
import {
  PERMISSION_DEFINITIONS,
  ROLE_CODES,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSION_CODES,
} from '../src/modules/authorization/rbac.constants';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({ adapter });

type DemoVariantDefinition = Readonly<{
  sku: string;
  sizeCode?: string;
  name?: string;
  weightGrams: number;
  onHand: number;
  platingEligible?: boolean;
}>;

type DemoProductDefinition = Readonly<{
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  salePriceToman: number;
  sizeMode: SizeMode;
  categorySlug: string;
  brandSlug: string;
  variants: readonly DemoVariantDefinition[];
}>;

const DEMO_CATALOG_PRODUCTS: readonly DemoProductDefinition[] = [
  {
    name: 'انگشتر نقره آذر',
    slug: 'silver-ring-azar',
    shortDescription: 'انگشتر مینیمال نقره با فرم روان و پرداخت براق.',
    description:
      'مدل آذر برای استفاده روزمره طراحی شده و در چند سایز عرضه می‌شود. امکان انتخاب آبکاری طلا یا رودیوم برای این مدل فعال است.',
    salePriceToman: 3_950_000,
    sizeMode: SizeMode.SIZED,
    categorySlug: 'rings',
    brandSlug: 'hamidian-studio',
    variants: [
      {
        sku: 'DEMO-RING-AZAR-52',
        sizeCode: '52',
        weightGrams: 5.6,
        onHand: 4,
        platingEligible: true,
      },
      {
        sku: 'DEMO-RING-AZAR-54',
        sizeCode: '54',
        weightGrams: 5.8,
        onHand: 3,
        platingEligible: true,
      },
      {
        sku: 'DEMO-RING-AZAR-56',
        sizeCode: '56',
        weightGrams: 6.0,
        onHand: 0,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'انگشتر نقره نیلا',
    slug: 'silver-ring-nila',
    shortDescription: 'حلقه نقره ساده با سطح صیقلی و لبه‌های نرم.',
    description:
      'مدل نیلا یک حلقه ساده و سبک برای استایل روزمره است و در سه سایز قابل انتخاب عرضه می‌شود.',
    salePriceToman: 4_400_000,
    sizeMode: SizeMode.SIZED,
    categorySlug: 'rings',
    brandSlug: 'minimal-silver',
    variants: [
      {
        sku: 'DEMO-RING-NILA-52',
        sizeCode: '52',
        weightGrams: 6.1,
        onHand: 2,
        platingEligible: true,
      },
      {
        sku: 'DEMO-RING-NILA-54',
        sizeCode: '54',
        weightGrams: 6.3,
        onHand: 5,
        platingEligible: true,
      },
      {
        sku: 'DEMO-RING-NILA-56',
        sizeCode: '56',
        weightGrams: 6.5,
        onHand: 2,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'دستبند نقره ماه',
    slug: 'silver-bracelet-mah',
    shortDescription: 'دستبند نقره فری‌سایز با فرم باریک و مینیمال.',
    description:
      'دستبند ماه با فرم باز و وزن متعادل برای استفاده روزانه طراحی شده و قابلیت آبکاری دارد.',
    salePriceToman: 4_850_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'bracelets',
    brandSlug: 'hamidian-studio',
    variants: [
      {
        sku: 'DEMO-BRACELET-MAH',
        name: 'فری سایز',
        weightGrams: 8.9,
        onHand: 6,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'دستبند نقره رستا',
    slug: 'silver-bracelet-rasta',
    shortDescription: 'دستبند هندسی نقره با پرداخت ساتن.',
    description: 'مدل رستا با خطوط هندسی و سطح ساتن برای استایل‌های مینیمال و رسمی مناسب است.',
    salePriceToman: 5_250_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'bracelets',
    brandSlug: 'minimal-silver',
    variants: [
      {
        sku: 'DEMO-BRACELET-RASTA',
        name: 'فری سایز',
        weightGrams: 9.4,
        onHand: 3,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'گردنبند نقره سرو',
    slug: 'silver-necklace-sarv',
    shortDescription: 'گردنبند نقره ظریف با آویز الهام‌گرفته از فرم سرو.',
    description:
      'گردنبند سرو با زنجیر سبک و آویز مینیمال طراحی شده و برای هدیه و استفاده روزمره مناسب است.',
    salePriceToman: 6_300_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'necklaces',
    brandSlug: 'hamidian-studio',
    variants: [
      {
        sku: 'DEMO-NECKLACE-SARV',
        name: 'زنجیر ۴۵ سانتی‌متر',
        weightGrams: 11.5,
        onHand: 2,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'گردنبند نقره آینه',
    slug: 'silver-necklace-ayene',
    shortDescription: 'گردنبند نقره با پلاک صیقلی و فرم مدرن.',
    description:
      'مدل آینه با سطح براق و زنجیر مینیمال ساخته شده و برای ترکیب با گردنبندهای دیگر مناسب است.',
    salePriceToman: 7_100_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'necklaces',
    brandSlug: 'minimal-silver',
    variants: [
      {
        sku: 'DEMO-NECKLACE-AYENE',
        name: 'زنجیر ۵۰ سانتی‌متر',
        weightGrams: 13.2,
        onHand: 4,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'گوشواره نقره مهتاب',
    slug: 'silver-earrings-mahtab',
    shortDescription: 'گوشواره حلقه‌ای سبک با مقطع باریک.',
    description:
      'گوشواره مهتاب برای استفاده روزمره طراحی شده و وزن سبک آن استفاده طولانی‌مدت را راحت می‌کند.',
    salePriceToman: 2_750_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'earrings',
    brandSlug: 'hamidian-studio',
    variants: [
      {
        sku: 'DEMO-EARRINGS-MAHTAB',
        name: 'یک جفت',
        weightGrams: 4.2,
        onHand: 8,
        platingEligible: true,
      },
    ],
  },
  {
    name: 'گوشواره نقره آوین',
    slug: 'silver-earrings-avin',
    shortDescription: 'گوشواره میخی نقره با فرم ساده و پرداخت آینه‌ای.',
    description:
      'مدل آوین یک گوشواره کوچک و مینیمال برای استفاده روزانه و ترکیب با مدل‌های دیگر است.',
    salePriceToman: 3_200_000,
    sizeMode: SizeMode.FREE_SIZE,
    categorySlug: 'earrings',
    brandSlug: 'minimal-silver',
    variants: [
      {
        sku: 'DEMO-EARRINGS-AVIN',
        name: 'یک جفت',
        weightGrams: 4.8,
        onHand: 5,
        platingEligible: true,
      },
    ],
  },
];

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: permission,
    });
  }
}

async function seedRoles(): Promise<void> {
  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
        deletedAt: null,
      },
      create: {
        ...role,
        isSystem: true,
      },
    });
  }
}

async function syncSystemRolePermissions(): Promise<void> {
  const roleCodes = Object.values(ROLE_CODES);
  const permissionCodes = PERMISSION_DEFINITIONS.map(({ code }) => code);

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: roleCodes } },
      select: { id: true, code: true },
    }),
    prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    }),
  ]);

  const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  const systemRoleIds = roles.map(({ id }) => id);
  const grants = roleCodes.flatMap((roleCode) => {
    const roleId = roleIdByCode.get(roleCode);

    if (!roleId) {
      throw new Error(`System role was not found after seeding: ${roleCode}`);
    }

    return SYSTEM_ROLE_PERMISSION_CODES[roleCode].map((permissionCode) => {
      const permissionId = permissionIdByCode.get(permissionCode);

      if (!permissionId) {
        throw new Error(`Permission was not found after seeding: ${permissionCode}`);
      }

      return {
        roleId,
        permissionId,
      };
    });
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.rolePermission.deleteMany({
      where: {
        roleId: {
          in: systemRoleIds,
        },
      },
    });

    if (grants.length > 0) {
      await transaction.rolePermission.createMany({
        data: grants,
        skipDuplicates: true,
      });
    }
  });
}

async function seedDemoCatalog(): Promise<void> {
  const country = await prisma.country.upsert({
    where: { isoCode: 'IR' },
    update: {
      name: 'ایران',
      slug: 'iran',
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: 'ایران',
      slug: 'iran',
      isoCode: 'IR',
    },
  });

  const jewelryCategory = await prisma.category.upsert({
    where: { slug: 'jewelry' },
    update: {
      name: 'زیورآلات',
      description: 'مجموعه زیورآلات نقره حمیدیان',
      parentId: null,
      sortOrder: 0,
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: 'زیورآلات',
      slug: 'jewelry',
      description: 'مجموعه زیورآلات نقره حمیدیان',
      sortOrder: 0,
    },
  });

  const categoryDefinitions = [
    { name: 'انگشتر', slug: 'rings', sortOrder: 10 },
    { name: 'دستبند', slug: 'bracelets', sortOrder: 20 },
    { name: 'گردنبند', slug: 'necklaces', sortOrder: 30 },
    { name: 'گوشواره', slug: 'earrings', sortOrder: 40 },
  ] as const;
  const categoryIdBySlug = new Map<string, string>();

  for (const categoryDefinition of categoryDefinitions) {
    const category = await prisma.category.upsert({
      where: { slug: categoryDefinition.slug },
      update: {
        name: categoryDefinition.name,
        parentId: jewelryCategory.id,
        sortOrder: categoryDefinition.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      create: {
        ...categoryDefinition,
        parentId: jewelryCategory.id,
      },
    });

    categoryIdBySlug.set(category.slug, category.id);
  }

  const brandDefinitions = [
    {
      name: 'حمیدیان استودیو',
      slug: 'hamidian-studio',
      description: 'طراحی‌های مینیمال و معاصر گالری حمیدیان',
    },
    {
      name: 'مینیمال سیلور',
      slug: 'minimal-silver',
      description: 'مجموعه فرضی برای تست رابط فروشگاه',
    },
  ] as const;
  const brandIdBySlug = new Map<string, string>();

  for (const brandDefinition of brandDefinitions) {
    const brand = await prisma.brand.upsert({
      where: { slug: brandDefinition.slug },
      update: {
        name: brandDefinition.name,
        description: brandDefinition.description,
        isActive: true,
        deletedAt: null,
      },
      create: brandDefinition,
    });

    brandIdBySlug.set(brand.slug, brand.id);
  }

  const sizeDefinitions = [
    { code: '52', label: '۵۲', sortOrder: 10 },
    { code: '54', label: '۵۴', sortOrder: 20 },
    { code: '56', label: '۵۶', sortOrder: 30 },
  ] as const;
  const sizeIdByCode = new Map<string, string>();

  for (const sizeDefinition of sizeDefinitions) {
    const size = await prisma.size.upsert({
      where: { code: sizeDefinition.code },
      update: {
        label: sizeDefinition.label,
        sortOrder: sizeDefinition.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      create: sizeDefinition,
    });

    sizeIdByCode.set(size.code, size.id);
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'DEMO-STORE' },
    update: {
      name: 'انبار تست فروشگاه',
      isDefault: true,
      isActive: true,
      deletedAt: null,
    },
    create: {
      code: 'DEMO-STORE',
      name: 'انبار تست فروشگاه',
      isDefault: true,
    },
  });

  const goldRate = await prisma.platingRate.upsert({
    where: { type: PlatingType.GOLD },
    update: {
      pricePerGramToman: 38_000,
      leadTimeDays: 3,
      isActive: true,
    },
    create: {
      type: PlatingType.GOLD,
      pricePerGramToman: 38_000,
      leadTimeDays: 3,
    },
  });
  const rhodiumRate = await prisma.platingRate.upsert({
    where: { type: PlatingType.RHODIUM },
    update: {
      pricePerGramToman: 12_000,
      leadTimeDays: 2,
      isActive: true,
    },
    create: {
      type: PlatingType.RHODIUM,
      pricePerGramToman: 12_000,
      leadTimeDays: 2,
    },
  });

  for (const productDefinition of DEMO_CATALOG_PRODUCTS) {
    const categoryId = categoryIdBySlug.get(productDefinition.categorySlug);
    const brandId = brandIdBySlug.get(productDefinition.brandSlug);

    if (!categoryId || !brandId) {
      throw new Error(`Demo catalog relation was not seeded for ${productDefinition.slug}.`);
    }

    const product = await prisma.product.upsert({
      where: { slug: productDefinition.slug },
      update: {
        name: productDefinition.name,
        shortDescription: productDefinition.shortDescription,
        description: productDefinition.description,
        status: ProductStatus.ACTIVE,
        sizeMode: productDefinition.sizeMode,
        brandId,
        countryId: country.id,
        salePriceToman: productDefinition.salePriceToman,
        deletedAt: null,
      },
      create: {
        name: productDefinition.name,
        slug: productDefinition.slug,
        shortDescription: productDefinition.shortDescription,
        description: productDefinition.description,
        status: ProductStatus.ACTIVE,
        sizeMode: productDefinition.sizeMode,
        brandId,
        countryId: country.id,
        salePriceToman: productDefinition.salePriceToman,
      },
    });

    await prisma.productCategory.upsert({
      where: {
        productId_categoryId: {
          productId: product.id,
          categoryId,
        },
      },
      update: {},
      create: {
        productId: product.id,
        categoryId,
      },
    });

    for (const variantDefinition of productDefinition.variants) {
      const sizeId = variantDefinition.sizeCode
        ? sizeIdByCode.get(variantDefinition.sizeCode)
        : undefined;

      if (variantDefinition.sizeCode && !sizeId) {
        throw new Error(`Demo size was not seeded: ${variantDefinition.sizeCode}`);
      }

      const variant = await prisma.productVariant.upsert({
        where: { sku: variantDefinition.sku },
        update: {
          productId: product.id,
          sizeId: sizeId ?? null,
          name: variantDefinition.name ?? null,
          weightGrams: variantDefinition.weightGrams,
          platingEligible: variantDefinition.platingEligible ?? false,
          isActive: true,
          deletedAt: null,
        },
        create: {
          productId: product.id,
          sizeId: sizeId ?? null,
          sku: variantDefinition.sku,
          name: variantDefinition.name,
          weightGrams: variantDefinition.weightGrams,
          platingEligible: variantDefinition.platingEligible ?? false,
        },
      });

      await prisma.inventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: warehouse.id,
            variantId: variant.id,
          },
        },
        update: {
          onHand: variantDefinition.onHand,
          lowStockThreshold: 1,
        },
        create: {
          warehouseId: warehouse.id,
          variantId: variant.id,
          onHand: variantDefinition.onHand,
          reserved: 0,
          lowStockThreshold: 1,
        },
      });

      if (variantDefinition.platingEligible) {
        for (const platingRateId of [goldRate.id, rhodiumRate.id]) {
          await prisma.productPlatingOption.upsert({
            where: {
              variantId_platingRateId: {
                variantId: variant.id,
                platingRateId,
              },
            },
            update: {
              isActive: true,
            },
            create: {
              variantId: variant.id,
              platingRateId,
            },
          });
        }
      }
    }
  }

  console.log(
    `Seeded ${DEMO_CATALOG_PRODUCTS.length} demo catalog products. Add local images under apps/storefront/public/dev-catalog/products using each product slug as a .webp filename.`,
  );
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedRoles();
  await syncSystemRolePermissions();

  console.log(
    `Seeded ${PERMISSION_DEFINITIONS.length} permissions and ${SYSTEM_ROLE_DEFINITIONS.length} system roles.`,
  );

  if (process.env.SEED_DEMO_CATALOG === 'true') {
    await seedDemoCatalog();
  } else {
    console.log('Skipped demo catalog seed. Set SEED_DEMO_CATALOG=true to enable it.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
