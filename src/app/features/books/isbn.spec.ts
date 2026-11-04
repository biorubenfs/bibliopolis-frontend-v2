import { isValidIsbn10, isValidIsbn13, isbn10ToIsbn13, sanitizeIsbn } from './isbn';

// Same cases as ../bibliopolis-backend/src/tests/unit/isbn.test.ts
describe('isbn', () => {
  it('removes hyphens and spaces', () => {
    expect(sanitizeIsbn(' 978-1 71850-040-2 ')).toBe('9781718500402');
  });

  describe('isValidIsbn13', () => {
    it.each([
      ['a valid ISBN-13', '9781718500402', true],
      ['a valid ISBN-13 with dashes', '978-1-71850-040-2', true],
      ['a wrong control digit', '9781718500403', false],
      ['a wrong core digit', '9781718500412', false],
      ['a wrong prefix digit', '945-1-71850-040-2', false],
      ['invalid characters', '978171%500402', false],
      ['a wrong length', '978171850040', false],
    ])('with %s', (_case, isbn, expected) => {
      expect(isValidIsbn13(isbn)).toBe(expected);
    });
  });

  describe('isValidIsbn10', () => {
    it.each([
      ['a valid ISBN-10', '8483835045', true],
      ['a valid ISBN-10 with dashes', '84-8383-504-5', true],
      ['an X as control digit', '059538529X', true],
      ['a wrong control digit', '8483835044', false],
      ['a wrong core digit', '8483836045', false],
      ['a wrong prefix digit', '1483835045', false],
      ['invalid characters', '8483835%45', false],
      ['a wrong length', '848383504', false],
    ])('with %s', (_case, isbn, expected) => {
      expect(isValidIsbn10(isbn)).toBe(expected);
    });
  });

  describe('isbn10ToIsbn13', () => {
    it('converts an ISBN-10', () => {
      expect(isbn10ToIsbn13('8415509790')).toBe('9788415509790');
    });

    it('ignores the X control digit', () => {
      expect(isbn10ToIsbn13('059538529X')).toBe('9780595385294');
    });

    it('rejects something that is not an ISBN-10', () => {
      expect(() => isbn10ToIsbn13('123')).toThrow('ISBN-10 invalid');
    });
  });
});
