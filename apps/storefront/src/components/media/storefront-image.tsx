import Image, { type ImageProps } from 'next/image';

const STOREFRONT_IMAGE_BLUR_DATA_URL =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%20viewBox=%220%200%208%208%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23eeedeb%22/%3E%3C/svg%3E';

type StorefrontImageProps = Omit<ImageProps, 'blurDataURL' | 'placeholder'>;

export function StorefrontImage(props: StorefrontImageProps) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} placeholder="blur" blurDataURL={STOREFRONT_IMAGE_BLUR_DATA_URL} />;
}
