/**
 * Ported from ../bibliopolis-backend/src/utils/isbn.utils.ts, without changing its behaviour.
 * The repositories share no packages: if a rule changes, it has to change in both places.
 */

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

export function isValidIsbn13(isbn: string): boolean {
  const clean = sanitizeIsbn(isbn);
  if (!/^\d{13}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(clean[12], 10);
}

export function isbn10ToIsbn13(isbn10: string): string {
  const clean = sanitizeIsbn(isbn10);

  if (!/^\d{9}[\dX]$/.test(clean)) {
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
