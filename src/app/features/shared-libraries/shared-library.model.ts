import { PersonRating, UserBook } from '../user-books/user-book.model';

/**
 * Why the user sees a library of another one: invited as a member, or only because it is public.
 */
export type LibraryAccess = 'member' | 'public';

/**
 * A library of another user, in read-only (see docs/api/shared-libraries.md in the backend): shared
 * with the user, or public.
 */
export interface SharedLibrary {
  id: string;
  name: string;
  /** null when the library has no description. */
  description: string | null;
  ownerName: string;
  booksCount: number;
  /** The user sees the ratings of the owner. Always false when `access` is `public`. */
  shareRatings: boolean;
  isPublic: boolean;
  access: LibraryAccess;
  /** When it was shared with the user; null when `access` is `public`. */
  sharedAt: string | null;
}

/** Someone who shares libraries with the user. Two of them may have the same name. */
export interface SharedLibraryOwner {
  id: string;
  name: string;
  /** How many libraries they share with the user. */
  librariesCount: number;
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

/** How the user is called next to their own rating. */
const OWN_NAME = 'Tú';

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
