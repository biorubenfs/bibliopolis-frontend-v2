/** A user's copy of a book (see docs/api/user-books.md in the backend). */
export interface UserBook {
  id: string;
  /** IDs of the libraries that contain this book. */
  libraries: string[];
  bookId: string;
  bookTitle: string;
  bookAuthors: string[];
  bookCoverUrl: string | null;
  bookIsbn13: string;
  bookIsbn10: string | null;
  /** The user's rating, from 1 to 10. */
  rating: number | null;
  notes: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** The backend requires both fields on every update. */
export type UpdateUserBook = Pick<UserBook, 'rating' | 'notes'>;

/** Validation limits defined by the backend (see docs/api/user-books.md). */
export const USER_BOOK_RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const USER_BOOK_NOTES_MAX_LENGTH = 150;
