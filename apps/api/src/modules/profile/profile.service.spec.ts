import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const addressId = '20000000-0000-4000-8000-000000000001';

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userAddress: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileService(prisma as unknown as PrismaService);
  });

  it('makes the first saved address the default automatically', async () => {
    const transaction = {
      userAddress: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({
          id: addressId,
          userId,
          isDefault: true,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.createAddress(userId, {
      title: 'Home',
      recipientName: 'Test Customer',
      phone: '09123456789',
      province: 'Tehran',
      city: 'Tehran',
      addressLine: 'Test address',
      postalCode: '1234567890',
    });

    expect(transaction.userAddress.create).toHaveBeenCalledWith({
      data: {
        userId,
        title: 'Home',
        recipientName: 'Test Customer',
        phone: '+989123456789',
        province: 'Tehran',
        city: 'Tehran',
        addressLine: 'Test address',
        postalCode: '1234567890',
        isDefault: true,
      },
    });
  });

  it('unsets the old default when a new address becomes default', async () => {
    const transaction = {
      userAddress: {
        findFirst: jest.fn().mockResolvedValue({
          id: addressId,
          userId,
          isDefault: false,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          id: addressId,
          isDefault: true,
        }),
        findUniqueOrThrow: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setDefaultAddress(userId, addressId);

    expect(transaction.userAddress.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        deletedAt: null,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    expect(transaction.userAddress.update).toHaveBeenCalledWith({
      where: {
        id: addressId,
      },
      data: {
        isDefault: true,
      },
    });
  });

  it('does not allow the current default to be cleared directly', async () => {
    const transaction = {
      userAddress: {
        findFirst: jest.fn().mockResolvedValue({
          id: addressId,
          userId,
          isDefault: true,
        }),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateAddress(userId, addressId, {
        isDefault: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.userAddress.update).not.toHaveBeenCalled();
  });

  it('promotes another address when the current default is deleted', async () => {
    const replacementId = '30000000-0000-4000-8000-000000000001';
    const transaction = {
      userAddress: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: addressId,
            userId,
            isDefault: true,
          })
          .mockResolvedValueOnce({
            id: replacementId,
          }),
        update: jest.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({
          id: replacementId,
          isDefault: true,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.deleteAddress(userId, addressId);

    expect(transaction.userAddress.update).toHaveBeenLastCalledWith({
      where: {
        id: replacementId,
      },
      data: {
        isDefault: true,
      },
    });
  });

  it('rejects access to an address that belongs to another user', async () => {
    const transaction = {
      userAddress: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.setDefaultAddress(userId, addressId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
