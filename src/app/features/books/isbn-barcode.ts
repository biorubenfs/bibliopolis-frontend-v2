import { isValidIsbn10, isValidIsbn13, isbn10ToIsbn13, sanitizeIsbn } from './isbn';

/**
 * The ISBN-13 of a scanned value, or null if it is not an ISBN.
 *
 * The prefix is checked here because `isValidIsbn13` accepts any correct EAN-13, such as the one on
 * a packet of biscuits. It stays out of that function so it keeps matching the backend's.
 */
export function scannedValueToIsbn13(value: string): string | null {
  const clean = sanitizeIsbn(value);
  if (clean.length === 10) {
    return isValidIsbn10(clean) ? isbn10ToIsbn13(clean) : null;
  }
  if (clean.length === 13) {
    return isValidIsbn13(clean) && /^97[89]/.test(clean) ? clean : null;
  }
  return null;
}

/**
 * Decides which barcode readings of a scanning session become books to process. An ISBN is accepted
 * the second time in a row it is read, and only once per session.
 */
export class IsbnReadFilter {
  private previousRead = new Set<string>();
  private readonly accepted = new Set<string>();

  /** Receives the values read in one video frame and returns the newly accepted ISBN-13. */
  accept(values: string[]): string[] {
    const isbns = new Set(
      values.map(scannedValueToIsbn13).filter((isbn): isbn is string => isbn !== null),
    );
    // A frame without an ISBN is not a reading: blurry frames between two good ones are common
    if (isbns.size === 0) {
      return [];
    }

    const newlyAccepted = [...isbns].filter(
      (isbn) => this.previousRead.has(isbn) && !this.accepted.has(isbn),
    );
    newlyAccepted.forEach((isbn) => this.accepted.add(isbn));
    this.previousRead = isbns;
    return newlyAccepted;
  }
}
