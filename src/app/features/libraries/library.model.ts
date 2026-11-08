import { BookCover, ExternalBook } from '../books/external-book.model';

export interface Library {
  id: string;
  name: string;
  description: string;
  userId: string;
  /** IDs of the user books in this library. */
  books: string[];
  /** Favorites are listed first in «Mis bibliotecas». */
  isFavorite: boolean;
  /** IDs of its tags, own or global (at most 5). */
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibrary {
  name: string;
  description: string;
  /** Replaces all the tags of the library when updating. */
  tagIds?: string[];
}

/** Validation limits defined by the backend (see docs/api/libraries.md). */
export const LIBRARY_NAME_MIN_LENGTH = 3;
export const LIBRARY_NAME_MAX_LENGTH = 50;
export const LIBRARY_DESCRIPTION_MAX_LENGTH = 100;
export const LIBRARY_SEARCH_MAX_LENGTH = 100;

/** A new library is never a favorite: it can only be marked with an update. */
export type UpdateLibrary = Partial<CreateLibrary> & { isFavorite?: boolean };

export type LibraryExportFormat = 'pdf' | 'csv';

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
