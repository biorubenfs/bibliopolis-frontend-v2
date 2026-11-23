/**
 * Ported from ../bibliopolis-backend/src/utils/isbn.utils.ts, without changing its behaviour.
 * The repositories share no packages: if a rule changes, it has to change in both places.
 */

/**
 * The EAN-13 prefixes of books. 978 holds every ISBN-10 converted to ISBN-13; 979 was opened later,
 * so its ISBNs were only ever issued as ISBN-13 and have no ISBN-10.
 */
const ISBN13_PREFIXES = ['978', '979'];
// 979-0 is the ISMN (sheet music), not books: https://www.loc.gov/ismn/structure.html
const ISMN_PREFIX = '9790';

export function sanitizeIsbn(isbn: string): string {
  return isbn.trim().replace(/[-\s]/g, '');
}

export function isValidIsbn10(isbn: string): boolean {
  const clean = sanitizeIsbn(isbn);
  if (!/^\d{9}[\dX]$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  const check = clean[9];
  sum += check === 'X' ? 10 : parseInt(check, 10);
  return sum % 11 === 0;
}

/** The control digit alone accepts any EAN-13, so the prefix must also be one of books. */
export function isValidIsbn13(isbn: string): boolean {
  const clean = sanitizeIsbn(isbn);
  if (!/^\d{13}$/.test(clean)) return false;
  if (
    !ISBN13_PREFIXES.some((prefix) => clean.startsWith(prefix)) ||
    clean.startsWith(ISMN_PREFIX)
  ) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(clean[12], 10);
}

export function isbn10ToIsbn13(isbn10: string): string {
  const clean = sanitizeIsbn(isbn10);

  // A wrong control digit would be dropped below, and the result would be another book's ISBN-13
  if (!isValidIsbn10(clean)) {
    throw new Error('ISBN-10 invalid');
  }

  const core = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < core.length; i++) {
    sum += parseInt(core[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return `${core}${checkDigit}`;
}
