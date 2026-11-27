import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { formatTehranDate, parseTehranDate } from './campaign-calendar';
import { CreateCampaignDto } from './dto/campaign.dto';

describe('Tehran campaign calendar', () => {
  it('accepts Persian and Arabic digits and stores the corresponding UTC instant', () => {
    const instant = parseTehranDate('۱۴۰۳/٠١/۰۱ ۰۰:۱۵');
    expect(instant.toISOString()).toBe('2024-03-19T20:45:00.000Z');
    expect(formatTehranDate(instant)).toBe('1403/01/01 00:15');
  });

  it('keeps the leap day in 1403 and rejects invalid wall dates', () => {
    expect(formatTehranDate(parseTehranDate('1403/12/30 09:30'))).toBe('1403/12/30 09:30');
    expect(() => parseTehranDate('1402/12/30 09:30')).toThrow('Solar Hijri');
    expect(() => parseTehranDate('1403/07/31 09:30')).toThrow('Solar Hijri');
    expect(() => parseTehranDate('1403/01/01 24:00')).toThrow('Solar Hijri');
  });

  it('rejects string booleans and amounts instead of coercing them in the global validation pipe', () => {
    const draft = plainToInstance(
      CreateCampaignDto,
      {
        allProducts: 'false',
        bannerEnabled: 'false',
        budgetToman: '25000',
      },
      { enableImplicitConversion: true },
    );
    expect(validateSync(draft).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['allProducts', 'bannerEnabled', 'budgetToman']),
    );
  });

  it('accepts a festival draft without tracking fields in the global validation pipe', () => {
    const draft = plainToInstance(
      CreateCampaignDto,
      {
        kind: 'FESTIVAL',
        slug: 'black-friday',
        name: 'بلک فرایدی',
        goal: 'فروش مناسبتی',
        allProducts: true,
        productSlugs: [],
        categorySlugs: [],
        startsTehran: '1405/09/05 09:00',
        endsTehran: '1405/09/05 22:00',
        budgetToman: 1000,
        message: 'محصولات منتخب',
        bannerEnabled: false,
        bannerPriority: 0,
      },
      { enableImplicitConversion: true },
    );
    expect(validateSync(draft)).toEqual([]);
  });
});
