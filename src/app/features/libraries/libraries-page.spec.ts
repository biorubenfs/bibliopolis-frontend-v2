import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LibrariesService } from './libraries.service';
import { LibrariesPage } from './libraries-page';
import { Library } from './library.model';

function library(id: string, name: string, books: string[] = []): Library {
  return {
    id,
    name,
    description: `Descripción de ${name}`,
    books,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
}

describe('LibrariesPage', () => {
  async function render(items: Library[]) {
    TestBed.configureTestingModule({
      imports: [LibrariesPage],
      providers: [
        { provide: LibrariesService, useValue: { list: () => of({ items, total: items.length }) } },
      ],
    });
    const fixture = TestBed.createComponent(LibrariesPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a card for each library', async () => {
    const element = await render([
      library('1', 'Novela', ['a', 'b']),
      library('2', 'Ensayo', ['c']),
    ]);

    const cards = element.querySelectorAll('.card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Novela');
    expect(cards[0].textContent).toContain('2 libros');
    expect(cards[1].textContent).toContain('1 libro');
  });

  it('shows an empty state and the create button when there are no libraries', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('Aún no tienes bibliotecas');
    expect(element.querySelector('.fab')?.textContent).toContain('Nueva biblioteca');
  });
});
