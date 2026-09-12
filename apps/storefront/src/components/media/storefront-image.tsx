'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

const STOREFRONT_IMAGE_BLUR_DATA_URL =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%20viewBox=%220%200%208%208%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23eeedeb%22/%3E%3C/svg%3E';

type StorefrontImageProps = Omit<ImageProps, 'blurDataURL' | 'placeholder'>;
const FALLBACK_IMAGE_SRC = '/images/image-unavailable.svg';

export function StorefrontImage(props: StorefrontImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps['src'] | null>(null);
  const fallback = failedSrc === props.src;

  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...props}
      src={fallback ? FALLBACK_IMAGE_SRC : props.src}
      placeholder={fallback ? 'empty' : 'blur'}
      blurDataURL={STOREFRONT_IMAGE_BLUR_DATA_URL}
      unoptimized={fallback || props.unoptimized}
      onError={(event) => {
        if (!fallback) setFailedSrc(props.src);
        props.onError?.(event);
      }}
    />
  );
}
