import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FestivalThemeDto } from './dto/festival-design.dto';
import { checkFestivalTheme, festivalThemePresets } from './festival-theme';

const theme = festivalThemePresets[0].theme;

describe('festival card theme', () => {
  it('validates optional card overrides alongside existing themes', () => {
    expect(() => checkFestivalTheme(theme)).not.toThrow();
    const custom = plainToInstance(FestivalThemeDto, {
      ...theme,
      card: { surface: '#21162d', action: '#e3abd1', density: 'COMPACT', hoverEmphasis: false },
    });
    expect(validateSync(custom, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(() => checkFestivalTheme(custom)).not.toThrow();
  });

  it('rejects unsupported style keys and values in the nested DTO', () => {
    const custom = plainToInstance(FestivalThemeDto, {
      ...theme,
      card: { action: 'var(--custom)', shadow: 'HEAVY', animation: 'spin' },
    });
    const errors = validateSync(custom, { whitelist: true, forbidNonWhitelisted: true });
    expect(
      errors.find(({ property }) => property === 'card')?.children?.map(({ property }) => property),
    ).toEqual(expect.arrayContaining(['action', 'shadow', 'animation']));
  });

  it('validates contrast against the effective card surface', () => {
    expect(() => checkFestivalTheme({ ...theme, card: { surface: theme.foreground } })).toThrow(
      'readable text',
    );
    expect(() => checkFestivalTheme({ ...theme, card: { action: theme.surface } })).toThrow(
      'readable text',
    );
    expect(() => checkFestivalTheme({ ...theme, card: { quota: theme.surface } })).toThrow(
      'quota color',
    );
  });
});
