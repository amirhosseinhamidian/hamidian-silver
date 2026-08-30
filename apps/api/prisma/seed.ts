import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
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

async function main(): Promise<void> {
  await seedPermissions();
  await seedRoles();
  await syncSystemRolePermissions();

  console.log(
    `Seeded ${PERMISSION_DEFINITIONS.length} permissions and ${SYSTEM_ROLE_DEFINITIONS.length} system roles.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
