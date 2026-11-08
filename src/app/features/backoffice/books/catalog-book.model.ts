/** A book of the shared catalog (see docs/api/books.md in the backend). */
export interface CatalogBook {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  isbn10: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CoverSource = 'google_books' | 'open_library';

/** The cover that one source has for a book. */
export interface CoverCandidate {
  source: CoverSource;
  value: string;
  coverUrl: string | null;
}

export type CreateCatalogBook =
  | { mode: 'sources'; isbn: string }
  | { mode: 'manual'; isbn: string; title: string; authors: string[] };

/** Only the fields that change. The cover is chosen by source: the backend fetches it. */
export interface UpdateCatalogBook {
  title?: string;
  authors?: string[];
  coverSource?: CoverSource | null;
}

export const COVER_SOURCE_LABELS: Record<CoverSource, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
};
