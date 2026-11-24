import { BadRequestException } from '@nestjs/common';
import { CAMPAIGN_GIF_LIMIT_BYTES } from '../../config/media-storage';
import type { CampaignBannerSlot, Prisma } from '../../generated/prisma/client';
import type { CampaignPlacementAppearanceDto } from './dto/campaign-landing.dto';

const stillTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function validateCampaignPlacementAppearance(
  tx: Pick<Prisma.TransactionClient, 'media'>,
  slot: CampaignBannerSlot,
  input: CampaignPlacementAppearanceDto | undefined,
) {
  const {
    mediaId = null,
    mobileMediaId = null,
    stillMediaId = null,
    desktopHeight = null,
    mobileHeight = null,
    textColor = null,
    navigationEffect = null,
  } = input ?? {};

  const ids = [...new Set([mediaId, mobileMediaId, stillMediaId].filter((id) => id !== null))];
  if ((slot === 'NAVIGATION' && ids.length) || (slot !== 'NAVIGATION' && navigationEffect)) {
    throw new BadRequestException(
      'Navigation effects are only available on the navigation placement.',
    );
  }
  if (slot !== 'COUNTDOWN' && (desktopHeight || mobileHeight || textColor)) {
    throw new BadRequestException('Banner height and text color are configured on the countdown.');
  }
  if (ids.length) {
    const media = await tx.media.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, mimeType: true, sizeBytes: true, altText: true },
    });
    const needsStill = media.some(({ mimeType }) => mimeType === 'image/gif');
    if (
      media.length !== ids.length ||
      media.some(
        ({ mimeType, sizeBytes, altText }) =>
          !altText?.trim() ||
          (mimeType === 'image/gif'
            ? sizeBytes > CAMPAIGN_GIF_LIMIT_BYTES
            : !stillTypes.includes(mimeType)),
      ) ||
      (needsStill &&
        !media.some(({ id, mimeType }) => id === stillMediaId && stillTypes.includes(mimeType)))
    ) {
      throw new BadRequestException(
        'Choose supported media with alternative text and a static fallback for GIFs.',
      );
    }
  }

  return {
    mediaId,
    mobileMediaId,
    stillMediaId,
    desktopHeight,
    mobileHeight,
    textColor,
    navigationEffect,
  };
}
