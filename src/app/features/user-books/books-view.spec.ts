import { TestBed } from '@angular/core/testing';

import { BooksViewPreference } from './books-view';

describe('BooksViewPreference', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows cards by default', () => {
    expect(TestBed.inject(BooksViewPreference).view()).toBe('grid');
  });

  it('restores the view stored in this browser', () => {
    localStorage.setItem('bibliopolis.booksView', 'table');

    expect(TestBed.inject(BooksViewPreference).view()).toBe('table');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('bibliopolis.booksView', 'mosaic');

    expect(TestBed.inject(BooksViewPreference).view()).toBe('grid');
  });

  it('remembers a new choice', () => {
    const preference = TestBed.inject(BooksViewPreference);

    preference.set('table');

    expect(preference.view()).toBe('table');
    expect(localStorage.getItem('bibliopolis.booksView')).toBe('table');
  });

  it('still changes the view when the storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const preference = TestBed.inject(BooksViewPreference);

    preference.set('table');

    expect(preference.view()).toBe('table');
  });
});
