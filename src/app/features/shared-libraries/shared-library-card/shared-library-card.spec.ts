import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SharedLibrary } from '../shared-library.model';
import { SharedLibraryCard } from './shared-library-card';

describe('SharedLibraryCard', () => {
  const library: SharedLibrary = {
    id: 'l1',
    name: 'Novela',
    description: 'Mis novelas',
    ownerName: 'Ana',
    booksCount: 1,
    shareRatings: false,
    sharedAt: '',
  };

  function render(changes: Partial<SharedLibrary> = {}) {
    TestBed.configureTestingModule({
      imports: [SharedLibraryCard],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(SharedLibraryCard);
    fixture.componentRef.setInput('library', { ...library, ...changes });
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the library with its owner and links to it', () => {
    const { element } = render();

    expect(element.querySelector('h2 a')?.textContent).toContain('Novela');
    expect(element.querySelector('h2 a')?.getAttribute('href')).toBe('/libraries/shared/l1');
    expect(element.querySelector('.owner')?.textContent).toBe('De Ana');
    expect(element.textContent).toContain('Mis novelas');
    expect(element.querySelector('.count')?.textContent).toContain('1 libro');
  });

  it('counts the books', () => {
    expect(render({ booksCount: 3 }).element.textContent).toContain('3 libros');
  });

  it('asks to leave the library through a labelled button', () => {
    const { fixture, element } = render();
    const leave = vi.fn();
    fixture.componentInstance.leaveRequested.subscribe(leave);

    element.querySelector<HTMLButtonElement>('[aria-label="Salir de Novela, de Ana"]')!.click();

    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner instead of the download button while exporting', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('exporting', true);
    fixture.detectChanges();

    expect(element.querySelector('[aria-label="Descargar Novela, de Ana"]')).toBeNull();
    expect(element.querySelector('mat-spinner')?.getAttribute('aria-label')).toBe('Descargando');
  });

  it('only offers to download and to leave: the rest is up to the owner', () => {
    const labels = Array.from(render().element.querySelectorAll('button'), (button) =>
      button.getAttribute('aria-label'),
    );

    expect(labels).toEqual(['Descargar Novela, de Ana', 'Salir de Novela, de Ana']);
  });
});
