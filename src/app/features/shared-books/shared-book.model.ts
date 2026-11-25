import { UserBook } from '../user-books/user-book.model';

/** A library shared with the user that contains a book. */
export interface SharedBookLibrary {
  id: string;
  name: string;
}

interface BaseSharedBook extends Pick<
  UserBook,
  'bookTitle' | 'bookAuthors' | 'bookCoverUrl' | 'bookIsbn13' | 'bookIsbn10'
> {
  /** The ID of the book in the catalog. */
  id: string;
  /** The opinion of the user, or null if the book is not in any of their own libraries. */
  own: Pick<UserBook, 'rating' | 'notes'> | null;
}

/** A book of the shared libraries, once (see docs/api/shared-books.md in the backend). */
export interface SharedBook extends BaseSharedBook {
  libraries: (SharedBookLibrary & { ownerName: string })[];
}

/** Someone who shares a book with the user. Two of them may have the same name. */
export interface SharedBookPerson {
  ownerName: string;
  /** They let the user see their ratings: tells a missing rating from a hidden one. */
  sharesRatings: boolean;
  rating: number | null;
  libraries: SharedBookLibrary[];
}

export interface SharedBookDetail extends BaseSharedBook {
  people: SharedBookPerson[];
}

/** Where a book is, in one line: «Viajes, de Ana» or «Viajes, de Ana, y 2 más». */
export function librariesLabel([first, ...rest]: SharedBook['libraries']): string {
  const label = `${first.name}, de ${first.ownerName}`;
  return rest.length > 0 ? `${label}, y ${rest.length} más` : label;
}
