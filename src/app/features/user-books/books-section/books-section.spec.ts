import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { SharedBooksService } from '../../shared-books/shared-books.service';
import { UserBooksService } from '../user-books.service';
import { BooksSection } from './books-section';

@Component({ template: '' })
class Page {}

describe('BooksSection', () => {
  async function setup(url: string) {
    const listOwn = vi.fn((_options: object) => of({ items: [], total: 12 }));
    const listShared = vi.fn((_options: object) => of({ items: [], total: 1 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'books',
            component: BooksSection,
            children: [
              { path: '', pathMatch: 'full', component: Page },
              { path: 'shared', component: Page },
            ],
          },
        ]),
        { provide: UserBooksService, useValue: { list: listOwn } },
        { provide: SharedBooksService, useValue: { list: listShared } },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const tabs = Array.from(root.querySelectorAll('a[role="tab"]'));
    return { root, tabs, listOwn, listShared };
  }

  it('counts the shared books from the own ones', async () => {
    const { root, tabs, listOwn, listShared } = await setup('/books?q=ros');

    expect(root.querySelector('h1')?.textContent).toBe('Libros');
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/books?q=ros',
      '/books/shared?q=ros',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs[1].textContent).toContain('Compartidos');
    expect(listShared).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: 'ros' });
    expect(listOwn).not.toHaveBeenCalled();
  });

  it('counts the own books from the shared ones', async () => {
    const { tabs, listOwn, listShared } = await setup('/books/shared');

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(tabs[0].textContent).toContain(', 12 libros');
    expect(listOwn).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: '' });
    expect(listShared).not.toHaveBeenCalled();
  });
});
