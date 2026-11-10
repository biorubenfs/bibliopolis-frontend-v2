import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { ManagedUser, ManagedUsersService } from '../managed-users.service';
import { BackofficeUserStatsPage } from './backoffice-user-stats-page';
import { UserStats } from './user-stats.model';

const user: ManagedUser = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@email.com',
  role: 'regular',
  createdAt: '2026-11-08T10:00:00.000Z',
  updatedAt: '',
};

const stats: UserStats = {
  libraries: { count: 3, averageBooks: 4 / 3, largestBooks: 3 },
  books: { total: 8, rated: 6, unrated: 2, withoutLibrary: 5 },
  ratings: {
    average: 7.5,
    distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 2, 8: 0, 9: 2, 10: 1 },
  },
};

const emptyStats: UserStats = {
  libraries: { count: 0, averageBooks: 0, largestBooks: null },
  books: { total: 0, rated: 0, unrated: 0, withoutLibrary: 0 },
  ratings: {
    average: null,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
  },
};

describe('BackofficeUserStatsPage', () => {
  async function setup(getStats: () => Observable<UserStats>, state: unknown = null) {
    const get = vi.fn(() => of(user));
    TestBed.configureTestingModule({
      imports: [BackofficeUserStatsPage],
      providers: [provideRouter([]), { provide: ManagedUsersService, useValue: { get, getStats } }],
    });
    const location = TestBed.inject(Location);
    vi.spyOn(location, 'getState').mockReturnValue(state);
    const back = vi.spyOn(location, 'back').mockImplementation(() => undefined);
    // The back link is a real link: no navigation in the tests
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BackofficeUserStatsPage);
    fixture.componentRef.setInput('id', 'u1');
    await fixture.whenStable();
    return { element: fixture.nativeElement as HTMLElement, get, back, navigate };
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('shows the user and the figures, with a decimal comma', async () => {
    const { element, get } = await setup(() => of(stats));

    expect(get).toHaveBeenCalledWith('u1');
    expect(text(element.querySelector('h1'))).toBe('Ana');
    const cards = Array.from(element.querySelectorAll('.cards .card')).map((card) => [
      text(card.querySelector('dt')),
      text(card.querySelector('dd')),
    ]);
    expect(cards).toEqual([
      ['Bibliotecas', '3'],
      ['Media de libros por biblioteca', '1,3'],
      ['Libros en la biblioteca más grande', '3'],
      ['Libros', '8'],
      ['Libros sin biblioteca', '5'],
    ]);
  });

  it('groups the ratings: the average and the rated books, with their share as text', async () => {
    const { element } = await setup(() => of(stats));

    const cards = Array.from(element.querySelectorAll('.rating-cards .card')).map((card) => [
      text(card.querySelector('dt')),
      text(card.querySelector('dd')),
    ]);
    expect(cards).toEqual([
      ['Valoración media', '7,5'],
      ['Libros valorados (75 %)', '6'],
    ]);
    expect(element.querySelector<HTMLElement>('.rated-bar .rated')!.style.width).toBe('75%');
  });

  it('draws the chart of the ratings', async () => {
    const { element } = await setup(() => of(stats));

    expect(element.querySelectorAll('app-rating-chart .target')).toHaveLength(10);
  });

  it('says so instead of drawing the chart when no book is rated', async () => {
    const unrated: UserStats = {
      ...stats,
      books: { total: 2, rated: 0, unrated: 2, withoutLibrary: 0 },
      ratings: emptyStats.ratings,
    };
    const { element } = await setup(() => of(unrated));

    expect(element.querySelector('app-rating-chart')).toBeNull();
    expect(element.textContent).toContain('Todavía no ha valorado ningún libro.');
  });

  it('shows a notice instead of empty charts for a user without data', async () => {
    const { element } = await setup(() => of(emptyStats));

    expect(text(element.querySelector('.status.empty'))).toContain(
      'Este usuario todavía no tiene bibliotecas ni libros.',
    );
    expect(element.querySelector('.ratings')).toBeNull();
    const values = Array.from(element.querySelectorAll('.cards dd')).map((dd) => text(dd));
    expect(values).toEqual(['0', '0', '—', '0', '0']);
  });

  it('says that the user was not found on a 404', async () => {
    const { element } = await setup(() =>
      throwError(() => new ApiError(404, 'NOT FOUND ERROR', 'user not found')),
    );

    expect(text(element.querySelector('[role="alert"] h1'))).toBe(
      'No hemos encontrado este usuario',
    );
  });

  it('offers retrying on any other error', async () => {
    const getStats = vi
      .fn<() => Observable<UserStats>>()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, 'boom')))
      .mockReturnValue(of(stats));
    const { element } = await setup(getStats);

    const retry = element.querySelector<HTMLButtonElement>('[role="alert"] button')!;
    expect(retry.textContent).toContain('Reintentar');
    retry.click();
    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('goes back to the list, keeping its search, when it came from there', async () => {
    const { element, back, navigate } = await setup(() => of(stats), { fromUserList: true });

    element.querySelector<HTMLButtonElement>('button.back')!.click();

    expect(back).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the list from the back link when it did not come from there', async () => {
    const { element, back, navigate } = await setup(() => of(stats));

    const link = element.querySelector<HTMLAnchorElement>('a.back')!;
    expect(link.getAttribute('href')).toBe('/backoffice/users');
    link.click();

    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
  });
});
