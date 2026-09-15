export const ADMIN_MEDIA_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const MULTIPART_OVERHEAD_LIMIT_BYTES = 64 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const ALLOWED_FIELDS = new Set(['file', 'altText']);

type ValidatedMediaUpload =
  Readonly<{ ok: true; formData: FormData }> | Readonly<{ ok: false; response: Response }>;

function errorResponse(message: string, status: number): ValidatedMediaUpload {
  return { ok: false, response: Response.json({ message }, { status }) };
}

export async function validateMediaUploadRequest(request: Request): Promise<ValidatedMediaUpload> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('multipart/form-data;') || !contentType.includes('boundary=')) {
    return errorResponse('A multipart media upload is required.', 415);
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return errorResponse('The media upload length is invalid.', 400);
    }
    if (parsedLength > ADMIN_MEDIA_UPLOAD_LIMIT_BYTES + MULTIPART_OVERHEAD_LIMIT_BYTES) {
      return errorResponse('The media upload exceeds the 10 MB limit.', 413);
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('The multipart media upload is malformed.', 400);
  }

  const entries = [...formData.entries()];
  if (entries.some(([name]) => !ALLOWED_FIELDS.has(name))) {
    return errorResponse('The media upload contains an unsupported field.', 400);
  }

  const files = entries.filter(
    (entry): entry is [string, File] => entry[0] === 'file' && entry[1] instanceof File,
  );
  const nonFileValues = entries.filter(([, value]) => typeof value !== 'string');
  if (files.length !== 1 || nonFileValues.length !== 1) {
    return errorResponse('Exactly one media file is required.', 400);
  }

  const file = files[0][1];
  if (file.size === 0) return errorResponse('The media file is empty.', 400);
  if (file.size > ADMIN_MEDIA_UPLOAD_LIMIT_BYTES) {
    return errorResponse('The media upload exceeds the 10 MB limit.', 413);
  }
  if (!ALLOWED_MEDIA_TYPES.has(file.type.toLowerCase())) {
    return errorResponse('Only JPEG, PNG, WebP, and AVIF images are supported.', 415);
  }

  const altTextValues = entries.filter(([name]) => name === 'altText').map(([, value]) => value);
  if (altTextValues.length > 1) {
    return errorResponse('The media upload contains duplicate alt text.', 400);
  }
  const altText = altTextValues[0];
  if (typeof altText !== 'undefined' && (typeof altText !== 'string' || !altText.trim())) {
    return errorResponse('The media alt text must be a non-empty string.', 400);
  }
  if (typeof altText === 'string' && altText.length > 255) {
    return errorResponse('The media alt text exceeds the 255 character limit.', 400);
  }

  return { ok: true, formData };
}
