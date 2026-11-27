import 'reflect-metadata';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { buildPublicCatalogFacetsQuery } from '../src/modules/catalog/catalog-facets-query';
import { PublicCatalogFacetsQueryDto } from '../src/modules/catalog/dto/public-catalog-facets.dto';

async function main() {
  const raw: unknown = JSON.parse(process.argv[2] ?? '{}');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Provide one faceted search filter object as JSON.');
  }
  const query = plainToInstance(PublicCatalogFacetsQueryDto, raw);
  if (
    query.q !== undefined ||
    (await validate(query, { whitelist: true, forbidNonWhitelisted: true })).length
  ) {
    throw new Error('Provide valid faceted search filters without a text query.');
  }
  const statement = buildPublicCatalogFacetsQuery(query);
  const prisma = new PrismaService(new ConfigService());
  try {
    const plan = await prisma.$queryRaw<{ 'QUERY PLAN': unknown }[]>(
      Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`,
    );
    process.stdout.write(`${JSON.stringify(plan[0]['QUERY PLAN'], null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Could not read the catalog plan. Check the filters and local PostgreSQL setup.\n',
  );
  process.exitCode = 1;
});
