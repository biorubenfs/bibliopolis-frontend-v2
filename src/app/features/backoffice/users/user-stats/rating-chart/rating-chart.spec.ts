import { TestBed } from '@angular/core/testing';

import { RatingChart, niceScale } from './rating-chart';

describe('niceScale', () => {
  it.each([
    [1, 1, [0, 1]],
    [2, 2, [0, 1, 2]],
    [3, 3, [0, 1, 2, 3]],
    [7, 8, [0, 2, 4, 6, 8]],
    [10, 10, [0, 5, 10]],
    [37, 40, [0, 10, 20, 30, 40]],
    [0, 1, [0, 1]],
  ])('draws an axis of round whole steps for a highest count of %i', (highest, max, ticks) => {
    expect(niceScale(highest)).toEqual({ max, ticks });
  });
});

describe('RatingChart', () => {
  async function setupFixture(distribution: Record<string, number>) {
    TestBed.configureTestingModule({ imports: [RatingChart] });
    const fixture = TestBed.createComponent(RatingChart);
    fixture.componentRef.setInput('distribution', distribution);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  async function setup(distribution: Record<string, number>) {
    return (await setupFixture(distribution)).element;
  }

  const distribution = { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 2, 8: 0, 9: 2, 10: 1 };

  it('draws one column per rating, from 1 to 10', async () => {
    const element = await setup(distribution);

    const labels = Array.from(element.querySelectorAll('.x-axis span')).map((s) => s.textContent);
    expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(element.querySelectorAll('.target')).toHaveLength(10);
  });

  it('scales the bars to the axis', async () => {
    const element = await setup(distribution);

    const bars = element.querySelectorAll<HTMLElement>('.bar');
    // Highest count 2: the axis goes from 0 to 2
    expect(bars[6].style.height).toBe('100%');
    expect(bars[9].style.height).toBe('50%');
    expect(bars[0].style.height).toBe('0%');
    const ticks = Array.from(element.querySelectorAll('.tick')).map((t) => t.textContent?.trim());
    expect(ticks).toEqual(['2', '1', '0']);
  });

  it('keeps the counts out of sight until a column is pointed at', async () => {
    const { element, fixture } = await setupFixture(distribution);
    const readout = () =>
      element.querySelector('.readout')!.textContent!.replace(/\s+/g, ' ').trim();
    const target = element.querySelectorAll<HTMLElement>('.target')[6];

    expect(readout()).toBe('Pasa el ratón o toca una columna para ver sus libros');

    target.dispatchEvent(new Event('mouseenter'));
    await fixture.whenStable();
    expect(readout()).toBe('Valoración 7 · 2 libros');
    expect(target.classList).toContain('active');

    target.dispatchEvent(new Event('mouseleave'));
    await fixture.whenStable();
    expect(readout()).toBe('Pasa el ratón o toca una columna para ver sus libros');
  });

  it('shows the count of a tapped or focused column', async () => {
    const { element, fixture } = await setupFixture(distribution);
    const targets = element.querySelectorAll<HTMLElement>('.target');

    targets[9].click();
    await fixture.whenStable();
    expect(element.querySelector('.readout strong')?.textContent?.trim()).toBe('1 libro');

    targets[2].focus();
    await fixture.whenStable();
    expect(element.querySelector('.readout')?.textContent).toContain('Valoración 3');
  });

  it('does not clear the line when the previous column is left after entering the next', async () => {
    const { element, fixture } = await setupFixture(distribution);
    const targets = element.querySelectorAll<HTMLElement>('.target');

    targets[6].dispatchEvent(new Event('mouseenter'));
    targets[8].dispatchEvent(new Event('mouseenter'));
    targets[6].dispatchEvent(new Event('mouseleave'));
    await fixture.whenStable();

    expect(element.querySelector('.readout')?.textContent).toContain('Valoración 9');
  });

  it('gives every column its rating and count for screen readers and the keyboard', async () => {
    const element = await setup(distribution);

    const targets = Array.from(element.querySelectorAll('.target'));
    expect(targets.every((t) => t.getAttribute('tabindex') === '0')).toBe(true);
    expect(targets[6].getAttribute('aria-label')).toBe('Valoración 7: 2 libros');
    expect(targets[9].getAttribute('aria-label')).toBe('Valoración 10: 1 libro');
  });
});
