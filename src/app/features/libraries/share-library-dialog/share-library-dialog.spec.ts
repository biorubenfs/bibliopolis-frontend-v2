import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { LibraryMember } from '../library-member.model';
import { LibraryMembersService } from '../library-members.service';
import { ShareLibraryDialog } from './share-library-dialog';

function member(id: string, name: string): LibraryMember {
  return { id, userId: id, name, email: `${id}@email.com`, createdAt: '' };
}

describe('ShareLibraryDialog', () => {
  const ana = member('u2', 'Ana');
  const luis = member('u3', 'Luis');

  async function setup(
    options: {
      members?: LibraryMember[];
      shareRatings?: boolean;
      isPublic?: boolean;
      services?: Partial<Record<keyof LibraryMembersService, unknown>>;
      update?: ReturnType<typeof vi.fn>;
      get?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const items = options.members ?? [ana];
    const members = {
      list: vi.fn(() => of({ items, total: items.length })),
      invite: vi.fn((_id: string, _email: string) => of(luis)),
      remove: vi.fn(() => of(undefined)),
      ...options.services,
    };
    const get =
      options.get ??
      vi.fn(() =>
        of({
          id: 'l1',
          shareRatings: options.shareRatings ?? false,
          isPublic: options.isPublic ?? false,
        }),
      );
    const update =
      options.update ??
      vi.fn((id: string, changes: Partial<Library>) =>
        of({ id, shareRatings: false, isPublic: false, ...changes }),
      );
    TestBed.configureTestingModule({
      imports: [ShareLibraryDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { id: 'l1', name: 'Novela' } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: LibrariesService, useValue: { get, update } },
        { provide: LibraryMembersService, useValue: members },
      ],
    });
    const fixture = TestBed.createComponent(ShareLibraryDialog);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const email = () => element.querySelector<HTMLInputElement>('input[type="email"]')!;
    return {
      component: fixture.componentInstance,
      element,
      members,
      get,
      update,
      settle,
      email,
      names: () => Array.from(element.querySelectorAll('.members .name'), (e) => e.textContent),
      toggle: () => element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!,
      visibilityToggle: () =>
        element.querySelectorAll<HTMLButtonElement>('mat-slide-toggle button')[1],
      errors: () =>
        Array.from(element.querySelectorAll('[role="alert"]'), (e) => e.textContent!.trim()).join(
          '',
        ),
      invite: async (value: string) => {
        email().value = value;
        email().dispatchEvent(new Event('input'));
        element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await settle();
      },
      remove: async (label: string) => {
        element.querySelector<HTMLButtonElement>(`[aria-label^="${label}"]`)!.click();
        await settle();
      },
    };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows who can see the library, with the current setting of the ratings', async () => {
    const { element, names, toggle, members, get } = await setup({
      members: [ana, luis],
      shareRatings: true,
    });

    expect(get).toHaveBeenCalledWith('l1');
    expect(members.list).toHaveBeenCalledWith('l1', { skip: 0, limit: 20 });
    expect(element.querySelector('h2')?.textContent).toContain('Novela');
    expect(element.textContent).toContain('Personas con acceso (2 de 20)');
    expect(names()).toEqual(['Ana', 'Luis']);
    expect(element.textContent).toContain('u2@email.com');
    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the setting of the ratings at hand when it is not shared with anyone', async () => {
    const { element, toggle } = await setup({ members: [] });

    expect(element.textContent).toContain('Aún no la compartes con nadie');
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(element.textContent).toContain('Tus notas son siempre privadas');
  });

  it('lets the user retry when it cannot be loaded', async () => {
    const get = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, '')))
      .mockReturnValue(of({ id: 'l1', shareRatings: false }));
    const { element, settle, names } = await setup({ get });

    expect(element.querySelector('form')).toBeNull();
    element.querySelector<HTMLButtonElement>('.status button')!.click();
    await settle();

    expect(names()).toEqual(['Ana']);
  });

  describe('invite', () => {
    it('adds the person first, clears the field and keeps the focus on it', async () => {
      const { element, members, names, email, invite, errors } = await setup();

      await invite('luis@email.com');

      expect(members.invite).toHaveBeenCalledWith('l1', 'luis@email.com');
      expect(names()).toEqual(['Luis', 'Ana']);
      expect(element.querySelector('.visually-hidden[role="status"]')?.textContent).toBe(
        'Luis ya puede ver la biblioteca.',
      );
      expect(email().value).toBe('');
      expect(document.activeElement).toBe(email());
      expect(element.querySelector('mat-error')).toBeNull();
      expect(errors()).toBe('');
    });

    it.each(['', 'not-an-email'])('does not send the email «%s»', async (value) => {
      const { element, members, invite } = await setup();

      await invite(value);

      expect(members.invite).not.toHaveBeenCalled();
      expect(element.querySelector('mat-error')?.textContent).toContain('email válido');
    });

    it('explains a failure and keeps the email', async () => {
      const { email, names, invite, errors } = await setup({
        services: {
          invite: vi.fn(() => throwError(() => new ApiError(404, null, 'user not found'))),
        },
      });

      await invite('nobody@email.com');

      expect(errors()).toBe('No hay ningún usuario con ese email.');
      expect(email().value).toBe('nobody@email.com');
      expect(names()).toEqual(['Ana']);
    });

    it('does not keep the previous failure next to a malformed email', async () => {
      const { element, invite, errors } = await setup({
        services: {
          invite: vi.fn(() => throwError(() => new ApiError(404, null, 'user not found'))),
        },
      });

      await invite('nobody@email.com');
      await invite('not-an-email');

      expect(errors()).toBe('');
      expect(element.querySelector('mat-error')).not.toBeNull();
    });

    it('sends a single invitation while it waits', async () => {
      const pending = new Subject<LibraryMember>();
      const { members, invite } = await setup({ services: { invite: vi.fn(() => pending) } });

      await invite('luis@email.com');
      await invite('luis@email.com');

      expect(members.invite).toHaveBeenCalledTimes(1);
    });

    it('is not possible over the limit', async () => {
      const full = Array.from({ length: 20 }, (_, index) => member(`m${index}`, `Lector ${index}`));
      const { element, members, invite, email } = await setup({ members: full });

      expect(element.textContent).toContain('Has llegado al máximo de 20 personas');
      expect(email().readOnly).toBe(true);
      await invite('luis@email.com');

      expect(members.invite).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the person and moves the focus to the field', async () => {
      const { element, members, names, email, remove } = await setup({ members: [ana, luis] });

      await remove('Retirar el acceso a Ana');

      expect(members.remove).toHaveBeenCalledWith('l1', 'u2');
      expect(names()).toEqual(['Luis']);
      expect(element.querySelector('.visually-hidden[role="status"]')?.textContent).toBe(
        'Ana ya no puede ver la biblioteca.',
      );
      expect(document.activeElement).toBe(email());
    });

    it('takes as removed who had already left', async () => {
      const { names, remove, errors } = await setup({
        services: {
          remove: vi.fn(() => throwError(() => new ApiError(404, null, 'member not found'))),
        },
      });

      await remove('Retirar el acceso a Ana');

      expect(names()).toEqual([]);
      expect(errors()).toBe('');
    });

    it('keeps the person after a failure', async () => {
      const { names, remove, errors } = await setup({
        services: { remove: vi.fn(() => throwError(() => new ApiError(500, null, ''))) },
      });

      await remove('Retirar el acceso a Ana');

      expect(names()).toEqual(['Ana']);
      expect(errors()).toContain('No se ha podido retirar el acceso');
    });
  });

  describe('ratings', () => {
    it('saves the setting at once', async () => {
      const { element, update, toggle, settle } = await setup();

      toggle().click();
      await settle();

      expect(update).toHaveBeenCalledWith('l1', { shareRatings: true });
      expect(toggle().getAttribute('aria-checked')).toBe('true');
      expect(element.querySelector('.saved[role="status"]')?.textContent).toBe(
        'Guardado: tus valoraciones se muestran.',
      );

      toggle().click();
      await settle();

      expect(update).toHaveBeenLastCalledWith('l1', { shareRatings: false });
      expect(element.querySelector('.saved[role="status"]')?.textContent).toBe(
        'Guardado: tus valoraciones ya no se muestran.',
      );
    });

    it('goes back to the saved setting after a failure', async () => {
      const { element, toggle, settle, errors } = await setup({
        update: vi.fn(() => throwError(() => new ApiError(500, null, ''))),
      });

      toggle().click();
      await settle();

      expect(toggle().getAttribute('aria-checked')).toBe('false');
      expect(errors()).toContain('No se ha podido guardar el cambio');
      expect(element.querySelector('.saved')?.textContent).toBe('');
    });
  });

  describe('visibility', () => {
    const saved = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('.saved[role="status"]'), (e) => e.textContent).join('');

    it('shows whether the library is public, with what anyone would see', async () => {
      const { element, visibilityToggle } = await setup({ isPublic: true });

      expect(visibilityToggle().getAttribute('aria-checked')).toBe('true');
      expect(element.querySelectorAll('mat-slide-toggle')[1].textContent).toContain(
        'Biblioteca pública',
      );
      expect(element.querySelector('#visibility-help')?.textContent).toContain(
        'Nunca verá tus valoraciones ni tus notas',
      );
    });

    it('saves it at once and tells whoever opened the dialog', async () => {
      const { component, element, update, visibilityToggle, settle } = await setup();
      const changed = vi.fn();
      component.visibilityChanged.subscribe(changed);

      visibilityToggle().click();
      await settle();

      expect(update).toHaveBeenCalledWith('l1', { isPublic: true });
      expect(visibilityToggle().getAttribute('aria-checked')).toBe('true');
      expect(saved(element)).toBe('Guardado: la biblioteca es pública.');
      expect(changed).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', isPublic: true }));

      visibilityToggle().click();
      await settle();

      expect(update).toHaveBeenLastCalledWith('l1', { isPublic: false });
      expect(saved(element)).toBe('Guardado: la biblioteca ya no es pública.');
      expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ isPublic: false }));
    });

    it('goes back to the saved setting after a failure', async () => {
      const { component, element, visibilityToggle, settle, errors } = await setup({
        update: vi.fn(() => throwError(() => new ApiError(500, null, ''))),
      });
      const changed = vi.fn();
      component.visibilityChanged.subscribe(changed);

      visibilityToggle().click();
      await settle();

      expect(visibilityToggle().getAttribute('aria-checked')).toBe('false');
      expect(errors()).toContain('No se ha podido guardar el cambio');
      expect(saved(element)).toBe('');
      expect(changed).not.toHaveBeenCalled();
    });
  });
});
