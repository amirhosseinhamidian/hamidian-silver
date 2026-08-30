import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { normalizeIranianMobile } from '../auth/phone-normalizer';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        phoneVerifiedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    return user;
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  createAddress(userId: string, dto: CreateUserAddressDto) {
    return this.prisma.$transaction(async (transaction) => {
      const existingAddress = await transaction.userAddress.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      const isDefault = dto.isDefault === true || !existingAddress;

      if (isDefault) {
        await transaction.userAddress.updateMany({
          where: {
            userId,
            deletedAt: null,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return transaction.userAddress.create({
        data: {
          userId,
          title: dto.title.trim(),
          recipientName: dto.recipientName.trim(),
          phone: normalizeIranianMobile(dto.phone),
          province: dto.province.trim(),
          city: dto.city.trim(),
          addressLine: dto.addressLine.trim(),
          postalCode: dto.postalCode,
          isDefault,
        },
      });
    });
  }

  updateAddress(userId: string, addressId: string, dto: UpdateUserAddressDto) {
    return this.prisma.$transaction(async (transaction) => {
      const address = await transaction.userAddress.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
      });

      if (!address) {
        throw new NotFoundException('Address was not found.');
      }

      if (address.isDefault && dto.isDefault === false) {
        throw new BadRequestException(
          'Set another address as default instead of clearing the current default.',
        );
      }

      if (dto.isDefault === true) {
        await transaction.userAddress.updateMany({
          where: {
            userId,
            deletedAt: null,
            isDefault: true,
            id: {
              not: addressId,
            },
          },
          data: {
            isDefault: false,
          },
        });
      }

      return transaction.userAddress.update({
        where: {
          id: addressId,
        },
        data: {
          title: dto.title?.trim(),
          recipientName: dto.recipientName?.trim(),
          phone: dto.phone === undefined ? undefined : normalizeIranianMobile(dto.phone),
          province: dto.province?.trim(),
          city: dto.city?.trim(),
          addressLine: dto.addressLine?.trim(),
          postalCode: dto.postalCode,
          isDefault: dto.isDefault,
        },
      });
    });
  }

  setDefaultAddress(userId: string, addressId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const address = await transaction.userAddress.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          isDefault: true,
        },
      });

      if (!address) {
        throw new NotFoundException('Address was not found.');
      }

      if (address.isDefault) {
        return transaction.userAddress.findUniqueOrThrow({
          where: {
            id: addressId,
          },
        });
      }

      await transaction.userAddress.updateMany({
        where: {
          userId,
          deletedAt: null,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      return transaction.userAddress.update({
        where: {
          id: addressId,
        },
        data: {
          isDefault: true,
        },
      });
    });
  }

  deleteAddress(userId: string, addressId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const address = await transaction.userAddress.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
      });

      if (!address) {
        throw new NotFoundException('Address was not found.');
      }

      const deletedAt = new Date();
      await transaction.userAddress.update({
        where: {
          id: addressId,
        },
        data: {
          deletedAt,
          isDefault: false,
        },
      });

      if (address.isDefault) {
        const replacement = await transaction.userAddress.findFirst({
          where: {
            userId,
            deletedAt: null,
            id: {
              not: addressId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          select: {
            id: true,
          },
        });

        if (replacement) {
          await transaction.userAddress.update({
            where: {
              id: replacement.id,
            },
            data: {
              isDefault: true,
            },
          });
        }
      }

      return {
        id: addressId,
        deletedAt,
      };
    });
  }
}
