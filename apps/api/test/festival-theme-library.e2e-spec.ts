import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import type {
  FestivalDesignDto,
  FestivalThemeDto,
} from '../src/modules/campaigns/dto/festival-design.dto';
import { FestivalDesignService } from '../src/modules/campaigns/festival-design.service';
import { FestivalThemeLibraryService } from '../src/modules/campaigns/festival-theme-library.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('versions and archives themes while leaving two festival design snapshots independent', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const library = new FestivalThemeLibraryService(db);
  const design = new FestivalDesignService(db, new CatalogService(db, media), media);
  const key = `theme-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const theme: FestivalThemeDto = {
    background: '#18121e',
    surface: '#222230',
    foreground: '#fefefe',
    accent: '#ecacd5',
    decoration: 'LINES',
    motion: 'STILL',
  };
  const next: FestivalThemeDto = {
    ...theme,
    accent: '#d9a943',
    card: { discount: '#f2acda', density: 'COMPACT' },
  };
  try {
    const owner = await db.user.create({ data: { phone } });
    await expect(library.list({})).resolves.toMatchObject({
      presets: expect.arrayContaining([expect.objectContaining({ name: 'بلک فرایدی' })]),
    });
    await expect(library.save({ name: 'بلک فرایدی', theme }, owner.id)).rejects.toThrow('built-in');
    await expect(
      library.save({ name: key, description: 'نسخهٔ پایه', theme }, owner.id),
    ).resolves.toMatchObject({ version: 1 });
    await expect(library.save({ name: key, theme }, owner.id)).rejects.toThrow('already in use');
    await expect(library.list({ q: `${key}%` })).resolves.toMatchObject({ items: [] });
    await expect(
      library.save(
        { name: `${key}-invalid`, theme, description: 'invalid\0description' },
        owner.id,
      ),
    ).rejects.toThrow('valid festival theme description');

    const createFestival = async (suffix: string) => {
      const slug = `${key}-${suffix}`;
      await db.campaignLinkIdentity.create({ data: { id: slug, campaign: slug } });
      return db.campaign.create({
        data: {
          slug,
          name: slug,
          goal: 'فروش',
          message: 'جشنواره',
          channel: 'festival',
          ownerId: owner.id,
          trackingId: slug,
          kind: 'FESTIVAL',
          allProducts: true,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86_400_000),
          budgetToman: 0,
          landing: {
            create: {
              slug,
              seoMode: 'TEMPORARY',
              title: slug,
              story: 'معرفی جشنواره',
              collectionMode: 'FILTERED',
              filters: {},
            },
          },
        },
      });
    };
    const festivals = await Promise.all([createFestival('a'), createFestival('b')]);
    const picked: FestivalDesignDto = {
      schemaVersion: 1,
      theme,
      themeSource: { name: key, version: 1 },
      sections: [{ kind: 'PRODUCTS', enabled: true, title: 'محصولات', layout: 'GRID' }],
    };
    await expect(
      design.save(
        festivals[0].id,
        { ...picked, themeSource: { name: key, version: 99 }, expectedRevision: 1 },
        owner.id,
      ),
    ).rejects.toThrow('version');
    await Promise.all(
      festivals.map(({ id }) => design.save(id, { ...picked, expectedRevision: 1 }, owner.id)),
    );
    await db.campaign.update({ where: { id: festivals[1].id }, data: { status: 'ACTIVE' } });

    const results = await Promise.allSettled([
      library.save({ name: key, theme: next, expectedVersion: 1 }, owner.id),
      library.save({ name: key, theme: next, expectedVersion: 1 }, owner.id),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(library.history({ name: key })).resolves.toMatchObject({
      items: [
        { version: 2, theme: next },
        { version: 1, theme, description: 'نسخهٔ پایه' },
      ],
    });

    const localTheme: FestivalThemeDto = {
      ...theme,
      accent: '#abcdea',
      card: { action: '#abcdea', showDescription: false },
    };
    await design.save(
      festivals[0].id,
      { ...picked, theme: localTheme, saveThemeAs: `${key}-copy`, expectedRevision: 2 },
      owner.id,
    );
    await library.archive({ name: key, expectedVersion: 2 });
    await expect(library.list({ q: key })).resolves.toMatchObject({
      items: [{ name: `${key}-copy`, version: 1, theme: localTheme }],
    });
    await expect(library.list({ q: key, status: 'archived' })).resolves.toMatchObject({
      items: [{ name: key, archivedAt: expect.any(String) }],
    });
    await expect(library.save({ name: key, theme, expectedVersion: 2 }, owner.id)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      design.save(
        festivals[0].id,
        { ...picked, themeSource: { name: key, version: 2 }, expectedRevision: 3 },
        owner.id,
      ),
    ).rejects.toThrow('archived theme');
    await expect(
      design.save(festivals[0].id, { ...picked, theme: localTheme, expectedRevision: 3 }, owner.id),
    ).resolves.toMatchObject({ revision: 4 });
    await expect(design.editor(festivals[0].id)).resolves.toMatchObject({
      design: { theme: localTheme, themeSource: picked.themeSource },
    });
    await expect(design.editor(festivals[1].id)).resolves.toMatchObject({
      design: { theme, themeSource: picked.themeSource },
    });
    await db.festivalThemeTemplate.create({ data: { name: `${key}-compat`, theme: { ...theme } } });
    await expect(library.history({ name: `${key}-compat` })).resolves.toMatchObject({
      items: [{ version: 1, theme }],
    });
  } finally {
    try {
      const slug = { startsWith: key };
      await db.$transaction([
        db.campaignRevision.deleteMany({ where: { campaign: { slug } } }),
        db.campaignLanding.deleteMany({ where: { slug } }),
        db.campaign.deleteMany({ where: { slug } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: slug } }),
        db.festivalThemeVersion.deleteMany({ where: { templateName: slug } }),
        db.festivalThemeTemplate.deleteMany({ where: { name: slug } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
