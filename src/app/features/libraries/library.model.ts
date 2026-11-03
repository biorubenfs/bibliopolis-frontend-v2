export interface Library {
  id: string;
  name: string;
  description: string;
  userId: string;
  /** IDs of the user books in this library. */
  books: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibrary {
  name: string;
  description: string;
}

/** Validation limits defined by the backend (see docs/api/libraries.md). */
export const LIBRARY_NAME_MIN_LENGTH = 3;
export const LIBRARY_NAME_MAX_LENGTH = 50;
export const LIBRARY_DESCRIPTION_MAX_LENGTH = 100;
export const LIBRARY_SEARCH_MAX_LENGTH = 100;

export type UpdateLibrary = Partial<CreateLibrary>;

export type LibraryExportFormat = 'pdf' | 'csv';
