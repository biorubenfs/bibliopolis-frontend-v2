import { TestBed } from '@angular/core/testing';

import { BookShelf } from './book-shelf';

describe('BookShelf', () => {
  async function setup(loading: boolean) {
    const fixture = TestBed.createComponent(BookShelf);
    fixture.componentRef.setInput('heading', 'Novedades');
    fixture.componentRef.setInput('books', []);
    fixture.componentRef.setInput('loading', loading);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('labels the shelf with its heading', async () => {
    const element = await setup(false);

    const section = element.querySelector('section')!;
    const heading = element.querySelector('h2')!;
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent).toBe('Novedades');
  });

  it('shows placeholders while loading, hidden from screen readers', async () => {
    const element = await setup(true);

    const skeletons = element.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    expect([...skeletons].every((node) => node.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(element.querySelector('.track')?.getAttribute('aria-busy')).toBe('true');
  });

  it('disables both arrows when there is nothing to scroll', async () => {
    const element = await setup(false);

    const arrows = [...element.querySelectorAll<HTMLButtonElement>('.arrows button')];
    expect(arrows.map((button) => button.disabled)).toEqual([true, true]);
  });
});
