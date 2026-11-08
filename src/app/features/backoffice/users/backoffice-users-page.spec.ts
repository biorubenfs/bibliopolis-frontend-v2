import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { BackofficeUsersPage } from './backoffice-users-page';
import { ManagedUser, ManagedUsersService } from './managed-users.service';

const users: ManagedUser[] = [
  {
    id: 'u2',
    name: 'Ana',
    email: 'ana@email.com',
    role: 'regular',
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '',
  },
  {
    id: 'u1',
    name: 'Admin',
    email: 'admin@email.com',
    role: 'admin',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '',
  },
];

describe('BackofficeUsersPage', () => {
  async function setup(params: Record<string, string> = {}) {
    const list = vi.fn(() => of({ items: users, total: users.length }));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    TestBed.configureTestingModule({
      imports: [BackofficeUsersPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: new BehaviorSubject<ParamMap>(convertToParamMap(params)) },
        },
        { provide: ManagedUsersService, useValue: { list } },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: openDialog } });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BackofficeUsersPage);
    await fixture.whenStable();
    return { element: fixture.nativeElement as HTMLElement, list, openDialog };
  }

  it('loads the users and leaves the spinner', async () => {
    const { element, list } = await setup({ q: 'ana' });

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: 'ana' });
    expect(element.querySelector('mat-spinner')).toBeNull();
    const titles = Array.from(element.querySelectorAll('.row-title')).map((t) =>
      t.textContent?.trim(),
    );
    expect(titles).toEqual(['Ana', 'Admin Administrador']);
  });

  it('only offers resetting the password of regular users', async () => {
    const { element, openDialog } = await setup();

    const resetButtons = element.querySelectorAll<HTMLButtonElement>('[aria-label^="Restablecer"]');
    expect(resetButtons).toHaveLength(1);
    expect(resetButtons[0].getAttribute('aria-label')).toBe('Restablecer la contraseña de Ana');

    resetButtons[0].click();
    expect(openDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { user: users[0] } }),
    );
  });
});
