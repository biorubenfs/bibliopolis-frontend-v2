import { BookCover, ExternalBook } from '../books/external-book.model';

export interface Library {
  id: string;
  name: string;
  /** null when the library has no description. */
  description: string | null;
  userId: string;
  /** IDs of the user books in this library. */
  books: string[];
  /** Favorites are listed first in «Bibliotecas». */
  isFavorite: boolean;
  /** The people the library is shared with see the ratings of the owner, but never the notes. */
  shareRatings: boolean;
  /** IDs of its tags, own or global (at most 5). */
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibrary {
  name: string;
  /** null removes the description; the backend also stores a blank one as null. */
  description: string | null;
  /** Replaces all the tags of the library when updating. */
  tagIds?: string[];
}

/** Validation limits defined by the backend (see docs/api/libraries.md). */
export const LIBRARY_NAME_MIN_LENGTH = 3;
export const LIBRARY_NAME_MAX_LENGTH = 50;
export const LIBRARY_DESCRIPTION_MAX_LENGTH = 100;
export const LIBRARY_SEARCH_MAX_LENGTH = 100;

/** A new library is never a favorite nor shares the ratings: that is only set with an update. */
export type UpdateLibrary = Partial<CreateLibrary> & {
  isFavorite?: boolean;
  shareRatings?: boolean;
};

export type LibraryExportFormat = 'pdf' | 'csv';

/** Content-Disposition is not exposed through CORS, so the backend's naming rule is mirrored here. */
export function libraryExportFilename(name: string, format: LibraryExportFormat): string {
  return `${name.replace(/[^a-z0-9_-]/gi, '_')}.${format}`;
}

/** Body of POST /libraries/:id/books: at least one of the two ISBNs must have a value. */
export interface AddBookToLibrary {
  title: string;
  isbn13: string | null;
  isbn10: string | null;
  authors: string[];
  cover?: BookCover;
}

export function toAddBookToLibrary(book: ExternalBook): AddBookToLibrary {
  const { title, isbn13, isbn10, authors, cover } = book;
  return { title, isbn13, isbn10, authors, cover };
}
