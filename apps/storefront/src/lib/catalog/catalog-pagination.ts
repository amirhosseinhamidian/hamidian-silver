export const maxCatalogFacetPage = 1000;

export function readCatalogFacetPage(value: string | string[] | undefined): number | null {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (values.length === 0) return 1;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;
  return Math.min(Number(values[0]), maxCatalogFacetPage + 1);
}
