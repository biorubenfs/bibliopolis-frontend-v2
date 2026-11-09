import { TestBed } from '@angular/core/testing';

import { BooksViewPreference } from '../books-view';
import { BooksViewToggle } from './books-view-toggle';

describe('BooksViewToggle', () => {
  afterEach(() => localStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(BooksViewToggle);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    return { fixture, element, button };
  }

  it('offers both views with labelled buttons and marks the current one', () => {
    const { element, button } = render();

    expect(element.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Vista de los libros',
    );
    expect(button('Ver como tarjetas').getAttribute('aria-checked')).toBe('true');
    expect(button('Ver como tabla').getAttribute('aria-checked')).toBe('false');
  });

  it('changes the preferred view', () => {
    const { fixture, button } = render();

    button('Ver como tabla').click();
    fixture.detectChanges();

    expect(TestBed.inject(BooksViewPreference).view()).toBe('table');
    expect(button('Ver como tabla').getAttribute('aria-checked')).toBe('true');
  });
});
