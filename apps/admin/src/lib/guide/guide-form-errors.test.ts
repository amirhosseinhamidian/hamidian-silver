import { describe, expect, it } from 'vitest';

import { guideSaveIssue } from '@/lib/guide/guide-form-errors';

describe('guideSaveIssue', () => {
  it('extracts nested API errors and points to the exact invalid block field', () => {
    expect(
      guideSaveIssue(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'blocks.4.anchorId must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/ regular expression',
          },
        },
        ['block-1', 'block-2', 'block-3', 'block-4', 'block-5'],
      ),
    ).toEqual({
      message:
        'خطا در بخش ۵، «شناسه لینک داخلی»: فقط حروف انگلیسی کوچک، عدد و خط تیره مجاز است؛ مانند silver-care.',
      fieldId: 'guide-block-block-5-anchor',
      blockIndex: 4,
    });
  });

  it('identifies top-level form fields while preserving the server detail', () => {
    expect(guideSaveIssue({ error: { message: 'slug must be unique' } }, [])).toEqual({
      message: 'خطا در بخش «اسلاگ»: slug must be unique',
      fieldId: 'guide-slug',
    });
  });
});
