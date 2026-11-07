import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Library } from '../library.model';
import { LibraryCard } from './library-card';

describe('LibraryCard', () => {
  const library: Library = {
    id: 'l1',
    name: 'Novela',
    description: 'Mis novelas',
    books: ['b1'],
    isFavorite: false,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };

  function render(changes: Partial<Library> = {}) {
    TestBed.configureTestingModule({ imports: [LibraryCard], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(LibraryCard);
    fixture.componentRef.setInput('library', { ...library, ...changes });
    fixture.detectChanges();
    return fixture;
  }

  it('shows the library data', () => {
    const element = render().nativeElement as HTMLElement;
    expect(element.textContent).toContain('Novela');
    expect(element.textContent).toContain('Mis novelas');
    expect(element.textContent).toContain('1 libro');
  });

  it('links to the library detail page', () => {
    const element = render().nativeElement as HTMLElement;
    const link = element.querySelector('h2 a');
    expect(link?.getAttribute('href')).toBe('/libraries/l1');
    expect(link?.textContent).toContain('Novela');
  });

  it('has labelled action buttons that emit the requested action', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const edit = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.editRequested.subscribe(edit);
    fixture.componentInstance.deleteRequested.subscribe(remove);

    (element.querySelector('[aria-label="Editar Novela"]') as HTMLButtonElement).click();
    (element.querySelector('[aria-label="Eliminar Novela"]') as HTMLButtonElement).click();

    expect(element.querySelector('[aria-label="Descargar Novela"]')).not.toBeNull();
    expect(edit).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  describe('favorite button', () => {
    const favoriteButton = (element: HTMLElement) =>
      element.querySelector<HTMLButtonElement>('[aria-label="Marcar Novela como favorita"]')!;

    it('shows an empty bookmark when the library is not a favorite', () => {
      const button = favoriteButton(render().nativeElement);
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.classList).not.toContain('active');
    });

    it('shows a filled bookmark, not a star, when the library is a favorite', () => {
      const button = favoriteButton(render({ isFavorite: true }).nativeElement);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.classList).toContain('active');
      expect(button.querySelector('mat-icon')).toBeNull();
    });

    it('emits when pressed and is disabled while saving', () => {
      const fixture = render();
      const toggled = vi.fn();
      fixture.componentInstance.favoriteToggled.subscribe(toggled);

      favoriteButton(fixture.nativeElement).click();
      expect(toggled).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('savingFavorite', true);
      fixture.detectChanges();
      expect(favoriteButton(fixture.nativeElement).disabled).toBe(true);
    });
  });
});
