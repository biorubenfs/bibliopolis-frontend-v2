export const PAGE_SIZE_OPTIONS = [12, 24, 48];
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** Anyone can edit the URL: anything that is not a valid page number means the first page. */
export function toPageNumber(value: string | null | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** Anyone can edit the URL: anything that is not an offered page size means the default one. */
export function toPageSize(value: string | null | undefined): number {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
}
