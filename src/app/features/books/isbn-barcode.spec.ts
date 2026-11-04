import { IsbnReadFilter, scannedValueToIsbn13 } from './isbn-barcode';

describe('scannedValueToIsbn13', () => {
  it.each([
    ['an ISBN-13 with prefix 978', '9780595385294', '9780595385294'],
    ['an ISBN-13 with prefix 979', '9798886451740', '9798886451740'],
    ['an ISBN-13 with hyphens', '978-0-595-38529-4', '9780595385294'],
    ['an ISBN-10, converted', '059538529X', '9780595385294'],
    ['an EAN-13 of another product', '8410000000009', null],
    ['an ISBN-13 with a wrong control digit', '9780595385295', null],
    ['an ISBN-10 with a wrong control digit', '0595385291', null],
    ['a value of another length', '12345678', null],
    ['text', 'https://bibliopolis.es', null],
  ])('with %s', (_case, value, expected) => {
    expect(scannedValueToIsbn13(value)).toBe(expected);
  });
});

describe('IsbnReadFilter', () => {
  const isbn = '9780595385294';

  it('accepts an ISBN the second time in a row it is read', () => {
    const filter = new IsbnReadFilter();

    expect(filter.accept([isbn])).toEqual([]);
    expect(filter.accept([isbn])).toEqual([isbn]);
  });

  it('does not accept two different readings', () => {
    const filter = new IsbnReadFilter();

    expect(filter.accept([isbn])).toEqual([]);
    expect(filter.accept(['8483835045'])).toEqual([]);
    expect(filter.accept([isbn])).toEqual([]);
  });

  it('tolerates frames without an ISBN between two readings', () => {
    const filter = new IsbnReadFilter();

    filter.accept([isbn]);
    filter.accept([]);
    filter.accept(['not an isbn']);

    expect(filter.accept([isbn])).toEqual([isbn]);
  });

  it('ignores an ISBN already accepted in the session', () => {
    const filter = new IsbnReadFilter();

    filter.accept([isbn]);
    filter.accept([isbn]);

    expect(filter.accept([isbn])).toEqual([]);
  });

  it('treats the ISBN-10 and the ISBN-13 of a book as the same book', () => {
    const filter = new IsbnReadFilter();

    filter.accept(['059538529X']);
    expect(filter.accept([isbn])).toEqual([isbn]);

    filter.accept(['059538529X']);
    expect(filter.accept(['059538529X'])).toEqual([]);
  });

  it('validates each code of a frame separately', () => {
    const filter = new IsbnReadFilter();
    const frame = [isbn, '8410000000009', '9788483835043'];

    filter.accept(frame);

    expect(filter.accept(frame)).toEqual([isbn, '9788483835043']);
  });
});
