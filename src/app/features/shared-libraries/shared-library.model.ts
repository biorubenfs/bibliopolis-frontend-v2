import { OWN_NAME, PersonRating, UserBook } from '../user-books/user-book.model';

/** A library of another user, in read-only (see docs/api/shared-libraries.md in the backend). */
export interface SharedLibrary {
  id: string;
  name: string;
  /** null when the library has no description. */
  description: string | null;
  ownerName: string;
  booksCount: number;
  /** The owner lets the people with access see their ratings. */
  shareRatings: boolean;
  /** When it was shared with the user. */
  sharedAt: string;
}

/** A book of a shared library. */
export interface SharedLibraryBook extends Pick<
  UserBook,
  'bookTitle' | 'bookAuthors' | 'bookCoverUrl' | 'bookIsbn13' | 'bookIsbn10'
> {
  /** The ID of the book in the catalog. */
  id: string;
  /** null if the owner has not rated it, and always if the library does not share the ratings. */
  ownerRating: number | null;
  /** The opinion of the user, or null if the book is not in any of their own libraries. */
  own: Pick<UserBook, 'rating' | 'notes'> | null;
}

/**
 * Whose ratings are shown for the books of a library, with the value for one of them. Without the
 * ratings of the owner, only those of the user: then nobody is taken for not having rated the book.
 */
export function personRatings(
  library: Pick<SharedLibrary, 'ownerName' | 'shareRatings'>,
  book: Pick<SharedLibraryBook, 'ownerRating' | 'own'>,
): PersonRating[] {
  const own: PersonRating = { name: OWN_NAME, own: true, value: book.own?.rating ?? null };
  return library.shareRatings
    ? [{ name: library.ownerName, own: false, value: book.ownerRating }, own]
    : [own];
}

/** The people of `personRatings`, in the same order. */
export function raters(library: Pick<SharedLibrary, 'ownerName' | 'shareRatings'>): string[] {
  return library.shareRatings ? [library.ownerName, OWN_NAME] : [OWN_NAME];
}
