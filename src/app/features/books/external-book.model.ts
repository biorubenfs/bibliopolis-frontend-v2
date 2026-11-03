/** Where a cover comes from, in the format the backend accepts when adding a book. */
export interface BookCover {
  source: 'google_books' | 'open_library' | null;
  value: string | null;
}

/** Book data found by ISBN (see docs/api/external.md in the backend). */
export interface ExternalBook {
  title: string;
  isbn13: string | null;
  isbn10: string | null;
  authors: string[];
  /** Only present when the book comes from an external source, not from the catalog. */
  cover?: BookCover;
  coverUrl: string | null;
}
