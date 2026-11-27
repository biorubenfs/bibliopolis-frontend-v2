import { TestBed } from '@angular/core/testing';

import { RatingValue } from './rating-value';

describe('RatingValue', () => {
  function render(inputs: { value: number; name?: string; own?: boolean; showName?: boolean }) {
    const fixture = TestBed.createComponent(RatingValue);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the rating alone by default', () => {
    const element = render({ value: 8 });

    expect(element.textContent).toMatch(/^\s*star\s*8\/10\s*$/);
    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe('Valoración: 8 de 10');
  });

  it('shows who gave the rating', () => {
    const element = render({ value: 9, name: 'Ana', showName: true });

    expect(element.textContent).toMatch(/^\s*Ana\s*star\s*9\/10\s*$/);
    expect(element.getAttribute('aria-label')).toBe('Valoración de Ana: 9 de 10');
    expect(element.classList).not.toContain('own');
  });

  it('tells screen readers who gave the rating when the name is already visible elsewhere', () => {
    const element = render({ value: 9, name: 'Ana' });

    expect(element.textContent).not.toContain('Ana');
    expect(element.getAttribute('aria-label')).toBe('Valoración de Ana: 9 de 10');
  });

  it('tells the rating of the user apart', () => {
    const element = render({ value: 7, name: 'Tú', own: true, showName: true });

    expect(element.textContent).toContain('Tú');
    expect(element.getAttribute('aria-label')).toBe('Tu valoración: 7 de 10');
    expect(element.classList).toContain('own');
  });
});
