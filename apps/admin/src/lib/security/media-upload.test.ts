import { describe, expect, it } from 'vitest';

import { ADMIN_MEDIA_UPLOAD_LIMIT_BYTES, validateMediaUploadRequest } from './media-upload';

function uploadRequest(formData: FormData, headers: HeadersInit = {}) {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'multipart/form-data; boundary=vitest-controlled-upload');
  }

  return {
    headers: requestHeaders,
    formData: async () => formData,
  } as unknown as Request;
}

describe('admin media upload boundary', () => {
  it('accepts one supported image and safe metadata', async () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1, 2, 3])], 'ring.png', { type: 'image/png' }));
    formData.set('altText', 'انگشتر نقره');

    const result = await validateMediaUploadRequest(uploadRequest(formData));

    expect(result.ok).toBe(true);
  });

  it('rejects a declared request larger than the bounded multipart allowance before parsing', async () => {
    const request = new Request('https://admin.example/api/catalog/media', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=upload',
        'content-length': String(ADMIN_MEDIA_UPLOAD_LIMIT_BYTES + 64 * 1024 + 1),
      },
      body: '--upload--',
    });

    const result = await validateMediaUploadRequest(request);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an oversized upload to be rejected.');
    expect(result.response.status).toBe(413);
  });

  it('rejects multiple files and unsupported media types', async () => {
    const multiple = new FormData();
    multiple.append('file', new File(['a'], 'one.png', { type: 'image/png' }));
    multiple.append('file', new File(['b'], 'two.png', { type: 'image/png' }));

    const multipleResult = await validateMediaUploadRequest(uploadRequest(multiple));
    expect(multipleResult.ok).toBe(false);

    const unsupported = new FormData();
    unsupported.set('file', new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }));

    const unsupportedResult = await validateMediaUploadRequest(uploadRequest(unsupported));
    expect(unsupportedResult.ok).toBe(false);
    if (unsupportedResult.ok) throw new Error('Expected SVG to be rejected.');
    expect(unsupportedResult.response.status).toBe(415);
  });

  it('rejects additional multipart fields instead of forwarding them upstream', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a'], 'one.webp', { type: 'image/webp' }));
    formData.set('accessToken', 'must-not-be-forwarded');

    const result = await validateMediaUploadRequest(uploadRequest(formData));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an unsupported field to be rejected.');
    expect(result.response.status).toBe(400);
  });

  it('rejects blank or oversized alt text at the BFF boundary', async () => {
    const blank = new FormData();
    blank.set('file', new File(['a'], 'one.webp', { type: 'image/webp' }));
    blank.set('altText', '   ');

    expect((await validateMediaUploadRequest(uploadRequest(blank))).ok).toBe(false);

    const oversized = new FormData();
    oversized.set('file', new File(['a'], 'one.webp', { type: 'image/webp' }));
    oversized.set('altText', 'الف'.repeat(256));

    expect((await validateMediaUploadRequest(uploadRequest(oversized))).ok).toBe(false);
  });
});
