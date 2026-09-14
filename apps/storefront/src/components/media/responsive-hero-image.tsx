import { getImageProps } from 'next/image';

type ResponsiveHeroImageProps = Readonly<{
  desktopSrc: string;
  mobileSrc?: string | null;
  alt: string;
  preload?: boolean;
  className?: string;
  ariaHidden?: boolean;
}>;

const DESKTOP_WIDTH = 1_942;
const DESKTOP_HEIGHT = 809;
const MOBILE_WIDTH = 1_086;
const MOBILE_HEIGHT = 1_448;

export function ResponsiveHeroImage({
  desktopSrc,
  mobileSrc,
  alt,
  preload = false,
  className = 'object-cover',
  ariaHidden,
}: ResponsiveHeroImageProps) {
  const common = {
    alt,
    sizes: '100vw',
    className: `absolute inset-0 h-full w-full ${className}`,
    'aria-hidden': ariaHidden,
    ...(preload
      ? ({ loading: 'eager', fetchPriority: 'high' } as const)
      : ({ loading: 'lazy' } as const)),
  };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: desktopSrc,
    width: DESKTOP_WIDTH,
    height: DESKTOP_HEIGHT,
  });
  const {
    props: { alt: mobileAlt, srcSet: mobileSrcSet, ...mobileImageProps },
  } = getImageProps({
    ...common,
    src: mobileSrc ?? desktopSrc,
    width: MOBILE_WIDTH,
    height: MOBILE_HEIGHT,
  });

  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={desktopSrcSet} />
      <source media="(max-width: 1023px)" srcSet={mobileSrcSet} />
      <img {...mobileImageProps} alt={mobileAlt} />
    </picture>
  );
}
