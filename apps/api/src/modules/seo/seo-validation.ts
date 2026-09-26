export const SEO_CANONICAL_PATH_PATTERN =
  /^\/(?!\/)(?!(?:account|api|cart|checkout|payment|wishlist)(?:\/|$))(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^\\\s?#]*$/;

export const PRODUCT_SEO_CANONICAL_PATH_PATTERN =
  /^\/products\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^\\\s?#]+$/;

export const CATEGORY_SEO_CANONICAL_PATH_PATTERN =
  /^\/categories\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^\\\s?#]+$/;

export const BRAND_SEO_CANONICAL_PATH_PATTERN =
  /^\/brands\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^\\\s?#]+$/;

export const SEO_TITLE_TEMPLATE_PATTERN =
  /^(?:(?!%s)[\s\S])*%s(?:(?!%s)[\s\S])*$/;
