import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FestivalThemeTemplate } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type { FestivalThemeDto, FestivalThemeSourceDto } from './dto/festival-design.dto';
import type {
  ArchiveFestivalThemeDto,
  FestivalLibraryThemeDto,
  FestivalThemeHistoryQueryDto,
  FestivalThemeLibraryHistoryDto,
  FestivalThemeLibraryListDto,
  FestivalThemeLibraryQueryDto,
  SaveFestivalThemeDto,
} from './dto/festival-theme-library.dto';
import { checkFestivalTheme, festivalThemePresets } from './festival-theme';

const pageSize = 20;
const builtIn = (name: string) => festivalThemePresets.some((preset) => preset.name === name);
const storedTheme = (theme: FestivalThemeDto) =>
  JSON.parse(JSON.stringify(theme)) as Prisma.InputJsonObject;

function writableName(name: string) {
  if (!name || name.includes('\0'))
    throw new BadRequestException('Enter a valid festival theme name.');
  if (builtIn(name))
    throw new BadRequestException('Choose a name different from the built-in themes.');
}

function themeDescription(description: string | null | undefined) {
  if (description?.includes('\0'))
    throw new BadRequestException('Enter a valid festival theme description.');
  return description?.trim() || null;
}

function view(row: FestivalThemeTemplate): FestivalLibraryThemeDto {
  return {
    name: row.name,
    theme: row.theme as unknown as FestivalThemeDto,
    description: row.description,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

async function recordVersion(
  tx: Prisma.TransactionClient,
  row: FestivalThemeTemplate,
  actorId: string,
) {
  await tx.festivalThemeVersion.create({
    data: {
      templateName: row.name,
      version: row.version,
      description: row.description,
      theme: row.theme as Prisma.InputJsonObject,
      createdAt: row.updatedAt,
      actorId,
    },
  });
}

export async function createFestivalTheme(
  tx: Prisma.TransactionClient,
  { name, theme, description }: SaveFestivalThemeDto,
  actorId: string,
) {
  writableName(name);
  checkFestivalTheme(theme);
  const inserted = await tx.festivalThemeTemplate.createMany({
    data: [{ name, theme: storedTheme(theme), description: themeDescription(description) }],
    skipDuplicates: true,
  });
  if (inserted.count !== 1) throw new ConflictException('That theme name is already in use.');
  const row = await tx.festivalThemeTemplate.findUniqueOrThrow({ where: { name } });
  await recordVersion(tx, row, actorId);
  return row;
}

export async function requireFestivalThemeVersion(
  tx: Prisma.TransactionClient,
  { name, version }: FestivalThemeSourceDto,
  allowArchived: boolean,
) {
  if (builtIn(name) && version === 1) return;
  const row = name.includes('\0')
    ? null
    : await tx.festivalThemeVersion.findUnique({
        where: { templateName_version: { templateName: name, version } },
        select: { template: { select: { archivedAt: true } } },
      });
  if (!row) throw new NotFoundException('Festival theme version was not found.');
  if (row.template.archivedAt && !allowArchived)
    throw new ConflictException('This archived theme cannot be selected for a new design.');
}

@Injectable()
export class FestivalThemeLibraryService {
  constructor(private readonly db: PrismaService) {}

  async list(query: FestivalThemeLibraryQueryDto): Promise<FestivalThemeLibraryListDto> {
    const { q, status } = query;
    if (q?.includes('\0')) throw new BadRequestException('Enter a valid festival theme name.');
    const page = query.page ?? 1;
    const rows = await this.db.festivalThemeTemplate.findMany({
      where: {
        archivedAt: status === 'archived' ? { not: null } : null,
        ...(q
          ? { name: { contains: q.replace(/[\\%_]/g, (char) => `\\${char}`), mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return {
      presets:
        status === 'archived' || page !== 1
          ? []
          : festivalThemePresets.filter(
              ({ name }) => !q || name.toLowerCase().includes(q.toLowerCase()),
            ),
      items: rows.slice(0, pageSize).map(view),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  history(query: FestivalThemeHistoryQueryDto): Promise<FestivalThemeLibraryHistoryDto> {
    const { name } = query;
    if (name.includes('\0')) throw new BadRequestException('Enter a valid festival theme name.');
    const page = query.page ?? 1;
    return this.db.$transaction(
      async (tx) => {
        const template = await tx.festivalThemeTemplate.findUnique({ where: { name } });
        if (!template) throw new NotFoundException('Festival theme was not found.');
        const rows = await tx.festivalThemeVersion.findMany({
          where: { templateName: name },
          orderBy: { version: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize + 1,
        });
        return {
          template: view(template),
          items: rows.slice(0, pageSize).map((row) => ({
            name,
            version: row.version,
            description: row.description,
            createdAt: row.createdAt.toISOString(),
            theme: row.theme as unknown as FestivalThemeDto,
          })),
          page,
          hasMore: rows.length > pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async save(input: SaveFestivalThemeDto, actorId: string): Promise<FestivalLibraryThemeDto> {
    const { name, theme, expectedVersion, description } = input;
    const result = await this.db.$transaction(async (tx) => {
      if (expectedVersion == null) return createFestivalTheme(tx, input, actorId);
      writableName(name);
      checkFestivalTheme(theme);
      const updated = await tx.festivalThemeTemplate.updateMany({
        where: { name, version: expectedVersion, archivedAt: null },
        data: {
          theme: storedTheme(theme),
          version: { increment: 1 },
          ...(description !== undefined ? { description: themeDescription(description) } : {}),
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('The festival theme has changed or was archived.');
      const row = await tx.festivalThemeTemplate.findUniqueOrThrow({ where: { name } });
      await recordVersion(tx, row, actorId);
      return row;
    });
    return attachHumanAuditEvent(view(result), {
      title: `نسخهٔ ${result.version} تم «${result.name}» ذخیره شد.`,
      entityName: result.name,
      operationType: expectedVersion == null ? 'CREATE' : 'UPDATE',
      changes: [
        {
          field: 'version',
          label: 'نسخهٔ تم',
          before: expectedVersion ?? null,
          after: result.version,
        },
      ],
    });
  }

  async archive({
    name,
    expectedVersion,
  }: ArchiveFestivalThemeDto): Promise<FestivalLibraryThemeDto> {
    writableName(name);
    return this.db.$transaction(async (tx) => {
      const archived = await tx.festivalThemeTemplate.updateMany({
        where: { name, version: expectedVersion, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      const template = await tx.festivalThemeTemplate.findUnique({ where: { name } });
      if (!template || template.version !== expectedVersion || !template.archivedAt) {
        throw new ConflictException('The festival theme has changed or was archived.');
      }
      const result = view(template);
      return archived.count === 0
        ? result
        : attachHumanAuditEvent(result, {
            title: `تم «${name}» بایگانی شد.`,
            entityName: name,
            operationType: 'STATUS_CHANGE',
            changes: [
              {
                field: 'archivedAt',
                label: 'زمان بایگانی',
                before: null,
                after: result.archivedAt,
              },
            ],
          });
    });
  }
}
