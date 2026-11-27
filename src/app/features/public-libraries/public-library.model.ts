import { SharedLibrary } from '../shared-libraries/shared-library.model';

/**
 * A public library of another user in the list of «Públicas» (see docs/api/public-libraries.md in
 * the backend). It is opened as a shared library, which also gives access to the public ones.
 */
export interface PublicLibrary extends Pick<
  SharedLibrary,
  'id' | 'name' | 'description' | 'ownerName' | 'booksCount'
> {
  /** When it was last made public. */
  publishedAt: string;
}
