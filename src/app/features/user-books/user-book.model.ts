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
