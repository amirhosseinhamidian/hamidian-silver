import { BadRequestException } from '@nestjs/common';
import type { FestivalThemeDto, FestivalThemePresetDto } from './dto/festival-design.dto';

export const festivalThemePresets: FestivalThemePresetDto[] = [
  {
    name: 'بلک فرایدی',
    theme: {
      background: '#15131a',
      surface: '#24202c',
      foreground: '#f8f5fb',
      accent: '#e3abd1',
      gradient: '#2e243d',
      decoration: 'LINES',
      motion: 'STILL',
    },
  },
  {
    name: 'یلدا',
    theme: {
      background: '#fff3f5',
      surface: '#ffffff',
      foreground: '#37111a',
      accent: '#871d3f',
      gradient: '#f3d5dc',
      decoration: 'DOTS',
      motion: 'STILL',
    },
  },
  {
    name: 'نوروز',
    theme: {
      background: '#eff7ed',
      surface: '#ffffff',
      foreground: '#16372c',
      accent: '#215342',
      gradient: '#d6e9db',
      decoration: 'DOTS',
      motion: 'STILL',
    },
  },
  {
    name: 'مناسبت ویژه',
    theme: {
      background: '#f6f3ee',
      surface: '#ffffff',
      foreground: '#2a2021',
      accent: '#69453f',
      gradient: '#f0e2df',
      decoration: 'NONE',
      motion: 'STILL',
    },
  },
];

function brightness(color: string) {
  const channels = color.slice(1).match(/../g) ?? [];
  const [red, green, blue] = channels.map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const a = brightness(first) + 0.05;
  const b = brightness(second) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

export function checkFestivalTheme({
  foreground,
  background,
  surface,
  gradient,
  card,
}: FestivalThemeDto) {
  const text = brightness(foreground) + 0.05;
  const canvases = [background, surface, gradient ?? background].map(
    (color) => brightness(color) + 0.05,
  );
  if (
    canvases.some((canvas) => Math.max(text, canvas) / Math.min(text, canvas) < 4.5) ||
    text > canvases[0] !== text > canvases[2]
  ) {
    throw new BadRequestException('Use a text color that contrasts with all festival backgrounds.');
  }

  if (!card) return;
  const cardSurface = card.surface ?? surface;
  if (
    [foreground, card.discount, card.tag, card.price, card.action].some(
      (color) => color != null && contrast(color, cardSurface) < 4.5,
    )
  ) {
    throw new BadRequestException('Use readable text, badges and buttons on the festival card.');
  }
  if (card.quota && contrast(card.quota, cardSurface) < 3) {
    throw new BadRequestException('Use a quota color that contrasts with the festival card.');
  }
}
