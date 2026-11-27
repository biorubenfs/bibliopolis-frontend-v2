import { personRatings, raters } from './shared-library.model';

describe('personRatings', () => {
  const book = { ownerRating: 9, own: { rating: 7, notes: null } };

  it('has the ratings of the owner and of the user, in the order of the raters', () => {
    const library = { ownerName: 'Ana', shareRatings: true };

    expect(personRatings(library, book)).toEqual([
      { name: 'Ana', own: false, value: 9 },
      { name: 'Tú', own: true, value: 7 },
    ]);
    expect(raters(library)).toEqual(['Ana', 'Tú']);
  });

  it('leaves the owner out when they do not share their ratings', () => {
    const library = { ownerName: 'Ana', shareRatings: false };

    expect(personRatings(library, { ...book, ownerRating: null })).toEqual([
      { name: 'Tú', own: true, value: 7 },
    ]);
    expect(raters(library)).toEqual(['Tú']);
  });

  it('has no rating of the user for a book they do not have', () => {
    const library = { ownerName: 'Ana', shareRatings: true };

    expect(personRatings(library, { ownerRating: null, own: null })).toEqual([
      { name: 'Ana', own: false, value: null },
      { name: 'Tú', own: true, value: null },
    ]);
  });
});
