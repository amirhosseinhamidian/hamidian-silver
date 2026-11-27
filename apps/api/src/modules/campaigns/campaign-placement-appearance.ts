import { BadRequestException } from '@nestjs/common';
import { CAMPAIGN_GIF_LIMIT_BYTES } from '../../config/media-storage';
import type { CampaignBannerSlot, Prisma } from '../../generated/prisma/client';
import { parseCampaignDestination } from '../growth-attribution/campaign-links.service';
import type { CampaignPlacementAppearanceDto } from './dto/campaign-landing.dto';
import type { CampaignPlacementDisplayDto } from './dto/campaign-placement-display.dto';
import { hasGradientContrast } from './festival-theme';

const stillTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const displayOrigin = 'https://campaign.invalid';

export function readCampaignPlacementDisplay(
  value: Prisma.JsonValue | Prisma.InputJsonValue | undefined,
) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CampaignPlacementDisplayDto)
    : undefined;
}

function prepareDisplay(
  slot: CampaignBannerSlot,
  input: CampaignPlacementAppearanceDto | undefined,
) {
  const display = input?.display;
  const { textColor, navigationEffect } = input ?? {};
  if (display && slot !== 'NAVIGATION' && slot !== 'COUNTDOWN') {
    throw new BadRequestException('Display settings belong to the menu or announcement.');
  }
  const { title, message, ctaLabel, ctaPath, ...style } = display ?? {};
  const {
    borderColor,
    icon,
    mediaFit,
    overlay,
    ctaStyle,
    showCountdown,
    useTheme,
    backgroundColor,
    gradientColor,
  } = style;
  if (
    (slot === 'NAVIGATION' &&
      (message ||
        ctaLabel ||
        ctaPath ||
        mediaFit ||
        overlay ||
        ctaStyle ||
        showCountdown != null)) ||
    (slot === 'COUNTDOWN' && (title || borderColor || icon))
  ) {
    throw new BadRequestException('Display settings belong to the menu or announcement.');
  }
  if (useTheme && (backgroundColor || gradientColor)) {
    throw new BadRequestException('Choose either theme colors or custom placement colors.');
  }
  if (Boolean(ctaLabel?.trim()) !== Boolean(ctaPath?.trim())) {
    throw new BadRequestException('Supply both the banner link and its label.');
  }
  const path =
    ctaPath?.trim() &&
    parseCampaignDestination(displayOrigin, ctaPath.trim()).href.slice(displayOrigin.length);
  if (path && path.length > 220)
    throw new BadRequestException('The encoded banner link is too long.');

  if (!useTheme && (backgroundColor || gradientColor || (slot === 'NAVIGATION' && textColor))) {
    const gradientPreset =
      slot === 'NAVIGATION' && navigationEffect && navigationEffect !== 'SOLID';
    const fill = backgroundColor ?? (gradientPreset ? '#40303d' : '#161616');
    const gradient = gradientColor ?? (!backgroundColor && gradientPreset ? '#6c414a' : fill);
    const text = textColor ?? '#ffffff';
    if (!hasGradientContrast(text, fill, gradient)) {
      throw new BadRequestException('Use a text color that contrasts with the campaign placement.');
    }
  }
  const fields = {
    ...style,
    title: title?.trim(),
    message: message?.trim(),
    ctaLabel: ctaLabel?.trim(),
    ctaPath: path,
  };
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value != null && value !== ''),
  ) as Prisma.InputJsonObject;
  return Object.keys(clean).length ? clean : undefined;
}

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
  if (
    (slot !== 'COUNTDOWN' && (desktopHeight || mobileHeight)) ||
    (slot !== 'COUNTDOWN' && slot !== 'NAVIGATION' && textColor)
  ) {
    throw new BadRequestException('Banner height and text color are configured on the countdown.');
  }
  const display = prepareDisplay(slot, input);
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
    ...(display ? { display } : {}),
  };
}
