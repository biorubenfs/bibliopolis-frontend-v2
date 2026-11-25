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

/** The rating that someone gave to a book, shown next to their name. */
export interface PersonRating {
  /** Name of the person, or «Tú» for the user. */
  name: string;
  /** It is the rating of the user. */
  own: boolean;
  /** From 1 to 10, or null if they have not rated the book. */
  value: number | null;
}

/** What the cards and the table need from a book, be it of the user or of a shared library. */
export interface ListedBook extends Pick<
  UserBook,
  'id' | 'bookTitle' | 'bookAuthors' | 'bookCoverUrl' | 'bookIsbn13' | 'bookIsbn10'
> {
  /** The rating of the user, in their own lists. */
  rating?: number | null;
  /** The ratings of several people, in the shared libraries. */
  ratings?: readonly PersonRating[];
  /** IDs of the libraries of the user that contain the book, in their own lists. */
  libraries?: readonly string[];
}

/** The backend requires both fields on every update. */
export type UpdateUserBook = Pick<UserBook, 'rating' | 'notes'>;

/** Validation limits defined by the backend (see docs/api/user-books.md). */
export const USER_BOOK_RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const USER_BOOK_NOTES_MAX_LENGTH = 150;
